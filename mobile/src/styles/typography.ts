/**
 * 字体配置文件 - 双字体系统
 *
 * 🎨 设计理念（乔布斯式产品思维）：
 * - 中文使用 Noto Serif SC（思源宋体）：优雅衬线，专为简体中文设计
 * - 英文使用 Lora：优雅衬线，与中文风格完美匹配
 * - 自动根据语言切换，保持视觉一致性
 *
 * 字重选择原则：
 * - Regular 400: 正文内容，清晰舒适，适合长时间阅读
 * - Medium 500: 中等强调，用于章节标题，既不过分也不平淡
 * - SemiBold 600: 重要标题，提供清晰层次，但保持优雅不厚重
 */

import { TextStyle } from "react-native";
import { getCurrentLocale } from "../i18n";

/**
 * 字体家族常量
 */
export const FontFamily = {
  LORA: "Lora", // 英文字体
  NOTO_SERIF_SC: "NotoSerifSC", // 中文字体
} as const;

/**
 * 字体名称映射（字重 → 字体名称）
 */
const FONT_NAMES = {
  // Lora 字体（英文）
  lora: {
    regular: "Lora_400Regular",
    medium: "Lora_500Medium",
    semibold: "Lora_600SemiBold",
  },
  // Noto Serif SC 字体（中文）
  notoSerifSC: {
    regular: "NotoSerifSC_400Regular",
    medium: "NotoSerifSC_500Medium",
    semibold: "NotoSerifSC_600SemiBold",
  },
} as const;

/**
 * 检测文本语言
 *
 * 策略：
 * - 检测中文字符（\u4e00-\u9fff）
 * - 如果中文字符超过20%，判定为中文
 * - 否则判定为英文
 *
 * @param text 要检测的文本
 * @returns 'zh' | 'en'
 */
export function detectTextLanguage(text: string): "zh" | "en" {
  if (!text || text.length === 0) {
    // 空文本使用当前界面语言
    return getCurrentLocale() === "zh" ? "zh" : "en";
  }

  // 检测中文字符数量
  const chineseCharPattern = /[\u4e00-\u9fff]/g;
  const chineseChars = text.match(chineseCharPattern);
  const chineseCount = chineseChars ? chineseChars.length : 0;

  // 如果中文字符超过总字符的20%，判定为中文
  const isChinese = chineseCount > text.length * 0.2;

  return isChinese ? "zh" : "en";
}

/**
 * 根据语言和字重获取字体名称
 *
 * @param language 语言代码 'zh' | 'en'
 * @param weight 字重 'regular' | 'medium' | 'semibold'
 * @returns 字体名称
 */
export function getFontFamily(
  language: "zh" | "en" = getCurrentLocale() as "zh" | "en",
  weight: "regular" | "medium" | "semibold" = "regular"
): string {
  if (language === "zh") {
    return FONT_NAMES.notoSerifSC[weight];
  } else {
    return FONT_NAMES.lora[weight];
  }
}

/**
 * 为文本内容获取字体（自动检测语言）
 *
 * 用于用户输入的内容（日记内容等），自动检测语言并返回对应字体
 *
 * @param text 文本内容
 * @param weight 字重
 * @returns 字体名称
 */
export function getFontFamilyForText(
  text: string,
  weight: "regular" | "medium" | "semibold" = "regular"
): string {
  const language = detectTextLanguage(text);
  return getFontFamily(language, weight);
}

/**
 * 字体权重
 */
export const FontWeight = {
  REGULAR: "400" as TextStyle["fontWeight"], // 正文、说明文字
  MEDIUM: "500" as TextStyle["fontWeight"], // 中等强调
  SEMIBOLD: "600" as TextStyle["fontWeight"], // 标题
} as const;

/**
 * 获取基于当前语言的 Typography 样式
 *
 * 这个函数会根据当前界面语言（locale）自动选择对应的字体：
 * - 中文界面：使用 Noto Serif SC
 * - 英文界面：使用 Lora
 *
 * 💡 为什么用函数而不是对象？
 * - Typography 需要动态响应语言切换
 * - 每次调用都会获取最新的 locale，确保字体正确
 */
function getTypography(): {
  body: TextStyle;
  diaryTitle: TextStyle;
  sectionTitle: TextStyle;
  caption: TextStyle;
} {
  const currentLocale = getCurrentLocale();
  const isChinese = currentLocale === "zh";

  // 根据语言选择字体和字间距
  // 中文：Noto Serif SC，字间距稍大（中文衬线字体特性）
  // 英文：Lora，字间距正常（英文衬线字体特性）
  const bodyFont = isChinese ? "NotoSerifSC_400Regular" : "Lora_400Regular";
  const titleFont = isChinese ? "NotoSerifSC_600SemiBold" : "Lora_600SemiBold";
  const sectionFont = isChinese ? "NotoSerifSC_500Medium" : "Lora_500Medium";

  // 字间距调整：中文需要稍大的字间距，英文使用默认
  const bodyLetterSpacing = isChinese ? 0.2 : 0;
  const titleLetterSpacing = isChinese ? -0.3 : 0;
  const sectionLetterSpacing = isChinese ? -0.2 : 0;
  const captionLetterSpacing = isChinese ? 0.3 : 0.2;

  return {
    /**
     * 正文样式 - Regular 400
     * 用于：日记内容、描述文本、普通段落
     * 自动根据语言选择字体：中文用 Noto Serif SC，英文用 Lora
     */
    body: {
      fontFamily: bodyFont,
      fontWeight: FontWeight.REGULAR,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: bodyLetterSpacing,
    } as TextStyle,

    /**
     * 日记标题样式 - SemiBold 600
     * 用于：日记卡片标题、详情页标题
     * 自动根据语言选择字体，保持优雅的视觉层次
     */
    diaryTitle: {
      fontFamily: titleFont,
      fontWeight: FontWeight.SEMIBOLD,
      fontSize: 20,
      lineHeight: 24,
      letterSpacing: titleLetterSpacing,
    } as TextStyle,

    /**
     * Section标题样式 - Medium 500
     * 用于："我的日记"、"我想对你说"等章节标题
     * 自动根据语言选择字体，层次分明且优雅
     */
    sectionTitle: {
      fontFamily: sectionFont,
      fontWeight: FontWeight.MEDIUM,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: sectionLetterSpacing,
    } as TextStyle,

    /**
     * 小标题样式 - Regular 400
     * 用于：日期、时间、标签等辅助信息
     * 自动根据语言选择字体，保持与正文一致的风格
     */
    caption: {
      fontFamily: bodyFont,
      fontWeight: FontWeight.REGULAR,
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: captionLetterSpacing,
    } as TextStyle,
  };
}

/**
 * Typography 样式对象（向后兼容）
 *
 * ⚠️ 注意：这个对象在模块加载时确定，不会响应语言切换
 * 如果你的组件需要在运行时响应语言变化，请使用 getTypography() 函数
 *
 * 对于大多数场景，这个对象就足够了，因为：
 * - 界面语言切换时会重新渲染组件
 * - 组件重新渲染时会重新计算样式
 */
export const Typography = getTypography();

/**
 * 获取当前语言的 Typography（推荐使用）
 *
 * 这个函数会返回基于当前语言的样式，确保字体正确
 *
 * @example
 * ```tsx
 * import { getTypography } from '@/styles/typography';
 *
 * const styles = StyleSheet.create({
 *   text: getTypography().body,
 * });
 * ```
 */
export { getTypography };
