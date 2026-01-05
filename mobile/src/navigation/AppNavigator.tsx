import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";

import LoginScreen from "../screens/LoginScreen";
import DiaryListScreen from "../screens/DiaryListScreen";
import CreateTextDiaryScreen from "../screens/CreateTextDiaryScreen";
import TestScreen from "../screens/TestScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import OnboardingCarousel from "../components/OnboardingCarousel";
import OnboardingScreen1 from "../screens/OnboardingScreen1";
import OnboardingScreen2 from "../screens/OnboardingScreen2";
import OnboardingScreen3 from "../screens/OnboardingScreen3";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "../screens/TermsOfServiceScreen";
import ReminderSettingsScreen from "../screens/ReminderSettingsScreen";
import { getCurrentUser, signOut } from "../services/authService";
import { apiService } from "../services/apiService";
import { navigationRef } from "./navigationRef";

export type RootStackParamList = {
  Welcome: undefined;
  OnboardingCarousel: undefined;
  Onboarding1: undefined;
  Onboarding2: undefined;
  Onboarding3: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  ReminderSettings: undefined;
  Login: undefined;
  DiaryList: undefined;
  CreateDiary: { inputMode?: "voice" | "text" };
  Test: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// 🛠️ 开发模式：始终显示Onboarding（方便测试和调试）
// ⚠️ 生产环境需保持为 false，避免老用户反复进入欢迎页
// 🛠️ 开发模式开关：保持为 false，生产环境下只在首次安装时展示欢迎页
const DEV_MODE_FORCE_ONBOARDING = false;

export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkOnboardingStatus();
    checkAuthStatus();

    // 注册认证过期监听器
    const handleAuthExpired = () => {
      console.log("🔐 认证已过期，自动退出登录");
      setIsAuthenticated(false);
      // 清除用户数据
      signOut();
    };

    apiService.onAuthExpired(handleAuthExpired);

    // 清理函数
    return () => {
      apiService.offAuthExpired(handleAuthExpired);
    };
  }, [refreshKey]);

  /**
   * 检查是否已完成Onboarding
   * 首次安装时显示引导流程
   */
  const checkOnboardingStatus = async () => {
    try {
      const completed = await SecureStore.getItemAsync(
        "hasCompletedOnboarding"
      );
      setHasCompletedOnboarding(completed === "true");
      console.log(
        "🔍 检查Onboarding状态:",
        completed === "true" ? "已完成" : "未完成"
      );
    } catch (error) {
      console.error("❌ 检查Onboarding状态失败:", error);
      setHasCompletedOnboarding(false);
    }
  };

  /**
   * 检查用户是否已登录
   * 应用启动时调用，从SecureStore恢复登录状态
   */
  const checkAuthStatus = async () => {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(user !== null);
      console.log("🔍 检查登录状态:", user ? "已登录" : "未登录");
    } catch (error) {
      console.error("❌ 检查登录状态失败:", error);
      setIsAuthenticated(false);
    }
  };

  /**
   * 根据认证状态和Onboarding状态决定初始路由
   * 优先级：Onboarding > 认证状态
   */
  const getInitialRouteName = (): keyof RootStackParamList => {
    // 🛠️ 开发模式：始终显示Onboarding
    if (DEV_MODE_FORCE_ONBOARDING) {
      return "Welcome";
    }

    // 如果还没检查完成，返回默认值（不会显示，因为会显示loading）
    if (hasCompletedOnboarding === null || isAuthenticated === null) {
      return "Welcome";
    }

    // 如果未完成Onboarding，显示欢迎页
    if (!hasCompletedOnboarding) {
      return "Welcome";
    }

    // 如果已完成Onboarding，根据认证状态决定
    return isAuthenticated ? "DiaryList" : "Login";
  };

  // 显示加载状态，直到确定所有状态
  // 🛠️ 开发模式下，直接显示WelcomeScreen，减少闪屏感
  if (
    !DEV_MODE_FORCE_ONBOARDING &&
    (isAuthenticated === null || hasCompletedOnboarding === null)
  ) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E56C45" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Onboarding流程 */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen
          name="OnboardingCarousel"
          component={OnboardingCarousel}
        />
        {/* 保留旧的单个屏幕路由，用于向后兼容 */}
        <Stack.Screen name="Onboarding1" component={OnboardingScreen1} />
        <Stack.Screen name="Onboarding2" component={OnboardingScreen2} />
        <Stack.Screen name="Onboarding3" component={OnboardingScreen3} />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="ReminderSettings"
          component={ReminderSettingsScreen}
        />

        {/* 主要功能页面 */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="DiaryList" component={DiaryListScreen} />
        <Stack.Screen name="CreateDiary" component={CreateTextDiaryScreen} />
        <Stack.Screen name="Test" component={TestScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF6ED", // 与WelcomeScreen背景色一致
  },
});
