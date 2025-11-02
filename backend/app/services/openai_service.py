"""
OpenAI 服务 - 世界级优化版本
作者灵感来源：乔布斯的简约哲学 + 张小龙的克制设计

核心理念：
1. 简单但不简陋（Simple but not simplistic）
2. 强大但不复杂（Powerful but not complicated）
3. 优雅但不炫技（Elegant but not showy）
"""

import tempfile
import os
import json
from typing import Dict, Optional
from openai import OpenAI
from ..config import get_settings

class OpenAIService:
    """
    OpenAI 服务类 - 支持多语言日记处理
    
    这个类就像一个温柔的日记助手，它会：
    1. 听懂你的声音（语音转文字）
    2. 美化你的文字（轻度润色）
    3. 给你温暖的回应（心理陪伴）
    4. 帮你起个好标题（画龙点睛）
    """
    
    # 🎯 最优模型选择（2025年10月最新）
    MODEL_CONFIG = {
        "transcription": "whisper-1",           # 语音转文字：OpenAI Whisper
        "text_processing": "gpt-4o-mini",       # 文字处理：GPT-4o-mini
        
        # 🎤 为什么选 whisper-1？
        # ✅ OpenAI 官方语音转文字模型
        # ✅ 支持 100+ 语言（中英文完美）
        # ✅ 高准确度，低幻觉率
        # ✅ 更好的口音和噪音处理
        # ✅ 价格 $0.006/分钟
        
        # ✨ 为什么选 gpt-4o-mini？
        # ✅ 最快（⚡⚡⚡⚡⚡ 5星速度）
        # ✅ 超便宜（比 GPT-4 便宜很多倍）
        # ✅ GPT-4o 系列，2024年最新
        # ✅ 推理能力强，足够日记场景
        # ✅ 128k 上下文窗口（超长内容支持）
    }
    
    # 📏 长度限制（最终版 - 精炼但完整）
    LENGTH_LIMITS = {
        "title_min": 4,         # 标题最短 4 字符
        "title_max": 60,        # 标题最长 60 字符（约12个英文单词或30个中文字）
        "feedback_min": 30,     # 反馈最短 30 字符（确保有内容）
        "feedback_max": 250,    # 反馈最长 250 字符（精炼但温暖）
        "polished_ratio": 1.15, # 润色内容不超过原文 115%
        "min_audio_text": 3,    # 最短有效语音长度
    }
    
    def __init__(self):
        """初始化 OpenAI 客户端"""
        settings = get_settings()
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def get_system_prompt(self) -> str:
        return """You polish diary entries and provide warm feedback.

🚨 ABSOLUTE RULE: NEVER TRANSLATE 🚨
If input is English → ALL output MUST be English
If input is Chinese → ALL output MUST be Chinese

Your task:
1. Fix grammar/typos in the original language
2. Generate a title in the original language  
3. Write feedback in the original language

CRITICAL: Feedback length must adapt to input length dynamically:
- Short input (1-2 sentences): 1-2 short, warm sentences (English: 15-25 words, Chinese: 20-40字)
- Medium input (3-5 sentences): 2-3 sentences (English: 30-50 words, Chinese: 40-60字)
- Long input (6+ sentences): 2-3 sentences, can be slightly longer (English: 40-60 words, Chinese: 60-80字)

Feedback style:
✨ Be warm, concise, poetic, and touching
✨ Match the mood and length of the user's input
✨ Avoid being verbose or overly lengthy
✨ Quality over quantity - every word should matter

Response format (JSON):
{
  "title": "5-12 words, same language as input",
  "polished_content": "fixed grammar, same language, ≤115% length",
  "feedback": "Adapt length to input, same language, warm and poetic"
}

Examples:
✅ Input: "I feel tired" (short) → {"feedback": "Rest is not a luxury, it's a necessity. Your body knows what it needs."} (1-2 sentences)
✅ Input: "今天天气很好，我去了公园，看到了很多花，心情很愉快。" (medium) → {"feedback": "阳光和花朵总是能点亮心情。你的这份简单快乐，是生活最好的馈赠。"} (2-3 sentences)
✅ Input: "I've been working hard on this project for months. There were so many challenges, but I learned a lot about myself and my capabilities. I'm proud of what I've accomplished." (long) → {"feedback": "Months of dedication have shaped you. The challenges you faced weren't obstacles—they were teachers. This journey reflects your resilience and growth."} (2-3 sentences)

❌ FORBIDDEN: 
- DO NOT translate English to Chinese or Chinese to English
- DO NOT write overly long feedback for short inputs
- DO NOT be verbose or repetitive"""
    
    async def transcribe_audio(
        self, 
        audio_content: bytes, 
        filename: str
    ) -> str:
        """
        语音转文字 - 把你的声音变成文字
        
        🎤 工作流程（就像人类听写）：
        1. 收到音频 → 检查大小
        2. 创建临时文件 → 确保格式正确
        3. 发送给 Whisper → 它是语音识别专家
        4. 检查结果 → 确保不是空的
        5. 清理临时文件 → 保持整洁
        
        参数:
            audio_content: 音频的二进制数据（就像录音机的磁带）
            filename: 文件名（用来识别格式）
        
        返回:
            转写的文本（你说的话）
        
        抛出:
            ValueError: 如果音频太短或识别失败
        """
        temp_file_path = None
        
        try:
            # 📊 Step 1: 检查音频大小
            audio_size_kb = len(audio_content) / 1024
            print(f"🎤 收到音频: {filename}, 大小: {audio_size_kb:.1f} KB")
            
            # 音频太小可能是噪音
            if audio_size_kb < 1:
                raise ValueError("音频文件太小，请说长一点")
            
            # 📝 Step 2: 准备临时文件（Whisper 需要文件而不是字节流）
            suffix = '.m4a' if not filename.endswith('.m4a') else ''
            with tempfile.NamedTemporaryFile(
                delete=False, 
                suffix=suffix or os.path.splitext(filename)[1]
            ) as temp_file:
                temp_file.write(audio_content)
                temp_file_path = temp_file.name
            
            print(f"✅ 临时文件准备完成")
            
            # 🚀 Step 3: 调用 Whisper 进行转录
            with open(temp_file_path, 'rb') as audio_file:
                print(f"📤 正在识别语音...")
                transcription = self.client.audio.transcriptions.create(
                    model=self.MODEL_CONFIG["transcription"],
                    file=audio_file,
                    language=None,  # 自动检测语言（支持多语言）
                )
            
            # ✅ Step 4: 验证转录结果
            text = (transcription.text or "").strip()
            
            if len(text) < self.LENGTH_LIMITS["min_audio_text"]:
                print(f"❌ 转录内容过短: '{text}'")
                raise ValueError("未识别到有效内容，请说清楚一些")
            
            print(f"✅ 语音识别成功: '{text[:50]}...'")
            return text
            
        except Exception as e:
            print(f"❌ 语音转文字失败: {str(e)}")
            # 把错误翻译成用户能懂的话
            if "Invalid file format" in str(e):
                raise ValueError("音频格式不支持，请使用 m4a 格式")
            elif "File too large" in str(e):
                raise ValueError("音频文件太大，请控制在 2 分钟内")
            else:
                raise ValueError(f"语音识别失败: {str(e)}")
        
        finally:
            # 🧹 Step 5: 清理临时文件（保持系统整洁）
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    print(f"🧹 临时文件已清理")
                except Exception as e:
                    print(f"⚠️ 清理失败（不影响功能）: {e}")
    
    async def polish_content_multilingual(
        self, 
        text: str
    ) -> Dict[str, str]:
        """
        润色内容并生成标题和反馈 - 这是核心功能
        
        🎨 就像一个贴心的编辑：
        1. 读你的日记
        2. 轻轻修正错别字
        3. 起一个好标题
        4. 给你温暖的回应
        
        参数:
            text: 原始文本（你的日记）
        
        返回:
            包含三个部分的字典：
            - polished_content: 润色后的内容（保持原意）
            - title: 标题（6-18字）
            - feedback: 反馈（≤120字）
        """
        try:
            # 📊 输入检查
            if not text or len(text.strip()) < 5:
                raise ValueError("内容太短，请多写一些")
            
            print(f"✨ 开始AI处理: {text[:50]}...")
            
            # 🔍 检测原文语言
            import re
            chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
            is_chinese = chinese_chars > len(text) * 0.2
            detected_lang = "Chinese" if is_chinese else "English"
            
            print(f"🌍 检测到语言: {detected_lang} (中文字符={chinese_chars}/{len(text)})")
            
            # 🤖 调用 GPT-4o-mini（性价比之王）
            # 计算合理的 max_tokens：确保足够生成完整 JSON
            # 输入 + 输出需要：原文*1.5 + title(50) + feedback(300) 
            min_output_tokens = 500  # 至少保证 500 tokens 用于输出
            input_based_tokens = int(len(text) * 3)  # 考虑中文 token 比例
            max_tokens_value = max(min_output_tokens, min(2000, input_based_tokens))
            
            print(f"📊 Token 配置: 输入长度={len(text)}, max_tokens={max_tokens_value}")
            
            # 🚨 在用户消息中也强调语言和反馈长度，强制 AI 遵循规则
            input_length = len(text.split('.')) if '.' in text else len(text.split('。')) if '。' in text else 1
            user_message = f"""Input text (KEEP IN {detected_lang.upper()}):
{text}

CRITICAL REQUIREMENTS:
1. Output everything in {detected_lang}. DO NOT translate!
2. ADAPT feedback length to input length:
   - If input is short (1-2 sentences): write 1-2 brief, warm sentences
   - If input is medium (3-5 sentences): write 2-3 sentences  
   - If input is long (6+ sentences): write 2-3 sentences, slightly longer
3. Be warm, concise, poetic - avoid being verbose or repetitive
4. Match the emotional tone of the input"""
            
            response = self.client.chat.completions.create(
                model=self.MODEL_CONFIG["text_processing"],
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,  # 降低温度，减少"创造性"翻译
                max_tokens=max_tokens_value,  # 确保足够的 tokens
                response_format={"type": "json_object"},  # 强制返回 JSON
            )
            
            # 📦 解析结果
            result_text = response.choices[0].message.content.strip()
            print(f"🤖 收到AI响应 (长度: {len(result_text)} 字符)")
            print(f"📄 完整响应内容:\n{result_text}\n")
            
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON解析失败: {e}")
                print(f"❌ 这说明 AI 返回的不是有效的 JSON，可能是 max_tokens 不够导致截断")
                # 降级处理：返回原文
                return self._create_fallback_result(text)
            
            # ✅ 质量检查（确保符合规范）
            result = self._validate_and_fix_result(result, text)
            
            print(f"✅ 处理完成:")
            print(f"  - 标题: {result['title']}")
            print(f"  - 内容长度: {len(result['polished_content'])} 字")
            print(f"  - 反馈长度: {len(result['feedback'])} 字")
            
            return result
        
        except Exception as e:
            print(f"❌ AI处理失败: {type(e).__name__}: {e}")
            import traceback
            print(f"📍 错误堆栈: {traceback.format_exc()}")
            return self._create_fallback_result(text)
    
    def _validate_and_fix_result(
        self, 
        result: Dict[str, str], 
        original_text: str
    ) -> Dict[str, str]:
        """
        验证并修正AI输出 - 质量把关
        
        🔍 为什么需要这一步？
        - AI 有时会"过度发挥"
        - 需要确保输出符合设计规范
        - 就像产品经理做最后的验收
        
        检查项目：
        1. ✅ 语言一致性（标题、内容、反馈同语言）
        2. ✅ 标题长度（4-60字符，不截断单词）
        3. ✅ 反馈精炼（30-250字符）
        4. ✅ 无表情符号、感叹号
        """
        import re
        
        # 📏 获取原始长度和语言
        orig_len = len(original_text.strip())
        
        # 🔍 检测原文主要语言（简单但有效）
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', original_text))
        is_chinese = chinese_chars > len(original_text) * 0.2  # 超过20%中文字符
        
        print(f"📊 原文语言检测: 总长度={len(original_text)}, 中文字符={chinese_chars}, 判定={'中文' if is_chinese else '英文'}")
        
        # 🎯 提取并清理各部分
        title = (result.get("title", "") or "").strip()
        polished = (result.get("polished_content", "") or "").strip()
        feedback = (result.get("feedback", "") or "").strip()
        
        # ✅ 验证语言一致性
        title_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', title))
        feedback_has_chinese = bool(re.search(r'[\u4e00-\u9fff]', feedback))
        
        print(f"🔍 AI输出语言: 标题={'中文' if title_has_chinese else '英文'}, 反馈={'中文' if feedback_has_chinese else '英文'}")
        
        # 🚨 标记是否使用了降级方案（用于跳过后续检查）
        used_fallback = False
        
        if is_chinese != title_has_chinese:
            print(f"⚠️ 标题语言不一致！原文={'中文' if is_chinese else '英文'}，标题={'中文' if title_has_chinese else '英文'}")
            # 使用降级标题
            title = "今日记录" if is_chinese else "Today's Reflection"
            used_fallback = True
        
        if is_chinese != feedback_has_chinese:
            print(f"⚠️ 反馈语言不一致！原文={'中文' if is_chinese else '英文'}，反馈={'中文' if feedback_has_chinese else '英文'}")
            # 使用降级反馈（确保足够长度）
            feedback = "感谢你真诚的分享。这段经历值得被记录。" if is_chinese else "Thank you for sharing your thoughts. Your feelings are valid and this moment deserves to be remembered."
            used_fallback = True
        
        # 🧹 清理工具函数
        def clean_text(text: str) -> str:
            """移除表情和感叹号"""
            # 移除表情符号
            text = re.sub(
                r'[\U0001F300-\U0001FAFF\U00002700-\U000027BF]+', 
                '', 
                text
            )
            # 替换感叹号
            text = text.replace('！', '。').replace('!', '.')
            # 规范化空白
            text = re.sub(r'\s+', ' ', text).strip()
            return text
        
        def trim_to_length(text: str, max_len: int) -> str:
            """智能截断（在句子边界）"""
            if len(text) <= max_len:
                return text
            
            # 尝试在句号处截断
            cut = text[:max_len]
            for punct in ['。', '.', '？', '?', '；', ';']:
                idx = cut.rfind(punct)
                if idx > max_len * 0.7:  # 至少保留 70%
                    return cut[:idx + 1]
            
            # 没有好的截断点，硬截
            return cut[:max_len - 1] + '…'
        
        # ✨ 修正标题（智能处理，不截断单词）
        title = clean_text(title)
        title = re.sub(r'[^\w\u4e00-\u9fff\s-]', '', title)  # 保留空格和连字符
        title = re.sub(r'\s+', ' ', title).strip()  # 规范化空格
        
        if len(title) < self.LENGTH_LIMITS["title_min"]:
            title = "Today's Reflection" if any(ord(c) < 128 for c in original_text) else "今日记录"
        elif len(title) > self.LENGTH_LIMITS["title_max"]:
            # 智能截断：不在单词中间截断
            max_len = self.LENGTH_LIMITS["title_max"]
            if ' ' in title and len(title) > max_len:
                # 在最后一个空格处截断
                words = title[:max_len].rsplit(' ', 1)
                title = words[0] if len(words[0]) > max_len * 0.6 else title[:max_len]
            else:
                # 中文或单个长单词，直接截断
                title = title[:max_len]
        
        # ✨ 修正润色内容
        polished = clean_text(polished)
        max_polished_len = int(orig_len * self.LENGTH_LIMITS["polished_ratio"])
        if len(polished) > max_polished_len:
            polished = trim_to_length(polished, max_polished_len)
        
        # ✨ 修正反馈（精炼版）
        feedback = clean_text(feedback)
        
        # 检查最小长度（如果已经使用了降级方案，跳过此检查）
        if not used_fallback and len(feedback) < self.LENGTH_LIMITS.get("feedback_min", 30):
            print(f"⚠️ 反馈过短({len(feedback)}字符)，使用降级")
            feedback = "感谢你真诚的分享。这段经历值得被记录。" if is_chinese else "Thank you for sharing your thoughts. Your feelings are valid and this moment deserves to be remembered."
        
        # 检查最大长度
        if len(feedback) > self.LENGTH_LIMITS["feedback_max"]:
            feedback = trim_to_length(feedback, self.LENGTH_LIMITS["feedback_max"])
        
        # 智能默认值（根据语言）
        is_english = any(ord(c) < 128 for c in original_text[:50])
        default_feedback = (
            "Thank you for sharing your thoughts with such honesty." 
            if is_english 
            else "感谢你真诚地分享"
        )
        
        return {
            "title": title,
            "polished_content": polished or original_text,
            "feedback": feedback or default_feedback
        }
    
    def _create_fallback_result(self, text: str) -> Dict[str, str]:
        """
        创建降级结果 - 当AI出错时的备用方案
        
        🛟 为什么需要降级？
        - AI 可能会失败（网络、限流等）
        - 用户不应该看到技术错误
        - 产品要"永远可用"
        
        降级策略：
        - 返回原文（至少能看到自己写的）
        - 生成简单标题（总比没有好）
        - 给基础反馈（保持温暖）
        """
        import re
        
        print("⚠️ 使用降级方案")
        
        # 🔍 统一的语言检测逻辑（与_validate_and_fix_result保持一致）
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        is_chinese = chinese_chars > len(text) * 0.2  # 超过20%中文字符
        
        print(f"📊 语言检测: 文本长度={len(text)}, 中文字符={chinese_chars}, 判定={'中文' if is_chinese else '英文'}")
        
        return {
            "title": "今日记录" if is_chinese else "Today's Reflection",
            "polished_content": text,
            "feedback": "感谢你真诚的分享。" if is_chinese else "Thank you for sharing."
        }
    
    # 📌 向后兼容方法（保持API稳定性）
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

# 2. 语音转文字
text = await service.transcribe_audio(audio_bytes, "recording.m4a")

# 3. 润色并生成反馈
result = await service.polish_content_multilingual(text)

# 4. 使用结果
print(f"标题: {result['title']}")
print(f"内容: {result['polished_content']}")
print(f"反馈: {result['feedback']}")
"""