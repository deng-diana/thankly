from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.openapi.utils import get_openapi
from datetime import datetime  # 用于健康检查的时间戳
from .routers import diary, auth, account, circle  # Add circle router (intimate-circle feature)
from .config import get_settings

# 获取配置（延迟初始化，避免启动时失败）
try:
    settings=get_settings()
    print(f"✅ 配置加载成功 - 表名: {settings.dynamodb_table_name}, 区域: {settings.aws_region}")
except Exception as e:
    print(f"❌ 配置加载失败: {str(e)}")
    import traceback
    traceback.print_exc()
    # 设置默认值，避免应用无法启动
    class DefaultSettings:
        app_name = "Gratitude Diary API"
        dynamodb_table_name = "GratitudeDiaries"
        aws_region = "us-east-1"
        cognito_region = "us-east-1"
        cognito_user_pool_id = ""
        cognito_client_id = ""
    settings = DefaultSettings()

# 定义HTTP Bearer安全方案
# 这会让Swagger UI显示🔓 Authorize按钮
security = HTTPBearer(
    scheme_name="Bearer Authentication",
    description="输入从Cognito获取的JWT token"
)

# 创建FastAPI应用, 配置标题和描述
app=FastAPI(
    title=settings.app_name,
    description="感恩日记后端API - 记录生活中的美好时刻",
    version="1.0.0",
    docs_url="/docs",# Swagger文档地址
    redoc_url="/redoc"# ReDoc文档地址
)

# 自定义OpenAPI schema - 这会让Swagger显示🔓按钮
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # 添加Bearer认证定义
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "请输入从AWS Cognito获取的JWT token (只输入token,不要加Bearer前缀)"
        }
    }
    
    # 标记哪些路由需要认证
    for path in openapi_schema["paths"]:
        for method in openapi_schema["paths"][path]:
            # /diary开头的所有路由都需要认证
            if path.startswith("/diary"):
                openapi_schema["paths"][path][method]["security"] = [
                    {"BearerAuth": []}
                ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# 应用自定义OpenAPI schema
app.openapi = custom_openapi


# 配置CORS(允许前端跨域访问)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
# 认证路由 - 不需要认证前缀
app.include_router(
    auth.router,
    prefix="/auth",
    tags=["认证"]
)

# 账号管理路由
app.include_router(
    account.router,
    prefix="/account",
    tags=["账号管理"]
)

# 日记路由
app.include_router(
    diary.router,
    prefix="/diary",#所有diary.router的路径前加/diary
    tags=["日记管理"]
)

# 添加兼容性路由 - 支持 /diaries 路径
app.include_router(
    diary.router,
    prefix="/diaries",#支持 /diaries 路径
    tags=["日记管理"]
)

# Circle router (Intimate Circle feature)
app.include_router(
    circle.router,
    prefix="",  # Prefix already defined in router as /circle
    tags=["Circle"]
)

# 根路径
@app.get("/", tags=["健康检查"])
async def root():
    """API根路径""" 
    return {
        "message":"欢迎使用感恩日记API",
        "version":"1.0.0",
        "docs":"/docs"
    }
# 健康检查端点
@app.get("/health",tags=["健康检查"])
async def health_check():
    """检查API是否正常运行"""
    try:
        # 测试配置是否正常
        config_status = "ok"
        try:
            settings = get_settings()
            if not settings.dynamodb_table_name:
                config_status = "missing_config"
        except Exception as e:
            config_status = f"config_error: {str(e)}"
        
        from datetime import timezone
        return {
            "status": "healthy",
            "config": config_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        print(f"❌ 健康检查失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "unhealthy",
            "error": str(e)
        }