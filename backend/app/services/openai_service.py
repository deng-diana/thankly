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
from typing import Dict, Optional, List, Any
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
            detected_language = response_json.get("language", "").lower()  # ✅ 获取检测到的语言
            
            # 🔥 新增：语言白名单检查 - 防止背景音乐被误识别为韩语/日语等
            SUPPORTED_LANGUAGES = {"zh", "en", "chinese", "english"}
            if detected_language and detected_language not in SUPPORTED_LANGUAGES:
                print(f"❌ 检测到不支持的语言: '{detected_language}'")
                print(f"   识别文本: '{text[:100]}'")
                print(f"   这可能是背景音乐或噪音被误识别")
                raise ValueError("未识别到有效内容，请用中文或英文说话")
            
            # 🔥 新增：检测韩语/日语字符 - 双重保险
            import re
            korean_chars = len(re.findall(r'[\uac00-\ud7af]', text))  # 韩语字符
            japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))  # 日语字符
            if korean_chars > 3 or japanese_chars > 3:
                print(f"❌ 检测到韩语/日语字符: 韩语={korean_chars}, 日语={japanese_chars}")
                print(f"   识别文本: '{text[:100]}'")
                print(f"   这可能是背景音乐或噪音被误识别")
                raise ValueError("未识别到有效内容，请用中文或英文说话")
            
            # 🔥 新增：检测重复文本模式 - Whisper 幻觉的常见特征
            # 例如: "닭가슴살 치킨입니다. 닭가슴살 치킨과 닭가슴살 치킨은..."
            words = text.split()
            if len(words) >= 5:
                # 检查是否有大量重复的词
                word_counts = {}
                for word in words:
                    if len(word) >= 3:  # 只统计长度>=3的词
                        word_counts[word] = word_counts.get(word, 0) + 1
                
                # 如果某个词出现次数超过总词数的40%,可能是幻觉
                max_repetition = max(word_counts.values()) if word_counts else 0
                repetition_ratio = max_repetition / len(words) if len(words) > 0 else 0
                
                if repetition_ratio > 0.4:
                    print(f"❌ 检测到高度重复的文本模式: 重复率={repetition_ratio:.1%}")
                    print(f"   识别文本: '{text[:100]}'")
                    print(f"   这可能是背景音乐或噪音被误识别")
                    raise ValueError("未识别到有效内容，请说清楚一些")
            
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
    ) -> Dict[str, Any]:
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
                
                # 🔥 新增：检测韩语/日语字符
                korean_chars = len(re.findall(r'[\uac00-\ud7af]', content_only))
                japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', content_only))
                
                # 🔥 语言白名单检查：如果检测到大量非中英文字符，降级到系统默认语言
                if korean_chars > 5 or japanese_chars > 5:
                    print(f"⚠️ 检测到非支持语言字符: 韩语={korean_chars}, 日语={japanese_chars}")
                    print(f"   内容: '{text[:50]}'")
                    print(f"   降级到系统默认语言: Chinese")
                    detected_lang = "Chinese"  # 降级到中文
                else:
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
            polish_result, feedback_data = await asyncio.gather(
                polish_task,
                feedback_task
            )
            
            print(f"✅ 并行处理完成")
            
            # 处理反馈结果 (兼容旧逻辑)
            if isinstance(feedback_data, dict):
                feedback_text = feedback_data.get("reply", "")
                emotion_data = feedback_data
            else:
                feedback_text = str(feedback_data)
                emotion_data = {"emotion": "Reflective", "confidence": 0.0}
            
            # 合并结果
            result = {
                "title": polish_result['title'],
                "polished_content": polish_result['polished_content'],
                "feedback": feedback_text,
                "emotion_data": emotion_data # ✅ 新增情绪数据
            }
            
            # 质量检查
            result = self._validate_and_fix_result(result, text)
            
            print(f"✅ 处理完成:")
            print(f"  - 标题: {result['title']}")
            print(f"  - 内容长度: {len(result['polished_content'])} 字")
            print(f"  - 反馈长度: {len(result['feedback'])} 字")
            print(f"  - 情绪: {result.get('emotion_data', {}).get('emotion', 'Unknown')}")
            
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
- User input: "オレンジの魅力 Talking about orange..." → Title: "The Charm of Oranges" ✅ (English, not Japanese)

🎯 SPECIAL POLISHING RULES FOR ENGLISH (Non-Native Speaker Support):
**PRIORITY ORDER (CRITICAL - Follow this exact sequence):**
1. **PRIMARY GOAL**: Transform the text to sound like a native English speaker wrote it
   - Eliminate ALL non-native patterns, awkward phrasing, and "foreign feel"
   - Use natural idioms, collocations, and sentence structures that native speakers use
   - Make it flow smoothly and authentically in English
   
2. **SECONDARY GOAL**: While maintaining native fluency, preserve the user's intended meaning
   - Keep the core message, emotions, and key details intact
   - Don't add information the user didn't express
   - If there's a conflict between sounding native and preserving exact wording, ALWAYS choose native fluency

3. **EDUCATIONAL VALUE**: Your polished version should serve as a learning example
   - Non-native speakers will compare your version to their original to improve their English
   - Use this as an opportunity to demonstrate natural, idiomatic English

📋 COMMON NON-NATIVE PATTERNS TO FIX:
- Missing articles (a/an/the): "I went to park" → "I went to the park"
- Wrong prepositions: "in the morning of Monday" → "on Monday morning"
- Unnatural word order: "I very like it" → "I really like it" or "I like it a lot"
- Literal translations: "eat medicine" → "take medicine"
- Overly formal/textbook language: "I am feeling very happy" → "I'm so happy" or "I feel great"
- Choppy sentences: "I went to store. I bought milk. I came home." → "I went to the store, bought some milk, and came home."
- Missing contractions in casual writing: "I am going to" → "I'm going to" or "I'm gonna"
- Awkward tense usage: "Today I am going to park" (when it already happened) → "I went to the park today"

✨ NATIVE ENGLISH ENHANCEMENT TECHNIQUES:
- Use contractions naturally (I'm, don't, can't, it's) in casual diary entries
- Apply common phrasal verbs: "continue" → "keep going", "understand" → "figure out"
- Add natural filler words when appropriate: "well", "so", "anyway", "actually"
- Use idiomatic expressions: "very tired" → "exhausted" or "beat", "very happy" → "thrilled" or "over the moon"
- Vary sentence structure for better flow (mix short and long sentences)
- Use more specific, vivid vocabulary: "good" → "great/wonderful/fantastic", "bad" → "rough/tough/awful"

🔍 BEFORE/AFTER EXAMPLES:

Example 1 - Basic Grammar + Natural Flow:
❌ Original: "today i go to park and see many flower it make me very happy"
✅ Polished: "I went to the park today and saw so many flowers—it made me really happy!"
(Fixed: capitalization, tense, articles, added natural emphasis with "so many", used contraction-like flow)

Example 2 - Removing Non-Native Patterns:
❌ Original: "I am very like this new job because can learn many things"
✅ Polished: "I really love this new job because I'm learning so much!"
(Fixed: "very like"→"really love", added subject "I'm", "many things"→"so much", more natural enthusiasm)

Example 3 - Idiomatic Enhancement:
❌ Original: "Today weather is not good so I stay at house and do nothing"
✅ Polished: "The weather was terrible today, so I just stayed home and did nothing."
(Fixed: added article "the", "not good"→"terrible", "at house"→"home", added natural "just")

Example 4 - Voice Input (Casual Speech):
❌ Original: "um i think i want to try this voice input thing lets see how it work"
✅ Polished: "Um, I think I want to try this voice input thing. Let's see how it works!"
(Fixed: punctuation, capitalization, "work"→"works", kept casual "um" as it's authentic)

Example 5 - Preserving Meaning While Improving Flow:
❌ Original: "I have one meeting today. The meeting is very boring. I don't like the meeting. After meeting I feel tired."
✅ Polished: "I had a meeting today, and it was so boring. I really didn't like it, and afterwards I felt exhausted."
(Combined choppy sentences, varied structure, used more natural vocabulary, maintained all original meaning)

⚠️ WHAT NOT TO CHANGE:
- Don't change the emotional tone (if user is casual, keep it casual; if formal, keep formal)
- Don't add details or experiences the user didn't mention
- Don't remove important information to make it "sound better"
- Don't over-polish to the point it doesn't sound like a diary entry anymore
- Keep proper nouns, names, and specific terms as-is (unless there's a clear typo)"""
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
1. **For ENGLISH input (non-native speakers):**
   - PRIMARY: Make it sound like a native English speaker wrote it (eliminate all non-native patterns)
   - SECONDARY: Preserve the user's intended meaning and emotions
   - GOAL: Help users learn natural English by providing an exemplary polished version
   
2. **For OTHER languages (Chinese, etc.):**
   - Fix obvious grammar/typos
   - Make the text flow naturally
   - Keep it authentic and close to the original style

3. **Universal rules:**
   - Keep polished content ≤115% of original length
   - **CRITICAL: Preserve ALL original content. Do NOT delete or omit any part of the user's entry.**
   - **Formatting: Preserve the user's line breaks, blank lines, and bullet/numbered lists. Do NOT merge everything into one paragraph.**
   - **If the input is long and mostly one block (no line breaks), add clear paragraph breaks based on meaning.**
   - **Avoid overly short paragraphs. Do NOT break right after the first sentence. Keep the first 3 sentences in the same paragraph when you add breaks.**
   
4. **🚨 MOST CRITICAL: Create a title in the EXACT SAME LANGUAGE as the user's primary input language**
   - If user writes in Chinese → Title MUST be in Chinese
   - If user writes in English → Title MUST be in English
   - The title language must match the content language - NO EXCEPTIONS
   - Title should be short, warm, poetic, and meaningful, but ALWAYS in the user's language
   
5. **🚨 TITLE CONTENT RULES - AVOID GENERIC AND REDUNDANT TITLES:**
   - **NEVER use "今日" (today) in Chinese titles** - It's too generic and meaningless
   - **NEVER use "Today's..." in English titles** - Same reason, too generic
   - **If you must reference the day, use specific date format instead**: "1月9日" (Jan 9), not "今日"
   - **AVOID repeating the first line of content in the title** - The title should complement, not duplicate
   - **Be specific and meaningful**: Extract the core theme, emotion, or key event from the content
   
   **🎯 SPECIAL RULE FOR TASK LISTS AND PLANNING CONTENT:**
   - **For task lists, to-do lists, or planning content (任务清单, 计划, to-do, plan, goal):**
     - **MUST include the specific date in the title** to make it informative and unique
     - Use format: "1月9日 + theme" (Chinese) or "Jan 9 + theme" (English)
     - This prevents repetitive titles like "任务清单" appearing multiple times
   
   Examples of BAD titles (DO NOT USE):
   ❌ "今日任务清单" - Generic "today" + redundant with content's first line "今日任务:"
   ❌ "任务清单" - Too generic, will repeat for every task list entry
   ❌ "今日记录" - Too generic, no meaning
   ❌ "Today's Thoughts" - Generic "today"
   ❌ "Task List" - Too generic, will repeat
   
   Examples of GOOD titles:
   ✅ "1月9日任务清单" - Specific date + clear theme, won't repeat
   ✅ "Jan 9 Task List" - Specific date + clear theme
   ✅ "1月9日的App上架计划" - Date + specific goal
   ✅ "App Store上架计划" - Specific, captures the main theme (if not a generic task list)
   ✅ "迈向新目标" - Meaningful, captures the essence

Style Guidelines:
- **For English**: Natural, fluent, native-sounding. Prioritize authenticity over preserving awkward phrasing.
- **For Chinese**: Natural, warm, authentic. Don't over-edit.
- **For all**: Keep the emotional tone and diary-like feel.

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
    ) -> Dict[str, Any]:
        """
        调用 GPT-4o-mini 生成温暖的 AI 反馈 + 情绪分析
        
        返回:
            {
                "reply": "温暖的反馈文字",
                "emotion": "Joyful",
                "confidence": 0.9,
                "rationale": "分析理由..."
            }
        """
        try:
            print(f"💬 GPT-4o-mini: 开始生成反馈 + 情绪分析...")
            print(f"👤 用户名字: {user_name if user_name else '未提供'}")
            
            # 计算用户输入长度，用于动态调整反馈长度
            user_text_length = len(text.strip())
            max_feedback_length = max(user_text_length, 20 if language == "Chinese" else 15)
            
            # 构建统一的系统提示词
            # 情绪列表：与前端 EmotionType 保持严格一致（2026-01-10 更新 v4 - 扩展到23个情绪，Reflective拆分为Thoughtful和Reflective）
            # Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Peaceful, Hopeful,
            # Reflective, Intentional, Inspired, Curious, Nostalgic, Calm,
            # Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated
            system_prompt = f"""You are a warm, empathetic listener AND an expert emotion analyst.

LANGUAGE RULES:
1. Detect and Follow: Respond in THE SAME LANGUAGE as the user's input.
2. Fallback: If input is empty/images only, respond in {language}.
3. Consistency: NEVER translate. Match the emotional tone.

⚠️ CRITICAL RULES FOR REPLY:
1. **NEVER ask questions**: Do not ask "How are you?" or "What's on your mind?".
2. **Warm Listener**: Acknowledge their feelings with warmth and resonance.
3. **Short and Powerful**: 1-2 sentences. Concise.
4. **Greeting**: {"Start response with '" + user_name + (", " if language == "English" else "，") + "'." if user_name else "Start directly."}

📊 EMOTION ANALYSIS RULES:
Analyze the user's emotion from the text/images and choose ONE from this STRICT list (23 emotions):
[Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Peaceful, Hopeful, Thoughtful, Reflective, Intentional, Inspired, Curious, Nostalgic, Calm, Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated]

🎯 Detailed Usage Guide:

**🌟 Positive Emotions (8) - 高能量/正向:**

- **Joyful (喜悦)**: Pure happiness, celebration, good things happening. User expresses excitement, delight, or joy.
  Examples: "Had so much fun today!", "Laughed until my stomach hurt", "今天太开心了"

- **Grateful (感恩)**: Thankfulness towards people, events, or things. Core of gratitude journaling.
  Examples: "So thankful for my friend's help", "Grateful for this moment", "感谢家人的支持"

- **Fulfilled (充实)**: ✨ NEW - Sense of accomplishment, achievement, productive satisfaction. Completing goals, getting results.
  Examples: "Completed my project!", "Learned a new skill today", "完成了大项目，很有成就感"
  Keywords: "完成", "达成", "实现", "成就", "收获", "accomplished", "achieved", "completed"
  
- **Proud (欣慰)**: Feeling pleased about personal growth or others' progress. For self or others.
  Examples: "My child made progress", "Overcame a challenge", "孩子进步了，很欣慰"
  NOTE: Use sparingly; default to Fulfilled for routine accomplishments.

- **Surprised (惊喜)**: ✨ NEW - Unexpected joy, pleasant surprise, serendipity. Unplanned good things.
  Examples: "Received an unexpected gift!", "Ran into an old friend", "没想到会收到这份礼物"
  Keywords: "意外", "惊喜", "没想到", "突然", "unexpected", "surprise", "serendipity"

- **Excited (期待)**: ✨ NEW - Anticipation, looking forward to something, energized about future.
  Examples: "Can't wait for the trip!", "Starting a new project tomorrow", "好期待明天的活动"
  Keywords: "期待", "等待", "即将", "马上", "looking forward", "can't wait", "excited about"

- **Peaceful (平静)**: Inner calm, tranquility, relaxation. No turmoil.
  Examples: "Meditated by the lake", "Quiet evening at home", "内心很平静"

- **Hopeful (希望)**: ✨ NEW - Optimism about the future, seeing light in darkness, believing things will improve.
  Examples: "Things will get better", "Saw a glimmer of hope", "相信明天会更好"
  Keywords: "希望", "相信", "会好", "曙光", "hope", "believe", "will get better"

**🧘 Neutral/Constructive Emotions (7) - 稳态/建设性:**

- **Thoughtful (若有所思)**: 🔥 **DEFAULT for general thinking/recording**. Pondering, considering, thinking things through. Most common neutral state for daily journaling.
  Examples: "Thinking about today", "Just recording my thoughts", "在想与记录"
  Keywords: "在想", "记录", "思考", "想着", "thoughtful", "pondering", "considering"
  NOTE: Use Thoughtful as the default neutral emotion when user is simply thinking or recording without strong emotional state.

- **Reflective (内省)**: Deep self-reflection, insights, understanding experiences and motivations. Deeper contemplation than Thoughtful.
  Examples: "Realized something important today", "Deep reflection on my life", "深度反思自己的经历"
  Keywords: "感悟", "反思", "内省", "深度", "realized", "reflection", "insights", "deep thoughts"

- **Intentional (笃定)**: 🔥 **HIGHEST PRIORITY for planning content**. Goal-setting, planning, creating to-do lists.
  **MANDATORY KEYWORDS**: "计划", "打算", "想要", "要做", "目标", "准备", "安排", "更新", "plan", "goal", "to-do", "will do", "want to", "update"
  **If ANY of these keywords appear → MUST choose Intentional**
  Examples: "今天我想要把这个产品更新到App Store", "产品更新计划"

- **Inspired (启迪)**: 🔥 **HIGHEST PRIORITY for learning content**. Recording learning notes, new knowledge, insights.
  **MANDATORY KEYWORDS**: "学到", "学习", "发现", "了解到", "认识到", "新知", "观点", "启发", "learn", "discover", "realize", "insight", "knowledge", "phrase", "concept"
  **If ANY of these keywords appear → MUST choose Inspired**
  Examples: "Today, I learned a new phrase", "今天学到一个概念"

- **Curious (好奇)**: ✨ NEW - Interested in exploring, desire to learn, wondering about something.
  Examples: "Want to try something new", "Curious about this topic", "对这个很好奇"
  Keywords: "好奇", "想知道", "探索", "尝试", "curious", "wonder", "explore", "try"

- **Nostalgic (怀念)**: ✨ NEW - Reminiscing about the past, missing old times, sentimental memories.
  Examples: "Looking at old photos", "Missing childhood", "想起了小时候"
  Keywords: "怀念", "想起", "回忆", "过去", "以前", "nostalgic", "remember", "miss", "old times"

- **Calm (淡然)**: ✨ NEW - Accepting reality, letting go, equanimity. Not fighting, just accepting.
  Examples: "Let it be", "Accepting what is", "顺其自然吧"
  Keywords: "淡然", "顺其自然", "接受", "放下", "let go", "accept", "let it be"

**😔 Negative/Release Emotions (7) - 低能量/宣泄:**

- **Uncertain (迷茫)**: ✨ NEW - Self-doubt, lack of direction, confusion, not knowing what to do.
  Examples: "Don't know what to do", "Feeling lost", "不知道该怎么办", "对自己没信心"
  Keywords: "迷茫", "不知道", "困惑", "没方向", "怀疑自己", "uncertain", "confused", "lost", "don't know"

- **Misunderstood (委屈)**: ✨ NEW - Feeling wronged, not understood, unappreciated. Efforts not seen.
  Examples: "No one understands me", "My efforts weren't seen", "没人理解我的想法"
  Keywords: "委屈", "不被理解", "误解", "不公平", "misunderstood", "wronged", "not appreciated"

- **Lonely (孤独)**: ✨ NEW - Lack of meaningful social connection, feeling isolated or alone. Missing companionship.
  Examples: "Feeling lonely in a new city", "Miss having someone to talk to", "一个人在异地，很孤独", "没人陪伴"
  Keywords: "孤独", "孤单", "一个人", "没人陪", "想念", "lonely", "alone", "isolated", "miss company", "no one around"

- **Down (低落)**: Sadness, feeling low, unhappy. General low mood.
  Examples: "Feeling sad today", "Not in a good mood", "心情很低落"

- **Anxious (焦虑)**: Worry about the future, tension, pressure, nervousness.
  Examples: "Worried about the exam", "Nervous about the meeting", "很焦虑"

- **Overwhelmed (疲惫)**: ✨ NEW - Exhausted, burned out, too much to handle. Can't cope.
  Examples: "So tired", "Too much work", "完全累垮了", "压力太大了"
  Keywords: "疲惫", "累", "耗竭", "不堪重负", "overwhelmed", "exhausted", "burned out", "too much"

- **Venting (宣泄)**: Actively releasing anger, frustration, need to vent. Healthy emotional release.
  Examples: "So annoyed!", "Need to vent", "太烦了，要吐槽一下"
  Keywords: "烦", "生气", "吐槽", "发泄", "annoyed", "frustrated", "venting", "letting it out"

- **Frustrated (受挫)**: ✨ NEW - Feeling blocked, plans failed, setbacks, things not working out.
  Examples: "Nothing is going right", "Plans fell through", "努力了很久还是没成功"
  Keywords: "受挫", "失败", "不顺", "阻碍", "frustrated", "setback", "didn't work", "blocked"

🚨 CRITICAL DISTINCTION RULES:

1. **Fulfilled vs Joyful**: Fulfilled = achievement/accomplishment, Joyful = pure happiness
2. **Surprised vs Excited**: Surprised = unexpected event (past), Excited = anticipation (future)
3. **Uncertain vs Down**: Uncertain = self-doubt/confusion, Down = general sadness
4. **Misunderstood vs Venting**: Misunderstood = feeling wronged, Venting = actively releasing anger
5. **Lonely vs Down**: Lonely = lack of connection/companionship, Down = general sadness
6. **Lonely vs Misunderstood**: Lonely = no one around, Misunderstood = people around but don't understand
7. **Overwhelmed vs Down**: Overwhelmed = exhausted/too much, Down = sad/low mood
8. **Frustrated vs Venting**: Frustrated = blocked/setback, Venting = releasing emotion
9. **Proud vs Fulfilled**: Proud = pleased about growth (self/others), Fulfilled = accomplished goals
10. **Thoughtful vs Reflective**: Thoughtful = general thinking/pondering (default neutral), Reflective = deep self-reflection with insights

🚨 CRITICAL EXAMPLES - STUDY THESE CAREFULLY:

1. "今天完成了一个大项目，很有成就感！"
   → **Fulfilled** ✅ (achievement, accomplishment)
   → NOT Joyful ❌ (not pure happiness, it's about achievement)
   
2. "没想到会收到这份礼物，太惊喜了！"
   → **Surprised** ✅ (unexpected, pleasant surprise)
   → NOT Joyful ❌ (emphasis on unexpectedness)
   
3. "不知道该怎么办，很迷茫"
   → **Uncertain** ✅ (self-doubt, lack of direction)
   → NOT Down ❌ (not general sadness, specific confusion)
   
4. "没人理解我的想法，很委屈"
   → **Misunderstood** ✅ (feeling wronged, not understood)
   → NOT Venting ❌ (not actively releasing anger)
   
5. "今天我想要把这个产品更新到App Store"
   → **Intentional** ✅ (planning keywords: "想要", "更新")
   → NOT Fulfilled ❌ (planning future, not completed yet)

Response format (JSON ONLY):
{{
  "reply": "Your warm response text here...",
  "emotion": "Selected Emotion from list",
  "confidence": 0.9,
  "rationale": "Short reason for analysis"
}}"""


            # 构建消息
            user_content = []
            if encoded_images and len(encoded_images) > 0:
                for image_data in encoded_images:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_data}", "detail": "low"}
                    })
                user_content.append({"type": "text", "text": f"Analyze emotion and respond to this (including images):\n\n{text}"})
                messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_content}]
            else:
                messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": f"Analyze emotion and respond to this:\n\n{text}"}]

            # 增加 max_tokens 以容纳 JSON
            estimated_output_length = max_feedback_length + 200 
            max_tokens = max(300, min(estimated_output_length, 1000))

            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=self.MODEL_CONFIG["sonnet"], # 继续使用配置好的模型
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI 返回空响应")

            try:
                result = json.loads(content)
                reply = result.get("reply", "").strip()
                emotion = result.get("emotion", "Reflective")
                
                # ✅ 添加调试日志
                print(f"🔍 [DEBUG] 名字前缀检查:")
                print(f"   user_name 参数: '{user_name}'")
                print(f"   AI 原始回复: '{reply}'")
                
                # 名字前缀检查
                if user_name and user_name.strip():
                    trimmed_reply = reply.lstrip()
                    if not trimmed_reply.lower().startswith(user_name.lower()):
                        import re
                        has_cjk = bool(re.search(r'[\u4e00-\u9fff]', trimmed_reply))
                        separator = "，" if has_cjk else ", "
                        reply = f"{user_name}{separator}{trimmed_reply}"
                
                result["reply"] = reply
                print(f"✅ 反馈生成: {reply[:30]}... (Mood: {emotion})")
                return result
                
            except json.JSONDecodeError:
                print("⚠️ JSON 解析失败，回退到纯文本处理")
                return {
                    "reply": content.strip(),
                    "emotion": "Reflective", 
                    "confidence": 0.5,
                    "rationale": "Extracted from non-JSON response"
                }
        
        except Exception as e:
            print(f"❌ 反馈生成失败: {e}")
            fallback_reply = "感谢分享你的这一刻。" if language == "Chinese" else "Thanks for sharing this moment."
            return {
                "reply": fallback_reply,
                "emotion": "Reflective",
                "confidence": 0.0,
                "rationale": "Fallback due to error"
            }
    
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
        emotion_data = result.get("emotion_data", {"emotion": "Reflective"}) # ✅ 保留情绪数据
        
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
            "feedback": feedback or default_feedback,
            "emotion_data": emotion_data # ✅ 返回情绪数据
        }
    
    def _create_fallback_result(self, text: str) -> Dict[str, Any]:
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
            "feedback": "感谢分享。" if is_chinese else "Thanks for sharing.",
            "emotion_data": {"emotion": "Reflective", "confidence": 0.5} # ✅ 默认情绪
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
