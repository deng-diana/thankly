/**
 * Skip按钮组件
 * 
 * 设计理念：不打扰用户，但提供快速跳过的选项
 * 使用主题色，保持一致的视觉语言
 */
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { t } from "../i18n";
import { getTypography } from "../styles/typography";

interface SkipButtonProps {
  onPress: () => void;
}

export default function SkipButton({ onPress }: SkipButtonProps) {
  const typography = getTypography();

  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.text, typography.body]}>{t("onboarding.skip")}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: "#E56C45", // 主题色
    fontSize: 16,
    fontWeight: "500",
  },
});






