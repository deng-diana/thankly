/**
 * 日期时间格式化工具
 * 
 * 提供统一的日期时间格式化功能
 */

import { getCurrentLocale } from "../i18n";

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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
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
