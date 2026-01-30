"""
Notification API Router - 推送通知接口

API Endpoints:
- POST /notification/register-token - Register push notification token
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Literal

from ..utils.auth import verify_token
from ..services.notification_service import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notification", tags=["notification"])


# ========== Request/Response Models ==========

class RegisterTokenRequest(BaseModel):
    """Register push token request"""
    pushToken: str = Field(..., description="Expo push token or FCM token")
    platform: Literal['ios', 'android'] = Field(..., description="Device platform")
    deviceId: str = Field(..., description="Unique device identifier")


class RegisterTokenResponse(BaseModel):
    """Register push token response"""
    success: bool
    userId: str
    deviceId: str


# ========== API Endpoints ==========

@router.post(
    "/register-token",
    response_model=RegisterTokenResponse,
    summary="Register push notification token",
    description="""
    Register or update user's push notification token.
    
    **Business Rules:**
    - One device can have only one active token
    - Updating token will overwrite previous one
    - Tokens are automatically marked inactive after 90 days of no updates
    
    **Request:**
    ```json
    {
      "pushToken": "ExponentPushToken[xxx]",
      "platform": "ios",
      "deviceId": "uuid-xxxx-xxxx"
    }
    ```
    
    **Response:**
    ```json
    {
      "success": true,
      "userId": "user123",
      "deviceId": "uuid-xxxx-xxxx"
    }
    ```
    
    **Error Codes:**
    - 401: Unauthorized (invalid or expired token)
    - 400: Invalid request (missing or invalid fields)
    - 500: Server error
    """
)
async def register_token(
    request: RegisterTokenRequest,
    user_id: str = Depends(verify_token),
):
    """
    Register push notification token for the current user
    
    Args:
        request: Token registration request
        user_id: User ID from JWT token
    
    Returns:
        Registration result
    """
    try:
        result = notification_service.register_push_token(
            user_id=user_id,
            push_token=request.pushToken,
            platform=request.platform,
            device_id=request.deviceId,
        )
        
        logger.info(f"Push token registered successfully for user {user_id}")
        
        return RegisterTokenResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to register push token for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to register push notification token"
        )
