import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, StyleSheet } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import DiaryListScreen from "../screens/DiaryListScreen";
import CreateTextDiaryScreen from "../screens/CreateTextDiaryScreen";
import TestScreen from "../screens/TestScreen";
import { getCurrentUser, signOut } from "../services/authService";
import { apiService } from "../services/apiService";

export type RootStackParamList = {
  Login: undefined;
  DiaryList: undefined;
  CreateDiary: { inputMode?: "voice" | "text" };
  Test: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
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
   * 根据认证状态决定初始路由
   * - isAuthenticated === null: 正在检查（显示loading）
   * - isAuthenticated === true: 用户已登录，跳转到日记列表
   * - isAuthenticated === false: 用户未登录，显示登录页
   */
  const getInitialRouteName = (): keyof RootStackParamList => {
    if (isAuthenticated === null) {
      return "Login"; // 默认值，实际不会显示因为我们在loading
    }
    return isAuthenticated ? "DiaryList" : "Login";
  };

  // 显示加载状态，直到确定认证状态
  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D96F4C" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
        }}
      >
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
    backgroundColor: "#FFFFFF",
  },
});
