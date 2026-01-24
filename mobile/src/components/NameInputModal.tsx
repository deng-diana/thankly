/**
 * 姓名输入Modal组件（世界级 UX 优化版）
 *
 * 设计理念：温柔、自然、不打扰
 * - 标题与关闭按钮同行对齐（清晰的 header 结构）
 * - Confirm 按钮渐进式出现（输入后才显示，避免灰色按钮的负面心理）
 * - 紧凑但舒适的间距（视觉重心集中）
 */
import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTypography } from "../styles/typography";
import { t } from "../i18n";

interface NameInputModalProps {
  visible: boolean;
  onConfirm: (name: string) => void;
  placeholder?: string;
  onCancel?: () => void;
  dismissible?: boolean;
}

export default function NameInputModal({
  visible,
  onConfirm,
  placeholder,
  onCancel,
  dismissible = false,
}: NameInputModalProps) {
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const typography = getTypography();

  // ✅ 动画值：控制 Confirm 按钮的淡入+上移动画
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;

  // ✅ 重置状态
  useEffect(() => {
    if (!visible) {
      setName("");
      // 重置动画
      buttonOpacity.setValue(0);
      buttonTranslateY.setValue(20);
    }
  }, [visible]);

  // ✅ 监听输入变化，控制按钮显示/隐藏
  useEffect(() => {
    const hasInput = name.trim().length > 0;
    
    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: hasInput ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(buttonTranslateY, {
        toValue: hasInput ? 0 : 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [name]);

  const handleConfirm = () => {
    const trimmedName = name.trim();
    if (trimmedName.length > 0) {
      onConfirm(trimmedName);
      setName(""); // 清空输入框
    }
  };


  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissible) {
          onCancel?.();
        }
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            if (dismissible) {
              onCancel?.();
            }
          }}
        />
        <View style={styles.modalContent}>
          {/* ✅ Header: 标题 + 关闭按钮（同一行，垂直居中对齐） */}
          <View style={styles.header}>
            <Text
              style={[styles.title, typography.diaryTitle]}
              numberOfLines={2}
            >
              {t("login.namePrompt.title")}
            </Text>
            {dismissible && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // ✅ 扩大点击区域
              >
                <Ionicons name="close-outline" size={24} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* 输入框 */}
          <TextInput
            style={[
              styles.input, 
              typography.body,
              isFocused && styles.inputFocused
            ]}
            placeholder={placeholder || t("login.namePrompt.placeholder")}
            placeholderTextColor="#B8ACA4"
            value={name}
            onChangeText={setName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            accessibilityLabel={
              placeholder || t("login.namePrompt.placeholder")
            }
            accessibilityHint={t("accessibility.input.nameHint")}
            accessibilityRole="text"
          />

          {/* 说明文案 */}
          <Text style={[styles.helperText, typography.caption]}>
            {t("login.namePrompt.helper")}
          </Text>

          {/* ✅ 渐进式 Confirm 按钮（输入后才出现，带淡入+上移动画） */}
          {name.trim().length > 0 && (
            <Animated.View
              style={[
                styles.buttonContainer,
                {
                  opacity: buttonOpacity,
                  transform: [{ translateY: buttonTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
                accessibilityLabel={t("login.namePrompt.continue")}
                accessibilityHint={t("accessibility.button.confirmHint")}
                accessibilityRole="button"
              >
                <Text style={[styles.confirmButtonText, typography.body]}>
                  {t("login.namePrompt.continue")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 20, // ✅ 减少顶部留白（从 24px → 20px）
    paddingBottom: 28,
    paddingHorizontal: 24,
    width: "88%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  // ✅ Header：标题 + 关闭按钮（同一行，垂直居中）
  header: {
    flexDirection: "row", // ✅ 横向布局
    alignItems: "center", // ✅ 垂直居中对齐
    justifyContent: "space-between", // ✅ 两端对齐
    marginBottom: 16, // ✅ 到输入框的间距（从 24px → 16px）
    minHeight: 28, // ✅ 最小高度，确保关闭按钮有足够空间
  },
  title: {
    flex: 1, // ✅ 占据剩余空间
    fontSize: 19, // ✅ 稍微小一点，更温柔
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 26, // ✅ 行高，支持换行
    paddingRight: 8, // ✅ 与关闭按钮留出间距
  },
  closeButton: {
    width: 32, // ✅ 固定宽度
    height: 32, // ✅ 固定高度
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  input: {
    width: "100%",
    height: 54,
    backgroundColor: "#FAF6ED",
    borderWidth: 1,
    borderColor: "#F7EEE0",
    borderRadius: 10, // ✅ 从 12px → 10px，更精致
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 12, // ✅ 到 helper text 的间距
  },
  inputFocused: {
    borderColor: "#E56C45",
  },
  helperText: {
    textAlign: "left", // ✅ 从居中改为左对齐
    color: "#80645A",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16, // ✅ 到按钮的基础间距（按钮不存在时也保持美观）
  },
  buttonContainer: {
    width: "100%",
  },
  button: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButton: {
    backgroundColor: "#E56C45", // ✅ 始终是橙色（因为只在有输入时显示）
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
