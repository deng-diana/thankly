import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmotionType, EMOTION_MAP, DEFAULT_EMOTION } from '../types/emotion';
import { getFontFamilyForText } from '../styles/typography';
import { getCurrentLocale } from '../i18n'; // ✅ 导入当前语言

interface EmotionCapsuleProps {
  emotion: string | null | undefined;
  language?: string; // 日记语言(可能不准确)
  content?: string; // ✅ 新增:日记内容,用于自动检测语言
}

// ✅ 紧急修复：使用React.memo防止过度渲染
export const EmotionCapsule = React.memo<EmotionCapsuleProps>(({ emotion, language = 'en', content }) => {
  // 1. 获取配置,如果没有匹配的则不显示或显示默认
  // 当前策略:如果不识别,回退到 Thoughtful（默认中性标签）
  const config = emotion && EMOTION_MAP[emotion as EmotionType] 
    ? EMOTION_MAP[emotion as EmotionType] 
    : DEFAULT_EMOTION;

  // 2. 智能语言检测
  // ✅ 优先使用 i18n 当前语言设置（用于截图时强制显示中文）
  const currentLocale = getCurrentLocale();
  let isChinese = currentLocale.toLowerCase().startsWith('zh');
  
  // 如果 i18n 是英文，再根据内容检测
  if (!isChinese && content && content.trim()) {
    // ✅ 根据内容自动检测语言
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = content.length;
    const chineseRatio = chineseChars / totalChars;
    
    // 如果中文字符超过20%,判定为中文
    isChinese = chineseRatio > 0.2;
  }
  
  const label = isChinese ? config.labelZh : config.labelEn;
  
  // ✅ 调试:检查language参数（仅在开发环境）
  if (__DEV__) {
    console.log(`🎭 EmotionCapsule: emotion=${emotion}, language=${language}, isChinese=${isChinese}, label=${label}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: config.color }]}>
      <Text style={[styles.text, { 
        color: config.darkText ? '#333333' : '#FFFFFF',
        fontFamily: getFontFamilyForText(label, 'medium')
      }]}>
        {label}
      </Text>
    </View>
  );
});

// ✅ 添加displayName用于调试
EmotionCapsule.displayName = 'EmotionCapsule';

const styles = StyleSheet.create({
  container: {
    height: 24,
    minWidth: 48, // ✅ 设定最小宽度，确保视觉平衡
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14, // ✅ 减小lineHeight,更接近fontSize,改善垂直居中
    includeFontPadding: false, // Android垂直居中修复
    textAlignVertical: 'center', // ✅ Android垂直居中
  },
});
