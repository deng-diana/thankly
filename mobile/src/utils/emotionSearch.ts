/**
 * 情绪搜索映射工具
 * 
 * 功能：
 * - 支持通过关键词搜索匹配情绪
 * - 中英文关键词映射
 * - 同义词支持
 */

import { EmotionType, EMOTION_MAP } from "../types/emotion";

/**
 * 情绪关键词映射表
 * 每个情绪对应多个可能的搜索关键词（中英文）
 */
const EMOTION_SEARCH_KEYWORDS: Record<EmotionType, string[]> = {
  // 🌟 Positive Emotions
  Joyful: ["joyful", "joy", "happy", "happiness", "喜悦", "开心", "快乐", "高兴"],
  Grateful: ["grateful", "thankful", "thanks", "appreciate", "感恩", "感谢", "谢谢", "感激"],
  Fulfilled: ["fulfilled", "accomplished", "satisfied", "充实", "满足", "成就"],
  Proud: ["proud", "pride", "欣慰", "自豪", "骄傲"],
  Surprised: ["surprised", "surprise", "惊喜", "意外", "惊讶"],
  Excited: ["excited", "exciting", "期待", "兴奋", "激动"],
  Peaceful: ["peaceful", "peace", "calm", "tranquil", "平静", "宁静", "安静"],
  Hopeful: ["hopeful", "hope", "optimistic", "希望", "乐观", "憧憬"],

  // 🧘 Neutral/Constructive Emotions
  Thoughtful: ["thoughtful", "thinking", "pensive", "若有所思", "思考", "想"],
  Reflective: ["reflective", "reflect", "introspection", "内省", "反思", "自省"],
  Intentional: ["intentional", "determined", "resolute", "笃定", "坚定", "决心"],
  Inspired: ["inspired", "inspiration", "motivated", "启迪", "启发", "灵感", "激励"],
  Curious: ["curious", "curiosity", "wondering", "好奇", "疑惑", "探索"],
  Nostalgic: ["nostalgic", "nostalgia", "reminisce", "怀念", "回忆", "思念"],
  Calm: ["calm", "composed", "serene", "淡然", "从容", "平和"],

  // 😔 Negative/Release Emotions
  Uncertain: ["uncertain", "confused", "lost", "迷茫", "困惑", "不确定", "迷失"],
  Misunderstood: ["misunderstood", "wronged", "委屈", "冤枉", "不被理解"],
  Lonely: ["lonely", "alone", "isolated", "孤独", "寂寞", "孤单", "独自"],
  Down: ["down", "sad", "blue", "depressed", "低落", "难过", "沮丧", "郁闷", "伤心"],
  Anxious: ["anxious", "anxiety", "worried", "nervous", "焦虑", "担心", "紧张", "不安"],
  Overwhelmed: ["overwhelmed", "exhausted", "tired", "疲惫", "累", "筋疲力尽", "压力"],
  Venting: ["venting", "vent", "release", "宣泄", "发泄", "释放"],
  Frustrated: ["frustrated", "frustration", "stuck", "受挫", "挫折", "失败", "受阻"],
};

/**
 * 根据搜索词匹配情绪
 * 
 * @param query - 搜索关键词
 * @returns 匹配的情绪类型数组
 * 
 * @example
 * searchEmotionsByKeyword("down") => ["Down"]
 * searchEmotionsByKeyword("低落") => ["Down"]
 * searchEmotionsByKeyword("happy") => ["Joyful"]
 */
export function searchEmotionsByKeyword(query: string): EmotionType[] {
  if (!query || query.trim() === "") {
    return [];
  }

  const lowerQuery = query.toLowerCase().trim();
  const matchedEmotions: EmotionType[] = [];

  // 遍历所有情绪，检查是否有关键词匹配
  (Object.keys(EMOTION_SEARCH_KEYWORDS) as EmotionType[]).forEach((emotion) => {
    const keywords = EMOTION_SEARCH_KEYWORDS[emotion];
    const isMatch = keywords.some((keyword) =>
      keyword.toLowerCase().includes(lowerQuery) || 
      lowerQuery.includes(keyword.toLowerCase())
    );

    if (isMatch) {
      matchedEmotions.push(emotion);
    }
  });

  return matchedEmotions;
}

/**
 * 检查日记的情绪是否匹配搜索词
 * 
 * @param diaryEmotion - 日记的情绪类型
 * @param query - 搜索关键词
 * @returns 是否匹配
 */
export function doesEmotionMatchQuery(
  diaryEmotion: string | undefined,
  query: string
): boolean {
  if (!diaryEmotion || !query) {
    return false;
  }

  const matchedEmotions = searchEmotionsByKeyword(query);
  return matchedEmotions.includes(diaryEmotion as EmotionType);
}

/**
 * 获取情绪的显示名称（用于搜索提示）
 * 
 * @param emotion - 情绪类型
 * @param locale - 语言（"zh" | "en"）
 * @returns 情绪显示名称
 */
export function getEmotionLabel(
  emotion: EmotionType,
  locale: "zh" | "en" = "zh"
): string {
  const config = EMOTION_MAP[emotion];
  return locale === "zh" ? config.labelZh : config.labelEn;
}
