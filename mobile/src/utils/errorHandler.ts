/**
 * 错误处理工具
 *
 * 这个文件负责：
 * - 将技术性错误转换为用户友好的提示
 * - 统一处理认证过期等特殊错误
 * - 提供静默处理选项
 */

import { Alert } from "react-native";
import { signOut, getCurrentUser } from "../services/authService";

/**
 * 错误类型枚举
 */
export enum ErrorType {
  AUTH_EXPIRED = "AUTH_EXPIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * 错误处理配置
 */
interface ErrorHandlerConfig {
  showAlert?: boolean; // 是否显示Alert弹窗
  silent?: boolean; // 是否静默处理（不显示任何提示）
  onAuthExpired?: () => void; // 认证过期回调
}

/**
 * 默认错误处理配置
 */
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  showAlert: true,
  silent: false,
};

/**
 * 分析错误类型（增强版 - 优先检查错误代码）
 */
function analyzeError(error: any): ErrorType {
  const message = error.message || error.toString();

  // ✅ 优先检查错误代码（更精确）
  if (
    message === "AUTH_EXPIRED" ||
    message === "REFRESH_TOKEN_EXPIRED" ||
    message === "NO_REFRESH_TOKEN"
  ) {
    return ErrorType.AUTH_EXPIRED;
  }

  // 认证相关错误（兼容性）
  if (
    message.includes("已过期") ||
    message.includes("Token已过期") ||
    message.includes("401") ||
    message.includes("未登录") ||
    message.includes("认证失败")
  ) {
    return ErrorType.AUTH_EXPIRED;
  }

  // 网络相关错误
  if (
    message.includes("Network request failed") ||
    message.includes("网络连接失败") ||
    message.includes("timeout") ||
    message.includes("超时") ||
    message.includes("TIMEOUT")
  ) {
    return ErrorType.NETWORK_ERROR;
  }

  // 服务器错误
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("服务器错误") ||
    message.includes("SERVER_ERROR") ||
    message.includes("Internal Server Error")
  ) {
    return ErrorType.SERVER_ERROR;
  }

  // 验证错误
  if (
    message.includes("400") ||
    message.includes("验证失败") ||
    message.includes("参数错误")
  ) {
    return ErrorType.VALIDATION_ERROR;
  }

  return ErrorType.UNKNOWN_ERROR;
}

/**
 * 获取用户友好的错误消息
 */
function getFriendlyMessage(
  errorType: ErrorType,
  originalMessage: string
): string {
  // ✅ 导入 i18n（延迟导入避免循环依赖）
  const i18n = require("../i18n").default;
  
  switch (errorType) {
    case ErrorType.AUTH_EXPIRED:
      return i18n.t("error.authExpired");

    case ErrorType.NETWORK_ERROR:
      return i18n.t("error.networkError");

    case ErrorType.SERVER_ERROR:
      return i18n.t("error.serverError");

    case ErrorType.VALIDATION_ERROR:
      return i18n.t("error.validationError");

    case ErrorType.UNKNOWN_ERROR:
    default:
      // 如果原始消息是错误代码，尝试翻译
      if (originalMessage && !originalMessage.includes(" ") && originalMessage.includes("_")) {
        const translated = i18n.t(`error.${originalMessage}`, { defaultValue: null });
        if (translated) return translated;
      }
      
      // 如果原始消息已经是用户友好的，直接返回
      if (
        originalMessage.includes("please") ||
        originalMessage.includes("请") ||
        originalMessage.length > 50
      ) {
        return originalMessage;
      }
      return i18n.t("error.unknownError");
  }
}

/**
 * 处理认证过期
 */
async function handleAuthExpired(config: ErrorHandlerConfig) {
  console.log("🔒 处理认证过期...");

  try {
    // ✅ 检查是否已经在 signOut 流程中（tokens 已被清除）
    // 如果用户信息已经为空，说明用户正在 signOut，只需要调用回调进行导航，不需要再次清除
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.log("🔒 用户信息已清除，可能在 signOut 流程中，只执行导航回调");
      // 如果配置了回调，调用它（用于导航）
      if (config.onAuthExpired) {
        config.onAuthExpired();
      }
      return;
    }

    // 清除本地认证信息
    await signOut();

    // 调用自定义回调
    if (config.onAuthExpired) {
      config.onAuthExpired();
    }
  } catch (error) {
    console.error("❌ 处理认证过期失败:", error);
  }
}

/**
 * 主错误处理函数
 */
export async function handleError(
  error: any,
  config: Partial<ErrorHandlerConfig> = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const errorType = analyzeError(error);
  const friendlyMessage = getFriendlyMessage(errorType, error.message || "");

  // AUTH_EXPIRED 是预期状态（比如 token 过期），避免触发 LogBox 红屏
  if (errorType === ErrorType.AUTH_EXPIRED) {
    console.log(`🔐 认证过期 [${errorType}]:`, error);
  } else {
    console.error(`❌ 错误处理 [${errorType}]:`, error);
  }

  // 特殊处理认证过期
  if (errorType === ErrorType.AUTH_EXPIRED) {
    await handleAuthExpired(finalConfig);

    // 如果配置了静默处理，不显示Alert
    if (finalConfig.silent) {
      return;
    }
  }

  // 显示错误提示（如果需要）
  if (finalConfig.showAlert && !finalConfig.silent) {
    const i18n = require("../i18n").default;
    Alert.alert(
      i18n.t("common.notice"), 
      friendlyMessage, 
      [{ text: i18n.t("common.ok") }]
    );
  }
}

/**
 * 静默处理错误（不显示任何提示）
 */
export async function handleErrorSilently(
  error: any,
  onAuthExpired?: () => void
): Promise<void> {
  await handleError(error, {
    silent: true,
    showAlert: false,
    onAuthExpired,
  });
}

/**
 * 只处理认证过期，其他错误忽略
 */
export async function handleAuthErrorOnly(
  error: any,
  onAuthExpired?: () => void
): Promise<void> {
  const errorType = analyzeError(error);

  if (errorType === ErrorType.AUTH_EXPIRED) {
    await handleError(error, {
      silent: true,
      showAlert: false,
      onAuthExpired,
    });
  }
}

/**
 * 获取用户友好的错误消息（过滤认证错误）
 * 如果是认证错误，返回null（表示不应该显示）
 */
export function getSafeErrorMessage(error: any): string | null {
  const errorType = analyzeError(error);

  // 认证错误应该被静默处理，不显示给用户
  if (errorType === ErrorType.AUTH_EXPIRED) {
    return null;
  }

  // 其他错误返回友好消息
  return getFriendlyMessage(errorType, error.message || "");
}
