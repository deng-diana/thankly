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
    bold: "Lora_700Bold",
  },
  // Noto Serif SC 字体（中文）
  notoSerifSC: {
    regular: "NotoSerifSC_400Regular",
    medium: "NotoSerifSC_500Medium",
    semibold: "NotoSerifSC_600SemiBold",
    bold: "NotoSerifSC_700Bold",
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
/**
 * 根据语言和字重获取字体名称
 *
 * @param language 语言代码 'zh' | 'en'
 * @param weight 字重 'regular' | 'medium' | 'semibold'
 * @returns 字体名称
 */
export function getFontFamily(
  language: string = getCurrentLocale(),
  weight: "regular" | "medium" | "semibold" | "bold" = "regular"
): string {
  // 统一处理语言代码，支持 zh-CN, zh-TW 等
  const normalizedLang = language.toLowerCase().startsWith("zh") ? "zh" : "en";

  if (normalizedLang === "zh") {
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
  weight: "regular" | "medium" | "semibold" | "bold" = "regular"
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
 */
function getTypographyStyles(): {
  body: TextStyle;
  diaryTitle: TextStyle;
  sectionTitle: TextStyle;
  caption: TextStyle;
} {
  const currentLocale = getCurrentLocale();
  const isChinese = currentLocale.toLowerCase().startsWith("zh");

  // 根据语言选择字体和字间距
  const bodyFont = isChinese ? "NotoSerifSC_400Regular" : "Lora_400Regular";
  const titleFont = isChinese ? "NotoSerifSC_700Bold" : "Lora_600SemiBold"; // ✅ 中文使用 Bold
  const sectionFont = isChinese ? "NotoSerifSC_500Medium" : "Lora_500Medium";

  // 字间距调整
  const bodyLetterSpacing = isChinese ? 0.5 : 0; // ✅ 中文字间距增加
  const titleLetterSpacing = isChinese ? -0.3 : 0;
  const sectionLetterSpacing = isChinese ? -0.2 : 0;
  const captionLetterSpacing = isChinese ? 0.3 : 0.2;

  // ✅ 中文优化：字号与英文保持一致，行高适中
  const bodyFontSize = isChinese ? 16 : 16; // ✅ 中文字号从 14 增加到 16，提升可读性
  const bodyLineHeight = isChinese ? 28 : 24; // ✅ 中文行高 28px，保持合适的行高比例
  const titleFontSize = isChinese ? 16 : 18; // 中文标题字号减小 2px
  const titleLineHeight = isChinese ? 26 : 24; // 中文标题行高增加

  return {
    body: {
      fontFamily: bodyFont,
      fontWeight: FontWeight.REGULAR,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight,
      letterSpacing: bodyLetterSpacing,
    } as TextStyle,

    diaryTitle: {
      fontFamily: titleFont,
      fontWeight: isChinese
        ? ("700" as TextStyle["fontWeight"])
        : FontWeight.SEMIBOLD,
      fontSize: titleFontSize,
      lineHeight: titleLineHeight,
      letterSpacing: titleLetterSpacing,
    } as TextStyle,

    sectionTitle: {
      fontFamily: sectionFont,
      fontWeight: FontWeight.MEDIUM,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: sectionLetterSpacing,
    } as TextStyle,

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
 * Typography 样式对象
 *
 * 使用 getter 确保每次访问都能获取到基于当前语言的最新样式
 */
export const Typography = {
  get body() {
    return getTypographyStyles().body;
  },
  get diaryTitle() {
    return getTypographyStyles().diaryTitle;
  },
  get sectionTitle() {
    return getTypographyStyles().sectionTitle;
  },
  get caption() {
    return getTypographyStyles().caption;
  },
};

/**
 * 获取当前语言的 Typography（推荐使用）
 */
export const getTypography = getTypographyStyles;
