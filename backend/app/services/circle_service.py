"""
亲密圈功能 - 数据库服务层
Circle Feature - Database Service Layer
"""

import boto3
from boto3.dynamodb.conditions import Key, Attr
from typing import List, Optional, Dict, Any
from ..config import get_settings, get_boto3_kwargs
import uuid
from datetime import datetime, timezone
from decimal import Decimal


class CircleDBService:
    """圈子功能数据库服务"""
    
    def __init__(self):
        try:
            settings = get_settings()
            self.dynamodb = boto3.resource("dynamodb", **get_boto3_kwargs(settings))
            
            # 表名配置
            env_suffix = '-prod' if settings.environment == 'production' else '-dev'
            self.circles_table = self.dynamodb.Table(f'thankly-circles{env_suffix}')
            self.circle_members_table = self.dynamodb.Table(f'thankly-circle-members{env_suffix}')
            self.diary_shares_table = self.dynamodb.Table(f'thankly-diary-shares{env_suffix}')
            
            print(f"✅ CircleDBService 初始化成功")
        except Exception as e:
            print(f"❌ CircleDBService 初始化失败: {str(e)}")
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
    
    def create_circle(self, user_id: str, circle_name: str, invite_code: str) -> dict:
        """创建圈子"""
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
            # 同时添加创建者为成员
            self.add_circle_member(
                circle_id=circle_id,
                user_id=user_id,
                user_name="创建者",
                role='owner'
            )
            return item
        except Exception as e:
            print(f"❌ 创建圈子失败: {str(e)}")
            raise
    
    def get_circle_by_id(self, circle_id: str) -> Optional[dict]:
        """通过ID查询圈子"""
        try:
            response = self.circles_table.get_item(Key={'circleId': circle_id})
            return response.get('Item')
        except Exception as e:
            print(f"❌ 查询圈子失败: {str(e)}")
            return None
    
    def get_circle_by_invite_code(self, invite_code: str) -> Optional[dict]:
        """通过邀请码查询圈子"""
        try:
            response = self.circles_table.query(
                IndexName='inviteCode-index',
                KeyConditionExpression=Key('inviteCode').eq(invite_code)
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except Exception as e:
            print(f"❌ 查询邀请码失败: {str(e)}")
            return None
    
    def get_user_circles(self, user_id: str) -> List[dict]:
        """获取用户加入的所有圈子"""
        try:
            response = self.circle_members_table.query(
                IndexName='userId-joinedAt-index',
                KeyConditionExpression=Key('userId').eq(user_id)
            )
            
            member_records = response.get('Items', [])
            circles = []
            
            # 查询每个圈子的详细信息
            for record in member_records:
                circle = self.circles_table.get_item(
                    Key={'circleId': record['circleId']}
                ).get('Item')
                
                if circle:
                    circle['role'] = record['role']
                    circle['joinedAt'] = record['joinedAt']
                    circles.append(circle)
            
            # 按加入时间倒序排列
            circles.sort(key=lambda x: x['joinedAt'], reverse=True)
            return circles
        except Exception as e:
            print(f"❌ 查询用户圈子失败: {str(e)}")
            return []
    
    def update_circle_member_count(self, circle_id: str, delta: int):
        """更新圈子成员数量"""
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
            print(f"❌ 更新成员数量失败: {str(e)}")
    
    def count_user_owned_circles(self, user_id: str) -> int:
        """统计用户创建的圈子数量"""
        try:
            response = self.circles_table.query(
                IndexName='userId-createdAt-index',
                KeyConditionExpression=Key('userId').eq(user_id),
                Select='COUNT'
            )
            return response['Count']
        except Exception as e:
            print(f"❌ 统计圈子数量失败: {str(e)}")
            return 0
    
    # ====================================================================
    # 圈子成员管理
    # ====================================================================
    
    def add_circle_member(self, circle_id: str, user_id: str,
                         user_name: str = "", user_avatar: str = "",
                         role: str = 'member') -> dict:
        """添加圈子成员"""
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
            print(f"❌ 添加圈子成员失败: {str(e)}")
            raise
    
    def remove_circle_member(self, circle_id: str, user_id: str):
        """移除圈子成员（并清理其分享的日记）"""
        try:
            # 删除成员记录
            self.circle_members_table.delete_item(
                Key={
                    'circleId': circle_id,
                    'userId': user_id
                }
            )
            # 更新成员数量
            self.update_circle_member_count(circle_id, -1)
            # 清理该用户在此圈子的分享记录
            self.cleanup_user_shares_in_circle(user_id, circle_id)
        except Exception as e:
            print(f"❌ 移除圈子成员失败: {str(e)}")
            raise
    
    def get_circle_members(self, circle_id: str) -> List[dict]:
        """获取圈子所有成员"""
        try:
            response = self.circle_members_table.query(
                KeyConditionExpression=Key('circleId').eq(circle_id)
            )
            members = response.get('Items', [])
            # owner 排在最前面
            members.sort(key=lambda x: (x['role'] != 'owner', x['joinedAt']))
            return members
        except Exception as e:
            print(f"❌ 查询圈子成员失败: {str(e)}")
            return []
    
    def is_circle_member(self, circle_id: str, user_id: str) -> bool:
        """检查用户是否为圈子成员"""
        try:
            response = self.circle_members_table.get_item(
                Key={
                    'circleId': circle_id,
                    'userId': user_id
                }
            )
            return 'Item' in response
        except Exception as e:
            print(f"❌ 检查成员身份失败: {str(e)}")
            return False
    
    def get_member_role(self, circle_id: str, user_id: str) -> Optional[str]:
        """获取成员角色"""
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
            print(f"❌ 查询成员角色失败: {str(e)}")
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
            print(f"❌ 分享日记失败: {str(e)}")
            raise
    
    def unshare_diary_from_circle(self, diary_id: str, circle_id: str):
        """取消日记分享"""
        try:
            # 查询 shareId
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
            print(f"❌ 取消分享失败: {str(e)}")
            raise
    
    def get_diary_shares(self, diary_id: str) -> List[dict]:
        """查询日记分享到哪些圈子"""
        try:
            response = self.diary_shares_table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id)
            )
            return response.get('Items', [])
        except Exception as e:
            print(f"❌ 查询日记分享状态失败: {str(e)}")
            return []
    
    def get_circle_feed(self, circle_id: str, limit: int = 20,
                       last_key: Optional[dict] = None) -> dict:
        """获取圈子动态流（已优化，使用冗余字段）"""
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
            print(f"❌ 查询圈子动态失败: {str(e)}")
            return {'items': [], 'last_key': None}
    
    def is_diary_shared_to_circle(self, diary_id: str, circle_id: str) -> bool:
        """检查日记是否已分享到指定圈子（防止重复分享）"""
        try:
            response = self.diary_shares_table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id),
                FilterExpression=Attr('circleId').eq(circle_id)
            )
            return len(response.get('Items', [])) > 0
        except Exception as e:
            print(f"❌ 检查分享状态失败: {str(e)}")
            return False
    
    def cleanup_user_shares_in_circle(self, user_id: str, circle_id: str):
        """清理用户在特定圈子的所有分享（退出圈子时调用）"""
        try:
            # 查询该用户在此圈子的所有分享
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
            
            print(f"✅ 清理了 {len(items)} 条分享记录")
        except Exception as e:
            print(f"❌ 清理分享记录失败: {str(e)}")
    
    def cleanup_diary_shares(self, diary_id: str):
        """清理日记的所有分享记录（删除日记时调用）"""
        try:
            shares = self.get_diary_shares(diary_id)
            for share in shares:
                self.diary_shares_table.delete_item(
                    Key={'shareId': share['shareId']}
                )
            print(f"✅ 清理了 {len(shares)} 条分享记录")
        except Exception as e:
            print(f"❌ 清理日记分享失败: {str(e)}")
