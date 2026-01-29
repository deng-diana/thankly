"""
Auth helpers (wrapper around Cognito auth)
"""

from fastapi import Depends
from .cognito_auth import get_current_user


async def get_current_user_id(user=Depends(get_current_user)) -> str:
    """Return current user's id for routes that only need user_id."""
    return user.get("user_id")
