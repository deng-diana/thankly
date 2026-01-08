import sys
import os
import boto3
import json
import asyncio
from typing import List, Dict, Optional
from datetime import datetime
from decimal import Decimal

# 添加父目录到 path 以便导入 app 模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.openai_service import OpenAIService
from app.config import get_settings

# ================= 配置 =================
BATCH_SIZE = 10             # 每次处理多少条
LIMIT = 1000                # 总共处理多少条 (安全起见)
DRY_RUN = False             # True: 只打印不保存; False: 实际写入数据库
TABLE_NAME = "GratitudeDiaries" # 您的表名
REGION = "us-east-1"        # 您的区域
# =======================================

def convert_floats_to_decimals(obj):
    """递归将 float 转换为 Decimal"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimals(i) for i in obj]
    return obj

async def process_batch(items: List[Dict], table, openai_service: OpenAIService):
    """处理一批日记"""
    for item in items:
        diary_id = item.get('diaryId')
        content = item.get('originalContent', '')
        # 如果有 polish content 优先用，没有就用 original
        text_to_analyze = item.get('originalContent') or item.get('polishedContent')
        
        if not text_to_analyze:
            print(f"⚠️ Skipping {diary_id}: No content found")
            continue
            
        print(f"🔍 Analyzing Diary {diary_id[:8]}... (Lang: {item.get('language', 'unknown')})")
        
        try:
            # 1. 调用 AI 获取情绪
            # 这里的 _call_gpt4o_mini_for_feedback 已经被我们改造为返回 Dict 了
            # 我们不需要 User Name，传入 "" 即可
            # 我们复用 feedback 生成的接口，因为它现在包含了 Emotion Analysis
            ai_result = await openai_service._call_gpt4o_mini_for_feedback(
                text=text_to_analyze,
                language=item.get('language', 'zh'), # 默认中文
                user_name=""
            )
            
            emotion_data_raw = {
                "emotion": ai_result.get("emotion", "Reflective"),
                "confidence": ai_result.get("confidence", 0.0),
                "rationale": ai_result.get("rationale", ""),
                "source": "backfill_script",
                "meta": {
                    "text": ai_result
                }
            }
            emotion_data = convert_floats_to_decimals(emotion_data_raw)
            
            print(f"   >>> Result: [{emotion_data['emotion']}] {emotion_data['rationale']}")
            
            # 2. 更新数据库
            if not DRY_RUN:
                table.update_item(
                    Key={
                        'userId': item['userId'],
                        'createdAt': item['createdAt']
                    },
                    UpdateExpression="set emotionData = :e",
                    ExpressionAttributeValues={
                        ':e': emotion_data
                    }
                )
                print(f"   ✅ Saved to DB")
            else:
                print(f"   🚫 Dry Run: Not saved")
                
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            
async def main():
    print("🚀 Starting Emotion Debugger...")
    settings = get_settings()
    dynamodb = boto3.resource('dynamodb', region_name=settings.aws_region)
    table = dynamodb.Table(settings.dynamodb_table_name)
    
    print(f"📦 Scanning table: {settings.dynamodb_table_name}")
    response = table.scan(
        FilterExpression="contains(title, :t) AND itemType = :type",
        ExpressionAttributeValues={":t": "35", ":type": "diary"}
    )
    items = response.get('Items', [])
    print(f"Found {len(items)} diaries matching '35'. checking content...")
    for item in items:
        title = item.get('title', 'No Title')
        diary_id = item.get('diaryId')
        has_emotion = 'emotionData' in item
        emotion_val = item.get('emotionData')
        print(f"  - Title: {title} (ID: {diary_id})")
        print(f"    Has emotionData: {has_emotion}")
        print(f"    Value: {emotion_val}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(main())
