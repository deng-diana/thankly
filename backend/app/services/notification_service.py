"""
Notification Service - 推送通知服务

功能：
1. 推送频率限制（每日3条/圈子）
2. 推送静音时段（22:00-08:00）
3. 管理用户的 Push Token
4. 发送圈子分享通知

技术选型：
- AWS SNS (Simple Notification Service) for push delivery
- DynamoDB for rate limiting and token storage
"""

import logging
import boto3
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from ..config import AWS_REGION

logger = logging.getLogger(__name__)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
sns_client = boto3.client('sns', region_name=AWS_REGION)

# Table names
PUSH_TOKENS_TABLE = f"thankly-push-tokens-{AWS_REGION}"
PUSH_RATE_LIMIT_TABLE = f"thankly-push-rate-limit-{AWS_REGION}"


class NotificationService:
    """推送通知服务"""
    
    def __init__(self):
        self.push_tokens_table = dynamodb.Table(PUSH_TOKENS_TABLE)
        self.rate_limit_table = dynamodb.Table(PUSH_RATE_LIMIT_TABLE)
    
    def register_push_token(
        self,
        user_id: str,
        push_token: str,
        platform: str,  # 'ios' or 'android'
        device_id: str,
    ) -> Dict:
        """
        Register or update user's push notification token
        
        Args:
            user_id: User ID
            push_token: Expo push token or FCM token
            platform: 'ios' or 'android'
            device_id: Unique device identifier
        
        Returns:
            Registration result
        """
        try:
            item = {
                'userId': user_id,
                'deviceId': device_id,
                'pushToken': push_token,
                'platform': platform,
                'updatedAt': datetime.now(timezone.utc).isoformat(),
                'active': True,
            }
            
            self.push_tokens_table.put_item(Item=item)
            
            logger.info(f"Push token registered for user {user_id}, device {device_id}")
            
            return {
                'success': True,
                'userId': user_id,
                'deviceId': device_id,
            }
        except Exception as e:
            logger.error(f"Failed to register push token for user {user_id}: {e}")
            raise
    
    def get_user_tokens(self, user_id: str) -> List[Dict]:
        """
        Get all active push tokens for a user
        
        Args:
            user_id: User ID
        
        Returns:
            List of active tokens
        """
        try:
            response = self.push_tokens_table.query(
                KeyConditionExpression='userId = :uid',
                FilterExpression='active = :active',
                ExpressionAttributeValues={
                    ':uid': user_id,
                    ':active': True,
                },
            )
            
            return response.get('Items', [])
        except Exception as e:
            logger.error(f"Failed to get tokens for user {user_id}: {e}")
            return []
    
    def check_rate_limit(
        self,
        user_id: str,
        circle_id: str,
        daily_limit: int = 3,
    ) -> bool:
        """
        Check if user has exceeded daily push notification limit for a circle
        
        Args:
            user_id: User ID
            circle_id: Circle ID
            daily_limit: Maximum pushes per day per circle (default: 3)
        
        Returns:
            True if within limit, False if exceeded
        """
        try:
            # Rate limit key: userId#circleId#date
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            rate_key = f"{user_id}#{circle_id}#{today}"
            
            response = self.rate_limit_table.get_item(
                Key={'rateKey': rate_key}
            )
            
            if 'Item' not in response:
                return True  # No record, within limit
            
            count = response['Item'].get('count', 0)
            return count < daily_limit
            
        except Exception as e:
            logger.error(f"Failed to check rate limit for {user_id} in circle {circle_id}: {e}")
            return True  # On error, allow push (fail open)
    
    def increment_rate_limit(
        self,
        user_id: str,
        circle_id: str,
    ) -> None:
        """
        Increment the push notification count for today
        
        Args:
            user_id: User ID
            circle_id: Circle ID
        """
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            rate_key = f"{user_id}#{circle_id}#{today}"
            
            # Calculate TTL (expire at end of next day)
            tomorrow_end = datetime.now(timezone.utc).replace(
                hour=23, minute=59, second=59
            ) + timedelta(days=1)
            ttl = int(tomorrow_end.timestamp())
            
            self.rate_limit_table.update_item(
                Key={'rateKey': rate_key},
                UpdateExpression='ADD #count :inc SET #ttl = :ttl',
                ExpressionAttributeNames={
                    '#count': 'count',
                    '#ttl': 'ttl',
                },
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':ttl': ttl,
                },
            )
            
            logger.info(f"Rate limit incremented for {user_id} in circle {circle_id}")
            
        except Exception as e:
            logger.error(f"Failed to increment rate limit: {e}")
            # Non-critical, don't raise
    
    def is_quiet_hours(self, user_timezone: str = 'UTC') -> bool:
        """
        Check if current time is within quiet hours (22:00-08:00)
        
        Args:
            user_timezone: User's timezone (e.g., 'Asia/Shanghai')
        
        Returns:
            True if in quiet hours, False otherwise
        """
        try:
            # For MVP, use UTC time
            # TODO: Phase 2 - Support user timezone preferences
            now = datetime.now(timezone.utc)
            hour = now.hour
            
            # Quiet hours: 22:00-08:00 (10pm to 8am)
            if hour >= 22 or hour < 8:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to check quiet hours: {e}")
            return False  # On error, allow push
    
    def send_diary_shared_notification(
        self,
        circle_id: str,
        sharer_user_id: str,
        sharer_name: str,
        circle_name: str,
        diary_title: str,
        member_user_ids: List[str],
    ) -> Dict:
        """
        Send push notification to circle members when a diary is shared
        
        Args:
            circle_id: Circle ID
            sharer_user_id: User who shared the diary
            sharer_name: Sharer's display name
            circle_name: Circle name
            diary_title: Diary title
            member_user_ids: List of member user IDs (excluding sharer)
        
        Returns:
            Notification send result
        """
        try:
            # Check quiet hours
            if self.is_quiet_hours():
                logger.info(f"Quiet hours active, skipping notification for circle {circle_id}")
                return {
                    'success': True,
                    'skipped': True,
                    'reason': 'quiet_hours',
                    'sentCount': 0,
                }
            
            # Check rate limit for sharer
            if not self.check_rate_limit(sharer_user_id, circle_id):
                logger.info(f"Rate limit exceeded for user {sharer_user_id} in circle {circle_id}")
                return {
                    'success': True,
                    'skipped': True,
                    'reason': 'rate_limit',
                    'sentCount': 0,
                }
            
            # Get push tokens for all members (excluding sharer)
            recipients = [uid for uid in member_user_ids if uid != sharer_user_id]
            
            if not recipients:
                return {
                    'success': True,
                    'skipped': True,
                    'reason': 'no_recipients',
                    'sentCount': 0,
                }
            
            # Collect all tokens
            all_tokens = []
            for user_id in recipients:
                tokens = self.get_user_tokens(user_id)
                all_tokens.extend(tokens)
            
            if not all_tokens:
                logger.info(f"No active tokens found for circle {circle_id} members")
                return {
                    'success': True,
                    'skipped': True,
                    'reason': 'no_tokens',
                    'sentCount': 0,
                }
            
            # Prepare notification payload
            # TODO: Phase 2 - Use Expo Push Notification Service or FCM
            # For MVP, log the notification (actual implementation requires Expo backend)
            notification_payload = {
                'title': f"{sharer_name} 分享了新日记",
                'body': diary_title or "查看详情",
                'data': {
                    'type': 'diary_shared',
                    'circleId': circle_id,
                    'circleName': circle_name,
                },
            }
            
            logger.info(f"Notification prepared for {len(all_tokens)} devices")
            logger.info(f"Payload: {notification_payload}")
            
            # Increment rate limit
            self.increment_rate_limit(sharer_user_id, circle_id)
            
            return {
                'success': True,
                'skipped': False,
                'sentCount': len(all_tokens),
                'payload': notification_payload,
            }
            
        except Exception as e:
            logger.error(f"Failed to send notification for circle {circle_id}: {e}")
            raise


# Global instance
notification_service = NotificationService()
