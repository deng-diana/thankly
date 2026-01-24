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
import HamburgarMenuIcon from "../assets/icons/hamburgarMenu.svg";
import SearchIcon from "../assets/icons/searchIcon.svg";  // ✅ 自定义搜索图标
import CalendarIcon from "../assets/icons/calendarIcon.svg";
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
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDiaryAudio } from "../hooks/useDiaryAudio"; // ✅ 使用顶级统一标准 Hook
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

/**
 * 日记列表页面组件
 */
export default function DiaryListScreen() {
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

  // ✅ 新增:用户菜单状态

  // 日记列表
  const [diaries, setDiaries] = useState<Diary[]>([]);

  // ✅ 幸福日记列表（用于幸福罐 Banner）
  const happyDiaries = React.useMemo(() => {
    return diaries.filter((d) => isHappyEmotion(d.emotion_data?.emotion));
  }, [diaries]);

  // 加载状态
  const [loading, setLoading] = useState(false);

  // 下拉刷新状态
  const [refreshing, setRefreshing] = useState(false);

  // 动画值(用于浮动按钮的弹性动画)
  const [buttonScale] = useState(new Animated.Value(1));

  // 骨架屏脉冲动画
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


  // ✅ 新增：Action Sheet 相关状态
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const actionSheetSlide = useRef(new Animated.Value(300)).current; // 动画值

  // ✅ 新增：DiaryDetail Modal 相关状态
  const [diaryDetailVisible, setDiaryDetailVisible] = useState(false);
  const [selectedDiaryForDetail, setSelectedDiaryForDetail] =
    useState<Diary | null>(null);
  // ✅ 新增:录音Modal状态
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  // ✅ 新增:文字输入Modal状态
  const [textInputModalVisible, setTextInputModalVisible] = useState(false);
  // ✅ 新增:图片日记Modal状态
  const [imageDiaryModalVisible, setImageDiaryModalVisible] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const imagePreviewListRef = useRef<FlatList<string> | null>(null);
  // ✅ 新增:图片+语音模式的状态
  const [imageUrlsForVoice, setImageUrlsForVoice] = useState<
    string[] | undefined
  >(undefined);

  // ✅ 录音计时器相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 搜索相关状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Diary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 已删除：showNamePromptForExistingUser 状态（不再需要老用户强制弹窗）

  /**
   * 录音成功回调
   */
  const handleRecordingSuccess = () => {
    console.log("✅ 录音成功,刷新列表");
    setRecordingModalVisible(false);
    loadDiaries(); // ✅ 重新加载日记列表
  };

  /**
   * 取消录音回调
   */
  const handleRecordingCancel = () => {
    console.log("❌ 取消录音");
    setRecordingModalVisible(false);
  };

  // 分别存储 welcome 和 subtitle
  const [greetingWelcome, setGreetingWelcome] = useState("");
  const [greetingSubtitle, setGreetingSubtitle] = useState("");
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null); // 用于高亮显示的用户名

  const resetToRoot = (routeName: keyof RootStackParamList) => {
    const parent = navigation.getParent?.();
    const root = parent?.getParent?.();
    const target = root || parent || navigation;
    target.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
  };

  // ========== 生命周期 ==========
  useEffect(() => {
    loadGreeting();
  }, [user]); // 当用户信息变化时重新加载问候语

  // ✅ 监听页面焦点，当从汉堡菜单返回时重新加载 greeting
  useFocusEffect(
    React.useCallback(() => {
      loadGreeting();
    }, [])
  );

  // ✅ 监听导航参数变化（从汉堡菜单更新名字后触发）
  useEffect(() => {
    const params = route.params as any;
    if (params?.refreshGreeting) {
      console.log("🔄 收到刷新 greeting 指令，立即刷新");
      loadGreeting();
    }
    // ✅ 如果有 Toast 消息，显示 Toast
    if (params?.showSuccessToast) {
      showToast(params.showSuccessToast);
    }
  }, [route.params]);

  // ✅ 已删除：老用户强制弹窗逻辑（用户体验不好）
  // 老用户可以通过汉堡菜单主动修改偏好称呼

  async function loadGreeting() {
    // 检测用户语言
    const locales = Localization.getLocales();
    const userLocale =
      locales.length > 0 && locales[0]?.languageCode
        ? locales[0].languageCode
        : "en";
    const language = userLocale.startsWith("zh") ? "zh" : "en";

    console.log("📍 用户语言:", userLocale, "→ 使用:", language);

    // ✅ 获取用户偏好称呼（优先使用 preferredName）
    let displayName = "";
    const preferredName = await getPreferredName();
    if (preferredName && preferredName.length > 0) {
      // 提取名字（去掉可能的空格和特殊字符，只取第一个词）
      const firstName = preferredName.trim().split(/\s+/)[0];
      // 如果名字不是从邮箱提取的默认值（长度大于1且不是纯数字），则使用
      if (firstName.length > 1 && !/^[0-9]+$/.test(firstName)) {
        displayName = firstName;
      }
    }

    // 保存用于高亮显示的用户名
    setUserDisplayName(displayName || null);

    // 如果没有有效的姓名，使用默认值
    // 英文用"there"，中文用空字符串（因为中文"Hi"后面可以直接接逗号）
    if (!displayName) {
      displayName = language === "zh" ? "" : "there";
    }

    // 构建welcome：替换welcome中的{name}占位符
    let welcomeText = t("home.welcome").replace("{name}", displayName);

    // 如果中文且没有姓名，去掉"Hi "后面的空格，直接接逗号
    if (language === "zh" && !displayName) {
      welcomeText = welcomeText.replace("Hi ", "Hi");
    }

    // 分别设置 welcome 和 subtitle
    setGreetingWelcome(welcomeText);
    setGreetingSubtitle(t("home.subtitle"));

    // 标记已登录过
    const hasLoggedInBefore = await SecureStore.getItemAsync(
      "hasLoggedInBefore"
    );
    if (!hasLoggedInBefore) {
      await SecureStore.setItemAsync("hasLoggedInBefore", "true");
    }
  }

  /**
   * 组件挂载时执行
   * useEffect是React的"副作用"钩子
   * 第二个参数[]表示只在组件首次加载时执行一次
   */
  useEffect(() => {
    loadData();

    // 组件卸载时清理所有定时器和播放器
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  /**
   * 页面获得焦点时自动刷新数据
   * 用于处理从创建日记页面返回时刷新列表
   */
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      // 进入页面时不做额外处理
      // 如果用户已经登录，则刷新日记列表
      const refreshDiaries = async () => {
        try {
          const currentUser = await getCurrentUser();
          if (!currentUser) {
            return; // 没有用户信息，不刷新
          }

          console.log("🔄 页面获得焦点，刷新日记列表...");
          const response = await getDiaries();
          setDiaries(response);
        } catch (error: any) {
          // 静默处理错误，不显示底部提示
          console.error("刷新日记列表失败:", error);

          // 如果是 token 过期，静默跳转到登录页
          if (
            error.message?.includes("已过期") ||
            error.message?.includes("401")
          ) {
            console.log("🔒 Token已过期，静默跳转到登录页");
            await signOut();
            resetToRoot("Login");
            return;
          }
        }
      };

      refreshDiaries();

      // 页面失焦或离开时，强制停止所有音频
      return () => {
        isActive = false;
        stopAllAudio();

        // ✅ 清理搜索定时器
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
      };
    }, [stopAllAudio])
  );

  // 骨架屏脉冲动画
  useEffect(() => {
    if (loading) {
      const pulseAnimation = Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]);
      Animated.loop(pulseAnimation).start();
    }
  }, [loading]);


  // ✅ 新增：Action Sheet 动画效果
  useEffect(() => {
    if (actionSheetVisible) {
      // Action Sheet 打开时，从底部滑入
      Animated.spring(actionSheetSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Action Sheet 关闭时，重置位置
      actionSheetSlide.setValue(300);
    }
  }, [actionSheetVisible]);

  // ========== 数据加载 ==========

  /**
   * 加载页面数据
   * 包括:用户信息、日记列表
   */
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);

      // 1. 获取用户信息
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // ✅ 添加这行检查
      console.log("👤 用户数据:", {
        name: currentUser?.name,
        email: currentUser?.email,
        provider: currentUser?.provider,
        picture: currentUser?.picture, // ← 看这里有没有值
      });

      // ✅ 新增:启动自动刷新
      startAutoRefresh();
      console.log("⏰ 已启动自动Token刷新");

      // 2. 加载日记列表
      await loadDiaries();
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 加载日记列表
   */
  const loadDiaries = React.useCallback(async () => {
    try {
      console.log("📖 开始加载日记列表...");

      const response = await getDiaries();

      const sanitizedDiaries = response.filter((diary) => {
        if (!diary) {
          return false;
        }

        const id = String(diary.diary_id || "")
          .trim()
          .toLowerCase();
        if (!id || id === "unknown") {
          console.log("⚠️ 跳过无效日记: 缺少合法ID", diary);
          return false;
        }

        // 检查是否有内容：文字内容 或 图片 或 音频
        const hasTextContent =
          (diary.polished_content &&
            diary.polished_content.trim().length > 0) ||
          (diary.original_content && diary.original_content.trim().length > 0);

        const hasImages = diary.image_urls && diary.image_urls.length > 0;
        const hasAudio = diary.audio_url && diary.audio_url.trim().length > 0;

        // 只要有文字、图片或音频中的任意一种，就认为是有效日记
        const hasContent = hasTextContent || hasImages || hasAudio;

        if (!hasContent) {
          console.log("⚠️ 跳过无效日记: 缺少内容", diary);
          return false;
        }

        return true;
      });

      // 统计音频数量
      const audioCount = sanitizedDiaries.filter(
        (diary) => diary.audio_url
      ).length;
      console.log("✅ 日记加载成功:", {
        total: sanitizedDiaries.length,
        rawTotal: response.length,
        withAudio: audioCount,
        withoutAudio: sanitizedDiaries.length - audioCount,
      });

      if (sanitizedDiaries.length !== response.length) {
        console.log(
          `⚠️ 过滤掉 ${
            response.length - sanitizedDiaries.length
          } 条无效日记（疑似PROFILE或旧脏数据）`
        );
      }

      setDiaries(sanitizedDiaries);
    } catch (error: any) {
      console.error("❌ 加载日记失败:", error);

      // ✅ 使用统一的错误处理工具
      await handleAuthErrorOnly(error, async () => {
        // 认证过期回调：静默跳转到登录页
        console.log("🔒 Token已过期，静默跳转到登录页");
        resetToRoot("Login");
      });

      setDiaries([]);
    }
  }, []);

  /**
   * 下拉刷新
   */
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error: any) {
      console.error("❌ 下拉刷新失败:", error);
      // 静默处理错误，不显示额外的错误提示（loadDiaries 已经处理了）
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // ===== 录音相关函数 =====

  /**
   * 打开录音Modal
   */
  const openRecordingModal = () => {
    console.log("📱 打开录音Modal");
    stopAllAudio(); // ✅ 确保打开录音时停止其他音频播放
    setRecordingModalVisible(true);
    setIsRecording(true); 
    setIsPaused(false); 
    setRecordingDuration(0); 

    // ✅ 启动计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 1;
        // 10分钟自动停止
        if (newDuration >= 600) {
          handleFinishRecording();
        }
        return newDuration;
      });
    }, 1000);
  };

  /**
   * 暂停录音
   */
  const handlePauseRecording = () => {
    // ✅ 停止计时
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  /**
   * 继续录音
   */
  const handleResumeRecording = () => {
    // ✅ 恢复计时
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 1;
        if (newDuration >= 600) {
          handleFinishRecording();
        }
        return newDuration;
      });
    }, 1000);
  };

  /**
   * 完成录音
   */
  const handleFinishRecording = () => {
    // ✅ 清理计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setRecordingModalVisible(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  };

  /**
   * 取消录音
   */
  const handleCancelRecording = () => {
    // ✅ 清理计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setRecordingModalVisible(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  };

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
    console.log("🍔 点击汉堡菜单");
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
    } catch (error: any) {
      console.error("删除日记失败:", error);

      // 如果是后台已经不存在的老数据，静默刷新列表并返回
      const message = error?.message || "";
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
        error.message || t("error.deleteFailed")
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
      } catch (backendError: any) {
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
  // ========== 渲染函数 ==========

  /**
   * 渲染顶部用户信息区域
   */
  const renderHeader = () => (
    <View style={styles.header}>
      {/* ✅ 搜索框 + 汉堡菜单 - 同一行，右对齐 */}
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

        {/* 汉堡菜单 - 始终显示 */}
        <TouchableOpacity
          style={styles.compactMenuButton}
          onPress={handleOpenDrawer}
          accessibilityLabel={t("home.profileMenuButton")}
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <HamburgarMenuIcon width={28} height={28} color="#80645A" />
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
                      {parts.map((part, index) => (
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

      {/* 我的日记标题 - 只在有至少一条日记时显示 */}
      {diaries.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <PreciousMomentsIcon width={20} height={20} />
          <Text
            style={[
              styles.sectionTitle,
              {
                color: "#80645A", // 使用和时间一样的颜色
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
        {/* ✅ 情绪光晕效果 - 放在最外层，不受 Padding 影响 */}
        <EmotionGlow emotion={item.emotion_data?.emotion} />

        {/* ✅ 内容容器 - 提供 Padding */}
        <View style={styles.cardContentContainer} pointerEvents="box-none">
          {/* 纯图片日记：只显示图片 */}
          {/* DEBUG: {item.emotion_data?.emotion} */}
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
              <CalendarIcon width={20} height={20} />
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
          {/* 日记列表 */}
          {/* ✅ 性能核心优化：通过 useMemo 锁定 Header 和 EmptyState 渲染 */}
          {/* 它们不依赖 currentTime，因此音频进度更新时（100ms/次）不会触发它们的重绘 */}
          {/* 这能从根本上解决“播放音频时，搜索框和汉堡菜单点击不灵敏”的问题 */}
          <FlatList
            data={searchQuery.trim() !== '' ? searchResults : diaries}
            renderItem={renderDiaryCardMemo}
            keyExtractor={(item) => item.diary_id}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={styles.listContent}
            extraData={{ currentPlayingId, currentTime, duration }}
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

          {/* 底部操作栏 */}
          <View style={styles.bottomActionBar}>
            {/* 图片上传按钮 */}
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

            {/* 录音按钮 - 主按钮 */}
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

            {/* 文字输入按钮 */}
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

      {/* ✅ 新增:录音Modal */}
      <RecordingModal
        visible={recordingModalVisible}
        onSuccess={() => {
          setImageUrlsForVoice(undefined); // 清除图片URL
          handleRecordingSuccess();
        }}
        onCancel={() => {
          setImageUrlsForVoice(undefined); // 清除图片URL
          handleRecordingCancel();
        }}
        onDiscard={loadDiaries}
        imageUrls={imageUrlsForVoice} // ✅ 传递图片URL列表
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

  listContent: {
    paddingBottom: 100, // 给底部胶囊操作栏留出足够空间
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
    // 不要边框
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
    width: 36,
    height: 36,
    borderRadius: 18,  // 圆形
    backgroundColor: '#FFFFFF',  // 白色背景
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,  // 距离搜索框8px
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
    marginTop: 16,
    marginBottom: 0,
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
  bottomActionBar: {
    position: "absolute",
    bottom: 32, // 距离底部的间距
    left: 56, // 增加左右间距，减少宽度
    right: 56,
    //borderWidth:1,
    borderColor: "#F2F2F2",
    backgroundColor: "#fff",
    borderRadius: 200, // 全圆角
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly", // 均匀分布，居中显示
    paddingVertical: 8, // 降低高度
    paddingHorizontal: 0, // 增加内边距
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 8,
    },
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
