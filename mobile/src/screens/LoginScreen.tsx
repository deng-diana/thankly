/**
 * 登录页面
 *
 * 这个页面显示:
 * - App的logo和标题
 * - Apple登录按钮
 * - Google登录按钮
 * - 欢迎文字
 */
import { useNavigation } from "@react-navigation/native"; // ✅ 添加这行
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
// ✅ 正确的SafeAreaView导入
import { SafeAreaView } from "react-native-safe-area-context";

// 导入图标
import { Ionicons } from "@expo/vector-icons";

import { signInWithApple, signInWithGoogle } from "../services/authService";

// ============================================================================
// 🌍 Step 1: 导入翻译函数
// ============================================================================
// 'export const t'的t是translate的缩写，Google/Facebook等大厂的标准命名
import { t, getCurrentLocale } from "../i18n";
import { Typography } from "../styles/typography";

// 登录页面组件
export default function LoginScreen() {
  //添加navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // 加载状态
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "apple" | "google" | null
  >(null);

  // 🔍 调试：组件挂载时打印翻译结果
  React.useEffect(() => {
    console.log("🔍 LoginScreen mounted, testing translations:");
    console.log("  - Current locale:", getCurrentLocale());
    console.log("  - t('login.appleSignIn'):", t("login.appleSignIn"));
    console.log("  - t('login.googleSignIn'):", t("login.googleSignIn"));
    console.log("  - t('common.cancel'):", t("common.cancel"));
  }, []);

  // Apple登录
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setLoadingProvider("apple");

      console.log("开始Apple登录...");
      const user = await signInWithApple();

      console.log("登录成功!", user);
      // ✅ 跳转到日记列表
      navigation.replace("DiaryList");

      // TODO: 跳转到日记列表页面
    } catch (error: any) {
      console.error("Apple登录错误:", error);

      // 用户取消登录,不显示错误
      if (error.message.includes("已取消")) {
        return;
      }

      // 显示更友好的错误信息
      let errorMessage = error.message || "发生未知错误";

      // ============================================================================
      // 🌍 Step 2: 使用翻译函数替换硬编码文本
      // ============================================================================
      // 为什么要这样改？
      // - t('error.networkError') 会根据系统语言返回中文或英文
      // - 代码更简洁，不需要写两遍（中文版+英文版）
      // - 方便未来添加更多语言（只需加翻译文件，代码不用动）

      // 处理常见的网络错误
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      } else if (errorMessage.includes("timeout")) {
        errorMessage = t("common.retry");
      } else if (errorMessage.includes("无效的 Apple token")) {
        errorMessage = t("error.authExpired");
      } else if (errorMessage.includes("Apple 登录失败")) {
        // 提取具体错误信息
        const match = errorMessage.match(/Apple 登录失败: (.+)/);
        if (match) {
          errorMessage = match[1];
        }
      }

      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // Google登录
  const handleGoogleSignIn = async () => {
    // ✅ 如果正在加载,直接返回
    if (loading) {
      return;
    }
    try {
      setLoading(true);
      setLoadingProvider("google");

      console.log("开始Google登录...");
      const user = await signInWithGoogle();

      console.log("登录成功!", user);
      // ✅ 跳转到日记列表
      navigation.replace("DiaryList");
      // TODO: 跳转到日记列表页面
    } catch (error: any) {
      console.error("Google登录错误:", error);

      // 用户取消登录,不显示错误
      if (error.message.includes("已取消")) {
        return;
      }

      // 显示更友好的错误信息
      let errorMessage = error.message || "发生未知错误";

      // 处理常见的网络错误
      if (errorMessage.includes("Network request failed")) {
        errorMessage = "网络连接失败，请检查网络设置";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "请求超时，请重试";
      } else if (errorMessage.includes("invalid_grant")) {
        errorMessage = "登录已过期,请重新尝试";
      } else if (errorMessage.includes("Google 登录失败")) {
        // 提取具体错误信息
        const match = errorMessage.match(/Google 登录失败: (.+)/);
        if (match) {
          errorMessage = match[1];
        }
      }

      Alert.alert("登录失败", errorMessage, [{ text: "好的" }]);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSpacer} />

        <View style={styles.headerSection}>
          <Text style={styles.logo}>🙏</Text>
          <Text style={styles.title}>{t("home.welcome")}</Text>
          <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
        </View>

        <View style={styles.buttonSection}>
          {/* Apple登录按钮 */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              {loadingProvider === "apple" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="logo-apple"
                    size={24}
                    color="#fff"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.appleButtonText}>
                    {t("login.appleSignIn")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google登录按钮 */}
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loadingProvider === "google" ? (
              <ActivityIndicator color="#DB4437" />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={24}
                  color="#DB4437"
                  style={styles.buttonIcon}
                />
                <Text style={styles.googleButtonText}>
                  {t("login.googleSignIn")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("login.termsHint")}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * 样式定义
 *
 * 理解样式:
 * - flex: 1 表示占满整个空间
 * - alignItems: 'center' 表示水平居中
 * - justifyContent: 'center' 表示垂直居中
 * - padding: 20 表示内边距20像素
 * - marginBottom: 10 表示底部外边距10像素
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  topSpacer: {
    flex: 1,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    ...Typography.diaryTitle,
    fontSize: 32,
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: "#666",
    textAlign: "center",
  },
  buttonSection: {
    width: "100%",
    gap: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 56, // 确保加载时高度不变
  },
  appleButton: {
    backgroundColor: "#000",
  },
  googleButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonIcon: {
    marginRight: 12,
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  googleButtonText: {
    color: "#1a1a1a",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
});
