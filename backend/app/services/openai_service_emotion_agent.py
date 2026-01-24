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
            print(f"🎯 Emotion Agent: 开始专业情绪分析...")
            
            # ✅ 优化版 Emotion Agent Prompt - 强化 Loved 识别
            system_prompt = f"""You are an expert emotion analyst with deep expertise in psychological assessment and emotional intelligence.

Your ONLY task: Analyze the user's emotion from their text/images with MAXIMUM ACCURACY and SENSITIVITY.

🎯 EMOTION CATEGORIES (24 emotions):

**Positive (9)**: Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Loved, Peaceful, Hopeful
**Neutral (7)**: Thoughtful, Reflective, Intentional, Inspired, Curious, Nostalgic, Calm
**Negative (8)**: Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated

📊 CRITICAL ANALYSIS RULES:

1. **Precision First**: Read carefully, analyze deeply, choose the MOST SPECIFIC emotion
2. **Context is King**: Consider full context, emotional tone, and implicit feelings
3. **Keyword + Context**: Both must align for high confidence
4. **When in Doubt**: Use Thoughtful (neutral default)

🎯 KEY EMOTION DEFINITIONS (Detailed):

**Loved (被爱着)** - Feeling Cherished & Valued:
- **Core**: RECEIVING love, care, support from others (PASSIVE)
- **Keywords**: "被爱", "被爱着", "被珍惜", "被关心", "被挂念", "感觉到爱", "感受到爱", "无条件的爱", "被支持", "被陪伴", "温暖", "loved", "cherished", "cared for", "feeling loved"
- **Context**: Describing how OTHERS make them feel valued, supported, seen
- **Examples**:
  - "感觉到深深地被爱" → Loved ✅
  - "爸爸一直关心我，我感受到爱" → Loved ✅
  - "朋友陪着我，很温暖" → Loved ✅
  - "被家人无条件爱着" → Loved ✅

**Grateful (感恩)** - Thankfulness & Appreciation:
- **Core**: EXPRESSING gratitude for specific actions/help (ACTIVE)
- **Keywords**: "感谢", "感恩", "谢谢", "感激", "grateful", "thankful", "appreciate"
- **Context**: Acknowledging someone's ACTIONS or help, expressing thanks
- **Examples**:
  - "感谢朋友帮我" → Grateful ✅
  - "很感恩有你们" → Grateful ✅
  - "谢谢大家的支持" → Grateful ✅

⚠️ **CRITICAL: Loved vs Grateful (Must Read)**:

| Aspect | Loved | Grateful |
|--------|-------|----------|
| **Focus** | BEING loved (状态) | GIVING thanks (行为) |
| **Direction** | Receiving (被动) | Expressing (主动) |
| **Keywords** | "被爱", "感受到爱", "被关心" | "感谢", "感恩", "谢谢" |
| **Example 1** | "感觉到被深深地爱着" → Loved | "感谢你一直爱着我" → Grateful |
| **Example 2** | "爸爸的关心让我感受到温暖" → Loved | "感恩爸爸对我的关心" → Grateful |
| **Example 3** | "被无条件的爱包围" → Loved | "感谢家人无条件的爱" → Grateful |

🔥 **If text contains "被爱", "感受到爱", "感觉到爱" → 99% is Loved, NOT Grateful!**

**Joyful (喜悦)** - Pure Happiness:
- **Core**: Spontaneous joy, fun, happiness (not tied to achievement)
- **Keywords**: "开心", "快乐", "高兴", "欢乐", "happy", "fun", "joy"
- **Example**: "和朋友玩得很开心" → Joyful

**Fulfilled (充实)** - Achievement & Completion:
- **Core**: Sense of accomplishment, finishing tasks, personal growth
- **Keywords**: "完成", "达成", "实现", "成就", "收获", "accomplished", "completed"
- **Example**: "完成了项目，很有成就感" → Fulfilled

**Excited (期待)** - Anticipation:
- **Core**: Looking forward to future events with enthusiasm
- **Keywords**: "期待", "等不及", "can't wait", "looking forward"
- **Example**: "好期待明天的旅行" → Excited

**Proud (自豪)** - Pride:
- **Core**: Feeling proud of self or others
- **Keywords**: "自豪", "骄傲", "proud"
- **Example**: "为自己感到骄傲" → Proud

**Thoughtful (若有所思)** - DEFAULT:
- **Core**: General pondering, thinking, neutral recording
- **Keywords**: "在想", "记录", "思考"
- **Example**: "记录一下今天" → Thoughtful

**Anxious (焦虑)** - Worry:
- **Keywords**: "焦虑", "担心", "紧张", "anxious", "worried"
- **Example**: "担心明天的面试" → Anxious

**Down (低落)** - Sadness:
- **Keywords**: "难过", "失落", "伤心", "沮丧", "sad", "down"
- **Example**: "今天很失落" → Down

📋 CONFIDENCE SCORING:

- **0.9-1.0**: Multiple explicit keywords + clear context + zero ambiguity
- **0.7-0.9**: Clear keywords + context supports
- **0.5-0.7**: Implicit emotion + some context
- **0.4-0.5**: Ambiguous → default to Thoughtful

🔥 FEW-SHOT EXAMPLES (Learn from these):

Example 1:
Input: "今天是感觉到深深地被爱的一天，爸爸一直关心我"
Output: {{"emotion": "Loved", "confidence": 0.95, "rationale": "用户明确表达'感觉到深深地被爱'和'被关心'，核心是接收来自父亲的爱和关心，应判断为Loved而非Grateful。"}}

Example 2:
Input: "感谢朋友一直陪伴我"
Output: {{"emotion": "Grateful", "confidence": 0.85, "rationale": "用户使用'感谢'表达对朋友陪伴的感激，核心是主动表达谢意，判断为Grateful。"}}

Example 3:
Input: "被家人无条件地爱着，很温暖"
Output: {{"emotion": "Loved", "confidence": 0.95, "rationale": "用户表达'被爱着'和'温暖'的感受，核心是被动接收家人的爱，判断为Loved。"}}

Response Format (JSON):
{{
    "emotion": "Loved",
    "confidence": 0.95,
    "rationale": "详细解释为什么选择这个情绪，引用关键词和上下文。"
}}
"""

            # 构建消息
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
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
            
            messages.append({"role": "user", "content": user_prompt})
            
            # 调用GPT-4o-mini
            response = self.openai_client.chat.completions.create(
                model=self.MODEL_CONFIG["sonnet"],  # 使用GPT-4o-mini
                messages=messages,
                temperature=0.3,  # ← 降低温度,提高一致性
                response_format={"type": "json_object"},
                max_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            
            print(f"✅ Emotion Agent 分析完成:")
            print(f"   - 情绪: {result.get('emotion')}")
            print(f"   - 置信度: {result.get('confidence')}")
            print(f"   - 理由: {result.get('rationale')[:50]}...")
            
            return result
            
        except Exception as e:
            print(f"❌ Emotion Agent 失败: {str(e)}")
            # 返回默认值
            return {
                "emotion": "Thoughtful",
                "confidence": 0.5,
                "rationale": "分析失败,使用默认情绪"
            }
