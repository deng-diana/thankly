/**
 * 引导页1 - "Just speak it out"
 *
 * 设计理念：简洁、优雅、有温度
 * 技术实现：可复用、性能优化
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { t } from "../i18n";
import { getTypography } from "../styles/typography";
import Onboarding1Icon from "../assets/icons/onboarding1.svg";

export default function OnboardingScreen1() {
  const typography = getTypography();

  return (
    <View style={styles.container}>
      {/* 内容区域 */}
      <View style={styles.content}>
        {/* 插画 */}
        <View style={styles.illustrationContainer}>
          <Onboarding1Icon width={160} height={160} />
        </View>

        {/* 标题和副标题 */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, typography.diaryTitle]}>
            {t("onboarding.guide1.title")}
          </Text>
          <Text style={[styles.subtitle, typography.body]}>
            {t("onboarding.guide1.subtitle")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  illustrationContainer: {
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    color: "#1A1A1A",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
