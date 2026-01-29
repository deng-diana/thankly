"""
限流服务 - Rate Limiter Service
使用 DynamoDB 实现（未来可迁移到 Redis）
"""

import boto3
from datetime import datetime, timezone, timedelta
from typing import Optional
from ..config import get_settings, get_boto3_kwargs


class RateLimiter:
    """
    限流器（基于 DynamoDB TTL）
    用途：
    1. 邀请码尝试次数限制（10次/天/用户）
    2. 推送通知频率限制（3条/天/圈子）
    """
    
    def __init__(self):
        try:
            settings = get_settings()
            self.dynamodb = boto3.resource("dynamodb", **get_boto3_kwargs(settings))
            
            # 使用现有的 diaries 表（复用，添加 itemType='RATE_LIMIT'）
            self.table = self.dynamodb.Table(settings.dynamodb_table_name)
            
            print(f"✅ RateLimiter 初始化成功")
        except Exception as e:
            print(f"❌ RateLimiter 初始化失败: {str(e)}")
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
            print(f"❌ 检查邀请码尝试次数失败: {str(e)}")
            # 失败时允许尝试（降级策略）
            return {'allowed': True, 'remaining': max_attempts, 'retry_after': 0}
    
    def record_invite_attempt(self, user_id: str, success: bool = False):
        """
        记录邀请码尝试
        
        Args:
            user_id: 用户ID
            success: 是否成功（成功则不计数）
        """
        if success:
            # 成功加入，清空计数
            key = self._get_today_key('INVITE_ATTEMPT', user_id)
            try:
                self.table.delete_item(
                    Key={
                        'userId': user_id,
                        'createdAt': key
                    }
                )
            except:
                pass
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
            print(f"❌ 记录邀请码尝试失败: {str(e)}")
    
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
            print(f"❌ 检查推送限制失败: {str(e)}")
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
            print(f"❌ 记录推送失败: {str(e)}")
    
    # ====================================================================
    # 推送静音时段检查
    # ====================================================================
    
    @staticmethod
    def is_quiet_hours() -> bool:
        """
        检查是否在静音时段（22:00 - 08:00 UTC+8）
        
        Returns:
            是否在静音时段
        """
        now = datetime.now(timezone.utc)
        # 转换为UTC+8（中国时区）
        china_time = now + timedelta(hours=8)
        hour = china_time.hour
        
        # 22:00 到次日 08:00
        return hour >= 22 or hour < 8


# 使用示例
if __name__ == '__main__':
    limiter = RateLimiter()
    
    # 测试邀请码限制
    user_id = "test_user_123"
    
    print("测试邀请码尝试限制:")
    for i in range(12):
        result = limiter.check_invite_attempts(user_id)
        print(f"尝试 {i+1}: {result}")
        
        if result['allowed']:
            limiter.record_invite_attempt(user_id, success=False)
        else:
            print(f"⛔ 已达限制，需等待 {result['retry_after']} 秒")
            break
    
    # 测试静音时段
    print(f"\n当前是否静音时段: {RateLimiter.is_quiet_hours()}")
