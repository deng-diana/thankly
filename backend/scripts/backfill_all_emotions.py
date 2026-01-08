#!/usr/bin/env python3
"""
批量为旧日记添加情绪标签的脚本

使用方法:
1. 确保已设置 AWS 凭证
2. 运行: python scripts/backfill_all_emotions.py
3. 默认是 DRY_RUN 模式,确认无误后设置 DRY_RUN=False
"""

import sys
import os
import boto3
import asyncio
from typing import List, Dict
from decimal import Decimal

# 添加父目录到 path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.openai_service import OpenAIService
from app.config import get_settings

# ================= 配置 =================
DRY_RUN = False             # True: 只打印不保存; False: 实际写入
BATCH_SIZE = 5              # 每批处理数量
MAX_ITEMS = 500             # 最多处理多少条(防止API费用过高)
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

async def process_diary(item: Dict, table, openai_service: OpenAIService) -> bool:
    """处理单条日记,返回是否成功"""
    diary_id = item.get('diaryId', 'unknown')
    title = item.get('title', 'No Title')
    
    # 检查是否已有emotion_data
    if 'emotionData' in item:
        print(f"  ⏭️  已有情绪数据,跳过: {title[:30]}")
        return False
    
    # 获取文本内容
    text_to_analyze = item.get('polishedContent') or item.get('originalContent')
    if not text_to_analyze or not text_to_analyze.strip():
        print(f"  ⚠️  无内容,跳过: {title[:30]}")
        return False
    
    print(f"  🔍 分析: {title[:40]}...")
    
    try:
        # 调用 AI 获取情绪
        ai_result = await openai_service._call_gpt4o_mini_for_feedback(
            text=text_to_analyze,
            language=item.get('language', 'zh'),
            user_name=""
        )
        
        emotion_data_raw = {
            "emotion": ai_result.get("emotion", "Reflective"),
            "confidence": ai_result.get("confidence", 0.0),
            "rationale": ai_result.get("rationale", ""),
            "source": "backfill_script"
        }
        emotion_data = convert_floats_to_decimals(emotion_data_raw)
        
        print(f"     ✨ 情绪: {emotion_data['emotion']} (置信度: {emotion_data['confidence']})")
        print(f"     💭 理由: {emotion_data['rationale'][:60]}...")
        
        # 更新数据库
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
            print(f"     ✅ 已保存到数据库")
        else:
            print(f"     🚫 DRY_RUN模式: 未保存")
        
        return True
        
    except Exception as e:
        print(f"     ❌ 失败: {e}")
        return False

async def main():
    print("=" * 60)
    print("🚀 批量添加情绪标签脚本")
    print("=" * 60)
    print(f"📋 配置:")
    print(f"   - DRY_RUN: {DRY_RUN} {'(只预览,不保存)' if DRY_RUN else '(实际写入数据库)'}")
    print(f"   - BATCH_SIZE: {BATCH_SIZE}")
    print(f"   - MAX_ITEMS: {MAX_ITEMS}")
    print("=" * 60)
    
    # 初始化服务
    settings = get_settings()
    dynamodb = boto3.resource('dynamodb', region_name=settings.aws_region)
    table = dynamodb.Table(settings.dynamodb_table_name)
    openai_service = OpenAIService()
    
    print(f"\n📦 扫描表: {settings.dynamodb_table_name}")
    
    # 扫描所有日记
    response = table.scan(
        FilterExpression="itemType = :type",
        ExpressionAttributeValues={":type": "diary"}
    )
    
    all_items = response.get('Items', [])
    print(f"✅ 找到 {len(all_items)} 条日记\n")
    
    # 限制处理数量
    items_to_process = all_items[:MAX_ITEMS]
    
    if len(all_items) > MAX_ITEMS:
        print(f"⚠️  为安全起见,只处理前 {MAX_ITEMS} 条\n")
    
    # 统计
    processed = 0
    skipped = 0
    failed = 0
    
    # 分批处理
    for i in range(0, len(items_to_process), BATCH_SIZE):
        batch = items_to_process[i:i + BATCH_SIZE]
        print(f"\n📦 处理批次 {i//BATCH_SIZE + 1} ({i+1}-{min(i+BATCH_SIZE, len(items_to_process))}/{len(items_to_process)})")
        print("-" * 60)
        
        for item in batch:
            result = await process_diary(item, table, openai_service)
            if result:
                processed += 1
            else:
                skipped += 1
        
        # 批次间稍作延迟,避免API限流
        if i + BATCH_SIZE < len(items_to_process):
            print("\n⏳ 等待2秒...")
            await asyncio.sleep(2)
    
    # 最终统计
    print("\n" + "=" * 60)
    print("📊 处理完成!")
    print("=" * 60)
    print(f"✅ 成功处理: {processed} 条")
    print(f"⏭️  跳过: {skipped} 条")
    print(f"❌ 失败: {failed} 条")
    print(f"📝 总计: {len(items_to_process)} 条")
    
    if DRY_RUN:
        print("\n⚠️  这是 DRY_RUN 模式,数据未实际保存!")
        print("💡 如需保存,请修改脚本中的 DRY_RUN = False")
    else:
        print("\n✅ 数据已保存到数据库")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
