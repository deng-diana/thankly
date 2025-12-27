"""
日记路由 - 优化版本
主要改进：
1. ✅ 修复 async/await 调用问题
2. ✅ 优化代码结构和可读性
3. ✅ 增强错误处理
4. ✅ 保持所有原有逻辑不变
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, Request
from fastapi.responses import StreamingResponse
from typing import List, Dict, Optional, AsyncGenerator
import asyncio
import re
import json
import uuid
from datetime import datetime, timezone

from ..models.diary import DiaryCreate, DiaryResponse, DiaryUpdate, ImageOnlyDiaryCreate, PresignedUrlRequest
from ..services.openai_service import OpenAIService
from ..services.dynamodb_service import DynamoDBService
from ..services.s3_service import S3Service
from ..utils.cognito_auth import get_current_user

# ============================================================================
# 初始化
# ============================================================================

router = APIRouter()
db_service = DynamoDBService()
s3_service = S3Service()

# ============================================================================
# 任务进度存储（内存存储，生产环境建议使用Redis）
# ============================================================================

# 任务进度字典：{task_id: {status, progress, step, step_name, message, diary, error}}
task_progress: Dict[str, Dict] = {}

def cleanup_old_tasks():
    """清理超过1小时的任务（防止内存泄漏）"""
    current_time = datetime.now(timezone.utc)
    expired_tasks = []
    for task_id, task_data in task_progress.items():
        if task_data.get("status") in ["completed", "failed"]:
            created_at = task_data.get("created_at")
            if created_at:
                age = (current_time - created_at).total_seconds()
                if age > 3600:  # 1小时
                    expired_tasks.append(task_id)
    for task_id in expired_tasks:
        task_progress.pop(task_id, None)


def get_openai_service():
    """获取 OpenAI 服务实例（延迟初始化）"""
    return OpenAIService()


# ============================================================================
# 辅助函数
# ============================================================================

def validate_audio_quality(duration: int, audio_size: int) -> None:
    """
    验证音频质量
    
    Args:
        duration: 音频时长（秒）
        audio_size: 音频文件大小（字节）
    
    Raises:
        HTTPException: 音频质量不合格时抛出
    """
    print(f"🔍 开始音频质量验证 - 时长: {duration}秒, 大小: {audio_size} bytes")
    
    # 检查时长
    if duration < 5:
        raise HTTPException(
            status_code=400,
            detail="录音时间太短，请至少录制5秒以上的内容。建议说一个完整的句子。"
        )
    
    if duration > 600:  # 10分钟
        raise HTTPException(
            status_code=400,
            detail="录音时间过长，请控制在10分钟以内"
        )
    
    # 检查文件大小
    if audio_size < 1000:  # 小于1KB
        raise HTTPException(
            status_code=400,
            detail="音频文件太小，可能没有录制到有效内容"
        )
    
    print(f"✅ 音频质量验证通过")


def normalize_transcription(text: str) -> str:
    """
    标准化转录文本：去除空白和标点符号
    
    与前端 normalize 函数逻辑保持一致
    
    Args:
        text: 原始转录文本
    
    Returns:
        标准化后的文本
    """
    if not text:
        return ""
    
    # 去除空白字符（空格、换行、制表符）
    normalized = re.sub(r'[\s\n\r\t]+', '', text)
    
    # 去除标点符号（中英文标点、引号、省略号等）
    # 使用原始字符串，转义引号
    normalized = re.sub(r"[.,!?;:，。！？；：\"''\"'\-_/\\…]+", '', normalized)
    
    return normalized


def validate_transcription(transcription: str, duration: Optional[int] = None) -> None:
    """
    验证转录内容的有效性
    
    使用 normalize 逻辑：去除空白和标点后判断长度是否<3
    
    Args:
        transcription: 转录文本
    
    Raises:
        HTTPException: 转录内容无效时抛出，错误码为 EMPTY_TRANSCRIPT
    """
    print(f"🔍 开始转录结果验证...")
    print(f"🔍 原始转录结果: '{transcription}'")
    
    # 标准化文本（去除空白和标点）
    normalized = normalize_transcription(transcription)
    print(f"🔍 标准化后转录结果: '{normalized}' (长度: {len(normalized)})")
    
    # ✅ 核心检查：标准化后长度 < 3 视为空内容
    if len(normalized) < 3:
        print(f"❌ 转录内容为空或无效（标准化后长度: {len(normalized)}）")
        raise HTTPException(
            status_code=400,
            detail=json.dumps({
                "code": "EMPTY_TRANSCRIPT",
                "message": "No valid speech detected."
            })
        )
    
    if duration is not None and duration >= 6:
        seconds = max(duration, 1)
        char_per_second = len(normalized) / seconds
        word_matches = re.findall(r"[A-Za-z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+", transcription)
        filler_tokens = {"um", "uh", "uhh", "hmm", "erm", "ah", "oh", "mmm"}
        meaningful_words = [
            word
            for word in word_matches
            if len(word) >= 2 and word.lower() not in filler_tokens
        ]
        print(
            "🔍 语音密度检查:",
            {
                "duration": duration,
                "char_per_second": char_per_second,
                "word_count": len(word_matches),
                "meaningful_words": meaningful_words,
            },
        )
        minimal_words_required = max(2, int(duration / 4))
        if char_per_second < 1.0 and len(meaningful_words) < minimal_words_required:
            print("❌ 语音密度过低，判定为无效语音")
            raise HTTPException(
                status_code=400,
                detail=json.dumps(
                    {
                        "code": "EMPTY_TRANSCRIPT",
                        "message": "No valid speech detected.",
                    }
                ),
            )
    
    print(f"✅ 转录结果验证通过 - 内容: {transcription[:50]}...")


# ============================================================================
# API 路由
# ============================================================================

@router.post("/text", response_model=DiaryResponse, summary="创建文字日记")
async def create_text_diary(
    diary: DiaryCreate,
    user: Dict = Depends(get_current_user)
):
    """
    创建文字日记 - 支持多语言
    
    流程：
    1. AI 多语言处理（检测语言、润色、生成标题和反馈）
    2. 保存到 DynamoDB
    """
    try:
        openai_service = get_openai_service()
        
        # ✅ 修复：添加 await
        print(f"✨ 开始处理文字日记...")
        # 获取用户名字用于个性化反馈
        import re
        user_display_name = re.split(r'\s+', user.get('name', '').strip())[0] if user.get('name') else None
        print(f"👤 用户信息: user_id={user.get('user_id')}, name={user.get('name')}, display_name={user_display_name}")
        ai_result = await openai_service.polish_content_multilingual(diary.content, user_name=user_display_name)
        print(f"✅ AI 处理完成 - 标题: {ai_result['title']}")
        
        # 保存到数据库
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=diary.content,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("language", "zh"),  # 默认中文
            title=ai_result["title"]
        )
        
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
        validate_audio_quality(duration, len(audio_content))
        
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
        
        # 并行执行（同时进行，节省时间）
        audio_url, transcription = await asyncio.gather(
            upload_to_s3_async(),
            transcribe_async()
        )
        
        print(f"✅ 并行处理完成")
        print(f"  - 音频 URL: {audio_url}")
        print(f"  - 转录结果: {transcription[:50]}...")
        
        # ============================================
        # Step 3: 验证转录内容
        # ============================================
        validate_transcription(transcription, duration)
        
        # ============================================
        # Step 4: AI 处理 - ✅ 添加 await
        # ============================================
        print(f"✨ 开始 AI 处理...")
        # 获取用户名字用于个性化反馈
        # ✅ 优先从 user dict 获取，如果没有则尝试从请求头获取（备用方案）
        import re
        
        user_name = user.get('name', '').strip()
        
        # 如果名字为空，尝试从其他字段获取
        if not user_name:
            user_name = user.get('given_name', '').strip() or user.get('nickname', '').strip()
        
        # ✅ 如果JWT token中没有名字，尝试从请求头获取（前端传递的备用方案）
        if not user_name and request:
            user_name = request.headers.get("X-User-Name", "").strip()
            if user_name:
                print(f"   ✅ 从请求头获取到用户名字: {user_name}")
        
        # 提取名字（取第一个词）
        user_display_name = re.split(r'\s+', user_name)[0] if user_name else None
        
        print(f"👤 用户信息提取:")
        print(f"   user_id: {user.get('user_id')}")
        print(f"   name字段: '{user.get('name')}'")
        print(f"   given_name字段: '{user.get('given_name')}'")
        print(f"   nickname字段: '{user.get('nickname')}'")
        print(f"   最终使用的名字: '{user_display_name}'")
        
        ai_result = await openai_service.polish_content_multilingual(transcription, user_name=user_display_name)
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
            audio_duration=duration
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
        # 空内容错误（兼容旧逻辑）
        if "空内容" in str(e) or "未识别到有效内容" in str(e):
            raise HTTPException(
                status_code=400,
                detail=json.dumps({
                    "code": "EMPTY_TRANSCRIPT",
                    "message": "No valid speech detected."
                })
            )
        else:
            raise HTTPException(status_code=500, detail=f"处理语音失败: {str(e)}")
    except Exception as e:
        # 其他未预期的错误
        print(f"❌ 创建语音日记失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"处理语音失败: {str(e)}"
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


def update_task_progress(task_id: str, status: str, progress: int = 0, 
                        step: int = 0, step_name: str = "", message: str = "",
                        diary: Optional[Dict] = None, error: Optional[str] = None):
    """更新任务进度"""
    if task_id not in task_progress:
        task_progress[task_id] = {
            "status": "processing",
            "progress": 0,
            "step": 0,
            "step_name": "",
            "message": "",
            "created_at": datetime.now(timezone.utc)
        }
    
    task_progress[task_id].update({
        "status": status,
        "progress": progress,
        "step": step,
        "step_name": step_name,
        "message": message,
        "updated_at": datetime.now(timezone.utc)
    })
    
    if diary:
        task_progress[task_id]["diary"] = diary
    if error:
        task_progress[task_id]["error"] = error


async def process_voice_diary_async(
    task_id: str,
    audio_content: bytes,
    audio_filename: str,
    audio_content_type: str,
    duration: int,
    user: Dict,
    request: Optional[Request],
    image_urls: Optional[List[str]] = None  # ✅ 新增：图片URL列表（用于图片+语音日记）
):
    """异步处理语音日记（后台任务）"""
    try:
        openai_service = get_openai_service()
        
        # 更新进度：开始处理
        update_task_progress(task_id, "processing", 0, 0, "开始处理", "正在验证音频...")
        
        # 验证音频质量
        validate_audio_quality(duration, len(audio_content))
        
        # ============================================
        # Step 1: 上传S3 (10% → 20%)
        # ============================================
        update_task_progress(task_id, "processing", 10, 1, "上传音频", "正在上传音频到云端...")
        
        async def upload_to_s3_async():
            return await asyncio.to_thread(
                s3_service.upload_audio,
                file_content=audio_content,
                file_name=audio_filename,
                content_type=audio_content_type
            )
        
        audio_url = await upload_to_s3_async()
        update_task_progress(task_id, "processing", 20, 1, "上传音频", "音频上传完成")
        
        # ============================================
        # Step 2: 语音转文字 (25% → 50%)
        # ============================================
        update_task_progress(task_id, "processing", 25, 2, "语音转文字", "正在识别语音内容...")
        await asyncio.sleep(0.3)  # 延迟，让前端有时间更新
        
        update_task_progress(task_id, "processing", 30, 2, "语音转文字", "正在分析音频特征...")
        await asyncio.sleep(0.3)
        
        update_task_progress(task_id, "processing", 35, 2, "语音转文字", "正在转换为文字...")
        await asyncio.sleep(0.3)
        
        transcription = await openai_service.transcribe_audio(
            audio_content,
            audio_filename,
            expected_duration=duration
        )
        
        update_task_progress(task_id, "processing", 42, 2, "语音转文字", "正在验证识别结果...")
        await asyncio.sleep(0.3)
        update_task_progress(task_id, "processing", 48, 2, "语音转文字", "语音识别完成")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 50, 2, "语音转文字", "识别完成")
        
        # ============================================
        # Step 3: 验证转录内容
        # ============================================
        validate_transcription(transcription, duration)
        update_task_progress(task_id, "processing", 52, 2, "验证内容", "内容验证通过")
        
        # ============================================
        # Step 4: AI处理 - 润色 (55% → 70%)
        # ============================================
        update_task_progress(task_id, "processing", 55, 3, "AI润色", "正在美化文字...")
        await asyncio.sleep(0.3)
        
        # 获取用户名字
        import re
        user_name = user.get('name', '').strip()
        if not user_name:
            user_name = user.get('given_name', '').strip() or user.get('nickname', '').strip()
        if not user_name and request:
            user_name = request.headers.get("X-User-Name", "").strip()
        user_display_name = re.split(r'\s+', user_name)[0] if user_name else None
        
        # 添加中间进度（AI处理是并行任务，需要时间）
        update_task_progress(task_id, "processing", 60, 3, "AI润色", "正在优化表达...")
        await asyncio.sleep(0.3)
        
        # ✅ 如果有图片，将图片URL传递给AI，让AI同时分析图片和转录文字
        ai_result = await openai_service.polish_content_multilingual(
            transcription, 
            user_name=user_display_name,
            image_urls=image_urls  # 传递图片URL，AI会使用Vision能力分析
        )
        
        update_task_progress(task_id, "processing", 65, 3, "AI润色", "文字润色完成")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 68, 3, "AI润色", "润色完成")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 70, 3, "AI润色", "完成")
        
        # ============================================
        # Step 5: 生成标题和反馈 (75% → 95%)
        # ============================================
        # 注意：标题和反馈是并行生成的，所以进度可以更快
        update_task_progress(task_id, "processing", 75, 4, "生成标题", "正在生成标题...")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 78, 4, "生成标题", "标题生成中...")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 80, 4, "生成标题", "标题生成完成")
        
        update_task_progress(task_id, "processing", 83, 5, "生成反馈", "正在生成AI反馈...")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 86, 5, "生成反馈", "反馈生成中...")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 90, 5, "生成反馈", "反馈生成完成")
        
        update_task_progress(task_id, "processing", 93, 5, "保存数据", "正在保存到数据库...")
        await asyncio.sleep(0.2)
        
        # 保存到数据库
        diary_obj = db_service.create_diary(
            user_id=user['user_id'],
            original_content=transcription,
            polished_content=ai_result["polished_content"],
            ai_feedback=ai_result["feedback"],
            language=ai_result.get("language", "zh"),
            title=ai_result["title"],
            audio_url=audio_url,
            audio_duration=duration,
            image_urls=image_urls  # ✅ 新增：保存图片URL
        )
        
        # 更新进度：完成（分两步，让进度更平滑）
        update_task_progress(task_id, "processing", 96, 5, "保存数据", "数据保存中...")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "processing", 98, 5, "完成", "数据保存成功")
        await asyncio.sleep(0.2)
        update_task_progress(task_id, "completed", 100, 5, "完成", "处理完成", diary=diary_obj)
        
    except HTTPException as e:
        update_task_progress(task_id, "failed", 0, 0, "错误", str(e.detail), error=str(e.detail))
    except Exception as e:
        print(f"❌ 异步处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        update_task_progress(task_id, "failed", 0, 0, "错误", f"处理失败: {str(e)}", error=str(e))


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
        validate_audio_quality(duration, len(audio_content))
        
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
            # Step 2: 上传到S3 (20%)
            # ============================================
            yield await send_sse_event("progress", {
                "step": 1,
                "step_name": "上传音频",
                "progress": 10,
                "message": "正在上传音频到云端..."
            })
            
            async def upload_to_s3_async():
                return await asyncio.to_thread(
                    s3_service.upload_audio,
                    file_content=audio_content,
                    file_name=audio_filename,
                    content_type=audio_content_type
                )
            
            audio_url = await upload_to_s3_async()
            
            yield await send_sse_event("progress", {
                "step": 1,
                "step_name": "上传音频",
                "progress": 20,
                "message": "音频上传完成"
            })
            
            # ============================================
            # Step 3: 语音转文字 (50%)
            # ============================================
            yield await send_sse_event("progress", {
                "step": 2,
                "step_name": "语音转文字",
                "progress": 30,
                "message": "正在识别语音内容..."
            })
            
            transcription = await openai_service.transcribe_audio(
                audio_content,
                audio_filename,
                expected_duration=duration
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
            import re
            user_name = user.get('name', '').strip()
            if not user_name:
                user_name = user.get('given_name', '').strip() or user.get('nickname', '').strip()
            # 如果JWT token中没有名字，尝试从请求头获取（前端传递的备用方案）
            if not user_name and request:
                user_name = request.headers.get("X-User-Name", "").strip()
            user_display_name = re.split(r'\s+', user_name)[0] if user_name else None
            
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
                audio_duration=duration
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
        validate_audio_quality(duration, len(audio_content))
        
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
        
        # 初始化任务进度
        task_progress[task_id] = {
            "status": "processing",
            "progress": 0,
            "step": 0,
            "step_name": "初始化",
            "message": "任务已创建",
            "created_at": datetime.now(timezone.utc)
        }
        
        # 启动后台异步任务（不等待完成）
        asyncio.create_task(
            process_voice_diary_async(
                task_id=task_id,
                audio_content=audio_content,
                audio_filename=audio_filename,
                audio_content_type=audio_content_type,
                duration=duration,
                user=user,
                request=request,
                image_urls=parsed_image_urls  # ✅ 传递图片URL
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


@router.get("/voice/progress/{task_id}", summary="查询语音日记处理进度")
async def get_voice_diary_progress(
    task_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    查询语音日记处理进度
    
    📚 学习点：轮询模式
    - 前端定期调用此端点（如每500ms）
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
    """
    # 清理过期任务
    cleanup_old_tasks()
    
    if task_id not in task_progress:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")
    
    task_data = task_progress[task_id]
    
    # 检查任务是否属于当前用户（简单验证，生产环境需要更严格的验证）
    # 这里可以添加更严格的用户验证逻辑
    
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
    user: Dict = Depends(get_current_user)
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
            
            # Get user display name for personalized feedback
            import re
            user_display_name = re.split(r'\s+', user_name.strip())[0] if user_name else None
            
            print(f"✨ Processing text content with AI...")
            # ✅ 重要：如果有图片，将图片URL传递给AI，让AI同时分析图片和文字
            ai_result = await openai_service.polish_content_multilingual(
                content, 
                user_name=user_display_name,
                image_urls=image_urls  # 传递图片URL，AI会使用Vision能力分析
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
                image_urls=image_urls
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
    limit: int = 20,
    user: Dict = Depends(get_current_user)
):
    """
    获取用户的日记列表

    Args:
        limit: 返回数量限制（默认 20）
        user: 当前登录用户
    """
    try:
        print(f"📖 收到获取日记列表请求 - 用户ID: {user.get('user_id')}, limit: {limit}")
        
        # 检查用户ID是否存在
        user_id = user.get('user_id')
        if not user_id:
            print(f"❌ 用户ID为空")
            raise HTTPException(
                status_code=401,
                detail="用户ID无效"
            )
        
        # 尝试获取日记列表
        diaries = db_service.get_user_diaries(user_id, limit)
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
    
    Args:
        diary_id: 日记 ID
        diary: 更新内容
        user: 当前登录用户
    """
    try:
        print(f"📝 更新日记请求 - ID: {diary_id}, 用户: {user['user_id']}")
        
        # 构建更新字段
        update_fields = {}
        if diary.content is not None:
            update_fields['polished_content'] = diary.content
            print(f"📝 更新内容: {diary.content[:50]}...")
        if diary.title is not None:
            update_fields['title'] = diary.title
            print(f"📝 更新标题: {diary.title}")
        
        if not update_fields:
            raise ValueError("至少需要提供 content 或 title 之一")
        
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
        
        db_service.delete_diary(
            diary_id=diary_id,
            user_id=user['user_id']
        )
        
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