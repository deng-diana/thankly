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
  
  const isEmailDestination = phoneNumber.includes("@");

  // 邮箱脱敏处理
  const maskEmail = (email: string) => {
    if (!email || !email.includes("@")) return email;
    const [name, domain] = email.split("@");
    if (name.length <= 4) {
      return name.substring(0, 1) + "****" + name.substring(name.length - 1) + "@" + domain;
    }
    return name.substring(0, 3) + "****" + name.substring(name.length - 2) + "@" + domain;
  };

  const displayTarget = isEmailDestination ? maskEmail(phoneNumber) : phoneNumber;
  
  const sentMessage = isEmailDestination
    ? t("login.emailCodeSentMessage")
    : t("login.codeSentMessage");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showFeedback = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    // 成功反馈改用 Toast，不再显示模态框
    if (type === "success") {
      setToastMessage(`✅ ${title}`);
      return;
    }
    setFeedback({ type, title, message });
  };

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

  // 自动隐藏 Toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 处理验证
  const handleVerify = async () => {
    if (!code.trim()) {
      showFeedback("error", t("login.codeSent"), t("login.enterCodeFirst"));
      return;
    }

    try {
      setIsVerifying(true);
      await onVerify(code.trim());
    } catch (error: any) {
      showFeedback(
        "error",
        t("login.codeSent"),
        error.message || t("login.verificationFailed")
      );
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
      showFeedback("success", t("login.codeSent"), sentMessage);
    } catch (error: any) {
      showFeedback(
        "error",
        t("login.codeSent"),
        error.message || t("login.resendFailed")
      );
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
              {sentMessage} {displayTarget}
            </Text>
          </View>

          {/* 验证码输入框 - 6位正方形格子 */}
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={styles.codeContainer} 
              activeOpacity={1}
              onPress={() => {
                const input = (global as any).verificationInput;
                if (input) input.focus();
              }}
            >
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <View 
                  key={index} 
                  style={[
                    styles.codeBox, 
                    code.length === index && styles.codeBoxActive,
                    code.length > index && styles.codeBoxFilled
                  ]}
                >
                  <Text style={styles.codeText}>{code[index] || ""}</Text>
                  {code.length === index && <View style={styles.cursor} />}
                </View>
              ))}
            </TouchableOpacity>

            <TextInput
              ref={(ref) => { (global as any).verificationInput = ref; }}
              style={styles.hiddenInput}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
              editable={!isVerifying && !isResending}
              textContentType="oneTimeCode"
            />

            {/* 重新发送按钮 - 移至输入框下方 */}
            <TouchableOpacity
              style={styles.resendContainer}
              onPress={handleResend}
              disabled={isResending || countdown > 0}
              accessibilityLabel={t("login.resendCode")}
              accessibilityHint={
                countdown > 0
                  ? t("login.countdown", { seconds: countdown })
                  : t("accessibility.button.continueHint")
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isResending || countdown > 0 }}
            >
              {isResending ? (
                <ActivityIndicator size="small" color="#E56C45" />
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
              accessibilityState={{
                disabled: isVerifying || isResending || !code.trim(),
              }}
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
          {/*黑色 Toast 反馈 */}
          {toastMessage && (
            <View style={styles.toastContainer} pointerEvents="none">
              <View style={styles.toast}>
                <Text style={styles.toastText}>{toastMessage}</Text>
              </View>
            </View>
          )}
          {feedback ? (
            <View style={styles.feedbackOverlay} pointerEvents="box-none">
              <View
                style={[
                  styles.feedbackCard,
                  feedback.type === "success"
                    ? styles.feedbackCardSuccess
                    : styles.feedbackCardError,
                ]}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                <Text style={styles.feedbackMessage}>{feedback.message}</Text>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => setFeedback(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.confirm")}
                >
                  <Text style={styles.feedbackButtonText}>
                    {t("common.confirm")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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
    borderRadius: 20,
    paddingTop: 36, // 增加标题距离顶部的间距
    paddingBottom: 32, // 增加按钮距离底部的间距
    paddingHorizontal: 24,
    width: "88%",
    maxWidth: 400,
  },
  header: {
    marginBottom: 24, // 缩小标题与输入框的间距
    alignItems: "center",
  },
  title: {
    ...Typography.diaryTitle,
    fontSize: 22,
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    color: "#5A4B43",
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24, // 缩小输入框与按钮的间距
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  codeBox: {
    width: 42,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#E6D5C4",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  codeBoxActive: {
    borderColor: "#E56C45",
    backgroundColor: "#fff",
    // 添加一点阴影让激活态更明显
    shadowColor: "#E56C45",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  codeBoxFilled: {
    borderColor: "#E6D5C4",
  },
  codeText: {
    ...Typography.diaryTitle,
    fontSize: 22,
    color: "#1a1a1a",
  },
  cursor: {
    position: "absolute",
    width: 2,
    height: 20,
    backgroundColor: "#E56C45",
  },
  hiddenInput: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#E6D5C4",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    color: "#1a1a1a",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
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
    fontSize: 15,
    fontWeight: "600",
    color: "#5A4B43",
  },
  verifyButton: {
    backgroundColor: "#E56C45",
    shadowColor: "rgba(229, 108, 69, 0.35)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 3,
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  resendContainer: {
    alignItems: "flex-start",
    paddingVertical: 4,
    paddingLeft: 2,
  },
  resendText: {
    fontSize: 13,
    color: "#E56C45",
    fontWeight: "500",
  },
  resendTextDisabled: {
    color: "#B8ACA4",
  },
  feedbackOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  feedbackCard: {
    width: "82%",
    maxWidth: 320,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  feedbackCardSuccess: {
    backgroundColor: "#FFF5F1",
  },
  feedbackCardError: {
    backgroundColor: "#FFEDEA",
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A3F38",
    marginBottom: 8,
  },
  feedbackMessage: {
    fontSize: 14,
    color: "#5A4B43",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  feedbackButton: {
    backgroundColor: "#E56C45",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  feedbackButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "40%",
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
