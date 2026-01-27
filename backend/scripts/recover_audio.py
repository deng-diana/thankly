#!/usr/bin/env python3
"""
珍贵音频恢复脚本
================
用于手动触发已上传到 S3 的音频进行 AI 处理

使用方法:
1. 确保后端服务器正在运行
2. 从 App 中获取有效的 Access Token
3. 运行: python scripts/recover_audio.py

音频 URL: https://gratitude-journal-audio-diana-2025.s3.amazonaws.com/audio/e6a0f9df-recording.m4a
"""

import asyncio
import httpx
import time
import sys
import os

# ===== 配置 =====
AUDIO_URL = "https://gratitude-journal-audio-diana-2025.s3.amazonaws.com/audio/e6a0f9df-recording.m4a"
BACKEND_URL = "http://192.168.0.28:8000"  # 本地开发服务器
USER_NAME = "Boss"  # 用户偏好称呼
DURATION = 142  # 预估音频时长（秒）

# Access Token - 需要从 App 或前端控制台获取
# 在浏览器/App 中登录后，从 AsyncStorage 或控制台获取
ACCESS_TOKEN = os.environ.get("THANKLY_ACCESS_TOKEN", "")

async def get_token_from_file():
    """尝试从文件读取 token"""
    token_file = os.path.join(os.path.dirname(__file__), ".access_token")
    if os.path.exists(token_file):
        with open(token_file, "r") as f:
            return f.read().strip()
    return None

async def recover_audio():
    """恢复音频并创建日记"""
    
    # 获取 Token
    token = ACCESS_TOKEN
    if not token:
        token = await get_token_from_file()
    
    if not token:
        print("❌ 错误: 未提供 Access Token")
        print("\n📋 获取 Token 的方法:")
        print("   1. 在 iOS 模拟器中打开 App")
        print("   2. 打开 Safari 开发者工具 → 模拟器")
        print("   3. 在控制台执行:")
        print("      await AsyncStorage.getItem('@accessToken')")
        print("   4. 将获取的 token 设置为环境变量:")
        print("      export THANKLY_ACCESS_TOKEN='your_token_here'")
        print("   或者保存到文件:")
        print(f"      echo 'your_token_here' > {os.path.dirname(__file__)}/.access_token")
        return
    
    print("=" * 60)
    print("🎤 珍贵音频恢复工具")
    print("=" * 60)
    print(f"📍 音频 URL: {AUDIO_URL}")
    print(f"⏱️  预估时长: {DURATION}秒")
    print(f"👤 用户称呼: {USER_NAME}")
    print(f"🌐 后端地址: {BACKEND_URL}")
    print("=" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Name": USER_NAME,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: 创建任务
        print("\n📤 步骤 1: 创建语音日记任务...")
        
        try:
            response = await client.post(
                f"{BACKEND_URL}/diary/voice/async-with-url",
                headers=headers,
                json={
                    "audio_url": AUDIO_URL,
                    "duration": DURATION
                }
            )
            
            if response.status_code != 200:
                print(f"❌ 创建任务失败: {response.status_code}")
                print(f"   响应: {response.text}")
                return
            
            result = response.json()
            task_id = result.get("task_id")
            print(f"✅ 任务创建成功: {task_id}")
            
        except Exception as e:
            print(f"❌ 请求失败: {e}")
            return
        
        # Step 2: 轮询进度
        print("\n⏳ 步骤 2: 等待 AI 处理...")
        
        max_attempts = 120  # 最多等待 2 分钟
        attempt = 0
        last_progress = 0
        
        while attempt < max_attempts:
            try:
                progress_response = await client.get(
                    f"{BACKEND_URL}/diary/voice/progress/{task_id}",
                    headers=headers
                )
                
                if progress_response.status_code != 200:
                    print(f"⚠️ 获取进度失败: {progress_response.status_code}")
                    await asyncio.sleep(1)
                    attempt += 1
                    continue
                
                progress_data = progress_response.json()
                status = progress_data.get("status")
                progress = progress_data.get("progress", 0)
                step_name = progress_data.get("step_name", "")
                
                # 只在进度变化时打印
                if progress != last_progress:
                    print(f"   📊 {progress}% - {step_name}")
                    last_progress = progress
                
                if status == "completed":
                    diary_id = progress_data.get("diary_id")
                    print(f"\n✅ 处理完成!")
                    print(f"   📝 日记 ID: {diary_id}")
                    
                    # 获取日记详情
                    diary_response = await client.get(
                        f"{BACKEND_URL}/diary/{diary_id}",
                        headers=headers
                    )
                    
                    if diary_response.status_code == 200:
                        diary = diary_response.json()
                        print("\n" + "=" * 60)
                        print("📖 日记内容:")
                        print("=" * 60)
                        print(f"📌 标题: {diary.get('title', 'N/A')}")
                        print(f"😊 情绪: {diary.get('emotion', {}).get('emotion', 'N/A')}")
                        print(f"\n{diary.get('content', 'N/A')[:500]}...")
                        print(f"\n💬 AI反馈: {diary.get('ai_feedback', 'N/A')}")
                        print("=" * 60)
                    
                    return
                
                elif status == "failed":
                    error = progress_data.get("error", "Unknown error")
                    print(f"\n❌ 处理失败: {error}")
                    return
                
                await asyncio.sleep(1)
                attempt += 1
                
            except Exception as e:
                print(f"⚠️ 轮询出错: {e}")
                await asyncio.sleep(1)
                attempt += 1
        
        print("\n⚠️ 超时: 处理时间过长，请检查后端日志")

if __name__ == "__main__":
    print("\n🚀 启动珍贵音频恢复脚本...\n")
    asyncio.run(recover_audio())
