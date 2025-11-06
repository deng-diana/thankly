/**
 * 服务条款页面
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getTypography } from "../styles/typography";
import { t } from "../i18n";

export default function TermsOfServiceScreen() {
  const navigation = useNavigation();
  const typography = getTypography();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.diaryTitle]}>
          {t("onboarding.welcome.termsOfService")}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, typography.diaryTitle]}>
          Terms of Service
        </Text>
        <Text style={[styles.text, typography.body]}>
          Last updated: {new Date().toLocaleDateString()}
        </Text>
        <Text style={[styles.text, typography.body]}>
          {"\n"}By using thankly, you agree to these Terms of Service. Please
          read them carefully.
          {"\n\n"}
          thankly is a gratitude journaling app designed to help you capture and
          reflect on meaningful moments in your life. We provide the service "as
          is" and reserve the right to modify or discontinue the service at any
          time.
        </Text>
        {/* TODO: 添加完整的服务条款内容 */}
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

