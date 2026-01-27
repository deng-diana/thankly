from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
from pathlib import Path
import os

class Settings(BaseSettings):
    """应用配置"""
    
    # OpenAI配置（可选，某些端点不需要）
    openai_api_key: Optional[str] = ""
    
    # AWS配置
    aws_region: str = "us-east-1"
    aws_access_key_id: Optional[str] = ""
    aws_secret_access_key: Optional[str] = ""
    aws_session_token: Optional[str] = ""
    dynamodb_table_name: str = "GratitudeDiaries"
    s3_bucket_name: str = ""  # S3存储桶名称
    
    # Cognito配置 (新增)
    cognito_region: str = "us-east-1"
    cognito_user_pool_id: Optional[str] = ""  # us-east-1_xxxxxxxxx
    cognito_client_id: Optional[str] = ""  # 7xxxxxxxxxxxxxxxxxxxxx
    cognito_app_client_secret: str = ""  # 可选
    cognito_domain: Optional[str] = ""  # 自定义域名，如 auth.thankly.app
    
    # 应用配置
    app_name: str = "Gratitude Diary API"
    debug: bool = False
    
    class Config:
        # 固定读取 backend/.env，避免在项目根目录启动时找不到
        env_file = str(Path(__file__).resolve().parents[1] / ".env")
        env_file_encoding = 'utf-8'  # 指定编码
        case_sensitive = False  # 允许环境变量名称不区分大小写
        extra = "ignore"  # 忽略额外的字段，避免验证错误

@lru_cache()
def get_settings():
    """获取配置(单例模式)"""
    import os
    import sys
    
    # 🔍 调试：检查当前工作目录和 .env 文件
    current_dir = os.getcwd()
    env_file_path = Settings.Config.env_file
    env_file_exists = os.path.exists(env_file_path)
    
    print(f"🔍 配置加载检查:")
    print(f"   - 当前目录: {current_dir}")
    print(f"   - .env 文件路径: {env_file_path}")
    print(f"   - .env 文件存在: {env_file_exists}")
    
    if env_file_exists:
        print(f"   - .env 文件可读: 是")
    
    try:
        # 先尝试从环境变量读取（优先级更高）
        settings = Settings()
        
        # 🔥 如果配置为空，尝试从环境变量直接读取
        if not settings.cognito_user_pool_id:
            print(f"⚠️ 从 .env 文件读取的 Pool ID 为空，尝试从环境变量读取...")
            pool_id = os.getenv("COGNITO_USER_POOL_ID", "")
            client_id = os.getenv("COGNITO_CLIENT_ID", "")
            if pool_id:
                print(f"✅ 从环境变量读取到 Pool ID: {pool_id[:20]}...")
                # 创建新的 Settings 实例，手动设置值
                settings_dict = settings.dict()
                settings_dict['cognito_user_pool_id'] = pool_id
                settings_dict['cognito_client_id'] = client_id
                settings = Settings(**settings_dict)
        
        print(f"✅ 配置加载成功:")
        print(f"   - 表名: {settings.dynamodb_table_name}")
        print(f"   - 区域: {settings.aws_region}")
        print(f"   - Cognito Pool ID: {settings.cognito_user_pool_id[:20] if settings.cognito_user_pool_id else 'N/A'}...")
        print(f"   - Cognito Client ID: {settings.cognito_client_id[:20] if settings.cognito_client_id else 'N/A'}...")
        return settings
    except Exception as e:
        print(f"❌ 配置加载失败: {str(e)}")
        import traceback
        traceback.print_exc()
        # 在 Lambda 环境中，尝试从环境变量直接读取
        print(f"⚠️ 尝试从环境变量直接读取配置...")
        return Settings(
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            dynamodb_table_name=os.getenv("DYNAMODB_TABLE_NAME", "GratitudeDiaries"),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            aws_session_token=os.getenv("AWS_SESSION_TOKEN", ""),
            cognito_user_pool_id=os.getenv("COGNITO_USER_POOL_ID", ""),
            cognito_client_id=os.getenv("COGNITO_CLIENT_ID", ""),
            s3_bucket_name=os.getenv("S3_BUCKET_NAME", "")
        )

def get_boto3_kwargs(settings: Settings, region_name: Optional[str] = None) -> dict:
    """Build boto3 client/resource kwargs with optional static credentials."""
    kwargs = {"region_name": region_name or settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            kwargs["aws_session_token"] = settings.aws_session_token
    return kwargs
