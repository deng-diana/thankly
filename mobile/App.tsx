/**
 * App入口文件
 *
 * SafeAreaProvider提供安全区域上下文
 * 必须包裹在最外层
 */
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
  NotoSerifSC_700Bold,
} from "@expo-google-fonts/noto-serif-sc";
import React, { useEffect, useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { navigate } from "./src/navigation/navigationRef";
import {
  maybeAutoEnableReminderOnLaunch,
  refreshDailyReminderIfEnabled,
} from "./src/services/notificationService";
import { ensureNotificationChannel } from "./src/services/notificationService";
import * as SecureStore from "expo-secure-store";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://76689860c832af9ae294f1729a01a7e0@o4510687210962944.ingest.us.sentry.io/4510687420350464',
  
  // ✅ 添加更多上下文信息
  sendDefaultPii: true,
  
  // ✅ 启用日志
  enableLogs: true,
  
  // ✅ 配置Session Replay (可以看到崩溃前的用户操作)
  replaysSessionSampleRate: 0.1,  // 10%的正常session
  replaysOnErrorSampleRate: 1.0,  // 100%的错误session
  
  integrations: [
    Sentry.mobileReplayIntegration(), 
    Sentry.feedbackIntegration()
  ],
  
  // ✅ 添加环境标识
  environment: __DEV__ ? 'development' : 'production',
  
  // ✅ 添加版本信息
  release: 'thankly@1.1.0',
});

// ✅ 保持 splash screen，直到应用准备好再关闭
SplashScreen.preventAutoHideAsync().catch(() => {
  // 忽略重复调用导致的报错
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  // ✅ 加载双字体系统：Lora（英文）+ Noto Serif SC（中文）
  const [fontsLoaded, fontError] = useFonts({
    // Lora 字体（英文优雅衬线字体）
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold, // ✅ 新增 Bold 字重
    // Noto Serif SC 字体（中文优雅衬线字体）
    NotoSerifSC_400Regular,
    NotoSerifSC_500Medium,
    NotoSerifSC_600SemiBold,
    NotoSerifSC_700Bold, // ✅ 新增 Bold 字重
  });
  const [appIsReady, setAppIsReady] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppIsReady(true);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // ✅ Best Practice: 在 App 启动时创建 Android 通知渠道
    // 这确保即使用户在系统设置中删除了渠道，也能重新创建
    ensureNotificationChannel().catch(() => {});
    
    refreshDailyReminderIfEnabled().catch(() => {});
    SecureStore.getItemAsync("hasCompletedOnboarding")
      .then((completed) =>
        maybeAutoEnableReminderOnLaunch(completed === "true")
      )
      .catch(() => {});

    const handleNavigation = (data: any) => {
      if (!data?.screen) return;
      const params = data.inputMode ? { inputMode: data.inputMode } : undefined;
      setTimeout(() => {
        if (data.screen === "DiaryList") {
          navigate("MainDrawer", { screen: "Home", params: { screen: "DiaryList" } });
          return;
        }
        navigate(data.screen, params);
      }, 300);
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNavigation(response.notification.request.content.data);
      });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNavigation(response.notification.request.content.data);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (appIsReady && isLayoutReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isLayoutReady]);

  const onLayoutRootView = useCallback(() => {
    setIsLayoutReady(true);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <View
          style={{ flex: 1, backgroundColor: "#FAF6ED" }}
          onLayout={onLayoutRootView}
        >
          {appIsReady ? <AppNavigator /> : null}
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}