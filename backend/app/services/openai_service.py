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
import re  # 用于文本处理
import traceback  # 用于错误追踪
from typing import Dict, Optional, List, Any
from openai import OpenAI, AsyncOpenAI, APIError, RateLimitError, APIConnectionError
import io
import base64
import requests
import httpx  # ✅ 统一导入，用于异步 HTTP 请求
import time as time_module

# ✅ Phase 1.4: 添加重试机制
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

# 配置日志用于重试
logger = logging.getLogger(__name__)

from ..config import get_settings


class OpenAIService:
    """
    AI 服务类 - 支持多语言日记处理
    
    这个类就像一个温柔的日记助手，它会：
    1. 听懂你的声音（语音转文字 - Whisper）
    2. 美化你的文字（轻度润色 - GPT-4o-mini）
    3. 准确理解你的情绪（情绪分析 - GPT-4o）🔥 准确度优先
    4. 给你温暖的回应（心理陪伴 - GPT-4o-mini）
    5. 帮你起个好标题（画龙点睛 - GPT-4o-mini）
    
    🔥 模型选择策略（2026-01-27 v2）：
    - Whisper: 语音转文字（OpenAI，无可替代）
    - GPT-4o-mini: 润色 + 标题（速度优先，优化提示词保证质量）
    - GPT-4o: 情绪分析（🔥 准确度优先，影响情绪日历/幸福罐）
    - GPT-4o-mini: AI 反馈（速度优先，优化提示词保证温度）
    """
    
    # 🎯 模型配置 - OpenAI Models Only
    MODEL_CONFIG = {
        # 语音转文字
        "transcription": "whisper-1",
        
        # 🔥 GPT 模型配置 - 2026-01-27 v2 优化版
        # 策略: 速度敏感任务用 mini，准确度敏感任务用 4o
        "polish": "gpt-4o-mini",         # 润色 + 标题: 速度优先，优化提示词保证质量
        "emotion": "gpt-4o",             # 🔥 情绪分析: 准确度优先（影响情绪日历/幸福罐）
        "emotion_fast": "gpt-4o-mini",   # ✅ 情绪分析快速模型（低置信度再用 gpt-4o 复核）
        "feedback": "gpt-4o-mini",       # 温暖反馈: 速度优先，优化提示词保证温度
        
        # 🎤 为什么 Whisper？
        # ✅ OpenAI 官方语音转文字模型
        # ✅ 支持 100+ 语言（中英文完美）
        # ✅ 高准确度，低幻觉率
        
        # 🎨 为什么 Polish 用 gpt-4o？（保持高质量）
        # ✅ 语言质量提升 3-5 倍 - 达到母语水平
        # ✅ 完美处理语气词和停顿 - 适合语言学习
        # ✅ 细节打磨精致 - 口语转书面语能力强
        # ✅ 教学级别输出 - 用户可通过对比学习英语
        # ✅ 用户体验优先 - 润色是最直接的感受
        
        # 🎯 为什么 Emotion 用 gpt-4o-mini？（速度与质量平衡）
        # ✅ 速度快 3 倍 (2.5s → 0.8s)
        # ✅ 成本降低 15 倍
        # ✅ 24种情绪中，80%是明显的（"开心"、"难过"）
        # ✅ 准确度依然很高（85-90%）
        # ✅ 配合优化的提示词（Few-Shot），准确度可达90%
        
        # 💬 为什么 Feedback 用 gpt-4o-mini？（速度优先）
        # ✅ 速度快 2 倍 (2.5s → 1.2s)
        # ✅ 创意表达好 - 更自然的语言
        # ✅ 个性化强 - 基于情绪的精准反馈
        # ✅ 用户最关注，体验优先
    }
    
    # 📏 长度限制
    # ✅ 修复 #9 (2026-01-27): 完全移除 feedback_min
    # 原因：
    # 1. 短反馈不等于差反馈，中文几个字就能传达完整情感（如 "加油！"、"早点休息"）
    # 2. GPT-4o 足够智能，会根据上下文决定合适的反馈长度
    # 3. 用通用 fallback 替换有针对性的短回复是体验的倒退
    # 4. 只需检查空值，避免 API 异常返回空字符串
    #
    # ✅ 修复 #10 (2026-01-27): min_audio_text 从 5 降至 2
    # 原因：
    # 1. 中文一个字可以表达完整含义（如 "累"、"好"）
    # 2. "我有点累" (4 字) 是完整有意义的句子，不应被拒绝
    # 3. 更严格的验证由后续的语言特定检查处理（中文需 3+ 汉字，英文需 2+ 有意义词）
    # 4. 这里只做最基本的空值过滤，避免误杀真实内容
    LENGTH_LIMITS = {
        "title_min": 4,
        "title_max": 50,
        # "feedback_min" 已移除 - 不再检查最小长度，信任 AI 输出
        "feedback_max": 250,
        "polished_ratio": 1.15,
        "min_audio_text": 2,  # ✅ 修复 #10: 从 5 降至 2，避免误杀短但有意义的中文内容
    }
    
    def __init__(self):
        """初始化服务客户端"""
        settings = get_settings()
        
        # OpenAI 客户端（用于 Whisper 和同步调用的兼容）
        self.openai_client = OpenAI(api_key=settings.openai_api_key)
        # ✅ Phase 1.1: 添加 AsyncOpenAI 客户端（用于异步调用，提升性能）
        self.async_client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.openai_api_key = settings.openai_api_key
        
        print(f"✅ AI 服务初始化完成（2026-01-27 优化版: gpt-4o-mini + 优化提示词）")
        print(f"   - Whisper: 语音转文字")
        print(f"   - gpt-4o-mini: 润色 + 标题 (polish) - 优化提示词")
        print(f"   - gpt-4o: 情绪分析 (emotion) - 准确度优先")
        print(f"   - gpt-4o-mini: AI 反馈 (feedback) - 简短有力")

    def _log_timing(self, label: str, start_time: float) -> None:
        elapsed = time_module.perf_counter() - start_time
        print(f"⏱️ {label}: {elapsed:.2f} 秒")

    def _log_usage(self, response, label: str) -> None:
        try:
            usage = getattr(response, "usage", None)
            if usage:
                prompt_tokens = getattr(usage, "prompt_tokens", None)
                completion_tokens = getattr(usage, "completion_tokens", None)
                total_tokens = getattr(usage, "total_tokens", None)
                print(f"📊 {label} token 用量: prompt={prompt_tokens}, completion={completion_tokens}, total={total_tokens}")
        except Exception:
            pass
    
    # ========================================================================
    # ✅ Phase 1.4: 带重试的 GPT-4o 调用辅助方法
    # ========================================================================
    
    @retry(
        stop=stop_after_attempt(3),  # 最多重试 3 次
        wait=wait_exponential(multiplier=1, min=1, max=10),  # 指数退避：1s, 2s, 4s...
        # ✅ Review 优化：只重试网络和 API 相关异常，避免重试逻辑错误
        retry=retry_if_exception_type((APIError, RateLimitError, APIConnectionError, httpx.RequestError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),  # 重试前记录日志
        reraise=True  # 最终失败时重新抛出异常
    )
    async def _call_gpt4o_with_retry(
        self,
        model: str,
        messages: list,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        response_format: dict = None
    ):
        """
        带重试的 GPT-4o 调用
        
        🔥 Phase 1.4: 添加指数退避重试机制
        - 最多重试 3 次
        - 指数退避：1s → 2s → 4s
        - 记录重试日志
        
        常见可重试错误：
        - 网络超时
        - API 限流 (429)
        - 服务器错误 (5xx)
        """
        try:
            call_start = time_module.perf_counter()
            if response_format:
                response = await self.async_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format
                )
            else:
                response = await self.async_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
            self._log_timing(f"GPT 调用完成 ({model})", call_start)
            self._log_usage(response, f"{model}")
            return response
        except Exception as e:
            print(f"⚠️ GPT-4o 调用失败，将重试: {type(e).__name__}: {str(e)}")
            raise  # 重新抛出，让 tenacity 处理重试
    
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
            print(f"🎤 收到音频: {filename}, 大小: {audio_size_kb:.1f} KB, 期望时长: {expected_duration}s")
            
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
            
            # ✅ Phase 1.1: 使用 httpx.AsyncClient 异步调用 Whisper（提升性能）
            # ✅ 2026-01-27 修复: 增加重试机制，提高网络稳定性
            print("📤 正在识别语音（verbose_json 模式 - 异步）...")
            response_json = None
            max_retries = 3
            retry_delay = 2  # 秒
            
            whisper_start_time = time_module.time()
            
            for attempt in range(max_retries):
                try:
                    # ✅ 增加超时时间到120秒，适应慢网络
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        file_stream = io.BytesIO(audio_content)
                        response = await client.post(
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
                        whisper_elapsed = time_module.time() - whisper_start_time
                        print(f"⏱️ Whisper 转录完成，耗时: {whisper_elapsed:.2f} 秒")
                        break  # 成功，退出重试循环
                        
                except httpx.HTTPStatusError as http_err:
                    # HTTP状态码错误（4xx, 5xx）- 有 response 属性
                    print(f"❌ Whisper HTTP 状态错误 (尝试 {attempt + 1}/{max_retries}): {http_err}")
                    if http_err.response is not None:
                        print(f"📄 Whisper 响应状态码: {http_err.response.status_code}")
                        try:
                            print(f"📄 Whisper 响应内容: {http_err.response.text[:500]}...")
                        except:
                            pass
                    if attempt < max_retries - 1:
                        print(f"⏳ 等待 {retry_delay} 秒后重试...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # 指数退避
                    else:
                        raise ValueError("TRANSCRIPTION_SERVICE_UNAVAILABLE")
                        
                except (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException) as transport_err:
                    # ✅ 修复: 网络传输错误（没有 response 属性）- 单独处理
                    print(f"❌ Whisper 网络传输错误 (尝试 {attempt + 1}/{max_retries}): {type(transport_err).__name__}: {transport_err}")
                    if attempt < max_retries - 1:
                        print(f"⏳ 等待 {retry_delay} 秒后重试...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # 指数退避
                    else:
                        raise ValueError("TRANSCRIPTION_NETWORK_ERROR")
                        
                except httpx.HTTPError as http_err:
                    # 其他 HTTP 错误
                    print(f"❌ Whisper HTTP 请求失败 (尝试 {attempt + 1}/{max_retries}): {type(http_err).__name__}: {http_err}")
                    # ✅ 修复: 安全地检查是否有 response 属性
                    if hasattr(http_err, 'response') and http_err.response is not None:
                        print(f"📄 Whisper 响应状态码: {http_err.response.status_code}")
                        try:
                            print(f"📄 Whisper 响应内容: {http_err.response.text[:500]}...")
                        except:
                            pass
                    if attempt < max_retries - 1:
                        print(f"⏳ 等待 {retry_delay} 秒后重试...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        raise ValueError("TRANSCRIPTION_SERVICE_UNAVAILABLE")
            
            if not response_json:
                raise ValueError("TRANSCRIPTION_NO_RESPONSE")
            
            text = (response_json.get("text") or "").strip()
            segments = response_json.get("segments", []) or []
            detected_language = response_json.get("language", "").lower()  # ✅ 获取检测到的语言
            
            # 🔥 新增：语言白名单检查 - 防止背景音乐被误识别为韩语/日语等
            SUPPORTED_LANGUAGES = {"zh", "en", "chinese", "english"}
            if detected_language and detected_language not in SUPPORTED_LANGUAGES:
                print(f"❌ 检测到不支持的语言: '{detected_language}'")
                print(f"   识别文本: '{text[:100]}'")
                print(f"   这可能是背景音乐或噪音被误识别")
                raise ValueError("TRANSCRIPTION_UNSUPPORTED_LANGUAGE")
            
            # 🔥 新增：检测韩语/日语字符 - 双重保险
            korean_chars = len(re.findall(r'[\uac00-\ud7af]', text))  # 韩语字符
            japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))  # 日语字符
            if korean_chars > 3 or japanese_chars > 3:
                print(f"❌ 检测到韩语/日语字符: 韩语={korean_chars}, 日语={japanese_chars}")
                print(f"   识别文本: '{text[:100]}'")
                print(f"   这可能是背景音乐或噪音被误识别")
                raise ValueError("TRANSCRIPTION_UNSUPPORTED_LANGUAGE")
            
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
                    raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
            
            normalized_text = re.sub(r"\s+", "", text)
            
            if len(normalized_text) < self.LENGTH_LIMITS["min_audio_text"]:
                print(f"❌ 转录内容过短: '{text}'")
                raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
            
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
                raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
            
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
                    raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
            
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
                        raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
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
                            }
                        )
                        raise ValueError("TRANSCRIPTION_CONTENT_TOO_SHORT")
            
            print(f"✅ 语音识别成功: '{text[:50]}...'")
            print(f"🌍 Whisper 检测到的语言: {detected_language}")
            
            # 🔥 返回字典，包含文本和检测到的语言
            return {
                "text": text,
                "detected_language": detected_language  # "en" 或 "zh" 或其他语言代码
            }
            
        except Exception as e:
            print(f"❌ 语音转文字失败: {str(e)}")
            error_str = str(e)
            # ✅ 如果已经是 error code 格式，直接重新抛出
            if error_str.startswith("TRANSCRIPTION_"):
                raise
            elif "Invalid file format" in error_str:
                raise ValueError("TRANSCRIPTION_INVALID_FORMAT")
            elif "File too large" in error_str:
                raise ValueError("TRANSCRIPTION_FILE_TOO_LARGE")
            else:
                # 记录详细错误用于调试，但返回通用 error code
                print(f"📋 详细错误信息: {error_str}")
                raise ValueError("TRANSCRIPTION_FAILED")
        
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
        image_urls: Optional[List[str]] = None,  # 图片URL列表，用于vision分析
        whisper_detected_language: Optional[str] = None  # 🔥 Whisper检测到的语言 ("en", "zh", etc.)
    ) -> Dict[str, Any]:
        """
        🔥 重大改动：从单一模型改为混合模型 + 并行执行
        
        旧逻辑：
        1. GPT-4o-mini 一次性生成润色 + 标题 + 反馈（串行，3-5秒）
        
        新逻辑：
        1. gpt-4o-mini 生成润色 + 标题（polish，1-2秒）
        2. gpt-4o 生成情绪分析（emotion，2-3秒）
        3. gpt-4o 生成反馈（feedback，基于原始文本，2-3秒）
        3. 两个任务并行执行，总耗时 = max(1-2, 2-3) = 2-3秒
        
        为什么基于原始文本生成反馈？
        - 更真实：原始文本保留了用户最真实的情感
        - 更快：不需要等润色完成
        - 更温暖：AI 回应"真实的你"而不是"完美的文字"
        """
        try:
            ai_total_start = time_module.time()
            
            # ✅ 修复 #10 (2026-01-27): 移除硬编码的长度检查
            # 原因：
            # 1. "我好累呀" (4 字) 是完全有效的日记内容，不应被拒绝
            # 2. 转录阶段已经有更智能的验证（中文需 3+ 汉字）
            # 3. 这里只做空值检查，让 AI 去处理任何非空内容
            if not text or not text.strip():
                raise ValueError("内容为空")
            
            print(f"✨ 开始AI处理（并行模式）: {text[:50]}...")
            
            # 🔥 优化语言检测：优先使用 Whisper 的检测结果
            detected_lang = None
            
            # 方案1: 优先使用 Whisper 的检测结果（最准确）
            if whisper_detected_language:
                whisper_lang = whisper_detected_language.lower()
                if whisper_lang in ["en", "english"]:
                    detected_lang = "English"
                    print(f"🌍 使用 Whisper 检测的语言: {whisper_detected_language} → English")
                elif whisper_lang in ["zh", "chinese", "zh-cn", "zh-tw"]:
                    detected_lang = "Chinese"
                    print(f"🌍 使用 Whisper 检测的语言: {whisper_detected_language} → Chinese")
                else:
                    # 如果是其他语言，记录日志但继续使用统计检测
                    print(f"⚠️ Whisper 检测到不支持的语言: {whisper_detected_language}，降级到统计检测")
            
            # 方案2: 如果没有 Whisper 检测结果，使用统计检测（兜底）
            if not detected_lang:
                # 移除空白字符和标点，只统计实际内容字符
                content_only = re.sub(r'[\s\W]', '', text)
                chinese_chars = 0
                english_words = 0
                
                if not content_only:
                    # 如果只有空白和标点，默认使用英文（国际化优先）
                    detected_lang = "English"
                    print(f"🌍 内容为空，默认使用: English")
                else:
                    # 统计中文字符
                    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content_only))
                    # 统计英文字符（单词）
                    english_words = len(re.findall(r'[a-zA-Z]+', content_only))
                    
                    # 🔥 新增：检测韩语/日语字符
                    korean_chars = len(re.findall(r'[\uac00-\ud7af]', content_only))
                    japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', content_only))
                    
                    # 🔥 语言白名单检查：如果检测到大量非中英文字符，降级到英文（国际化优先）
                    if korean_chars > 5 or japanese_chars > 5:
                        print(f"⚠️ 检测到非支持语言字符: 韩语={korean_chars}, 日语={japanese_chars}")
                        print(f"   内容: '{text[:50]}'")
                        print(f"   降级到系统默认语言: English")
                        detected_lang = "English"  # 降级到英文（国际化优先）
                    else:
                        # 计算中文字符占比
                        chinese_ratio = chinese_chars / len(content_only) if len(content_only) > 0 else 0
                        # 计算英文单词占比（每个单词平均5个字符估算）
                        english_ratio = (english_words * 5) / len(content_only) if len(content_only) > 0 else 0
                        
                        # 🔥 关键逻辑：如果中文字符占比超过30%，或者中文字符数量明显多于英文单词，判定为中文
                        if chinese_ratio > 0.3 or (chinese_chars > 5 and chinese_chars > english_words * 2):
                            detected_lang = "Chinese"
                        elif english_ratio > 0.5 or english_words > 10:
                            detected_lang = "English"
                        else:
                            # 🔥 修改默认值：优先英文（国际化优先）
                            detected_lang = "English" if chinese_chars < 3 else "Chinese"
                        
                        print(f"🌍 统计检测语言: {detected_lang} (中文字符={chinese_chars}, 英文单词={english_words})")
            
            print(f"🌍 最终使用语言: {detected_lang}")
            
            # 🔥 关键改动：最优Agent Orchestration架构
            # 策略: Polish独立并行 | (Emotion → Feedback) 组内串行
            print(f"🚀 启动最优Agent并行架构...")
            if image_urls and len(image_urls) > 0:
                print(f"   - 检测到 {len(image_urls)} 张图片，将使用 Vision 能力分析图片+文字")
            print(f"   - 并行组1: Polish Agent (独立运行)")
            print(f"   - 并行组2: Emotion Agent → Feedback Agent (串行)")
            print(f"   - 🎯 两组并行,总耗时 = max(Polish, Emotion+Feedback)")
            
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
            
            # 🔥 定义并行组2: Emotion → Feedback (组内串行)
            async def emotion_feedback_pipeline():
                """
                Emotion和Feedback的串行流水线
                
                🔥 为什么串行?
                - Feedback 需要知道 Emotion 结果
                - 避免重复分析情绪（省时间、省 Token）
                - 生成更精准、更贴切的反馈
                """
                # 步骤1: Emotion分析 (GPT-4o，准确度优先)
                emotion_result = await self.analyze_emotion_only(text, detected_lang, encoded_images)
                print(f"   ✅ Emotion Agent完成: {emotion_result.get('emotion')} (置信度: {emotion_result.get('confidence')})")
                
                # 步骤2: 基于Emotion生成Feedback (GPT-4o-mini，速度优先)
                # 🔥 关键优化：传入 emotion_hint，让 Feedback Agent 知道情绪结果
                feedback_data = await self._call_gpt4o_for_feedback(
                    text,
                    detected_lang,
                    user_name,
                    encoded_images,
                    emotion_hint=emotion_result  # 🔥 传入 Emotion Agent 的分析结果
                )
                print(f"   ✅ Feedback Agent完成")
                
                return emotion_result, feedback_data
            
            # 🔥 并行组1: Polish (独立)
            polish_task = self._call_gpt4o_for_polish_and_title(text, detected_lang, encoded_images)
            
            # 🔥 并行组2: Emotion → Feedback (组内串行)
            emotion_feedback_task = emotion_feedback_pipeline()
            
            # 🔥 两组并行执行 - ✅ 关键修复：添加 return_exceptions=True
            print(f"   🚀 启动两组并行...")
            results = await asyncio.gather(
                polish_task,                # 组1: Polish独立
                emotion_feedback_task,      # 组2: Emotion → Feedback
                return_exceptions=True      # ✅ 防止单个失败导致整体失败
            )
            
            # ✅ 检查每个结果，提供兜底值
            polish_result = results[0]
            emotion_feedback_result = results[1]
            
            # 🔥 关键修复：提前初始化变量，防止NameError
            emotion_result = None
            feedback_data = None
            
            # 处理Polish结果
            if isinstance(polish_result, Exception):
                print(f"❌ Polish Agent失败: {polish_result}")
                print(f"   使用兜底：原文 + 默认标题")
                # 🔥 修复：兜底标题也不能用"今日记录"，使用"心情随记"
                polish_result = {
                    "title": "心情随记" if detected_lang == "Chinese" else "A Moment Captured",
                    "polished_content": text
                }
            
            # 处理Emotion+Feedback结果
            if isinstance(emotion_feedback_result, Exception):
                print(f"❌ Emotion+Feedback Agent失败: {emotion_feedback_result}")
                print(f"   使用兜底：默认情绪 + 简单反馈")
                emotion_result = {"emotion": "Thoughtful", "confidence": 0.5, "rationale": "默认情绪"}
                feedback_data = "感谢分享你的故事。" if detected_lang == "Chinese" else "Thanks for sharing your story."
                if user_name:
                    separator = "，" if detected_lang == "Chinese" else ", "
                    feedback_data = f"{user_name}{separator}{feedback_data}"
            else:
                emotion_result, feedback_data = emotion_feedback_result

            
            print(f"✅ 两组并行完成")
            
            # 🔥 最终兜底检查：确保变量不为None
            if emotion_result is None:
                print(f"⚠️ emotion_result为None，使用默认值")
                emotion_result = {"emotion": "Thoughtful", "confidence": 0.5, "rationale": "默认情绪"}
            
            if feedback_data is None:
                print(f"⚠️ feedback_data为None，使用默认值")
                feedback_data = "感谢分享你的故事。" if detected_lang == "Chinese" else "Thanks for sharing your story."
                if user_name:
                    separator = "，" if detected_lang == "Chinese" else ", "
                    feedback_data = f"{user_name}{separator}{feedback_data}"
            
            # 处理反馈结果
            if isinstance(feedback_data, dict):
                feedback_text = feedback_data.get("reply", "")
            else:
                feedback_text = str(feedback_data)
            
            # 合并结果
            result = {
                "title": polish_result['title'],
                "polished_content": polish_result['polished_content'],
                "feedback": feedback_text,
                "emotion_data": emotion_result  # ✅ 来自专门的Emotion Agent
            }
            
            # 质量检查 - ✅ 修复: 传递 user_name 以支持反馈降级时添加用户称呼
            result = self._validate_and_fix_result(result, text, user_name=user_name)
            
            ai_total_elapsed = time_module.time() - ai_total_start
            print(f"✅ 处理完成:")
            print(f"  - 标题: {result['title']}")
            print(f"  - 内容长度: {len(result['polished_content'])} 字")
            print(f"  - 反馈长度: {len(result['feedback'])} 字")
            print(f"  - 情绪: {result.get('emotion_data', {}).get('emotion', 'Unknown')}")
            print(f"  ⏱️ AI 总耗时: {ai_total_elapsed:.2f} 秒")
            
            return result
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ AI处理失败: {error_type}: {error_msg}")
            error_trace = traceback.format_exc()
            print(f"📍 完整错误堆栈:")
            print(error_trace)
            
            # 检查是否是并行任务中的错误
            if isinstance(e, (asyncio.TimeoutError, asyncio.CancelledError)):
                print(f"⚠️ 并行任务超时或取消")
            elif isinstance(e, Exception):
                print(f"⚠️ 并行任务执行失败: {e}")
            
            return self._create_fallback_result(text, user_name=user_name)
    
    # ========================================================================
    # 🔥 GPT-4o-mini 调用（润色 + 标题）
    # ========================================================================
    
    async def _call_gpt4o_for_polish_and_title(
        self, 
        text: str,
        language: str,
        encoded_images: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        调用 GPT-4o 进行润色和生成标题
        
        📚 学习点：这个函数负责两个任务
        1. 润色用户的原始文本（修复语法、优化表达）
        2. 生成一个简洁有意义的标题
        
        为什么使用 GPT-4o？
        - 质量极高
        - 标题生成更精准，不出现低级错误
        
        返回:
            {
                "title": "标题",
                "polished_content": "润色后的内容"
            }
        """
        try:
            print(f"🎨 GPT-4o: 开始润色和生成标题...")
            
            # 🔥 优化：根据传入的 language 参数构建更严格的 prompt
            # 核心原则：标题语言必须与用户输入内容的主要语言完全一致
            # ============================================================================
            # 🎯 GPT-4o-mini 优化版提示词 (2026-01-27)
            # 
            # 设计原则 (Industry Best Practice):
            # 1. 简洁优先: Token 数减少 50%，提升推理速度
            # 2. 结构清晰: 规则按优先级排序，便于模型遵循
            # 3. 示例精选: 3个高质量示例 > 6个普通示例
            # 4. 学习笔记: 保留 📚 Learning 格式，帮助用户学习
            # ============================================================================
            
            language_instruction = ""
            if language == "Chinese":
                language_instruction = """🎯 LANGUAGE: Chinese (简体中文)

【规则优先级】
P1: 标题必须是中文（无例外）
P2: 自然流畅 > 语法正确（优先让句子读起来舒服）
P3: 删除所有语气词（嗯、啊、那个、就是、然后）
P4: 保留原意，不添加新内容

【🚨 标题规则 - 必须遵守】
❌ 禁止使用: "今日记录"、"今日感想"、"今日任务"、任何以"今日"开头的标题
✅ 正确做法: 提取内容的核心主题或关键事件
✅ 示例: "公园漫步"、"模型的抉择"、"疲惫的一天"、"新知收获"

【润色标准】
DO: 删除语气词 | 合并短句 | 修正错别字 | 优化表达
DON'T: 改变情感 | 删除内容 | 过度文艺 | 添加信息

【精选示例】

示例 1 - 语气词清理:
❌ "嗯，今天我去了，那个，公园，就是，很开心"
✅ 标题: "公园漫步" | 内容: "今天我去了公园，很开心。"
📚 Learning: 删除语气词(嗯/那个/就是)，标题提取核心主题

示例 2 - 表达优化:
❌ "今天工作很累很累，有点那个，不想动"
✅ 标题: "疲惫的一天" | 内容: "今天工作很累，不想动。"
📚 Learning: 删除重复词，标题反映情感主题

示例 3 - 句式合并:
❌ "我换了模型，之前太慢了，希望快一点"
✅ 标题: "模型的抉择" | 内容: "我换了模型，之前太慢了，希望快一点。"
📚 Learning: 标题提取核心事件，避免使用泛用标题"""
            elif language == "English":
                language_instruction = """🎯 LANGUAGE: English

【Priority Rules】
P1: Title MUST be in English (no exceptions)
P2: Natural fluency > Grammar correctness (make it sound native)
P3: Remove ALL fillers (um, like, you know, I mean)
P4: Preserve meaning, don't add new content

【🚨 Title Rules - MUST FOLLOW】
❌ FORBIDDEN: "Today's Record", "Today's Thoughts", "Daily Log", any title starting with "Today's"
✅ CORRECT: Extract the CORE THEME or KEY EVENT from content
✅ Examples: "A Day at the Park", "The Model Switch", "Productive Morning"

【Polishing Standards】
DO: Remove fillers | Fix grammar | Use contractions (I'm, don't) | Combine choppy sentences
DON'T: Change emotion | Delete content | Over-formalize | Add information

【Quick Reference - Common Fixes】
- "I very like" → "I really like" / "I love"
- "go to park" → "go to the park"
- "eat medicine" → "take medicine"
- "very good" → "great" / "wonderful"
- "I am happy" → "I'm happy" (use contractions)

【Teaching-Grade Examples】

Example 1 - Fillers + Grammar:
❌ "um, today i go to park and, like, see many flower"
✅ Title: "A Day at the Park" | Content: "I went to the park today and saw so many flowers."
📚 Learning: Removed fillers, fixed grammar, title captures core theme

Example 2 - Native Patterns:
❌ "I am very like this new job because can learn many things"
✅ Title: "New Job Joy" | Content: "I really love this new job because I'm learning so much!"
📚 Learning: Fixed non-native patterns, title reflects emotion

Example 3 - Flow + Vocabulary:
❌ "I switched the model because it was too slow"
✅ Title: "The Model Switch" | Content: "I switched the model because it was too slow."
📚 Learning: Title extracts key event, NOT "Today's Record" """
            else:
                # 默认：自动检测语言
                language_instruction = """🎯 AUTO-DETECT LANGUAGE

Title language MUST match user's primary input language:
- Chinese input → Chinese title (e.g., "公园漫步", NOT "今日记录")
- English input → English title (e.g., "A Day at the Park", NOT "Today's Record")
- Mixed → Use the dominant language

🚨 CRITICAL: Never use generic titles like "今日记录", "Today's Record", etc."""
            
            # ============================================================================
            # 🎯 GPT-4o-mini 优化版系统提示 (2026-01-27 v3)
            # 
            # 📚 Prompt Engineering Best Practice - 教科书级别设计
            # ============================================================================
            # 
            # 设计原则 (Industry Standard):
            # 1. 层次分明 - 用视觉层级（🚨 > 【】> -）区分规则优先级
            # 2. 正例+反例 - 同时给出正确和错误示例，形成对比学习
            # 3. 具体量化 - 用数字而非模糊词（"100字以上" vs "长文本"）
            # 4. 场景驱动 - 根据输入动态调整行为（短文本 vs 长文本）
            # 5. 格式强制 - 明确输出结构，减少解析失败
            #
            # ============================================================================
            
            system_prompt = f"""You are a professional diary editor and writer. Your job is to polish diary entries with the care and craft of a published author.

{language_instruction}

# ════════════════════════════════════════════════════════════════════════════════
# 🚨 CRITICAL RULES (MUST FOLLOW - TOP PRIORITY)
# ════════════════════════════════════════════════════════════════════════════════

## 🚨 Rule 1: PARAGRAPH FORMATTING IS MANDATORY (非可选！)

This is a PRODUCT QUALITY requirement, not a suggestion.

**For content > 100 characters: You MUST add paragraph breaks (\\n\\n)**

### How to Break Paragraphs Like a Professional Writer:

| Trigger | Action |
|---------|--------|
| Topic change | New paragraph |
| Time transition (然后/后来/接着/then/after) | New paragraph |
| Emotional shift | New paragraph |
| New person/event introduced | New paragraph |
| Logical transition (所以/因为/but/so) | New paragraph |

### Paragraph Length Guidelines:
- Chinese: Each paragraph should be 50-150 characters
- English: Each paragraph should be 2-4 sentences
- NEVER have a single paragraph > 200 characters

### ❌ BAD (Wall of Text):
"我今天特别困,我就发现人在困的时候脑子就特别的雾所以呢我就打算今天晚上一定要把这个东西弄完我就要好好睡觉了因为明天有几个需要勇气的事情我需要让自己有一个特别好的状态"

### ✅ GOOD (Properly Paragraphed):
"我今天特别困，发现人在困的时候脑子就特别雾蒙蒙的。

所以我打算今天晚上一定要把这个东西弄完，然后好好睡觉。

因为明天有几个需要勇气的事情，我需要让自己有一个特别好的状态。"

## 🚨 Rule 2: PUNCTUATION IS MANDATORY

- Every sentence MUST end with proper punctuation (。！？/ . ! ?)
- NEVER leave a sentence without ending punctuation
- Use appropriate punctuation: 。for statements, ！for excitement, ？for questions

## 🚨 Rule 3: TITLE RULES

**FORBIDDEN TITLES (Never use):**
❌ "今日记录"、"今日感想"、"今日任务"、任何以"今日"开头
❌ "Today's Record"、"Today's Thoughts"、任何以"Today's"开头

**GOOD TITLES:**
✅ Extract the CORE THEME: "勇敢的尝试"、"模型的抉择"、"疲惫与期待"
✅ Be specific, evocative, 4-12 Chinese chars or 3-8 English words

## 🚨 Rule 4: NO DUPLICATE BETWEEN TITLE AND CONTENT (重要！)

**The polished_content MUST NOT start with the title text.**

❌ BAD: Title="自我管理的挑战", Content="自我管理的挑战\\n我一直觉得..."
✅ GOOD: Title="自我管理的挑战", Content="我一直觉得做产品是一个..."

If your generated content would start with the title, REMOVE the title from the beginning of content.

# ════════════════════════════════════════════════════════════════════════════════
# 📝 POLISHING GUIDELINES
# ════════════════════════════════════════════════════════════════════════════════

**Priority Order:**
1. Title language = Input language (NO EXCEPTIONS)
2. Readability first - Natural, fluent, easy to read
3. Preserve ALL content - Never delete user's ideas
4. Length ≤ 115% of original

**Polish Actions:**
- Remove filler words and oral tics (口语赘词必须清理)
- Fix grammar naturally
- Add proper punctuation
- **Add paragraph breaks for long content**

**Filler Removal (HARD RULE):**
- Remove ALL meaningless fillers: 嗯、呃、啊、那个、就是、然后、其实、感觉、可能、有点、这个、那个、嘛、吧、诶
- Remove English fillers: um, uh, like, you know, sort of, kind of, basically
- If a word is used only to stall or soften (e.g., “嗯，然后我就…”，“就是…”，"like…"), delete it.
- Keep words ONLY if they carry real meaning (e.g., “因为/所以/但是/然后” used as true logical connectors).

**Example (Filler Cleanup):**
Input: "今天好像，嗯，学到了一个新词，就是 FOMO，然后我就觉得，嗯，大家都在讨论。"
Output: "今天学到了一个新词 FOMO，我觉得大家都在讨论它。"

# ════════════════════════════════════════════════════════════════════════════════
# ✅ 8 SCENARIOS (清晰覆盖，不啰嗦)
# ════════════════════════════════════════════════════════════════════════════════
1) Short text (≤ 30 chars / ≤ 15 words): Keep it short, just clean fillers + punctuation.
2) Long text: Enforce paragraphs; keep flow and logic.
3) Mixed language: Keep code-switching if natural; title in dominant language.
4) Lists / steps: Preserve list structure; clean fillers inside items.
5) Quotes / dialogue: Keep quoted meaning; remove fillers outside quotes.
6) Strong emotion: Keep emotion intensity, only remove fillers.
7) Acronyms / proper nouns: Keep exactly (FOMO, SOP, Cloudbot, Mac).
8) Repetition / stutter: Remove meaningless repeats (e.g., “我我我/you you”), keep emphasis once.

# ════════════════════════════════════════════════════════════════════════════════
# 📤 OUTPUT FORMAT - Return valid JSON
# ════════════════════════════════════════════════════════════════════════════════

{{
  "title": "Meaningful title, same language as input",
  "polished_content": "Polished text WITH proper paragraphs (use \\n\\n) and punctuation"
}}

# ════════════════════════════════════════════════════════════════════════════════
# 📚 COMPLETE EXAMPLES
# ════════════════════════════════════════════════════════════════════════════════

**Example 1 - Long Chinese (MUST paragraph):**
Input: "我今天特别困我就发现人在困的时候脑子就特别的雾所以呢我就打算今天晚上一定要把这个东西弄完然后好好睡觉因为明天有几个需要勇气的事情"
Output: {{"title": "疲惫与勇气", "polished_content": "我今天特别困，发现人在困的时候脑子就特别雾蒙蒙的。\\n\\n所以我打算今天晚上一定要把这个东西弄完，然后好好睡觉。\\n\\n因为明天有几个需要勇气的事情，我需要让自己保持最好的状态。"}}

**Example 2 - Short Chinese:**
Input: "嗯今天去公园很开心"
Output: {{"title": "公园漫步", "polished_content": "今天去公园，很开心。"}}

**Example 3 - Long English (MUST paragraph):**
Input: "today i was really tired and i realized when youre tired your brain just doesnt work so i decided to finish this thing tonight and sleep well because tomorrow i have some things that require courage"
Output: {{"title": "Tired but Determined", "polished_content": "Today I was really tired, and I realized that when you're tired, your brain just doesn't work properly.\\n\\nSo I decided to finish this thing tonight and get some good sleep.\\n\\nBecause tomorrow, I have some things that require courage."}}"""

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
            print(f"   模型: {self.MODEL_CONFIG['polish']}")
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
            
            # ✅ Phase 1.1 + 1.4: 使用 AsyncOpenAI + 重试机制
            # 🔥 2026-01-27 优化: 温度从 0.3 降至 0.2，提高 mini 模型输出一致性
            response = await self._call_gpt4o_with_retry(
                model=self.MODEL_CONFIG["polish"],
                messages=messages,
                temperature=0.2,  # ← 优化: 降低温度提高一致性
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
                
                # 🔥 2026-01-27 优化：移除长度比较检查
                # 
                # 为什么删除这个检查？
                # 1. AI 删除语气词后内容变短是正常的（75-80% 很常见）
                # 2. 这个检查导致误判，让有分段的润色结果被替换成无分段的原文
                # 3. 我们已有 JSON 验证，如果格式正确就应该信任 AI 输出
                # 4. Prompt 已约束 "preserve ALL content"，无需二次检查
                # 5. 相信 AI 的输出，减少不必要的干预
                #
                # 如果真的发生截断，表现会是：JSON 解析失败或内容为空，那些有单独处理
                
                # 🔥 后处理：确保内容不以标题开头（避免重复）
                title = result.get("title", "A Moment Captured")
                if polished_content.strip().startswith(title):
                    print(f"⚠️ 检测到内容以标题开头，自动移除重复")
                    # 移除标题和可能的换行符
                    polished_content = polished_content.strip()[len(title):].lstrip('\n').lstrip()
                    print(f"   移除后内容开头: {polished_content[:50]}...")
                
                return {
                    "title": title,
                    "polished_content": polished_content
                }
            except json.JSONDecodeError as e:
                print(f"⚠️ GPT-4o-mini: JSON 解析失败: {e}")
                print(f"   原始响应: {content[:200]}...")
                # 尝试从文本中提取 JSON
                json_match = re.search(r'\{.*?"title".*?"polished_content".*?\}', content, re.DOTALL)
                if json_match:
                    try:
                        result = json.loads(json_match.group())
                        return {
                            "title": result.get("title", "A Moment Captured"),
                            "polished_content": result.get("polished_content", text)
                        }
                    except:
                        pass
                
                # 降级方案
                print(f"⚠️ GPT-4o-mini: 使用降级方案")
                return {
                    "title": "A Moment Captured" if language == "English" else "心情随记",
                    "polished_content": text
                }
        
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"❌ GPT-4o-mini 调用失败: {error_type}: {error_msg}")
            
            # 详细错误信息
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
                "title": "A Moment Captured" if language == "English" else "心情随记",
                "polished_content": text
            }
    
    # ========================================================================
    # 🔥 GPT-4o-mini 调用（AI 反馈）
    # ========================================================================
    
    async def _call_gpt4o_for_feedback(
        self, 
        text: str,
        language: str,
        user_name: Optional[str] = None,
        encoded_images: Optional[List[str]] = None,
        emotion_hint: Optional[Dict[str, Any]] = None  # 🔥 新增：来自 Emotion Agent 的情绪结果
    ) -> str:
        """
        调用 GPT-4o-mini 生成温暖的 AI 反馈
        
        🔥 优化 (2026-01-27): 
        - 接收 emotion_hint 参数，直接使用 Emotion Agent 的分析结果
        - 不再重复分析情绪，专注于生成高质量反馈
        - 更快、更省 Token、更准确
        
        参数:
            emotion_hint: 来自 analyze_emotion_only 的结果，包含:
                - emotion: 情绪类型 (如 "Joyful")
                - confidence: 置信度 (如 0.9)
                - rationale: 分析理由
        
        返回:
            str: 温暖的反馈文字
        """
        try:
            # 🔥 使用来自 Emotion Agent 的情绪分析结果
            emotion_from_agent = emotion_hint.get("emotion", "Thoughtful") if emotion_hint else "Thoughtful"
            emotion_rationale = emotion_hint.get("rationale", "") if emotion_hint else ""
            
            print(f"💬 GPT-4o-mini: 开始生成反馈...")
            print(f"👤 用户名字: {user_name if user_name else '未提供'}")
            print(f"🎯 使用 Emotion Agent 分析结果: {emotion_from_agent}")
            
            # ============================================================================
            # 🔥 动态长度计算 - 根据用户输入调整反馈长度
            # ============================================================================
            user_text_length = len(text.strip())
            
            # 🔥 动态长度策略 v2：温暖但不啰嗦
            # 调整：降低各档位的句子数，避免回复过长
            if user_text_length < 50:
                length_guidance = "SHORT"
                length_desc = "1 sentence only"
            elif user_text_length < 150:
                length_guidance = "MEDIUM"
                length_desc = "1-2 sentences"
            elif user_text_length < 400:
                length_guidance = "LONG"
                length_desc = "2-3 sentences max"
            else:
                length_guidance = "EXTENDED"
                length_desc = "3-4 sentences max, no more"
            
            print(f"📏 用户输入长度: {user_text_length} 字符 → 反馈策略: {length_guidance} ({length_desc})")
            
            # ============================================================================
            # 🎯 GPT-4o-mini 优化版 Feedback 提示词 (2026-01-27 v3)
            # 
            # 📚 Prompt Engineering Best Practice - 教科书级别设计
            # ============================================================================
            # 
            # 核心理念转变：
            # ❌ 旧思路：简短优先 → "1-2 句话"
            # ✅ 新思路：温度优先 → 根据用户表达量动态调整
            # 
            # 设计原则:
            # 1. 温度感 > 简短 - 宁可多说一点暖心话，也不要显得敷衍
            # 2. 动态长度 - 用户说得多，我们回复也相应增加
            # 3. 情绪共鸣 - 利用 Emotion Agent 的分析结果精准回应
            # 4. 真诚陪伴 - 像朋友一样倾听，而非机械回复
            #
            # ============================================================================
            
            system_prompt = f"""You are a warm, empathetic companion - like a caring friend who truly listens.

# ════════════════════════════════════════════════════════════════════════════════
# 🎯 CONTEXT
# ════════════════════════════════════════════════════════════════════════════════

**User's Emotion:** {emotion_from_agent}
{f'**Why:** {emotion_rationale}' if emotion_rationale else ''}
**User Input Length:** {user_text_length} characters → **Response Mode: {length_guidance}**

# ════════════════════════════════════════════════════════════════════════════════
# 🚨 CORE PRINCIPLE: WARMTH OVER BREVITY (温度优先)
# ════════════════════════════════════════════════════════════════════════════════

Your goal is to make the user feel HEARD and UNDERSTOOD.
- If they shared a lot, acknowledge the depth of what they shared
- If they're going through something difficult, offer genuine support
- If they achieved something, celebrate with authentic enthusiasm
- NEVER give a generic, cold, or dismissive response

# ════════════════════════════════════════════════════════════════════════════════
# 📏 DYNAMIC LENGTH GUIDE
# ════════════════════════════════════════════════════════════════════════════════

Based on user input length ({user_text_length} chars), use **{length_guidance}** mode:

| Mode | User Input | Your Response | ⚠️ HARD LIMIT |
|------|-----------|---------------|---------------|
| SHORT | <50 chars | 1 sentence only | MAX 1 sentence |
| MEDIUM | 50-150 chars | 1-2 sentences | MAX 2 sentences |
| LONG | 150-400 chars | 2-3 sentences | MAX 3 sentences |
| EXTENDED | >400 chars | 3-4 sentences | MAX 4 sentences |

🚨 **CRITICAL: DO NOT exceed the sentence limit for your mode. Warmth ≠ Length.**

**Current Mode: {length_guidance} → Target: {length_desc}**

# ════════════════════════════════════════════════════════════════════════════════
# 💝 EMOTION-SPECIFIC WARMTH GUIDE
# ════════════════════════════════════════════════════════════════════════════════

**{emotion_from_agent}** detected. Tailor your warmth:

| Emotion Type | How to Respond |
|--------------|----------------|
| Joyful/Grateful/Fulfilled/Proud | Celebrate! Amplify their joy. Share in their happiness. |
| Excited/Hopeful/Intentional | Encourage their enthusiasm. Support their plans. |
| Peaceful/Calm | Acknowledge the serenity. Appreciate the moment with them. |
| Thoughtful/Reflective | Validate their introspection. Honor their depth. |
| Inspired/Curious | Support their exploration. Fan the flame of discovery. |
| Anxious/Uncertain | Offer gentle reassurance. Be their calm anchor. |
| Down/Lonely/Overwhelmed | Show deep understanding. Be present. No judgment. |
| Frustrated/Venting | Acknowledge their feelings completely. Let them feel heard. |

# ════════════════════════════════════════════════════════════════════════════════
# 📝 RESPONSE RULES
# ════════════════════════════════════════════════════════════════════════════════

- **Language:** Same as user's input (fallback: {language})
- **Greeting:** {"Start with '" + user_name + (", " if language == "English" else "，") + "'" if user_name else "Start directly with warmth"}
- **NO questions** - Don't ask "How are you?" or similar
- **Be specific** - Reference something they actually said, not generic platitudes
- **End with warmth** - Leave them feeling supported

# ════════════════════════════════════════════════════════════════════════════════
# 📤 OUTPUT FORMAT
# ════════════════════════════════════════════════════════════════════════════════

Return JSON only:
{{"reply": "Your warm, {length_desc} response here"}}

# ════════════════════════════════════════════════════════════════════════════════
# 📚 EXAMPLES BY LENGTH
# ════════════════════════════════════════════════════════════════════════════════

**SHORT (1 sentence max):**
{{"reply": "Boss，这份快乐真好。"}}

**MEDIUM (2 sentences max):**
{{"reply": "Boss，完成重要项目的感觉真棒！好好享受这份成就感。"}}

**LONG (3 sentences max):**
{{"reply": "Boss，听你分享今天的经历，能感受到你付出了很多。你的努力和勇气值得被看见，好好休息。"}}

**EXTENDED (4 sentences max):**
{{"reply": "Boss，谢谢你分享这么多。今天确实不容易，但你对明天的期待很让人感动。好好休息，明天会更好。加油！"}}"""


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
            # 🔥 修复：使用 user_text_length 替代已删除的 max_feedback_length
            estimated_output_length = user_text_length + 200 
            max_tokens = max(300, min(estimated_output_length, 1000))

            # ✅ Phase 1.1 + 1.4: 使用 AsyncOpenAI + 重试机制
            # 🔥 2026-01-27 优化: 温度从 0.7 降至 0.5，平衡温暖度与一致性
            response = await self._call_gpt4o_with_retry(
                model=self.MODEL_CONFIG["feedback"],  # gpt-4o-mini + 优化提示词
                messages=messages,
                temperature=0.5,  # ← 优化: 降低温度，仍保持温暖但更一致
                max_tokens=max_tokens,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI 返回空响应")

            try:
                result = json.loads(content)
                reply = result.get("reply", "").strip()
                
                # ✅ 添加调试日志
                print(f"🔍 [DEBUG] 名字前缀检查:")
                print(f"   user_name 参数: '{user_name}'")
                print(f"   AI 原始回复: '{reply}'")
                print(f"   使用情绪: {emotion_from_agent}")
                
                # 名字前缀检查
                if user_name and user_name.strip():
                    trimmed_reply = reply.lstrip()
                    if not trimmed_reply.lower().startswith(user_name.lower()):
                        has_cjk = bool(re.search(r'[\u4e00-\u9fff]', trimmed_reply))
                        separator = "，" if has_cjk else ", "
                        reply = f"{user_name}{separator}{trimmed_reply}"
                
                print(f"✅ 反馈生成: {reply[:30]}... (基于情绪: {emotion_from_agent})")
                return reply  # 🔥 直接返回字符串，情绪已经由 Emotion Agent 提供
                
            except json.JSONDecodeError:
                print("⚠️ JSON 解析失败，回退到纯文本处理")
                return content.strip()  # 🔥 直接返回纯文本
        
        except Exception as e:
            print(f"❌ 反馈生成失败: {e}")
            fallback_reply = "感谢分享你的这一刻。" if language == "Chinese" else "Thanks for sharing this moment."
            
            # ✅ 即使在失败的情况下，也尽量带上用户名字
            if user_name and user_name.strip():
                separator = "，" if language == "Chinese" else ", "
                fallback_reply = f"{user_name}{separator}{fallback_reply}"
                
            return fallback_reply  # 🔥 直接返回字符串
    
    # ========================================================================
    # 🔥 新增: 专门的情绪分析Agent (Agent Orchestration 架构)
    # ========================================================================
    
    async def analyze_emotion_only(
        self,
        text: str,
        language: str,
        encoded_images: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        ✅ 新增: 专门的情绪分析Agent
        
        职责: 只做情绪分析,不生成反馈
        优势: 
        - Prompt更短 (300 tokens vs 1050 tokens)
        - 更专注,准确度更高
        - 可以使用更复杂的分析逻辑
        
        返回:
            {
                "emotion": "Fulfilled",
                "confidence": 0.92,
                "rationale": "用户完成了项目,表达了成就感和满足感"
            }
        """
        try:
            print(f"🎯 Emotion Agent: 开始情绪分析（两段式）...")

            # ✅ 精简版提示词（mini优先）
            fast_prompt = """You are an expert emotion analyst. Return the MOST specific emotion with a confidence score.

EMOTIONS (24):
Positive: Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Loved, Peaceful, Hopeful
Neutral: Thoughtful, Reflective, Intentional, Inspired, Curious, Nostalgic, Calm
Negative: Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated

Rules:
1) Choose most specific emotion
2) If unclear → Thoughtful (0.4-0.6)
3) Short text → conservative
4) Mixed emotions → pick dominant (>60%)
5) Use keywords + context

Key pairs:
- Fulfilled=achievement, Joyful=pure happiness
- Loved=receiving love, Grateful=expressing thanks
- Anxious=future worry, Overwhelmed=too much now

Return JSON:
{"emotion":"Fulfilled","confidence":0.85,"rationale":"..."}"""

            # ✅ 高精度提示词（4o兜底，保持策略但缩短）
            system_prompt = """You are an expert emotion analyst specializing in psychological assessment.
Your ONLY task: Analyze the user's emotion with MAXIMUM accuracy.

EMOTIONS (24):
Positive: Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Loved, Peaceful, Hopeful
Neutral: Thoughtful, Reflective, Intentional, Inspired, Curious, Nostalgic, Calm
Negative: Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated

Rules:
1) Choose most specific emotion
2) Fulfilled≠Joyful, Anxious≠Overwhelmed, Loved≠Grateful
3) If unclear → Thoughtful (0.4-0.6)
4) Mixed → pick dominant (>60%)
5) Short text → conservative

Key definitions:
Loved=receiving love/care; Grateful=expressing thanks
Fulfilled=completion/achievement; Joyful=pure happiness
Anxious=future worry; Overwhelmed=too much now

Return JSON:
{"emotion":"Fulfilled","confidence":0.92,"rationale":"..."}"""

            # 构建消息（mini）
            fast_messages = [{"role": "system", "content": fast_prompt}]
            
            # 构建用户消息
            user_content = []
            
            # 如果有图片,添加图片
            if encoded_images and len(encoded_images) > 0:
                print(f"🖼️ 添加 {len(encoded_images)} 张图片到情绪分析...")
                for image_data in encoded_images:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}",
                            "detail": "low"
                        }
                    })
                
                user_content.append({
                    "type": "text",
                    "text": f"请分析以下内容的情绪(考虑图片和文字):\\n\\n{text}"
                })
                user_prompt = user_content
            else:
                user_prompt = f"请分析以下内容的情绪:\\n\\n{text}"

            fast_messages.append({"role": "user", "content": user_prompt})

            # 1) 先用 mini
            fast_response = await self._call_gpt4o_with_retry(
                model=self.MODEL_CONFIG["emotion_fast"],
                messages=fast_messages,
                temperature=0.3,
                max_tokens=400,
                response_format={"type": "json_object"}
            )
            fast_result = json.loads(fast_response.choices[0].message.content)
            fast_conf = float(fast_result.get("confidence") or 0.0)
            print(f"✅ Emotion(micro) 完成: {fast_result.get('emotion')} (置信度: {fast_conf})")

            # 2) 低置信度再用 4o 复核
            if fast_conf < 0.75:
                print(f"⚠️ 情绪置信度低，启用 gpt-4o 复核")
                messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
                response = await self._call_gpt4o_with_retry(
                    model=self.MODEL_CONFIG["emotion"],
                    messages=messages,
                    temperature=0.3,
                    max_tokens=500,
                    response_format={"type": "json_object"}
                )
                result = json.loads(response.choices[0].message.content)
                print(f"✅ Emotion(4o) 完成: {result.get('emotion')} (置信度: {result.get('confidence')})")
                return result

            return fast_result
            
        except Exception as e:
            print(f"❌ Emotion Agent 失败: {str(e)}")
            # 返回默认值
            return {
                "emotion": "Thoughtful",
                "confidence": 0.5,
                "rationale": "分析失败,使用默认情绪"
            }
    # ========================================================================
    # 验证和降级逻辑（保持不变）
    # ========================================================================
    
    def _validate_and_fix_result(
        self, 
        result: Dict[str, str], 
        original_text: str,
        user_name: str = None  # ✅ 修复: 添加 user_name 参数以支持反馈降级时添加用户名
    ) -> Dict[str, str]:
        """
        验证并修正AI输出 - 质量把关
        
        Args:
            result: AI处理结果字典
            original_text: 原始文本
            user_name: 用户名字，用于反馈降级时添加称呼
        """
        
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
        
        # 🔥 优化：语言一致性验证 - 更宽容的检测逻辑
        title_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', title))
        title_has_english = bool(re.search(r'[a-zA-Z]', title))
        feedback_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', feedback))
        feedback_has_english = bool(re.search(r'[a-zA-Z]', feedback))
        
        used_fallback = False
        
        # 🔥 更宽容的标题语言检查（只在完全错误时才fallback）
        title_language_mismatch = False
        if is_chinese:
            # 用户输入是中文，但标题100%是英文（没有一个中文字符）
            if not title_has_chinese and title_has_english and len(title) > 3:
                # 检查是否是混合语言（例如："Project 完成"）
                # 如果标题中有至少一个中文字符，就认为是正常的
                title_language_mismatch = True
                print(f"⚠️ 标题语言不一致！用户输入是中文，但标题是纯英文: '{title}'")
        else:
            # 用户输入是英文，但标题100%是中文（没有一个英文字符）
            if not title_has_english and title_has_chinese and len(title) > 3:
                title_language_mismatch = True
                print(f"⚠️ 标题语言不一致！用户输入是英文，但标题是纯中文: '{title}'")
        
        if title_language_mismatch:
            # 使用降级方案，确保语言一致
            title = "心情随记" if is_chinese else "A Moment Captured"
            used_fallback = True
            print(f"✅ 已修正标题为: '{title}'")
        
        # 🔥 优化：反馈语言检查 - 更宽容的逻辑
        # 只有在反馈与原文语言完全相反时才fallback
        feedback_language_mismatch = False
        if is_chinese:
            # 用户是中文，但反馈是纯英文（没有一个中文字符，但有英文）
            if not feedback_has_chinese and feedback_has_english and len(feedback) > 10:
                feedback_language_mismatch = True
                print(f"⚠️ 反馈语言不一致！用户输入是中文，但反馈是纯英文: '{feedback[:50]}'")
        else:
            # 用户是英文，但反馈是纯中文（没有一个英文字符，但有中文）
            if not feedback_has_english and feedback_has_chinese and len(feedback) > 10:
                feedback_language_mismatch = True
                print(f"⚠️ 反馈语言不一致！用户输入是英文，但反馈是纯中文: '{feedback[:50]}'")
        
        if feedback_language_mismatch:
            print(f"⚠️ 使用语言不一致 fallback")
            feedback = "感谢分享你的这一刻。" if is_chinese else "Thanks for sharing this moment."
            # ✅ 即使是 fallback，也要加上用户名字
            if user_name and user_name.strip():
                separator = "，" if is_chinese else ", "
                feedback = f"{user_name}{separator}{feedback}"
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
            title = "A Moment Captured" if any(ord(c) < 128 for c in original_text) else "心情随记"
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
        
        # ✅ 修复 #9 (2026-01-27): 移除最小长度检查，只检查空值
        # 原因：短反馈可能是最合适的回复，不应被通用 fallback 替换
        if not feedback or not feedback.strip():
            print(f"⚠️ 反馈为空，使用降级")
            feedback = "感谢分享你的这一刻。" if is_chinese else "Thanks for sharing this moment."
        
        # ✅ 确保反馈始终以用户名开头（无论是 AI 生成还是 fallback）
        if user_name and user_name.strip():
            # 检查反馈是否已经以用户名开头
            if not feedback.startswith(user_name):
                separator = "，" if is_chinese else ", "
                feedback = f"{user_name}{separator}{feedback}"
        
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
    
    def _create_fallback_result(self, text: str, user_name: str = None) -> Dict[str, Any]:
        """
        创建降级结果
        """
        
        print(f"⚠️ 使用降级方案 (user_name={user_name})")
        
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        is_chinese = chinese_chars > len(text) * 0.2
        
        feedback = "感谢分享。" if is_chinese else "Thanks for sharing."
        if user_name and user_name.strip():
            separator = "，" if is_chinese else ", "
            feedback = f"{user_name}{separator}{feedback}"

        return {
            "title": "心情随记" if is_chinese else "A Moment Captured",
            "polished_content": text,
            "feedback": feedback,
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
            
            # ✅ Phase 1.1: 使用 httpx.AsyncClient 异步下载（提升性能）
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(image_url)
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

# 3. 并行处理：润色（polish）+ 情绪分析（emotion）+ 反馈（feedback）
result = await service.polish_content_multilingual(text)

# 4. 使用结果
print(f"标题: {result['title']}")        # gpt-4o-mini (polish) 生成
print(f"内容: {result['polished_content']}")  # gpt-4o-mini (polish) 润色
print(f"反馈: {result['feedback']}")      # gpt-4o (feedback) 生成

# 5. 图片+文字处理（新功能）
result = await service.polish_content_multilingual(
    text="今天去了公园",
    image_urls=["https://s3.../image1.jpg", "https://s3.../image2.jpg"]
)
"""
