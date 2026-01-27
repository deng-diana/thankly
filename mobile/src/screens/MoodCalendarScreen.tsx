/**
 * Mood Calendar Screen – 情绪日历
 *
 * 回顾型功能：从时间维度回看情绪与记录。
 * 单页结构：顶部统计 → 月份切换 → 月历网格 → 日历下方日记联动。
 * 数据自拉取，兼容首页图标与抽屉双入口。
 */

import React, { useCallback, useMemo, useState, useRef } from "react";
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
// ✅ 关键修复：根据容器宽度动态计算单元格大小，确保一行正好7列
// 容器宽度 = 屏幕宽度 - scrollContent左右padding(20*2) - calendarCard左右padding(16*2) = 屏幕宽度 - 72
const CELL_SIZE = Math.floor((Dimensions.get("window").width - 72) / 7);
// ✅ 用户要求：圆形尺寸固定为 28
const CIRCLE_SIZE = 28;
// ✅ 多个圆时的横向错位偏移（左右分布）
const CIRCLE_HORIZONTAL_OFFSET = 2;
// ✅ 用户要求：星期标题和日期单元格之间的间距为 16px
const CALENDAR_VERTICAL_GAP = 16;

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

  // ✅ 用户要求：添加滚动引用，用于点击日期后滚动到日记
  const scrollViewRef = useRef<ScrollView>(null);
  const [diarySectionY, setDiarySectionY] = useState(0);

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

  // ✅ 用户要求：点击日期后滚动到日记区域
  const handleDatePress = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    // 延迟滚动，等待日记区域渲染完成
    setTimeout(() => {
      if (diarySectionY > 0) {
        scrollViewRef.current?.scrollTo({
          y: diarySectionY - 20, // 向上偏移20px，留出一点空间
          animated: true,
        });
      }
    }, 150);
  }, [diarySectionY]);

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
          <Ionicons name="arrow-back-outline" size={24} color="#866D66" />
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
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ 白色卡片容器 - 包含所有内容 */}
        <View style={styles.calendarCard}>
          {/* ✅ 年月导航容器（水平布局：左箭头 - 标题信息 - 右箭头） */}
          <View style={styles.monthNavContainer}>
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
                color={canPrev ? "#866D66" : "#ccc"}
              />
            </TouchableOpacity>

            {/* 年月标签 + 统计信息（居中） */}
            <View style={styles.monthInfoGroup}>
              <Text
                style={[
                  styles.yearMonthLabel,
                  {
                    fontFamily: "Lora_700Bold", // ✅ 用户要求：使用 Lora 字体的加粗版本
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
                  ? `${currentMonthStats.monthDays}天 · ${currentMonthStats.monthEntries}条笔记`
                  : `${currentMonthStats.monthDays} days · ${currentMonthStats.monthEntries} entries`}
              </Text>
            </View>

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
                color={canNext ? "#866D66" : "#ccc"}
              />
            </TouchableOpacity>
          </View>

          {/* ✅ 关键修复：分割线 */}
          <View style={styles.divider} />

          {/* ✅ 星期标题行（只显示首字母大写） */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_KEYS.map((key) => (
              <Text
                key={key}
                style={[
                  styles.weekday,
                  {
                    fontFamily: "Lora_400Regular",
                  },
                ]}
              >
                {t(`moodCalendar.${key}`).charAt(0).toUpperCase()}
              </Text>
            ))}
          </View>

          {/* ✅ 日历网格 */}
          <View style={styles.grid}>
          {grid.map((cell, gridIndex) => {
            const list = dateMap[cell.dateKey] ?? [];
            const hasRecords = list.length > 0;
            const selected = cell.dateKey === selectedDateKey;
            const isToday = cell.dateKey === todayDateKey;
            const colors = hasRecords ? getEmotionColors(list) : [];

            const cellContent = (
              <View
                style={[
                  styles.cellInner,
                  isToday && !hasRecords && {
                    borderWidth: 2,
                    borderColor: "#E56C45",
                    borderRadius: 8,
                  },
                ]}
              >
                <View style={styles.dateWithCircles}>
                  <Text
                    style={[
                      styles.cellDay,
                      !cell.isCurrentMonth && styles.cellDayMuted,
                      isToday && !hasRecords && {
                        color: "#E56C45",
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {hasRecords && colors.length > 0 && cell.isCurrentMonth && (
                    <View
                      style={[
                        styles.singleCircle,
                        {
                          backgroundColor: colors[0].rgba,
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
                  onPress={() => setSelectedDateKey(null)}
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
                style={styles.cell} // ✅ 用户要求：去掉高亮状态
                onPress={() => handleDatePress(cell.dateKey)} // ✅ 用户要求：点击后滚动到日记
                activeOpacity={0.7}
                accessibilityLabel={`${cell.dateKey}, ${list.length} ${t("moodCalendar.entriesLabel")}${isToday ? ", Today" : ""}`}
                accessibilityRole="button"
              >
                {cellContent}
              </TouchableOpacity>
            );
          })}
          </View>
        </View>

        {selectedDateKey && selectedDiaries.length > 0 && (
          <View
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setDiarySectionY(y);
            }}
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
    justifyContent: "flex-start",
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
    justifyContent: "center", // ✅ 用户要求：确保返回箭头与标题垂直居中对齐
  },
  title: {
    fontSize: 18,
    color: "#866D66", // ✅ 用户要求：标题颜色改为 #866D66
  },
  placeholder: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20, // ✅ 用户要求：左右边距改成20px
    paddingTop: 24, // ✅ 用户要求：日历卡片距离上方间距改成20px
    paddingBottom: 32,
  },
  /** ✅ 用户要求：日记卡片左右间距与日历卡片一致（20px） */
  diarySectionOuter: {
    marginHorizontal: 0, // ✅ 保持 scrollContent 的 20px padding，与日历对齐
  },
  // ✅ 年月导航容器（水平布局：左箭头 - 标题信息 - 右箭头，左右箭头与分割线对齐）
  monthNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // ✅ 用户要求：左右箭头向两边靠
    marginBottom: 0, // ✅ 移除底部间距，由分割线的 marginTop 控制
    paddingHorizontal: 16, // ✅ 与分割线的 marginHorizontal 对齐
  },
  // ✅ 年月信息组（年月标签 + 统计信息，垂直排列，居中对齐）
  monthInfoGroup: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 180,
    paddingHorizontal: 20,
  },
  yearMonthLabel: {
    fontSize: 20, // ✅ 用户要求：确保字号是20px
    color: "#1A1A1A", // ✅ 用户要求：年月颜色改为黑色，与日记标题一致
    fontWeight: "normal", // ✅ 使用字体变体后，不需要 fontWeight，设置为 normal
    textAlign: "center",
  },
  monthSummaryText: {
    fontSize: 14,
    color: "#866D66", // ✅ 用户要求：改为指定颜色
    lineHeight: 18,
    textAlign: "center",
  },
  // ✅ 用户要求：增大分割线左右间距（原来0，现在16）、上下间距各增加4px
  divider: {
    height: 1,
    backgroundColor: "#F2E2C3", // ✅ 用户要求：与首页颜色保持一致
    marginHorizontal: 16, // ✅ 左右间距增加1倍（从0到16）
    marginTop: CALENDAR_VERTICAL_GAP + 4, // ✅ 顶部间距增加4px（16+4=20）
    marginBottom: CALENDAR_VERTICAL_GAP + 4, // ✅ 底部间距增加4px（16+4=20）
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FAF6ED", // ✅ 用户要求：背景色改为页面背景色
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  arrowDisabled: {
    opacity: 0.5,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: CALENDAR_VERTICAL_GAP + 8, // ✅ 用户要求：适当增加星期标题与日期的间距（16+8=24）
  },
  weekday: {
    width: CELL_SIZE,
    fontSize: 13, // ✅ 用户要求：字号增大2px（11->13）
    color: "#866D66", // ✅ 用户要求：改为指定颜色，不用灰色
    textAlign: "center",
  },
  // ✅ 日历网格（每行7列，从周一开始）
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE + CALENDAR_VERTICAL_GAP - 4, // ✅ 用户要求：日期距离下方的间距缩小4px（16-4=12）
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 2,
    paddingTop: 0,
  },
  cellSelected: {
    backgroundColor: "rgba(229, 108, 69, 0.1)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E56C45",
  },
  cellDay: {
    fontSize: 15,
    color: "#1A1A1A",
    fontFamily: "Lora_400Regular",
    textAlign: "center",
  },
  cellDayMuted: {
    color: "#bbb",
    fontFamily: "Lora_400Regular",
  },
  cellInner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 0,
    position: "relative",
  },
  dateWithCircles: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  singleCircle: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    top: 0,
    left: 0,
    zIndex: -1,
  },
  diarySection: {
    marginTop: 0, // ✅ 用户要求：日记卡片距离日历卡片16px，由calendarCard的marginBottom控制
  },
  emptyHint: {
    fontSize: 14,
    color: "#80645A",
    marginTop: 0, // ✅ 与日记卡片保持一致的间距
    textAlign: "center",
  },
  // ✅ 白色卡片容器（包含统计、导航、网格）
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingTop: 20, // ✅ 用户要求：距离顶部多给4px间距（16+4=20）
    paddingHorizontal: 16,
    paddingBottom: 4, // ✅ 用户要求：缩小最后一行距离底部间距（16-10=6，减少10px）
    marginBottom: 16, // ✅ 用户要求：日历卡片距离下面日记卡片的间距为16px
    // ✅ 用户要求：投影样式与 DiaryCard 保持一致
    shadowColor: "#FEEBDD",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 3,
  },
});
