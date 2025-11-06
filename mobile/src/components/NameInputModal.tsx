/**
 * 姓名输入Modal组件
 * 
 * 当新用户注册时，友好地询问用户希望如何被称呼
 * 设计理念：简洁、温暖、不打扰
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
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
  onCancel,
  placeholder,
}: NameInputModalProps) {
  const [name, setName] = useState("");
  const typography = getTypography();

  const handleConfirm = () => {
    const trimmedName = name.trim();
    if (trimmedName.length > 0) {
      onConfirm(trimmedName);
      setName(""); // 清空输入框
    }
  };

  const handleCancel = () => {
    setName(""); // 清空输入框
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.overlay} />
        <View style={styles.modalContent}>
          {/* 标题 */}
          <View style={styles.header}>
            <Text style={[styles.title, typography.diaryTitle]}>
              {t("login.namePrompt.title")}
            </Text>
            <Text style={[styles.subtitle, typography.body]}>
              {t("login.namePrompt.subtitle")}
            </Text>
          </View>

          {/* 输入框 */}
          <TextInput
            style={[styles.input, typography.body]}
            placeholder={placeholder || t("login.namePrompt.placeholder")}
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            accessibilityLabel={placeholder || t("login.namePrompt.placeholder")}
            accessibilityHint={t("accessibility.input.nameHint")}
            accessibilityRole="text"
          />

          {/* 按钮 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              accessibilityLabel={t("common.cancel")}
              accessibilityHint={t("accessibility.button.cancelHint")}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelButtonText, typography.body]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                name.trim().length === 0 && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={name.trim().length === 0}
              accessibilityLabel={t("common.confirm")}
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
                {t("common.confirm")}
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
    padding: 24,
    width: "85%",
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
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#FAF6ED",
    borderWidth: 1,
    borderColor: "#F2E3C2",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 20,
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
    borderWidth: 1,
    borderColor: "#E0E0E0",
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

