/**
 * 日期时间格式化工具
 * 
 * 提供统一的日期时间格式化功能
 */

import { getCurrentLocale } from "../i18n";

/** 英文月份简写，用于吸顶年月等 */
export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * 格式化日期时间
 * 
 * 中文格式：2026 年 1 月 11 日 · 下午 2:52
 * 英文格式：Jan 11, 2026 · 2:05 PM
 */
export function formatDateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  if (Number.isNaN(date.getTime())) {
    return dateTimeString;
  }

  const locale = getCurrentLocale();

  if (locale === "zh") {
    // 中文格式：2026 年 1 月 11 日 · 下午 2:52
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // 判断上午/下午
    const period = hours < 12 ? "上午" : "下午";
    // 12小时制
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    
    return `${year} 年 ${month} 月 ${day} 日 · ${period} ${displayHours}:${displayMinutes}`;
  } else {
    // 英文格式：Jan 11, 2026 · 2:05 PM
    const month = MONTH_NAMES_SHORT[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const period = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    
    return `${month} ${day}, ${year} · ${displayHours}:${displayMinutes} ${period}`;
  }
}

/**
 * 格式化音频时长
 * 例: 65 → "1:05"
 */
export function formatAudioDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 从 created_at 解析年份、月份
 * 用于吸顶年月、月份选择、年月映射等
 */
export function getYearMonth(dateTimeString: string): {
  year: number;
  month: number;
} {
  const date = new Date(dateTimeString);
  if (Number.isNaN(date.getTime())) {
    return { year: 0, month: 0 };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

/**
 * 从 created_at 解析为 "YYYY-MM-DD" 日期键
 * 用于情绪日历按日聚合、日期选中等
 */
export function getDateKey(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
