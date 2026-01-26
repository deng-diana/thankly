/**
 * Mood Calendar Screen – 情绪日历
 *
 * 回顾型功能：从时间维度回看情绪与记录。
 * 单页结构：顶部统计 → 月份切换 → 月历网格 → 日历下方日记联动。
 * 数据自拉取，兼容首页图标与抽屉双入口。
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { t } from "../i18n";
import { getFontFamilyForText } from "../styles/typography";
import { getDiaries } from "../services/diaryService";
import { signOut } from "../services/authService";
import { handleAuthErrorOnly } from "../utils/errorHandler";
import { getDateKey, MONTH_NAMES_SHORT } from "../utils/dateFormat";
import { getCurrentLocale } from "../i18n";
import {
  EMOTION_MAP,
  DEFAULT_EMOTION,
  type EmotionType,
} from "../types/emotion";
import type { Diary } from "./DiaryListScreen";
import { DiaryCard } from "../components/DiaryCard";
import DiaryDetailScreen from "./DiaryDetailScreen";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { useDiaryAudio } from "../hooks/useDiaryAudio";

const CIRCLE_OPACITY = 0.8; // ✅ 80% 不透明度（参考 Plan）
// ✅ 关键修复：根据实际padding计算（scrollContent: 16*2 + calendarCard: 16*2 = 64）
const CELL_SIZE = Math.floor((Dimensions.get("window").width - 64) / 7);
// ✅ 关键修复：圆形尺寸增大（约为单元格的 55%）
const CIRCLE_SIZE = Math.floor(CELL_SIZE * 0.55);
// ✅ 关键修复：多个圆时的横向错位偏移（左右分布）- 缩小距离
const CIRCLE_HORIZONTAL_OFFSET = 2; // ✅ 从 4 缩小到 2，错位距离更小

/** 与 DiaryListScreen 一致：过滤有效日记 */
function sanitizeDiaries(raw: Diary[]): Diary[] {
  return raw.filter((diary) => {
    if (!diary) return false;
    const id = String(diary.diary_id ?? "").trim().toLowerCase();
    if (!id || id === "unknown") return false;
    const hasText =
      (diary.polished_content?.trim().length ?? 0) > 0 ||
      (diary.original_content?.trim().length ?? 0) > 0;
    const hasImages = (diary.image_urls?.length ?? 0) > 0;
    const hasAudio = !!(diary.audio_url?.trim());
    return hasText || hasImages || hasAudio;
  });
}

/** 六位 hex 转 rgba，alpha 0–1 */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.slice(1).match(/.{2}/g);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** ✅ 关键修复：只取当日第一个主要情绪色（不显示多个） */
function getEmotionColors(
  diaries: Diary[]
): Array<{ color: string; rgba: string }> {
  // ✅ 关键修复：只返回第一个情绪颜色
  const firstDiary = diaries[0];
  if (firstDiary) {
    const e = firstDiary.emotion_data?.emotion;
    const mapped = e ? EMOTION_MAP[e as EmotionType] : undefined;
    const config = mapped ?? DEFAULT_EMOTION;
    return [{
      color: config.color,
      rgba: hexToRgba(config.color, CIRCLE_OPACITY),
    }];
  }
  // 如果没有日记，返回默认情绪色
  const c = DEFAULT_EMOTION.color;
  return [{ color: c, rgba: hexToRgba(c, CIRCLE_OPACITY) }];
}

type CalendarCell = {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
};

/** 生成某年某月的日历格（周一为一周首日），含上月尾、下月头补齐 */
function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPadding = ((first.getDay() + 6) % 7);
  const total = last.getDate();
  const cells: CalendarCell[] = [];

  const prevLast = new Date(year, month - 1, 0).getDate();
  for (let i = 0; i < startPadding; i++) {
    const d = prevLast - startPadding + 1 + i;
    const y = month === 1 ? year - 1 : year;
    const m = month === 1 ? 12 : month - 1;
    cells.push({
      dateKey: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= total; d++) {
    cells.push({
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      isCurrentMonth: true,
    });
  }
  const remainder = (7 - ((cells.length) % 7)) % 7;
  for (let i = 1; i <= remainder; i++) {
    const y = month === 12 ? year + 1 : year;
    const m = month === 12 ? 1 : month + 1;
    cells.push({
      dateKey: `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
      day: i,
      isCurrentMonth: false,
    });
  }
  return cells;
}

// ✅ 关键修复：星期标签使用 i18n 翻译，确保七天显示齐全
const WEEKDAY_KEYS = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

export default function MoodCalendarScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);

  const {
    currentPlayingId,
    currentTimeMap,
    durationMap,
    hasPlayedOnceSet,
    handlePlayAudio,
    handleSeek,
    stopAllAudio,
  } = useDiaryAudio();

  const resetToRoot = useCallback(
    (routeName: keyof RootStackParamList) => {
      const parent = navigation.getParent?.();
      const root = parent?.getParent?.();
      const target = root ?? parent ?? navigation;
      target.reset({
        index: 0,
        routes: [{ name: routeName }],
      });
    },
    [navigation]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getDiaries();
      const list = sanitizeDiaries(raw);
      setDiaries(list);
    } catch (err: unknown) {
      await handleAuthErrorOnly(err, () => {
        signOut().then(() => resetToRoot("Login"));
      });
      setDiaries([]);
    } finally {
      setLoading(false);
    }
  }, [resetToRoot]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => stopAllAudio();
    }, [loadData, stopAllAudio])
  );

  const dateMap = useMemo(() => {
    const map: Record<string, Diary[]> = {};
    for (const d of diaries) {
      const k = getDateKey(d.created_at);
      if (!k) continue;
      if (!map[k]) map[k] = [];
      map[k].push(d);
    }
    for (const k of Object.keys(map)) {
      map[k].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    return map;
  }, [diaries]);

  const { totalDays, totalEntries, earliest, current } = useMemo(() => {
    const keys = Object.keys(dateMap);
    const totalEntries = diaries.length;
    const totalDays = keys.length;
    let earliestYear = 0;
    let earliestMonth = 0;
    for (const k of keys) {
      const [y, m] = k.split("-").map(Number);
      if (
        earliestYear === 0 ||
        y < earliestYear ||
        (y === earliestYear && m < earliestMonth)
      ) {
        earliestYear = y;
        earliestMonth = m;
      }
    }
    const now = new Date();
    return {
      totalDays,
      totalEntries,
      earliest: { year: earliestYear, month: earliestMonth },
      current: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
    };
  }, [dateMap, diaries.length]);

  // ✅ 关键修复：计算当前选中月份的统计信息
  const currentMonthStats = useMemo(() => {
    const yearMonthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthKeys = Object.keys(dateMap).filter(k => k.startsWith(yearMonthPrefix));
    const monthDays = monthKeys.length;
    let monthEntries = 0;
    for (const k of monthKeys) {
      monthEntries += dateMap[k].length;
    }
    return { monthDays, monthEntries };
  }, [dateMap, year, month]);

  const grid = useMemo(
    () => buildMonthGrid(year, month),
    [year, month]
  );

  const canPrev =
    earliest.year > 0 &&
    (year > earliest.year || (year === earliest.year && month > earliest.month));
  const canNext =
    year < current.year || (year === current.year && month < current.month);

  // ✅ UX优化：格式化月份标签为可读格式
  const monthLabel = useMemo(() => {
    const locale = getCurrentLocale();
    if (locale === "zh") {
      return `${year}年${month}月`;
    } else {
      const monthName = MONTH_NAMES_SHORT[month - 1] ?? String(month);
      return `${monthName} ${year}`;
    }
  }, [year, month]);

  // ✅ UX优化：判断是否是当前月份，用于高亮今天
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  }, [year, month]);

  // ✅ UX优化：获取今天的日期键，用于高亮
  const todayDateKey = useMemo(() => {
    if (!isCurrentMonth) return null;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [isCurrentMonth]);

  const selectedDiaries = selectedDateKey ? dateMap[selectedDateKey] ?? [] : [];

  const onDiaryPress = useCallback(
    (d: Diary) => {
      stopAllAudio();
      setSelectedDiary(d);
      setDetailVisible(true);
    },
    [stopAllAudio]
  );

  const onDiaryUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#E56C45" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t("common.close")}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            {
              fontFamily: getFontFamilyForText(
                t("moodCalendar.title"),
                "semibold"
              ),
            },
          ]}
        >
          {t("moodCalendar.title")}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ 白色卡片容器 - 包含所有内容 */}
        <View style={styles.calendarCard}>
          {/* ✅ 关键修复：年月导航 + 统计信息（同一行） */}
          <View style={styles.monthNavContainer}>
            {/* 左侧：年月标签 + 统计信息 */}
            <View style={styles.monthInfoGroup}>
              <Text
                style={[
                  styles.yearMonthLabel,
                  {
                    fontFamily: "Lora_400Regular",
                  },
                ]}
                accessibilityLabel={monthLabel}
              >
                {`${year}-${String(month).padStart(2, "0")}`}
              </Text>
              <Text
                style={[
                  styles.monthSummaryText,
                  {
                    fontFamily: "Lora_400Regular",
                  },
                ]}
                accessibilityLabel={`${currentMonthStats.monthDays} days, ${currentMonthStats.monthEntries} entries`}
              >
                {getCurrentLocale() === "zh"
                  ? `累计${currentMonthStats.monthDays}天 | ${currentMonthStats.monthEntries}条笔记`
                  : `${currentMonthStats.monthDays} days | ${currentMonthStats.monthEntries} entries`}
              </Text>
            </View>
            
            {/* 右侧：箭头组 */}
            <View style={styles.arrowGroup}>
              {/* 左箭头 */}
              <TouchableOpacity
                onPress={() => {
                  if (month === 1) {
                    setYear((y) => y - 1);
                    setMonth(12);
                  } else {
                    setMonth((m) => m - 1);
                  }
                }}
                disabled={!canPrev}
                style={[styles.arrow, !canPrev && styles.arrowDisabled]}
                accessibilityLabel={t("moodCalendar.prevMonth")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canPrev }}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={canPrev ? "#666" : "#ccc"}
                />
              </TouchableOpacity>
              
              {/* 右箭头 */}
              <TouchableOpacity
                onPress={() => {
                  if (month === 12) {
                    setYear((y) => y + 1);
                    setMonth(1);
                  } else {
                    setMonth((m) => m + 1);
                  }
                }}
                disabled={!canNext}
                style={[styles.arrow, !canNext && styles.arrowDisabled]}
                accessibilityLabel={t("moodCalendar.nextMonth")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canNext }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={canNext ? "#666" : "#ccc"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ✅ 关键修复：分割线 */}
          <View style={styles.divider} />

          {/* ✅ 日历网格 */}
          <View style={styles.grid}>
          {grid.map((cell, gridIndex) => {
            // ✅ 关键修复：计算当前 cell 是第几列（0-6），用于显示星期标签
            const columnIndex = gridIndex % 7;
            const weekdayKey = WEEKDAY_KEYS[columnIndex];
            // ✅ 关键修复：根据语言环境获取星期标签（中文：一、二、三...，英文：M、T、W...）
            const locale = getCurrentLocale();
            const weekdayLabel = locale === "zh" 
              ? t(`moodCalendar.${weekdayKey}`) // 中文：一、二、三、四、五、六、日
              : t(`moodCalendar.${weekdayKey}`).charAt(0); // 英文：取第一个字母（M、T、W、T、F、S、S）
            const list = dateMap[cell.dateKey] ?? [];
            const hasRecords = list.length > 0;
            const selected = cell.dateKey === selectedDateKey;
            const isToday = cell.dateKey === todayDateKey; // ✅ UX优化：判断是否是今天
            const colors = hasRecords ? getEmotionColors(list) : [];

            // ✅ 关键修复：使用圆形背景，放在日期数字正下方，垂直水平居中对齐
            const cellContent = (
              <View
                style={[
                  styles.cellInner,
                  // ✅ UX优化：高亮今天的日期（如果没有记录）
                  isToday && !hasRecords && {
                    borderWidth: 2,
                    borderColor: "#E56C45", // 使用品牌色
                    borderRadius: 8,
                  },
                ]}
              >
                {/* ✅ 关键修复：星期标签放在日期卡片内部（第一行），确保七天显示齐全，至少12px */}
                {gridIndex < 7 && (
                  <Text
                    style={styles.weekdayInCell}
                  >
                    {weekdayLabel}
                  </Text>
                )}
                {/* ✅ 关键修复：只显示一个主要情绪颜色块，作为背景放在日期正下方 */}
                <View style={styles.dateWithCircles}>
                  {/* ✅ 关键修复：日期文字在圆形正上方 */}
                  <Text
                    style={[
                      styles.cellDay,
                      !cell.isCurrentMonth && styles.cellDayMuted,
                      // ✅ UX优化：今天的文字颜色（如果没有记录）
                      isToday && !hasRecords && {
                        color: "#E56C45", // 使用品牌色
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {/* ✅ 关键修复：单个圆形作为背景，放在日期正下方，只显示当月日期的情绪标签 */}
                  {hasRecords && colors.length > 0 && cell.isCurrentMonth && (
                    <View
                      style={[
                        styles.singleCircle,
                        {
                          backgroundColor: colors[0].rgba, // ✅ 使用第一个情绪颜色，80% 透明度
                        },
                      ]}
                    />
                  )}
                </View>
              </View>
            );

            if (!hasRecords) {
              return (
                <TouchableOpacity
                  key={cell.dateKey}
                  style={[
                    styles.cell,
                    selected && styles.cellSelected,
                  ]}
                  onPress={() => setSelectedDateKey(null)} // ✅ UX优化：点击无记录的日期，取消选中
                  activeOpacity={0.7}
                  accessibilityLabel={isToday ? `${cell.dateKey}, Today` : cell.dateKey}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  {cellContent}
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={cell.dateKey}
                style={[
                  styles.cell, 
                  selected && styles.cellSelected, // ✅ 简化：统一使用 cellSelected
                  // ✅ UX优化：今天的选中状态（如果有记录）
                  isToday && selected && {
                    borderWidth: 2,
                    borderColor: "#E56C45",
                  },
                ]}
                onPress={() => setSelectedDateKey(cell.dateKey)}
                activeOpacity={0.7}
                accessibilityLabel={`${cell.dateKey}, ${list.length} ${t("moodCalendar.entriesLabel")}${isToday ? ", Today" : ""}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {cellContent}
              </TouchableOpacity>
            );
          })}
          </View>
        </View>

        {selectedDateKey && selectedDiaries.length > 0 && (
          <View
            style={[styles.diarySection, styles.diarySectionOuter]}
            accessibilityLabel={`${selectedDiaries.length} ${t("moodCalendar.entriesLabel")}`}
          >
            {selectedDiaries.map((d, idx) => (
              <DiaryCard
                key={d.diary_id}
                diary={d}
                index={idx}
                totalCount={selectedDiaries.length}
                searchQuery=""
                isPlaying={currentPlayingId === d.diary_id}
                currentTime={currentTimeMap.get(d.diary_id) ?? 0}
                totalDuration={
                  durationMap.get(d.diary_id) ?? d.audio_duration ?? 0
                }
                hasPlayedOnce={hasPlayedOnceSet.has(d.diary_id)}
                onPlayPress={() => handlePlayAudio(d)}
                onSeek={(seekTime) => handleSeek(d.diary_id, seekTime)}
                onImagePress={(urls, i) => {
                  setImagePreviewUrls(urls);
                  setImagePreviewIndex(i);
                  setImagePreviewVisible(true);
                }}
                onPress={() => onDiaryPress(d)}
                showOptions={false}
              />
            ))}
          </View>
        )}

        {selectedDateKey && selectedDiaries.length === 0 && (
          <Text
            style={[
              styles.emptyHint,
              {
                fontFamily: getFontFamilyForText(
                  t("moodCalendar.emptyPickDate"),
                  "regular"
                ),
              },
            ]}
          >
            {t("moodCalendar.emptyPickDate")}
          </Text>
        )}
      </ScrollView>

      {detailVisible && selectedDiary && (
        <DiaryDetailScreen
          diaryId={selectedDiary.diary_id}
          onClose={() => {
            setDetailVisible(false);
            setSelectedDiary(null);
          }}
          onUpdate={onDiaryUpdate}
        />
      )}

      <ImagePreviewModal
        visible={imagePreviewVisible}
        images={imagePreviewUrls}
        initialIndex={imagePreviewIndex}
        onClose={() => setImagePreviewVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "flex-start", // ✅ 优化：顶部对齐，配合星期标签和日期布局
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E2C3",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "flex-start", // ✅ 优化：顶部对齐，配合星期标签和日期布局
  },
  title: {
    fontSize: 18,
    color: "#1A1A1A",
  },
  placeholder: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16, // ✅ 关键修复：添加顶部间距
    paddingBottom: 40,
  },
  /** ✅ 关键修复：日记列表左右留出20px间距 */
  diarySectionOuter: {
    marginHorizontal: 4,
  },
  // ✅ 关键修复：年月导航容器（包含年月标签、统计、箭头）
  monthNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12, // ✅ 关键修复：与分割线之间的间距
  },
  // ✅ 关键修复：年月信息组（年月标签 + 统计信息，垂直排列）
  monthInfoGroup: {
    flexDirection: "column",
    gap: 4, // ✅ 年月标签与统计信息之间的间距
  },
  yearMonthLabel: {
    fontSize: 18, // ✅ 关键修复：年月字体大小
    color: "#1A1A1A",
    fontWeight: "500",
    textAlign: "left", // ✅ 关键修复：左对齐
  },
  monthSummaryText: {
    fontSize: 12, // ✅ 缩小字号（从14改为12）
    color: "#999", // ✅ 使用更淡的灰色
    lineHeight: 16,
  },
  // ✅ 关键修复：分割线（左右留出padding）
  divider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginHorizontal: 12, // ✅ 左右留出12px空间
    marginBottom: 24, // ✅ 优化：分割线与星期标签之间的间距统一为24
  },
  arrowGroup: {
    flexDirection: "row", // ✅ 关键修复：箭头横向排列
    alignItems: "center",
    gap: 8, // ✅ 箭头之间的间距
  },
  arrow: {
    width: 32, // ✅ 关键修复：缩小尺寸（从40改为32）
    height: 32,
    borderRadius: 16, // ✅ 关键修复：圆形背景
    backgroundColor: "#F5F5F5", // ✅ 关键修复：灰色背景
    alignItems: "center",
    justifyContent: "flex-start", // ✅ 优化：顶部对齐，配合星期标签和日期布局
  },
  arrowDisabled: {
    opacity: 0.5,
  },
  // ✅ 关键修复：移除 weekdayRow 和 weekday 样式（星期标签已移到日期卡片内部）
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE + 24, // ✅ 优化：增加单元格高度以统一行间距为24，保持网格布局
    alignItems: "center",
    justifyContent: "flex-start", // ✅ 优化：顶部对齐，配合星期标签和日期布局
    padding: 2, // ✅ 关键修复：增加内边距，确保间距一致
    paddingTop: 0, // ✅ 优化：顶部不留padding，让星期标签紧贴顶部
  },
  cellSelected: {
    backgroundColor: "rgba(229, 108, 69, 0.1)", // ✅ UX优化：使用品牌色半透明背景
    borderRadius: 8,
    borderWidth: 2, // ✅ UX优化：添加边框，使选中状态更明显
    borderColor: "#E56C45", // ✅ UX优化：使用品牌色边框
  },
  cellDay: {
    fontSize: 16, // ✅ 关键修复：日期字体稍微大一点（从 14 增大到 16）
    color: "#1A1A1A",
    fontFamily: "Lora_400Regular", // ✅ 使用 LORA 主题字体
  },
  weekdayInCell: {
    fontSize: 11, // ✅ 关键修复：略微缩小字号，与图二保持一致
    color: "#999", // ✅ 关键修复：使用更淡的灰色
    marginBottom: 24, // ✅ 优化：星期标签与日期之间的间距统一为24
    fontFamily: "Lora_400Regular",
  },
  cellDayMuted: {
    color: "#bbb",
    fontFamily: "Lora_400Regular", // ✅ 使用 LORA 主题字体
  },
  // ✅ 关键修复：移除 cellDayWithBackground，因为所有日期文字都是黑色
  cellInner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start", // ✅ 关键修复：顶部对齐，星期标签在顶部
    paddingTop: 0, // ✅ 关键修复：移除paddingTop，因为calendarCard已经有padding，星期标签会自动与顶部对齐
    position: "relative", // ✅ 关键修复：相对定位，用于圆形绝对定位
  },
  dateWithCircles: {
    alignItems: "center", // ✅ 关键修复：日期文字和圆形水平居中
    justifyContent: "flex-start", // ✅ 优化：顶部对齐，配合星期标签和日期布局 // ✅ 关键修复：居中对齐
    position: "relative", // ✅ 关键修复：相对定位，用于圆形绝对定位
    width: CIRCLE_SIZE, // ✅ 关键修复：容器宽度等于圆形宽度
    height: CIRCLE_SIZE, // ✅ 关键修复：容器高度等于圆形高度
  },
  singleCircle: {
    position: "absolute", // ✅ 关键修复：绝对定位，圆形作为背景
    width: CIRCLE_SIZE, // ✅ 圆形尺寸（增大到55%）
    height: CIRCLE_SIZE, // ✅ 圆形尺寸
    borderRadius: CIRCLE_SIZE / 2, // ✅ 圆形
    top: 0, // ✅ 关键修复：圆形与数字垂直居中对齐
    left: 0, // ✅ 关键修复：圆形居中
    zIndex: -1, // ✅ 关键修复：圆形在文字后面，作为背景
  },
  diarySection: {
    marginTop: 24,
  },
  emptyHint: {
    fontSize: 14,
    color: "#80645A",
    marginTop: 24,
    textAlign: "center",
  },
  // ✅ 白色卡片容器（包含统计、导航、网格）
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16, // ✅ 关键修复：统一内部padding
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
});
