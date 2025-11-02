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
import { Typography } from "../styles/typography";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image, // ← 添加这个
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
  ToastAndroid,
} from "react-native";

// import * as Clipboard from "expo-clipboard"; // TODO: 安装expo-clipboard
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

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";

/**
 * 获取用户头像首字母
 * 规则：如果首字母是数字或全是数字，显示 "U"
 * 否则显示首字母
 */
const getUserInitial = (name?: string, email?: string): string => {
  // 优先使用姓名
  if (name) {
    // 移除数字，获取首字母
    const cleanName = name.replace(/[0-9]/g, "");
    if (cleanName.length > 0) {
      return cleanName.charAt(0).toUpperCase();
    }
    // 如果姓名全是数字，检查原始姓名
    if (/^[0-9]+$/.test(name)) {
      return "U";
    }
  }

  // 如果姓名不可用，使用邮箱
  if (email) {
    const emailPrefix = email.split("@")[0];
    // 如果邮箱前缀全是数字，显示 "U"
    if (/^[0-9]+$/.test(emailPrefix)) {
      return "U";
    }
    // 如果邮箱前缀首字母是数字，显示 "U"
    if (/^[0-9]/.test(emailPrefix)) {
      return "U";
    }
    // 否则显示首字母
    return emailPrefix.charAt(0).toUpperCase();
  }

  // 默认返回 "U"
  return "U";
};

// import * as ImagePicker from "expo-image-picker"; // ✅ 新增：图片选择器（稍后安装）
import {
  getCurrentUser,
  User,
  signOut,
  startAutoRefresh,
} from "../services/authService";
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
}

/**
 * 日记列表页面组件
 */
export default function DiaryListScreen() {
  // ✅ 添加navigation
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // ========== 状态管理 ==========

  // 用户信息
  const [user, setUser] = useState<User | null>(null);

  // ✅ 新增:用户菜单状态
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

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
  const soundRefs = useRef<Map<string, ExpoAudioPlayer>>(new Map()); // 存储多个音频播放器

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

  const [greeting, setGreeting] = useState(
    `${t("home.welcome")} — ${t("home.subtitle")} ✨ `
  );

  // ========== 生命周期 ==========
  useEffect(() => {
    loadGreeting();
  }, []);

  async function loadGreeting() {
    // 检查是否首次登录
    const hasLoggedInBefore = await SecureStore.getItemAsync(
      "hasLoggedInBefore"
    );
    const isFirstTime = !hasLoggedInBefore;

    // 检测用户语言
    const locales = Localization.getLocales();
    const userLocale =
      locales.length > 0 && locales[0]?.languageCode
        ? locales[0].languageCode
        : "en";
    const language = userLocale.startsWith("zh") ? "zh" : "en";

    console.log("📍 用户语言:", userLocale, "→ 使用:", language);

    // 获取问候语
    const message = getGreeting(isFirstTime, language);
    setGreeting(message);

    // 标记已登录过
    if (isFirstTime) {
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
  }, []);

  /**
   * 页面获得焦点时自动刷新数据
   * 用于处理从创建日记页面返回时刷新列表
   */
  useFocusEffect(
    React.useCallback(() => {
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

      // 统计音频数量
      const audioCount = response.filter((diary) => diary.audio_url).length;
      console.log("✅ 日记加载成功:", {
        total: response.length,
        withAudio: audioCount,
        withoutAudio: response.length - audioCount,
      });

      setDiaries(response);
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
    await loadData();
    setRefreshing(false);
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
    Alert.alert(t("home.imageFeatureTitle"), t("home.imageFeatureMessage"));
    // TODO: 实现图片上传功能
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
    setSelectedDiaryForDetail(diary);
    setDiaryDetailVisible(true);
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

          // 清理旧音频的状态（保持进度用于恢复播放）
          // 注意：不删除progress，用户可能想继续播放
        }
      }

      console.log("🎵 创建音频播放器:", diary.audio_url);

      // 使用 createAudioPlayer 创建播放器（自动加载并准备音频）
      const player = createAudioPlayer(diary.audio_url!, {
        updateInterval: 100, // 每100ms更新一次状态
      });

      // expo-audio 会自动加载音频，直接播放即可
      // 如果音频未加载完成，play() 会自动等待
      player.play();

      console.log("✅ 音频播放器创建成功");

      soundRefs.current.set(diary.diary_id, player);
      setCurrentPlayingId(diary.diary_id);

      // 监听播放状态更新
      const updateProgress = () => {
        if (player.isLoaded) {
          // expo-audio 的 currentTime 和 duration 已经是秒为单位
          const currentTimeSeconds = Math.floor(player.currentTime);
          const durationSeconds = Math.floor(player.duration);

          setCurrentTime((prev) => {
            const newMap = new Map(prev);
            newMap.set(diary.diary_id, currentTimeSeconds);
            return newMap;
          });

          setDuration((prev) => {
            const newMap = new Map(prev);
            newMap.set(diary.diary_id, durationSeconds);
            return newMap;
          });
        }
      };

      // 定期更新进度并检查播放状态
      const progressInterval = setInterval(() => {
        if (currentPlayingId !== diary.diary_id) {
          // 如果切换了音频，清理这个定时器
          clearInterval(progressInterval);
          return;
        }

        if (player.isLoaded) {
          // 更新进度
          if (player.playing && !player.paused) {
            updateProgress();
          }

          // 检查是否播放完成
          // expo-audio 的 currentTime 和 duration 是秒为单位
          if (
            !player.playing &&
            player.currentTime > 0 &&
            player.duration > 0 &&
            Math.abs(player.currentTime - player.duration) < 0.5 // 允许0.5秒误差
          ) {
            clearInterval(progressInterval);
            setCurrentPlayingId(null);
            soundRefs.current.delete(diary.diary_id);
            player.remove();

            // 重置状态
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

            console.log("✅ 播放完成");
          }
        }
      }, 100); // 每100ms更新一次

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

  type DiaryAction = "edit" | "copyEntry" | "delete";

  const handleAction = (action: DiaryAction) => {
    setActionSheetVisible(false);

    if (!selectedDiary) return;

    switch (action) {
      case "edit":
        Alert.alert(t("confirm.hint"), t("home.editUnavailable"));
        break;
      case "copyEntry":
        Alert.alert(t("confirm.hint"), t("home.copyUnavailable"));
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
      Alert.alert(
        t("error.genericError"),
        error.message || t("error.deleteFailed")
      );
    }
  };

  // ✅ 渲染自定义 Action Sheet
  const renderActionSheet = () => {
    if (!selectedDiary) return null;

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
            {/* 操作列表 */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => handleAction("edit")}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color="#333"
                style={styles.actionIcon}
              />
              <Text style={styles.actionText}>{t("home.editEntry")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => handleAction("copyEntry")}
            >
              <Ionicons
                name="copy-outline"
                size={20}
                color="#333"
                style={styles.actionIcon}
              />
              <Text style={styles.actionText}>{t("home.copyEntry")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetItem, styles.deleteAction]}
              onPress={() => handleAction("delete")}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#FF3B30"
                style={styles.actionIcon}
              />
              <Text style={[styles.actionText, styles.deleteText]}>
                {t("common.delete")}
              </Text>
            </TouchableOpacity>

            {/* 取消按钮 */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
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
              <View style={styles.profileMenuInitial}>
                <Text style={styles.profileMenuInitialText}>
                  {getUserInitial(user?.name, user?.email)}
                </Text>
              </View>
            )}
            <View style={styles.profileMenuInfo}>
              <Text style={styles.profileMenuName} numberOfLines={1}>
                {user?.name || t("home.anonymousUser")}
              </Text>
              <Text style={styles.profileMenuEmail} numberOfLines={1}>
                {user?.email || ""}
              </Text>
            </View>
          </View>

          {/* 分割线 */}
          <View style={styles.profileMenuDivider} />

          {/* 登出按钮 */}
          <TouchableOpacity
            style={styles.profileMenuItem}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.profileMenuItemTextDanger}>
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
          <Text style={styles.greetingBold}>{t("home.welcome")}</Text>
          <Text style={styles.greetingLight}>{t("home.subtitle")}</Text>
        </View>

        {/* 用户头像按钮 */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => {
            console.log("👆 点击了头像");
            setProfileMenuVisible(true);
          }}
        >
          {user?.picture ? (
            // Google用户:显示真实头像
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            // Apple用户或无头像:显示首字母
            <View style={styles.profileInitial}>
              <Text style={styles.initialText}>
                {getUserInitial(user?.name, user?.email)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 我的日记标题 */}
      <Text style={styles.sectionTitle}>{t("home.myDiary")}</Text>
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
  const renderDiaryCard = ({ item }: { item: Diary }) => {
    // 格式化日期和时间显示
    const displayDate = formatDateTime(item.created_at);

    return (
      <TouchableOpacity
        style={styles.diaryCard}
        onPress={() => handleDiaryPress(item)}
        activeOpacity={0.7}
      >
        {/* 日期 + 三点菜单图标 */}
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.cardDate}>{displayDate}</Text>
          </View>

          {/* 三点菜单图标 */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation(); // 阻止事件冒泡，避免触发整个卡片的点击
              handleDiaryOptions(item);
            }}
            style={styles.optionsButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* AI生成的标题 */}
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {/* 日记内容 */}
        <Text style={styles.cardContent} numberOfLines={3}>
          {item.polished_content}
        </Text>

        {/* ✅ 使用统一的音频播放器组件 */}
        <AudioPlayer
          audioUrl={item.audio_url}
          audioDuration={item.audio_duration}
          isPlaying={currentPlayingId === item.diary_id}
          currentTime={currentTime.get(item.diary_id) || 0}
          totalDuration={
            duration.get(item.diary_id) || item.audio_duration || 0
          }
          onPlayPress={() => handlePlayAudio(item)}
          style={styles.audioButton}
        />
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
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyTitle}>{t("home.noDiaries")}</Text>
      <Text style={styles.emptyText}>{t("home.noDiariesHint")}</Text>
    </View>
  );

  // ========== 主渲染 ==========

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 正在加载时显示骨架屏 */}
      {loading ? (
        renderSkeleton()
      ) : (
        <>
          {/* 日记列表 */}
          <FlatList
            data={diaries}
            renderItem={renderDiaryCard}
            keyExtractor={(item) => item.diary_id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#D96F4C"
              />
            }
            showsVerticalScrollIndicator={false}
          />

          {/* 底部操作栏 */}
          <View style={styles.bottomActionBar}>
            {/* 图片上传按钮 */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleImageUpload}
              activeOpacity={0.7}
            >
              <ImageInputIcon width={36} height={36} fill={"#332824"} />
            </TouchableOpacity>

            {/* 录音按钮 - 主按钮 */}
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleVoiceRecord}
              activeOpacity={0.8}
            >
              <Ionicons name="mic" size={26} color="#fff" />
            </TouchableOpacity>

            {/* 文字输入按钮 */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTextInput}
              activeOpacity={0.7}
            >
              <TextInputIcon width={36} height={36} fill={"#332824"} />
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
        onSuccess={handleRecordingSuccess}
        onCancel={handleRecordingCancel}
      />

      {/* ✅ 新增:文字输入Modal */}
      <TextInputModal
        visible={textInputModalVisible}
        onSuccess={handleTextInputSuccess}
        onCancel={handleTextInputCancel}
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

      {/* iOS 轻量 Toast 提示 - 使用全屏容器确保居中 */}
      {Platform.OS === "ios" && toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
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
 * - 主色调: #D96F4C (粉红色,温暖友好)
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
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 12,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  greetingContainer: {
    flex: 1,
    marginRight: 12,
  },

  greetingBold: {
    ...Typography.diaryTitle,
    color: "#1A1A1A",
    marginBottom: 2,
  },

  greetingLight: {
    ...Typography.caption,
    color: "#666",
  },

  profileButton: {
    padding: 4,
  },

  // ✅ 新增:头像相关样式
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
  },

  profileInitial: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFEBF1", // 浅粉色背景
    borderWidth: 1,
    borderColor: "#FF98BA", // 描边颜色
    alignItems: "center",
    justifyContent: "center",
  },

  initialText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#D96F4C", // 品牌色文字
  },
  // ===== 标题 =====
  sectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 18,
    color: "#1A1A1A",
    marginTop: 32,
    marginBottom: 0,
  },

  // ===== 日记卡片 =====
  diaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardDate: {
    ...Typography.caption,
    color: "#666",
    marginLeft: 6,
  },

  cardTitle: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 8,
  },

  optionsButton: {
    padding: 5,
  },

  cardContent: {
    ...Typography.body,
    color: "#1A1A1A",
    marginBottom: 12,
  },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
  },

  aiFeedbackContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  aiFeedback: {
    flex: 1,
    fontSize: 14,
    color: "#D96F4C",
    marginLeft: 6,
    lineHeight: 20,
  },

  // ===== 空状态 =====
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },

  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },

  emptyTitle: {
    ...Typography.diaryTitle,
    fontSize: 20,
    color: "#1A1A1A",
    marginBottom: 8,
  },

  emptyText: {
    ...Typography.caption,
    color: "#666",
    textAlign: "center",
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
    backgroundColor: "#D96F4C",
    alignItems: "center",
    justifyContent: "center",

    // 更明显的阴影
    shadowColor: "#D96F4C",
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
    paddingTop: 8,
  },

  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
  },

  headerIcon: {
    marginRight: 12,
    marginTop: 2,
  },

  headerTextContainer: {
    flex: 1,
  },

  actionSheetTitle: {
    ...Typography.sectionTitle,
    fontSize: 17,
    color: "#1A1A1A",
    marginBottom: 4,
  },

  actionSheetMessage: {
    ...Typography.caption,
    fontSize: 13,
    color: "#666",
  },

  actionSheetDivider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginHorizontal: 20,
    marginVertical: 8,
  },

  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 20,
  },

  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 8,
  },

  actionIcon: {
    marginRight: 16,
    width: 20,
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
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 8,
    alignItems: "center",
  },

  cancelText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
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

  // ===== 底部操作栏（胶囊效果）=====
  bottomActionBar: {
    position: "absolute",
    bottom: 32, // 距离底部的间距
    left: 64, // 增加左右间距，减少宽度
    right: 64,
    //borderWidth:1,
    borderColor: "#F2F2F2",
    backgroundColor: "#fff",
    borderRadius: 200, // 全圆角
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly", // 均匀分布，居中显示
    paddingVertical: 8, // 降低高度
    paddingHorizontal: 0, // 增加内边距
    shadowColor: "#D96F4C",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  actionButton: {
    width: 44, // 缩小按钮尺寸
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  recordButton: {
    width: 48, // 缩小录音按钮
    height: 56,
    borderRadius: 28, // 对应调整圆角
    backgroundColor: "#D96F4C", // 使用主题色
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D96F4C",
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
    width: 40,
    height: 40,
    borderRadius: 30,
    backgroundColor: "#F0F0F0",
    marginRight: 12,
  },

  profileMenuInitial: {
    width: 40,
    height: 40,
    borderRadius: 30,
    backgroundColor: "#FFEBF1", // 浅粉色背景
    borderWidth: 1,
    borderColor: "#FF98BA", // 描边颜色
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  profileMenuInitialText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#D96F4C", // 品牌色文字
  },

  profileMenuName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
    overflow: "hidden",
  },

  profileMenuEmail: {
    fontSize: 13,
    color: "#666",
    overflow: "hidden",
  },

  profileMenuDivider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginHorizontal: 16,
  },

  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 20,
  },

  profileMenuItemTextDanger: {
    fontSize: 16,
    color: "#FF3B30",
    marginLeft: 12,
  },
});
