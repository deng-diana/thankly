import boto3
from boto3.dynamodb.conditions import Key, Attr
from typing import List, Optional, Any
from ..config import get_settings, get_boto3_kwargs
import uuid
from decimal import Decimal
from datetime import datetime, timezone


class DynamoDBService:
    """DynamoDB数据库服务"""
    def __init__(self):
        try:
            settings=get_settings()
            print(f"🔍 DynamoDB初始化 - 区域: {settings.aws_region}, 表名: {settings.dynamodb_table_name}")
            
            # 创建DynamoDB客户端
            # 在Lambda环境中，boto3会自动使用IAM角色凭证
            # 使用默认凭证链（IAM角色、环境变量等）
            self.dynamodb = boto3.resource("dynamodb", **get_boto3_kwargs(settings))
            # 获取表
            self.table=self.dynamodb.Table(settings.dynamodb_table_name)
            
            # 验证表是否存在（延迟加载，不实际访问）
            print(f"✅ DynamoDB客户端初始化成功")
        except Exception as e:
            print(f"❌ DynamoDB初始化失败: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    def _convert_to_decimal(self, obj: Any) -> Any:
        """递归将 float 转换为 Decimal (DynamoDB 不支持 float)"""
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._convert_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_decimal(i) for i in obj]
        return obj

    def create_diary(
        self, 
        user_id:str,
        original_content:str,
        polished_content:str,
        ai_feedback:str,
        language: str = "zh",                 # ← 新增：语言
        title: str = "日记",                  # ← 新增：标题
        audio_url: Optional[str] = None,      # ← 新增
        audio_duration: Optional[int] = None,  # ← 新增
        image_urls: Optional[List[str]] = None,  # ← 添加这行
        emotion_data: Optional[dict] = None   # ✅ 新增：情感数据
    ) -> dict:
        """ 创建日记
        
        参数:
            user_id: 用户ID
            original_content: 原始内容
            polished_content: 润色后内容
            ai_feedback: AI反馈
        
        返回:
            创建的日记对象 """
        # 生成唯一ID和时间戳
        diary_id=str(uuid.uuid4())
        create_at=datetime.now(timezone.utc).isoformat()
        date=datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # 构造要保存的数据
        item={
            'diaryId': diary_id,
            'userId':user_id,
            'createdAt':create_at,
            'date':date,
            'itemType': 'diary',
            'language': language,              # ← 新增：语言
            'title': title,                   # ← 新增：标题
            'originalContent':original_content,
            'polishedContent': polished_content,
            'aiFeedback': ai_feedback
        }
         #✅ 如果有音频信息，添加到item
        if audio_url:
            item['audioUrl'] = audio_url
        if audio_duration:
            item['audioDuration'] = audio_duration
         # ✅ 如果有图片，添加到item
        if image_urls:
            item['imageUrls'] = image_urls
        # ✅ 如果有情感数据，添加到item (需转换 float -> Decimal)
        if emotion_data:
            item['emotionData'] = self._convert_to_decimal(emotion_data)
        # 保存到DynamoDB
        try:
            self.table.put_item(Item=item)
            # 返回给前端的格式(转成下划线命名)
            return{ 
                'diary_id': diary_id,
                'user_id': user_id,
                'created_at': create_at,
                'date': date,
                'language': language,              # ← 新增：语言
                'title': title,                   # ← 新增：标题
                'original_content': original_content,
                'polished_content': polished_content,
                'ai_feedback': ai_feedback,
                'audio_url':audio_url,
                'audio_duration':audio_duration,
                'image_urls': image_urls if image_urls else [],
                'emotion_data': emotion_data
            }
        except Exception as e:
            print(f"保存日记失败:{str(e)}")
            raise
    def get_user_diaries(
        self,
        user_id: str
    ) -> List[dict]:
        """
        获取用户的所有日记列表（无数量限制）
        
        参数:
            user_id: 用户ID
        
        返回:
            所有日记列表
        """
        try:
            print(f"🔍 DynamoDB查询 - 表名: {self.table.table_name}, 用户ID: {user_id}, 查询所有日记")
            
            # 验证用户ID
            if not user_id or not user_id.strip():
                raise ValueError("用户ID不能为空")
            
            # 查询该用户的所有日记（使用分页循环）
            diaries = []
            last_evaluated_key = None
            
            while True:
                # 构建查询参数
                query_params = {
                    'KeyConditionExpression': Key('userId').eq(user_id),
                    'ScanIndexForward': False  # 倒序排列(最新的在前)
                }
                
                # 如果有分页键,添加到查询参数
                if last_evaluated_key:
                    query_params['ExclusiveStartKey'] = last_evaluated_key
                
                # 执行查询
                response = self.table.query(**query_params)
                
                # 处理当前批次的数据
                items = response.get('Items', [])
                print(f"📊 DynamoDB响应 - 当前批次返回: {len(items)} 条")
                
                for item in items:
                    item_type = item.get('itemType', 'diary').lower()
                    if item_type != 'diary':
                        continue

                    diary_id = item.get('diaryId')
                    if not diary_id or str(diary_id).lower() == 'unknown':
                        # ⚠️ 非日记数据或历史异常数据（无有效 diaryId），直接跳过
                        print(f"⚠️ 跳过无效日记记录: {item.get('diaryId')} {item.get('itemType')}")
                        continue

                    if 'originalContent' not in item and 'polishedContent' not in item:
                        continue

                    diaries.append({
                        'diary_id': diary_id,
                        'user_id': item.get('userId', ''),
                        'created_at': item.get('createdAt', ''),
                        'date': item.get('date', ''),
                        'language': item.get('language', 'zh'),
                        'title': item.get('title', '日记'),
                        'original_content': item.get('originalContent', ''),
                        'polished_content': item.get('polishedContent', ''),
                        'ai_feedback': item.get('aiFeedback', ''),
                        'audio_url': item.get('audioUrl'),
                        'audio_duration': item.get('audioDuration'),
                        'image_urls': item.get('imageUrls'),
                        'emotion_data': item.get('emotionData')
                    })
                
                # 检查是否还有更多数据
                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    # 没有更多数据了,退出循环
                    break
                
                print(f"📄 继续查询下一页...")
            
            print(f"✅ DynamoDB查询成功 - 总共获取: {len(diaries)} 条日记")
            return diaries
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ 获取日记列表失败:")
            print(f"   错误类型: {type(e).__name__}")
            print(f"   错误信息: {str(e)}")
            print(f"   错误堆栈:\n{error_trace}")
            raise
    
    def get_diary_by_id(
        self,
        diary_id: str,
        user_id: str
    ) -> Optional[dict]:
        """
        根据diary_id获取单条日记
        
        参数:
            diary_id: 日记ID
            user_id: 用户ID
        
        返回:
            日记对象或None
        """
        try:
            # 使用scan查询，因为diary_id不是主键
            response = self.table.scan(
                FilterExpression=Attr('diaryId').eq(diary_id) & Attr('userId').eq(user_id)
            )
            
            items = response.get('Items', [])
            if not items:
                return None
            
            item = items[0]  # 取第一个匹配的项
            
            return {
                'diary_id': item.get('diaryId', 'unknown'),
                'user_id': item.get('userId', ''),
                'created_at': item.get('createdAt', ''),
                'date': item.get('date', ''),
                'language': item.get('language', 'zh'),      # ← 新增：语言
                'title': item.get('title', '日记'),           # ← 新增：标题
                'original_content': item.get('originalContent', ''),
                'polished_content': item.get('polishedContent', ''),
                'ai_feedback': item.get('aiFeedback', ''),
                'audio_url': item.get('audioUrl'),
                'audio_duration': item.get('audioDuration'),
                'image_urls': item.get('imageUrls'),
                'emotion_data': item.get('emotionData') # ✅ 获取情感数据
            }
            
        except Exception as e:
            print(f"获取日记失败: {str(e)}")
            raise

    def update_diary(
        self,
        diary_id: str,
        user_id: str,
        polished_content: str = None,
        title: str = None,
        image_urls: List[str] = None  # ✅ 新增：图片URL列表
    ) -> dict:
        """
        更新日记内容和/或标题和/或图片列表
        
        参数:
            diary_id: 日记ID
            user_id: 用户ID
            polished_content: 新的润色内容（可选）
            title: 新的标题（可选）
            image_urls: 新的图片URL列表（可选）
        
        返回:
            更新后的日记对象
        """
        try:
            # 使用 GSI 通过 diaryId 直接查询
            response = self.table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id)
            )
            
            items = response.get('Items', [])
            if not items:
                raise ValueError(f"找不到日记ID: {diary_id}")
            
            # 获取日记信息
            diary_item = items[0]
            created_at = diary_item.get('createdAt')
            
            # 验证权限：确保用户只能更新自己的日记
            if diary_item.get('userId') != user_id:
                raise PermissionError("无权修改此日记")
            
            print(f"🔍 找到日记 - ID: {diary_id}, 用户: {user_id}, 创建时间: {created_at}")
            
            # 构建动态更新表达式
            update_expressions = []
            expression_values = {}
            
            if polished_content is not None:
                update_expressions.append('polishedContent = :pc')
                expression_values[':pc'] = polished_content
                print(f"📝 将更新内容: {polished_content[:50]}...")
            
            if title is not None:
                update_expressions.append('title = :t')
                expression_values[':t'] = title
                print(f"📝 将更新标题: {title}")
            
            if image_urls is not None:
                update_expressions.append('imageUrls = :iu')
                expression_values[':iu'] = image_urls
                print(f"📝 将更新图片数量: {len(image_urls)}")
            
            if not update_expressions:
                raise ValueError("至少需要提供 polished_content, title 或 image_urls 之一")
            
            # 更新日记
            response = self.table.update_item(
                Key={
                    'userId': user_id,
                    'createdAt': created_at
                },
                UpdateExpression=f"SET {', '.join(update_expressions)}",
                ExpressionAttributeValues=expression_values,
                ReturnValues='ALL_NEW'
            )
            
            print(f"✅ DynamoDB更新成功")
            
            # 获取更新后的数据
            updated_item = response.get('Attributes', {})
            
            # 返回更新后的数据
            return {
                'diary_id': diary_id,
                'user_id': user_id,
                'created_at': created_at,
                'date': updated_item.get('date', diary_item.get('date', '')),
                'language': updated_item.get('language', diary_item.get('language', 'zh')),
                'title': updated_item.get('title', diary_item.get('title', '日记')),
                'original_content': updated_item.get('originalContent', diary_item.get('originalContent', '')),
                'polished_content': updated_item.get('polishedContent', diary_item.get('polishedContent', '')),
                'ai_feedback': updated_item.get('aiFeedback', diary_item.get('aiFeedback', '')),
                'audio_url': updated_item.get('audioUrl', diary_item.get('audioUrl')),
                'audio_duration': updated_item.get('audioDuration', diary_item.get('audioDuration')),
                'image_urls': updated_item.get('imageUrls', diary_item.get('imageUrls')),  # ✅ 返回更新后的图片列表
                'emotion_data': updated_item.get('emotionData', diary_item.get('emotionData'))  # ✅ 添加情感数据
            }
            
        except Exception as e:
            print(f"更新日记失败: {str(e)}")
            raise

    def delete_diary(
        self,
        diary_id: str,
        user_id: str
    ):
        """
        删除日记
        
        参数:
            diary_id: 日记ID
            user_id: 用户ID
        """
        try:
            # 使用 GSI 通过 diaryId 直接查询
            response = self.table.query(
                IndexName='diaryId-index',
                KeyConditionExpression=Key('diaryId').eq(diary_id)
            )
            
            items = response.get('Items', [])
            if not items:
                raise ValueError(f"找不到日记ID: {diary_id}")
            
            # 获取日记信息
            diary_item = items[0]
            created_at = diary_item.get('createdAt')
            
            # 验证权限：确保用户只能删除自己的日记
            if diary_item.get('userId') != user_id:
                raise PermissionError("无权删除此日记")
            
            # 删除日记
            self.table.delete_item(
                Key={
                    'userId': user_id,
                    'createdAt': created_at
                }
            )
            
        except Exception as e:
            print(f"删除日记失败: {str(e)}")
            raise

    def upsert_user_profile(self, user_id: str, name: str) -> None:
        """创建或更新用户资料"""
        try:
            profile_item = {
                'userId': user_id,
                'createdAt': 'PROFILE',
                'itemType': 'profile',
                'displayName': name,
                'updatedAt': datetime.now(timezone.utc).isoformat(),
            }
            self.table.put_item(Item=profile_item)
        except Exception as e:
            print(f"❌ 更新用户资料失败: {str(e)}")
            raise

    def delete_user_data(self, user_id: str) -> List[str]:
        """删除用户的所有日记并返回需要删除的音频URL列表"""
        audio_urls: List[str] = []
        try:
            last_evaluated_key = None
            while True:
                query_kwargs = {
                    'KeyConditionExpression': Key('userId').eq(user_id),
                    'ScanIndexForward': False,
                }

                if last_evaluated_key:
                    query_kwargs['ExclusiveStartKey'] = last_evaluated_key

                response = self.table.query(**query_kwargs)
                items = response.get('Items', [])

                if not items and not last_evaluated_key:
                    break

                for item in items:
                    created_at = item.get('createdAt')
                    if not created_at:
                        continue

                    audio_url = item.get('audioUrl')
                    if audio_url:
                        audio_urls.append(audio_url)

                    try:
                        self.table.delete_item(
                            Key={
                                'userId': user_id,
                                'createdAt': created_at
                            }
                        )
                    except Exception as delete_error:
                        print(f"❌ 删除日记失败 (userId={user_id}, createdAt={created_at}): {delete_error}")
                        raise

                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    break

        except Exception as e:
            print(f"❌ 删除用户日记失败: {str(e)}")
            raise

        return audio_urls

    def save_task_progress(self, task_id: str, task_data: dict, user_id: str = "TASK_SYSTEM") -> None:
        """
        保存异步任务进度到 DynamoDB
        """
        try:
            item = self._convert_to_decimal(task_data)
            
            # 使用用户 ID 作为 Partition Key
            item['userId'] = user_id
            item['createdAt'] = f"TASK#{task_id}"
            item['taskId'] = task_id
            item['itemType'] = 'task'
            
            import time
            item['ttl'] = int(time.time()) + 7200  # 2小时后过期
            
            self.table.put_item(Item=item)
        except Exception as e:
            print(f"❌ 保存任务进度失败: {str(e)}")

    def get_task_progress(self, task_id: str, user_id: str = "TASK_SYSTEM") -> Optional[dict]:
        """
        从 DynamoDB 获取任务进度
        """
        try:
            response = self.table.get_item(
                Key={
                    'userId': user_id,
                    'createdAt': f"TASK#{task_id}"
                }
            )
            return response.get('Item')
        except Exception as e:
            print(f"❌ 获取任务进度失败: {str(e)}")
            return None

    def delete_task_progress(self, task_id: str, user_id: str = "TASK_SYSTEM") -> None:
        """
        删除任务进度
        """
        try:
            self.table.delete_item(
                Key={
                    'userId': user_id,
                    'createdAt': f"TASK#{task_id}"
                }
            )
        except Exception as e:
            print(f"❌ 删除任务进度失败: {str(e)}")
