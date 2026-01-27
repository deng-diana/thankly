/**
 * 统一的处理加载Modal组件
 * 
 * 设计原则：
 * 1. 统一的蒙版+弹窗样式（页面中央）
 * 2. 可复用的组件，避免重复代码
 * 3. 专业的UI/UX，符合行业最佳实践
 * 
 * 使用场景：
 * - 文字日记处理中
 * - 语音日记处理中
 * - 多模态日记处理中
 */
import React from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import { Typography, getFontFamilyForText } from "../styles/typography";
import { t } from "../i18n";

export interface ProcessingStep {
  icon: string;
  text: string;
}

interface ProcessingModalProps {
  visible: boolean;
  processingStep: number;
  processingProgress: number;
  steps: ProcessingStep[];
}

export default function ProcessingModal({
  visible,
  processingStep,
  processingProgress,
  steps,
}: ProcessingModalProps) {
  // ✅ 确保 steps 数组不为空，且 processingStep 在有效范围内
  const safeStepIndex = Math.max(0, Math.min(processingStep, steps.length - 1));
  const currentStep = steps[safeStepIndex] || (steps.length > 0 ? steps[0] : { icon: "⏳", text: "处理中..." });

  // ✅ 2026-01-27: 移除过度日志，提升开发体验
  // 原因：进度更新频繁（每200ms一次），日志过多影响调试

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Emoji - 单独一行，居中对齐 */}
          <View style={styles.emojiContainer}>
            <Text style={styles.stepEmoji}>{currentStep?.icon || "⏳"}</Text>
          </View>

          {/* 步骤文案 - 单独一行，居中对齐 */}
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.currentStepText,
                {
                  fontFamily: getFontFamilyForText(
                    currentStep?.text || "处理中...",
                    "regular"
                  ),
                },
              ]}
            >
              {currentStep?.text || "处理中..."}
            </Text>
          </View>

          {/* 进度条和百分比 */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${processingProgress}%` },
                ]}
              />
            </View>
            <Text
              style={styles.progressText}
              accessibilityLabel={`${t("accessibility.status.processing")}, ${Math.round(processingProgress)}%`}
            >
              {Math.round(processingProgress)}%
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)", // ✅ 保留蒙版，阻止用户操作
    justifyContent: "center", // ✅ 页面中央显示
    alignItems: "center",
  },
  content: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    width: "80%",
    maxWidth: 300,
    alignItems: "center",
  },
  emojiContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    height: 40, // 固定高度，确保布局稳定
  },
  stepEmoji: {
    fontSize: 32,
    textAlign: "center",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    minHeight: 24, // 最小高度，防止布局跳动
    width: "100%", // ✅ 确保文字容器有足够宽度
  },
  currentStepText: {
    ...Typography.body,
    color: "#1A1A1A",
    textAlign: "center",
    fontSize: 15, // ✅ 明确设置字号，确保文字可见
    lineHeight: 22, // ✅ 明确设置行高
  },
  progressSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#E56C45",
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: "#666",
    width: 45,
    textAlign: "right",
  },
});

