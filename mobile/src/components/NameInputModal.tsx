/**
 * 姓名输入Modal组件
 *
 * 当新用户注册时，友好地询问用户希望如何被称呼
 * 设计理念：简洁、温暖、不打扰
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView, // 键盘避让
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTypography } from "../styles/typography";
import { t } from "../i18n";

interface NameInputModalProps {
  visible: boolean;
  onConfirm: (name: string) => void;
  onCancel?: () => void;
  placeholder?: string;
}

export default function NameInputModal({
  visible,
  onConfirm,
  placeholder,
}: NameInputModalProps) {
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const typography = getTypography();

  useEffect(() => {
    if (!visible) {
      setName("");
    }
  }, [visible]);

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
      onRequestClose={() => {}} // 强制环节，不响应关闭
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.overlay} />
        <View style={styles.modalContent}>
          {/* 标题 */}
          <View style={styles.header}>
            <Text
              style={[styles.title, typography.diaryTitle]}
              numberOfLines={2}
            >
              {t("login.namePrompt.title")}
            </Text>
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

          {/* 按钮 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                name.trim().length === 0 && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={name.trim().length === 0}
              accessibilityLabel={t("login.namePrompt.continue")}
              accessibilityHint={t("accessibility.button.confirmHint")}
              accessibilityRole="button"
              accessibilityState={{ disabled: name.trim().length === 0 }}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  typography.body,
                  name.trim().length === 0 && styles.confirmButtonTextDisabled,
                ]}
              >
                {t("login.namePrompt.continue")}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 36, // 增加标题距离顶部的间距
    paddingBottom: 32, // 增加按钮距离底部的间距
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20, // 稍微大一点
    color: "#1A1A1A",
    marginBottom: 0,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 54, // 稍微高一点更有质感
    backgroundColor: "#FAF6ED",
    borderWidth: 1,
    borderColor: "#F7EEE0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8, // 增加底部边距，使文字视觉上上移，达到垂直居中
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 20,
  },
  inputFocused: {
    borderColor: "#E56C45",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#E56C45",
  },
  confirmButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonTextDisabled: {
    color: "#999",
  },
});
