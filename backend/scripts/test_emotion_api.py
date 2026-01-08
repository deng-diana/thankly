#!/usr/bin/env python3
"""
诊断脚本:测试日记API是否返回emotion_data

使用方法:
python scripts/test_emotion_api.py
"""

import requests
import json

# 测试配置
API_BASE = "http://localhost:8000"
# 你需要替换为真实的access token
ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"

def test_get_diaries():
    """测试获取日记列表"""
    print("=" * 60)
    print("测试: GET /diary/list")
    print("=" * 60)
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}"
    }
    
    response = requests.get(f"{API_BASE}/diary/list", headers=headers)
    
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        diaries = response.json()
        print(f"✅ 成功获取 {len(diaries)} 条日记")
        
        # 检查前3条日记的emotion_data
        for i, diary in enumerate(diaries[:3]):
            print(f"\n日记 {i+1}:")
            print(f"  ID: {diary.get('diary_id', 'N/A')[:8]}")
            print(f"  标题: {diary.get('title', 'N/A')}")
            print(f"  有emotion_data: {('emotion_data' in diary)}")
            if 'emotion_data' in diary:
                emotion = diary['emotion_data']
                print(f"  emotion_data: {emotion}")
            else:
                print(f"  ❌ 缺少emotion_data字段")
    else:
        print(f"❌ 请求失败: {response.text}")

if __name__ == "__main__":
    print("🔍 API诊断工具")
    print("\n⚠️ 请先在代码中设置ACCESS_TOKEN")
    print("可以从前端日志中复制token\n")
    
    if ACCESS_TOKEN == "YOUR_ACCESS_TOKEN_HERE":
        print("❌ 请先设置ACCESS_TOKEN!")
    else:
        test_get_diaries()
