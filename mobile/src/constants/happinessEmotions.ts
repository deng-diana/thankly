/**
 * 幸福罐情绪常量配置
 * 
 * 定义哪些情绪属于"幸福时刻"，以及它们的强度映射。
 * 用于筛选和排序幸福日记。
 */

import { Diary } from '../screens/DiaryListScreen';

/**
 * 幸福情绪集合
 * 包含高唤醒正面情绪，能直接激发多巴胺和动力
 */
export const HAPPY_EMOTIONS = ['Joyful', 'Excited', 'Fulfilled', 'Proud', 'Loved'] as const;

export type HappyEmotion = typeof HAPPY_EMOTIONS[number];

/**
 * 情绪强度映射
 * 数字越大表示情绪强度越高，用于"最快乐优先"排序
 */
export const EMOTION_INTENSITY: Record<HappyEmotion, number> = {
  'Joyful': 5,     // 最高：纯粹的快乐
  'Excited': 4,    // 高度期待和兴奋
  'Loved': 3,      // 被爱和归属感
  'Fulfilled': 2,  // 深层满足感
  'Proud': 1       // 成就感
};

/**
 * 按幸福强度排序日记
 * @param diaries - 日记列表
 * @returns 按情绪强度从高到低排序的日记列表
 */
export function sortByHappinessIntensity(diaries: Diary[]): Diary[] {
  return [...diaries].sort((a, b) => {
    const emotionA = a.emotion_data?.emotion as HappyEmotion;
    const emotionB = b.emotion_data?.emotion as HappyEmotion;
    
    const intensityA = EMOTION_INTENSITY[emotionA] || 0;
    const intensityB = EMOTION_INTENSITY[emotionB] || 0;
    
    // 按强度降序排列（最快乐的在前）
    return intensityB - intensityA;
  });
}

/**
 * 检查某个情绪是否属于幸福情绪
 * @param emotion - 情绪名称
 * @returns 是否为幸福情绪
 */
export function isHappyEmotion(emotion: string | null | undefined): boolean {
  if (!emotion) return false;
  return HAPPY_EMOTIONS.includes(emotion as HappyEmotion);
}
