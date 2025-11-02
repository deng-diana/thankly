/**
 * 错误处理工具
 *
 * 这个文件负责：
 * - 将技术性错误转换为用户友好的提示
 * - 统一处理认证过期等特殊错误
 * - 提供静默处理选项
 */

import { Alert } from "react-native";
import { signOut } from "../services/authService";

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
  switch (errorType) {
    case ErrorType.AUTH_EXPIRED:
      return "登录已过期，请重新登录";

    case ErrorType.NETWORK_ERROR:
      return "网络连接失败，请检查网络设置";

    case ErrorType.SERVER_ERROR:
      return "服务器暂时不可用，请稍后重试";

    case ErrorType.VALIDATION_ERROR:
      return "请求参数有误，请重试";

    case ErrorType.UNKNOWN_ERROR:
    default:
      // 如果原始消息已经是用户友好的，直接返回
      if (
        originalMessage.includes("请") ||
        originalMessage.includes("登录") ||
        originalMessage.includes("网络") ||
        originalMessage.includes("重试")
      ) {
        return originalMessage;
      }
      return "操作失败，请重试";
  }
}

/**
 * 处理认证过期
 */
async function handleAuthExpired(config: ErrorHandlerConfig) {
  console.log("🔒 处理认证过期...");

  try {
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

  console.error(`❌ 错误处理 [${errorType}]:`, error);

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
    Alert.alert("提示", friendlyMessage, [{ text: "好的" }]);
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
