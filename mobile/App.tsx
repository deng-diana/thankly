/**
 * App入口文件
 *
 * SafeAreaProvider提供安全区域上下文
 * 必须包裹在最外层
 */
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
} from "@expo-google-fonts/lora";
import {
  NotoSerifSC_400Regular,
  NotoSerifSC_500Medium,
  NotoSerifSC_600SemiBold,
} from "@expo-google-fonts/noto-serif-sc";
import React, { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";

// ✅ 立即隐藏 splash screen，避免与 WelcomeScreen 重复
SplashScreen.hideAsync();

export default function App() {
  // ✅ 加载双字体系统：Lora（英文）+ Noto Serif SC（中文）
  const [fontsLoaded, fontError] = useFonts({
    // Lora 字体（英文优雅衬线字体）
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    // Noto Serif SC 字体（中文优雅衬线字体）
    NotoSerifSC_400Regular,
    NotoSerifSC_500Medium,
    NotoSerifSC_600SemiBold,
  });

  // 字体未加载完成时，显示与 WelcomeScreen 一致的背景色（减少闪屏感）
  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: "#FAF6ED" }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
