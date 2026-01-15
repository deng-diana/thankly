export type EmotionType =
  // 🌟 Positive Emotions (8)
  | "Joyful"
  | "Grateful"
  | "Fulfilled" // ✅ 新增：充实 - 完成目标、获得成就
  | "Proud" // ✅ 更新翻译：欣慰（原：自豪）
  | "Surprised" // ✅ 新增：惊喜 - 不期而遇的美好
  | "Excited" // ✅ 新增：期待 - 对未来充满期待
  | "Peaceful"
  | "Hopeful" // ✅ 新增：希望 - 对未来抱有希望

  // 🧘 Neutral/Constructive Emotions (7)
  | "Thoughtful" // ✅ 默认中性标签 - 在想与记录
  | "Reflective" // 内省 - 深度自我反思、理解经历与动机
  | "Intentional" // 规划/目标场景
  | "Inspired" // 学习/启发场景
  | "Curious" // ✅ 新增：好奇 - 探索新事物
  | "Nostalgic" // ✅ 新增：怀念 - 回忆过去
  | "Calm" // ✅ 新增：淡然 - 接受现状、心态平和

  // 😔 Negative/Release Emotions (8)
  | "Uncertain" // ✅ 新增：迷茫 - 自我怀疑、缺乏方向
  | "Misunderstood" // ✅ 新增：委屈 - 不被理解
  | "Lonely" // ✅ 新增：孤独 - 缺乏社交连接、感到孤立
  | "Down"
  | "Anxious"
  | "Overwhelmed" // ✅ 新增：疲惫 - 身心俱疲（替换 Drained）
  | "Venting" // 宣泄 - 健康的情绪释放过程
  | "Frustrated"; // ✅ 新增：受挫 - 遇到阻碍、感到挫败

export interface EmotionConfig {
  labelEn: string;
  labelZh: string;
  color: string;
  darkText: boolean;
}

// 情绪配色表 - 🎨 温暖、简洁、沉稳的配色方案（2026-01-10 更新 v4 - 23个情绪，Reflective拆分为Thoughtful和Reflective）
export const EMOTION_MAP: Record<EmotionType, EmotionConfig> = {
  // 🌟 Positive Emotions (8) - 温暖柔和的色调
  Joyful: {
    labelEn: "Joyful",
    labelZh: "喜悦",
    color: "#FCF7BD",
    darkText: true,
  }, // 温暖黄色（与Thoughtful共享）
  Grateful: {
    labelEn: "Grateful",
    labelZh: "感恩",
    color: "#F9E2F3",
    darkText: true,
  }, // 柔和粉紫
  Fulfilled: {
    labelEn: "Fulfilled",
    labelZh: "充实",
    color: "#FEE7BA",
    darkText: true,
  }, // ✅ 新增：柔和淡粉黄 (改色自 #E8DFF5)
  Proud: {
    labelEn: "Proud",
    labelZh: "欣慰",
    color: "#FFD9CC",
    darkText: true,
  }, // ✅ 更新翻译：柔和桃色
  Surprised: {
    labelEn: "Surprised",
    labelZh: "惊喜",
    color: "#F3DBFC",
    darkText: true,
  }, // ✅ 新增：柔和淡紫 (改色自 #FFE8CC)
  Excited: {
    labelEn: "Excited",
    labelZh: "期待",
    color: "#FFD5D5",
    darkText: true,
  }, // ✅ 新增：柔和粉红 (改色自 #FFDAB3)
  Peaceful: {
    labelEn: "Peaceful",
    labelZh: "平静",
    color: "#DAF5EC",
    darkText: true,
  }, // 清新薄荷绿
  Hopeful: {
    labelEn: "Hopeful",
    labelZh: "希望",
    color: "#CAEED4",
    darkText: true,
  }, // ✅ 新增：柔和淡绿 (改色自 #D4EDFF)

  // 🧘 Neutral/Constructive Emotions (7) - 清新自然的色调
  Thoughtful: {
    labelEn: "Thoughtful",
    labelZh: "若有所思",
    color: "#FCF7BD",
    darkText: true,
  }, // ✅ 默认中性标签 - 温暖黄色（最常出现，悦目）
  Reflective: {
    labelEn: "Reflective",
    labelZh: "内省",
    color: "#DAF5EC",
    darkText: true,
  }, // 内省 - 清新薄荷绿（更清新的状态）
  Intentional: {
    labelEn: "Intentional",
    labelZh: "笃定",
    color: "#DAF5EC",
    darkText: true,
  }, // 清新薄荷绿（与Peaceful共享）
  Inspired: {
    labelEn: "Inspired",
    labelZh: "启迪",
    color: "#E5F4B6",
    darkText: true,
  }, // 柔和黄绿
  Curious: {
    labelEn: "Curious",
    labelZh: "好奇",
    color: "#D0F4F1",
    darkText: true,
  }, // ✅ 新增：柔和青色 (改色自 #E0F2FF)
  Nostalgic: {
    labelEn: "Nostalgic",
    labelZh: "怀念",
    color: "#F0DBC5",
    darkText: true,
  }, // ✅ 新增：柔和米褐 (改色自 #F5E6D3)
  Calm: { labelEn: "Calm", labelZh: "淡然", color: "#D1E9FA", darkText: true }, // ✅ 新增：柔和淡蓝 (改色自 #E8F0E8)

  // 😔 Negative/Release Emotions (8) - 沉稳柔和的色调
  Uncertain: {
    labelEn: "Uncertain",
    labelZh: "迷茫",
    color: "#E3EDF6",
    darkText: true,
  }, // ✅ 新增：柔和蓝灰
  Misunderstood: {
    labelEn: "Misunderstood",
    labelZh: "委屈",
    color: "#EDE6FB",
    darkText: true,
  }, // ✅ 新增：柔和紫灰 (改色自 #E8D4F0)
  Lonely: {
    labelEn: "Lonely",
    labelZh: "孤独",
    color: "#D4D9E8",
    darkText: true,
  }, // ✅ 新增：柔和蓝灰（表达孤立感）
  Down: { labelEn: "Down", labelZh: "低落", color: "#D9E9FF", darkText: true }, // 柔和天蓝
  Anxious: {
    labelEn: "Anxious",
    labelZh: "焦虑",
    color: "#EDE6FB",
    darkText: true,
  }, // 柔和淡紫
  Overwhelmed: {
    labelEn: "Overwhelmed",
    labelZh: "疲惫",
    color: "#E2E7FB",
    darkText: true,
  }, // ✅ 新增：柔和淡紫 (改色自 #D9E9FF)
  Venting: {
    labelEn: "Venting",
    labelZh: "宣泄",
    color: "#FFD5D5",
    darkText: true,
  }, // 柔和粉红
  Frustrated: {
    labelEn: "Frustrated",
    labelZh: "受挫",
    color: "#FADAD4",
    darkText: true,
  }, // ✅ 新增：柔和淡红 (改色自 #FFCCE0)
};

// 默认兜底配置
export const DEFAULT_EMOTION: EmotionConfig = EMOTION_MAP.Thoughtful;

export interface EmotionData {
  emotion: string;
  confidence: number;
  rationale?: string;
}
