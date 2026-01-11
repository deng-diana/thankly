/**
 * 引导页4 - "Every feeling deserves a home"
 * 最后一页，包含"Begin My Journey"按钮
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useNavigation } from "@react-navigation/native";
import { t } from "../i18n";
import { getTypography } from "../styles/typography";
import Onboarding4Icon from "../assets/icons/onboarding4.svg";
import {
  applyReminderSettings,
  markReminderAutoPrompted,
  requestNotificationPermission,
} from "../services/notificationService";

export default function OnboardingScreen4() {
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
            // ✅ 专业方案：清晰的权限请求流程
            // Step 1: 标记已提示（防止 maybeAutoEnableReminderOnLaunch 再次请求）
            await markReminderAutoPrompted();
            
            // Step 2: 请求权限
            const granted = await requestNotificationPermission();
            
            // Step 3: 根据权限结果保存设置
            // ✅ 使用 try-catch 确保即使设置失败也不阻断用户流程
            try {
              await applyReminderSettings({
                enabled: granted, // ✅ 只在权限授予时启用
                hour: 20,
                minute: 0,
              });
            } catch (error) {
              // ✅ 记录错误但不阻断流程
              console.warn("Failed to apply reminder settings during onboarding:", error);
            }
            
            // Step 4: 完成onboarding并导航
            // ✅ 无论提醒设置是否成功，都继续导航（不阻断用户）
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
          <Onboarding4Icon width={160} height={160} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, typography.diaryTitle]}>
            {t("onboarding.guide4.title")}
          </Text>
          <Text style={[styles.subtitle, typography.body]}>
            {t("onboarding.guide4.subtitle")}
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
            {t("onboarding.guide4.getStartedButton")}
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
    backgroundColor: "#FAF6ED",
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
