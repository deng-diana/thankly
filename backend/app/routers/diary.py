"""
日记路由 - 优化版本
主要改进：
1. ✅ 修复 async/await 调用问题
2. ✅ 优化代码结构和可读性
3. ✅ 增强错误处理
4. ✅ 保持所有原有逻辑不变
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, Request, Query, Body, Header
from fastapi.responses import StreamingResponse
from typing import List, Dict, Optional, AsyncGenerator
import asyncio
import re
import json
import uuid
import time
from datetime import datetime, timezone

from ..models.diary import DiaryCreate, DiaryResponse, DiaryUpdate, ImageOnlyDiaryCreate, PresignedUrlRequest
from ..services.openai_service import OpenAIService
from ..services.dynamodb_service import DynamoDBService
from ..services.s3_service import S3Service
from ..services.circle_service import CircleDBService
from ..utils.cognito_auth import get_current_user
from ..utils.transcription import validate_audio_quality, validate_transcription
from boto3.dynamodb.conditions import Attr  # ✅ 用于DynamoDB条件表达式

# ============================================================================
# 初始化
# ============================================================================

router = APIRouter()
db_service = DynamoDBService()
s3_service = S3Service()
circle_service = CircleDBService()

# ============================================================================
# 任务进度存储（内存存储，生产环境建议使用Redis）
# ============================================================================

# ✅ 全局任务状态（改为仅用于局部缓存，实际存储使用 DynamoDB）
# 这是为了解决 Lambda 多实例导致内存不冲突、任务 404 的问题
task_progress = {}

def _log_timing(label: str, start_time: float, task_id: Optional[str] = None) -> None:
    elapsed = time.perf_counter() - start_time
    if task_id:
        print(f"⏱️ [Task:{task_id}] {label}: {elapsed:.2f} 秒")
    else:
        print(f"⏱️ {label}: {elapsed:.2f} 秒")

def get_display_name(user: Dict, request: Request = None) -> Optional[str]:
    """
    统一获取用户显示名称的逻辑
    1. 优先从请求头获取（前端传递的最新名字）
    2. 如果请求头没有，从 token 获取
    """
    user_name = ""
    # 1. 优先从请求头获取
    if request:
        header_name = request.headers.get("X-User-Name", "").strip()
        if header_name:
            user_name = header_name
            # print(f"   ✅ 优先使用请求头中的用户名字: {user_name}")
            
    # 2. 如果请求头没有，从 token 获取
    if not user_name and user:
        user_name = user.get('name', '').strip() or user.get('preferred_username', '').strip()
        
    if not user_name:
        return None
        
    # 3. 提取第一个名字 (去掉空格后的部分)
    display_name = re.split(r'\s+', user_name)[0]
    return display_name

def get_user_language(request: Optional[Request] = None) -> str:
    """从请求头检测用户语言，默认为 Chinese"""
    user_language = "Chinese"
    if request:
        accept_lang = request.headers.get("Accept-Language", "").lower()
        if "en" in accept_lang and "zh" not in accept_lang:
            user_language = "English"
        # 也支持 X-User-Language 自定义 Header
        custom_lang = request.headers.get("X-User-Language", "").strip().capitalize()
        if custom_lang in ["Chinese", "English"]:
            user_language = custom_lang
    return user_language

def cleanup_old_tasks():
    """清理超过1小时的任务（防止内存泄漏）"""
    current_time = datetime.now(timezone.utc)
    expired_tasks = []
    for task_id, task_data in task_progress.items():
        created_at_str = task_data.get("created_at")
        if created_at_str:
            try:
                # 将 ISO 格式字符串转换回 datetime 对象
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                age = (current_time - created_at).total_seconds()
                if age > 3600:  # 1小时
                    expired_tasks.append(task_id)
            except (ValueError, TypeError):
                # 如果时间格式异常，也标记为过期以便清理
                expired_tasks.append(task_id)
    for task_id in expired_tasks:
        task_progress.pop(task_id, None)


def get_openai_service():
    """获取 OpenAI 服务实例（延迟初始化）"""
    return OpenAIService()

def update_task_progress(task_id: str, status: str, progress: int = 0, 
                        step: int = 0, step_name: str = "", message: str = "",
                        diary: Optional[Dict] = None, error: Optional[str] = None,
                        user_id: str = "TASK_SYSTEM",
                        persist: bool = True):
    """
    更新任务进度
    
    ✅ Phase 1.3 优化：添加 persist 参数
    - persist=True（默认）：写入 DynamoDB，用于关键节点（开始、完成、错误、步骤变化）
    - persist=False：只更新内存缓存，用于虚拟进度循环（减少 DynamoDB 写入开销）
    
    🔥 性能提升：虚拟进度循环不再频繁写入 DynamoDB，显著降低延迟
    """
    # 优先从内存缓存获取（减少 DynamoDB 读取）
    current_task_data = task_progress.get(task_id)
    
    # 只有在关键节点需要持久化时才从 DynamoDB 读取（确保数据一致性）
    if not current_task_data and persist:
        current_task_data = db_service.get_task_progress(task_id, user_id=user_id)
    
    if not current_task_data:
        current_task_data = {
            "status": "processing",
            "progress": 0,
            "step": 0,
            "step_name": "",
            "message": "",
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    # 🔥 关键优化：进度保护逻辑 - 进度只能增加，不能减少（除非状态改变）
    new_progress = max(current_task_data.get("progress", 0), progress)
    new_step = max(current_task_data.get("step", 0), step)

    current_task_data.update({
        "status": status,
        "progress": new_progress,
        "step": new_step,
        "step_name": step_name if step >= current_task_data.get("step", 0) else current_task_data.get("step_name"),
        "message": message if step >= current_task_data.get("step", 0) else current_task_data.get("message"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    if diary:
        current_task_data["diary"] = diary
    if error:
        current_task_data["error"] = error

    # ✅ Phase 1.3: 仅在 persist=True 时写入 DynamoDB
    if persist:
        db_service.save_task_progress(task_id, current_task_data, user_id=user_id)
    
    # 始终更新内存缓存（用于快速查询）
    task_progress[task_id] = current_task_data


# ============================================================================
# API 路由
# ============================================================================

@router.post("/text", response_model=DiaryResponse, summary="创建文字日记")
async def create_text_diary(
    diary: DiaryCreate,
    request: Request,  # ✅ 添加 Request 参数
    user: Dict = Depends(get_current_user)
):
    """
    创建文字日记 - 支持多语言
    
    流程：
    1. AI 多语言处理（检测语言、润色、生成标题和反馈）
    2. 保存到 DynamoDB
    """
    try:
        total_start = time.perf_counter()
        openai_service = get_openai_service()
        
        # ✅ 修复：添加 await
        print(f"✨ 开始处理文字日记...")
        # 获取用户名字用于个性化反馈
        user_display_name = get_display_name(user, request)
        print(f"👤 用户信息: user_id={user.get('user_id')}, display_name={user_display_name}")
        ai_result = await openai_service.polish_content_multilingual(diary.content, user_name=user_display_name)
        print(f"✅ AI 处理完成 - 标题: {ai_result['title']}")
        
        # ✅ 调试：检查emotion_data
        emotion_data = ai_result.get("emotion_data")
        print(f"🔍 [DEBUG] emotion_data from AI: {emotion_data}")
        
        # 保存到数据库
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=diary.content,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("language", "zh"),  # 默认中文
            title=ai_result["title"],
            emotion_data=emotion_data # ✅ 传递情感数据
        )
        
        # ✅ 调试：检查保存后的数据
        print(f"🔍 [DEBUG] diary_obj emotion_data: {diary_obj.get('emotion_data')}")
        
        print(f"✅ 文字日记创建成功 - ID: {diary_obj['diary_id']}")
        return diary_obj
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 创建文字日记失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"创建日记失败: {str(e)}"
        )


@router.post("/voice", response_model=DiaryResponse, summary="创建语音日记")
async def create_voice_diary(
    audio: UploadFile = File(...),
    duration: int = Form(...),
    user: Dict = Depends(get_current_user),
    request: Request = None  # ✅ 添加 Request 参数以获取请求头
):
    """
    创建语音日记
    
    流程：
    1. 验证音频质量
    2. 并行处理：上传 S3 + 语音转文字
    3. 验证转录内容
    4. AI 处理（润色、生成标题和反馈）
    5. 保存到 DynamoDB
    
    Args:
        audio: 音频文件（支持 mp3, m4a, wav 等格式）
        duration: 音频时长（秒）
        user: 当前登录用户
    """
    try:
        openai_service = get_openai_service()
        
        # ============================================
        # Step 1: 验证音频文件
        # ============================================
        if not audio.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail="请上传音频文件"
            )
        
        audio_content = await audio.read()
        user_lang = get_user_language(request)
        validate_audio_quality(duration, len(audio_content), language=user_lang)
        
        # ============================================
        # Step 2: 并行处理（提升速度）
        # ============================================
        print(f"📤 开始并行处理：上传 S3 + 语音转文字...")
        
        async def upload_to_s3_async():
            """异步上传到 S3"""
            return await asyncio.to_thread(
                s3_service.upload_audio,
                file_content=audio_content,
                file_name=audio.filename or "recording.m4a",
                content_type=audio.content_type or "audio/m4a"
            )
        
        async def transcribe_async():
            """异步语音转文字 - ✅ 添加 await"""
            return await openai_service.transcribe_audio(
                audio_content,
                audio.filename or "recording.m4a",
                expected_duration=duration
            )
        
        # 并行执行（同时进行，节省时间）- ✅ 添加容错
        results = await asyncio.gather(
            upload_to_s3_async(),
            transcribe_async(),
            return_exceptions=True  # ✅ S3失败不影响转录
        )
        
        # 检查结果
        audio_url_result = results[0]
        transcription_result = results[1]
        
        # 处理转录结果（优先检查，因为是核心功能）
        if isinstance(transcription_result, Exception):
            print(f"❌ Whisper转录失败: {transcription_result}")
            raise transcription_result  # 转录失败必须抛出
        
        # 🔥 提取转录文本和检测到的语言
        transcription = transcription_result["text"]
        detected_language = transcription_result.get("detected_language")
        
        # 处理S3上传结果
        if isinstance(audio_url_result, Exception):
            print(f"⚠️ S3并行上传失败，转录后重试: {audio_url_result}")
            # 重试上传（此时转录已完成，不影响总时间）
            try:
                audio_url = await asyncio.to_thread(
                    s3_service.upload_audio,
                    file_content=audio_content,
                    file_name=audio.filename or "recording.m4a",
                    content_type=audio.content_type or "audio/m4a"
                )
                print(f"✅ S3重试上传成功: {audio_url}")
            except Exception as retry_error:
                print(f"❌ S3重试上传仍失败: {retry_error}")
                raise HTTPException(status_code=500, detail="音频上传失败，请重试")
        else:
            audio_url = audio_url_result

        
        print(f"✅ 并行处理完成")
        print(f"  - 音频 URL: {audio_url}")
        print(f"  - 转录结果: {transcription[:50]}...")
        print(f"  - 检测语言: {detected_language}")
        
        # ============================================
        # Step 3: 验证转录内容
        # ============================================
        validate_transcription(transcription, duration)
        
        # ============================================
        # Step 4: AI 处理 - ✅ 添加 await
        # ============================================
        print(f"✨ 开始 AI 处理...")
        # 获取用户名字用于个性化反馈
        user_display_name = get_display_name(user, request)
        
        print(f"👤 用户信息提取:")
        print(f"   user_id: {user.get('user_id')}")
        print(f"   name字段: '{user.get('name')}'")
        print(f"   given_name字段: '{user.get('given_name')}'")
        print(f"   nickname字段: '{user.get('nickname')}'")
        print(f"   最终使用的名字: '{user_display_name}'")
        
        ai_result = await openai_service.polish_content_multilingual(
            transcription, 
            user_name=user_display_name,
            whisper_detected_language=detected_language  # 🔥 传递 Whisper 检测的语言
        )
        print(f"✅ AI 处理完成")
        print(f"  - 标题: {ai_result['title']}")
        print(f"  - 语言: {ai_result.get('language', 'zh')}")
        
        # ============================================
        # Step 5: 保存到数据库
        # ============================================
        print(f"📝 准备保存日记到数据库...")
        
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=transcription,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("language", "zh"),
            title=ai_result["title"],
            audio_url=audio_url,
            audio_duration=duration,
            emotion_data=ai_result.get("emotion_data") # ✅ 传递情感数据
        )
        
        print(f"✅ 语音日记创建成功 - ID: {diary_obj['diary_id']}")
        return diary_obj
        
    except HTTPException as e:
        # 检查是否是 EMPTY_TRANSCRIPT 错误（保持原错误格式）
        if e.status_code == 400:
            try:
                error_detail = json.loads(e.detail) if isinstance(e.detail, str) else e.detail
                if isinstance(error_detail, dict) and error_detail.get("code") == "EMPTY_TRANSCRIPT":
                    # 保持 EMPTY_TRANSCRIPT 错误码，让前端识别
                    raise e
            except (json.JSONDecodeError, AttributeError, TypeError):
                pass
        # 其他 HTTPException 直接抛出
        raise
    except ValueError as e:
        error_str = str(e)
        # ✅ 识别新的 error code 格式（TRANSCRIPTION_xxx）
        if error_str.startswith("TRANSCRIPTION_"):
            raise HTTPException(
                status_code=400,
                detail=error_str  # 直接返回 error code，前端使用 i18n 翻译
            )
        # 兼容旧逻辑（空内容错误）
        elif "空内容" in error_str:
            raise HTTPException(
                status_code=400,
                detail="TRANSCRIPTION_CONTENT_TOO_SHORT"
            )
        else:
            print(f"❌ ValueError 详情: {error_str}")
            raise HTTPException(status_code=500, detail="TRANSCRIPTION_FAILED")
    except Exception as e:
        # 其他未预期的错误
        print(f"❌ 创建语音日记失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="TRANSCRIPTION_FAILED"
        )


async def send_sse_event(event_type: str, data: Dict) -> str:
    """
    发送SSE事件格式的数据
    
    📚 学习点：SSE（Server-Sent Events）格式
    - 每行以 "data: " 开头
    - 可以指定事件类型：event: progress
    - 最后需要两个换行符 \n\n 表示事件结束
    
    例子：
    event: progress
    data: {"step": 1, "progress": 20}
    
    """
    event_line = f"event: {event_type}\n" if event_type else ""
    data_json = json.dumps(data, ensure_ascii=False)
    return f"{event_line}data: {data_json}\n\n"


async def process_pure_voice_diary_async(
    task_id: str,
    audio_content: bytes,
    audio_filename: str,
    audio_content_type: str,
    duration: int,
    user: Dict,
    request: Optional[Request],
    audio_url: Optional[str] = None
):
    """
    优化的纯语音日记处理函数 - 快速通道
    
    专门处理纯语音输入，去除所有图片处理逻辑，最大化性能
    
    流程：
    1. 并行处理：S3 上传 + 语音转文字 (0% → 50%)
    2. AI 处理：润色 + 反馈 (50% → 85%)
    3. 保存到数据库 (85% → 100%)
    """
    try:
        openai_service = get_openai_service()
        
        # ============================================
        # Step 0: 初始化 (5% → 10%)
        # ============================================
        # ✅ 专家优化：进度对齐 (前端上传完音频已经是 20%)
        update_task_progress(task_id, "processing", 22, 0, "验证中", "正在验证音频...", user_id=user['user_id'])
        
        # 验证音频质量
        user_lang = get_user_language(request)
        validate_audio_quality(duration, len(audio_content), language=user_lang)
        
        # ✅ 验证完成，立即跳到 15%（Demo优化：给转录更多进度空间）
        update_task_progress(task_id, "processing", 15, 1, "处理中", "准备正式开始处理...", user_id=user['user_id'])
        await asyncio.sleep(0.1)  # 短暂延迟，让前端看到进度变化
        
        # ============================================
        # Step 1: 并行处理 S3 上传 + 语音转文字 (15% → 60%) ← Demo优化
        # ============================================
        update_task_progress(task_id, "processing", 18, 1, "转录中", "正在努力识别你的声音...", user_id=user['user_id'])
        
        async def upload_to_s3_async():
            if audio_url:
                return audio_url
            s3_start = time.perf_counter()
            result = await asyncio.to_thread(
                s3_service.upload_audio,
                file_content=audio_content,
                file_name=audio_filename,
                content_type=audio_content_type
            )
            _log_timing("S3 上传完成", s3_start, task_id)
            return result
        
        # 🚀 优化：增加虚拟进度，防止转录期间卡死
        async def transcribe_with_progress():
            # ============================================
            # ✅ 2026-01-27 优化: 虚拟进度循环（行业最佳实践）
            # - 每5%持久化一次，确保前端能看到进度
            # - 两阶段速度：快速启动 + 平稳等待
            # ============================================
            async def smooth_progress():
                current_p = 18  # 从 18% 开始
                last_persisted = 18
                
                # Phase 1: 快速增长 (18% → 42%)
                while current_p < 42:
                    await asyncio.sleep(0.3)
                    current_p += 1
                    should_persist = (current_p - last_persisted) >= 5
                    if should_persist:
                        last_persisted = current_p
                    update_task_progress(task_id, "processing", current_p, 1, "转录中", "正在努力识别你的声音...", user_id=user['user_id'], persist=should_persist)
                
                # Phase 2: 缓慢增长 (42% → 55%)
                while current_p < 55:
                    await asyncio.sleep(0.8)
                    current_p += 1
                    should_persist = (current_p - last_persisted) >= 5
                    if should_persist:
                        last_persisted = current_p
                    update_task_progress(task_id, "processing", current_p, 1, "转录中", "语音识别中，请稍候...", user_id=user['user_id'], persist=should_persist)
            
            progress_task = asyncio.create_task(smooth_progress())
            try:
                transcribe_start = time.perf_counter()
                result = await openai_service.transcribe_audio(
                    audio_content,
                    audio_filename,
                    expected_duration=duration
                )
                _log_timing("Whisper 转录完成(含重试)", transcribe_start, task_id)
                return result
            finally:
                progress_task.cancel()

        # 并行执行
        audio_url, transcription_result = await asyncio.gather(
            upload_to_s3_async(),
            transcribe_with_progress()
        )
        
        # 🔥 提取转录文本和检测到的语言
        transcription = transcription_result["text"]
        detected_language = transcription_result.get("detected_language")
        print(f"🌍 Whisper 检测到的语言: {detected_language}")
        
        update_task_progress(task_id, "processing", 58, 1, "处理中", "语音识别完成", user_id=user['user_id'])
        
        # 验证转录内容
        validate_transcription(transcription, duration)
        
        # ============================================
        # Step 2: AI 处理 - 润色 + 反馈 (58% → 90%)
        # ✅ 2026-01-27 修复: 为 AI 处理添加虚拟进度，减少停顿感
        # ============================================
        update_task_progress(task_id, "processing", 60, 2, "AI润色", "正在美化文字...", user_id=user['user_id'])
        
        # 获取用户名字（优先使用 X-User-Name header）
        user_display_name = get_display_name(user, request)
        
        # ============================================
        # ✅ 2026-01-27 重构: AI处理期间的虚拟进度循环
        # 行业最佳实践：
        # 1. 平滑进度更新（每400ms增加1%）
        # 2. 关键节点持久化（每5%写入一次DynamoDB，确保多实例环境下一致性）
        # 3. 进度保护（不会倒退，只会前进）
        # 4. 详细的进度消息，提升用户体验
        # ============================================
        async def ai_with_progress():
            # 使用 nonlocal 变量跟踪当前进度，便于在 finally 中获取
            current_progress = 60
            ai_start = time.perf_counter()
            
            async def smooth_ai_progress():
                nonlocal current_progress
                # ✅ 丰富的进度消息，让用户感知到"真实"的处理过程
                messages = [
                    "正在美化文字...",      # 60-65%
                    "AI正在润色中...",       # 66-70%
                    "精心打磨语句...",       # 71-75%
                    "生成温暖反馈...",       # 76-80%
                    "最后检查中...",         # 81-85%
                    "即将完成..."            # 86-88%
                ]
                last_persisted = 60  # 上次持久化的进度
                
                while current_progress < 88:
                    await asyncio.sleep(0.35)  # ✅ 优化：稍快一点，更流畅
                    current_progress += 1
                    
                    # 计算消息索引（每5%切换一次消息）
                    msg_idx = min((current_progress - 60) // 5, len(messages) - 1)
                    
                    # ✅ 关键优化：每5%持久化一次到DynamoDB，确保进度可见
                    should_persist = (current_progress - last_persisted) >= 5
                    if should_persist:
                        last_persisted = current_progress
                        print(f"📊 [Progress] AI处理虚拟进度: {current_progress}% (已持久化)")
                    
                    update_task_progress(
                        task_id, "processing", current_progress, 2, "AI润色", 
                        messages[msg_idx], 
                        user_id=user['user_id'], 
                        persist=should_persist  # ✅ 关键节点持久化
                    )
            
            progress_task = asyncio.create_task(smooth_ai_progress())
            try:
                return await openai_service.polish_content_multilingual(
                    transcription, 
                    user_name=user_display_name,
                    whisper_detected_language=detected_language
                )
            finally:
                progress_task.cancel()
                _log_timing("AI 处理完成(润色/反馈/情绪)", ai_start, task_id)
                # ✅ 确保最终进度被持久化（防止AI处理太快导致进度没更新）
                final_progress = max(current_progress, 85)  # 至少到85%
                print(f"📊 [Progress] AI处理完成，最终虚拟进度: {final_progress}%")
                update_task_progress(
                    task_id, "processing", final_progress, 2, "AI润色", 
                    "AI处理完成", 
                    user_id=user['user_id'], 
                    persist=True
                )
        
        ai_result = await ai_with_progress()
        
        # ============================================
        # Step 3: 保存到数据库 (88% → 100%)
        # ✅ 2026-01-27 优化：平滑的保存进度过渡
        # ============================================
        print(f"📊 [Progress] 开始保存阶段 (88% → 100%)")
        
        # 88% → 90%: 准备保存
        update_task_progress(task_id, "processing", 88, 3, "保存中", "准备保存日记...", user_id=user['user_id'])
        await asyncio.sleep(0.2)  # 短暂延迟，让进度可见
        
        # 90%: 处理情绪数据
        update_task_progress(task_id, "processing", 90, 3, "保存中", "整理情绪数据...", user_id=user['user_id'])
        
        # --------------------------------------------------------
        # 🔥 情绪分析结果 (Pure Text Analysis)
        # --------------------------------------------------------
        text_emotion = ai_result.get("emotion_data", {})
        final_emotion_data = {
            "emotion": text_emotion.get("emotion", "Reflective"),
            "confidence": text_emotion.get("confidence", 0.0),
            "rationale": text_emotion.get("rationale", ""),
            "source": "text_only",
            "meta": {
                "text": text_emotion
            }
        }
        
        await asyncio.sleep(0.15)  # 短暂延迟，让进度可见
        
        # 93%: 写入数据库
        update_task_progress(task_id, "processing", 93, 3, "保存中", "写入数据库...", user_id=user['user_id'])

        db_start = time.perf_counter()
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=transcription,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("language", "zh"),
            title=ai_result["title"],
            audio_url=audio_url,
            audio_duration=duration,
            emotion_data=final_emotion_data
        )
        _log_timing("DynamoDB 写入完成", db_start, task_id)
        
        # 96%: 数据库写入完成
        update_task_progress(task_id, "processing", 96, 3, "保存中", "数据保存成功...", user_id=user['user_id'])
        await asyncio.sleep(0.15)  # 短暂延迟，让进度可见
        
        # 98%: 最终验证
        update_task_progress(task_id, "processing", 98, 3, "完成中", "最终验证...", user_id=user['user_id'])
        await asyncio.sleep(0.1)  # 短暂延迟，让进度可见
        
        # ============================================
        # Step 4: 完成 (100%)
        # ============================================
        print(f"📊 [Progress] 任务完成: {task_id}")
        update_task_progress(task_id, "completed", 100, 4, "完成", "日记创建成功", diary=diary_obj, user_id=user['user_id'])
        _log_timing("纯语音全流程完成", total_start, task_id)
        
    except HTTPException as e:
        update_task_progress(task_id, "failed", 0, 0, "错误", str(e.detail), error=str(e.detail), user_id=user['user_id'])
    except Exception as e:
        print(f"❌ 纯语音日记处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        update_task_progress(task_id, "failed", 0, 0, "错误", f"处理失败: {str(e)}", error=str(e), user_id=user['user_id'])


async def process_voice_diary_async(
    task_id: str,
    audio_content: bytes,
    audio_filename: str,
    audio_content_type: str,
    duration: int,
    user: Dict,
    request: Optional[Request],
    image_urls: Optional[List[str]] = None,  # ✅ 新增：图片URL列表
    content: Optional[str] = None,  # ✅ 新增：用户手动输入的文字内容
    audio_url: Optional[str] = None
):
    """异步处理语音日记（后台任务）"""
    try:
        total_start = time.perf_counter()
        openai_service = get_openai_service()
        
        # ✅ 专家优化：进度对齐 (前端上传完音频已经是 20%)
        update_task_progress(task_id, "processing", 22, 0, "验证中", "正在验证音频...", user_id=user['user_id'])
        
        # 验证音频质量
        user_lang = get_user_language(request)
        validate_audio_quality(duration, len(audio_content), language=user_lang)
        
        # ✅ 验证完成，跳过较低进度，直接到 25%
        update_task_progress(task_id, "processing", 25, 0, "准备处理", "准备开始处理...", user_id=user['user_id'])
        await asyncio.sleep(0.1)  # 短暂延迟，让前端看到进度变化
        
        # ============================================
        # Step 1: 启动 S3 上传 (后台并行)
        # ============================================
        # 🚀 优化：不阻塞转录，后台上传
        async def upload_to_s3_async():
            if audio_url:
                return audio_url
            s3_start = time.perf_counter()
            result = await asyncio.to_thread(
                s3_service.upload_audio,
                file_content=audio_content,
                file_name=audio_filename,
                content_type=audio_content_type
            )
            _log_timing("S3 上传完成", s3_start, task_id)
            return result
        
        # 启动上传任务
        s3_upload_task = asyncio.create_task(upload_to_s3_async())

        # ✅ Demo优化：移除无用的音频情绪分析（已改用文本情绪分析）
        
        
        # ============================================
        # Step 2 & 4: 并行处理 (18% → 70%) ← Demo优化
        # ============================================
        update_task_progress(task_id, "processing", 18, 2, "并行处理", "正在同时处理语音和内容...", user_id=user['user_id'])  # Demo优化：18%
        
        # 预先下载并编码图片（如果存在）
        # 🚀 优化：不再下载和分析图片，避免 AI 被图片内容误导（如生成日文标题）
        # encoded_images = []
        # if image_urls and len(image_urls) > 0:
        #     update_task_progress(task_id, "processing", 28, 2, "图片处理", "正在预处理图片...")
        #     download_tasks = [openai_service._download_and_encode_image(url) for url in image_urls]
        #     img_results = await asyncio.gather(*download_tasks, return_exceptions=True)
        #     for i, img_data in enumerate(img_results):
        #         if not isinstance(img_data, Exception):
        #             encoded_images.append(img_data)
        # 获取用户名字
        user_display_name = get_display_name(user, request)

        # 检测语言
        user_language = get_user_language(request)
        
        print(f"🌐 检测到用户语言: {user_language}")

        # 🚀 优化并行逻辑：转录任务独占 30% -> 50% 进度
        async def do_transcription():
            update_task_progress(task_id, "processing", 20, 2, "语音识别", "正在倾听你的故事...", user_id=user['user_id'])  # Demo优化：20%
            
            # ============================================
            # ✅ 2026-01-27 优化: 虚拟进度循环（行业最佳实践）
            # - 每5%持久化一次，确保前端能看到进度
            # - 两阶段速度：快速启动 + 平稳等待
            # ============================================
            async def smooth_progress():
                current_p = 20
                last_persisted = 20
                
                # Phase 1: 快速增长 (20% → 42%)
                while current_p < 42:
                    await asyncio.sleep(0.3)
                    current_p += 1
                    should_persist = (current_p - last_persisted) >= 5
                    if should_persist:
                        last_persisted = current_p
                    update_task_progress(task_id, "processing", current_p, 2, "语音识别", "正在将语音转为文字...", user_id=user['user_id'], persist=should_persist)
                
                # Phase 2: 缓慢增长 (42% → 55%)
                while current_p < 55:
                    await asyncio.sleep(0.8)
                    current_p += 1
                    should_persist = (current_p - last_persisted) >= 5
                    if should_persist:
                        last_persisted = current_p
                    update_task_progress(task_id, "processing", current_p, 2, "语音识别", "语音识别中，请稍候...", user_id=user['user_id'], persist=should_persist)
            
            progress_task = asyncio.create_task(smooth_progress())
            try:
                transcribe_start = time.perf_counter()
                transcription_result = await openai_service.transcribe_audio(
                    audio_content,
                    audio_filename,
                    expected_duration=duration
                )
                _log_timing("Whisper 转录完成(含重试)", transcribe_start, task_id)
                # 🔥 提取转录文本和检测到的语言
                text = transcription_result["text"]
                detected_lang = transcription_result.get("detected_language")
                print(f"🌍 Whisper 检测到的语言: {detected_lang}")
                return {"text": text, "detected_language": detected_lang}
            finally:
                progress_task.cancel()
                update_task_progress(task_id, "processing", 58, 2, "语音识别", "识别完成", user_id=user['user_id'])
        
        # 立即启动转录任务
        transcription_task = asyncio.create_task(do_transcription())

        # 🚀 专家小组重构：实现三路彻底并行 (润色 | 情绪 | 反馈)
        async def task_polish():
            """任务 A: 润色 & 标题"""
            trans_data = await transcription_task
            text = trans_data["text"]
            lang = "English" if trans_data.get("detected_language") in ["en", "en-US"] else ("Chinese" if user_lang == "zh" else user_lang)
            
            update_task_progress(task_id, "processing", 55, 3, "文字美化", "正在打磨每一个措辞...", user_id=user['user_id'])
            
            combined = text
            if content and content.strip():
                combined = f"{content.strip()}\n{text}"
            
            polish_start = time.perf_counter()
            res = await openai_service._call_gpt4o_for_polish_and_title(combined, lang, None)
            _log_timing("AI 润色+标题完成", polish_start, task_id)
            update_task_progress(task_id, "processing", 75, 3, "文字美化", "文字美化已完成", user_id=user['user_id'])
            return res

        async def task_emotion():
            """任务 B: 独立的情绪分析"""
            trans_data = await transcription_task
            text = trans_data["text"]
            lang = "English" if trans_data.get("detected_language") in ["en", "en-US"] else ("Chinese" if user_lang == "zh" else user_lang)
            
            update_task_progress(task_id, "processing", 58, 3, "情绪感应", "正在用心倾听你的心情...", user_id=user['user_id'])
            
            combined = text
            if content and content.strip():
                combined = f"{content.strip()}\n{text}"
            
            emotion_start = time.perf_counter()
            res = await openai_service.analyze_emotion_only(combined, lang, None)
            _log_timing("情绪分析完成", emotion_start, task_id)
            update_task_progress(task_id, "processing", 78, 3, "情绪感应", "情绪感应已完成", user_id=user['user_id'])
            return res

        async def task_feedback():
            """任务 C: 独立的反馈生成"""
            trans_data = await transcription_task
            text = trans_data["text"]
            lang = "English" if trans_data.get("detected_language") in ["en", "en-US"] else ("Chinese" if user_lang == "zh" else user_lang)
            
            update_task_progress(task_id, "processing", 60, 3, "生成回应", "正在为你准备温暖的话语...", user_id=user['user_id'])
            
            combined = text
            if content and content.strip():
                combined = f"{content.strip()}\n{text}"
            
            feedback_start = time.perf_counter()
            res = await openai_service._call_gpt4o_for_feedback(combined, lang, user_display_name, None)
            _log_timing("AI 反馈完成", feedback_start, task_id)
            update_task_progress(task_id, "processing", 80, 4, "生成回应", "温暖回应已准备就绪", user_id=user['user_id'])
            return res

        # 🔥 🔥 🔥 三路 Agent 同时开工！
        # 即使其中一个 Agent 出现非致命错误，也不应阻塞主日记对象的创建
        print(f"🚀 [Task:{task_id}] 启动高度并发 Agent 编排 (Polish & Emotion & Feedback)...")
        tasks = [task_polish(), task_emotion(), task_feedback()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 结果解构与错误兜底
        polish_result = results[0] if not isinstance(results[0], Exception) else {"title": "我的日记", "polished_content": (await transcription_task)["text"]}
        emotion_result = results[1] if not isinstance(results[1], Exception) else {"emotion": "Thoughtful", "confidence": 0.5, "rationale": "未能识别"}
        feedback_data = results[2] if not isinstance(results[2], Exception) else "感谢分享你的故事。"

        # 提取结果供后续使用
        trans_info = await transcription_task
        transcription_final = trans_info["text"]
        detected_language = trans_info.get("detected_language")
        
        # 提取反馈内容
        if isinstance(feedback_data, dict):
            feedback_text = feedback_data.get("reply", "")
        else:
            feedback_text = feedback_data
        
        # ✅ 使用专门Emotion Agent的结果
        emotion_data = {
            "emotion": emotion_result.get("emotion", "Thoughtful"),
            "confidence": emotion_result.get("confidence", 0.0),
            "rationale": emotion_result.get("rationale", ""),
            "source": "text_only",
            "meta": {
                "text": emotion_result
            }
        }
        
        ai_result = {
            "title": polish_result['title'],
            "polished_content": polish_result['polished_content'],
            "feedback": feedback_text,
            "emotion_data": emotion_data,
            "transcription": transcription_final, # ✅ 使用最终的转录内容
            "detected_language": detected_language
        }
        
        update_task_progress(task_id, "processing", 82, 3, "AI处理", "全部处理完成", user_id=user['user_id'])
        
        update_task_progress(task_id, "processing", 88, 4, "整理内容", "正在为你整理日记...", user_id=user['user_id'])
        await asyncio.sleep(0.1)
        update_task_progress(task_id, "processing", 92, 5, "保存数据", "正在保存到数据库...", user_id=user['user_id'])
        await asyncio.sleep(0.2)
        
        # ✅ 专家优化：合并并验证图片URL
        print(f"🔍 [Task:{task_id}] 开始汇总图片. 初始参数图片: {len(image_urls) if image_urls else 0}")
        final_image_urls = image_urls if image_urls is not None else []
        
        # ✅ 关键修复：从任务进度中获取最新图片URL（考虑并行补充的情况）
        task_data_from_db = db_service.get_task_progress(task_id, user_id=user['user_id'])
        if task_data_from_db:
            # 兼容多种可能的键名
            db_urls = task_data_from_db.get("image_urls")
            if db_urls is None:
                db_urls = task_data_from_db.get("imageUrls")
            
            if db_urls is not None:
                # 只要数据库里有（哪怕是空列表），就以数据库为准，因为那是最新的状态
                final_image_urls = db_urls
                print(f"✅ [Task:{task_id}] 从任务数据中同步图片URL，共 {len(final_image_urls)} 张")
            
            # 如果目前还是没图片，但标记了等待上传，则进入等待逻辑
            if not final_image_urls and task_data_from_db.get("pending_image_upload"):
                print(f"⏳ [Task:{task_id}] 检测到 pending_image_upload=True，开始等待图片上传...")
                update_task_progress(task_id, "processing", 93, 5, "等待图片", "正在等待图片上传...", user_id=user['user_id'])
                # 等待最多30秒
                max_wait_time = 30
                wait_interval = 0.5
                progress_update_interval = 1
                waited_time = 0
                last_progress_update = 0
                while waited_time < max_wait_time:
                    # 重新获取任务数据
                    task_data_from_db = db_service.get_task_progress(task_id, user_id=user['user_id'])
                    if task_data_from_db:
                        db_urls = task_data_from_db.get("image_urls")
                        if db_urls is None:
                            db_urls = task_data_from_db.get("imageUrls")
                            
                        if db_urls is not None:
                            final_image_urls = db_urls
                            print(f"✅ [Task:{task_id}] 图片异步补充完成: {len(final_image_urls)} 张")
                            break
                        
                        if not task_data_from_db.get("pending_image_upload"):
                            print(f"✅ [Task:{task_id}] 标记位已重置(False)，停止等待")
                            break
                    
                    # ✅ 定期更新进度，避免用户感觉卡住（93% -> 94% -> 95%）
                    if waited_time - last_progress_update >= progress_update_interval:
                        progress_value = min(93 + int((waited_time / max_wait_time) * 4), 97)
                        update_task_progress(
                            task_id,
                            "processing",
                            progress_value,
                            5,
                            "等待图片",
                            f"正在等待图片上传... ({int(waited_time)}秒)",
                            user_id=user['user_id']
                        )
                        last_progress_update = waited_time
                    
                    await asyncio.sleep(wait_interval)
                    waited_time += wait_interval
                
                if not final_image_urls:
                    print("⚠️ 图片上传超时，继续保存（无图片）")
        
        # ✅ 确保 final_image_urls 是列表而不是 None
        if final_image_urls is None:
            final_image_urls = []
        
        print(f"📸 保存日记，图片数量: {len(final_image_urls)}, URLs: {final_image_urls}")
        
        # 保存到数据库
        db_start = time.perf_counter()
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=transcription_final,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("detected_language", "zh"),
            title=ai_result["title"],
            audio_url=await s3_upload_task,  # ✅ 等待上传完成
            audio_duration=duration,
            image_urls=final_image_urls,  # ✅ 使用最终图片URL（确保是列表）
            emotion_data=ai_result["emotion_data"] # ✅ 传递情绪数据
        )
        _log_timing("DynamoDB 写入完成", db_start, task_id)
        
        # 更新进度：完成（分两步，让进度更平滑）
        update_task_progress(task_id, "processing", 96, 5, "保存数据", "数据保存中...", user_id=user['user_id'])
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 98, 5, "完成", "数据保存成功", user_id=user['user_id'])
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "completed", 100, 5, "完成", "日记创建成功", diary=diary_obj, user_id=user['user_id'])
        _log_timing("混合流程全流程完成", total_start, task_id)
        
    except HTTPException as e:
        update_task_progress(task_id, "failed", 0, 0, "错误", str(e.detail), error=str(e.detail), user_id=user['user_id'])
    except Exception as e:
        print(f"❌ 异步处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        update_task_progress(task_id, "failed", 0, 0, "错误", f"处理失败: {str(e)}", error=str(e), user_id=user['user_id'])


async def process_pure_voice_diary_with_url_async(
    task_id: str,
    audio_url: str,
    duration: int,
    user: Dict,
    request: Optional[Request]
):
    """优化版纯语音日记处理函数 - 使用已上传URL"""
    try:
        # 下载音频内容用于转录（优先S3内网下载）
        download_start = time.perf_counter()
        print(f"📥 [Task:{task_id}] 正在获取音频内容: {audio_url}", flush=True)
        try:
            audio_content = await asyncio.to_thread(
                s3_service.download_object_by_url,
                audio_url
            )
            _log_timing("下载音频完成(纯语音URL,S3内网)", download_start, task_id)
        except Exception as e:
            print(f"⚠️ [Task:{task_id}] S3内网下载失败，降级公网URL: {type(e).__name__}: {e}")
            import httpx
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(audio_url)
                response.raise_for_status()
                audio_content = response.content
            _log_timing("下载音频完成(纯语音URL,公网)", download_start, task_id)
        
        # 调用核心处理函数
        await process_pure_voice_diary_async(
            task_id=task_id,
            audio_content=audio_content,
            audio_filename="recording.m4a",
            audio_content_type="audio/m4a",
            duration=duration,
            user=user,
            request=request,
            audio_url=audio_url
        )
    except Exception as e:
        print(f"❌ 获取已上传音频失败: {str(e)}")
        update_task_progress(task_id, "failed", 0, 0, "错误", f"下载音频失败: {str(e)}", error=str(e), user_id=user['user_id'])


async def process_voice_diary_with_url_async(
    task_id: str,
    audio_url: str,
    duration: int,
    user: Dict,
    request: Optional[Request],
    image_urls: Optional[List[str]] = None,
    content: Optional[str] = None
):
    """优化版混合媒体处理函数 - 使用已上传URL"""
    try:
        update_task_progress(task_id, "processing", 18, 1, "下载资源", "正在获取音频...", user_id=user["user_id"])
        download_start = time.perf_counter()
        print(f"📥 [Task:{task_id}] 正在下载音频: {audio_url}", flush=True)
        try:
            audio_content = await asyncio.to_thread(
                s3_service.download_object_by_url,
                audio_url
            )
            _log_timing("下载音频完成(混合URL,S3内网)", download_start, task_id)
        except Exception as e:
            print(f"⚠️ [Task:{task_id}] S3内网下载失败，降级公网URL: {type(e).__name__}: {e}")
            import httpx
            timeout = httpx.Timeout(30.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(audio_url)
                response.raise_for_status()
                audio_content = response.content
            _log_timing("下载音频完成(混合URL,公网)", download_start, task_id)
        await process_voice_diary_async(
            task_id=task_id, audio_content=audio_content, audio_filename="recording.m4a",
            audio_content_type="audio/m4a", duration=duration, user=user,
            request=request, image_urls=image_urls, content=content, audio_url=audio_url
        )
    except Exception as e:
        print(f"❌ [Task:{task_id}] 后台任务异常: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        update_task_progress(task_id, "failed", 0, 0, "错误", f"处理任务失败: {str(e)}", error=str(e), user_id=user["user_id"])
@router.post("/voice/stream", summary="创建语音日记（实时进度版）")
async def create_voice_diary_stream(
    audio: UploadFile = File(...),
    duration: int = Form(...),
    user: Dict = Depends(get_current_user),
    request: Request = None  # FastAPI 会自动注入 Request 对象（与旧端点保持一致）
):
    """
    创建语音日记 - 支持实时进度推送（SSE）
    
    📚 学习点：这个函数返回的是流式响应（StreamingResponse）
    - 不像普通API那样一次性返回结果
    - 而是像水管一样，持续推送数据
    - 前端可以用EventSource接收这些数据
    
    流程：
    1. 验证音频质量
    2. 推送进度：上传S3 (20%)
    3. 推送进度：语音转文字 (50%)
    4. 推送进度：AI润色 (70%)
    5. 推送进度：生成标题 (85%)
    6. 推送进度：生成反馈 (95%)
    7. 推送最终结果 (100%)
    """
    
    # 🔥 关键修复：在生成器外部先读取文件内容
    # 原因：在流式响应中，一旦生成器开始yield，请求体就会被关闭
    # 所以必须在生成器外部先读取所有数据
    try:
        # 验证文件类型
        if not audio.content_type.startswith("audio/"):
            async def error_stream() -> AsyncGenerator[str, None]:
                error_data = {"error": "请上传音频文件"}
                yield await send_sse_event("error", error_data)
            
            return StreamingResponse(
                error_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            )
        
        # 读取音频内容（必须在生成器外部）
        audio_content = await audio.read()
        audio_filename = audio.filename or "recording.m4a"
        audio_content_type = audio.content_type or "audio/m4a"
        
        # 验证音频质量
        user_lang = get_user_language(request)
        validate_audio_quality(duration, len(audio_content), language=user_lang)
        
    except HTTPException as e:
        # 验证失败，返回错误流
        async def error_stream() -> AsyncGenerator[str, None]:
            error_data = {"error": str(e.detail), "status_code": e.status_code}
            yield await send_sse_event("error", error_data)
        
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except Exception as e:
        # 其他错误
        async def error_stream() -> AsyncGenerator[str, None]:
            error_data = {"error": f"读取音频文件失败: {str(e)}", "status_code": 500}
            yield await send_sse_event("error", error_data)
        
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    async def process_and_stream() -> AsyncGenerator[str, None]:
        """异步生成器：处理语音并推送进度"""
        try:
            openai_service = get_openai_service()
            
            # ============================================
            # Step 1: 开始处理（音频内容已在外部读取）
            # ============================================
            yield await send_sse_event("progress", {
                "step": 0,
                "step_name": "开始处理",
                "progress": 0,
                "message": "正在验证音频..."
            })
            
            # ============================================
            # Step 2 & 3: 并行处理 (上传S3 + 语音转文字)
            # ============================================
            yield await send_sse_event("progress", {
                "step": 1,
                "step_name": "处理中",
                "progress": 20,
                "message": "正在上传音频并识别内容..."
            })
            
            async def upload_to_s3_async():
                return await asyncio.to_thread(
                    s3_service.upload_audio,
                    file_content=audio_content,
                    file_name=audio_filename,
                    content_type=audio_content_type
                )
            
            async def transcribe_async():
                return await openai_service.transcribe_audio(
                    audio_content,
                    audio_filename,
                    expected_duration=duration
                )

            # 并行执行
            audio_url, transcription = await asyncio.gather(
                upload_to_s3_async(),
                transcribe_async()
            )
            
            yield await send_sse_event("progress", {
                "step": 2,
                "step_name": "语音转文字",
                "progress": 50,
                "message": "语音识别完成"
            })
            
            # ============================================
            # Step 4: 验证转录内容
            # ============================================
            validate_transcription(transcription, duration)
            
            # ============================================
            # Step 5: AI处理 - 润色 (70%)
            # ============================================
            yield await send_sse_event("progress", {
                "step": 3,
                "step_name": "AI润色",
                "progress": 55,
                "message": "正在美化文字..."
            })
            
            # 获取用户名字
            user_display_name = get_display_name(user, request)
            
            ai_result = await openai_service.polish_content_multilingual(
                transcription, 
                user_name=user_display_name
            )
            
            yield await send_sse_event("progress", {
                "step": 3,
                "step_name": "AI润色",
                "progress": 70,
                "message": "文字润色完成"
            })
            
            # ============================================
            # Step 6: 生成标题和反馈 (85% -> 95%)
            # ============================================
            yield await send_sse_event("progress", {
                "step": 4,
                "step_name": "生成标题",
                "progress": 85,
                "message": "正在生成标题..."
            })
            
            yield await send_sse_event("progress", {
                "step": 5,
                "step_name": "生成反馈",
                "progress": 95,
                "message": "正在生成AI反馈..."
            })
            
            # ============================================
            # Step 7: 保存到数据库
            # ============================================
            diary_obj = db_service.create_diary(
                user_id=user['user_id'],
                original_content=transcription,
                polished_content=ai_result["polished_content"],
                ai_feedback=ai_result["feedback"],
                language=ai_result.get("language", "zh"),
                title=ai_result["title"],
                audio_url=audio_url,
                audio_duration=duration,
                emotion_data=ai_result.get("emotion_data") # ✅ 传递情感数据
            )
            
            # ============================================
            # Step 8: 推送最终结果
            # ============================================
            yield await send_sse_event("progress", {
                "step": 5,
                "step_name": "完成",
                "progress": 100,
                "message": "处理完成"
            })
            
            # 推送最终结果
            yield await send_sse_event("complete", {
                "diary": diary_obj,
                "progress": 100
            })
            
        except HTTPException as e:
            # HTTP异常（如验证失败）
            error_data = {
                "error": e.detail,
                "status_code": e.status_code
            }
            yield await send_sse_event("error", error_data)
        except Exception as e:
            # 其他异常
            print(f"❌ 流式处理失败: {str(e)}")
            import traceback
            traceback.print_exc()
            error_data = {
                "error": f"处理语音失败: {str(e)}",
                "status_code": 500
            }
            yield await send_sse_event("error", error_data)
    
    # 返回流式响应
    return StreamingResponse(
        process_and_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用nginx缓冲
        }
    )


@router.post("/voice/async", summary="创建语音日记（异步任务版，支持图片+语音）")
async def create_voice_diary_async(
    audio: UploadFile = File(...),
    duration: int = Form(...),
    image_urls: Optional[str] = Form(None),  # ✅ 新增：图片URL列表（JSON字符串）
    content: Optional[str] = Form(None),  # ✅ 新增：用户手动输入的文字内容
    expect_images: bool = Form(False),  # ✅ 是否后续补充图片URL（并行上传场景）
    user: Dict = Depends(get_current_user),
    request: Request = None
):
    """
    创建语音日记 - 异步任务模式（支持轮询查询进度）
    
    📚 学习点：这是专业的任务队列模式
    - 立即返回task_id，不阻塞请求
    - 后台异步处理，前端可以轮询查询进度
    - 跨平台兼容，所有平台都支持HTTP轮询
    
    流程：
    1. 验证并读取音频文件
    2. 创建任务ID
    3. 启动后台异步处理
    4. 立即返回task_id
    5. 前端定期查询 /voice/progress/{task_id} 获取进度
    """
    try:
        # 验证文件类型
        if not audio.content_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail="请上传音频文件")
        
        # 读取音频内容
        audio_content = await audio.read()
        audio_filename = audio.filename or "recording.m4a"
        audio_content_type = audio.content_type or "audio/m4a"
        
        # 验证音频质量
        user_lang = get_user_language(request)
        validate_audio_quality(duration, len(audio_content), language=user_lang)
        
        # ✅ 解析图片URL列表（如果有）
        parsed_image_urls = None
        if image_urls:
            try:
                import json
                parsed_image_urls = json.loads(image_urls)
                if not isinstance(parsed_image_urls, list):
                    parsed_image_urls = None
                print(f"📸 图片+语音模式，图片数量: {len(parsed_image_urls) if parsed_image_urls else 0}")
            except Exception as e:
                print(f"⚠️ 解析图片URL失败: {e}")
                parsed_image_urls = None
        
        # 生成任务ID
        task_id = str(uuid.uuid4())
        
        # ✅ 优化：初始化任务进度时立即设置为5%，避免前端长时间停留在0%
        pending_image_upload = bool(expect_images) and not parsed_image_urls
        # 初始化进度
        task_data = {
            "status": "processing",
            "progress": 5,
            "step": 0,
            "step_name": "初始化",
            "message": "任务已接收，开始处理...",
            "user_id": user['user_id'],
            "image_urls": parsed_image_urls,
            "pending_image_upload": pending_image_upload,
            "created_at": datetime.now(timezone.utc).isoformat(), # 存储为 ISO 格式
            "updated_at": datetime.now(timezone.utc).isoformat(), # 存储为 ISO 格式
            "start_time": time.time(),
            "user_name": get_display_name(user, request) # 保存用户名到任务中
        }
        db_service.save_task_progress(task_id, task_data, user_id=user['user_id'])
        # 同时更新内存缓存
        task_progress[task_id] = task_data
        
        # 启动后台异步任务（根据是否有图片选择处理函数）
        has_images = parsed_image_urls and len(parsed_image_urls) > 0
        has_text_content = content and content.strip()
        pending_images = task_data.get("pending_image_upload", False)  # ✅ 检查是否等待图片上传
        
        # ✅ 关键修复：如果有图片、文字内容，或者正在等待图片上传，都使用完整处理流程
        if has_images or has_text_content or pending_images:
            # 混合媒体模式：使用完整处理流程（支持等待图片上传）
            print(f"📸 混合媒体模式 - 图片: {len(parsed_image_urls) if parsed_image_urls else 0}, 文字: {bool(has_text_content)}, 等待图片: {pending_images}")
            asyncio.create_task(
                process_voice_diary_async(
                    task_id=task_id,
                    audio_content=audio_content,
                    audio_filename=audio_filename,
                    audio_content_type=audio_content_type,
                    duration=duration,
                    user=user,
                    request=request,
                    image_urls=parsed_image_urls,  # 可能为 None，后续会通过 add_images_to_task 补充
                    content=content
                )
            )
        else:
            # 纯语音模式：使用快速通道 ⚡
            print(f"🎤 纯语音模式 - 使用快速通道")
            asyncio.create_task(
                process_pure_voice_diary_async(
                    task_id=task_id,
                    audio_content=audio_content,
                    audio_filename=audio_filename,
                    audio_content_type=audio_content_type,
                    duration=duration,
                    user=user,
                    request=request
                )
            )
        
        print(f"✅ 任务已创建: {task_id}")
        
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "任务已创建，请使用task_id查询进度"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 创建任务失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.post("/voice/async-with-url", summary="✅ 创建语音日记(优化版 - 使用已上传的音频URL)")
async def create_voice_diary_async_with_url(
    audio_url: str = Form(...),  # ✅ 接收已上传到S3的音频URL
    duration: int = Form(...),
    image_urls: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    expect_images: bool = Form(False),
    user: Dict = Depends(get_current_user),
    request: Request = None
):
    """
    ✅ 优化版: 创建语音日记 - 使用已上传的音频URL
    📚 学习点: 这是优化后的工作流程
    
    传统流程 (慢):
    1. 前端上传音频到Lambda (FormData, 可能很慢)
    2. Lambda接收音频
    3. Lambda上传音频到S3
    4. Lambda处理AI任务
    
    优化流程 (快):
    1. 前端获取预签名URL (几十ms)
    2. 前端直接上传音频到S3 (快速, 有进度)
    3. 前端调用此API (只传URL, 不传文件)
    4. Lambda处理AI任务 (不需要处理音频上传)
    
    速度提升: 50-70%
    
    Args:
        audio_url: 已上传到S3的音频URL
        duration: 音频时长(秒)
        image_urls: 图片URL列表(JSON字符串, 可选)
        content: 用户手动输入的文字内容(可选)
        expect_images: 是否后续补充图片URL
        user: 当前认证用户
        request: FastAPI请求对象
    
    Returns:
        {
            "task_id": "xxx",
            "status": "processing",
            "message": "任务已创建,请使用task_id查询进度"
        }
    """
    try:
        # 验证audio_url
        print("🚀 [Task] create_voice_diary_async_with_url hit", flush=True)
        if not audio_url or not audio_url.startswith("https://"):
            raise HTTPException(status_code=400, detail="无效的音频URL")
        
        print(f"🎤 优化版语音日记创建 - 使用已上传URL: {audio_url}")
        print(f"   时长: {duration}秒")
        
        # 解析图片URL列表(如果有)
        parsed_image_urls = None
        if image_urls:
            try:
                import json
                parsed_image_urls = json.loads(image_urls)
                if not isinstance(parsed_image_urls, list):
                    parsed_image_urls = None
                print(f"📸 图片+语音模式,图片数量: {len(parsed_image_urls) if parsed_image_urls else 0}")
            except Exception as e:
                print(f"⚠️ 解析图片URL失败: {e}")
                parsed_image_urls = None
        
        # 生成任务ID
        task_id = str(uuid.uuid4())
        
        # 初始化任务进度
        pending_image_upload = bool(expect_images) and not parsed_image_urls
        task_data = {
            "status": "processing",
            "progress": 15,  # ✅ 音频已上传,直接从10%开始
            "step": 1,
            "step_name": "音频已上传",
            "message": "音频上传完成,开始AI处理...",
            "user_id": user['user_id'],
            "image_urls": parsed_image_urls,
            "pending_image_upload": pending_image_upload,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "start_time": time.time(),
            "user_name": get_display_name(user, request),
            "audio_url": audio_url  # ✅ 保存音频URL
        }
        db_service.save_task_progress(task_id, task_data, user_id=user['user_id'])
        task_progress[task_id] = task_data
        
        # 启动后台异步任务
        has_images = parsed_image_urls and len(parsed_image_urls) > 0
        has_text_content = content and content.strip()
        pending_images = task_data.get("pending_image_upload", False)
        
        if has_images or has_text_content or pending_images:
            # 混合媒体模式
            print(f"📸 混合媒体模式 - 图片: {len(parsed_image_urls) if parsed_image_urls else 0}, 文字: {bool(has_text_content)}, 等待图片: {pending_images}")
            asyncio.create_task(
                process_voice_diary_with_url_async(
                    task_id=task_id,
                    audio_url=audio_url,
                    duration=duration,
                    user=user,
                    request=request,
                    image_urls=parsed_image_urls,
                    content=content
                )
            )
        else:
            # 纯语音模式
            print(f"🎤 纯语音模式 - 使用快速通道")
            asyncio.create_task(
                process_pure_voice_diary_with_url_async(
                    task_id=task_id,
                    audio_url=audio_url,
                    duration=duration,
                    user=user,
                    request=request
                )
            )
        
        print(f"✅ 优化版任务已创建: {task_id}")
        
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "任务已创建,请使用task_id查询进度"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 创建优化版任务失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("/voice/progress/{task_id}", summary="查询语音日记处理进度")
async def get_voice_diary_progress(
    task_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    查询语音日记处理进度
    
    📚 学习点：轮询模式
    - 前端定期调用此端点（如每300ms）
    - 返回当前进度、状态和结果
    - 当status为"completed"时，返回完整的diary对象
    
    返回格式：
    {
        "task_id": "xxx",
        "status": "processing" | "completed" | "failed",
        "progress": 0-100,
        "step": 0-5,
        "step_name": "上传音频",
        "message": "正在处理...",
        "diary": {...}  # 仅当status为completed时存在
        "error": "..."  # 仅当status为failed时存在
    }
    
    ✅ 2026-01-27 优化：进度查询策略
    - 优先从内存缓存读取（实时性更好，能看到虚拟进度）
    - 内存缓存没有时再查询 DynamoDB（确保任务完成后也能查到）
    - 这样可以让前端看到 60%→88% 的平滑虚拟进度
    """
    # ✅ 优先从内存缓存读取（实时性更好，能看到虚拟进度更新）
    task_data = task_progress.get(task_id)
    
    # 如果内存缓存中没有，再从 DynamoDB 获取（任务可能已完成并从内存中清理）
    if not task_data:
        task_data = db_service.get_task_progress(task_id, user_id=user['user_id'])
    
    if not task_data:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")
    
    # 检查任务是否属于当前用户（简单验证，生产环境需要更严格的验证）
    # 这里可以添加更严格的用户验证逻辑
    if task_data.get("user_id") != user['user_id']:
        raise HTTPException(status_code=403, detail="无权访问此任务")
    
    return {
        "task_id": task_id,
        "status": task_data.get("status", "processing"),
        "progress": task_data.get("progress", 0),
        "step": task_data.get("step", 0),
        "step_name": task_data.get("step_name", ""),
        "message": task_data.get("message", ""),
        "diary": task_data.get("diary"),
        "error": task_data.get("error")
    }


@router.post("/voice/progress/{task_id}/images", summary="补充图片URL到任务（用于并行优化）")
async def add_images_to_task(
    task_id: str,
    image_urls: List[str] = Body(...),
    user: Dict = Depends(get_current_user)
):
    """
    补充图片URL到正在处理的任务
    
    ✅ 用于优化：图片上传和AI处理并行执行
    - 前端可以先启动AI处理（不传图片URL）
    - 图片上传完成后，调用此API补充图片URL
    - 后端在保存时会使用补充的图片URL
    
    Args:
        task_id: 任务ID
        image_urls: 图片URL列表
        user: 当前用户
    """
    # 1. 优先从 DynamoDB 获取
    task_data = db_service.get_task_progress(task_id, user_id=user['user_id'])
    
    # 2. 如果不存在，检查内存缓存（考虑刚创建还未写入 DB 的极端情况）
    if not task_data:
        task_data = task_progress.get(task_id)
        
    if not task_data:
        print(f"❌ 任务不存在: {task_id}")
        raise HTTPException(status_code=404, detail="任务不存在或已过期")
    
    # 检查任务是否属于当前用户
    if task_data.get("user_id") != user['user_id']:
        raise HTTPException(status_code=403, detail="无权修改此任务")
    
    # ✅ 更新任务进度，添加图片URL（确保是列表）
    task_data["image_urls"] = image_urls if image_urls else []
    task_data["pending_image_upload"] = False
    
    # 保存更新后的任务数据到 DynamoDB
    db_service.save_task_progress(task_id, task_data, user_id=user['user_id'])
    # 同时更新内存缓存
    task_progress[task_id] = task_data
    
    print(f"✅ 任务 {task_id} 已补充图片URL，共 {len(image_urls)} 张")
    print(f"📸 图片URLs: {image_urls}")
    
    return {
        "success": True,
        "message": f"已补充 {len(image_urls)} 张图片",
        "task_id": task_id
    }


@router.post("/audio/presigned-url", summary="✅ 获取音频直传预签名URL (优化上传速度)")
async def get_audio_presigned_url(
    file_name: str = Form("recording.m4a"),
    content_type: str = Form("audio/m4a"),
    user: Dict = Depends(get_current_user)
):
    """
    ✅ 新增: 生成音频文件的预签名URL用于直传S3
    
    📚 学习点: 为什么要用预签名URL直传?
    
    传统方式 (慢):
    手机 → Lambda → S3
    - 音频数据传输2次
    - 受Lambda 6MB限制
    - 无法显示精确进度
    - 5分钟音频可能需要30-60秒
    
    预签名URL直传 (快):
    手机 → S3 (直接)
    - 音频数据只传输1次
    - 不受Lambda限制
    - 可显示精确进度 (1%, 2%, 3%...)
    - 5分钟音频只需10-20秒
    
    速度提升: 50-70%
    
    工作流程:
    1. 前端调用此API获取预签名URL
    2. 前端使用预签名URL直接上传音频到S3
    3. 上传完成后,使用final_url创建语音日记任务
    
    Args:
        file_name: 音频文件名 (默认: recording.m4a)
        content_type: 文件MIME类型 (默认: audio/m4a)
        user: 当前认证用户
    
    Returns:
        {
            "presigned_url": "https://s3.amazonaws.com/...",  # 用于上传
            "s3_key": "audio/abc123-recording.m4a",           # S3键
            "final_url": "https://bucket.s3.amazonaws.com/audio/..." # 最终URL
        }
    """
    try:
        print(f"🎤 生成音频预签名URL: {file_name}, type: {content_type}")
        
        # 验证content_type
        if not content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content type: {content_type}. Must be audio/*"
            )
        
        # 生成预签名URL (1小时过期)
        presigned_data = s3_service.generate_audio_presigned_url(
            file_name=file_name,
            content_type=content_type,
            expiration=3600  # 1小时
        )
        
        print(f"✅ 音频预签名URL生成成功: {presigned_data['s3_key']}")
        
        return presigned_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 生成音频预签名URL失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"生成预签名URL失败: {str(e)}"
        )


# ========================================================================
# ✅ Phase 2: 分块上传 API（边录边传，大幅减少等待时间）
# ========================================================================

@router.post("/audio/chunk-session", summary="创建分块上传会话")
async def create_chunk_session(
    session_id: str = Form(...),
    user: Dict = Depends(get_current_user)
):
    """
    ✅ Phase 2: 创建分块上传会话
    
    边录边传工作流程:
    1. 录音开始时，前端生成 session_id 并调用此 API
    2. 录音过程中，每 N 秒调用 /audio/chunk-presigned-url 获取 chunk 上传 URL
    3. 前端并行上传每个 chunk 到 S3
    4. 录音结束后，调用 /audio/chunk-complete 合并并处理
    
    优势:
    - 录音结束后几乎无需等待上传（大部分已上传完成）
    - 提供更流畅的用户体验
    - 减少 50-70% 的等待时间
    
    Args:
        session_id: 会话唯一标识（前端生成的 UUID）
        user: 当前认证用户
    
    Returns:
        会话信息
    """
    try:
        print(f"📦 创建分块上传会话: session_id={session_id}, user={user['user_id']}")
        
        session_info = s3_service.create_chunk_session(session_id)
        
        return {
            **session_info,
            "user_id": user['user_id']
        }
        
    except Exception as e:
        print(f"❌ 创建分块会话失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CREATE_SESSION_FAILED")


@router.post("/audio/chunk-presigned-url", summary="获取单个 chunk 的预签名 URL")
async def get_chunk_presigned_url(
    session_id: str = Form(...),
    chunk_index: int = Form(...),
    content_type: str = Form("audio/m4a"),
    user: Dict = Depends(get_current_user)
):
    """
    ✅ Phase 2: 获取单个 chunk 的预签名 URL
    
    录音过程中定期调用此 API 获取上传 URL。
    
    Args:
        session_id: 会话 ID
        chunk_index: 分块索引（0, 1, 2...）
        content_type: 文件类型
        user: 当前认证用户
    
    Returns:
        预签名 URL 信息
    """
    try:
        print(f"📤 获取 chunk 预签名 URL: session={session_id}, index={chunk_index}")
        
        presigned_data = s3_service.generate_chunk_presigned_url(
            session_id=session_id,
            chunk_index=chunk_index,
            content_type=content_type
        )
        
        return presigned_data
        
    except Exception as e:
        print(f"❌ 获取 chunk 预签名 URL 失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GET_CHUNK_URL_FAILED")


@router.post("/audio/chunk-complete", summary="完成分块上传并创建日记任务")
async def complete_chunk_upload(
    session_id: str = Form(...),
    chunk_count: int = Form(...),
    duration: float = Form(...),
    content: str = Form(None),
    image_urls: str = Form(None),
    expect_images: bool = Form(False),
    user: Dict = Depends(get_current_user),
    request: Request = None,
    x_user_name: Optional[str] = Header(None, alias="X-User-Name")
):
    """
    ✅ Phase 2: 完成分块上传，合并音频并创建日记处理任务
    
    录音结束后调用此 API:
    1. 合并所有已上传的 chunks
    2. 创建语音日记处理任务
    3. 返回 task_id 用于轮询进度
    
    Args:
        session_id: 会话 ID
        chunk_count: 已上传的 chunk 总数
        duration: 音频总时长（秒）
        content: 可选的文字内容
        image_urls: 可选的图片 URL 列表（JSON）
        expect_images: 是否期待后续图片上传
        user: 当前认证用户
        request: FastAPI Request 对象
        x_user_name: 用户名称（通过 Header）
    
    Returns:
        task_id 和状态信息
    """
    try:
        total_start = time.perf_counter()
        print(f"🔀 [ChunkComplete] 开始处理: session={session_id}, chunks={chunk_count}, duration={duration}s")
        print(f"   - user_id: {user.get('user_id')}")
        print(f"   - x_user_name: {x_user_name}")
        print(f"   - content: {content[:50] if content and len(content) > 0 else 'None'}...")
        print(f"   - image_urls: {image_urls}")
        print(f"   - expect_images: {expect_images}")
        
        # Step 1: 合并 chunks
        print(f"📦 [ChunkComplete] Step 1: 合并 chunks...")
        merge_start = time.perf_counter()
        merged_audio_url = s3_service.merge_chunks(
            session_id=session_id,
            chunk_count=chunk_count,
            output_filename="recording.m4a"
        )
        _log_timing("合并 chunks 完成", merge_start)
        print(f"✅ [ChunkComplete] 音频合并完成: {merged_audio_url}")
        
        # Step 2: 创建任务 ID
        task_id = str(uuid.uuid4())
        print(f"📋 [ChunkComplete] Step 2: 创建任务 ID: {task_id}")
        
        # Step 3: 解析 image_urls
        parsed_image_urls = None
        if image_urls:
            try:
                parsed_image_urls = json.loads(image_urls)
                print(f"📸 [ChunkComplete] Step 3: 解析到 {len(parsed_image_urls) if parsed_image_urls else 0} 张图片")
            except Exception as parse_err:
                print(f"⚠️ [ChunkComplete] 解析 image_urls 失败: {parse_err}")
                parsed_image_urls = None
        
        # Step 4: 初始化任务进度
        print(f"📊 [ChunkComplete] Step 4: 初始化任务进度...")
        pending_image_upload = bool(expect_images) and not parsed_image_urls
        task_data = {
            "status": "processing",
            "progress": 15,  # 合并完成，进度 15%
            "step": 1,
            "step_name": "音频已准备",
            "message": "音频已准备就绪，开始处理...",
            "user_id": user['user_id'],
            "image_urls": parsed_image_urls,
            "pending_image_upload": pending_image_upload,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "start_time": time.time(),
            "user_name": x_user_name or get_display_name(user, request),
            "audio_url": merged_audio_url
        }
        db_service.save_task_progress(task_id, task_data, user_id=user['user_id'])
        task_progress[task_id] = task_data
        
        # Step 5: 启动后台处理任务
        # ✅ 关键修复: 根据是否有图片/文字选择正确的处理函数
        has_images = parsed_image_urls and len(parsed_image_urls) > 0
        has_text_content = content and content.strip()
        pending_images = pending_image_upload
        
        print(f"🔍 [ChunkComplete] Step 5: 选择处理函数...")
        print(f"   - has_images: {has_images}")
        print(f"   - has_text_content: {has_text_content}")
        print(f"   - pending_images: {pending_images}")
        
        if has_images or has_text_content or pending_images:
            # 混合媒体模式：使用完整处理流程
            print(f"📸 [ChunkComplete] 使用混合媒体处理流程 (process_voice_diary_with_url_async)")
            asyncio.create_task(
                process_voice_diary_with_url_async(
                    task_id=task_id,
                    audio_url=merged_audio_url,
                    duration=int(duration),
                    user=user,
                    request=request,
                    image_urls=parsed_image_urls,
                    content=content
                )
            )
        else:
            # 纯语音模式：使用快速通道
            print(f"🎤 [ChunkComplete] 使用纯语音快速通道 (process_pure_voice_diary_with_url_async)")
            asyncio.create_task(
                process_pure_voice_diary_with_url_async(
                    task_id=task_id,
                    audio_url=merged_audio_url,
                    duration=int(duration),
                    user=user,
                    request=request
                )
            )
        
        print(f"✅ [ChunkComplete] 分块上传任务创建成功: task_id={task_id}")
        _log_timing("分块合并入口完成", total_start)
        
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "Audio merged, processing started",
            "audio_url": merged_audio_url
        }
        
    except ValueError as e:
        error_str = str(e)
        print(f"❌ [ChunkComplete] ValueError: {error_str}")
        import traceback
        traceback.print_exc()
        if error_str.startswith("TRANSCRIPTION_") or error_str == "No chunks to merge":
            raise HTTPException(status_code=400, detail=error_str)
        raise HTTPException(status_code=500, detail="CHUNK_MERGE_FAILED")
    except Exception as e:
        print(f"❌ [ChunkComplete] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="CHUNK_COMPLETE_FAILED")


@router.post("/images/presigned-urls", summary="Get presigned URLs for direct S3 upload")
async def get_presigned_urls(
    data: PresignedUrlRequest,
    user: Dict = Depends(get_current_user)
):
    """
    Generate presigned URLs for direct image upload to S3
    
    This bypasses Lambda's 6MB payload limit by allowing frontend
    to upload directly to S3.
    
    Flow:
    1. Frontend calls this endpoint with file names
    2. Backend generates presigned URLs
    3. Frontend uploads directly to S3 using presigned URLs
    4. Frontend calls /diary/image-only with final URLs
    
    Args:
        file_names: List of image file names (max 9)
        content_types: Optional list of MIME types (default: image/jpeg)
        user: Current authenticated user
    
    Returns:
        List of presigned URL objects with:
            - presigned_url: URL for direct upload
            - s3_key: S3 object key
            - final_url: Final public URL after upload
    """
    try:
        file_names = data.file_names
        content_types = data.content_types
        
        # Validate number of files
        if len(file_names) > 9:
            raise HTTPException(
                status_code=400,
                detail=f"Too many files. Maximum is 9, you requested {len(file_names)}"
            )
        
        if len(file_names) == 0:
            raise HTTPException(
                status_code=400,
                detail="No file names provided"
            )
        
        # Default content types
        if not content_types:
            content_types = ["image/jpeg"] * len(file_names)
        elif len(content_types) != len(file_names):
            raise HTTPException(
                status_code=400,
                detail="content_types length must match file_names length"
            )
        
        print(f"📸 Generating {len(file_names)} presigned URL(s)...")
        
        presigned_urls = []
        for idx, file_name in enumerate(file_names, 1):
            content_type = content_types[idx - 1] or "image/jpeg"
            
            presigned_data = s3_service.generate_presigned_url(
                file_name=file_name,
                content_type=content_type
            )
            
            presigned_urls.append(presigned_data)
            print(f"  ✅ Generated presigned URL {idx}/{len(file_names)}: {presigned_data['s3_key']}")
        
        print(f"✅ All {len(presigned_urls)} presigned URLs generated")
        
        return {
            "presigned_urls": presigned_urls,
            "count": len(presigned_urls)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to generate presigned URLs: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate presigned URLs: {str(e)}"
        )

@router.post("/images", summary="Upload images for diary")
async def upload_diary_images(
    images: List[UploadFile] = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Upload multiple images for diary entry (max 9 images)
    
    Flow:
    1. Validate image files (max 9 images)
    2. Upload each image to S3
    3. Return list of image URLs
    
    Args:
        images: List of image files (JPEG, PNG, etc.) - max 9 images
        user: Current authenticated user
    
    Returns:
        List of uploaded image URLs
    """
    try:
        # Step 1: Validate number of images
        if len(images) > 9:
            raise HTTPException(
                status_code=400,
                detail=f"Too many images. Maximum is 9 images, you uploaded {len(images)}"
            )
        
        if len(images) == 0:
            raise HTTPException(
                status_code=400,
                detail="No images provided"
            )
        
        print(f"📸 Uploading {len(images)} image(s)...")
        
        uploaded_urls = []
        
        # Step 2: Upload each image
        for idx, image in enumerate(images, 1):
            # Validate image file type
            if not image.content_type or not image.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400,
                    detail=f"File {idx} is not an image: {image.filename}"
                )
            
            # Read image content
            image_content = await image.read()
            
            # Validate image size (max 10MB per image)
            image_size_mb = len(image_content) / (1024 * 1024)
            if image_size_mb > 10:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image {idx} too large ({image_size_mb:.1f}MB). Maximum size is 10MB per image"
                )
            
            print(f"  📤 Uploading image {idx}/{len(images)}: {image.filename}, size: {image_size_mb:.2f}MB")
            
            # Upload to S3
            image_url = s3_service.upload_image(
                file_content=image_content,
                file_name=image.filename or f"photo{idx}.jpg",
                content_type=image.content_type or "image/jpeg"
            )
            
            uploaded_urls.append(image_url)
            print(f"  ✅ Image {idx} uploaded: {image_url}")
        
        print(f"✅ All {len(uploaded_urls)} images uploaded successfully")
        
        # Step 3: Return URLs
        return {
            "image_urls": uploaded_urls,
            "count": len(uploaded_urls)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Image upload failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload images: {str(e)}"
        )

@router.post("/image-only", response_model=DiaryResponse, summary="Create image diary (with optional text)")
async def create_image_only_diary(
    data: ImageOnlyDiaryCreate,
    user: Dict = Depends(get_current_user),
    request: Request = None  # ✅ 添加 Request 参数以获取请求头
):
    """
    Create a diary entry with images (optionally with text)
    
    Flow:
    1. User uploads images via /images endpoint → get image_urls
    2. Call this endpoint with image_urls (and optional content) to create diary entry
    3. If content provided: AI processing (polish, title, feedback)
    4. If no content: minimal diary (images only)
    
    Args:
        image_urls: List of S3 image URLs (from /images endpoint)
        content: Optional text content (if provided, will be processed by AI)
        user: Current authenticated user
    
    Returns:
        Created diary entry with images (and optionally AI-processed text)
    """
    try:
        user_id = user.get('user_id')
        user_name = user.get('name', 'User')
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        image_urls = data.image_urls
        content = data.content  # Optional text content
        
        if not image_urls or len(image_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="No image URLs provided"
            )
        
        print(f"📸 Creating image diary for user {user_id}, images: {len(image_urls)}, has_text: {bool(content)}")
        
        # If content is provided, process it with AI (similar to text diary)
        if content and content.strip():
            openai_service = get_openai_service()
            
            # ✅ 使用统一的用户名字获取逻辑
            user_display_name = get_display_name(user, request)
            print(f"👤 用户信息: user_id={user.get('user_id')}, display_name={user_display_name}")
            
            print(f"✨ Processing text content with AI...")
            # ✅ 暂时去掉 Vision 模型，下个版本再加入
            # 只处理文字内容，不传递图片URL
            ai_result = await openai_service.polish_content_multilingual(
                content, 
                user_name=user_display_name,
                image_urls=None  # ✅ 暂时不传递图片URL，去掉Vision模型
            )
            
            # Create diary with AI-processed content
            diary = db_service.create_diary(
                user_id=user_id,
                original_content=content,
                polished_content=ai_result["polished_content"],
                ai_feedback=ai_result["feedback"],
                language=ai_result.get("language", "zh"),
                title=ai_result["title"],
                audio_url=None,
                image_urls=image_urls,
                emotion_data=ai_result.get("emotion_data") # ✅ 传递情感数据
            )
            
            print(f"✅ Image diary with text created: {diary['diary_id']}")
        else:
            # Pure image diary - no AI processing
            title = ""
            content = ""
            
            diary = db_service.create_diary(
                user_id=user_id,
                original_content=content,
                polished_content=content,
                ai_feedback="",
                language="zh",
                title=title,
                audio_url=None,
                image_urls=image_urls
            )
            
            print(f"✅ Image-only diary created: {diary['diary_id']}")
        
        return diary
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to create image diary: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create diary: {str(e)}"
        )

@router.get("/list", response_model=List[DiaryResponse], summary="获取日记列表")
async def get_diaries(
    user: Dict = Depends(get_current_user)
):
    """
    获取用户的所有日记列表（无数量限制）

    Args:
        user: 当前登录用户
    """
    try:
        print(f"📖 收到获取日记列表请求 - 用户ID: {user.get('user_id')}")
        
        # 检查用户ID是否存在
        user_id = user.get('user_id')
        if not user_id:
            print(f"❌ 用户ID为空")
            raise HTTPException(
                status_code=401,
                detail="用户ID无效"
            )
        
        # 尝试获取所有日记
        diaries = db_service.get_user_diaries(user_id)
        if diaries and len(diaries) > 0:
            print(f"🔍 [DEBUG] 第一条日记情感数据: {diaries[0].get('emotion_data')}")
        print(f"✅ 获取日记列表成功 - 用户: {user_id}, 数量: {len(diaries)}")
        return diaries
        
    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        # 记录详细错误信息
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ 获取日记列表失败:")
        print(f"   错误类型: {type(e).__name__}")
        print(f"   错误信息: {str(e)}")
        print(f"   错误堆栈:\n{error_trace}")
        
        # 根据错误类型返回不同的状态码
        error_message = str(e)
        if "ResourceNotFoundException" in error_message or "Table" in error_message:
            raise HTTPException(
                status_code=500,
                detail="数据库表不存在或配置错误"
            )
        elif "AccessDeniedException" in error_message or "权限" in error_message:
            raise HTTPException(
                status_code=500,
                detail="数据库访问权限不足"
            )
        elif "ValidationException" in error_message:
            raise HTTPException(
                status_code=400,
                detail=f"请求参数错误: {error_message}"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"获取日记列表失败: {error_message}"
            )


@router.get("/{diary_id}", response_model=DiaryResponse, summary="获取日记详情")
async def get_diary_detail(
    diary_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    获取单篇日记的详细信息
    
    Args:
        diary_id: 日记 ID
        user: 当前登录用户
    """
    try:
        diary = db_service.get_diary_by_id(diary_id, user['user_id'])
        
        if not diary:
            raise HTTPException(
                status_code=404,
                detail="日记不存在"
            )
        
        print(f"✅ 获取日记详情成功 - ID: {diary_id}")
        return diary
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 获取日记详情失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取日记详情失败: {str(e)}"
        )


@router.put("/{diary_id}", response_model=DiaryResponse, summary="编辑日记")
async def update_diary(
    diary_id: str,
    diary: DiaryUpdate,
    user: Dict = Depends(get_current_user)
):
    """
    编辑一篇日记
    
    注意：直接保存用户编辑的内容，不再调用 AI 润色
    支持更新图片列表，自动删除S3中被移除的图片
    
    Args:
        diary_id: 日记 ID
        diary: 更新内容（可包含 content, title, image_urls）
        user: 当前登录用户
    """
    try:
        print(f"📝 更新日记请求 - ID: {diary_id}, 用户: {user['user_id']}")
        
        # ✅ 如果更新图片列表，先获取旧的图片URL以便删除S3文件
        if diary.image_urls is not None:
            # 获取当前日记的图片列表
            current_diary = db_service.get_diary_by_id(diary_id, user['user_id'])
            if current_diary:
                old_image_urls = current_diary.get('image_urls', []) or []
                new_image_urls = diary.image_urls or []
                
                # 找出被删除的图片URL
                deleted_urls = set(old_image_urls) - set(new_image_urls)
                
                if deleted_urls:
                    print(f"🗑️ 检测到 {len(deleted_urls)} 张图片被删除，开始从S3删除...")
                    for url in deleted_urls:
                        try:
                            # 从S3删除图片
                            s3_service.delete_image_by_url(url)
                            print(f"  ✅ 已从S3删除: {url}")
                        except Exception as e:
                            print(f"  ⚠️ 删除S3图片失败 ({url}): {str(e)}")
                            # 继续处理，不因为S3删除失败而中断整个更新
        
        # 构建更新字段
        update_fields = {}
        if diary.content is not None:
            update_fields['polished_content'] = diary.content
            print(f"📝 更新内容: {diary.content[:50]}...")
        if diary.title is not None:
            update_fields['title'] = diary.title
            print(f"📝 更新标题: {diary.title}")
        if diary.image_urls is not None:
            update_fields['image_urls'] = diary.image_urls
            print(f"📝 更新图片数量: {len(diary.image_urls)}")
        
        if not update_fields:
            raise ValueError("至少需要提供 content, title 或 image_urls 之一")
        
        # 直接保存用户编辑的内容
        diary_obj = db_service.update_diary(
            diary_id=diary_id,
            user_id=user['user_id'],
            **update_fields
        )
        
        print(f"✅ 日记更新成功 - ID: {diary_obj['diary_id']}")
        return diary_obj
        
    except ValueError as e:
        print(f"❌ 日记不存在: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"日记不存在: {str(e)}"
        )
    except PermissionError as e:
        print(f"❌ 权限不足: {str(e)}")
        raise HTTPException(
            status_code=403,
            detail=f"无权修改此日记: {str(e)}"
        )
    except Exception as e:
        print(f"❌ 更新日记失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"更新日记失败: {str(e)}"
        )



@router.delete("/{diary_id}", summary="删除日记")
async def delete_diary(
    diary_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    删除一篇日记
    
    Args:
        diary_id: 日记 ID
        user: 当前登录用户
    """
    try:
        print(f"🗑️ 删除日记请求 - ID: {diary_id}, 用户: {user['user_id']}")
        
        # Delete diary
        db_service.delete_diary(
            diary_id=diary_id,
            user_id=user['user_id']
        )
        
        # Cascade delete: cleanup all shares of this diary
        circle_service.cleanup_diary_shares(diary_id)
        
        print(f"✅ 日记删除成功 - ID: {diary_id}")
        return {
            "message": "日记删除成功",
            "diary_id": diary_id
        }
        
    except ValueError as e:
        print(f"❌ 删除日记失败（不存在）: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    except Exception as e:
        print(f"❌ 删除日记失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"删除日记失败: {str(e)}"
        )


@router.get("/search", summary="搜索日记")
async def search_diaries(
    q: str = Query(..., min_length=1, max_length=100, description="搜索关键词"),
    current_user: Dict = Depends(get_current_user),
):
    """
    搜索日记
    
    - 支持标题和内容的全文搜索
    - 支持中英文模糊匹配
    - 按创建时间倒序返回结果
    
    Args:
        q: 搜索关键词（1-100个字符）
        current_user: 当前登录用户
    
    Returns:
        {
            "diaries": [...],  # 匹配的日记列表
            "count": 3         # 结果数量
        }
    
    注意：
    生产环境建议使用 ElasticSearch 或 DynamoDB GSI 优化性能
    当前实现使用 scan 会扫描整个表，数据量大时效率较低
    """
    try:
        user_id = current_user["user_id"]
        print(f"🔍 用户 {user_id} 搜索: '{q}'")
        
        # 使用 DynamoDB scan 进行全文搜索
        # 注意：scan 会扫描整个表，对于大数据量效率较低
        # 生产环境建议使用 ElasticSearch 或创建 GSI
        
        response = db_service.diary_table.scan(
            FilterExpression=(
                Attr("user_id").eq(user_id) &
                (
                    Attr("title").contains(q) |
                    Attr("polished_content").contains(q) |
                    Attr("original_content").contains(q)
                )
            )
        )
        
        diaries = response.get("Items", [])
        
        # 按创建时间倒序排序
        diaries.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        print(f"✅ 搜索到 {len(diaries)} 条日记")
        
        return {
            "diaries": diaries,
            "count": len(diaries)
        }
        
    except Exception as e:
        print(f"❌ 搜索日记失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"搜索失败: {str(e)}"
        )


# ============================================================================
# 日记分享 API (Intimate Circle Feature)
# ============================================================================

@router.post("/{diary_id}/share", summary="分享日记到圈子")
async def share_diary(
    diary_id: str,
    circle_id: str = Body(..., embed=True),
    user: Dict = Depends(get_current_user)
):
    """
    Share a diary to a circle
    
    Args:
        diary_id: Diary ID
        circle_id: Target circle ID
        user: Current user
    
    Returns:
        Share record with shareId
    """
    try:
        user_id = user['user_id']
        
        # 1. Check if user is circle member
        if not circle_service.is_circle_member(circle_id, user_id):
            raise HTTPException(
                status_code=403,
                detail="Only circle members can share diaries"
            )
        
        # 2. Check if diary exists and belongs to user
        diary = db_service.get_diary_by_id(diary_id)
        if not diary:
            raise HTTPException(status_code=404, detail="Diary not found")
        
        if diary.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only share your own diaries"
            )
        
        # 3. Check if already shared (prevent duplicates)
        if circle_service.is_diary_shared_to_circle(diary_id, circle_id):
            raise HTTPException(
                status_code=400,
                detail="Diary already shared to this circle"
            )
        
        # 4. Share diary (with denormalized fields for performance)
        share_record = circle_service.share_diary_to_circle(
            diary_id=diary_id,
            circle_id=circle_id,
            user_id=user_id,
            diary_data=diary
        )
        
        return {
            "message": "Diary shared successfully",
            "share": share_record
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to share diary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to share diary: {str(e)}"
        )


@router.delete("/{diary_id}/share/{circle_id}", summary="取消分享日记")
async def unshare_diary(
    diary_id: str,
    circle_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Unshare a diary from a circle
    
    Args:
        diary_id: Diary ID
        circle_id: Circle ID
        user: Current user
    """
    try:
        user_id = user['user_id']
        
        # 1. Verify diary ownership
        diary = db_service.get_diary_by_id(diary_id)
        if not diary:
            raise HTTPException(status_code=404, detail="Diary not found")
        
        if diary.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only unshare your own diaries"
            )
        
        # 2. Unshare
        circle_service.unshare_diary_from_circle(diary_id, circle_id)
        
        return {
            "message": "Diary unshared successfully",
            "diary_id": diary_id,
            "circle_id": circle_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to unshare diary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to unshare diary: {str(e)}"
        )


@router.get("/{diary_id}/shares", summary="查询日记分享状态")
async def get_diary_shares(
    diary_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Get diary share status (which circles it's shared to)
    
    Args:
        diary_id: Diary ID
        user: Current user
    
    Returns:
        List of circles the diary is shared to
    """
    try:
        user_id = user['user_id']
        
        # 1. Verify diary ownership
        diary = db_service.get_diary_by_id(diary_id)
        if not diary:
            raise HTTPException(status_code=404, detail="Diary not found")
        
        if diary.get('user_id') != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only view share status of your own diaries"
            )
        
        # 2. Get share records
        shares = circle_service.get_diary_shares(diary_id)
        
        # 3. Extract circle info
        circles = []
        for share in shares:
            circles.append({
                "circle_id": share.get('circleId'),
                "shared_at": share.get('sharedAt'),
                "share_id": share.get('shareId')
            })
        
        return {
            "diary_id": diary_id,
            "shared_to_circles": circles,
            "count": len(circles)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to get diary shares: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get diary shares: {str(e)}"
        )
