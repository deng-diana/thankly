/**
 * 验证码输入组件
 *
 * 这个组件用于：
 * - 手机号注册/登录时输入验证码
 * - 显示验证码输入框和发送/重新发送按钮
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { t } from "../i18n";
import { Typography } from "../styles/typography";

interface VerificationCodeModalProps {
  visible: boolean;
  phoneNumber: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * 验证码输入模态框组件
 */
export default function VerificationCodeModal({
  visible,
  phoneNumber,
  onClose,
  onVerify,
  onResend,
  isLoading = false,
}: VerificationCodeModalProps) {
  // 验证码输入状态
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 组件显示时重置状态
  useEffect(() => {
    if (visible) {
      setCode("");
      setCountdown(60); // 60秒倒计时
    }
  }, [visible]);

  // 处理验证
  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert(t("login.codeSent"), t("login.enterCodeFirst"), [
        { text: t("common.confirm") },
      ]);
      return;
    }

    try {
      setIsVerifying(true);
      await onVerify(code.trim());
    } catch (error: any) {
      Alert.alert(t("login.codeSent"), error.message || "验证失败", [
        { text: t("common.confirm") },
      ]);
    } finally {
      setIsVerifying(false);
    }
  };

  // 处理重新发送
  const handleResend = async () => {
    if (countdown > 0) {
      return; // 倒计时未结束，不允许重新发送
    }

    try {
      setIsResending(true);
      await onResend();
      setCountdown(60); // 重新开始倒计时
      setCode(""); // 清空验证码
      Alert.alert(t("login.codeSent"), t("login.codeSentMessage"), [
        { text: t("common.confirm") },
      ]);
    } catch (error: any) {
      Alert.alert(t("login.codeSent"), error.message || "发送失败", [
        { text: t("common.confirm") },
      ]);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* 标题 */}
          <View style={styles.header}>
            <Text style={styles.title}>{t("login.verificationCode")}</Text>
            <Text style={styles.subtitle}>
              {t("login.codeSentMessage")}
              {"\n"}
              {phoneNumber}
            </Text>
          </View>

          {/* 验证码输入框 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t("login.verificationCode")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("login.verificationCodePlaceholder")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
              editable={!isVerifying && !isResending}
              accessibilityLabel={t("login.verificationCode")}
              accessibilityHint={t("accessibility.input.codeHint")}
              accessibilityRole="text"
              accessibilityState={{ disabled: isVerifying || isResending }}
            />
          </View>

          {/* 按钮区域 */}
          <View style={styles.buttonContainer}>
            {/* 取消按钮 */}
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isVerifying || isResending}
              accessibilityLabel={t("common.cancel")}
              accessibilityHint={t("accessibility.button.cancelHint")}
              accessibilityRole="button"
              accessibilityState={{ disabled: isVerifying || isResending }}
            >
              <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
            </TouchableOpacity>

            {/* 验证按钮 */}
            <TouchableOpacity
              style={[styles.button, styles.verifyButton]}
              onPress={handleVerify}
              disabled={isVerifying || isResending || !code.trim()}
              accessibilityLabel={t("login.verifyAndLogin")}
              accessibilityHint={t("accessibility.button.confirmHint")}
              accessibilityRole="button"
              accessibilityState={{ disabled: isVerifying || isResending || !code.trim() }}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>
                  {t("login.verifyAndLogin")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 重新发送按钮 */}
          <TouchableOpacity
            style={styles.resendContainer}
            onPress={handleResend}
            disabled={isResending || countdown > 0}
            accessibilityLabel={t("login.resendCode")}
            accessibilityHint={countdown > 0 ? t("login.countdown", { seconds: countdown }) : t("accessibility.button.continueHint")}
            accessibilityRole="button"
            accessibilityState={{ disabled: isResending || countdown > 0 }}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  countdown > 0 && styles.resendTextDisabled,
                ]}
              >
                {countdown > 0
                  ? t("login.countdown", { seconds: countdown })
                  : t("login.resendCode")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * 样式定义
 */
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    ...Typography.diaryTitle,
    fontSize: 24,
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 8,
    textAlign: "center",
    color: "#1a1a1a",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  verifyButton: {
    backgroundColor: "#007AFF",
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  resendContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  resendTextDisabled: {
    color: "#999",
  },
});

