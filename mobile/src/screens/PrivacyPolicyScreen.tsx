/**
 * 隐私政策页面
 *
 * 设计：简洁的文本展示页面
 * 可以使用WebView加载在线版本，或显示本地文本
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getTypography } from "../styles/typography";
import { t } from "../i18n";

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const typography = getTypography();

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.diaryTitle]}>
          {t("onboarding.welcome.privacyPolicy")}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* 内容 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, typography.diaryTitle]}>
          Privacy Policy
        </Text>
        <Text style={[styles.text, typography.body]}>
          Last updated: {new Date().toLocaleDateString()}
        </Text>
        <Text style={[styles.text, typography.body]}>
          {"\n"}Thank you for using thankly. This Privacy Policy explains how we
          collect, use, and protect your information when you use our app.
          {"\n\n"}
          We are committed to protecting your privacy and ensuring the security
          of your personal information. Your data is stored securely and we
          never share it with third parties without your explicit consent.
        </Text>
        {/* TODO: 添加完整的隐私政策内容 */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E3C2",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: "#1A1A1A",
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: "#1A1A1A",
    lineHeight: 24,
    marginBottom: 16,
  },
});
