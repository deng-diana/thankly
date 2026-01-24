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
            
            # ✅ 精简的System Prompt (只关注情绪分析)
            system_prompt = f"""You are an expert emotion analyst specializing in psychological assessment.

Your ONLY task: Analyze the user's emotion from their text/images.

🎯 EMOTION CATEGORIES (24 emotions):

**Positive (9)**: Joyful, Grateful, Fulfilled, Proud, Surprised, Excited, Loved, Peaceful, Hopeful
**Neutral (7)**: Thoughtful, Reflective, Intentional, Inspired, Curious, Nostalgic, Calm
**Negative (8)**: Uncertain, Misunderstood, Lonely, Down, Anxious, Overwhelmed, Venting, Frustrated

📊 ANALYSIS RULES:

1. **Precision over Speed**: Take time to analyze carefully
2. **Context Matters**: Consider the full context, not just keywords
3. **Confidence Score**: 
   - 0.9-1.0: Very clear emotion (explicit keywords + context)
   - 0.7-0.9: Clear emotion (context supports)
   - 0.5-0.7: Moderate (some ambiguity)
   - 0.3-0.5: Uncertain (default to Thoughtful)

4. **Detailed Rationale**: Explain WHY you chose this emotion

🎯 KEY EMOTION DEFINITIONS:

**Fulfilled (充实)** - Achievement & Completion:
- Keywords: "完成", "达成", "实现", "成就", "收获", "accomplished", "completed", "achieved"
- Context: Finished tasks, learned skills, made progress
- Example: "完成了项目" → Fulfilled (NOT Joyful)

**Joyful (喜悦)** - Pure Happiness:
- Keywords: "开心", "快乐", "高兴", "happy", "fun", "joy"
- Context: Spontaneous happiness, celebration, not tied to achievement
- Example: "和朋友玩得很开心" → Joyful

**Thoughtful (若有所思)** - DEFAULT:
- General thinking, pondering, recording
- Use when emotion is unclear or neutral
- Keywords: "在想", "记录", "思考"

**Grateful (感恩)** - Thankfulness:
- Keywords: "感谢", "感恩", "grateful", "thankful"
- Example: "感谢朋友的帮助" → Grateful

**Excited (期待)** - Anticipation:
- Keywords: "期待", "等待", "can't wait", "looking forward"
- Example: "好期待明天的旅行" → Excited

**Loved (被爱着)** - Feeling Cherished:
- Keywords: "被爱", "被珍惜", "被关心", "温暖", "陪伴", "loved", "cherished", "cared for", "supported"
- Context: Feeling valued, supported by others, experiencing deep connection
- Example: "朋友一直陪着我,感觉很温暖" → Loved

**Anxious (焦虑)** - Worry:
- Keywords: "焦虑", "担心", "紧张", "anxious", "worried"
- Example: "担心明天的面试" → Anxious

**Down (低落)** - Sadness:
- Keywords: "难过", "失落", "沮丧", "sad", "down"
- Example: "今天很失落" → Down

**Overwhelmed (不堪重负)** - Stressed:
- Keywords: "压力大", "忙不过来", "overwhelmed"
- Example: "工作太多了,压力好大" → Overwhelmed

⚠️ CRITICAL RULES:
- Choose the MOST SPECIFIC emotion
- Fulfilled vs Joyful: Fulfilled = achievement, Joyful = spontaneous happiness
- When in doubt, use Thoughtful
- Consider BOTH keywords AND context

Response Format (JSON):
{{
    "emotion": "Fulfilled",
    "confidence": 0.92,
    "rationale": "用户完成了项目,明确表达了成就感。使用了'完成'这个关键词,且语境是工作成果,因此判断为Fulfilled而非Joyful。"
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
