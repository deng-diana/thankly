import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EmotionType, EMOTION_MAP } from '../types/emotion';

interface EmotionGlowProps {
  emotion: string | null | undefined;
}

/**
 * 情绪光晕组件
 * 在卡片右上角显示与情绪颜色匹配的弥散光晕效果
 */
export const EmotionGlow: React.FC<EmotionGlowProps> = ({ emotion }) => {
  if (!emotion) return null;

  // 获取情绪配置
  const config = EMOTION_MAP[emotion as EmotionType];
  if (!config) return null;

  // 获取情绪颜色
  const baseColor = config.color;
  
  // 将hex颜色转换为RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgb = hexToRgb(baseColor);
  if (!rgb) return null;

  // 基础光晕颜色
  const glowColors = [
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65)`,  // 核心
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,   // 过渡
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,   // 淡化
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`,     // 透明
  ] as const;

  const locations = [0, 0.4, 0.8, 1.0] as const;

  return (
    <View style={styles.glowContainer} pointerEvents="none">
      {/* 情绪光晕层 */}
      <LinearGradient
        colors={glowColors}
        locations={locations}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.1, y: 0.9 }} 
        style={styles.gradient}
      />
      
      {/* ✅ 物理遮罩层：从透明渐变到白色，覆盖底部硬边 */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.mask}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  glowContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',     // ✅ 加大宽度，覆盖整个顶部横向区域
    height: 100,       // 保持 1/3 高度
    borderTopRightRadius: 16,
    overflow: 'hidden', 
    zIndex: 0, 
  },
  gradient: {
    flex: 1,
  },
  mask: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40, // 底部 40px 用于遮罩
  }
});
