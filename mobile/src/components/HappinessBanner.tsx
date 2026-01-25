/**
 * HappinessBanner 组件
 * 
 * 幸福罐入口 Banner，显示在日记列表页顶部
 * 
 * 功能：
 * - 显示幸福日记数量
 * - 支持中英文文案
 * - 主题色高亮"幸福"/"Happiness"
 * - 数字加粗显示
 * - 入场动画（淡入 + 缩放）
 * - 点击导航到幸福罐页面
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { t, getCurrentLocale } from '../i18n';
import HappinessBannerBg from '../assets/icons/happinessBanner.svg';
import { getFontFamilyForText } from '../styles/typography';

// ✅ SVG 原始尺寸：347×81
// 宽高比 = 347 / 81 = 4.284
const SVG_ASPECT_RATIO = 347 / 81;

interface HappinessBannerProps {
  /** 幸福日记数量 */
  count: number;
  /** 点击回调 */
  onPress: () => void;
}

const HappinessBanner: React.FC<HappinessBannerProps> = ({ count, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const currentLocale = getCurrentLocale();

  // 入场动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /**
   * 渲染标题（带主题色高亮）
   * CN: "回顾你的【幸福】时光"
   * EN: "Revisit your 【Happiness】 Jar"
   */
  const renderTitle = () => {
    const titleText = t('happinessJar.bannerTitle');
    const highlightText = t('happinessJar.bannerTitleHighlight');

    // 拆分文案：前半部分 + 高亮 + 后半部分
    const parts = titleText.split(highlightText);

    return (
      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(titleText, 'bold'),
          },
        ]}
      >
        {parts[0]}
        <Text style={styles.highlightText}>{highlightText}</Text>
        {parts[1] || ''}
      </Text>
    );
  };

  /**
   * 渲染副标题（数字加粗）
   * CN: "【18】 个温暖的瞬间，点亮你的心"
   * EN: "【18】 moments that brighten your days"
   */
  const renderSubtitle = () => {
    const subtitle = t('happinessJar.bannerSubtitle', { count });
    const countStr = count.toString();
    
    // 拆分：数字 + 其余文字
    const parts = subtitle.split(countStr);

    return (
      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(subtitle, 'regular'),
          },
        ]}
      >
        {parts[0]}
        <Text 
          style={[
            styles.countText,
            {
              fontFamily: getFontFamilyForText(countStr, 'bold'), // ✅ 使用 Lora 字体（英文）
            },
          ]}
        >
          {countStr}
        </Text>
        {parts[1] || ''}
      </Text>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.touchable}
        accessibilityLabel={`Open happiness jar with ${count} moments`}
        accessibilityRole="button"
      >
        {/* SVG 背景 - 按原图比例自适应，不裁剪 */}
        <HappinessBannerBg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        />

        {/* 文案内容 - 绝对定位覆盖在 SVG 上方 */}
        <View style={styles.contentContainer}>
          {renderTitle()}
          {renderSubtitle()}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 0, // ✅ 与分割线的 marginTop 统一，由分割线承担间距避免重复
    marginHorizontal: -4, // ✅ 负 margin 抵消 header 的 padding，实现 20px 间距 (24 - 4 = 20)
  },
  touchable: {
    width: '100%',
    aspectRatio: SVG_ASPECT_RATIO, // ✅ 347/81 = 4.284，高度自适应
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative', // ✅ 为绝对定位的子元素提供参照
  },
  contentContainer: {
    position: 'absolute', // ✅ 绝对定位覆盖在 SVG 上方
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center', // ✅ 垂直居中
    paddingLeft: 28, // ✅ 距离banner左边28px
    paddingRight: 64, // ✅ 减少右侧padding，让文字区域更宽，两行显示
  },
  title: {
    fontSize: 15, // ✅ 标题字号15px
    fontWeight: '700', // 最粗
    color: '#333',
    marginBottom: 4, // ✅ 标题与副标题间距4px
    lineHeight: 18, // ✅ 调整行高
  },
  highlightText: {
    color: '#FF6B35', // 主题色高亮
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14, // ✅ 描述文案字号14px
    fontWeight: '400', // regular
    color: '#80645A', // ✅ 与"Hi Diana"下方文字颜色一致
    lineHeight: 18, // ✅ 调整行高匹配字号
  },
  countText: {
    fontSize: 13, // ✅ 数字字号13px（比描述文案小1px）
    fontWeight: '700', // ✅ 数字加粗（从 900 改为 700，不会太粗）
    color: '#FF6B35', // 数字也用主题色
    // ✅ fontFamily 通过 inline style 动态设置（使用 Lora 字体）
  },
});

export default HappinessBanner;
