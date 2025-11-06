"""
日记路由 - 优化版本
主要改进：
1. ✅ 修复 async/await 调用问题
2. ✅ 优化代码结构和可读性
3. ✅ 增强错误处理
4. ✅ 保持所有原有逻辑不变
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, Request
from typing import List, Dict
import asyncio
import re
import json
from datetime import datetime, timezone

from ..models.diary import DiaryCreate, DiaryResponse, DiaryUpdate
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


def validate_transcription(transcription: str) -> None:
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
                audio.filename or "recording.m4a"
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
        validate_transcription(transcription)
        
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
        
    except Exception as e:
        print(f"❌ 删除日记失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"删除日记失败: {str(e)}"
        )