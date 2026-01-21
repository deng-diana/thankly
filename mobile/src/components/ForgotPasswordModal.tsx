/**
 * 忘记密码模态框
 * 
 * 两步流程：
 * 1. 输入邮箱 → 发送验证码
 * 2. 输入验证码 + 新密码 → 重置密码
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { getTypography } from '../styles/typography';
import { API_BASE_URL } from '../config/aws-config';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ForgotPasswordModal({
  visible,
  onClose,
  onSuccess,
}: ForgotPasswordModalProps) {
  const typography = getTypography();
  
  // 步骤：1 = 发送验证码，2 = 重置密码
  const [step, setStep] = useState(1);
  
  // 表单状态
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI 状态
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 密码验证函数
  const validatePassword = (pwd: string): string | null => {
    if (!pwd || pwd.length < 8) {
      return t("signup.passwordTooShort");
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  // 发送验证码
  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    setEmailError('');

    if (!normalizedEmail) {
      setEmailError(t("login.emailPlaceholder"));
      return;
    }
    if (!emailRegex.test(normalizedEmail)) {
      setEmailError(t("signup.invalidEmail"));
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/auth/email/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send code');
      }

      Alert.alert(
        t("login.codeSent"),
        t("login.forgotPasswordCodeSent"),
        [{ text: t("common.confirm") }]
      );
      
      setStep(2);
    } catch (error: any) {
      console.error('❌ 发送验证码失败:', error);
      setEmailError(error.message || t("login.emailSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    setCodeError('');
    setPasswordError('');

    let hasError = false;

    if (!verificationCode) {
      setCodeError(t("login.enterCodeFirst"));
      hasError = true;
    }

    const passwordValidationError = validatePassword(newPassword);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/auth/email/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            verification_code: verificationCode,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      // 密码重置成功，后端会自动登录并返回 tokens
      // 保存 tokens 到本地存储
      const { accessToken, idToken, refreshToken } = data;
      
      Alert.alert(
        t("login.forgotPasswordTitle"),
        t("login.forgotPasswordSuccess"),
        [
          {
            text: t("common.confirm"),
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ 重置密码失败:', error);
      
      if (error.message.includes('验证码') || error.message.includes('code')) {
        setCodeError(error.message);
      } else if (error.message.includes('密码') || error.message.includes('password')) {
        setPasswordError(error.message);
      } else {
        Alert.alert(
          t("login.forgotPasswordTitle"),
          error.message || t("login.forgotPasswordFailed"),
          [{ text: t("common.confirm") }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 关闭模态框
  const handleClose = () => {
    setStep(1);
    setEmail('');
    setVerificationCode('');
    setNewPassword('');
    setShowPassword(false);
    setEmailError('');
    setCodeError('');
    setPasswordError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 标题栏 */}
          <View style={styles.header}>
            <Text style={[styles.title, typography.diaryTitle]}>
              {t("login.forgotPasswordTitle")}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#332824" />
            </TouchableOpacity>
          </View>

          {/* 副标题 */}
          <Text style={[styles.subtitle, typography.body]}>
            {step === 1
              ? t("login.forgotPasswordSubtitle")
              : t("login.emailCodeSentMessage")}
          </Text>

          {/* 步骤 1: 输入邮箱 */}
          {step === 1 && (
            <>
              <TextInput
                style={[
                  styles.input,
                  emailError ? styles.inputError : null,
                  typography.body,
                ]}
                placeholder={t("login.forgotPasswordEmailPlaceholder")}
                placeholderTextColor="#999"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) setEmailError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, typography.body]}>
                    {t("login.forgotPasswordSendCode")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* 步骤 2: 输入验证码和新密码 */}
          {step === 2 && (
            <>
              <TextInput
                style={[
                  styles.input,
                  codeError ? styles.inputError : null,
                  typography.body,
                ]}
                placeholder={t("login.forgotPasswordCodePlaceholder")}
                placeholderTextColor="#999"
                value={verificationCode}
                onChangeText={(value) => {
                  setVerificationCode(value);
                  if (codeError) setCodeError('');
                }}
                keyboardType="number-pad"
                editable={!loading}
              />
              {codeError ? (
                <Text style={styles.errorText}>{codeError}</Text>
              ) : null}

              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordError ? styles.inputError : null,
                    typography.body,
                  ]}
                  placeholder={t("login.forgotPasswordNewPasswordPlaceholder")}
                  placeholderTextColor="#999"
                  value={newPassword}
                  onChangeText={(value) => {
                    setNewPassword(value);
                    if (passwordError) setPasswordError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : newPassword.length > 0 ? (
                <Text style={[styles.hintText, typography.body]}>
                  {t("login.passwordRequirements")}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, typography.body]}>
                    {t("login.forgotPasswordResetButton")}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(1)}
                disabled={loading}
              >
                <Text style={[styles.backButtonText, typography.body]}>
                  ← {t("common.cancel")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FAF6ED',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    color: '#332824',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCF0D6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
  hintText: {
    color: '#999',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
  passwordInputContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 15,
    padding: 4,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#E56C45',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#E56C45',
    fontSize: 16,
  },
});
