"""
AI 服务 - 混合模型优化版本
作者灵感来源：乔布斯的简约哲学 + 张小龙的克制设计

🔥 重大更新：
1. 从 OpenAI GPT-4o-mini 迁移到 AWS Bedrock Claude 模型
2. 混合使用 Haiku 3.5（润色）+ Sonnet 3.5（反馈）
3. 并行执行，速度提升 40-50%
4. 保持 Whisper 语音转文字不变

核心理念：
1. 简单但不简陋（Simple but not simplistic）
2. 强大但不复杂（Powerful but not complicated）
3. 优雅但不炫技（Elegant but not showy）
"""

import tempfile
import os
import json
import asyncio  # 🔥 新增：用于并行执行
from typing import Dict, Optional
from openai import OpenAI
import boto3  # 🔥 新增：AWS SDK
from botocore.exceptions import ClientError  # 🔥 新增：用于捕获 AWS 错误

from ..config import get_settings


class OpenAIService:
    """
    AI 服务类 - 支持多语言日记处理
    
    这个类就像一个温柔的日记助手，它会：
    1. 听懂你的声音（语音转文字 - Whisper）
    2. 美化你的文字（轻度润色 - Claude Haiku 3.5）
    3. 给你温暖的回应（心理陪伴 - Claude Sonnet 3.5）
    4. 帮你起个好标题（画龙点睛 - Claude Haiku 3.5）
    
    🔥 模型选择策略：
    - Whisper: 语音转文字（OpenAI，无可替代）
    - Haiku 3.5: 润色 + 标题（快速、便宜、效果好）
    - Sonnet 3.5: AI 反馈（慢一点但温暖有深度）
    """
    
    # 🎯 模型配置
    MODEL_CONFIG = {
        # 语音转文字（保持不变）
        "transcription": "whisper-1",
        
        # 🔥 新增：Claude 模型配置
        # ⚠️ 临时：Haiku 3.5 正在申请 inference profile，暂时使用 GPT-4o-mini 替代（避免限流）
        # TODO: 申请通过后，从备份文件恢复 Haiku 3.5 调用: openai_service.py.backup-sonnet-haiku
        "haiku": "gpt-4o-mini",  # 临时：用 GPT-4o-mini 替代（润色 + 标题）
        "sonnet": "anthropic.claude-3-5-sonnet-20240620-v1:0",  # AI 反馈（温暖、有深度）
        
        # 🎤 为什么 Whisper？
        # ✅ OpenAI 官方语音转文字模型
        # ✅ 支持 100+ 语言（中英文完美）
        # ✅ 高准确度，低幻觉率
        
        # 🎨 为什么 Haiku 润色？
        # ✅ 速度快（1-2秒）
        # ✅ 便宜（$1/1M tokens input）
        # ✅ 足够聪明（日记润色绰绰有余）
        
        # 💬 为什么 Sonnet 反馈？
        # ✅ 温暖有深度（共情能力强）
        # ✅ 中文表达自然（比 GPT 更好）
        # ✅ 值得慢一点（用户期待有深度的反馈）
    }
    
    # 📏 长度限制（保持不变）
    LENGTH_LIMITS = {
        "title_min": 4,
        "title_max": 50,
        "feedback_min": 30,
        "feedback_max": 250,
        "polished_ratio": 1.15,
        "min_audio_text": 5,
    }
    
    def __init__(self):
        """初始化服务客户端"""
        settings = get_settings()
        
        # OpenAI 客户端（用于 Whisper）
        self.openai_client = OpenAI(api_key=settings.openai_api_key)
        
        # 🔥 新增：AWS Bedrock 客户端
        # 使用 settings 中的 region，而不是直接读取环境变量
        region = settings.aws_region or os.getenv('AWS_REGION', 'us-east-1')
        
        try:
            self.bedrock_client = boto3.client(
                service_name='bedrock-runtime',
                region_name=region
            )
            print(f"✅ Bedrock 客户端初始化成功 (区域: {region})")
        except Exception as e:
            print(f"❌ Bedrock 客户端初始化失败: {type(e).__name__}: {e}")
            print(f"📍 提示: 请检查 AWS 凭证配置")
            import traceback
            traceback.print_exc()
            raise
        
        print(f"✅ AI 服务初始化完成")
        print(f"   - Whisper: 语音转文字")
        print(f"   - Haiku 3.5: 润色 + 标题 (模型: {self.MODEL_CONFIG['haiku']}) ⚠️ 临时使用 GPT-4o-mini")
        print(f"   - Sonnet 3.5: AI 反馈 (模型: {self.MODEL_CONFIG['sonnet']})")
    
    # ========================================================================
    # 语音转文字（保持不变）
    # ========================================================================
    
    async def transcribe_audio(
        self, 
        audio_content: bytes, 
        filename: str
    ) -> str:
        """
        语音转文字 - 把你的声音变成文字
        
        🔥 注意：这个方法完全不变，继续使用 Whisper
        
        工作流程：
        1. 收到音频 → 检查大小
        2. 创建临时文件 → 确保格式正确
        3. 发送给 Whisper → 它是语音识别专家
        4. 检查结果 → 确保不是空的
        5. 清理临时文件 → 保持整洁
        """
        temp_file_path = None
        
        try:
            # 检查音频大小
            audio_size_kb = len(audio_content) / 1024
            print(f"🎤 收到音频: {filename}, 大小: {audio_size_kb:.1f} KB")
            
            if audio_size_kb < 1:
                raise ValueError("音频文件太小，请说长一点")
            
            # 准备临时文件
            suffix = '.m4a' if not filename.endswith('.m4a') else ''
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=suffix or os.path.splitext(filename)[1]
            ) as temp_file:
                temp_file.write(audio_content)
                temp_file_path = temp_file.name
            
            print(f"✅ 临时文件准备完成")
            
            # 调用 Whisper
            with open(temp_file_path, 'rb') as audio_file:
                print(f"📤 正在识别语音...")
                transcription = self.openai_client.audio.transcriptions.create(
                    model=self.MODEL_CONFIG["transcription"],
                    file=audio_file,
                    language=None,
                )
            
            # 验证结果
            text = (transcription.text or "").strip()
            
            if len(text) < self.LENGTH_LIMITS["min_audio_text"]:
                print(f"❌ 转录内容过短: '{text}'")
                raise ValueError("未识别到有效内容，请说清楚一些")
            
            print(f"✅ 语音识别成功: '{text[:50]}...'")
            return text
            
        except Exception as e:
            print(f"❌ 语音转文字失败: {str(e)}")
            if "Invalid file format" in str(e):
                raise ValueError("音频格式不支持，请使用 m4a 格式")
            elif "File too large" in str(e):
                raise ValueError("音频文件太大，请控制在 2 分钟内")
            else:
                raise ValueError(f"语音识别失败: {str(e)}")
        
        finally:
            # 清理临时文件
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    print(f"🧹 临时文件已清理")
                except Exception as e:
                    print(f"⚠️ 清理失败（不影响功能）: {e}")
    
    # ========================================================================
    # 🔥 核心改动：混合模型处理
    # ========================================================================
    
    async def polish_content_multilingual(
        self, 
        text: str,
        user_name: Optional[str] = None  # 用户名字，用于个性化反馈
    ) -> Dict[str, str]:
        """
        🔥 重大改动：从单一模型改为混合模型 + 并行执行
        
        旧逻辑：
        1. GPT-4o-mini 一次性生成润色 + 标题 + 反馈（串行，3-5秒）
        
        新逻辑：
        1. Haiku 生成润色 + 标题（1-2秒）
        2. Sonnet 生成反馈（基于原始文本，2-3秒）
        3. 两个任务并行执行，总耗时 = max(1-2, 2-3) = 2-3秒
        
        为什么基于原始文本生成反馈？
        - 更真实：原始文本保留了用户最真实的情感
        - 更快：不需要等润色完成
        - 更温暖：AI 回应"真实的你"而不是"完美的文字"
        """
        try:
            # 输入检查
            if not text or len(text.strip()) < 5:
                raise ValueError("内容太短，请多写一些")
            
            print(f"✨ 开始AI处理（并行模式）: {text[:50]}...")
            
            # 检测语言
            import re
            chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
            is_chinese = chinese_chars > len(text) * 0.2
            detected_lang = "Chinese" if is_chinese else "English"
            
            print(f"🌍 检测到语言: {detected_lang}")
            
            # 🔥 关键改动：并行执行两个任务
            print(f"🚀 启动并行处理...")
            print(f"   - 任务1: Haiku 润色 + 标题")
            print(f"   - 任务2: Sonnet 反馈（基于原始文本）")
            
            # 创建两个异步任务
            polish_task = self._call_claude_haiku_for_polish(text, detected_lang)
            feedback_task = self._call_claude_sonnet_for_feedback(text, detected_lang, user_name)
            
            # 并行执行并等待结果
            polish_result, feedback = await asyncio.gather(
                polish_task,
                feedback_task
            )
            
            print(f"✅ 并行处理完成")
            
            # 合并结果
            result = {
                "title": polish_result['title'],
                "polished_content": polish_result['polished_content'],
                "feedback": feedback
            }
            
            # 质量检查
            result = self._validate_and_fix_result(result, text)
            
            print(f"✅ 处理完成:")
            print(f"  - 标题: {result['title']}")
            print(f"  - 内容长度: {len(result['polished_content'])} 字")
            print(f"  - 反馈长度: {len(result['feedback'])} 字")
            
            return result
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ AI处理失败: {error_type}: {error_msg}")
            import traceback
            error_trace = traceback.format_exc()
            print(f"📍 完整错误堆栈:")
            print(error_trace)
            
            # 检查是否是并行任务中的错误
            if isinstance(e, (asyncio.TimeoutError, asyncio.CancelledError)):
                print(f"⚠️ 并行任务超时或取消")
            elif isinstance(e, Exception):
                print(f"⚠️ 并行任务执行失败: {e}")
            
            return self._create_fallback_result(text)
    
    # ========================================================================
    # 🔥 新增：Claude Haiku 调用（润色 + 标题）
    # ========================================================================
    
    async def _call_claude_haiku_for_polish(
        self, 
        text: str,
        language: str
    ) -> Dict[str, str]:
        """
        ⚠️ 临时方法：调用 GPT-4o-mini 进行润色和生成标题（替代 Haiku 3.5，避免限流）
        
        原计划使用 Claude Haiku 3.5，但正在申请 inference profile，暂时使用 GPT-4o-mini
        等 Haiku 3.5 申请通过后，从备份文件恢复: openai_service.py.backup-sonnet-haiku
        
        返回:
            {
                "title": "标题",
                "polished_content": "润色后的内容"
            }
        """
        try:
            print(f"🎨 GPT-4o-mini: 开始润色和生成标题...")
            
            # 构建 prompt
            system_prompt = f"""You are a gentle diary editor. Your task is to polish the user's diary entry and create a title.

Language: Keep everything in {language}. NEVER translate.

Your responsibilities:
1. Fix obvious grammar/typos
2. Make the text flow naturally
3. Keep it ≤115% of original length
4. **CRITICAL: Preserve ALL original content. Do NOT delete or omit any part of the user's entry.**
5. Create a short, warm, poetic, meaningful title (6-18 words)

Style: Natural, warm, authentic. Don't over-edit.

Response format (JSON only):
{{
  "title": "6-18 words in {language}",
  "polished_content": "fixed text, same language - MUST include all original content"
}}

Example:
Input: "今天天气很好我去了公园看到了很多花"
Output: {{"title": "公园里的花", "polished_content": "今天天气很好，我去了公园，看到了很多花。"}}"""

            user_prompt = f"Please polish this diary entry (preserve ALL content):\n\n{text}"
            
            # ✅ 动态计算 max_tokens：确保足够输出完整内容
            # 原始文本长度 + 标题 + JSON 格式开销 + 安全边距
            original_length = len(text)
            # 估算：原始文本 * 1.15（115%限制） + 标题（50字符） + JSON格式（100字符） + 安全边距（500字符）
            estimated_output_length = int(original_length * 1.15) + 50 + 100 + 500
            # max_tokens 大约是字符数的 0.75（中文）到 1.5（英文），取中间值 1.0
            max_tokens = max(2000, int(estimated_output_length * 1.0))
            # 但不要超过 OpenAI 的限制（GPT-4o-mini 支持 16384 tokens）
            max_tokens = min(max_tokens, 16000)
            
            print(f"📤 GPT-4o-mini: 发送请求到 OpenAI...")
            print(f"   模型: {self.MODEL_CONFIG['haiku']}")
            print(f"   原始文本长度: {original_length} 字符")
            print(f"   估算输出长度: {estimated_output_length} 字符")
            print(f"   设置 max_tokens: {max_tokens}")
            
            # 使用 OpenAI client（已经在 __init__ 中初始化）
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=self.MODEL_CONFIG["haiku"],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}  # 强制 JSON 格式
            )
            
            # 解析响应
            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI 返回空响应")
            
            print(f"✅ GPT-4o-mini: 收到响应")
            print(f"📝 GPT-4o-mini: 响应内容长度: {len(content)} 字符")
            
            # 解析 JSON
            try:
                result = json.loads(content)
                polished_content = result.get("polished_content", text)
                
                # ✅ 添加长度对比日志，检查是否被截断
                original_length = len(text)
                polished_length = len(polished_content)
                length_ratio = polished_length / original_length if original_length > 0 else 0
                
                print(f"✅ GPT-4o-mini: 润色完成")
                print(f"📊 长度对比: 原始={original_length} 字符, 润色后={polished_length} 字符, 比例={length_ratio:.2%}")
                
                # ⚠️ 如果润色后内容明显少于原始内容（小于80%），可能是被截断了
                if polished_length < original_length * 0.8:
                    print(f"⚠️ 警告：润色后内容明显少于原始内容，可能被截断！")
                    print(f"   原始内容前100字符: {text[:100]}...")
                    print(f"   润色后内容前100字符: {polished_content[:100]}...")
                    # 如果确实被截断，使用原始内容作为降级方案
                    polished_content = text
                    print(f"   使用原始内容作为降级方案")
                
                return {
                    "title": result.get("title", "Today's Reflection"),
                    "polished_content": polished_content
                }
            except json.JSONDecodeError as e:
                print(f"⚠️ GPT-4o-mini: JSON 解析失败: {e}")
                print(f"   原始响应: {content[:200]}...")
                # 尝试从文本中提取 JSON
                import re
                json_match = re.search(r'\{[^{}]*"title"[^{}]*"polished_content"[^{}]*\}', content)
                if json_match:
                    try:
                        result = json.loads(json_match.group())
                        return {
                            "title": result.get("title", "Today's Reflection"),
                            "polished_content": result.get("polished_content", text)
                        }
                    except:
                        pass
                
                # 降级方案
                print(f"⚠️ GPT-4o-mini: 使用降级方案")
                return {
                    "title": "Today's Reflection" if language == "English" else "今日记录",
                    "polished_content": text
                }
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ GPT-4o-mini 调用失败: {error_type}: {error_msg}")
            
            # 详细错误信息
            import traceback
            error_trace = traceback.format_exc()
            print(f"📍 GPT-4o-mini 完整错误堆栈:")
            print(error_trace)
            
            # 检查常见错误类型
            if "RateLimitError" in error_type or "rate_limit" in error_msg.lower():
                print(f"⚠️ OpenAI API 限流: 请求频率过高")
                print(f"💡 建议: 稍后重试，或检查 OpenAI 账户的配额限制")
            elif "AuthenticationError" in error_type or "InvalidApiKey" in error_type:
                print(f"⚠️ OpenAI API Key 错误: 请检查 OPENAI_API_KEY 环境变量")
            elif "APIConnectionError" in error_type:
                print(f"⚠️ OpenAI API 连接错误: 请检查网络连接")
            
            # 降级方案
            return {
                "title": "Today's Reflection" if language == "English" else "今日记录",
                "polished_content": text
            }
    
    # ========================================================================
    # 🔥 新增:Claude Sonnet 调用（AI 反馈）
    # ========================================================================
    
    async def _call_claude_sonnet_for_feedback(
        self, 
        text: str,
        language: str,
        user_name: Optional[str] = None
    ) -> str:
        """
        🔥 新增方法：调用 Claude Sonnet 生成温暖的 AI 反馈
        
        为什么用 Sonnet？
        - 共情能力强（理解情感细腻）
        - 中文表达自然（比 GPT 更好）
        - 温暖有深度（符合 Thankly 品牌调性）
        
        为什么基于原始文本？
        - 更真实的情感
        - 不需要等润色完成（并行）
        - AI 回应"真实的你"
        
        返回:
            温暖的反馈文字（简洁有力，不超过用户输入长度）
        """
        try:
            print(f"💬 Sonnet: 开始生成反馈（基于原始文本）...")
            print(f"👤 用户名字: {user_name if user_name else '未提供'}")
            
            # 计算用户输入长度，用于动态调整反馈长度
            user_text_length = len(text.strip())
            # 反馈长度策略：不超过用户输入长度，但最短不少于20字（中文）或15词（英文）
            max_feedback_length = max(user_text_length, 20 if language == "Chinese" else 15)
            
            # 构建个性化的名字称呼
            name_greeting = ""
            if user_name and user_name.strip():
                # 提取名字（去掉可能的空格和特殊字符）
                import re
                first_name = re.split(r'\s+', user_name.strip())[0]
                if language == "Chinese":
                    name_greeting = f"，{first_name}"
                else:
                    name_greeting = f", {first_name}"
            
            # 构建 prompt
            if user_name and user_name.strip():
                # 有用户名字时，明确规定必须使用名字
                system_prompt = f"""You are a warm, empathetic listener responding to {user_name}'s diary entry.

Language: Respond in {language} ONLY. NEVER translate.

⚠️ CRITICAL RULE - YOU MUST FOLLOW THIS:
Your response MUST start with "{user_name}" (followed by a comma in English or a Chinese comma in Chinese), then your message. 
DO NOT use generic greetings like "Hi there", "Hello", or "Hi". 
DO NOT skip the name. 
ALWAYS start with "{user_name}".

Your style:
- Warm and genuine (like a close friend)
- **Keep it SHORT and POWERFUL** - never longer than the user's input (unless their input is very short, <20 chars)
- Maximum length: {max_feedback_length} characters (Chinese) or {max_feedback_length // 2} words (English)
- 1-2 complete sentences (prefer 1 sentence if user's input is short)
- **FIRST WORD MUST BE "{user_name}"** - No exceptions
- Acknowledge their feelings with warmth
- Offer gentle encouragement when appropriate
- Natural, conversational, intimate tone

Response format: Plain text only (NO JSON, NO quotes, NO markdown)

Example responses (MUST follow this exact format):
- Chinese (short input): "{user_name}，这份简单的快乐很珍贵。"
- Chinese (longer input): "{user_name}，这份记录很温暖。生活中的小确幸，往往是最治愈的时刻。"
- English (short input): "{user_name}, this simple joy is precious."
- English (longer input): "{user_name}, this moment you captured is beautiful. Small joys like this are what make life meaningful."

REMEMBER: 
1. Your response MUST start with "{user_name}" (with comma or Chinese comma)
2. DO NOT use "Hi there", "Hello", "Hi", or any other greeting
3. DO NOT skip the name
4. Be warm, be brief, be personal. Quality over quantity."""
            else:
                # 没有用户名字时，使用通用提示
                system_prompt = f"""You are a warm, empathetic listener responding to someone's diary entry.

Language: Respond in {language} ONLY. NEVER translate.

Your style:
- Warm and genuine (like a close friend)
- **Keep it SHORT and POWERFUL** - never longer than the user's input (unless their input is very short, <20 chars)
- Maximum length: {max_feedback_length} characters (Chinese) or {max_feedback_length // 2} words (English)
- 1-2 complete sentences (prefer 1 sentence if user's input is short)
- Acknowledge their feelings with warmth
- Offer gentle encouragement when appropriate
- Natural, conversational, intimate tone

Response format: Plain text only (NO JSON, NO quotes, NO markdown)

Example responses (short and warm):
- Chinese (short input): "这份简单的快乐很珍贵。"
- Chinese (longer input): "这份记录很温暖。生活中的小确幸，往往是最治愈的时刻。"
- English (short input): "This simple joy is precious."
- English (longer input): "This moment you captured is beautiful. Small joys like this are what make life meaningful."

Remember: Be warm, be brief, be personal. Quality over quantity."""

            # 构建个性化的用户提示
            if user_name:
                user_prompt = f"{user_name} just shared this with you:\n\n{text}\n\nRespond warmly and personally:"
            else:
                user_prompt = f"Someone just shared this with you:\n\n{text}\n\nRespond with warmth and empathy:"
            
            # 调用 Bedrock API（Claude 3.5 格式）
            # 动态调整 max_tokens：根据用户输入长度，但不超过200
            max_tokens = min(max(user_text_length // 2, 50), 200)
            
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": 0.7,
                "system": system_prompt,
                "messages": [
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            }
            
            # 🔥 核心：调用 Bedrock（带重试机制，处理限流）
            print(f"📤 Sonnet: 发送请求到 Bedrock...")
            print(f"   模型: {self.MODEL_CONFIG['sonnet']}")
            print(f"   区域: {self.bedrock_client.meta.region_name}")
            print(f"   用户名字: {user_name if user_name else '未提供'}")
            print(f"   System prompt 前100字符: {system_prompt[:100]}...")
            
            # 注意：boto3 invoke_model 会自动处理 content-type
            # 需要确保 body 是 bytes 格式
            request_bytes = json.dumps(request_body).encode('utf-8')
            
            # 🔥 实现带指数退避的重试机制（专门处理限流）
            # 增加重试间隔，减少限流概率
            max_retries = 5  # 最多重试5次
            base_delay = 2.0  # 基础延迟2秒（从1秒增加到2秒，减少限流）
            
            for attempt in range(max_retries):
                try:
                    response = await asyncio.to_thread(
                        self.bedrock_client.invoke_model,
                        modelId=self.MODEL_CONFIG["sonnet"],
                        body=request_bytes
                    )
                    # 成功，跳出重试循环
                    break
                    
                except ClientError as e:
                    error_code = e.response.get('Error', {}).get('Code', '')
                    
                    # 如果是限流错误，进行重试
                    if error_code == 'ThrottlingException' and attempt < max_retries - 1:
                        # 指数退避：2秒、4秒、8秒、16秒、32秒（从1秒基础延迟改为2秒）
                        delay = base_delay * (2 ** attempt)
                        print(f"⚠️ Sonnet: 遇到限流，等待 {delay:.1f} 秒后重试 (尝试 {attempt + 1}/{max_retries})...")
                        print(f"   💡 提示：Sonnet 限流频繁，可能是请求频率过高。建议稍后再试。")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # 其他错误或重试次数用尽，抛出异常
                        raise
            
            # 解析响应
            response_bytes = response['body'].read()
            if not response_bytes:
                raise ValueError("Bedrock 返回空响应")
            
            response_body = json.loads(response_bytes)
            print(f"✅ Sonnet: 收到响应，状态码: {response.get('ResponseMetadata', {}).get('HTTPStatusCode', 'N/A')}")
            
            # 提取反馈内容并打印（用于调试）
            if 'content' in response_body and len(response_body['content']) > 0:
                feedback_text = response_body['content'][0].get('text', '')
                print(f"📝 Sonnet 反馈内容: {feedback_text[:100]}...")
                # 检查是否包含用户名字
                if user_name and user_name.strip():
                    if user_name.lower() in feedback_text.lower():
                        print(f"✅ 反馈中包含用户名字 '{user_name}'")
                    else:
                        print(f"⚠️ 警告：反馈中未包含用户名字 '{user_name}'！")
                        print(f"   反馈内容: {feedback_text}")
            
            # 检查响应结构
            if 'content' not in response_body:
                print(f"⚠️ Sonnet: 响应结构异常: {response_body}")
                raise ValueError(f"Bedrock 响应格式错误: 缺少 'content' 字段")
            
            if not response_body['content'] or len(response_body['content']) == 0:
                print(f"⚠️ Sonnet: 响应内容为空")
                raise ValueError("Bedrock 返回空内容")
            
            feedback = response_body['content'][0]['text'].strip()
            
            print(f"✅ Sonnet: 反馈生成完成")
            print(f"   反馈: {feedback[:50]}...")
            
            return feedback
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ Sonnet 调用失败: {error_type}: {error_msg}")
            
            # 详细错误信息
            import traceback
            error_trace = traceback.format_exc()
            print(f"📍 Sonnet 完整错误堆栈:")
            print(error_trace)
            
            # 检查常见错误类型
            if "ThrottlingException" in error_type or "Throttling" in error_msg:
                print(f"⚠️ AWS Bedrock 限流: 请求频率过高，已尝试重试但仍失败")
                print(f"💡 建议: 稍后重试，或检查 AWS 账户的 Bedrock 配额限制")
            elif "CredentialsError" in error_type or "NoCredentialsError" in error_type:
                print(f"⚠️ AWS 凭证错误: 请配置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY")
            elif "ValidationException" in error_type:
                print(f"⚠️ Bedrock API 格式错误: 请检查模型 ID 和请求格式")
            elif "AccessDeniedException" in error_type:
                print(f"⚠️ 权限不足: 请检查 IAM 权限是否包含 bedrock:InvokeModel")
            elif "ResourceNotFoundException" in error_type:
                print(f"⚠️ 模型不存在: 请检查模型 ID 是否正确")
            
            # 降级方案
            return "感谢分享你的这一刻。" if language == "Chinese" else "Thanks for sharing this moment."
    
    # ========================================================================
    # 验证和降级逻辑（保持不变）
    # ========================================================================
    
    def _validate_and_fix_result(
        self, 
        result: Dict[str, str], 
        original_text: str
    ) -> Dict[str, str]:
        """
        验证并修正AI输出 - 质量把关
        
        🔥 注意：这个方法完全保持不变
        """
        import re
        
        orig_len = len(original_text.strip())
        
        # 检测语言
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', original_text))
        is_chinese = chinese_chars > len(original_text) * 0.2
        
        print(f"📊 原文语言检测: 总长度={len(original_text)}, 中文字符={chinese_chars}, 判定={'中文' if is_chinese else '英文'}")
        
        # 提取各部分
        title = (result.get("title", "") or "").strip()
        polished = (result.get("polished_content", "") or "").strip()
        feedback = (result.get("feedback", "") or "").strip()
        
        # 验证语言一致性
        title_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', title))
        feedback_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', feedback))
        
        used_fallback = False
        
        if is_chinese != title_has_chinese:
            print(f"⚠️ 标题语言不一致！")
            title = "今日记录" if is_chinese else "Today's Reflection"
            used_fallback = True
        
        if is_chinese != feedback_has_chinese:
            print(f"⚠️ 反馈语言不一致！")
            feedback = "感谢分享你的这一刻。" if is_chinese else "Thanks for sharing this moment."
            used_fallback = True
        
        # 清理函数
        def clean_text(text: str) -> str:
            text = re.sub(r'[\U0001F300-\U0001FAFF\U00002700-\U000027BF]+', '', text)
            text = text.replace('！', '。').replace('!', '.')
            text = re.sub(r'\s+', ' ', text).strip()
            return text
        
        def trim_to_complete_sentences(text: str, max_len: int) -> str:
            if len(text) <= max_len:
                return text
            
            sentence_pattern = r"([。！？.!?])(['\"\"」』)]?)\s*"
            sentences = []
            last_end = 0
            
            for match in re.finditer(sentence_pattern, text):
                end_pos = match.end()
                sentence = text[last_end:end_pos].strip()
                if sentence:
                    sentences.append(sentence)
                last_end = end_pos
            
            if last_end < len(text):
                remaining = text[last_end:].strip()
                if remaining:
                    sentences.append(remaining)
            
            if not sentences:
                for punct in ['。', '.', '！', '!', '？', '?', '；', ';']:
                    idx = text.rfind(punct, 0, max_len + 1)
                    if idx > max_len * 0.5:
                        return text[:idx + 1].strip()
                return text
            
            result = []
            current_len = 0
            
            for sentence in sentences:
                sentence_len = len(sentence)
                if current_len + sentence_len <= max_len:
                    result.append(sentence)
                    current_len += sentence_len
                else:
                    if len(result) == 0:
                        return text[:max_len].strip() if max_len < len(text) else text
                    break
            
            if not result:
                return text[:max_len].strip()
            
            has_chinese = any('\u4e00' <= char <= '\u9fff' for char in ''.join(result))
            separator = '' if has_chinese else ' '
            
            return separator.join(result).strip()
        
        # 修正标题
        title = clean_text(title)
        title = re.sub(r'[^\w\u4e00-\u9fff\s-]', '', title)
        title = re.sub(r'\s+', ' ', title).strip()
        
        if len(title) < self.LENGTH_LIMITS["title_min"]:
            title = "Today's Reflection" if any(ord(c) < 128 for c in original_text) else "今日记录"
        elif len(title) > self.LENGTH_LIMITS["title_max"]:
            max_len = self.LENGTH_LIMITS["title_max"]
            if ' ' in title and len(title) > max_len:
                words = title[:max_len].rsplit(' ', 1)
                title = words[0] if len(words[0]) > max_len * 0.6 else title[:max_len]
            else:
                title = title[:max_len]
        
        # 修正润色内容
        polished = clean_text(polished)
        max_polished_len = int(orig_len * self.LENGTH_LIMITS["polished_ratio"])
        
        # ✅ 添加长度检查日志
        print(f"📊 润色内容验证: 原始长度={orig_len}, 润色后长度={len(polished)}, 最大允许长度={max_polished_len}")
        
        # ⚠️ 如果润色后内容明显少于原始内容（小于80%），可能是被截断了，使用原始内容
        if len(polished) < orig_len * 0.8:
            print(f"⚠️ 警告：润色后内容明显少于原始内容（{len(polished)} < {orig_len * 0.8}），使用原始内容")
            polished = original_text.strip()
        
        # 只有在超过最大长度时才截断（但这种情况不应该发生，因为提示词要求≤115%）
        if len(polished) > max_polished_len:
            print(f"⚠️ 润色后内容超过最大长度（{len(polished)} > {max_polished_len}），按完整句子截断")
            polished = trim_to_complete_sentences(polished, max_polished_len)
        
        # 修正反馈
        feedback = clean_text(feedback)
        
        if not used_fallback and len(feedback) < self.LENGTH_LIMITS.get("feedback_min", 20):
            print(f"⚠️ 反馈过短，使用降级")
            feedback = "感谢分享你的这一刻。" if is_chinese else "Thanks for sharing this moment."
        
        if len(feedback) > self.LENGTH_LIMITS["feedback_max"]:
            print(f"📏 反馈过长，按完整句子截断")
            feedback = trim_to_complete_sentences(feedback, self.LENGTH_LIMITS["feedback_max"])
        
        is_english = any(ord(c) < 128 for c in original_text[:50])
        default_feedback = "Thank you for sharing." if is_english else "感谢分享。"
        
        return {
            "title": title,
            "polished_content": polished or original_text,
            "feedback": feedback or default_feedback
        }
    
    def _create_fallback_result(self, text: str) -> Dict[str, str]:
        """
        创建降级结果
        
        🔥 注意：这个方法完全保持不变
        """
        import re
        
        print("⚠️ 使用降级方案")
        
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        is_chinese = chinese_chars > len(text) * 0.2
        
        return {
            "title": "今日记录" if is_chinese else "Today's Reflection",
            "polished_content": text,
            "feedback": "感谢分享。" if is_chinese else "Thanks for sharing."
        }
    
    # ========================================================================
    # 向后兼容方法（保持不变）
    # ========================================================================
    
    def polish_text(self, text: str) -> str:
        """润色文本（旧API）"""
        result = self.polish_content_multilingual(text)
        return result["polished_content"]
    
    def generate_feedback(self, diary_content: str) -> str:
        """生成反馈（旧API）"""
        result = self.polish_content_multilingual(diary_content)
        return result["feedback"]


# 🎯 使用示例
"""
# 1. 初始化服务
service = OpenAIService()

# 2. 语音转文字（Whisper）
text = await service.transcribe_audio(audio_bytes, "recording.m4a")

# 3. 并行处理：润色（Haiku）+ 反馈（Sonnet）
result = await service.polish_content_multilingual(text)

# 4. 使用结果
print(f"标题: {result['title']}")        # Haiku 生成
print(f"内容: {result['polished_content']}")  # Haiku 润色
print(f"反馈: {result['feedback']}")      # Sonnet 生成
"""