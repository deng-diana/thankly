/**
 * 引导页3 - "Start today"
 * 最后一页，包含"Get Started"按钮
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useNavigation } from "@react-navigation/native";
import { t } from "../i18n";
import { getTypography } from "../styles/typography";
import Onboarding3Icon from "../assets/icons/onboarding3.svg";
import {
  applyReminderSettings,
  markReminderAutoPrompted,
  requestNotificationPermission,
} from "../services/notificationService";

export default function OnboardingScreen3() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const typography = getTypography();

  const handleGetStarted = async () => {
    Alert.alert(
      t("reminder.onboardingTitle"),
      t("reminder.onboardingMessage"),
      [
        {
          text: t("reminder.onboardingSkip"),
          style: "cancel",
          onPress: async () => {
            await markReminderAutoPrompted();
            await SecureStore.setItemAsync("hasCompletedOnboarding", "true");
            navigation.navigate("Login");
          },
        },
        {
          text: t("reminder.onboardingAllow"),
          onPress: async () => {
            await markReminderAutoPrompted();
            const granted = await requestNotificationPermission();
            if (granted) {
              await applyReminderSettings({
                enabled: true,
                hour: 20,
                minute: 0,
              });
            }
            await SecureStore.setItemAsync("hasCompletedOnboarding", "true");
            navigation.navigate("Login");
          },
        },
      ]
    );
  };

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

      {/* 底部：按钮 */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, typography.body]}>
            {t("onboarding.guide3.getStartedButton")}
          </Text>
        </TouchableOpacity>
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
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 32,
    backgroundColor: "#FAF6ED", // ✅ 保持背景色一致
  },
  button: {
    backgroundColor: "#E56C45",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
