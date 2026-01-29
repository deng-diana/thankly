"""
Circle Feature - API Router
亲密圈功能 - API路由
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from ..utils.auth import get_current_user_id
from ..services.circle_service import CircleDBService
from ..services.rate_limiter import RateLimiter
from ..utils.invite_code import (
    generate_unique_invite_code,
    validate_invite_code_format,
    normalize_invite_code
)

router = APIRouter(prefix="/circle", tags=["Circle"])

# Service initialization (lazy loading)
def get_circle_service() -> CircleDBService:
    return CircleDBService()

def get_rate_limiter() -> RateLimiter:
    return RateLimiter()


# ====================================================================
# Pydantic Models
# ====================================================================

class CreateCircleRequest(BaseModel):
    circle_name: str = Field(..., min_length=1, max_length=20, description="Circle name")

class JoinCircleRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=6, description="Invite code")

class CircleResponse(BaseModel):
    circle_id: str
    circle_name: str
    member_count: int
    role: Optional[str] = None
    invite_code: Optional[str] = None  # Only visible to owner
    joined_at: Optional[str] = None
    created_at: str

class CircleMemberResponse(BaseModel):
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    role: str  # 'owner' | 'member'
    joined_at: str


# ====================================================================
# API Endpoints
# ====================================================================

@router.post("", response_model=CircleResponse, summary="Create circle")
async def create_circle(
    request: CreateCircleRequest,
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service)
):
    """
    Create a new circle
    
    - Auto-generate unique invite code
    - Creator becomes owner automatically
    - Free users can create up to 3 circles
    """
    # Check circle limit
    owned_count = circle_service.count_user_owned_circles(user_id)
    if owned_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "CIRCLE_LIMIT_EXCEEDED",
                "message": "Free users can create up to 3 circles"
            }
        )
    
    # Generate unique invite code
    def check_code_exists(code: str) -> bool:
        return circle_service.get_circle_by_invite_code(code) is not None
    
    invite_code = generate_unique_invite_code(check_code_exists)
    
    # Create circle
    try:
        # Note: user_name should be fetched from user service in Phase 2
        circle = circle_service.create_circle(
            user_id=user_id,
            circle_name=request.circle_name,
            invite_code=invite_code,
            user_name="Owner"  # Phase 2: Get from user profile service
        )
        
        return CircleResponse(
            circle_id=circle['circleId'],
            circle_name=circle['circleName'],
            member_count=circle['memberCount'],
            role='owner',
            invite_code=circle['inviteCode'],
            created_at=circle['createdAt']
        )
    except Exception as e:
        # Error already logged in service layer
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create circle"
        )


@router.post("/join", response_model=dict, summary="Join circle")
async def join_circle(
    request: JoinCircleRequest,
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service),
    rate_limiter: RateLimiter = Depends(get_rate_limiter)
):
    """
    Join circle via invite code
    
    - Rate limit: 10 attempts/day/user
    - Case-insensitive invite code
    - Prevent duplicate membership
    """
    # Rate limit check
    check_result = rate_limiter.check_invite_attempts(user_id)
    if not check_result['allowed']:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error_code": "TOO_MANY_ATTEMPTS",
                "message": "Too many attempts, please try again later",
                "retry_after": check_result['retry_after']
            }
        )
    
    # Normalize invite code
    invite_code = normalize_invite_code(request.invite_code)
    
    # Validate format
    if not validate_invite_code_format(invite_code):
        rate_limiter.record_invite_attempt(user_id, success=False)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_CODE_FORMAT",
                "message": "Invalid invite code format"
            }
        )
    
    # Query circle
    circle = circle_service.get_circle_by_invite_code(invite_code)
    if not circle:
        rate_limiter.record_invite_attempt(user_id, success=False)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "INVITE_CODE_NOT_FOUND",
                "message": "Invite code not found"
            }
        )
    
    circle_id = circle['circleId']
    
    # Check if already member
    if circle_service.is_circle_member(circle_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "ALREADY_MEMBER",
                "message": "You are already a member of this circle"
            }
        )
    
    # Join circle
    try:
        # Note: user_name should be fetched from user service in Phase 2
        circle_service.add_circle_member(
            circle_id=circle_id,
            user_id=user_id,
            user_name="Member",  # Phase 2: Get from user profile service
            role='member'
        )
        
        # Record success
        rate_limiter.record_invite_attempt(user_id, success=True)
        
        # Query updated circle info
        updated_circle = circle_service.get_circle_by_id(circle_id)
        
        return {
            "circle": CircleResponse(
                circle_id=updated_circle['circleId'],
                circle_name=updated_circle['circleName'],
                member_count=updated_circle['memberCount'],
                role='member',
                joined_at=circle_service.circle_members_table.get_item(
                    Key={'circleId': circle_id, 'userId': user_id}
                ).get('Item', {}).get('joinedAt')
            )
        }
    except Exception as e:
        # Error already logged in service layer
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to join circle"
        )


@router.get("/my-circles", response_model=List[CircleResponse], summary="Get my circles")
async def get_my_circles(
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service)
):
    """
    Get all circles user has joined
    
    - Sorted by join time (newest first)
    - Owner can see invite code
    """
    circles = circle_service.get_user_circles(user_id)
    
    result = []
    for circle in circles:
        response = CircleResponse(
            circle_id=circle['circleId'],
            circle_name=circle['circleName'],
            member_count=circle['memberCount'],
            role=circle['role'],
            invite_code=circle.get('inviteCode') if circle['role'] == 'owner' else None,
            joined_at=circle['joinedAt'],
            created_at=circle['createdAt']
        )
        result.append(response)
    
    return result


@router.get("/{circle_id}/members", response_model=List[CircleMemberResponse], summary="Get circle members")
async def get_circle_members(
    circle_id: str,
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service)
):
    """
    Get all members of a circle
    
    - Only members can view
    - Owner listed first
    """
    # Check permission
    if not circle_service.is_circle_member(circle_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this circle"
        )
    
    members = circle_service.get_circle_members(circle_id)
    
    return [
        CircleMemberResponse(
            user_id=m['userId'],
            user_name=m['userName'],
            user_avatar=m.get('userAvatar'),
            role=m['role'],
            joined_at=m['joinedAt']
        )
        for m in members
    ]


@router.delete("/{circle_id}/leave", summary="Leave circle")
async def leave_circle(
    circle_id: str,
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service)
):
    """
    Leave a circle
    
    - Owner cannot leave
    - Auto cleanup user's shares in this circle
    """
    # Check membership
    if not circle_service.is_circle_member(circle_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this circle"
        )
    
    # Check role
    role = circle_service.get_member_role(circle_id, user_id)
    if role == 'owner':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "OWNER_CANNOT_LEAVE",
                "message": "Owner cannot leave the circle"
            }
        )
    
    # Leave circle (auto cleanup shares)
    try:
        circle_service.remove_circle_member(circle_id, user_id)
        return {"message": "Successfully left the circle"}
    except Exception as e:
        # Error already logged in service layer
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to leave circle"
        )


@router.get("/{circle_id}/feed", summary="Get circle feed")
async def get_circle_feed(
    circle_id: str,
    limit: int = 20,
    last_key: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    circle_service: CircleDBService = Depends(get_circle_service)
):
    """
    Get circle feed (shared diaries)
    
    - Only members can view
    - Sorted by share time (newest first)
    - Pagination support
    - Uses denormalized fields for performance
    
    Query parameters:
        - limit: Number of items per page (default 20)
        - last_key: Pagination cursor (from previous response)
    
    Returns:
        - items: List of shared diaries with full details
        - last_key: Cursor for next page (null if no more)
    """
    # Check permission
    if not circle_service.is_circle_member(circle_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this circle"
        )
    
    try:
        # Parse last_key from string if provided
        decoded_last_key = None
        if last_key:
            import json
            import base64
            try:
                decoded_last_key = json.loads(base64.b64decode(last_key))
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid pagination cursor"
                )
        
        # Get feed
        result = circle_service.get_circle_feed(
            circle_id=circle_id,
            limit=limit,
            last_key=decoded_last_key
        )
        
        # Encode last_key for response
        encoded_last_key = None
        if result['last_key']:
            import json
            import base64
            encoded_last_key = base64.b64encode(
                json.dumps(result['last_key']).encode()
            ).decode()
        
        return {
            "circle_id": circle_id,
            "items": result['items'],
            "last_key": encoded_last_key,
            "count": len(result['items'])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error already logged in service layer
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get circle feed"
        )
