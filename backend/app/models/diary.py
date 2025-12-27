from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DiaryCreate(BaseModel):
    """创建日记的请求数据"""
    content: str = Field(..., min_length=1, max_length=5000, description="日记内容")
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "今天同事帮我解决了一个bug,很感激他"
            }
        }

class DiaryUpdate(BaseModel):
    """编辑日记的请求数据"""
    content: Optional[str] = Field(None, min_length=1, max_length=5000, description="编辑后的日记内容")
    title: Optional[str] = Field(None, min_length=1, max_length=100, description="编辑后的标题")
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "今天同事帮我解决了一个棘手的bug，还教了我很多调试技巧，非常感激！",
                "title": "同事的帮助与技术成长"
            }
        }

class PresignedUrlRequest(BaseModel):
    """请求预签名 URL 的数据"""
    file_names: List[str] = Field(..., min_items=1, max_items=9, description="文件名列表（最多9个）")
    content_types: Optional[List[str]] = Field(None, description="MIME 类型列表（可选，默认 image/jpeg）")
    
    class Config:
        json_schema_extra = {
            "example": {
                "file_names": ["photo1.jpg", "photo2.jpg"],
                "content_types": ["image/jpeg", "image/png"]
            }
        }

class ImageOnlyDiaryCreate(BaseModel):
    """创建图片日记的请求数据（支持可选文字）"""
    image_urls: List[str] = Field(..., min_items=1, max_items=9, description="图片URL列表（最多9张）")
    content: Optional[str] = Field(None, min_length=1, max_length=5000, description="可选的文字内容")
    
    class Config:
        json_schema_extra = {
            "example": {
                "image_urls": [
                    "https://s3.amazonaws.com/.../image1.jpg",
                    "https://s3.amazonaws.com/.../image2.jpg"
                ],
                "content": "今天和朋友一起去了公园，拍了很多照片"
            }
        }

class DiaryResponse(BaseModel):
    """返回给前端的日记数据"""
    diary_id: str = Field(..., description="日记ID")
    user_id: str = Field(..., description="用户ID")
    created_at: str = Field(..., description="创建时间")
    date: str = Field(..., description="日期(YYYY-MM-DD)")
    
    # ✅ 新增：多语言支持
    language: str = Field(..., description="检测到的语言代码")
    title: str = Field(..., description="AI生成的标题")
    
    original_content: str = Field(..., description="原始内容")
    polished_content: str = Field(..., description="润色后内容")
    ai_feedback: str = Field(..., description="AI反馈")
    # ✅ 新增：音频相关字段
    audio_url: Optional[str] = Field(None, description="音频文件S3 URL")
    audio_duration: Optional[int] = Field(None, description="音频时长(秒)")
    image_urls: Optional[List[str]] = None  # List of image URLs (max 9)


    class Config:
        json_schema_extra = {
            "example": {
                "diary_id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "user_123",
                "created_at": "2025-10-08T10:30:00Z",
                "date": "2025-10-08",
                "language": "zh",
                "title": "同事的帮助",
                "original_content": "今天同事帮我解决了一个bug,很感激他",
                "polished_content": "今天同事帮我解决了一个棘手的bug,我很感激他的帮助。",
                "ai_feedback": "能遇到愿意伸出援手的同事真的很幸运呢!🙂",
                "audio_url": "https://s3.amazonaws.com/.../audio.m4a",
                "audio_duration": 45,
                "image_urls": [
                    "https://s3.amazonaws.com/.../image1.jpg",
                    "https://s3.amazonaws.com/.../image2.jpg"
                ]
            }
        }