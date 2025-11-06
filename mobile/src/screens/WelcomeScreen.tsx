/**
 * 欢迎页 - Onboarding流程的第一个页面
 *
 * 设计理念（乔布斯视角）：
 * - 简洁、优雅、不打扰
 * - 清晰传达产品价值
 * - 提供明确的下一步操作
 *
 * 技术实现（Google开发者视角）：
 * - 组件化、可复用
 * - 类型安全
 * - 性能优化
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useNavigation } from "@react-navigation/native";
import { t, getCurrentLocale } from "../i18n";
import i18n from "../i18n";
import { getTypography } from "../styles/typography";
import AppIcon from "../../assets/app-icon.svg";

export default function WelcomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const typography = getTypography();

  const handlePrivacyPress = () => {
    // TODO: 导航到隐私政策页面
    navigation.navigate("PrivacyPolicy" as any);
  };

  const handleTermsPress = () => {
    // TODO: 导航到服务条款页面
    navigation.navigate("TermsOfService" as any);
  };

  const handleAgreeContinue = async () => {
    // 标记已查看欢迎页（但还没完成整个Onboarding）
    // 进入引导页轮播
    navigation.navigate("OnboardingCarousel" as any);
  };

  // 渲染带链接的文本
  const renderPrivacyNotice = () => {
    const locale = getCurrentLocale();
    // ✅ 直接从翻译对象获取原始字符串（包含占位符），避免 t() 函数处理占位符
    const translations = i18n.translations[locale];
    const rawNoticeText =
      translations?.onboarding?.welcome?.privacyNotice || "";

    // ✅ 通过 t() 函数获取链接文本（这些是独立的键，不会有问题）
    const privacyPolicyText = t("onboarding.welcome.privacyPolicy");
    const termsOfServiceText = t("onboarding.welcome.termsOfService");

    // 检查翻译是否正确加载
    if (
      !rawNoticeText ||
      !privacyPolicyText ||
      !termsOfServiceText ||
      rawNoticeText.startsWith("[missing") ||
      privacyPolicyText.startsWith("[missing") ||
      termsOfServiceText.startsWith("[missing")
    ) {
      console.warn("⚠️ 翻译文本未正确加载:", {
        rawNoticeText,
        privacyPolicyText,
        termsOfServiceText,
      });
      // 如果翻译失败，使用硬编码的文本作为后备
      const fallbackNotice =
        locale === "zh"
          ? "阅读我们的隐私政策，点击「同意并继续」即表示接受服务条款"
          : "Read our Privacy Policy. Tap 'Agree & Continue' to accept the Terms of Service.";
      return (
        <Text style={[styles.legalText, typography.caption]}>
          {fallbackNotice}
        </Text>
      );
    }

    // ✅ 使用原始字符串分割，保留占位符
    const parts = rawNoticeText.split(/({{privacyPolicy}}|{{termsOfService}})/);

    return (
      <Text style={[styles.legalText, typography.caption]}>
        {parts.map((part: string, index: number) => {
          if (part === "{{privacyPolicy}}") {
            return (
              <Text
                key={`privacy-${index}`}
                style={styles.link}
                onPress={handlePrivacyPress}
              >
                {privacyPolicyText}
              </Text>
            );
          }
          if (part === "{{termsOfService}}") {
            return (
              <Text
                key={`terms-${index}`}
                style={styles.link}
                onPress={handleTermsPress}
              >
                {termsOfServiceText}
              </Text>
            );
          }
          // 空字符串不渲染
          if (!part) return null;
          return <Text key={`text-${index}`}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 上半部分：Logo 和标题（可滚动） */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <AppIcon width={96} height={96} />
        </View>

        {/* 标题和副标题 */}
        <View style={styles.contentContainer}>
          <Text style={[styles.title, typography.diaryTitle]}>
            {t("onboarding.welcome.title")}
          </Text>
          <Text style={[styles.subtitle, typography.body]}>
            {t("onboarding.welcome.subtitle")}
          </Text>
        </View>
      </ScrollView>

      {/* 下半部分：法律文本和按钮（固定在底部） */}
      <View style={styles.bottomContainer}>
        {/* 隐私政策和服务条款 */}
        <View style={styles.legalContainer}>{renderPrivacyNotice()}</View>

        {/* 主按钮 */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleAgreeContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, typography.body]}>
            {t("onboarding.welcome.agreeButton")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 120,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 12, // ✅ 增加 logo 下方间距，使其与标题更近
  },

  logo: {
    width: 96,
    height: 96,
    // 如果需要圆角，可以添加：
    // borderRadius: 24,
  },
  contentContainer: {
    alignItems: "center",
  },
  bottomContainer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  legalContainer: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  legalText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  link: {
    color: "#E56C45", // 主题色
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: "#E56C45", // 主题色
    borderRadius: 12,
    paddingVertical: 14,
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
