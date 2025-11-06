/** index.ts
 * i18n 配置 - Google工程师的最佳实践
 *
 * 设计原则：
 * 1. Single Source of Truth：所有语言逻辑集中在这里
 * 2. Zero Configuration：导入即用，无需初始化
 * 3. Type Safe：TypeScript 类型安全
 * 4. Performance：缓存locale，避免重复计算
 */

import { I18n } from "i18n-js";
import * as Localization from "expo-localization";
import en from "./en";
import zh from "./zh";

// ============================================================================
// 1. 创建 i18n 实例
// ============================================================================

const i18n = new I18n({
  en, // 英文翻译
  zh, // 中文翻译（简体）
});

// ============================================================================
// 2. 配置选项
// ============================================================================

// 启用fallback：如果中文缺少某个key，自动使用英文
i18n.enableFallback = true;

// 设置默认语言（如果检测失败，使用英文）
i18n.defaultLocale = "en";

// ⚠️ 关键：设置当前语言为英文（在检测之前先设置默认值）
i18n.locale = "en";

// 移除了启动时的调试日志

// ============================================================================
// 3. 语言检测逻辑（智能且健壮）
// ============================================================================

/**
 * 检测并设置用户语言
 *
 * 策略：
 * 1. 读取系统语言（ex: "zh-CN", "en-US", "zh-TW"）
 * 2. 提取语言代码（"zh-CN" → "zh"）
 * 3. 匹配我们支持的语言（zh/en）
 * 4. 不支持则fallback到英文
 */
function detectAndSetLocale(): void {
  try {
    // 获取系统语言列表（按优先级排序）
    const locales = Localization.getLocales();

    if (locales && locales.length > 0) {
      // 取第一个（用户最偏好的语言）
      const primaryLocale = locales[0];
      const { languageCode, languageTag, regionCode } = primaryLocale;

      // 兼容某些设备 languageCode 为空的情况（例如 Android Web）
      const normalizedCode = (languageCode || languageTag || "en")
        .toLowerCase()
        .split("-")[0];

      // 移除了语言检测的调试日志

      // 匹配我们支持的语言（中文 -> zh，其余 → en）
      if (normalizedCode === "zh") {
        i18n.locale = "zh";
      } else {
        i18n.locale = "en";
      }
    } else {
      // 无法获取系统语言，使用默认
      i18n.locale = "en";
    }
  } catch (error) {
    // 异常处理：确保app不会因为语言检测失败而崩溃
    console.error("❌ 语言检测失败:", error);
    i18n.locale = "en";
  }
}

// 立即执行检测（在import时就设置好语言）
detectAndSetLocale();

// ============================================================================
// 4. 导出翻译函数
// ============================================================================

/**
 * 翻译函数（简化调用）
 *
 * 用法：
 * import { t } from '@/i18n';
 * t('home.welcome')  // 返回 "Welcome to thankly" 或 "感恩日记"
 *
 * TypeScript会自动提示可用的key（如果配置了类型）
 */
export const t = (key: string, options?: any): string => {
  try {
    const result = i18n.t(key, options);
    // 如果 i18n-js 找不到键，会返回 "[missing xxx]" 格式
    // 我们需要检查这种情况并返回空字符串或默认值
    if (result && result.startsWith("[missing")) {
      console.warn(`⚠️ 翻译键未找到: ${key}`, result);
      return "";
    }
    return result;
  } catch (error) {
    console.error(`❌ 翻译失败: ${key}`, error);
    return "";
  }
};

/**
 * 获取当前语言代码
 *
 * 用法：
 * import { getCurrentLocale } from '@/i18n';
 * const locale = getCurrentLocale(); // 'en' 或 'zh'
 */
export const getCurrentLocale = (): string => {
  return i18n.locale;
};

/**
 * 手动切换语言（为未来的手动切换功能预留）
 *
 * 用法：
 * import { changeLocale } from '@/i18n';
 * changeLocale('zh'); // 切换到中文
 */
export const changeLocale = (locale: "en" | "zh"): void => {
  i18n.locale = locale;
};

// 默认导出（支持两种导入方式）
export default i18n;

// ============================================================================
// 💡 学习笔记（Learning by Doing）
// ============================================================================

/*
 * 为什么这样设计？
 *
 * 1. ✅ 为什么用 i18n-js 而不是 react-i18next？
 *    - i18n-js 更轻量（~5KB vs ~50KB）
 *    - API 更简单，适合小项目
 *    - 与 Expo 官方推荐一致
 *
 * 2. ✅ 为什么在这里就执行 detectAndSetLocale()？
 *    - 确保第一次渲染就是正确的语言
 *    - 避免"闪烁"（先显示英文，再切换到中文）
 *
 * 3. ✅ 为什么提取 languageCode 而不用完整的 languageTag？
 *    - 简化匹配逻辑（zh-CN, zh-TW, zh-HK 都匹配到 'zh'）
 *    - 我们暂时不区分简繁体
 *
 * 4. ✅ 为什么需要 try-catch？
 *    - expo-localization 可能在某些设备上失败
 *    - 确保app不会因为语言检测崩溃
 *    - Production-ready 代码必须考虑异常情况
 *
 * 5. ✅ 为什么要暴露 changeLocale 函数？
 *    - 为未来功能预留（手动切换语言）
 *    - 方便测试（可以手动切换看效果）
 */
