"""
Circle Feature - Database Service Layer
"""

import boto3
from boto3.dynamodb.conditions import Key, Attr
from typing import List, Optional, Dict, Any
from ..config import get_settings, get_boto3_kwargs
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class CircleDBService:
    """Circle database service"""
    
    def __init__(self):
        try:
            settings = get_settings()
            self.dynamodb = boto3.resource("dynamodb", **get_boto3_kwargs(settings))
            
            # Table name configuration
            env_suffix = '-prod' if settings.environment == 'production' else '-dev'
            self.circles_table = self.dynamodb.Table(f'thankly-circles{env_suffix}')
            self.circle_members_table = self.dynamodb.Table(f'thankly-circle-members{env_suffix}')
            self.diary_shares_table = self.dynamodb.Table(f'thankly-diary-shares{env_suffix}')
            
            logger.info(f"CircleDBService initialized successfully (env: {settings.environment})")
        except Exception as e:
            logger.error(f"CircleDBService initialization failed: {str(e)}", exc_info=True)
            raise
    
    def _convert_to_decimal(self, obj: Any) -> Any:
        """递归将 float 转换为 Decimal"""
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._convert_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_decimal(i) for i in obj]
        return obj
    
    # ====================================================================
    # 圈子管理
    # ====================================================================
    
    def create_circle(self, user_id: str, circle_name: str, invite_code: str, 
                     user_name: str = "Owner") -> dict:
        """Create a circle"""
        circle_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        
        item = {
            'circleId': circle_id,
            'userId': user_id,
            'circleName': circle_name,
            'inviteCode': invite_code,
            'memberCount': 1,
            'createdAt': created_at,
            'updatedAt': created_at
        }
        
        try:
            self.circles_table.put_item(Item=item)
            # Add creator as member
            self.add_circle_member(
                circle_id=circle_id,
                user_id=user_id,
                user_name=user_name,
                role='owner'
            )
            return item
        except Exception as e:
            logger.error(f"Failed to create circle: {str(e)}", exc_info=True)
            raise
    
    def get_circle_by_id(self, circle_id: str) -> Optional[dict]:
        """Get circle by ID"""
        try:
            response = self.circles_table.get_item(Key={'circleId': circle_id})
            return response.get('Item')
        except Exception as e:
            logger.error(f"Failed to get circle by ID {circle_id}: {str(e)}")
            return None
    
    def get_circle_by_invite_code(self, invite_code: str) -> Optional[dict]:
        """Get circle by invite code"""
        try:
            response = self.circles_table.query(
                IndexName='inviteCode-index',
                KeyConditionExpression=Key('inviteCode').eq(invite_code)
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except Exception as e:
            logger.error(f"Failed to query invite code {invite_code}: {str(e)}")
            return None
    
    def get_user_circles(self, user_id: str) -> List[dict]:
        """Get all circles user has joined (optimized with batch get)"""
        try:
            response = self.circle_members_table.query(
                IndexName='userId-joinedAt-index',
                KeyConditionExpression=Key('userId').eq(user_id)
            )
            
            member_records = response.get('Items', [])
            if not member_records:
                return []
            
            # Batch get circle details to avoid N+1 queries
            circle_ids = [record['circleId'] for record in member_records]
            
            # DynamoDB BatchGetItem (max 100 items per request)
            keys = [{'circleId': cid} for cid in circle_ids]
            batch_response = self.dynamodb.batch_get_item(
                RequestItems={
                    self.circles_table.name: {
                        'Keys': keys
                    }
                }
            )
            
            # Build circle dict for O(1) lookup
            circles_dict = {
                circle['circleId']: circle 
                for circle in batch_response.get('Responses', {}).get(self.circles_table.name, [])
            }
            
            # Merge member info with circle info
            circles = []
            for record in member_records:
                circle = circles_dict.get(record['circleId'])
                if circle:
                    circle['role'] = record['role']
                    circle['joinedAt'] = record['joinedAt']
                    circles.append(circle)
            
            # Sort by join time (newest first)
            circles.sort(key=lambda x: x['joinedAt'], reverse=True)
            return circles
        except Exception as e:
            logger.error(f"Failed to get user circles for {user_id}: {str(e)}")
            return []
    
    def update_circle_member_count(self, circle_id: str, delta: int):
        """Update circle member count"""
        try:
            self.circles_table.update_item(
                Key={'circleId': circle_id},
                UpdateExpression='SET memberCount = memberCount + :delta, updatedAt = :now',
                ExpressionAttributeValues={
                    ':delta': delta,
                    ':now': datetime.now(timezone.utc).isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Failed to update member count for circle {circle_id}: {str(e)}")
    
    def count_user_owned_circles(self, user_id: str) -> int:
        """Count circles owned by user"""
        try:
            response = self.circles_table.query(
                IndexName='userId-createdAt-index',
                KeyConditionExpression=Key('userId').eq(user_id),
                Select='COUNT'
            )
            return response['Count']
        except Exception as e:
            logger.error(f"Failed to count circles for user {user_id}: {str(e)}")
            return 0
    
    # ====================================================================
    # 圈子成员管理
    # ====================================================================
    
    def add_circle_member(self, circle_id: str, user_id: str,
                         user_name: str = "", user_avatar: str = "",
                         role: str = 'member') -> dict:
        """Add circle member"""
        joined_at = datetime.now(timezone.utc).isoformat()
        
        item = {
            'circleId': circle_id,
            'userId': user_id,
            'userName': user_name,
            'userAvatar': user_avatar,
            'role': role,
            'joinedAt': joined_at,
            'pushEnabled': True  # 默认开启推送
        }
        
        try:
            self.circle_members_table.put_item(Item=item)
            # 只有非owner才更新计数（owner在创建时已计数）
            if role != 'owner':
                self.update_circle_member_count(circle_id, 1)
            return item
        except Exception as e:
            logger.error(f"Failed to add circle member: {str(e)}", exc_info=True)
            raise
    
    def remove_circle_member(self, circle_id: str, user_id: str):
        """Remove circle member and cleanup their shares"""
        try:
            # Delete member record
            self.circle_members_table.delete_item(
                Key={
                    'circleId': circle_id,
                    'userId': user_id
                }
            )
            # Update member count
            self.update_circle_member_count(circle_id, -1)
            # Cleanup user's shares in this circle
            self.cleanup_user_shares_in_circle(user_id, circle_id)
        except Exception as e:
            logger.error(f"Failed to remove circle member: {str(e)}", exc_info=True)
            raise
    
    def get_circle_members(self, circle_id: str) -> List[dict]:
        """Get all members of a circle"""
        try:
            response = self.circle_members_table.query(
                KeyConditionExpression=Key('circleId').eq(circle_id)
            )
            members = response.get('Items', [])
            # Owner listed first
            members.sort(key=lambda x: (x['role'] != 'owner', x['joinedAt']))
            return members
        except Exception as e:
            logger.error(f"Failed to get circle members for {circle_id}: {str(e)}")
            return []
    
    def is_circle_member(self, circle_id: str, user_id: str) -> bool:
        """Check if user is a circle member"""
        try:
            response = self.circle_members_table.get_item(
                Key={
                    'circleId': circle_id,
                    'userId': user_id
                }
            )
            return 'Item' in response
        except Exception as e:
            logger.error(f"Failed to check membership: {str(e)}")
            return False
    
    def get_member_role(self, circle_id: str, user_id: str) -> Optional[str]:
        """Get member role"""
        try:
            response = self.circle_members_table.get_item(
                Key={
                    'circleId': circle_id,
                    'userId': user_id
                }
            )
            item = response.get('Item')
            return item['role'] if item else None
        except Exception as e:
            logger.error(f"Failed to get member role: {str(e)}")
            return None
    
    # ====================================================================
    # 日记分享管理
    # ====================================================================
    
    def share_diary_to_circle(self, diary_id: str, circle_id: str, user_id: str,
                             diary_data: dict) -> dict:
        """分享日记到圈子（包含冗余字段优化）"""
        share_id = str(uuid.uuid4())
        shared_at = datetime.now(timezone.utc).isoformat()
        
        # 冗余字段：提升动态流查询性能
        item = {
            'shareId': share_id,
            'diaryId': diary_id,
            'circleId': circle_id,
            'userId': user_id,
            'sharedAt': shared_at,
            # 冗余字段（减少JOIN查询）
            'userName': diary_data.get('user_name', ''),
            'userAvatar': diary_data.get('user_avatar', ''),
            'diaryTitle': diary_data.get('title', '日记'),
            'diaryPreview': (diary_data.get('polished_content', '') or '')[:200],
            'emotion': diary_data.get('emotion_data', {}).get('dominant_emotion', ''),
            'imageUrls': diary_data.get('image_urls', []),
            'hasAudio': bool(diary_data.get('audio_url')),
            'diaryCreatedAt': diary_data.get('created_at', '')
        }
        
        # 转换 float 为 Decimal
        item = self._convert_to_decimal(item)
        
        try:
            self.diary_shares_table.put_item(Item=item)
            return item
        except Exception as e:
            logger.error(f"Failed to share diary: {str(e)}", exc_info=True)
            raise
    
    def unshare_diary_from_circle(self, diary_id: str, circle_id: str):
        """Unshare diary from circle"""
        try:
            # Query shareId
            response = self.diary_shares_table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id),
                FilterExpression=Attr('circleId').eq(circle_id)
            )
            
            items = response.get('Items', [])
            for item in items:
                self.diary_shares_table.delete_item(
                    Key={'shareId': item['shareId']}
                )
        except Exception as e:
            logger.error(f"Failed to unshare diary: {str(e)}", exc_info=True)
            raise
    
    def get_diary_shares(self, diary_id: str) -> List[dict]:
        """Get diary share status"""
        try:
            response = self.diary_shares_table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id)
            )
            return response.get('Items', [])
        except Exception as e:
            logger.error(f"Failed to get diary shares: {str(e)}")
            return []
    
    def get_circle_feed(self, circle_id: str, limit: int = 20,
                       last_key: Optional[dict] = None) -> dict:
        """Get circle feed (optimized with denormalized fields)"""
        try:
            query_params = {
                'IndexName': 'circleId-sharedAt-index',
                'KeyConditionExpression': Key('circleId').eq(circle_id),
                'ScanIndexForward': False,  # 倒序（最新的在前）
                'Limit': limit
            }
            
            if last_key:
                query_params['ExclusiveStartKey'] = last_key
            
            response = self.diary_shares_table.query(**query_params)
            
            return {
                'items': response.get('Items', []),
                'last_key': response.get('LastEvaluatedKey')
            }
        except Exception as e:
            logger.error(f"Failed to get circle feed: {str(e)}")
            return {'items': [], 'last_key': None}
    
    def is_diary_shared_to_circle(self, diary_id: str, circle_id: str) -> bool:
        """Check if diary is already shared to circle (prevent duplicates)"""
        try:
            response = self.diary_shares_table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id),
                FilterExpression=Attr('circleId').eq(circle_id)
            )
            return len(response.get('Items', [])) > 0
        except Exception as e:
            logger.error(f"Failed to check share status: {str(e)}")
            return False
    
    def cleanup_user_shares_in_circle(self, user_id: str, circle_id: str):
        """Cleanup user's shares in circle (called when leaving circle)"""
        try:
            # Query all shares from this user in this circle
            response = self.diary_shares_table.query(
                IndexName='circleId-sharedAt-index',
                KeyConditionExpression=Key('circleId').eq(circle_id),
                FilterExpression=Attr('userId').eq(user_id)
            )
            
            items = response.get('Items', [])
            for item in items:
                self.diary_shares_table.delete_item(
                    Key={'shareId': item['shareId']}
                )
            
            logger.info(f"Cleaned up {len(items)} share records for user {user_id} in circle {circle_id}")
        except Exception as e:
            logger.error(f"Failed to cleanup shares: {str(e)}")
    
    def cleanup_diary_shares(self, diary_id: str):
        """Cleanup all shares of a diary (called when deleting diary)"""
        try:
            shares = self.get_diary_shares(diary_id)
            for share in shares:
                self.diary_shares_table.delete_item(
                    Key={'shareId': share['shareId']}
                )
            logger.info(f"Cleaned up {len(shares)} share records for diary {diary_id}")
        except Exception as e:
            logger.error(f"Failed to cleanup diary shares: {str(e)}")
