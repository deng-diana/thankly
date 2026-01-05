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
import * as SecureStore from "expo-secure-store";

// ✅ 保持 splash screen，直到应用准备好再关闭
SplashScreen.preventAutoHideAsync().catch(() => {
  // 忽略重复调用导致的报错
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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
      <View
        style={{ flex: 1, backgroundColor: "#FAF6ED" }}
        onLayout={onLayoutRootView}
      >
        {appIsReady ? <AppNavigator /> : null}
      </View>
    </SafeAreaProvider>
  );
}
