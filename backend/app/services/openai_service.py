"""
AI 服务 - 混合模型优化版本
作者灵感来源：乔布斯的简约哲学 + 张小龙的克制设计

🔥 最新更新：
1. AI 暖心反馈从 Claude Sonnet 回归 OpenAI GPT-4o-mini（TestFlight 验证稳定版）
2. 润色 + 标题与反馈统一使用 GPT-4o-mini（降低维护成本）
3. 并行执行策略保持不变，性能继续稳定
4. Whisper 语音转文字持续沿用，保证识别准确度

核心理念：
1. 简单但不简陋（Simple but not simplistic）
2. 强大但不复杂（Powerful but not complicated）
3. 优雅但不炫技（Elegant but not showy）
"""

import tempfile
import os
import json
import asyncio  # 🔥 用于并行执行
from typing import Dict, Optional, List
from openai import OpenAI
import io
import base64
import requests

from ..config import get_settings


class OpenAIService:
    """
    AI 服务类 - 支持多语言日记处理
    
    这个类就像一个温柔的日记助手，它会：
    1. 听懂你的声音（语音转文字 - Whisper）
    2. 美化你的文字（轻度润色 - GPT-4o-mini）
    3. 给你温暖的回应（心理陪伴 - GPT-4o-mini）
    4. 帮你起个好标题（画龙点睛 - GPT-4o-mini）
    
    🔥 模型选择策略：
    - Whisper: 语音转文字（OpenAI，无可替代）
    - GPT-4o-mini: 润色 + 标题（快速、稳定、成本可控）
    - GPT-4o-mini: AI 反馈（TestFlight 回归验证更稳定）
    """
    
    # 🎯 模型配置
    MODEL_CONFIG = {
        # 语音转文字（保持不变）
        "transcription": "whisper-1",
        
        # 🔥 GPT 模型配置
        "haiku": "gpt-4o-mini",  # 润色 + 标题（命名沿用旧字段，便于兼容）
        "sonnet": "gpt-4o-mini",  # AI 暖心反馈（回归 OpenAI 模型）
        
        # 🎤 为什么 Whisper？
        # ✅ OpenAI 官方语音转文字模型
        # ✅ 支持 100+ 语言（中英文完美）
        # ✅ 高准确度，低幻觉率
        
        # 🎨 为什么 Haiku 润色？
        # ✅ 速度快（1-2秒）
        # ✅ 便宜（$1/1M tokens input）
        # ✅ 足够聪明（日记润色绰绰有余）
        
        # 💬 为什么 GPT-4o-mini 反馈？
        # ✅ 温暖真实（兼顾共情与安全）
        # ✅ 多语言能力强（中英文都自然）
        # ✅ 与润色模型统一，方便维护
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
        self.openai_api_key = settings.openai_api_key
        
        print(f"✅ AI 服务初始化完成")
        print(f"   - Whisper: 语音转文字")
        print(f"   - GPT-4o-mini: 润色 + 标题 (配置字段 haiku)")
        print(f"   - GPT-4o-mini: AI 反馈 (配置字段 sonnet)")
    
    # ========================================================================
    # 语音转文字（保持不变）
    # ========================================================================
    
    async def transcribe_audio(
        self, 
        audio_content: bytes, 
        filename: str,
        expected_duration: Optional[int] = None
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
            import httpx
            import io
            print("📤 正在识别语音（verbose_json 模式）...")
            response_json = None
            try:
                with httpx.Client(timeout=60.0) as client:
                    file_stream = io.BytesIO(audio_content)
                    response = client.post(
                        "https://api.openai.com/v1/audio/transcriptions",
                        headers={
                            "Authorization": f"Bearer {self.openai_api_key}",
                        },
                        data={
                            "model": self.MODEL_CONFIG["transcription"],
                            "language": "",
                            "temperature": "0",
                            "response_format": "verbose_json",
                        },
                        files={
                            "file": (filename or "recording.m4a", file_stream, "audio/m4a"),
                        },
                    )
                    response.raise_for_status()
                    response_json = response.json()
            except httpx.HTTPError as http_err:
                print(f"❌ Whisper HTTP 请求失败: {http_err}")
                if http_err.response is not None:
                    print(f"📄 Whisper 响应: {http_err.response.text[:200]}...")
                raise ValueError("语音识别失败: 服务暂时不可用，请稍后重试")
            
            if not response_json:
                raise ValueError("语音识别失败: 未收到有效响应")
            
            text = (response_json.get("text") or "").strip()
            segments = response_json.get("segments", []) or []
            
            import re
            normalized_text = re.sub(r"\s+", "", text)
            
            if len(normalized_text) < self.LENGTH_LIMITS["min_audio_text"]:
                print(f"❌ 转录内容过短: '{text}'")
                raise ValueError("未识别到有效内容，请说清楚一些")
            
            filler_tokens = {
                "um",
                "uh",
                "uhh",
                "hmm",
                "hmmm",
                "erm",
                "er",
                "ah",
                "oh",
                "mmm",
            }
            token_pattern = r"[A-Za-z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+"
            tokens = re.findall(token_pattern, text)
            meaningful_tokens = [
                token
                for token in tokens
                if len(token) >= 2 and token.lower() not in filler_tokens
            ]
            cjk_chars = re.findall(r"[\u4e00-\u9fff]", text)
            has_cjk = len(cjk_chars) > 0
            
            unique_chars = len(set(normalized_text))
            if unique_chars <= 2 and len(normalized_text) > 2:
                print(
                    "❌ 转录结果包含大量重复字符，视为无效:",
                    {"text": text, "normalized": normalized_text},
                )
                raise ValueError("未识别到有效内容，请说清楚一些")
            
            # 分析 Whisper 段结果，确认是否真的有讲话
            def _segment_value(segment, attr, default):
                if isinstance(segment, dict):
                    return segment.get(attr, default)
                return getattr(segment, attr, default)
            
            confident_segments = []
            total_confident_duration = 0.0
            total_segment_duration = 0.0
            avg_no_speech_sum = 0.0
            
            for segment in segments:
                try:
                    start = float(_segment_value(segment, "start", 0))
                    end = float(_segment_value(segment, "end", 0))
                    seg_duration = max(0.0, end - start)
                except (TypeError, ValueError):
                    seg_duration = 0.0
                    start = 0.0
                    end = 0.0
                
                total_segment_duration += seg_duration
                
                try:
                    no_speech_prob = float(_segment_value(segment, "no_speech_prob", 1))
                except (TypeError, ValueError):
                    no_speech_prob = 1
                
                try:
                    avg_logprob = float(_segment_value(segment, "avg_logprob", -10))
                except (TypeError, ValueError):
                    avg_logprob = -10
                
                avg_no_speech_sum += no_speech_prob * seg_duration
                
                if (
                    seg_duration >= 0.3
                    and no_speech_prob < 0.45
                    and avg_logprob > -0.75
                ):
                    confident_segments.append(segment)
                    total_confident_duration += seg_duration
            
            reference_duration = None
            if expected_duration and expected_duration > 0:
                reference_duration = float(expected_duration)
            elif total_segment_duration > 0:
                reference_duration = total_segment_duration
            else:
                reference_duration = None
            
            speech_ratio = (
                total_confident_duration / reference_duration
                if reference_duration and reference_duration > 0
                else None
            )
            
            avg_no_speech_prob = (
                avg_no_speech_sum / total_segment_duration
                if total_segment_duration > 0
                else 1.0
            )
            
            if reference_duration and reference_duration >= 6:
                if (
                    len(normalized_text) < self.LENGTH_LIMITS["min_audio_text"]
                    and (speech_ratio is None or speech_ratio < 0.15)
                    and total_confident_duration < 0.6
                ):
                    print(
                        "❌ 检测到有效语音过少:",
                        {
                            "expected_duration": expected_duration,
                            "total_confident_duration": total_confident_duration,
                            "speech_ratio": speech_ratio,
                            "avg_no_speech_prob": avg_no_speech_prob,
                            "segments_count": len(segments),
                        },
                    )
                    raise ValueError("未识别到有效内容，请说清楚一些")
            
            # 对长录音不再使用字符密度硬阈值，避免误杀真实内容

            if reference_duration:
                if has_cjk:
                    # 中文场景：用汉字数量判断，避免“一个长词”被误判
                    if (
                        len(cjk_chars) < 3
                        and len(normalized_text) < self.LENGTH_LIMITS["min_audio_text"]
                    ):
                        print(
                            "❌ 中文有效字符过少，判定为无意义内容:",
                            {
                                "cjk_chars": len(cjk_chars),
                                "duration": reference_duration,
                            },
                        )
                        raise ValueError("未识别到有效内容，请稍作表达后再试")
                else:
                    if (
                        len(meaningful_tokens) < 2
                        and len(normalized_text) < self.LENGTH_LIMITS["min_audio_text"] * 2
                    ):
                        print(
                            "❌ 有效词汇数量不足，判定为无意义内容:",
                            {
                                "tokens": tokens,
                                "meaningful_tokens": meaningful_tokens,
                                "duration": reference_duration,
                            },
                        )
                        raise ValueError("未识别到有效内容，请稍作表达后再试")
            
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
        user_name: Optional[str] = None,  # 用户名字，用于个性化反馈
        image_urls: Optional[List[str]] = None  # 图片URL列表，用于vision分析
    ) -> Dict[str, str]:
        """
        🔥 重大改动：从单一模型改为混合模型 + 并行执行
        
        旧逻辑：
        1. GPT-4o-mini 一次性生成润色 + 标题 + 反馈（串行，3-5秒）
        
        新逻辑：
        1. GPT-4o-mini 生成润色 + 标题（字段 haiku，1-2秒）
        2. GPT-4o-mini 生成反馈（字段 sonnet，基于原始文本，2-3秒）
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
            
            # 🔥 优化语言检测：更准确地识别用户输入的主要语言
            import re
            # 移除空白字符和标点，只统计实际内容字符
            content_only = re.sub(r'[\s\W]', '', text)
            chinese_chars = 0
            english_words = 0
            
            if not content_only:
                # 如果只有空白和标点，默认使用中文
                detected_lang = "Chinese"
            else:
                # 统计中文字符
                chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content_only))
                # 统计英文字符（单词）
                english_words = len(re.findall(r'[a-zA-Z]+', content_only))
                # 计算中文字符占比
                chinese_ratio = chinese_chars / len(content_only) if len(content_only) > 0 else 0
                # 计算英文单词占比（每个单词平均5个字符估算）
                english_ratio = (english_words * 5) / len(content_only) if len(content_only) > 0 else 0
                
                # 🔥 关键逻辑：如果中文字符占比超过30%，或者中文字符数量明显多于英文单词，判定为中文
                # 这样可以避免"少量中文+大量英文"被误判为英文的情况
                if chinese_ratio > 0.3 or (chinese_chars > 5 and chinese_chars > english_words * 2):
                    detected_lang = "Chinese"
                elif english_ratio > 0.5 or english_words > 10:
                    detected_lang = "English"
                else:
                    # 默认：如果中文字符存在且数量>=3，判定为中文
                    detected_lang = "Chinese" if chinese_chars >= 3 else "English"
            
            print(f"🌍 检测到语言: {detected_lang} (中文字符={chinese_chars}, 英文单词={english_words})")
            
            # 🔥 关键改动：并行执行两个任务
            print(f"🚀 启动并行处理...")
            if image_urls and len(image_urls) > 0:
                print(f"   - 检测到 {len(image_urls)} 张图片，将使用 Vision 能力分析图片+文字")
            print(f"   - 任务1: GPT-4o-mini 润色 + 标题（字段 haiku）")
            print(f"   - 任务2: GPT-4o-mini 暖心反馈（字段 sonnet，基于原始文本）")
            
            # 🔥 性能优化：预先下载并编码所有图片，避免在并行任务中重复下载
            encoded_images = []
            if image_urls and len(image_urls) > 0:
                print(f"🖼️ 预处理 {len(image_urls)} 张图片...")
                # 并行下载图片
                download_tasks = [self._download_and_encode_image(url) for url in image_urls]
                results = await asyncio.gather(*download_tasks, return_exceptions=True)
                for i, img_data in enumerate(results):
                    if isinstance(img_data, Exception):
                        print(f"⚠️ 图片下载失败 ({image_urls[i]}): {img_data}")
                    else:
                        encoded_images.append(img_data)
            
            # 创建两个异步任务
            polish_task = self._call_gpt4o_mini_for_polish_and_title(text, detected_lang, encoded_images)
            feedback_task = self._call_gpt4o_mini_for_feedback(text, detected_lang, user_name, encoded_images)
            
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
    # 🔥 GPT-4o-mini 调用（润色 + 标题）
    # ========================================================================
    
    async def _call_gpt4o_mini_for_polish_and_title(
        self, 
        text: str,
        language: str,
        encoded_images: Optional[List[str]] = None
    ) -> Dict[str, str]:
        """
        调用 GPT-4o-mini 进行润色和生成标题
        
        📚 学习点：这个函数负责两个任务
        1. 润色用户的原始文本（修复语法、优化表达）
        2. 生成一个简洁有意义的标题
        
        为什么使用 GPT-4o-mini？
        - 速度快（1-2秒）
        - 成本低（$1/1M tokens input）
        - 质量足够（日记润色绰绰有余）
        
        返回:
            {
                "title": "标题",
                "polished_content": "润色后的内容"
            }
        """
        try:
            print(f"🎨 GPT-4o-mini: 开始润色和生成标题...")
            
            # 🔥 优化：根据传入的 language 参数构建更严格的 prompt
            # 核心原则：标题语言必须与用户输入内容的主要语言完全一致
            language_instruction = ""
            if language == "Chinese":
                language_instruction = """🚨 CRITICAL LANGUAGE RULE - YOU MUST FOLLOW:
The user's content is primarily in CHINESE (简体中文). 

MANDATORY REQUIREMENTS:
1. **Title MUST be in Chinese (简体中文) ONLY** - NO English, NO Japanese, NO Korean
2. **Title language must match the user's input language** - If user writes in Chinese, title MUST be Chinese
3. Even if the content contains some English words or other languages, the title MUST be in Chinese
4. Polished content should preserve the original language of each part, but the title MUST be Chinese

WRONG Examples (DO NOT DO THIS):
- User input in Chinese → Title: "Reflections on..." ❌
- User input in Chinese → Title: "オレンジの魅力" ❌

CORRECT Examples:
- User input: "我先试一下语音输入，现在怎么样" → Title: "语音输入的尝试" ✅
- User input: "オレンジの魅力 Talking about orange..." → Title: "橙子的魅力" ✅ (Chinese, not Japanese)"""
            elif language == "English":
                language_instruction = """🚨 CRITICAL LANGUAGE RULE - YOU MUST FOLLOW:
The user's content is primarily in ENGLISH.

MANDATORY REQUIREMENTS:
1. **Title MUST be in English ONLY** - NO Chinese, NO Japanese, NO Korean
2. **Title language must match the user's input language** - If user writes in English, title MUST be English
3. Even if the content contains some Chinese words or other languages, the title MUST be in English
4. Polished content should preserve the original language of each part, but the title MUST be English

WRONG Examples (DO NOT DO THIS):
- User input in English → Title: "今日记录" ❌
- User input in English → Title: "オレンジの魅力" ❌

CORRECT Examples:
- User input: "today was good i went to park" → Title: "A Day at the Park" ✅
- User input: "オレンジの魅力 Talking about orange..." → Title: "The Charm of Oranges" ✅ (English, not Japanese)"""
            else:
                # 默认：检测语言，但必须严格匹配
                language_instruction = """🚨 CRITICAL LANGUAGE RULE - YOU MUST FOLLOW:
Detect the user's PRIMARY language from their input content.

MANDATORY REQUIREMENTS:
1. **Title language MUST match the user's primary input language**
2. If content is primarily Chinese → Title MUST be Chinese
3. If content is primarily English → Title MUST be English
4. If content contains mixed languages, use the language that appears MOST FREQUENTLY
5. NEVER use Japanese or Korean for titles unless the ENTIRE content is in that language
6. **DO NOT mix languages in the title** - Use ONE language only, matching the user's primary language

Examples:
- User input: "今天天气很好" (Chinese) → Title: "美好的天气" ✅ (Chinese)
- User input: "today was good" (English) → Title: "A Good Day" ✅ (English)
- User input: "今天天气很好 today was good" (mixed, more Chinese) → Title: "美好的一天" ✅ (Chinese, matching primary language)"""
            
            # 构建 prompt
            system_prompt = f"""You are a gentle diary editor. Your task is to polish the user's diary entry and create a title.

{language_instruction}

Your responsibilities:
1. Fix obvious grammar/typos
2. Make the text flow naturally
3. Keep it ≤115% of original length
4. **CRITICAL: Preserve ALL original content. Do NOT delete or omit any part of the user's entry.**
5. **Formatting: Preserve the user's line breaks, blank lines, and bullet/numbered lists. Do NOT merge everything into one paragraph.**
6. **If the input is long and mostly one block (no line breaks), add clear paragraph breaks based on meaning.**
7. **Avoid overly short paragraphs. Do NOT break right after the first sentence. Keep the first 3 sentences in the same paragraph when you add breaks.**
8. **🚨 MOST CRITICAL: Create a title in the EXACT SAME LANGUAGE as the user's primary input language**
   - If user writes in Chinese → Title MUST be in Chinese
   - If user writes in English → Title MUST be in English
   - The title language must match the content language - NO EXCEPTIONS
   - Title should be short, warm, poetic, and meaningful, but ALWAYS in the user's language

Style: Natural, warm, authentic. Don't over-edit.

Response format (JSON only):
{{
  "title": "Title in the EXACT SAME LANGUAGE as the user's primary input (Chinese or English only - MUST match user's language)",
  "polished_content": "fixed text, preserving original language AND original formatting (line breaks/lists) - MUST include all original content"
}}

🚨 CRITICAL EXAMPLES - Study these carefully:

Example 1 (User writes in Chinese - Title MUST be Chinese):
Input: "我先试一下语音输入，现在怎么样。哎呀，就是有点失落，因为明明应该早点睡的。"
Output: {{"title": "失眠的夜晚", "polished_content": "我先试一下语音输入，现在怎么样。哎呀，就是有点失落，因为明明应该早点睡的。"}}
❌ WRONG: {{"title": "Reflections on Sleepless Nights"}} - This is English, but user wrote in Chinese!

Example 2 (User writes in English - Title MUST be English):
Input: "today was good i went to park and saw many flowers"
Output: {{"title": "A Day at the Park", "polished_content": "Today was good. I went to the park and saw many flowers."}}
❌ WRONG: {{"title": "公园一日"}} - This is Chinese, but user wrote in English!

Example 3 (User writes in Chinese with some English words - Title MUST be Chinese):
Input: "今天去了park，看到了很多flowers，心情很好"
Output: {{"title": "公园里的花", "polished_content": "今天去了park，看到了很多flowers，心情很好。"}}
✅ CORRECT: Title is in Chinese because user's primary language is Chinese

Example 4 (User writes in English with some Chinese words - Title MUST be English):
Input: "I went to 公园 today and saw many 花"
Output: {{"title": "A Visit to the Park", "polished_content": "I went to 公园 today and saw many 花."}}
✅ CORRECT: Title is in English because user's primary language is English"""

            # 构建用户消息内容
            user_content = []
            
            # 如果有图片，添加图片到消息中（使用vision能力）
            if encoded_images and len(encoded_images) > 0:
                print(f"🖼️ 添加 {len(encoded_images)} 张图片到 Vision 请求 (Low-res 模式)...")
                for image_data in encoded_images:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}",
                            "detail": "low"  # ✅ 使用低分辨率模式，处理更快且更省钱
                        }
                    })
                
                # 添加文字内容
                user_content.append({
                    "type": "text",
                    "text": f"Please polish this diary entry (preserve ALL content) and create a title. Consider both the images and the text:\n\n{text}"
                })
                user_prompt = user_content
            else:
                # 只有文字，使用纯文本
                user_prompt = f"Please polish this diary entry (preserve ALL content):\n\n{text}"
            
            # ✅ 动态计算 max_tokens：确保足够输出完整内容
            # 原始文本长度 + 标题 + JSON 格式开销 + 安全边距
            original_length = len(text)
            # 如果有图片，需要额外的tokens（每张图片约85 tokens）
            image_tokens = len(encoded_images) * 85 if encoded_images else 0
            # 估算：原始文本 * 1.15（115%限制） + 标题（50字符） + JSON格式（100字符） + 安全边距（500字符）
            estimated_output_length = int(original_length * 1.15) + 50 + 100 + 500
            # max_tokens 大约是字符数的 0.75（中文）到 1.5（英文），取中间值 1.0
            max_tokens = max(2000, int(estimated_output_length * 1.0) + image_tokens)
            # 但不要超过 OpenAI 的限制（GPT-4o-mini 支持 16384 tokens）
            max_tokens = min(max_tokens, 16000)
            
            print(f"📤 GPT-4o-mini: 发送请求到 OpenAI...")
            print(f"   模型: {self.MODEL_CONFIG['haiku']}")
            print(f"   原始文本长度: {original_length} 字符")
            print(f"   图片数量: {len(encoded_images) if encoded_images else 0}")
            print(f"   估算输出长度: {estimated_output_length} 字符")
            print(f"   设置 max_tokens: {max_tokens}")
            
            # 构建消息
            if encoded_images and len(encoded_images) > 0:
                # 使用vision格式（包含图片）
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            else:
                # 纯文本格式
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            
            # 使用 OpenAI client（已经在 __init__ 中初始化）
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=self.MODEL_CONFIG["haiku"],
                messages=messages,
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
    # 🔥 GPT-4o-mini 调用（AI 反馈）
    # ========================================================================
    
    async def _call_gpt4o_mini_for_feedback(
        self, 
        text: str,
        language: str,
        user_name: Optional[str] = None,
        encoded_images: Optional[List[str]] = None
    ) -> str:
        """
        调用 GPT-4o-mini 生成温暖的 AI 反馈
        
        📚 学习点：这个函数基于用户的原始文本生成反馈
        - 更真实：保留用户最原始的情感表达
        - 更快：不需要等待润色完成（可以并行执行）
        - 更温暖：AI 回应"真实的你"而不是"完美的文字"
        
        为什么选择 GPT-4o-mini？
        - 共情能力稳定
        - 中英文表达自然
        - 与润色模型统一，方便维护
        
        返回:
            温暖的反馈文字（简洁有力，不超过用户输入长度）
        """
        try:
            print(f"💬 GPT-4o-mini: 开始生成反馈（基于原始文本）...")
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
            
            # 构建统一的系统提示词 (支持自动语言检测)
            system_prompt = f"""You are a warm, empathetic listener responding to a diary entry.

LANGUAGE RULES:
1. **Detect and Follow**: Detect the user's language from their input (text or voice transcription) and respond in THE SAME LANGUAGE (e.g., if they write in Chinese, respond in Chinese; if Japanese, respond in Japanese).
2. **Fallback**: If the user's input is empty or only contains images, respond in {language}.
3. **Consistency**: NEVER translate. Match the emotional tone and language exactly.

⚠️ CRITICAL RULES - YOU MUST FOLLOW:
1. **NEVER ask questions**: Do not ask "How are you?" or "What's on your mind?". No question marks allowed.
2. **Warm Listener**: Your role is to listen and provide emotional resonance, NOT to start a conversation.
3. **Short and Powerful**: 1-2 sentences maximum. Keep it concise.
4. **Greeting**: {"Your response MUST start with '" + user_name + (", " if language == "English" else "，") + "'." if user_name else "Start your response directly."}

Your style:
- Like a close friend, genuine and empathetic.
- Acknowledge their feelings with warmth.
- Natural, conversational, intimate tone.

Response format: Plain text only (NO JSON, NO quotes, NO markdown)."""

            # 构建个性化的用户提示
            user_content = []
            
            # 如果有图片，添加图片到消息中（使用vision能力）
            if encoded_images and len(encoded_images) > 0:
                print(f"🖼️ 添加 {len(encoded_images)} 张图片到 Vision 反馈请求 (Low-res 模式)...")
                for image_data in encoded_images:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}",
                            "detail": "low"
                        }
                    })
                
                # 添加文字内容
                # 添加文字内容 (使用中性指令，避免语言诱导)
                if text.strip():
                    text_content = f"The user shared this (including images):\n\n{text}\n\nRespond with warmth and empathy in the SAME LANGUAGE as the user's input (NEVER ask questions):"
                else:
                    text_content = f"The user shared some images. Feel the atmosphere and respond with warmth and empathy in {language} (NEVER ask questions):"
                
                user_content.append({
                    "type": "text",
                    "text": text_content
                })
                user_prompt = user_content
            else:
                # 只有文字，使用纯文本
                user_prompt = f"The user shared this:\n\n{text}\n\nRespond with warmth and empathy in the SAME LANGUAGE as the user's input (NEVER ask questions):"
            
            # 调用 OpenAI Chat Completions API
            # 动态调整 max_tokens：根据用户输入长度，预留昵称与提示空间
            estimated_output_length = max_feedback_length + 40
            image_tokens = len(encoded_images) * 85 if encoded_images else 0
            max_tokens = max(200, min(int(estimated_output_length * 1.2) + image_tokens, 800))

            print(f"📤 GPT-4o-mini: 发送请求到 OpenAI...")
            print(f"   模型: {self.MODEL_CONFIG['sonnet']}")
            print(f"   用户名字: {user_name if user_name else '未提供'}")
            print(f"   图片数量: {len(encoded_images) if encoded_images else 0}")
            print(f"   System prompt 前100字符: {system_prompt[:100]}...")

            # 构建消息
            if encoded_images and len(encoded_images) > 0:
                # 使用vision格式（包含图片）
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            else:
                # 纯文本格式
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]

            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=self.MODEL_CONFIG["sonnet"],
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
            )

            content = response.choices[0].message.content if response.choices else ""
            if not content:
                raise ValueError("OpenAI 返回空响应")

            feedback = content.strip()
            print(f"✅ GPT-4o-mini: 收到反馈，长度 {len(feedback)} 字符")
            
            if user_name and user_name.strip():
                trimmed_feedback = feedback.lstrip()
                starts_with_name = trimmed_feedback.lower().startswith(user_name.lower())
                
                # 智能分隔符：根据反馈内容判断用中文逗号还是英文逗号
                # CJK 字符（中日韩）使用中文逗号，其他使用英文逗号
                import re
                has_cjk = bool(re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]', trimmed_feedback))
                separator = "，" if has_cjk else ", "
                
                if not starts_with_name:
                    print(
                        f"⚠️ 反馈未以名字开头，自动修正: user_name={user_name}, feedback='{feedback}'"
                    )
                    feedback = f"{user_name}{separator}{trimmed_feedback}"
                    print(f"✅ 修正后: {feedback[:50]}...")
            
            print(f"✅ GPT-4o-mini: 反馈生成完成")
            print(f"   反馈: {feedback[:50]}...")
            
            return feedback
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ GPT-4o-mini 反馈调用失败: {error_type}: {error_msg}")
            
            # 详细错误信息
            import traceback
            error_trace = traceback.format_exc()
            print(f"📍 GPT-4o-mini 反馈完整错误堆栈:")
            print(error_trace)
            
            # 检查常见错误类型
            if "RateLimit" in error_type or "rate limit" in error_msg.lower():
                print(f"⚠️ OpenAI 限流: 请求频率过高，建议稍后重试或调整速率")
            elif "AuthenticationError" in error_type or "InvalidApiKey" in error_type:
                print(f"⚠️ OpenAI API Key 错误: 请检查 OPENAI_API_KEY 环境变量")
            elif "APIConnectionError" in error_type:
                print(f"⚠️ OpenAI API 连接错误: 请检查网络连接")
            
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
        
        # 🔥 强化语言一致性验证：更准确地检测和修正
        title_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', title))
        title_has_english = bool(re.search(r'[a-zA-Z]', title))
        feedback_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', feedback))
        
        used_fallback = False
        
        # 🔥 更严格的标题语言检查
        # 如果用户输入是中文，但标题包含英文且没有中文，判定为不一致
        # 如果用户输入是英文，但标题包含中文且没有英文，判定为不一致
        title_language_mismatch = False
        if is_chinese:
            # 用户输入是中文，标题应该是中文
            if not title_has_chinese and title_has_english:
                title_language_mismatch = True
                print(f"⚠️ 标题语言不一致！用户输入是中文，但标题是英文: '{title}'")
        else:
            # 用户输入是英文，标题应该是英文
            if not title_has_english and title_has_chinese:
                title_language_mismatch = True
                print(f"⚠️ 标题语言不一致！用户输入是英文，但标题是中文: '{title}'")
        
        if title_language_mismatch:
            # 使用降级方案，确保语言一致
            title = "今日记录" if is_chinese else "Today's Reflection"
            used_fallback = True
            print(f"✅ 已修正标题为: '{title}'")
        
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

        def clean_text_preserve_formatting(
            text: str,
            is_chinese: bool,
            should_adjust_paragraphs: bool,
        ) -> str:
            """
            保留用户排版（换行/列表），只做轻度清理。
            """
            text = re.sub(r'[\U0001F300-\U0001FAFF\U00002700-\U000027BF]+', '', text)
            text = text.replace('！', '。').replace('!', '.')
            text = text.replace('\r\n', '\n').replace('\r', '\n')
            lines = text.split('\n')
            cleaned_lines = []
            bullet_pattern = re.compile(r'^(\s*)([-*•]|\d+[.)])\s*(.*)$')
            for line in lines:
                if not line.strip():
                    cleaned_lines.append("")
                    continue
                bullet_match = bullet_pattern.match(line)
                if bullet_match:
                    indent, marker, content = bullet_match.groups()
                    content = re.sub(r'\s+', ' ', content).strip()
                    cleaned_lines.append(f"{indent}{marker} {content}".rstrip())
                else:
                    leading_ws = re.match(r'^\s*', line).group(0)
                    content = line[len(leading_ws):]
                    content = re.sub(r'\s+', ' ', content).strip()
                    cleaned_lines.append(f"{leading_ws}{content}".rstrip())
            cleaned = "\n".join(cleaned_lines).strip()

            if not should_adjust_paragraphs:
                return cleaned

            # 如果包含列表，避免自动合并段落
            for line in cleaned.split("\n"):
                if bullet_pattern.match(line):
                    return cleaned

            paragraphs = re.split(r"\n\s*\n+", cleaned)
            if len(paragraphs) <= 1:
                return cleaned

            def sentence_count(paragraph: str) -> int:
                if is_chinese:
                    matches = re.findall(r"[。！？!?；;]", paragraph)
                else:
                    matches = re.findall(r"[.!?;]", paragraph)
                return max(1, len(matches))

            def merge_text(a: str, b: str) -> str:
                if not a:
                    return b
                if is_chinese:
                    sep = ""
                else:
                    sep = "" if a.endswith((" ", "\n")) else " "
                return f"{a.rstrip()}{sep}{b.lstrip()}"

            # ✅ 首段至少包含3句，避免第一句后断段
            while len(paragraphs) > 1 and sentence_count(paragraphs[0]) < 3:
                paragraphs[0] = merge_text(paragraphs[0], paragraphs[1])
                paragraphs.pop(1)

            # ✅ 合并过短段落（避免空白感）
            min_chars = 60 if is_chinese else 90
            i = 1
            while i < len(paragraphs):
                if sentence_count(paragraphs[i]) < 2 or len(paragraphs[i]) < min_chars:
                    paragraphs[i - 1] = merge_text(paragraphs[i - 1], paragraphs[i])
                    paragraphs.pop(i)
                else:
                    i += 1

            return "\n\n".join(p.strip() for p in paragraphs)
        
        def trim_to_complete_sentences(text: str, max_len: int) -> str:
            if len(text) <= max_len:
                return text

            sentence_pattern = r"([。！？.!?])(['\"\"」』)]?)\s*"
            last_end = None

            for match in re.finditer(sentence_pattern, text):
                end_pos = match.end()
                if end_pos <= max_len:
                    last_end = end_pos
                else:
                    break

            if last_end is not None:
                return text[:last_end].rstrip()

            for punct in ['。', '.', '！', '!', '？', '?', '；', ';']:
                idx = text.rfind(punct, 0, max_len + 1)
                if idx > max_len * 0.5:
                    return text[:idx + 1].rstrip()
            return text[:max_len].rstrip()
        
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
        original_has_linebreaks = "\n" in original_text
        original_has_list = bool(re.search(r"(?m)^\s*([-*•]|\d+[.)])\s+", original_text))
        should_adjust_paragraphs = not original_has_linebreaks and not original_has_list
        polished = clean_text_preserve_formatting(
            polished,
            is_chinese,
            should_adjust_paragraphs,
        )
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


    # ========================================================================
    # 🔥 图片下载和编码（用于Vision API）
    # ========================================================================
    
    async def _download_and_encode_image(self, image_url: str) -> str:
        """
        下载图片并转换为base64编码（用于OpenAI Vision API）
        
        Args:
            image_url: 图片的URL（S3 URL或HTTP URL）
        
        Returns:
            base64编码的图片数据
        """
        try:
            print(f"📥 下载图片: {image_url[:50]}...")
            
            # 下载图片
            response = await asyncio.to_thread(requests.get, image_url, timeout=10)
            response.raise_for_status()
            
            # 转换为base64
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            
            print(f"✅ 图片下载并编码完成，大小: {len(image_base64)} 字符")
            return image_base64
            
        except Exception as e:
            print(f"❌ 下载图片失败: {e}")
            raise

# 🎯 使用示例
"""
# 1. 初始化服务
service = OpenAIService()

# 2. 语音转文字（Whisper）
text = await service.transcribe_audio(audio_bytes, "recording.m4a")

# 3. 并行处理：润色（haiku 字段）+ 反馈（sonnet 字段）
result = await service.polish_content_multilingual(text)

# 4. 使用结果
print(f"标题: {result['title']}")        # GPT-4o-mini（haiku 字段）生成
print(f"内容: {result['polished_content']}")  # GPT-4o-mini（haiku 字段）润色
print(f"反馈: {result['feedback']}")      # GPT-4o-mini（sonnet 字段）生成

# 5. 图片+文字处理（新功能）
result = await service.polish_content_multilingual(
    text="今天去了公园",
    image_urls=["https://s3.../image1.jpg", "https://s3.../image2.jpg"]
)
"""
