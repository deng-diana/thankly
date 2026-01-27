"""账号合规路由：账号删除等功能"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
import boto3
from botocore.exceptions import ClientError

from ..utils.cognito_auth import get_current_user
from ..services.dynamodb_service import DynamoDBService
from ..services.s3_service import S3Service
from ..config import get_settings, get_boto3_kwargs


router = APIRouter()

db_service = DynamoDBService()
s3_service = S3Service()


def _get_cognito_client():
    settings = get_settings()
    client = boto3.client(
        "cognito-idp",
        **get_boto3_kwargs(settings, settings.cognito_region)
    )
    return client, settings


@router.delete(
    "/delete",
    summary="删除账号及所有关联数据",
    response_model=dict,
)
async def delete_account(user: Dict = Depends(get_current_user)):
    user_id = user.get("user_id")
    username = user.get("username") or user_id

    if not user_id or not username:
        raise HTTPException(status_code=400, detail="用户信息缺失，无法删除账号")

    print(f"🗑️ 收到账号删除请求 - user_id: {user_id}, username: {username}")

    try:
        audio_urls = db_service.delete_user_data(user_id)
        print(
            f"🧹 已删除用户日记，共 {len(audio_urls)} 条音频记录需要清理"
        )
    except Exception as e:
        print(f"❌ 删除用户日记失败: {e}")
        raise HTTPException(status_code=500, detail="删除用户内容失败")

    try:
        s3_service.delete_objects_by_urls(audio_urls)
    except Exception as e:
        print(f"⚠️ 删除S3文件失败: {e}")
        raise HTTPException(status_code=500, detail="删除用户存储文件失败")

    try:
        cognito_client, settings = _get_cognito_client()
        cognito_client.admin_delete_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=username,
        )
        print("✅ Cognito 用户删除成功")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "UserNotFoundException":
            print("⚠️ Cognito 中未找到用户，视为已删除")
        else:
            print(f"❌ 删除 Cognito 用户失败: {error_code} - {e}")
            raise HTTPException(status_code=500, detail="删除用户账号失败")
    except Exception as e:
        print(f"❌ Cognito 删除过程异常: {e}")
        raise HTTPException(status_code=500, detail="删除用户账号失败")

    return {"success": True}








