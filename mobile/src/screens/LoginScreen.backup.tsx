/**
 * 登录页面
 *
 * 这个页面显示:
 * - App的logo和标题
 * - Apple登录按钮
 * - Google登录按钮
 * - 欢迎文字
 */
import { useNavigation } from "@react-navigation/native"; // ✅ 添加这行
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
// ✅ 正确的SafeAreaView导入
import { SafeAreaView } from "react-native-safe-area-context";

// 导入图标
import { Ionicons } from "@expo/vector-icons";

import {
  signInWithApple,
  signInWithGoogle,
  signInWithUsernamePassword,
  loginWithPhone,
  verifyPhoneLoginCode,
  signUp,
  signUpWithPhone,
  verifyPhoneCode,
  emailLoginOrSignUp,
  emailConfirmAndLogin,
} from "../services/authService";
import VerificationCodeModal from "../components/VerificationCodeModal";
import CountryCodePicker from "../components/CountryCodePicker";
import GoogleIcon from "../components/GoogleIcon";
import NameInputModal from "../components/NameInputModal";
import { getTypography } from "../styles/typography";

// ============================================================================
// 🌍 Step 1: 导入翻译函数
// ============================================================================
// 'export const t'的t是translate的缩写，Google/Facebook等大厂的标准命名
import { t, getCurrentLocale } from "../i18n";
import { Typography } from "../styles/typography";

// 登录页面组件
export default function LoginScreen() {
  //添加navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // 加载状态
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "apple" | "google" | "username" | "phone" | null
  >(null);

  // 登录方式选择：'email' | 'phone'
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");

  // 用户名密码登录状态
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 密码显示/隐藏状态

  // 手机号登录状态
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+86"); // 默认中国
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // 邮箱验证码状态
  const [showEmailVerificationModal, setShowEmailVerificationModal] =
    useState(false);
  const [emailForVerification, setEmailForVerification] = useState("");

  // 姓名输入状态
  const [showNameInputModal, setShowNameInputModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState("");
  const [isRegistering, setIsRegistering] = useState(false); // 标记是否正在注册流程

  // 获取 Typography 样式
  const typography = getTypography();

  // Apple登录
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setLoadingProvider("apple");

      console.log("开始Apple登录...");
      const user = await signInWithApple();

      console.log("登录成功!", user);
      // ✅ 跳转到日记列表
      navigation.replace("DiaryList");

      // TODO: 跳转到日记列表页面
    } catch (error: any) {
      console.error("Apple登录错误:", error);

      // 用户取消登录,不显示错误
      if (error.message.includes("已取消")) {
        return;
      }

      // 显示更友好的错误信息
      let errorMessage = error.message || "发生未知错误";

      // ============================================================================
      // 🌍 Step 2: 使用翻译函数替换硬编码文本
      // ============================================================================
      // 为什么要这样改？
      // - t('error.networkError') 会根据系统语言返回中文或英文
      // - 代码更简洁，不需要写两遍（中文版+英文版）
      // - 方便未来添加更多语言（只需加翻译文件，代码不用动）

      // 处理常见的网络错误
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      } else if (errorMessage.includes("timeout")) {
        errorMessage = t("common.retry");
      } else if (errorMessage.includes("无效的 Apple token")) {
        errorMessage = t("error.authExpired");
      } else if (errorMessage.includes("Apple 登录失败")) {
        // 提取具体错误信息
        const match = errorMessage.match(/Apple 登录失败: (.+)/);
        if (match) {
          errorMessage = match[1];
        }
      }

      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // Google登录
  const handleGoogleSignIn = async () => {
    // ✅ 如果正在加载,直接返回
    if (loading) {
      return;
    }
    try {
      setLoading(true);
      setLoadingProvider("google");

      console.log("开始Google登录...");
      const user = await signInWithGoogle();

      console.log("登录成功!", user);
      // ✅ 跳转到日记列表
      navigation.replace("DiaryList");
      // TODO: 跳转到日记列表页面
    } catch (error: any) {
      console.error("Google登录错误:", error);

      // 用户取消登录,不显示错误
      if (error.message.includes("已取消")) {
        return;
      }

      // 显示更友好的错误信息
      let errorMessage = error.message || "发生未知错误";

      // 处理常见的网络错误
      if (errorMessage.includes("Network request failed")) {
        errorMessage = "网络连接失败，请检查网络设置";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "请求超时，请重试";
      } else if (errorMessage.includes("invalid_grant")) {
        errorMessage = "登录已过期,请重新尝试";
      } else if (errorMessage.includes("Google 登录失败")) {
        // 提取具体错误信息
        const match = errorMessage.match(/Google 登录失败: (.+)/);
        if (match) {
          errorMessage = match[1];
        }
      }

      Alert.alert("登录失败", errorMessage, [{ text: "好的" }]);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // 智能登录/注册处理（邮箱）- 使用新接口
  const handleEmailContinue = async () => {
    if (!username.trim()) {
      Alert.alert(t("login.title"), t("login.emailPlaceholder"), [
        { text: t("common.confirm") },
      ]);
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username.trim())) {
      Alert.alert(t("login.title"), t("signup.invalidEmail"), [
        { text: t("common.confirm") },
      ]);
      return;
    }

    // 如果没有密码，提示用户输入密码（新用户也需要设置密码）
    if (!password) {
      Alert.alert(t("login.title"), t("signup.passwordTooShort"), [
        { text: t("common.confirm") },
      ]);
      return;
    }

    try {
      setLoading(true);
      setLoadingProvider("username");

      console.log("📧 调用邮箱登录或注册接口...", {
        email: username.trim(),
        hasPassword: !!password,
      });

      // 使用新的邮箱登录或注册接口（先不传姓名，验证账号密码是否正确）
      const result = await emailLoginOrSignUp(username.trim(), password);

      if (result.status === "SIGNED_IN") {
        // 登录成功
        console.log("✅ 登录成功!", result.user);
        navigation.replace("DiaryList");
      } else if (result.status === "CONFIRMATION_REQUIRED") {
        // 需要验证码确认 - 这说明账号密码验证通过，是新用户注册
        // 此时弹出姓名输入框，让用户输入姓名后再继续注册流程
        console.log("📧 账号密码验证通过，是新用户注册，弹出姓名输入框");
        setPendingEmail(result.email);
        setPendingPassword(password);
        setIsRegistering(true);
        setShowNameInputModal(true);
      } else if (result.status === "WRONG_PASSWORD") {
        // 密码错误 - 直接显示错误，不弹出姓名输入框
        Alert.alert(t("login.title"), "密码错误，请重试", [
          { text: t("common.confirm") },
        ]);
      }
    } catch (error: any) {
      console.error("❌ 邮箱登录/注册错误:", error);

      let errorMessage = error.message || "操作失败";

      // 如果是网络错误，直接显示
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      }

      // 其他错误（如账号不存在等）也直接显示，不弹出姓名输入框
      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // 邮箱验证码确认处理
  const handleEmailVerifyCode = async (code: string) => {
    try {
      setLoading(true);
      setLoadingProvider("username");

      console.log("📧 验证邮箱验证码...");
      const user = await emailConfirmAndLogin(
        emailForVerification,
        code,
        password
      );

      console.log("✅ 邮箱确认并登录成功!", user);
      setShowEmailVerificationModal(false);
      navigation.replace("DiaryList");
    } catch (error: any) {
      console.error("❌ 邮箱确认失败:", error);
      throw error; // 让模态框处理错误显示
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // 处理姓名确认（邮箱注册）
  const handleNameConfirm = async (name: string) => {
    try {
      setLoading(true);
      setLoadingProvider("username");
      setShowNameInputModal(false);

      console.log("📧 使用姓名重新进行注册:", name);

      // 使用姓名重新调用注册接口（这会重新发送验证码）
      const result = await emailLoginOrSignUp(
        pendingEmail,
        pendingPassword,
        name
      );

      if (result.status === "SIGNED_IN") {
        // 注册并登录成功（理论上不应该发生，因为需要验证码）
        console.log("✅ 注册并登录成功!", result.user);
        navigation.replace("DiaryList");
      } else if (result.status === "CONFIRMATION_REQUIRED") {
        // 需要验证码确认 - 此时姓名已经保存，验证码已重新发送
        console.log("📧 验证码已重新发送，显示验证码输入框");
        setEmailForVerification(result.email);
        setShowEmailVerificationModal(true);
      } else if (result.status === "WRONG_PASSWORD") {
        // 密码错误（不应该发生，因为前面已经验证过了）
        Alert.alert(t("login.title"), "操作失败，请重试", [
          { text: t("common.confirm") },
        ]);
      }

      // 重置状态
      setPendingEmail("");
      setPendingPassword("");
      setIsRegistering(false);
    } catch (error: any) {
      console.error("❌ 注册失败:", error);
      let errorMessage = error.message || "注册失败";
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      }
      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
      // 重置状态
      setPendingEmail("");
      setPendingPassword("");
      setIsRegistering(false);
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // 处理姓名取消（邮箱注册）
  const handleNameCancel = () => {
    setShowNameInputModal(false);
    setPendingEmail("");
    setPendingPassword("");
    setIsRegistering(false);
  };

  // 重新发送邮箱验证码
  const handleResendEmailCode = async () => {
    try {
      // 重新调用登录或注册接口（会自动重新发送验证码）
      await emailLoginOrSignUp(emailForVerification, password);
      Alert.alert(t("login.codeSent"), "验证码已重新发送到邮箱", [
        { text: t("common.confirm") },
      ]);
    } catch (error: any) {
      console.error("❌ 重发验证码失败:", error);
      throw error;
    }
  };

  // 智能登录/注册处理（手机号）：发送验证码
  const handlePhoneContinue = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert(t("login.title"), t("login.phoneNumberPlaceholder"), [
        { text: t("common.confirm") },
      ]);
      return;
    }

    // 组合完整的手机号（区号 + 手机号）
    const fullPhoneNumber = countryCode + phoneNumber.trim();

    try {
      setIsSendingCode(true);
      // 先尝试登录（发送验证码）
      try {
        await loginWithPhone(fullPhoneNumber);
        // 登录成功，说明用户已存在，直接显示验证码输入框
        setShowVerificationModal(true);
        Alert.alert(t("login.codeSent"), t("login.codeSentMessage"), [
          { text: t("common.confirm") },
        ]);
        return;
      } catch (loginError: any) {
        // 如果用户不存在，说明是新用户注册，先弹出姓名输入框
        if (
          loginError.message.includes("UserNotFoundException") ||
          loginError.message.includes("未注册")
        ) {
          console.log("🆕 检测到新用户，弹出姓名输入框...");
          setPendingPhoneNumber(fullPhoneNumber);
          setIsRegistering(true);
          setShowNameInputModal(true);
          return;
        }
        // 其他错误（如网络错误等）直接显示
        throw loginError;
      }
    } catch (error: any) {
      console.error("❌ 发送验证码错误:", error);
      let errorMessage = error.message || "发送验证码失败";
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      }
      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
    } finally {
      setIsSendingCode(false);
    }
  };

  // 验证手机验证码（智能判断注册/登录）
  const handleVerifyPhoneCode = async (code: string) => {
    try {
      setLoading(true);
      setLoadingProvider("phone");

      // 组合完整的手机号
      const fullPhoneNumber = countryCode + phoneNumber.trim();

      // 先尝试登录流程验证（使用forgot_password流程）
      try {
        const tempPassword = fullPhoneNumber + "Temp123!@#";
        const user = await verifyPhoneLoginCode(
          fullPhoneNumber,
          code,
          tempPassword
        );
        console.log("✅ 手机号登录成功!", user);
        setShowVerificationModal(false);
        navigation.replace("DiaryList");
        return;
      } catch (loginError: any) {
        // 如果登录失败，说明验证码是注册验证码，走注册流程验证
        console.log("🆕 验证码是注册验证码，走注册流程...");
        const user = await verifyPhoneCode(fullPhoneNumber, code);
        console.log("✅ 手机号注册并登录成功!", user);
        setShowVerificationModal(false);
        navigation.replace("DiaryList");
        return;
      }
    } catch (error: any) {
      console.error("❌ 验证验证码错误:", error);
      throw error; // 让模态框处理错误显示
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  // 处理姓名确认（手机注册）
  const handlePhoneNameConfirm = async (name: string) => {
    try {
      setIsSendingCode(true);
      setShowNameInputModal(false);

      console.log("📱 使用姓名进行手机号注册:", name);

      // 使用姓名进行注册（发送验证码）
      await signUpWithPhone(pendingPhoneNumber, name);

      setShowVerificationModal(true);
      Alert.alert(t("login.codeSent"), t("login.codeSentMessage"), [
        { text: t("common.confirm") },
      ]);

      // 重置状态
      setPendingPhoneNumber("");
      setIsRegistering(false);
    } catch (error: any) {
      console.error("❌ 手机号注册失败:", error);
      let errorMessage = error.message || "注册失败";
      if (errorMessage.includes("Network request failed")) {
        errorMessage = t("error.networkError");
      }
      Alert.alert(t("login.title"), errorMessage, [
        { text: t("common.confirm") },
      ]);
      // 重置状态
      setPendingPhoneNumber("");
      setIsRegistering(false);
    } finally {
      setIsSendingCode(false);
    }
  };

  // 处理姓名取消（手机注册）
  const handlePhoneNameCancel = () => {
    setShowNameInputModal(false);
    setPendingPhoneNumber("");
    setIsRegistering(false);
  };

  // 重新发送验证码（智能判断登录或注册）
  const handleResendCode = async () => {
    const fullPhoneNumber = countryCode + phoneNumber.trim();
    try {
      // 先尝试登录流程
      await loginWithPhone(fullPhoneNumber);
    } catch (error: any) {
      // 如果登录失败（用户不存在），使用注册流程
      if (
        error.message.includes("UserNotFoundException") ||
        error.message.includes("未注册")
      ) {
        await signUpWithPhone(fullPhoneNumber);
      } else {
        throw error;
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 顶部标题 */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, typography.diaryTitle]}>
            {t("login.title")}
          </Text>
          <Text style={[styles.headerSubtitle, typography.body]}>
            {t("login.subtitle")}
          </Text>
        </View>

        <View style={styles.buttonSection}>
          {/* 登录方式切换器 */}
          <View style={styles.methodSwitch}>
            <TouchableOpacity
              style={[
                styles.methodButton,
                loginMethod === "email" && styles.methodButtonActive,
              ]}
              onPress={() => setLoginMethod("email")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  typography.body,
                  loginMethod === "email" && styles.methodButtonTextActive,
                ]}
              >
                {t("login.email")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodButton,
                loginMethod === "phone" && styles.methodButtonActive,
              ]}
              onPress={() => setLoginMethod("phone")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  typography.body,
                  loginMethod === "phone" && styles.methodButtonTextActive,
                ]}
              >
                {t("login.phone")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 邮箱登录表单 */}
          {loginMethod === "email" && (
            <>
              {/* 邮箱输入 */}
              <TextInput
                style={[styles.input, typography.body]}
                placeholder={t("login.emailPlaceholder")}
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />

              {/* 密码输入 */}
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, typography.body]}
                  placeholder={t("login.passwordPlaceholder")}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>

              {/* 继续按钮 */}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleEmailContinue}
                disabled={loading}
              >
                {loadingProvider === "username" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, typography.body]}>
                    {t("login.continue")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* 手机号登录表单 */}
          {loginMethod === "phone" && (
            <>
              {/* 区号和手机号并排输入 */}
              <View style={styles.phoneInputContainer}>
                <CountryCodePicker
                  value={countryCode}
                  onSelect={setCountryCode}
                  disabled={loading || isSendingCode}
                />
                <TextInput
                  style={[styles.input, styles.phoneInput, typography.body]}
                  placeholder={t("login.phoneNumberPlaceholder")}
                  placeholderTextColor="#999"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="phone-pad"
                  editable={!loading && !isSendingCode}
                />
              </View>

              {/* 继续按钮 */}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handlePhoneContinue}
                disabled={loading || isSendingCode}
              >
                {isSendingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, typography.body]}>
                    {t("login.continue")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* 手机号验证码输入模态框 */}
          <VerificationCodeModal
            visible={showVerificationModal}
            phoneNumber={countryCode + phoneNumber}
            onClose={() => setShowVerificationModal(false)}
            onVerify={handleVerifyPhoneCode}
            onResend={handleResendCode}
            isLoading={loading && loadingProvider === "phone"}
          />

          {/* 姓名输入模态框 */}
          <NameInputModal
            visible={showNameInputModal}
            onConfirm={
              isRegistering && pendingEmail
                ? handleNameConfirm
                : handlePhoneNameConfirm
            }
            onCancel={
              isRegistering && pendingEmail
                ? handleNameCancel
                : handlePhoneNameCancel
            }
          />

          {/* 邮箱验证码输入模态框 */}
          <VerificationCodeModal
            visible={showEmailVerificationModal}
            phoneNumber={emailForVerification}
            onClose={() => setShowEmailVerificationModal(false)}
            onVerify={handleEmailVerifyCode}
            onResend={handleResendEmailCode}
            isLoading={loading && loadingProvider === "username"}
          />

          {/* 分隔线 */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>OR</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Apple登录按钮 */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.button, styles.socialButton]}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              {loadingProvider === "apple" ? (
                <ActivityIndicator color="#1a1a1a" />
              ) : (
                <>
                  <Ionicons
                    name="logo-apple"
                    size={24}
                    color="#1a1a1a"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.socialButtonText, typography.body]}>
                    {t("login.appleSignIn")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google登录按钮 */}
          <TouchableOpacity
            style={[styles.button, styles.socialButton]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loadingProvider === "google" ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <GoogleIcon size={20} />
                </View>
                <Text style={[styles.socialButtonText, typography.body]}>
                  {t("login.googleSignIn")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * 样式定义
 *
 * 理解样式:
 * - flex: 1 表示占满整个空间
 * - alignItems: 'center' 表示水平居中
 * - justifyContent: 'center' 表示垂直居中
 * - padding: 20 表示内边距20像素
 * - marginBottom: 10 表示底部外边距10像素
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  header: {
    paddingTop: 64,
    paddingBottom: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    color: "#332824",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  buttonSection: {
    width: "100%",
    gap: 8,
  },
  methodSwitch: {
    flexDirection: "row",
    backgroundColor: "#F2E9D5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  methodButtonActive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F2E3C2",
    //shadowColor: "#000",
    // shadowOffset: {
    //   width: 0,
    //   height: 1,
    // },
    //shadowOpacity: 0.1,
    //shadowRadius: 2,
    //elevation: 2,
  },
  methodButtonText: {
    fontSize: 16,
    color: "#332824",
  },
  methodButtonTextActive: {
    fontSize: 16,
    color: "#E56C45",
  },
  phoneInputContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  phoneInput: {
    flex: 1,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F2E3C2",
  },
  separatorText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#332824",
    fontFamily: "Lora_500Medium", // 使用 Lora Medium 字体
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FCF0D6",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1a1a1a",
  },
  passwordInputContainer: {
    position: "relative",
    width: "100%",
  },
  passwordInput: {
    paddingRight: 50, // 为眼睛图标留出空间
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 15,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: "#E56C45",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 48, // 确保加载时高度不变
  },
  socialButton: {
    marginBottom: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FCF0D6",
    minHeight: 48,
  },
  buttonIcon: {
    marginRight: 8,
  },
  googleIconContainer: {
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  socialButtonText: {
    color: "#332824",
    fontSize: 14,
    fontWeight: "600",
  },
});
