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
import {
  Typography,
  getTypography,
  getFontFamilyForText,
  detectTextLanguage, // ✅ 新增
} from "../styles/typography";
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
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  type AudioPlayer as ExpoAudioPlayer,
} from "expo-audio"; // ✅ 使用新的 expo-audio API

import * as Localization from "expo-localization";
import { getGreeting } from "../config/greetings";
import * as SecureStore from "expo-secure-store";
import RecordingModal from "../components/RecordingModal";
import TextInputModal from "../components/TextInputModal";
import ImageDiaryModal from "../components/ImageDiaryModal";

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";
import AvatarDefault from "../assets/icons/avatar-default.svg";

// import * as ImagePicker from "expo-image-picker"; // ✅ 新增：图片选择器（稍后安装）
import {
  getCurrentUser,
  User,
  signOut,
  startAutoRefresh,
} from "../services/authService";
import { deleteAccount } from "../services/accountService";
import { handleAuthErrorOnly } from "../utils/errorHandler";
import {
  getDiaries,
  deleteDiary as deleteDiaryApi,
  updateDiary,
  createVoiceDiary,
} from "../services/diaryService";
import AudioPlayer from "../components/AudioPlayer";
import DiaryDetailScreen from "./DiaryDetailScreen";

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

/**
 * 日记数据类型定义
 */
interface Diary {
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
}

/**
 * 日记列表页面组件
 */
export default function DiaryListScreen() {
  // ✅ 添加navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // 获取 Typography 样式（动态字体）
  const typography = getTypography();

  // ========== 状态管理 ==========

  // 用户信息
  const [user, setUser] = useState<User | null>(null);

  // ✅ 新增:用户菜单状态
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // 日记列表
  const [diaries, setDiaries] = useState<Diary[]>([]);

  // 加载状态
  const [loading, setLoading] = useState(false);

  // 下拉刷新状态
  const [refreshing, setRefreshing] = useState(false);

  // 动画值(用于浮动按钮的弹性动画)
  const [buttonScale] = useState(new Animated.Value(1));

  // 骨架屏脉冲动画
  const skeletonOpacity = useRef(new Animated.Value(0.3)).current;

  // ✅ 新增：音频播放相关状态
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null); // 当前播放的日记ID
  const [currentTime, setCurrentTime] = useState<Map<string, number>>(
    new Map()
  ); // 当前时间（秒）
  const [duration, setDuration] = useState<Map<string, number>>(new Map()); // 总时长（秒）
  const [hasPlayedOnce, setHasPlayedOnce] = useState<Set<string>>(new Set()); // 记录哪些音频曾经播放过
  const soundRefs = useRef<Map<string, ExpoAudioPlayer>>(new Map()); // 存储多个音频播放器
  const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map()); // 存储定时器引用，确保正确清理

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

  // ========== 生命周期 ==========
  useEffect(() => {
    loadGreeting();
  }, [user]); // 当用户信息变化时重新加载问候语

  async function loadGreeting() {
    // 检测用户语言
    const locales = Localization.getLocales();
    const userLocale =
      locales.length > 0 && locales[0]?.languageCode
        ? locales[0].languageCode
        : "en";
    const language = userLocale.startsWith("zh") ? "zh" : "en";

    console.log("📍 用户语言:", userLocale, "→ 使用:", language);

    // 获取用户姓名（用于替换占位符）
    let displayName = "";
    if (user?.name && user.name.length > 0) {
      // 提取名字（去掉可能的空格和特殊字符，只取第一个词）
      const firstName = user.name.trim().split(/\s+/)[0];
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
      // 清理所有定时器
      intervalRefs.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      intervalRefs.current.clear();

      // 清理所有播放器
      soundRefs.current.forEach((player) => {
        try {
          player.pause();
          player.remove();
        } catch (e) {
          // 忽略清理错误
        }
      });
      soundRefs.current.clear();
    };
  }, []);

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
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
            return;
          }
        }
      };

      refreshDiaries();

      // 页面失焦或离开时，强制停止所有音频
      return () => {
        isActive = false;
        intervalRefs.current.forEach((intervalId) => {
          clearInterval(intervalId);
        });
        intervalRefs.current.clear();

        soundRefs.current.forEach((player) => {
          try {
            player.pause();
            player.remove();
          } catch (_) {}
        });
        soundRefs.current.clear();

        setCurrentPlayingId(null);
        setHasPlayedOnce(new Set());
        setCurrentTime(new Map());
        setDuration(new Map());
      };
    }, [])
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

  // ✅ 新增：组件卸载时清理所有音频
  useEffect(() => {
    return () => {
      // 清理所有音频播放器
      soundRefs.current.forEach((sound) => {
        try {
          sound.remove(); // expo-audio 使用 remove() 清理
        } catch (err) {
          console.log("清理音频:", err);
        }
      });
      soundRefs.current.clear();
    };
  }, []);

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
  const loadData = async () => {
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
  };

  /**
   * 加载日记列表
   * TODO: 这里要调用后端API
   */
  const loadDiaries = async () => {
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
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      });

      setDiaries([]);
    }
  };

  /**
   * 下拉刷新
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error: any) {
      console.error("❌ 下拉刷新失败:", error);
      // 静默处理错误，不显示额外的错误提示（loadDiaries 已经处理了）
    } finally {
      setRefreshing(false);
    }
  };

  // ===== 录音相关函数 =====

  /**
   * 打开录音Modal
   */
  const openRecordingModal = () => {
    console.log("📱 打开录音Modal");
    setRecordingModalVisible(true);
    setIsRecording(true); // ✅ 添加这行:开始录音状态
    setIsPaused(false); // ✅ 添加这行:确保不是暂停状态
    setRecordingDuration(0); // ✅ 添加这行:重置时长

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
    setRecordingModalVisible(true);
  };

  /**
   * 点击日记卡片
   */
  const handleDiaryPress = (diary: Diary) => {
    console.log("查看日记:", diary.diary_id);
    stopAllAudio();
    setSelectedDiaryForDetail(diary);
    setDiaryDetailVisible(true);
  };

  /**
   * 停止所有正在播放的音频
   * 用于切换页面时避免双重播放
   */
  const stopAllAudio = () => {
    soundRefs.current.forEach((player) => {
      try {
        player.pause();
        player.remove();
      } catch (_) {}
    });
    soundRefs.current.clear();

    intervalRefs.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalRefs.current.clear();

    setCurrentPlayingId(null);
    setHasPlayedOnce(new Set());
    setCurrentTime(new Map());
    setDuration(new Map());
  };

  // ✅ 新增：音频播放相关函数

  /**
   * 播放/暂停音频
   */
  const handlePlayAudio = async (diary: Diary) => {
    if (!diary.audio_url) {
      console.warn("⚠️ 该日记无音频");
      return;
    }

    try {
      console.log("🎵 准备播放音频");

      // 如果正在播放这条音频，则暂停
      if (currentPlayingId === diary.diary_id) {
        const sound = soundRefs.current.get(diary.diary_id);
        if (sound) {
          sound.pause(); // expo-audio 的 pause() 是同步方法
          setCurrentPlayingId(null);

          if (
            sound.isLoaded &&
            sound.duration > 0 &&
            sound.currentTime >= sound.duration - 0.5
          ) {
            setCurrentTime((prev) => {
              const newMap = new Map(prev);
              newMap.delete(diary.diary_id);
              return newMap;
            });
            setDuration((prev) => {
              const newMap = new Map(prev);
              newMap.delete(diary.diary_id);
              return newMap;
            });
            setHasPlayedOnce((prev) => {
              const newSet = new Set(prev);
              newSet.delete(diary.diary_id);
              return newSet;
            });
          }

          // 清理定时器
          const intervalId = intervalRefs.current.get(diary.diary_id);
          if (intervalId) {
            clearInterval(intervalId);
            intervalRefs.current.delete(diary.diary_id);
          }

          console.log("⏸ 已暂停");
        }
        return;
      }

      // 停止其他正在播放的音频
      if (currentPlayingId) {
        const oldSound = soundRefs.current.get(currentPlayingId);
        if (oldSound) {
          oldSound.pause(); // 先暂停
          oldSound.remove(); // expo-audio 使用 remove() 清理
          soundRefs.current.delete(currentPlayingId);

          // 清理旧音频的定时器
          const oldIntervalId = intervalRefs.current.get(currentPlayingId);
          if (oldIntervalId) {
            clearInterval(oldIntervalId);
            intervalRefs.current.delete(currentPlayingId);
          }

          // 清理旧音频的状态（保持进度用于恢复播放）
          // 注意：不删除progress，用户可能想继续播放
        }
      }

      // 检查是否已有播放器（恢复播放）
      const existingPlayer = soundRefs.current.get(diary.diary_id);
      let player: ExpoAudioPlayer;
      let isResuming = false;

      if (existingPlayer && existingPlayer.isLoaded) {
        // 恢复播放：使用已有的播放器
        player = existingPlayer;
        isResuming = true;
        console.log("🔄 恢复播放音频:", diary.diary_id);
      } else {
        // 新播放：创建新的播放器
        console.log("🎵 创建音频播放器:", diary.audio_url);
        player = createAudioPlayer(diary.audio_url!, {
          updateInterval: 100, // 每100ms更新一次状态
        });
        soundRefs.current.set(diary.diary_id, player);

        // 标记为已播放过
        setHasPlayedOnce((prev) => {
          const newSet = new Set(prev);
          newSet.add(diary.diary_id);
          return newSet;
        });
      }

      // 播放音频
      player.play();

      console.log("✅ 音频播放器准备完成");

      setCurrentPlayingId(diary.diary_id);

      // 初始化：立即设置 duration（优先使用数据库中的audio_duration，如果player已加载则使用player的duration）
      const initialDuration =
        player.isLoaded && player.duration > 0
          ? player.duration
          : diary.audio_duration || 0;

      if (initialDuration > 0) {
        setDuration((prev) => {
          const newMap = new Map(prev);
          newMap.set(diary.diary_id, initialDuration);
          return newMap;
        });
      }

      // 初始化当前时间：如果是恢复播放，保持之前的currentTime；如果是新播放，从0开始
      if (!isResuming) {
        setCurrentTime((prev) => {
          const newMap = new Map(prev);
          // 如果之前没有记录，则从0开始
          if (!newMap.has(diary.diary_id)) {
            newMap.set(diary.diary_id, 0);
          }
          return newMap;
        });
      }

      // ✅ 监听播放状态更新（进度条组件使用 Animated API 平滑动画，这里只需要更新 currentTime）

      const updateProgress = () => {
        if (!player.isLoaded) {
          // 如果player还未加载，尝试设置duration
          const currentDuration = diary.audio_duration || 0;
          if (currentDuration > 0) {
            setDuration((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(diary.diary_id) || 0;
              if (existing === 0) {
                newMap.set(diary.diary_id, currentDuration);
                return newMap;
              }
              return prev; // 避免不必要的更新
            });
          }
          return;
        }

        // expo-audio 的 currentTime 和 duration 已经是秒为单位
        // ✅ 使用精确的时间值（保留小数），进度条组件会使用 Animated API 平滑更新
        const currentTimeSeconds = player.currentTime;
        const durationSeconds = player.duration;

        // ✅ 频繁更新 currentTime（每次定时器触发都更新），进度条组件会自动平滑动画
        // ✅ 移除阈值检查，让进度条更频繁地更新，确保平滑移动
        setCurrentTime((prev) => {
          const existing = prev.get(diary.diary_id) || 0;
          // ✅ 只在有变化时更新（避免完全相同的值导致的不必要更新）
          if (Math.abs(existing - currentTimeSeconds) > 0.001) {
            const newMap = new Map(prev);
            newMap.set(diary.diary_id, currentTimeSeconds);
            return newMap;
          }
          return prev;
        });

        // 更新总时长（只在变化时更新）
        if (durationSeconds > 0) {
          setDuration((prev) => {
            const existing = prev.get(diary.diary_id) || 0;
            if (existing !== durationSeconds) {
              const newMap = new Map(prev);
              newMap.set(diary.diary_id, durationSeconds);
              return newMap;
            }
            return prev; // 避免不必要的更新
          });
        }
      };

      // 定期更新进度并检查播放状态
      const currentDiaryId = diary.diary_id; // 保存当前diary_id到闭包

      // 清理之前的定时器（如果存在）
      const existingInterval = intervalRefs.current.get(currentDiaryId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      const progressInterval = setInterval(() => {
        // 检查当前播放的音频是否还是这个
        if (!soundRefs.current.has(currentDiaryId)) {
          clearInterval(progressInterval);
          intervalRefs.current.delete(currentDiaryId);
          return;
        }

        // 只在播放时更新进度
        const currentPlayer = soundRefs.current.get(currentDiaryId);
        if (currentPlayer && currentPlayer.playing && !currentPlayer.paused) {
          updateProgress();
        }

        // 检查是否播放完成
        if (
          player.isLoaded &&
          !player.playing &&
          player.currentTime > 0 &&
          player.duration > 0 &&
          Math.abs(player.currentTime - player.duration) < 0.5
        ) {
          clearInterval(progressInterval);
          intervalRefs.current.delete(currentDiaryId);

          setCurrentPlayingId((prev) =>
            prev === currentDiaryId ? null : prev
          );
          soundRefs.current.delete(currentDiaryId);
          player.remove();

          // 重置状态（播放完成后）
          setCurrentTime((prev) => {
            const newMap = new Map(prev);
            newMap.delete(currentDiaryId);
            return newMap;
          });
          setDuration((prev) => {
            const newMap = new Map(prev);
            newMap.delete(currentDiaryId);
            return newMap;
          });
          // ✅ 重置 hasPlayedOnce，恢复到默认状态（隐藏进度条）
          setHasPlayedOnce((prev) => {
            const newSet = new Set(prev);
            newSet.delete(currentDiaryId);
            return newSet;
          });

          console.log("✅ 播放完成");
        }
      }, 50); // ✅ 每 50ms 更新一次 currentTime，进度条组件使用 Animated API 平滑动画

      // 保存定时器引用
      intervalRefs.current.set(currentDiaryId, progressInterval);

      console.log("🎵 开始播放音频:", diary.diary_id);
    } catch (error: any) {
      console.error("❌ 播放失败:", error);
      Alert.alert(
        t("error.playbackFailed"),
        error.message || t("error.retryMessage")
      );
    }
  };

  // ✅ 处理日记操作菜单
  const handleDiaryOptions = (item: Diary) => {
    setSelectedDiary(item);
    setActionSheetVisible(true);
  };

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

  const handleSupportFeedback = async () => {
    const mailto = "mailto:support@thankly.app";
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert(
          t("error.supportUnavailableTitle"),
          t("error.supportUnavailableMessage")
        );
        return;
      }
      await Linking.openURL(mailto);
    } catch (error) {
      console.error("❌ 打开邮件客户端失败:", error);
      Alert.alert(
        t("error.supportUnavailableTitle"),
        t("error.supportUnavailableMessage")
      );
    }
    setProfileMenuVisible(false);
  };

  const handleReminderSettings = () => {
    setProfileMenuVisible(false);
    navigation.navigate("ReminderSettings");
  };

  const handleOpenPrivacyPolicy = () => {
    setProfileMenuVisible(false);
    navigation.navigate("PrivacyPolicy");
  };

  const handleOpenTermsOfService = () => {
    setProfileMenuVisible(false);
    navigation.navigate("TermsOfService");
  };

  const confirmDeleteAccount = () => {
    if (isDeletingAccount) {
      return;
    }

    Alert.alert(
      t("confirm.deleteAccountTitle"),
      t("confirm.deleteAccountMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("confirm.deleteAccountConfirm"),
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      showToast(t("success.accountDeleted"));
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } catch (error: any) {
      console.error("❌ 删除账号失败:", error);
      Alert.alert(
        t("error.deleteAccountTitle"),
        t("error.deleteAccountFailed")
      );
    } finally {
      setIsDeletingAccount(false);
      setProfileMenuVisible(false);
    }
  };

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

  const handleAction = async (action: DiaryAction) => {
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
  };

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
  /**
   * 处理登出
   */
  const handleSignOut = async () => {
    try {
      console.log("🚪 用户登出");
      setProfileMenuVisible(false);

      await signOut();

      // 跳转到登录页
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("登出失败:", error);
    }
  };

  /**
   * 渲染用户菜单
   */
  const renderProfileMenu = () => (
    <Modal
      visible={profileMenuVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setProfileMenuVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setProfileMenuVisible(false)}
      >
        <View style={styles.profileMenuContainer}>
          {/* 用户信息 */}
          {/* 用户信息 - 横向布局 */}

          <View style={styles.profileMenuHeader}>
            {user?.picture ? (
              <Image
                source={{ uri: user.picture }}
                style={styles.profileMenuAvatar}
              />
            ) : (
              <View style={styles.profileMenuAvatar}>
                <AvatarDefault width={32} height={32} />
              </View>
            )}
            <View style={styles.profileMenuInfo}>
              <Text
                style={[styles.profileMenuName, typography.body]}
                numberOfLines={1}
              >
                {user?.name || t("home.anonymousUser")}
              </Text>
              <Text
                style={[styles.profileMenuEmail, typography.caption]}
                numberOfLines={1}
              >
                {user?.email || ""}
              </Text>
            </View>
          </View>

          {/* 分割线 */}
          <View style={styles.profileMenuDivider} />

          {/* Reminder Settings */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleReminderSettings}
            accessibilityLabel={t("home.reminderSettings")}
            accessibilityHint={t("accessibility.button.openSettingsHint")}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.profileMenuItemText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.reminderSettings"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.reminderSettings")}
            </Text>
          </TouchableOpacity>

          {/* Support & Feedback */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleSupportFeedback}
            accessibilityLabel={t("home.supportFeedback")}
            accessibilityHint={t("accessibility.button.supportHint")}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.profileMenuItemText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.supportFeedback"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.supportFeedback")}
            </Text>
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleOpenPrivacyPolicy}
            accessibilityLabel={t("home.privacyPolicy")}
            accessibilityHint={t("accessibility.button.privacyHint")}
            accessibilityRole="button"
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#332824"
            />
            <Text
              style={[
                styles.profileMenuItemText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.privacyPolicy"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.privacyPolicy")}
            </Text>
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleOpenTermsOfService}
            accessibilityLabel={t("home.termsOfService")}
            accessibilityHint={t("accessibility.button.privacyHint")}
            accessibilityRole="button"
          >
            <Ionicons name="document-text-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.profileMenuItemText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.termsOfService"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.termsOfService")}
            </Text>
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            style={[
              styles.profileMenuItem,
              isDeletingAccount && styles.profileMenuItemDisabled,
            ]}
            onPress={confirmDeleteAccount}
            disabled={isDeletingAccount}
            accessibilityLabel={t("home.deleteAccount")}
            accessibilityHint={t("accessibility.button.deleteAccountHint")}
            accessibilityRole="button"
            accessibilityState={{ busy: isDeletingAccount }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text
              style={[
                styles.profileMenuItemTextDanger,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.deleteAccount"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.deleteAccount")}
            </Text>
            {isDeletingAccount && (
              <ActivityIndicator
                size="small"
                color="#FF3B30"
                style={styles.profileMenuLoading}
              />
            )}
          </TouchableOpacity>

          {/* 登出按钮 */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleSignOut}
            accessibilityLabel={t("home.signOut")}
            accessibilityHint={t("accessibility.button.signOutHint")}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.profileMenuItemText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("home.signOut"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("home.signOut")}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
  // ========== 渲染函数 ==========

  /**
   * 渲染顶部用户信息区域
   */
  const renderHeader = () => (
    <View style={styles.header}>
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

        {/* 用户头像按钮 */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => {
            console.log("👆 点击了头像");
            setProfileMenuVisible(true);
          }}
          accessibilityLabel={t("home.profileMenuButton")}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {user?.picture ? (
            // Google用户:显示真实头像
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            // 默认头像:显示 SVG
            <AvatarDefault width={32} height={32} />
          )}
        </TouchableOpacity>
      </View>

      {/* 分割线 */}
      <View style={styles.divider} />

      {/* 我的日记标题 - 仅在列表不为空时显示 */}
      {diaries.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <PreciousMomentsIcon width={20} height={20} />
          <Text
            style={[
              styles.sectionTitle,
              {
                fontFamily: getFontFamilyForText(t("home.myDiary"), "regular"),
              },
            ]}
          >
            {t("home.myDiary")}
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

      const gap = 8;
      const padding = 40; // card padding (20*2)
      const screenWidth = Dimensions.get("window").width;
      const availableWidth = screenWidth - padding - 40; // 40 is list padding
      const baseColumns = 3;
      const rowHeight =
        (availableWidth - (baseColumns - 1) * gap) / baseColumns;

      if (imageUrls.length === 1) {
        return (
          <Pressable
            onPress={(event) => {
              event?.stopPropagation?.();
              setImagePreviewUrls(imageUrls);
              setImagePreviewIndex(0);
              setImagePreviewVisible(true);
            }}
          >
            <Image
              source={{ uri: imageUrls[0] }}
              style={{
                width: availableWidth,
                height: rowHeight,
                borderRadius: 12,
                backgroundColor: "#f0f0f0",
              }}
              resizeMode="cover"
            />
          </Pressable>
        );
      }

      if (imageUrls.length === 2) {
        const imageWidth = (availableWidth - gap) / 2;
        return (
          <View style={{ flexDirection: "row", gap }}>
            {imageUrls.slice(0, 2).map((url, imgIndex) => (
              <Pressable
                key={imgIndex}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  setImagePreviewUrls(imageUrls);
                  setImagePreviewIndex(imgIndex);
                  setImagePreviewVisible(true);
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: imageWidth,
                    height: rowHeight,
                    borderRadius: 12,
                    backgroundColor: "#f0f0f0",
                  }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        );
      }

      const numColumns = imageUrls.length > 3 ? 4 : 3;
      const imageSize = (availableWidth - (numColumns - 1) * gap) / numColumns;
      const maxItems = numColumns;
      const shouldShowBadge = imageUrls.length > maxItems;
      const displayCount = shouldShowBadge ? maxItems : imageUrls.length;

      if (!shouldShowBadge) {
        return (
          <>
            {imageUrls.slice(0, displayCount).map((url, imgIndex) => (
              <Pressable
                key={imgIndex}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  setImagePreviewUrls(imageUrls);
                  setImagePreviewIndex(imgIndex);
                  setImagePreviewVisible(true);
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: imageSize,
                    height: imageSize,
                    borderRadius: 8,
                    backgroundColor: "#f0f0f0",
                  }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </>
        );
      }

      const previewImages = imageUrls.slice(0, maxItems);
      return (
        <>
          {previewImages.slice(0, 3).map((url, imgIndex) => (
            <Pressable
              key={imgIndex}
              onPress={(event) => {
                event?.stopPropagation?.();
                setImagePreviewUrls(imageUrls);
                setImagePreviewIndex(imgIndex);
                setImagePreviewVisible(true);
              }}
            >
              <Image
                source={{ uri: url }}
                style={{
                  width: imageSize,
                  height: imageSize,
                  borderRadius: 8,
                  backgroundColor: "#f0f0f0",
                }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
          <Pressable
            onPress={(event) => {
              event?.stopPropagation?.();
              setImagePreviewUrls(imageUrls);
              setImagePreviewIndex(3);
              setImagePreviewVisible(true);
            }}
            style={[
              styles.moreBadge,
              {
                width: imageSize,
                height: imageSize,
                borderRadius: 8,
              },
            ]}
          >
            <Image
              source={{ uri: previewImages[3] }}
              style={styles.moreBadgeImage}
              resizeMode="cover"
            />
            <View style={styles.moreBadgeOverlay} />
            <Text
              style={[
                styles.moreText,
                {
                  fontFamily: getFontFamilyForText(
                    `+${imageUrls.length - maxItems}`,
                    "regular"
                  ),
                },
              ]}
            >
              +{imageUrls.length - maxItems}
            </Text>
          </Pressable>
        </>
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
        {/* 纯图片日记：只显示图片 */}
        {isImageOnly ? (
          <>
            {/* 图片缩略图 */}
            {item.image_urls && item.image_urls.length > 0 && (
              <View
                style={[styles.imageGrid, { marginTop: 0, marginBottom: 0 }]}
              >
                {renderImageGrid(item.image_urls)}
              </View>
            )}
          </>
        ) : (
          <>
            {/* 标题 */}
            {item.title && item.title.trim() !== "" && (
              <Text
                style={[
                  styles.cardTitle,
                  {
                    fontFamily: titleFontFamily,
                    fontWeight: isChineseTitle ? "700" : "600",
                    fontSize: isChineseTitle ? 16 : 18,
                    lineHeight: isChineseTitle ? 26 : 24,
                  },
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            )}

            {/* 内容预览 */}
            {contentText && contentText.trim() !== "" && (
              <Text
                style={[
                  styles.cardContent,
                  {
                    fontFamily: contentFontFamily,
                    fontSize: isChineseContent ? 16 : 16, // ✅ 中文字号从 14 增加到 16
                    lineHeight: isChineseContent ? 28 : 24, // ✅ 中文行高 28px
                  },
                ]}
                numberOfLines={3}
              >
                {contentText}
              </Text>
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
          onSeek={(seekTime) => {
            const player = soundRefs.current.get(item.diary_id);
            if (player && player.isLoaded) {
              setCurrentTime((prev) => {
                const newMap = new Map(prev);
                newMap.set(item.diary_id, seekTime);
                return newMap;
              });
              setHasPlayedOnce((prev) => {
                const newSet = new Set(prev);
                newSet.add(item.diary_id);
                return newSet;
              });
              player.seekTo(seekTime);
            }
          }}
          style={styles.audioButton}
        />

        {/* 日期 + 三点菜单图标 - 移到底部 */}
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
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
          styles.emptyText,
          {
            fontFamily: getFontFamilyForText(t("home.noDiaries"), "regular"),
          },
        ]}
      >
        {t("home.noDiaries")}
      </Text>
    </View>
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
          <FlatList
            data={diaries}
            renderItem={({ item, index }) => renderDiaryCard({ item, index })}
            keyExtractor={(item) => item.diary_id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
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

      {/* ✅ 新增:用户菜单 */}
      {renderProfileMenu()}

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

      {/* 全屏图片预览 */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => setImagePreviewVisible(false)}
            accessibilityLabel={t("common.close")}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <FlatList
            ref={imagePreviewListRef}
            data={imagePreviewUrls}
            keyExtractor={(item, idx) => `${item}-${idx}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={imagePreviewIndex}
            getItemLayout={(_, index) => ({
              length: Dimensions.get("window").width,
              offset: Dimensions.get("window").width * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const width = Dimensions.get("window").width;
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setImagePreviewIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View style={styles.imagePreviewSlide}>
                <Image
                  source={{ uri: item }}
                  style={styles.imagePreviewImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {imagePreviewUrls.length > 1 && (
            <Text style={styles.imagePreviewCounter}>
              {imagePreviewIndex + 1} / {imagePreviewUrls.length}
            </Text>
          )}
        </View>
      </Modal>

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
 * 例: 2025-01-15T14:30:25.123Z → 1月15日 14:30
 */
function formatDateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  if (Number.isNaN(date.getTime())) {
    return dateTimeString;
  }

  const locale = getCurrentLocale();
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  const formatter = new Intl.DateTimeFormat(localeTag, {
    month: locale === "zh" ? "numeric" : "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const formatted = formatter.format(date);
  return locale === "en" ? formatted.replace(",", "") : formatted;
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
    paddingTop: 48,
    paddingBottom: 12,
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
    marginTop: 24,
    marginBottom: 8,
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
    color: "#666",
  },

  profileButton: {
    padding: 6, // 增加 padding 确保点击区域至少 44x44pt (32 + 6*2 = 44)
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ 新增:头像相关样式
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 32,
    backgroundColor: "#F0F0F0",
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
    borderRadius: 16,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    // ✅ 自然轻盈的弥散投影
    shadowColor: "#FFEDE0",
    shadowOffset: {
      width: 0,
      height: 4, // 轻微向下偏移，营造自然浮起感
    },
    shadowOpacity: 1, // 半透明，保持轻盈感
    shadowRadius: 10, // 较大的模糊半径，营造弥散效果
    elevation: 3, // Android 阴影（数值较小，保持轻盈）
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0, // ⬅️ 调整这里：控制时间区域距离上方内容的间距
    paddingTop: 0, // ⬅️ 调整这里：控制时间区域内部的上间距
    paddingBottom: 0, // ⬅️ 调整这里：控制时间区域内部的下间距
    // 分割线已移除
  },

  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardDate: {
    ...Typography.caption,
    color: "#666",
    //marginLeft: 6,
  },

  cardTitle: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 8,
  },

  optionsButton: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 0, // 右对齐，减少右边距
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  cardContent: {
    ...Typography.body,
    color: "#1A1A1A",
    marginBottom: 0, // 图片区域统一用 imageGrid 的上边距控制
    textAlign: "left", // ✅ 左对齐，改善中文标点符号显示
  },

  // 图片网格样式
  imageGrid: {
    flexDirection: "row",
    marginTop: 8, // ✅ 与两张图的视觉间距对齐
    marginBottom: 4,
    gap: 8,
  },
  imageThumbnail: {
    width: (Dimensions.get("window").width - 80) / 3.3, // 3张缩略图 + 间距
    height: (Dimensions.get("window").width - 80) / 3.3,
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
    fontSize: 16,
    fontWeight: "600",
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
    paddingHorizontal: 64,
    marginTop: 40,
  },

  emptyIconContainer: {
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    ...Typography.caption,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
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
    marginTop: 8,
    marginBottom: 0,
  },
  imageGridWithAudio: {
    marginTop: 8,
    marginBottom: 8,
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
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
