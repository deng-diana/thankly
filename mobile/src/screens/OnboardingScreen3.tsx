/**
 * 引导页3 - "Your gentle AI companion"
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { t } from "../i18n";
import { getTypography } from "../styles/typography";
import Onboarding3Icon from "../assets/icons/onboarding3.svg";

export default function OnboardingScreen3() {
  const typography = getTypography();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.illustrationContainer}>
          <Onboarding3Icon width={160} height={160} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, typography.diaryTitle]}>
            {t("onboarding.guide3.title")}
          </Text>
          <Text style={[styles.subtitle, typography.body]}>
            {t("onboarding.guide3.subtitle")}
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
