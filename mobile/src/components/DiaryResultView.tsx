/**
 * 日记结果展示组件
 * 
 * 用于显示处理后的日记（文字输入和语音输入共享）
 */
import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../styles/typography";
import { t } from "../i18n";

interface DiaryResultViewProps {
  title: string;
  polishedContent: string;
  aiFeedback: string;
  isEditing: boolean;
  editedContent: string;
  onStartEditing: () => void;
  onContentChange: (text: string) => void;
}

export default function DiaryResultView({
  title,
  polishedContent,
  aiFeedback,
  isEditing,
  editedContent,
  onStartEditing,
  onContentChange,
}: DiaryResultViewProps) {
  return (
    <>
      {/* 标题和内容卡片 */}
      <View style={styles.resultDiaryCard}>
        {/* 标题 */}
        {!!title && !isEditing && (
          <Text style={styles.resultTitleText}>{title}</Text>
        )}

        {/* 内容 - 可点击编辑 */}
        {isEditing ? (
          <TextInput
            style={styles.editContentInput}
            value={editedContent}
            onChangeText={onContentChange}
            multiline
            autoFocus
            placeholder={t("diary.placeholderContent")}
          />
        ) : (
          <TouchableOpacity onPress={onStartEditing} activeOpacity={0.7}>
            <Text style={styles.resultContentText}>{polishedContent}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* AI反馈 - 编辑时隐藏 */}
      {!isEditing && !!aiFeedback && (
        <View style={styles.resultFeedbackCard}>
          <View style={styles.resultFeedbackHeader}>
            <Ionicons name="sparkles" size={18} color="#D96F4C" />
            <Text style={styles.resultFeedbackTitle}>
              {t("diary.aiFeedbackTitle")}
            </Text>
          </View>
          <Text style={styles.resultFeedbackText}>{aiFeedback}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // ===== 日记卡片 =====
  resultDiaryCard: {
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0, // ✅ 外层 ScrollView 已经有 paddingHorizontal: 20
    marginBottom: 12,
  },

  resultTitleText: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  resultContentText: {
    ...Typography.body,
    lineHeight: 26,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },

  editContentInput: {
    ...Typography.body,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#D96F4C",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 200,
    maxHeight: 400,
    textAlignVertical: "top",
  },

  // ===== AI反馈卡片 =====
  resultFeedbackCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0, // ✅ 外层 ScrollView 已经有 paddingHorizontal: 20
    marginBottom: 20,
  },

  resultFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  resultFeedbackTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: "#D96F4C",
    marginLeft: 6,
  },

  resultFeedbackText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: "#1A1A1A",
  },
});

