"""
Rate Limiter Service
Using DynamoDB implementation (can migrate to Redis in future)
"""

import boto3
from datetime import datetime, timezone, timedelta
from typing import Optional
from ..config import get_settings, get_boto3_kwargs
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Rate limiter (based on DynamoDB TTL)
    Purpose:
    1. Invite code attempt limit (10/day/user)
    2. Push notification frequency limit (3/day/circle)
    """
    
    def __init__(self):
        try:
            settings = get_settings()
            self.dynamodb = boto3.resource("dynamodb", **get_boto3_kwargs(settings))
            
            # Reuse existing diaries table (with itemType='RATE_LIMIT')
            self.table = self.dynamodb.Table(settings.dynamodb_table_name)
            
            logger.info("RateLimiter initialized successfully")
        except Exception as e:
            logger.error(f"RateLimiter initialization failed: {str(e)}", exc_info=True)
            raise
    
    def _get_today_key(self, prefix: str, identifier: str) -> str:
        """生成今天的唯一键"""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"{prefix}#{identifier}#{today}"
    
    def _get_ttl_timestamp(self, days: int = 1) -> int:
        """获取TTL时间戳（自动过期）"""
        expiry = datetime.now(timezone.utc) + timedelta(days=days)
        return int(expiry.timestamp())
    
    # ====================================================================
    # 邀请码尝试次数限制
    # ====================================================================
    
    def check_invite_attempts(self, user_id: str, max_attempts: int = 10) -> dict:
        """
        检查邀请码尝试次数
        
        Args:
            user_id: 用户ID
            max_attempts: 最大尝试次数
        
        Returns:
            {
                'allowed': bool,        # 是否允许尝试
                'remaining': int,       # 剩余次数
                'retry_after': int      # 如果不允许，需要等待的秒数
            }
        """
        key = self._get_today_key('INVITE_ATTEMPT', user_id)
        
        try:
            response = self.table.get_item(
                Key={
                    'userId': user_id,
                    'createdAt': key
                }
            )
            
            item = response.get('Item')
            if not item:
                # 首次尝试
                return {
                    'allowed': True,
                    'remaining': max_attempts - 1,
                    'retry_after': 0
                }
            
            current_count = item.get('attemptCount', 0)
            
            if current_count >= max_attempts:
                # 超过限制
                # 计算到今天结束还有多少秒
                now = datetime.now(timezone.utc)
                tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0)
                retry_after = int((tomorrow - now).total_seconds())
                
                return {
                    'allowed': False,
                    'remaining': 0,
                    'retry_after': retry_after
                }
            
            return {
                'allowed': True,
                'remaining': max_attempts - current_count - 1,
                'retry_after': 0
            }
        
        except Exception as e:
            logger.error(f"Failed to check invite attempts: {str(e)}")
            # Allow attempt on failure (degradation strategy)
            return {'allowed': True, 'remaining': max_attempts, 'retry_after': 0}
    
    def record_invite_attempt(self, user_id: str, success: bool = False):
        """
        记录邀请码尝试
        
        Args:
            user_id: 用户ID
            success: 是否成功（成功则不计数）
        """
        if success:
            # Success, clear counter
            key = self._get_today_key('INVITE_ATTEMPT', user_id)
            try:
                self.table.delete_item(
                    Key={
                        'userId': user_id,
                        'createdAt': key
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to clear rate limit counter: {str(e)}")
            return
        
        # 失败，增加计数
        key = self._get_today_key('INVITE_ATTEMPT', user_id)
        try:
            self.table.update_item(
                Key={
                    'userId': user_id,
                    'createdAt': key
                },
                UpdateExpression='SET attemptCount = if_not_exists(attemptCount, :zero) + :inc, '
                                'itemType = :type, ttl = :ttl',
                ExpressionAttributeValues={
                    ':zero': 0,
                    ':inc': 1,
                    ':type': 'RATE_LIMIT',
                    ':ttl': self._get_ttl_timestamp(days=1)
                }
            )
        except Exception as e:
            logger.error(f"Failed to record invite attempt: {str(e)}")
    
    # ====================================================================
    # 推送通知频率限制
    # ====================================================================
    
    def check_push_limit(self, circle_id: str, max_pushes: int = 3) -> dict:
        """
        检查推送频率限制
        
        Args:
            circle_id: 圈子ID
            max_pushes: 每日最大推送数
        
        Returns:
            {
                'allowed': bool,
                'remaining': int
            }
        """
        key = self._get_today_key('PUSH_COUNT', circle_id)
        
        try:
            response = self.table.get_item(
                Key={
                    'userId': 'SYSTEM',  # 系统级记录
                    'createdAt': key
                }
            )
            
            item = response.get('Item')
            if not item:
                return {'allowed': True, 'remaining': max_pushes - 1}
            
            current_count = item.get('pushCount', 0)
            
            if current_count >= max_pushes:
                return {'allowed': False, 'remaining': 0}
            
            return {
                'allowed': True,
                'remaining': max_pushes - current_count - 1
            }
        
        except Exception as e:
            logger.error(f"Failed to check push limit: {str(e)}")
            return {'allowed': True, 'remaining': max_pushes}
    
    def record_push(self, circle_id: str):
        """记录推送通知"""
        key = self._get_today_key('PUSH_COUNT', circle_id)
        
        try:
            self.table.update_item(
                Key={
                    'userId': 'SYSTEM',
                    'createdAt': key
                },
                UpdateExpression='SET pushCount = if_not_exists(pushCount, :zero) + :inc, '
                                'itemType = :type, ttl = :ttl',
                ExpressionAttributeValues={
                    ':zero': 0,
                    ':inc': 1,
                    ':type': 'RATE_LIMIT',
                    ':ttl': self._get_ttl_timestamp(days=1)
                }
            )
        except Exception as e:
            logger.error(f"Failed to record push: {str(e)}")
    
    # ====================================================================
    # 推送静音时段检查
    # ====================================================================
    
    @staticmethod
    def is_quiet_hours(user_timezone_offset: int = 8) -> bool:
        """
        Check if currently in quiet hours (22:00 - 08:00)
        
        Args:
            user_timezone_offset: User's timezone offset from UTC (default: 8 for UTC+8/China)
        
        Returns:
            Whether it's quiet hours
        """
        now = datetime.now(timezone.utc)
        # Convert to user's timezone
        user_time = now + timedelta(hours=user_timezone_offset)
        hour = user_time.hour
        
        # 22:00 to 08:00 next day
        return hour >= 22 or hour < 8
