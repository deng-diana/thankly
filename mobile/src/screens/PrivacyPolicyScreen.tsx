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
import i18n, { getCurrentLocale, t } from "../i18n";

type PolicySection = {
  heading: string;
  description?: string;
  subsections: Array<{
    title: string;
    body: string[];
  }>;
};

type PrivacyPolicyContent = {
  title: string;
  effectiveDateLabel: string;
  effectiveDateValue: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  intro: string[];
  sections: PolicySection[];
  closing: string[];
  importantNotesTitle: string;
  importantNotes: string[];
};

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const typography = getTypography();
  const locale = getCurrentLocale();
  const translations = (
    i18n as unknown as {
      translations: Record<string, Record<string, unknown>>;
    }
  ).translations;

  const policy = translations?.[locale]?.privacyPolicyPage as
    | PrivacyPolicyContent
    | undefined;

  const renderLine = (line: string, key: string | number) => {
    const trimmed = line.trim();
    const isBullet = /^[-•]/.test(trimmed);

    if (isBullet) {
      const content = trimmed.replace(/^[-•]\s*/, "");
      return (
        <View key={key} style={styles.bulletRow}>
          <Text style={[styles.bulletSymbol, typography.body]}>•</Text>
          <Text style={[styles.bulletText, typography.body]}>{content}</Text>
        </View>
      );
    }

    return (
      <Text key={key} style={[styles.paragraph, typography.body]}>
        {line}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#73483A" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, typography.diaryTitle]}>
          {t("onboarding.welcome.privacyPolicy")}
        </Text>
      </View>

      {/* 内容 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {policy ? (
          <View>
            <Text style={[styles.title, typography.diaryTitle]}>
              {policy.title}
            </Text>
            <Text style={[styles.meta, typography.body]}>
              {policy.effectiveDateLabel}: {policy.effectiveDateValue}
            </Text>
            <Text style={[styles.meta, typography.body]}>
              {policy.lastUpdatedLabel}: {policy.lastUpdatedValue}
            </Text>

            {policy.intro.map((paragraph, index) =>
              renderLine(paragraph, `intro-${index}`)
            )}

            {policy.sections.map((section, sectionIndex) => (
              <View key={`section-${sectionIndex}`} style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, typography.diaryTitle]}>
                  {section.heading}
                </Text>
                {section.description
                  ? renderLine(
                      section.description,
                      `section-desc-${sectionIndex}`
                    )
                  : null}
                {section.subsections.map((subsection, subsectionIndex) => (
                  <View
                    key={`section-${sectionIndex}-sub-${subsectionIndex}`}
                    style={styles.subsectionBlock}
                  >
                    <Text style={[styles.subheading, typography.sectionTitle]}>
                      {subsection.title}
                    </Text>
                    {subsection.body.map((line, lineIndex) =>
                      renderLine(
                        line,
                        `section-${sectionIndex}-sub-${subsectionIndex}-line-${lineIndex}`
                      )
                    )}
                  </View>
                ))}
              </View>
            ))}

            {policy.importantNotes.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, typography.diaryTitle]}>
                  {policy.importantNotesTitle}
                </Text>
                {policy.importantNotes.map((note, index) =>
                  renderLine(note, `important-${index}`)
                )}
              </View>
            ) : null}

            {policy.closing.map((closingLine, index) =>
              renderLine(closingLine, `closing-${index}`)
            )}
          </View>
        ) : (
          <Text style={[styles.paragraph, typography.body]}>
            {t("common.loading")}
          </Text>
        )}
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
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E3C2",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    color: "#73483A",
    fontWeight: "600",
    marginLeft: 8,
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
  meta: {
    fontSize: 16,
    color: "#332824",
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    color: "#1A1A1A",
    lineHeight: 24,
    marginBottom: 16,
  },
  sectionBlock: {
    marginTop: 24,
  },
  subsectionBlock: {
    marginTop: 12,
  },
  sectionHeading: {
    fontSize: 20,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    color: "#332824",
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bulletSymbol: {
    width: 12,
    color: "#332824",
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    color: "#1A1A1A",
    lineHeight: 24,
    marginLeft: 8,
  },
});
