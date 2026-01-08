export type EmotionType = 
  | 'Joyful' 
  | 'Grateful' 
  | 'Proud' 
  | 'Peaceful' 
  | 'Reflective' 
  | 'Down' 
  | 'Anxious' 
  | 'Venting' 
  | 'Drained';

export interface EmotionConfig {
  labelEn: string;
  labelZh: string;
  color: string;
  darkText: boolean;
}

// 情绪配色表 (Based on your Design)
export const EMOTION_MAP: Record<EmotionType, EmotionConfig> = {
  // Positives
  Joyful:     { labelEn: 'Joyful',     labelZh: '喜悦', color: '#FFF2B2', darkText: true },
  Grateful:   { labelEn: 'Grateful',   labelZh: '感恩', color: '#FFD9F5', darkText: true },
  Proud:      { labelEn: 'Proud',      labelZh: '自豪', color: '#FFCFBF', darkText: true },
  
  // Neutrals
  Peaceful:   { labelEn: 'Peaceful',   labelZh: '平静', color: '#D1F6EA', darkText: true },
  Reflective: { labelEn: 'Reflective', labelZh: '思考', color: '#FFECD1', darkText: true },
  
  // Negatives / Release
  Down:       { labelEn: 'Down',       labelZh: '低落', color: '#D8E8FF', darkText: true },
  Anxious:    { labelEn: 'Anxious',    labelZh: '焦虑', color: '#EFE7FF', darkText: true },
  Venting:    { labelEn: 'Venting',    labelZh: '宣泄', color: '#FFD1D1', darkText: true },
  Drained:    { labelEn: 'Drained',    labelZh: '耗竭', color: '#E0E0E0', darkText: true },
};

// 默认兜底配置
export const DEFAULT_EMOTION: EmotionConfig = EMOTION_MAP.Reflective;
