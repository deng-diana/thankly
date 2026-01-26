/**
 * 日记列表页面
 *
 * 设计理念:
 * - 顶部显示用户信息
 * - 中间是日记卡片列表,每张卡片显示日期、内容预览、AI反馈
 * - 底部有个大的"+"按钮,用来创建新日记
 * - 使用渐变色和圆角,营造温暖的氛围
 */
import ImageInputIcon from "../assets/icons/addImageIcon.svg";
import TextInputIcon from "../assets/icons/textInputIcon.svg";
import MicIcon from "../assets/icons/micIcon.svg";
import MoreIcon from "../assets/icons/moreIcon.svg";
import CopyIcon from "../assets/icons/copyIcon.svg";
import DeleteIcon from "../assets/icons/deleteIcon.svg";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import EmptyStateIcon from "../assets/icons/empty-state.svg";
import AppIconHomepage from "../assets/icons/app-icon-homepage.svg";
import ProfileIcon from "../assets/icons/profileIcon.svg";
import SearchIcon from "../assets/icons/searchIcon.svg";  // ✅ 自定义搜索图标
import CalendarIcon from "../assets/icons/calendarIcon.svg";
import CalendarIconOrange from "../assets/icons/calendarIconOrange.svg";
import TimeIcon from "../assets/icons/time.svg";
import {
  Typography,
  getTypography,
  getFontFamilyForText,
  detectTextLanguage, // ✅ 新增
} from "../styles/typography";
import ImagePreviewModal from "../components/ImagePreviewModal";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image, // ← 添加这个
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
  ToastAndroid,
  TextInput, // ✅ 搜索输入框
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDiaryAudio } from "../hooks/useDiaryAudio"; // ✅ 使用顶级统一标准 Hook
import { useVoiceRecording } from "../hooks/useVoiceRecording"; // ✅ 新增
import * as Localization from "expo-localization";
import { getGreeting } from "../config/greetings";
import * as SecureStore from "expo-secure-store";
import RecordingModal from "../components/RecordingModal";
import TextInputModal from "../components/TextInputModal";
import ImageDiaryModal from "../components/ImageDiaryModal";
// ✅ 已删除：NameInputModal 导入（不再需要老用户强制弹窗）
import { EmotionCapsule } from "../components/EmotionCapsule"; // ✅ 导入情绪标签
import { EmotionGlow } from "../components/EmotionGlow"; // ✅ 导入光晕效果
import HappinessBanner from "../components/HappinessBanner"; // ✅ 幸福罐 Banner
import { isHappyEmotion } from "../constants/happinessEmotions"; // ✅ 幸福情绪辅助函数

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";

// import * as ImagePicker from "expo-image-picker"; // ✅ 新增：图片选择器（稍后安装）
import {
  getCurrentUser,
  User,
  signOut,
  startAutoRefresh,
  getPreferredName, // ✅ 保留：用于获取用户偏好称呼显示问候语
} from "../services/authService";
import { handleAuthErrorOnly } from "../utils/errorHandler";
import { getYearMonth, MONTH_NAMES_SHORT } from "../utils/dateFormat";
import {
  getDiaries,
  deleteDiary as deleteDiaryApi,
  updateDiary,
  createVoiceDiary,
  searchDiaries, // ✅ 搜索API
} from "../services/diaryService";
import AudioPlayer from "../components/AudioPlayer";
import DiaryDetailScreen from "./DiaryDetailScreen";
import { HighlightedText } from "../components/HighlightedText"; // ✅ 高亮组件

import {
  useNavigation,
  useFocusEffect,
  DrawerActions,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

/**
 * 日记数据类型定义
 */
export interface Diary {
  diary_id: string;
  created_at: string;
  date: string;
  language: string; // ← 新增：语言代码
  title: string; // ← 新增：AI生成的标题
  original_content: string;
  polished_content: string;
  ai_feedback: string;
  audio_url?: string; // 音频文件URL
  audio_duration?: number; // 音频时长（秒）
  image_urls?: string[]; // ✅ 新增：图片URL数组
  emotion_data?: { emotion: string; [key: string]: any }; // ✅ 新增：情感数据
}

/** 底部操作栏固定高度（主钮 56 + paddingVertical 8×2），避免拉伸成半屏遮挡 */
const BOTTOM_BAR_HEIGHT = 72;

/**
 * 日记列表页面组件
 */
export default function DiaryListScreen() {
  const insets = useSafeAreaInsets();
  // ❌ 已删除：manual listHeight calculation (causes occlusion)
  // const listHeight = Dimensions.get("window").height - insets.top;

  // ✅ 添加navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // ✅ 获取路由参数（用于触发 greeting 刷新）
  const route = useRoute();

  // 获取 Typography 样式（动态字体）
  const typography = getTypography();

  // ========== 状态管理 ==========

  // 用户信息
  const [user, setUser] = useState<User | null>(null);

  // 日记列表
  const [diaries, setDiaries] = useState<Diary[]>([]);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ 幸福日记列表（用于幸福罐 Banner）
  const happyDiaries = React.useMemo(() => {
    return diaries.filter((d) => isHappyEmotion(d.emotion_data?.emotion));
  }, [diaries]);

  // ✅ 搜索相关状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Diary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ 吸顶年月 + 月份选择
  const [stickyYear, setStickyYear] = useState<number | null>(null);
  const [stickyMonth, setStickyMonth] = useState<number | null>(null);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  
  const flatListRef = useRef<FlatList<Diary> | null>(null);
  const monthPickerSlide = useRef(new Animated.Value(400)).current;
  const stickyBarOpacity = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerHeightRef = useRef(300); // 默认高度

  // ✅ 问候语状态
  const [greetingWelcome, setGreetingWelcome] = useState("");
  const [greetingSubtitle, setGreetingSubtitle] = useState("");
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  // ✅ Action Sheet 相关状态
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const actionSheetSlide = useRef(new Animated.Value(300)).current;

  // ✅ DiaryDetail Modal 相关状态
  const [diaryDetailVisible, setDiaryDetailVisible] = useState(false);
  const [selectedDiaryForDetail, setSelectedDiaryForDetail] = useState<Diary | null>(null);

  // ✅ Modal 可见性
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const [textInputModalVisible, setTextInputModalVisible] = useState(false);
  const [imageDiaryModalVisible, setImageDiaryModalVisible] = useState(false);

  // ✅ 图片预览状态
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  // ✅ 图片+语音模式的状态
  const [imageUrlsForVoice, setImageUrlsForVoice] = useState<string[] | undefined>(undefined);

  // 动画值
  const [buttonScale] = useState(new Animated.Value(1));
  const skeletonOpacity = useRef(new Animated.Value(0.3)).current;

  // ✅ 使用统一的顶级标准音频 Hook
  const {
    currentPlayingId,
    currentTimeMap: currentTime,
    durationMap: duration,
    hasPlayedOnceSet: hasPlayedOnce,
    handlePlayAudio,
    handleSeek,
    stopAllAudio,
  } = useDiaryAudio();

  // ✅ 解决循环依赖：使用 ref 来引用 stopRecording，避免声明前使用的问题
  const stopRecordingRef = useRef<(() => Promise<string | null>) | null>(null);

  // ✅ 将录音 Hook 提到屏幕顶级，确保在 Modal 内部不会因为重绘/重刷而丢失状态
  const voiceRecording = useVoiceRecording();

  /** 有日记记录的年月映射 { year: [month, ...] } */
  const yearMonthMap = React.useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const d of diaries) {
      const { year, month } = getYearMonth(d.created_at);
      if (year === 0 || month === 0) continue;
      if (!map[year]) map[year] = [];
      if (!map[year].includes(month)) map[year].push(month);
    }
    for (const y of Object.keys(map)) {
      map[Number(y)].sort((a, b) => b - a); // 年份降序
    }
    return map;
  }, [diaries]);

  const formatStickyYearMonth = React.useCallback(
    (year: number, month: number) => {
      const locale = getCurrentLocale();
      const monthStr = locale === "zh" ? String(month) : (MONTH_NAMES_SHORT[month - 1] ?? String(month));
      return t("home.stickyYearMonthFormat", { year: String(year), month: monthStr });
    },
    [t]
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 0 }).current;

  const onViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: Diary; index: number | null }> }) => {
      if (searchQuery.trim() !== "" || diaries.length === 0 || viewableItems.length === 0) return;
      const sorted = [...viewableItems].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const top = sorted[0]?.item;
      if (top) {
        const { year, month } = getYearMonth(top.created_at);
        setStickyYear(year);
        setStickyMonth(month);
      }
    },
    [diaries, searchQuery]
  );

  const handleListScroll = React.useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;
      lastScrollY.current = y;
      const threshold = headerHeightRef.current > 0 ? headerHeightRef.current - 40 : 200;
      
      // ✅ 强制安全检查：如果在顶部，且 stickyBarVisible 为 true，立即重置并关闭透明度
      if (y < 10) {
        setStickyBarVisible((prev) => {
          if (!prev) return false;
          Animated.timing(stickyBarOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start();
          return false;
        });
        return;
      }

      if (y >= threshold) {
        setStickyBarVisible((prev) => {
          if (prev) return true;
          Animated.timing(stickyBarOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          return true;
        });
      } else if (y <= threshold - 20) {
        setStickyBarVisible((prev) => {
          if (!prev) return false;
          Animated.timing(stickyBarOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
          return false;
        });
      }
    },
    [stickyBarOpacity]
  );

  const handleRecordingCancel = React.useCallback(() => {
    setRecordingModalVisible(false);
  }, []);

  const resetToRoot = React.useCallback((routeName: keyof RootStackParamList) => {
    const parent = navigation.getParent?.();
    const root = parent?.getParent?.();
    const target = root || parent || navigation;
    target.reset({ index: 0, routes: [{ name: routeName }] });
  }, [navigation]);

  const loadGreeting = React.useCallback(async () => {
    const locales = Localization.getLocales();
    const language = locales[0]?.languageCode?.startsWith("zh") ? "zh" : "en";
    let displayName = "";
    const preferredName = await getPreferredName();
    if (preferredName) {
      displayName = preferredName.trim().split(/\s+/)[0];
    }
    setUserDisplayName(displayName || null);
    if (!displayName) {
      displayName = language === "zh" ? "" : "there";
    }
    let welcome = t("home.welcome").replace("{name}", displayName);
    if (language === "zh" && !displayName) welcome = welcome.replace("Hi ", "Hi");
    setGreetingWelcome(welcome);
    setGreetingSubtitle(t("home.subtitle"));
  }, [t]);

  /**
   * 加载日记列表
   */
  const loadDiaries = React.useCallback(async () => {
    try {
      console.log("📖 开始加载日记列表...");
      const response = await getDiaries();
      console.log("✅ [DiaryList] getDiaries response received");
      
      const sanitizedDiaries = (response || []).filter((diary) => {
        if (!diary) return false;
        const id = String(diary.diary_id || "").trim();
        return id.length > 0 && id.toLowerCase() !== "unknown";
      });
      
      setDiaries(sanitizedDiaries);
      console.log(`✅ [DiaryList] Diaries loaded & set: ${sanitizedDiaries.length}`);
    } catch (error: unknown) {
      console.error("❌ 加载日记失败:", error);
      await handleAuthErrorOnly(error, async () => {
        console.log("🔒 Token已过期，静默跳转到登录页");
        resetToRoot("Login");
      });
      setDiaries([]);
    }
  }, []);

  /**
   * 加载页面数据
   */
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      startAutoRefresh();
      await loadDiaries();
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [loadDiaries]);

  // ========== 生命周期 ==========
  useEffect(() => {
    loadGreeting();
  }, [user]); 

  useFocusEffect(
    React.useCallback(() => {
      loadGreeting();
      loadData(); // ✅ Fix: Properly trigger data fetch on focus
    }, [loadData, loadGreeting])
  );


  /**
   * 下拉刷新
   */
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error: unknown) {
      console.error("❌ 下拉刷新失败:", error);
      // 静默处理错误，不显示额外的错误提示（loadDiaries 已经处理了）
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // ❌ 已删除：此处不再手动管理录音计时器或状态，全部交给 RecordingModal 内部 useVoiceRecording hook 管理。

  // ========== 交互处理 ==========

  /**
   * 处理图片上传/拍照
   */

  const handleImageUpload = () => {
    setImageDiaryModalVisible(true);
  };

  /**
   * 处理文字输入 - 打开文字输入Modal
   */
  const handleTextInput = () => {
    console.log("📝 打开文字输入Modal");
    stopAllAudio(); // ✅ 确保进入文字输入时停止音频播放
    setTextInputModalVisible(true);
  };

  /**
   * 文字输入成功回调
   */
  const handleTextInputSuccess = () => {
    setTextInputModalVisible(false);
    loadDiaries(); // ✅ 重新加载日记列表
  };

  /**
   * 文字输入取消回调
   */
  const handleTextInputCancel = () => {
    setTextInputModalVisible(false);
  };

  /**
   * 处理语音录制 - 打开录音Modal
   */
  const handleVoiceRecord = () => {
    console.log("🎤 打开录音Modal");
    stopAllAudio(); // ✅ 确保打开录音时停止音频播放
    setRecordingModalVisible(true);
  };

  /**
   * 点击日记卡片
   */
  const handleDiaryPress = React.useCallback((diary: Diary) => {
    console.log("查看日记:", diary.diary_id);
    stopAllAudio();
    setSelectedDiaryForDetail(diary);
    setDiaryDetailVisible(true);
  }, [stopAllAudio]);

  // ✅ 顶级优化：当页面失去焦点（如跳转到设置、搜索或进入后台）时，自动停止音频
  useFocusEffect(
    React.useCallback(() => {
      // 页面进入焦点时不执行操作
      return () => {
        // 页面失去焦点时停止音频
        console.log("🚶 页面失去焦点，停止音频播放");
        stopAllAudio();
      };
    }, [stopAllAudio])
  );


  // ✅ 新增：音频播放相关函数

  /**
   * 播放/暂停音频
   */
  // ✅ 音频播放逻辑已由 useDiaryAudio Hook 统一管理。

  // ✅ 处理日记操作菜单
  const handleDiaryOptions = React.useCallback((item: Diary) => {
    setSelectedDiary(item);
    setActionSheetVisible(true);
  }, []);

  // ===== 轻量 Toast（Android 用原生，iOS 用自绘）=====
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  };

  // ✅ 使用 useCallback 锁定 handleOpenDrawer 引用，防止重绘导致 Header 子组件 Remount
  const handleOpenDrawer = React.useCallback(() => {
    console.log("👤 点击 Profile 入口");
    try {
      // ✅ 使用 DrawerActions 分发打开指令，它会自动向上查找最近的 Drawer 导航器
      navigation.dispatch(DrawerActions.openDrawer());
    } catch (error) {
      console.error("❌ 打开侧边栏失败:", error);
      // 后备方案：如果DrawerActions失败，不再尝试其他方法（避免类型错误）
    }
  }, [navigation]);

  type DiaryAction = "copyEntry" | "delete";

  const getCopyText = (diary: Diary) => {
    const title = diary.title?.trim();
    const content = (
      diary.polished_content ||
      diary.original_content ||
      ""
    ).trim();
    const parts = [title, content].filter(Boolean);
    return parts.join("\n\n").trim();
  };

  const handleAction = React.useCallback(async (action: DiaryAction) => {
    setActionSheetVisible(false);

    if (!selectedDiary) return;

    switch (action) {
      case "copyEntry":
        {
          const copyText = getCopyText(selectedDiary);
          if (!copyText) {
            Alert.alert(t("confirm.hint"), t("home.copyUnavailable"));
            return;
          }
          await Clipboard.setStringAsync(copyText);
          showToast(t("success.copied"));
        }
        break;
      case "delete":
        Alert.alert(t("confirm.deleteTitle"), t("confirm.deleteMessage"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => handleDeleteDiary(selectedDiary.diary_id),
          },
        ]);
        break;
    }
  }, [selectedDiary, t]);

  // ✅ 删除日记
  const handleDeleteDiary = async (diaryId: string) => {
    try {
      // 调用后端API删除日记
      await deleteDiaryApi(diaryId);

      // 重新加载日记列表（确保数据同步）
      await loadDiaries();

      // 使用无交互 toast 提示
      showToast(t("success.deleted"));
    } catch (error: unknown) {
      console.error("删除日记失败:", error);

      const message = error instanceof Error ? error.message : String(error ?? "");
      // 如果是后台已经不存在的老数据，静默刷新列表并返回
      if (
        message.includes("找不到日记ID") ||
        message.includes("Not Found") ||
        message.includes("diaryID")
      ) {
        await loadDiaries();
        return;
      }

      Alert.alert(
        t("error.genericError"),
        message || t("error.deleteFailed")
      );
    }
  };

  // ========== 搜索相关函数 ==========

  /**
   * 搜索输入变化处理（仅更新输入框，不触发搜索）
   */
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    // 清空输入时重置结果
    if (text.trim() === "") {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  /**
   * 手动触发搜索（点击搜索按钮时调用）
   */
  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    // 立即执行搜索
    performSearch(query);
  };

  /**
   * 执行搜索（优先本地，失败时降级）
   */
  const performSearch = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      console.log("🔍 开始搜索:", query);
      setIsSearching(true);
      const lowercaseQuery = query.toLowerCase();

      // 1. 本地搜索（已加载的日记）
      const localResults = diaries.filter((diary) => {
        const title = (diary.title || "").toLowerCase();
        const originalContent = (diary.original_content || "").toLowerCase();
        const polishedContent = (diary.polished_content || "").toLowerCase();

        return (
          title.includes(lowercaseQuery) ||
          originalContent.includes(lowercaseQuery) ||
          polishedContent.includes(lowercaseQuery)
        );
      });

      console.log("📝 本地搜索结果:", localResults.length);

      // 2. 后端全文搜索（所有日记，包括未加载的）
      // ✅ 优化：优先使用本地结果，后端搜索仅作为补充
      let backendResults: Diary[] = [];
      try {
        // 只在本地结果较少时才调用后端（节省资源）
        if (localResults.length < 10) {
          backendResults = await searchDiaries(query);
          console.log("🌐 后端搜索结果:", backendResults.length);
        } else {
          console.log("⚡ 本地结果充足，跳过后端搜索");
        }
      } catch (backendError: unknown) {
        console.warn("⚠️ 后端搜索失败，仅使用本地结果:", backendError);
        // 降级：只使用本地结果（不显示错误给用户）
      }

      // 3. 合并结果并去重（优先本地结果）
      const mergedResults = mergeAndDeduplicateResults(
        localResults,
        backendResults
      );

      console.log("✅ 最终搜索结果:", mergedResults.length);
      setSearchResults(mergedResults);
    } catch (error) {
      console.error("❌ 搜索失败:", error);
      // 发生错误时也显示本地搜索结果
      const localResults = diaries.filter((diary) => {
        const title = (diary.title || "").toLowerCase();
        const content = (
          diary.polished_content ||
          diary.original_content ||
          ""
        ).toLowerCase();
        return (
          title.includes(query.toLowerCase()) ||
          content.includes(query.toLowerCase())
        );
      });
      setSearchResults(localResults);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * 合并并去重搜索结果
   */
  const mergeAndDeduplicateResults = (
    local: Diary[],
    backend: Diary[]
  ): Diary[] => {
    const seen = new Set<string>();
    const merged: Diary[] = [];

    // 优先添加本地结果（已加载，渲染更快）
    for (const diary of local) {
      if (!seen.has(diary.diary_id)) {
        seen.add(diary.diary_id);
        merged.push(diary);
      }
    }

    // 添加后端独有的结果
    for (const diary of backend) {
      if (!seen.has(diary.diary_id)) {
        seen.add(diary.diary_id);
        merged.push(diary);
      }
    }

    // 按创建时间倒序排序
    merged.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return merged;
  };

  /**
   * 跳转到指定月份的第一条日记并关闭月份选择器
   */
  const scrollToMonth = React.useCallback(
    (year: number, month: number) => {
      const idx = diaries.findIndex((d) => {
        const { year: y, month: m } = getYearMonth(d.created_at);
        return y === year && m === month;
      });
      if (idx === -1) return;
      setMonthPickerVisible(false);
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: idx,
            viewPosition: 0,
            animated: true,
          });
        } catch (_) {
          // 列表未布局或动态高度时 scrollToIndex 可能失败，忽略
        }
      }, 200);
    },
    [diaries]
  );

  // ✅ 渲染自定义 Action Sheet
  const renderActionSheet = () => {
    if (!selectedDiary) return null;
    const shouldShowCopy = getCopyText(selectedDiary).length > 0;

    return (
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* 蒙版层 - 无动画，立即显示 */}
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActionSheetVisible(false)}
          />

          {/* Action Sheet 内容 - 从底部滑入 */}
          <Animated.View
            style={[
              styles.actionSheetContainer,
              {
                transform: [{ translateY: actionSheetSlide }],
              },
            ]}
          >
            {/* 顶部Header: 标题 + 关闭按钮 */}
            <View style={styles.actionSheetHeader}>
              <Text
                style={[
                  styles.actionSheetTitle,
                  {
                    fontFamily: getFontFamilyForText(
                      t("home.actionSheetTitle"),
                      "medium"
                    ),
                  },
                ]}
              >
                {t("home.actionSheetTitle")}
              </Text>
              <TouchableOpacity
                style={styles.actionSheetCloseButton}
                onPress={() => setActionSheetVisible(false)}
                accessibilityLabel={t("common.close")}
                accessibilityHint={t("accessibility.button.closeHint")}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 标题下方的分割线 */}
            {shouldShowCopy && <View style={styles.actionSheetHeaderDivider} />}

            {/* 操作列表 */}
            {shouldShowCopy && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleAction("copyEntry")}
              >
                <View style={styles.actionIcon}>
                  <CopyIcon width={28} height={28} />
                </View>
                <Text
                  style={[
                    styles.actionText,
                    {
                      fontFamily: getFontFamilyForText(
                        t("home.copyEntry"),
                        "regular"
                      ),
                    },
                  ]}
                >
                  {t("home.copyEntry")}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.actionSheetItem,
                styles.deleteAction,
                !shouldShowCopy && { marginTop: 0 },
              ]}
              onPress={() => handleAction("delete")}
            >
              <View style={styles.actionIcon}>
                <DeleteIcon width={28} height={28} />
              </View>
              <Text
                style={[
                  styles.actionText,
                  styles.deleteText,
                  {
                    fontFamily: getFontFamilyForText(
                      t("common.delete"),
                      "regular"
                    ),
                  },
                ]}
              >
                {t("common.delete")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  /** 月份选择器 Modal：自底向上，按年份分组，1–12 月，仅可跳有记录的月份 */
  const renderMonthPickerModal = () => {
    if (!monthPickerVisible) return null;
    const years = Object.keys(yearMonthMap)
      .map(Number)
      .sort((a, b) => b - a);

    return (
      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMonthPickerVisible(false)}
          />
          <Animated.View
            style={[
              styles.monthPickerContainer,
              { transform: [{ translateY: monthPickerSlide }] },
            ]}
          >
            <View style={styles.monthPickerHeader}>
              <Text
                style={[
                  styles.monthPickerTitle,
                  {
                    fontFamily: getFontFamilyForText(
                      t("home.monthPickerTitle"),
                      "medium"
                    ),
                  },
                ]}
              >
                {t("home.monthPickerTitle")}
              </Text>
              <TouchableOpacity
                style={styles.actionSheetCloseButton}
                onPress={() => setMonthPickerVisible(false)}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {years.length === 0 ? (
              <View style={styles.monthPickerEmpty}>
                <Text
                  style={[
                    styles.monthPickerEmptyText,
                    { fontFamily: getFontFamilyForText(t("home.monthPickerEmpty"), "regular") },
                  ]}
                >
                  {t("home.monthPickerEmpty")}
                </Text>
              </View>
            ) : (
            <ScrollView
              style={styles.monthPickerScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.monthPickerContent}
            >
              {years.map((year) => {
                const months = yearMonthMap[year] ?? [];
                const hasMonth = (m: number) => months.includes(m);
                return (
                  <View key={year} style={styles.monthPickerSection}>
                    <Text
                      style={[
                        styles.monthPickerYearLabel,
                        {
                          fontFamily: getFontFamilyForText(
                            String(year),
                            "semibold"
                          ),
                        },
                      ]}
                    >
                      {year}
                    </Text>
                    <View style={styles.monthPickerGrid}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                        const enabled = hasMonth(m);
                        const label =
                          getCurrentLocale() === "zh"
                            ? `${m}月`
                            : MONTH_NAMES_SHORT[m - 1];
                        if (enabled) {
                          return (
                            <TouchableOpacity
                              key={m}
                              style={styles.monthPickerChip}
                              onPress={() => scrollToMonth(year, m)}
                              activeOpacity={0.7}
                              accessibilityLabel={`${year} ${label}`}
                              accessibilityRole="button"
                            >
                              <Text
                                style={[
                                  styles.monthPickerChipText,
                                  {
                                    fontFamily: getFontFamilyForText(
                                      label,
                                      "regular"
                                    ),
                                  },
                                ]}
                              >
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <View
                            key={m}
                            style={[styles.monthPickerChip, styles.monthPickerChipDisabled]}
                          >
                            <Text
                              style={[
                                styles.monthPickerChipTextDisabled,
                                {
                                  fontFamily: getFontFamilyForText(
                                    label,
                                    "regular"
                                  ),
                                },
                              ]}
                            >
                              {label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // ========== 渲染函数 ==========

  /**
   * 渲染顶部用户信息区域
   */
  const renderHeader = () => (
    <View 
      style={styles.header}
      onLayout={(e) => {
        // ✅ 动态测量 Header 高度
        const { height } = e.nativeEvent.layout;
        // 只有高度发生显著变化时才更新（避免微小抖动）
        if (Math.abs(headerHeightRef.current - height) > 1) {
          console.log(`📏 Header Height measured: ${height}`);
          headerHeightRef.current = height;
        }
      }}
    >
      {/* ✅ 搜索框 + Profile 头像入口 - 同一行，右对齐 */}
      <View style={styles.headerTopRow}>
        {/* 搜索框 - 只在日记数 ≥ 10 时显示，点击进入搜索页面 */}
        {diaries.length >= 10 && (
          <TouchableOpacity
            onPress={() => {
              // @ts-ignore - SearchScreen 参数类型
              navigation.navigate("Search", { diaries });
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 0 }}
            style={styles.compactSearchContainer}
          >
            <SearchIcon width={20} height={20} />
            <Text
              style={[
                styles.compactSearchPlaceholder,
                {
                  fontFamily: getFontFamilyForText(
                    t("search.placeholder"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("search.placeholder")}
            </Text>
          </TouchableOpacity>
        )}

        {/* ✅ Profile 头像入口 - 可爱笑脸，比汉堡菜单更有温度 */}
        <TouchableOpacity
          style={styles.compactMenuButton}
          onPress={handleOpenDrawer}
          accessibilityLabel={t("home.profileMenuButton")}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ProfileIcon width={28} height={28} />
        </TouchableOpacity>
      </View>

      {/* 顶部区域：问候语 + 头像 */}
      <View style={styles.topBar}>
        {/* 问候语 */}
        <View style={styles.greetingContainer}>
          <View style={styles.greetingTitleRow}>
            <AppIconHomepage
              width={32}
              height={32}
              style={styles.greetingIcon}
            />
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "baseline",
                flex: 1,
              }}
            >
              {userDisplayName && greetingWelcome.includes(userDisplayName) ? (
                // 如果包含用户名，拆分显示以高亮name
                (() => {
                  const parts = greetingWelcome.split(userDisplayName);
                  return (
                    <>
                      {parts.map((part: string, index: number) => (
                        <React.Fragment key={index}>
                          {part && (
                            <Text
                              style={[
                                styles.greetingBold,
                                {
                                  fontFamily: getFontFamilyForText(
                                    part,
                                    "bold"
                                  ),
                                },
                              ]}
                            >
                              {part}
                            </Text>
                          )}
                          {index < parts.length - 1 && (
                            <Text
                              style={[
                                styles.greetingBoldHighlight,
                                {
                                  fontFamily: getFontFamilyForText(
                                    userDisplayName,
                                    "bold"
                                  ),
                                },
                              ]}
                            >
                              {userDisplayName}
                            </Text>
                          )}
                        </React.Fragment>
                      ))}
                    </>
                  );
                })()
              ) : (
                <Text
                  style={[
                    styles.greetingBold,
                    {
                      fontFamily: getFontFamilyForText(greetingWelcome, "bold"),
                    },
                  ]}
                >
                  {greetingWelcome}
                </Text>
              )}
            </View>
          </View>
          <Text
            style={[
              styles.greetingLight,
              {
                fontFamily: getFontFamilyForText(greetingSubtitle, "regular"),
              },
            ]}
          >
            {greetingSubtitle}
          </Text>
        </View>
      </View>

      {/* ✅ 幸福罐 Banner - 只在有幸福日记时显示（放在分割线上方） */}
      {happyDiaries.length > 0 && (
        <HappinessBanner
          count={happyDiaries.length}
          onPress={() => {
            navigation.navigate("HappinessJar" as any, {
              diaries: happyDiaries,
            });
          }}
        />
      )}

      {/* 分割线 - 始终显示，作为顶部区域的结尾 */}
      <View style={styles.divider} />

      {/* 我的日记标题 - 只在有至少一条日记时显示；右侧为情绪日历入口 */}
      {diaries.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionTitleLeft}>
            <PreciousMomentsIcon width={20} height={20} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: "#80645A",
                  fontFamily: getFontFamilyForText(t("home.myDiary"), "regular"),
                },
              ]}
            >
              {t("home.myDiaryPrefix")}{" "}
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: "#FF6B35",
                    fontWeight: "bold",
                    fontSize: 15,
                    fontFamily: getFontFamilyForText(
                      diaries.length.toString(),
                      "bold"
                    ),
                  },
                ]}
              >
                {diaries.length}
              </Text>{" "}
              {t("home.myDiarySuffix")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("MoodCalendar")}
            style={styles.calendarEntryButton}
            hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
            accessibilityLabel={t("moodCalendar.navTitle")}
            accessibilityHint={t("moodCalendar.emptyPickDate")}
            accessibilityRole="button"
          >
            <CalendarIconOrange width={22} height={22} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  /**
   * 渲染单个日记卡片
   *
   * 设计:
   * - 白色卡片带阴影
   * - 顶部显示日期
   * - 中间显示日记内容(最多3行)
   * - 底部显示AI反馈(带渐变背景)
   */
  const renderDiaryCard = ({ item, index }: { item: Diary; index: number }) => {
    const renderImageGrid = (imageUrls: string[]) => {
      if (!imageUrls.length) return null;

      // ============================================================================
      // Best Practice Image Grid Layout
      // ============================================================================
      // Requirements:
      // - Single row only (no wrapping)
      // - Max 3 images displayed
      // - If ≥3 images, show "+N" badge on 3rd image
      // - Consistent height for all layouts (1, 2, or 3 images)
      // - Height calculated based on 3-column scenario
      // - Width adjusts dynamically based on image count
      // - 24px distance from card edges
      //
      const GAP = 8;
      const CARD_PADDING = 24;
      const PAGE_MARGIN = 24;
      const TOTAL_HORIZONTAL_PADDING = (CARD_PADDING + PAGE_MARGIN) * 2; // 96px

      const screenWidth = Dimensions.get("window").width;
      const availableWidth = screenWidth - TOTAL_HORIZONTAL_PADDING;

      // Height based on 3-column layout (standard)
      const IMAGE_HEIGHT = Math.floor((availableWidth - 2 * GAP) / 3);

      const imageCount = imageUrls.length;
      const displayCount = Math.min(imageCount, 3); // Max 3 images
      const hasMore = imageCount > 3;
      const remainingCount = imageCount - 3;

      // Calculate width based on actual display count
      let imageWidth: number;
      if (displayCount === 1) {
        imageWidth = availableWidth;
      } else if (displayCount === 2) {
        imageWidth = Math.floor((availableWidth - GAP) / 2);
      } else {
        imageWidth = Math.floor((availableWidth - 2 * GAP) / 3);
      }

      return (
        <View style={{ flexDirection: "row" }}>
          {imageUrls.slice(0, displayCount).map((url, index) => {
            const isLast = index === displayCount - 1;
            const showBadge = isLast && hasMore;

            return (
              <Pressable
                key={index}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  setImagePreviewUrls(imageUrls);
                  setImagePreviewIndex(index);
                  setImagePreviewVisible(true);
                }}
                style={{
                  width: imageWidth,
                  height: IMAGE_HEIGHT,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: "#f0f0f0",
                  marginRight: isLast ? 0 : GAP,
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />

                {showBadge && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 20,
                        fontWeight: "600",
                      }}
                    >
                      +{remainingCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      );
    };

    // 格式化日期和时间显示
    const displayDate = formatDateTime(item.created_at);

    // 检测是否为纯图片日记
    const isImageOnly =
      item.image_urls &&
      item.image_urls.length > 0 &&
      (!item.title || item.title.trim() === "") &&
      (!item.polished_content || item.polished_content.trim() === "");

    // 生成无障碍标签（包含索引和总数信息）
    const accessibilityLabel = `${t("accessibility.list.diaryCard")} ${
      index + 1
    } ${t("accessibility.list.of")} ${diaries.length}, ${
      item.title || "图片日记"
    }`;

    // ✅ 动态计算字体（确保中文内容使用 Noto Serif SC Bold）
    const isChineseTitle = detectTextLanguage(item.title || "") === "zh";
    const titleFontFamily = getFontFamilyForText(
      item.title || "",
      isChineseTitle ? "bold" : "semibold"
    );
    const contentText = isImageOnly
      ? ""
      : item.polished_content || item.original_content;
    const isChineseContent = detectTextLanguage(contentText) === "zh";
    const contentFontFamily = getFontFamilyForText(contentText, "regular");

    return (
      <TouchableOpacity
        style={styles.diaryCard}
        onPress={() => handleDiaryPress(item)}
        activeOpacity={0.7}
        // 添加无障碍属性
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t("accessibility.button.viewDetailHint")}
        accessibilityRole="button"
      >
        {/* ✅ Diagnostic Logging */}
        {index < 5 && console.log(`🖼️ Rendering Card ${index}: ${item.diary_id}`) || null}
        {/* ✅ 情绪光晕效果 - 放在最外层，不受 Padding 影响 */}
        <EmotionGlow emotion={item.emotion_data?.emotion} />

        {/* ✅ 内容容器 - 提供 Padding */}
        <View style={styles.cardContentContainer} pointerEvents="box-none">
          {/* 纯图片日记：只显示图片 */}
          {isImageOnly ? (
            <>
              {/* 图片缩略图 */}
              {item.image_urls && item.image_urls.length > 0 && (
                <View
                  style={[styles.imageGrid, { marginTop: 0, marginBottom: 12 }]}
                >
                  {renderImageGrid(item.image_urls)}
                </View>
              )}
            </>
          ) : (
            <>
              {/* 标题行：包含标题和情绪标签 */}
              {(item.title || item.emotion_data?.emotion || !isImageOnly) && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start", // 标题可能有多行，顶部对齐
                    marginBottom: 8,
                    zIndex: 10,
                  }}
                >
                  {/* 标题 */}
                  {item.title && item.title.trim() !== "" ? (
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <HighlightedText
                        text={item.title}
                        searchQuery={searchQuery}
                        style={[
                          styles.cardTitle,
                          {
                            fontFamily: titleFontFamily,
                            fontWeight: isChineseTitle ? "700" : "600",
                            fontSize: isChineseTitle ? 18 : 18,
                            lineHeight: isChineseTitle ? 26 : 24,
                          },
                        ]}
                        numberOfLines={2}
                      />
                    </View>
                  ) : (
                    <View style={{ flex: 1 }} /> // 无标题时占位
                  )}

                  {/* ✅ 情绪标签 - 只要不是纯图片日记就显示 */}
                  {(item.emotion_data?.emotion || !isImageOnly) && (
                    <View style={{ marginLeft: 8 }}>
                      <EmotionCapsule
                        emotion={item.emotion_data?.emotion}
                        language={item.language || "en"}
                        content={item.polished_content || item.original_content}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* 内容预览 */}
              {contentText && contentText.trim() !== "" && (
                <HighlightedText
                  text={contentText}
                  searchQuery={searchQuery}
                  style={[
                    styles.cardContent,
                    {
                      fontFamily: contentFontFamily,
                      fontSize: isChineseContent ? 16 : 16, // ✅ 中文字号从 14 增加到 16
                      lineHeight: isChineseContent ? 28 : 24, // ✅ 中文行高 28px
                    },
                  ]}
                  numberOfLines={3}
                />
              )}

              {/* 图片缩略图（如果有） */}
              {item.image_urls && item.image_urls.length > 0 && (
                <View
                  style={[
                    styles.imageGrid,
                    item.audio_url ? styles.imageGridWithAudio : null,
                  ]}
                >
                  {renderImageGrid(item.image_urls)}
                </View>
              )}
            </>
          )}

          {/* ✅ 使用统一的音频播放器组件 */}
          <AudioPlayer
            audioUrl={item.audio_url}
            audioDuration={item.audio_duration}
            isPlaying={currentPlayingId === item.diary_id}
            currentTime={currentTime.get(item.diary_id) || 0}
            totalDuration={
              duration.get(item.diary_id) || item.audio_duration || 0
            }
            hasPlayedOnce={hasPlayedOnce.has(item.diary_id)}
            onPlayPress={() => handlePlayAudio(item)}
            onSeek={(seekTime) => handleSeek(item.diary_id, seekTime)}
            style={styles.audioButton}
          />

          {/* 日期 + 三点菜单图标 - 移到底部 */}
          <View style={styles.cardFooter}>
            <View style={styles.dateContainer}>
              <TimeIcon width={20} height={20} color="#80645A" />
              <Text
                style={[
                  styles.cardDate,
                  {
                    fontFamily: getFontFamilyForText(displayDate, "regular"),
                  },
                ]}
              >
                {displayDate}
              </Text>
            </View>

            {/* 三点菜单图标 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发整个卡片的点击
                handleDiaryOptions(item);
              }}
              style={styles.optionsButton}
              accessibilityLabel={t("home.diaryOptionsButton")}
              accessibilityHint={t("accessibility.button.editHint")}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MoreIcon width={24} height={24} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * 渲染加载骨架屏
   * 当正在加载时显示骨架屏，而不是空白页
   */
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {/* 欢迎文字骨架 */}
      <View style={styles.skeletonWelcomeSection}>
        <Animated.View
          style={[styles.skeletonLine, { width: 100, height: 20 }]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            { width: 200, height: 32, marginTop: 8 },
          ]}
        />
      </View>

      {/* 我的日记标题骨架 */}
      <Animated.View
        style={[
          styles.skeletonLine,
          { width: 120, height: 24, marginBottom: 16 },
        ]}
      />

      {/* 模拟3个日记卡片骨架 */}
      {[1, 2, 3].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.skeletonCard,
            styles.skeletonDiaryCard,
            { opacity: skeletonOpacity },
          ]}
        >
          <Animated.View style={[styles.skeletonLine, { width: "80%" }]} />
          <Animated.View style={[styles.skeletonLine, { width: "90%" }]} />
          <Animated.View style={[styles.skeletonLine, { width: "70%" }]} />
        </Animated.View>
      ))}
    </View>
  );

  /**
   * 渲染空状态
   * 当没有日记时显示
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <EmptyStateIcon width={120} height={120} />
      </View>
      <Text
        style={[
          styles.emptySubtitle,
          {
            fontFamily: getFontFamilyForText(t("home.emptySubtitle"), "regular"),
          },
        ]}
      >
        {t("home.emptySubtitle")}
      </Text>
    </View>
  );

  // ✅ 性能核心优化：通过 useMemo 锁定 Header 和 EmptyState 渲染
  // 它们不依赖 currentTime，因此音频进度更新时（100ms/次）不会触发它们的重绘
  const listHeader = React.useMemo(() => renderHeader(), [
    diaries.length,
    userDisplayName,
    greetingWelcome,
    greetingSubtitle,
    handleOpenDrawer,
  ]);

  const listEmpty = React.useMemo(() => renderEmptyState(), [
    diaries.length,
    t,
  ]);

  // ✅ memoize renderDiaryCard 以减少重排开销
  const renderDiaryCardMemo = React.useCallback(
    ({ item, index }: { item: Diary; index: number }) =>
      renderDiaryCard({ item, index }),
    [currentPlayingId, currentTime, duration, hasPlayedOnce, handleDiaryPress, handleDiaryOptions]
  );

  // ========== 主渲染 ==========

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 动态内容更新提示区域 */}
      <View
        accessibilityLiveRegion="polite"
        style={{ position: "absolute", left: -9999, width: 1, height: 1 }}
      >
        {loading && (
          <Text accessibilityLabel={t("accessibility.status.loading")}>
            {t("accessibility.status.loading")}
          </Text>
        )}
        {refreshing && (
          <Text accessibilityLabel={t("home.refreshing")}>
            {t("home.refreshing")}
          </Text>
        )}
      </View>

      {/* 正在加载时显示骨架屏 */}
      {loading ? (
        renderSkeleton()
      ) : (
        <>
          {/* 列表区：使用 flex:1 自动填满可用空间，不再手动计算高度 */}
          <View style={styles.mainContentWrap}>
            <View style={styles.listWrapper}>
              {diaries.length > 0 &&
                searchQuery.trim() === "" &&
                stickyYear != null &&
                stickyMonth != null &&
                stickyBarVisible && (
                  <Animated.View
                    style={[
                      styles.stickyYearMonthBarOverlay,
                      { opacity: stickyBarOpacity },
                    ]}
                    pointerEvents={stickyBarVisible ? "auto" : "none"}
                  >
                    <TouchableOpacity
                      style={styles.stickyYearMonthBar}
                      onPress={() => setMonthPickerVisible(true)}
                      activeOpacity={0.7}
                      accessibilityLabel={formatStickyYearMonth(stickyYear, stickyMonth)}
                      accessibilityHint={t("home.monthPickerTitle")}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.stickyYearMonthText,
                          {
                            fontFamily: getFontFamilyForText(
                              formatStickyYearMonth(stickyYear, stickyMonth),
                              "regular"
                            ),
                          },
                        ]}
                      >
                        {formatStickyYearMonth(stickyYear, stickyMonth)}
                      </Text>
                      <Ionicons
                        name="chevron-down-outline"
                        size={14}
                        color="#82665B"
                        style={styles.stickyYearMonthChevron}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              <FlatList
                ref={flatListRef}
                style={styles.flatListFill}
                data={searchQuery.trim() !== '' ? searchResults : diaries}
                renderItem={renderDiaryCardMemo}
                keyExtractor={(item) => item.diary_id}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={[
                  styles.listContent,
                  {
                    paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 24,
                    // Removing flexGrow: 1 to prevent layout occlusion issues
                  },
                ]}
                extraData={{ currentPlayingId, currentTime, duration }}
                onScroll={handleListScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#E56C45"
                    accessibilityLabel={t("home.refreshing")}
                  />
                }
                showsVerticalScrollIndicator={false}
                accessibilityLabel={
                  diaries.length > 0
                    ? `${diaries.length} ${t("accessibility.list.diaryCard")}`
                    : t("accessibility.list.emptyList")
                }
              />
            </View>
          </View>

          {/* 底部操作栏：与 mainContentWrap 平级，绝对定位悬浮，固定高度绝不拉伸 */}
          <View
            style={[
              styles.bottomActionBar,
              {
                bottom: insets.bottom + 12,
                height: BOTTOM_BAR_HEIGHT,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleImageUpload}
              activeOpacity={0.7}
              accessibilityLabel={t("home.addImageButton")}
              accessibilityHint={t("accessibility.button.recordHint")}
              accessibilityRole="button"
            >
              <ImageInputIcon width={32} height={32} fill={"#332824"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleVoiceRecord}
              activeOpacity={0.8}
              accessibilityLabel={t("home.recordVoiceButton")}
              accessibilityHint={t("accessibility.button.recordHint")}
              accessibilityRole="button"
            >
              <MicIcon width={26} height={26} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTextInput}
              activeOpacity={0.7}
              accessibilityLabel={t("home.writeTextButton")}
              accessibilityHint={t("accessibility.button.continueHint")}
              accessibilityRole="button"
            >
              <TextInputIcon width={32} height={32} fill={"#332824"} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Action Sheet */}
      {renderActionSheet()}

      {/* 月份选择器 Modal */}
      {renderMonthPickerModal()}

      {/* ✅ 录音Modal (放在最外层，不影响列表布局) */}
      <RecordingModal
        visible={recordingModalVisible}
        onSuccess={() => {
          setImageUrlsForVoice(undefined); // 清除图片URL
          setRecordingModalVisible(false);
          loadDiaries(); // ✅ 录音成功后刷新列表
        }}
        onCancel={() => {
          setImageUrlsForVoice(undefined); // 清除图片URL
          handleRecordingCancel();
        }}
        onDiscard={loadDiaries}
        imageUrls={imageUrlsForVoice} // ✅ 传递图片URL列表
        // ✅ 传递顶级 Hook 状态，确保计时器不中断
        voiceRecording={voiceRecording}
      />

      {/* ✅ 新增:文字输入Modal */}
      <TextInputModal
        visible={textInputModalVisible}
        onSuccess={handleTextInputSuccess}
        onCancel={handleTextInputCancel}
      />

      {/* ✅ 图片日记Modal */}
      <ImageDiaryModal
        visible={imageDiaryModalVisible}
        onClose={() => setImageDiaryModalVisible(false)}
        onSuccess={() => {
          setImageDiaryModalVisible(false);
          loadDiaries(); // ✅ 统一刷新日记列表
        }}
        maxImages={9}
        onAddImage={() => {
          // 在 ImageDiaryModal 内部已经处理了添加图片的逻辑
          // 这里可以留空，或者添加额外的逻辑
        }}
        onAddText={() => {
          setImageDiaryModalVisible(false);
          setTextInputModalVisible(true);
        }}
      />

      {/* Diary Detail Modal */}
      {diaryDetailVisible && selectedDiaryForDetail && (
        <DiaryDetailScreen
          diaryId={selectedDiaryForDetail.diary_id}
          onClose={() => {
            setDiaryDetailVisible(false);
            setSelectedDiaryForDetail(null);
          }}
          onUpdate={() => {
            // ✅ 刷新日记列表
            console.log("🔄 详情页更新,刷新列表");
            loadDiaries();
          }}
        />
      )}

      {/* World-Class Image Preview */}
      <ImagePreviewModal
        visible={imagePreviewVisible}
        images={imagePreviewUrls}
        initialIndex={imagePreviewIndex}
        onClose={() => setImagePreviewVisible(false)}
      />

      {/* ✅ 已删除：老用户偏好称呼弹窗（体验不好，改为让用户主动去汉堡菜单修改） */}

      {/* iOS 轻量 Toast 提示 - 使用全屏容器确保居中 */}
      {Platform.OS === "ios" && toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastContainer}>
            <Text
              style={[
                styles.toastText,
                {
                  fontFamily: getFontFamilyForText(toastMessage, "regular"),
                },
              ]}
            >
              {toastMessage}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ========== 工具函数 ==========

/**
 * 格式化日期和时间显示
 * 中文: 2026 年 1 月 11 日 · 下午 2:52
 * 英文: Jan 11, 2026 · 2:05 PM
 */
function formatDateTime(dateTimeString: string): string {
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
function formatAudioDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ========== 样式定义 ==========

/**
 * 样式说明:
 *
 * 颜色系统:
 * - 主色调: #E56C45 (粉红色,温暖友好)
 * - 辅助色: #C084FC (紫色,神秘优雅)
 * - 背景色: #F8F9FA (浅灰,干净舒适)
 * - 文字色: #1A1A1A (深灰,易读)
 *
 * 间距系统:
 * - 4的倍数: 4, 8, 12, 16, 20, 24, 32...
 * - 保持一致的视觉节奏
 *
 * 圆角:
 * - 小: 8
 * - 中: 12
 * - 大: 16
 * - 超大: 24
 */
const styles = StyleSheet.create({
  // ===== 容器 =====
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },

  /** 主内容区包裹层：确保 flex 上下文，列表填满可用高度，消除底部色块遮挡 */
  mainContentWrap: {
    flex: 1,
  },

  listContent: {
    paddingBottom: 100, // 占位；实际由 JS 覆盖为 BOTTOM_BAR_HEIGHT + insets.bottom + 24
  },

  listWrapper: {
    flex: 1,
    position: "relative",
  },
  flatListFill: {
    flex: 1,
  },

  stickyYearMonthBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    zIndex: 10,
    backgroundColor: "#FAF6ED",
  },
  stickyYearMonthBar: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  stickyYearMonthText: {
    fontSize: 14,
    color: "#82665B",
  },
  stickyYearMonthChevron: {
    marginLeft: 8,
  },

  // ===== 头部区域 =====
  header: {
    paddingHorizontal: 24,
    paddingTop: 12, // 减少顶部内边距，因为现在有独立的菜单行
    paddingBottom: 12,
  },

  headerMenuRow: {
    flexDirection: "row",
    justifyContent: "flex-end", // 右对齐
    marginBottom: 4,
    marginRight: -10, // 抵消一部分 paddingHorizontal，让按钮更靠右
  },

  // ✅ 新紧凑搜索样式
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',  // ✅ 右对齐
    marginBottom: 16,
  },
  compactSearchContainer: {
    width: 160,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',  // 白色背景
    borderRadius: 18,  // 全圆角 (36/2)
    paddingHorizontal: 12,
    // ✅ 更弱的投影（降低透明度和半径）
    shadowColor: "#FFD1B0",
    shadowOffset: {
      width: 0,
      height: 1, // 更小的偏移
    },
    shadowOpacity: 0.15, // ✅ 降低透明度（从0.3改为0.15）
    shadowRadius: 4, // ✅ 减小半径（从8改为4），让阴影更弱
    elevation: 1, // ✅ Android 阴影也降低（从2改为1）
  },
  compactSearchIcon: {
    marginRight: 6,
  },
  compactSearchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: "#B8A89D",
    paddingLeft: 4,
  },
  compactMenuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,  // 圆形 (28/2)
    backgroundColor: 'transparent',  // ✅ 去掉白色背景
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,  // ✅ 距离搜索框12px（从8px改为12px）
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#80645A',
  },
  searchResultCount: {
    fontSize: 14,
    color: '#80645A',
    marginTop: 8,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "flex-start", // 改为顶对齐，让头像与左侧内容顶部对齐
    justifyContent: "space-between",
    marginBottom: 0,
  },

  divider: {
    height: 1,
    backgroundColor: "#F2E2C3",
    marginTop: 16, // ✅ 与上方文字/Banner 保持呼吸感，避免贴在一起
    marginBottom: 0, // ✅ 距离下方16px（设计稿要求）
  },

  greetingContainer: {
    flex: 1,
    marginRight: 32,
  },

  greetingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  greetingIcon: {
    marginRight: 8,
  },

  greetingBold: {
    ...Typography.diaryTitle,
    color: "#1A1A1A",
    marginBottom: 2,
  },

  greetingBoldHighlight: {
    ...Typography.diaryTitle,
    color: "#E56C45", // 主题色高亮
    marginBottom: 2,
  },

  greetingLight: {
    ...Typography.caption,
    fontSize: 15,
    color: "#80645A", // ✅ 与日记列表标题颜色保持一致
  },

  menuButton: {
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // ===== 标题 =====
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 0,
  },
  sectionTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  calendarEntryButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: "#1A1A1A",
    marginLeft: 8,
  },

  // ===== 日记卡片 =====
  diaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    // padding: 20, // ❌ 移除父容器 Padding，防止裁剪光晕
    // paddingTop: 20,
    // paddingBottom: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    // ✅ 更加柔和扩散的投影
    shadowColor: "#FFD1B0",
    shadowOffset: {
      width: 0,
      height: 4, // 降低高度，让阴影更贴近卡片
    },
    shadowOpacity: 0.45, // 降低透明度，让阴影更柔和
    shadowRadius: 28, // 增大半径，实现更广的扩散效果
    elevation: 3, // Android 阴影同步调整
    // overflow: "hidden", // ❌ 移除，否则 iOS 阴影会消失！圆角由内部组件匹配。
  },

  // ✅ 新增：内容内边距容器
  cardContentContainer: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 24, // ✅ 时间部分距离底部的间距改为 24px
    zIndex: 1, // 确保内容在光晕之上
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    height: 20, // ✅ 与 20px 图标高度完全一致，消除垂直偏移
  },

  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4, // 图标和文字之间的间距
  },

  cardDate: {
    ...Typography.caption,
    color: "#80645A", // 统一的时间颜色
  },

  cardTitle: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 0, // 间距由外层 View 的 marginBottom: 8 控制
  },

  optionsButton: {
    paddingLeft: 12,
    paddingRight: 0,
    minWidth: 32,
    height: 20, // ✅ 与页脚高度一致
    alignItems: "center",
    justifyContent: "center",
  },

  cardContent: {
    ...Typography.body,
    color: "#1A1A1A",
    marginBottom: 12, // ✅ 统一标准：文字距离下方内容 12px
    textAlign: "left",
  },

  // ============================================================================
  // Image Grid Styles (Using Production-Grade Layout System)
  // ============================================================================
  //
  // Design: 3 columns with 8px gap
  // Context: Inside diary card (24px card padding) + page padding (24px)
  // Total horizontal padding: 24 + 24 + 24 + 24 = 96px
  // Available width: screenWidth - 96px
  // Image size: (availableWidth - 2 gaps × 8px) / 3
  //
  imageGrid: {
    flexDirection: "row",
    // flexWrap removed - single row only
    marginTop: 0,
    marginBottom: 12,
    // gap removed - handled by marginRight
  },
  imageThumbnail: {
    // Dynamic calculation: (screenWidth - 96px - 16px) / 3
    // 96px = total padding, 16px = 2 gaps × 8px
    width: Math.floor((Dimensions.get("window").width - 96 - 16) / 3),
    height: Math.floor((Dimensions.get("window").width - 96 - 16) / 3),
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  moreBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  moreBadgeImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  moreBadgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  moreText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800", // ✅ 加重字重
    letterSpacing: 2, // ✅ 通过字间距控制加号与数字的距离
  },

  aiFeedbackContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  aiFeedback: {
    flex: 1,
    fontSize: 14,
    color: "#E56C45",
    marginLeft: 6,
    lineHeight: 20,
  },

  // ===== 空状态 =====
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 20, // 进一步放宽宽度
    marginTop: 40,
  },

  emptyIconContainer: {
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: "#1A1A1A",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 22,
  },

  emptySubtitle: {
    fontSize: 15,
    color: "#80645A", // 与顶部描述文字颜色一致
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 40, // 增加内边距，引导下方文字进行合理的折行，增加层次感
  },

  // ===== 创建按钮 =====
  createButtonContainer: {
    position: "absolute",
    right: 20,
    bottom: 32,
  },

  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",

    // 更明显的阴影
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // ===== 骨架屏样式 =====
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  skeletonWelcomeSection: {
    marginBottom: 20,
  },

  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  skeletonDiaryCard: {
    padding: 16,
    height: 140,
  },

  skeletonLine: {
    height: 14,
    backgroundColor: "#E5E5E5",
    borderRadius: 4,
    marginBottom: 12,
    width: "100%",
  },

  // ===== 音频播放器样式（使用统一组件）=====
  audioButton: {
    marginTop: 0, // ✅ 禁用 marginTop
    marginBottom: 12, // ✅ 统一标准：语音距离下方内容 12px
  },
  imageGridWithAudio: {
    // 移除所有 margin 覆盖，使用基础样式
  },

  // ===== 自定义 Action Sheet =====
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject, // 占据整个容器
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  actionSheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area bottom
    paddingTop: 20,
    paddingHorizontal: 20,
  },

  monthPickerContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "70%",
  },
  monthPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  monthPickerScroll: { flex: 1, minHeight: 200, maxHeight: 360 },
  monthPickerContent: { paddingBottom: 24, flexGrow: 1 },
  monthPickerSection: { marginBottom: 20 },
  monthPickerYearLabel: {
    fontSize: 16,
    color: "#82665B",
    marginBottom: 12,
  },
  monthPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthPickerChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FAF6ED",
    minWidth: 56,
    alignItems: "center",
  },
  monthPickerChipText: {
    fontSize: 14,
    color: "#82665B",
  },
  monthPickerChipDisabled: {
    backgroundColor: "#F0F0F0",
    opacity: 0.6,
  },
  monthPickerChipTextDisabled: {
    fontSize: 14,
    color: "#999",
  },
  monthPickerEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  monthPickerEmptyText: {
    fontSize: 14,
    color: "#999",
  },

  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "left",
    color: "#333",
    flex: 1,
  },

  actionSheetCloseButton: {
    padding: 4,
  },

  actionSheetHeaderDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginBottom: 4,
  },

  headerIcon: {
    marginRight: 12,
    marginTop: 2,
  },

  headerTextContainer: {
    flex: 1,
  },

  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
  },

  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 8,
  },

  actionIcon: {
    marginRight: 8,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  actionText: {
    ...Typography.body,
    fontSize: 16,
    color: "#1A1A1A",
  },

  deleteText: {
    color: "#FF3B30",
  },

  cancelButton: {
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 8,
    alignItems: "center",
  },

  cancelText: {
    ...Typography.body,
    fontSize: 17, // iOS 系统默认字号
    fontWeight: "600",
    color: "#E56C45", // 主题色
  },

  // ===== Toast（iOS）=====
  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  toastContainer: {
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    maxWidth: "80%",
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewClose: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    zIndex: 2,
  },
  imagePreviewSlide: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
  },
  imagePreviewCounter: {
    position: "absolute",
    bottom: 40,
    color: "#fff",
    fontSize: 16,
  },

  // ===== 底部操作栏（胶囊效果）=====
  // height、bottom 由 JS 动态设置；绝不使用 flex，避免被拉伸成半屏遮挡
  bottomActionBar: {
    position: "absolute",
    left: 56,
    right: 56,
    backgroundColor: "#fff",
    borderRadius: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingVertical: 8,
    paddingHorizontal: 0,
    shadowColor: "#E56C45",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },

  actionButton: {
    width: 44, // 确保点击区域至少 44x44pt (符合 Apple HIG 和 Android 无障碍标准)
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  recordButton: {
    width: 56, // 确保点击区域至少 44x44pt，主按钮稍大一些
    height: 56,
    borderRadius: 28, // 对应调整圆角
    backgroundColor: "#E56C45", // 使用主题色
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // ===== 用户菜单样式 =====
  profileMenuContainer: {
    position: "absolute",
    top: 148, // ← 调整位置,紧贴头像下方
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 12, // ← 更紧凑
    width: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  profileMenuInfo: {
    flex: 1, // 占据剩余空间
    marginRight: 12,
  },

  profileMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },

  profileMenuAvatar: {
    width: 36,
    height: 36,
    borderRadius: 36,
    marginRight: 8,
  },

  profileMenuName: {
    fontSize: 18, // 17 + 2 = 19
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: -2,
    overflow: "hidden",
  },

  profileMenuEmail: {
    fontSize: 14, // 13 + 2 = 15
    color: "#666",
    overflow: "hidden",
  },

  profileMenuDivider: {
    height: 1,
    backgroundColor: "#FCF4E3",
    marginHorizontal: 16,
    marginVertical: 4,
  },

  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 20,
  },

  profileMenuItemDisabled: {
    opacity: 0.5,
  },

  profileMenuItemText: {
    fontSize: 15,
    color: "#1A1A1A",
    marginLeft: 12,
  },

  profileMenuItemTextDanger: {
    fontSize: 15, // 16 + 2 = 18
    color: "#FF3B30",
    marginLeft: 12,
  },

  profileMenuLoading: {
    marginLeft: 8,
  },
});
