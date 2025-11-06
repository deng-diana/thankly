/**
 * 录音 Modal 组件
 *
 * 功能:
 * - 友好的录音动画
 * - 实时时长显示
 * - 暂停/继续/完成控制
 */
import { ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Alert } from "react-native";
import { createVoiceDiary } from "../services/diaryService";
import { updateDiary } from "../services/diaryService";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  TextInput,
  KeyboardAvoidingView, // ✅ 添加这个
  Platform, // ✅ 添加这个
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import AudioPlayer from "../components/AudioPlayer";
const { width } = Dimensions.get("window");

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";
import { Typography } from "../styles/typography";

interface RecordingModalProps {
  visible: boolean;
  onSuccess: () => void; // ✅ 录音成功后回调
  onCancel: () => void; // ✅ 取消录音回调
}

export default function RecordingModal({
  visible,
  onSuccess,
  onCancel,
}: RecordingModalProps) {
  // ✅ 动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // ✅ 录音状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nearLimit, setNearLimit] = useState(false); // 9分钟预警状态

  // ✅ 新增:处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // ✅ 新增:目标进度(我们要到达的进度)
  const [targetProgress, setTargetProgress] = useState(0);

  // ✅ 新增:平滑动画定时器
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 优化步骤时长：更合理的分配，减少卡顿
  // 🎯 策略：前面的步骤稍快，后面的步骤稍慢，总体更流畅
  const processingSteps = [
    { icon: "📤", text: t("diary.processingSteps.upload"), duration: 800, progress: 20 }, // 20% - 快速上传
    { icon: "👂", text: t("diary.processingSteps.listen"), duration: 3000, progress: 50 }, // 30% - 转录（最耗时）
    { icon: "✨", text: t("diary.processingSteps.polish"), duration: 2000, progress: 70 }, // 20% - 润色
    { icon: "💭", text: t("diary.processingSteps.title"), duration: 1200, progress: 85 }, // 15% - 标题
    { icon: "💬", text: t("diary.processingSteps.feedback"), duration: 1200, progress: 100 }, // 15% - 反馈
  ];

  /**
   * 平滑更新进度条
   *
   * 📚 学习:这个函数让进度条像扶梯一样平滑上升
   *
   * @param target - 目标进度(0-100)
   * @param speed - 速度(每次增加多少,默认0.5)
   */
  // ✅ 使用 Animated API 实现更平滑的进度动画
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  // ✅ 使用 ref 保存当前进度值，确保跨步骤连续性
  const currentProgressRef = useRef(0);

  /**
   * 平滑更新进度条（简化版 - 确保不倒退）
   * 
   * 🎯 核心原则：
   * 1. 进度值只能增加，不能减少
   * 2. 从当前动画值继续，而不是从状态值
   * 3. 使用 ref 保存当前值，确保跨步骤连续性
   */
  const smoothUpdateProgress = useCallback(
    (target: number, duration: number = 800) => {
      // ✅ 确保目标值不小于当前值
      const safeTarget = Math.max(target, currentProgressRef.current);
      
      console.log(`🎯 更新进度: ${currentProgressRef.current}% → ${safeTarget}% (时长: ${duration}ms)`);

      // 停止之前的动画（但不重置值）
      progressAnimValue.stopAnimation();
      
      // 清理之前的监听器
      if (progressAnimationRef.current) {
        if (typeof progressAnimationRef.current === 'object' && progressAnimationRef.current.cancel) {
          progressAnimationRef.current.cancel();
        }
        progressAnimationRef.current = null;
      }

      setTargetProgress(safeTarget);

      // ✅ 关键：从 ref 保存的当前值开始，而不是从状态或动画值
      // 这样可以确保跨步骤的连续性
      const startValue = currentProgressRef.current;
      progressAnimValue.setValue(startValue);

      // 使用 Animated API 实现平滑过渡
      const animation = Animated.timing(progressAnimValue, {
        toValue: safeTarget,
        duration: duration,
        easing: Easing.out(Easing.quad), // 使用简单的缓出曲线，更平滑
        useNativeDriver: false,
      });

      // 使用监听器实时更新状态和 ref
      const listenerId = progressAnimValue.addListener(({ value }) => {
        // ✅ 确保值只增不减
        const clampedValue = Math.max(currentProgressRef.current, Math.min(100, value));
        currentProgressRef.current = clampedValue;
        setProcessingProgress(clampedValue);
      });

      // 启动动画
      animation.start((finished) => {
        if (finished) {
          // 动画完成，确保最终值
          currentProgressRef.current = safeTarget;
          setProcessingProgress(safeTarget);
        }
        // 移除监听器
        progressAnimValue.removeListener(listenerId);
      });

      // 保存清理函数
      progressAnimationRef.current = {
        cancel: () => {
          animation.stop();
          progressAnimValue.removeListener(listenerId);
        }
      } as any;
    },
    [progressAnimValue]
  );

  // ✅ 新增:结果预览状态
  const [showResult, setShowResult] = useState(false);
  const [resultDiary, setResultDiary] = useState<any>(null);

  // ✅ 新增:编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false); // ✅ 添加修改检测

  // ✅ 新增:音频播放状态(用于结果页)
  const [isPlayingResult, setIsPlayingResult] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultDuration, setResultDuration] = useState(0);
  const [hasPlayedResultOnce, setHasPlayedResultOnce] = useState(false); // ✅ 是否曾经播放过
  const resultSoundRef = useRef<Audio.Sound | null>(null);
  const resultProgressIntervalRef = useRef<NodeJS.Timeout | null>(null); // ✅ 进度更新定时器

  // ✅ 新增:保存状态保护 - 防止重复调用
  const isSavingRef = useRef(false);

  // ✅ 轻量 Toast（与删除成功保持一致样式）
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  };

  // ✅ 录音相关 Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const isStartingRef = useRef<boolean>(false);
  const hasShown9MinWarning = useRef<boolean>(false); // ✅ 防止重复弹窗
  const startedAtRef = useRef<number | null>(null); // 录音开始时间戳

  // ✅ 新增:Modal 进入/退出动画
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current; // 从下方300px开始

  // ✅ 新增:手势拖动
  const dragY = useRef(new Animated.Value(0)).current;

  // ✅ 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // ✅ 录音动画
  useEffect(() => {
    if (!(isRecording && !isPaused)) return;

    // 匀速呼吸
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    // 一个无延时、匀速的波纹循环（0->3，然后瞬时归零）
    const loopWave = (val: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 3,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }), // 归零
        ]),
        { resetBeforeIteration: true }
      );

    // 先确保初始值
    pulseAnim.setValue(1);
    waveAnim1.setValue(0);
    waveAnim2.setValue(0);
    waveAnim3.setValue(0);

    breathe.start();

    // wave1 立即开始；wave2/3 仅在“启动时”错峰一次，之后由 native 循环保持相位稳定
    const w1 = loopWave(waveAnim1);
    w1.start();

    const t2 = setTimeout(() => {
      const w2 = loopWave(waveAnim2);
      w2.start();
    }, 400);
    const t3 = setTimeout(() => {
      const w3 = loopWave(waveAnim3);
      w3.start();
    }, 1000);

    return () => {
      // 清理 & 复位，避免下次从中途继续
      breathe.stop();
      w1.stop();
      clearTimeout(t2);
      clearTimeout(t3);
      // 复位动画值
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
    };
  }, [isRecording, isPaused]);

  // ✅ Modal 进入/退出动画
  useEffect(() => {
    if (visible) {
      // 进入动画
      Animated.parallel([
        // 遮罩淡入
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease), // ✅ 添加缓动
          useNativeDriver: true,
        }),
        // 卡片滑上来
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic), // ✅ 使用 cubic 更自然
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 退出动画
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease), // ✅ 添加缓动
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          easing: Easing.in(Easing.cubic), // ✅ 使用 cubic
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // 提前声明，供手势回调使用
  async function handleCancelRecording() {
    try {
      // ✅ 安全地清理录音对象
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          // 只有当录音对象还存在时才卸载
          if (
            status.canRecord ||
            status.isRecording ||
            status.isDoneRecording
          ) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch (e) {
          console.log("清理录音对象时出错(可忽略):", e);
        }
        recordingRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // ✅ 重置所有状态
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setIsProcessing(false);
      setShowResult(false);
      setResultDiary(null);
      setNearLimit(false);
      isStartingRef.current = false;
      hasShown9MinWarning.current = false;
      startedAtRef.current = null;

      console.log("❌ 录音已取消");
      onCancel();
    } catch (error) {
      console.error("取消录音失败:", error);
      // ✅ 即使出错也要重置状态
      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      isStartingRef.current = false;
      onCancel();
    }
  }

  // ✅ 手势拖动处理
  // ✅ 新的手势 API
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // 只允许向下拖动
      if (event.translationY > 0) {
        dragY.setValue(event.translationY);
      }
    })
    .onEnd((event) => {
      // 拖动距离超过100px 或 快速向下滑动
      if (event.translationY > 100 || event.velocityY > 500) {
        // 关闭 Modal
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dragY, {
            toValue: 300,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          handleCancelRecording();
          dragY.setValue(0);
        });
      } else {
        // 弹回原位
        Animated.spring(dragY, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }).start();
      }
    });

  // ✅ Modal 打开时自动开始录音
  useEffect(() => {
    if (visible && !isRecording && !isProcessing && !showResult) {
      // ✅ 延迟一下,避免和关闭动画冲突
      const timer = setTimeout(() => {
        startRecording();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ✅ 组件卸载时清理
  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
          }
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          // ✅ 新增:清理结果页音频
          if (resultSoundRef.current) {
            await resultSoundRef.current.unloadAsync();
            resultSoundRef.current = null;
          }
          
          // ✅ 清理进度更新定时器
          if (resultProgressIntervalRef.current) {
            clearInterval(resultProgressIntervalRef.current);
            resultProgressIntervalRef.current = null;
          }
        } catch (_) {}
      })();

      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, []);

  // ========== 录音相关函数 ==========

  /**
   * 请求录音权限
   */
  const requestAudioPermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t("error.audioPermissionDenied"),
          t("error.audioPermissionMessage")
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("请求权限失败:", error);
      return false;
    }
  };

  /**
   * 开始录音
   */
  const startRecording = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      // 清理之前的录音对象
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (_) {}
        recordingRef.current = null;
      }

      // 清理定时器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log("🎤 开始录音...");
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = newRecording;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setNearLimit(false);
      hasShown9MinWarning.current = false;
      startedAtRef.current = Date.now();

      // 开始计时
      const interval = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const seconds = Math.floor(status.durationMillis / 1000);
              setDuration(seconds);

              // ✅ 9分钟预警（还剩1分钟）
              if (seconds >= 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                setNearLimit(true);
                
                // 轻触反馈（iOS）
                if (Platform.OS === "ios") {
                  try {
                    const Haptics = await import("expo-haptics");
                    await Haptics.default.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (e) {
                    console.log("Haptics 不可用:", e);
                  }
                }
              }

              // ✅ 10分钟自动停止
              if (seconds >= 600) {
                setNearLimit(false);
                await handleFinishRecording();
              }
            }
          }
        } catch (error) {
          console.error("获取录音状态失败:", error);
        }
      }, 1000);

      durationIntervalRef.current = interval;
    } catch (error) {
      console.error("❌ 录音失败:", error);
      Alert.alert(t("error.genericError"), t("error.recordingFailed"));
      onCancel();
    } finally {
      isStartingRef.current = false;
    }
  };

  /**
   * 暂停录音
   */
  const handlePauseRecording = async () => {
    if (!recordingRef.current) return;

    try {
      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording) {
        console.log("录音未在进行中");
        return;
      }

      await recordingRef.current.pauseAsync();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      console.log("⏸ 录音已暂停");
    } catch (error) {
      console.error("暂停失败:", error);
    }
  };

  /**
   * 继续录音
   */
  const handleResumeRecording = async () => {
    if (!recordingRef.current) return;

    try {
      const status = await recordingRef.current.getStatusAsync();

      if (status.isRecording) {
        console.log("录音已在进行中");
        return;
      }

      if (status.isDoneRecording) {
        console.log("录音已完成，无法继续");
        return;
      }

      await recordingRef.current.startAsync();
      setIsPaused(false);

      // 重启定时器
      const interval = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const seconds = Math.floor(status.durationMillis / 1000);
              setDuration(seconds);

              // ✅ 9分钟预警（还剩1分钟）
              if (seconds >= 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                setNearLimit(true);
                
                // 轻触反馈（iOS）
                if (Platform.OS === "ios") {
                  try {
                    const Haptics = await import("expo-haptics");
                    await Haptics.default.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (e) {
                    console.log("Haptics 不可用:", e);
                  }
                }
              }

              // ✅ 10分钟自动停止
              if (seconds >= 600) {
                setNearLimit(false);
                await handleFinishRecording();
              }
            }
          }
        } catch (error) {
          console.error("获取录音状态失败:", error);
        }
      }, 1000);

      durationIntervalRef.current = interval;

      console.log("▶️ 继续录音");
    } catch (error) {
      console.error("恢复录音失败:", error);
    }
  };

  /**
   * 完成录音
   */
  const handleFinishRecording = async () => {
    if (!recordingRef.current) {
      console.log("录音对象不存在");
      return;
    }

    try {
      console.log("✅ 完成录音");

      // 获取URI
      const uri = recordingRef.current.getURI();
      console.log("录音文件URI:", uri);

      // 清理定时器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // 停止录音
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      const recordedDuration = Math.floor(duration);
      console.log("录音时长:", recordedDuration, "秒");

      // ✅ 检查录音时长(最短3秒)
      if (recordedDuration < 3) {
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);

        Alert.alert(t("confirm.hint"), t("diary.shortRecordingHint"), [
          {
            text: t("diary.resumeRecording"),
            style: "default",
            onPress: () => startRecording(),
          },
          {
            text: t("common.cancel"),
            style: "cancel",
            onPress: () => onCancel(),
          },
        ]);
        return;
      }

      // 显示处理中
      setIsProcessing(true);
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);

      // ✅ 启动步骤动画
      const cleanupSteps = simulateProcessingSteps();

      try {
        // 调用后端API
        const diary = await createVoiceDiary(uri!, recordedDuration);
        console.log("✅ 后端返回成功");

        // ✅ 优化：如果后端提前完成，平滑推进到100%
        // 🎨 苹果风格：无论何时完成，都平滑过渡到100%
        if (processingProgress < 100) {
          console.log(`⏳ 后端提前完成，当前进度${processingProgress}%，平滑推进到100%`);

          // ✅ 使用更快的动画（500ms）快速到达100%
          smoothUpdateProgress(100, 500);
          
          // ✅ 等待动画完成（略长于动画时长，确保流畅）
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        // ✅ 停止模拟
        cleanupSteps && cleanupSteps();

        console.log("✅ 日记创建成功:", diary);

        // ✅ 显示结果预览页
        setIsProcessing(false);
        setResultDiary(diary);
        setShowResult(true);

        // 🔍 调试：打印完整的AI反馈
        console.log("✅ 显示结果预览");
        console.log("📊 AI反馈完整内容：");
        console.log(`  长度: ${diary.ai_feedback?.length || 0} 字符`);
        console.log(`  内容: "${diary.ai_feedback}"`);
        console.log(`  标题: "${diary.title}"`);
      } catch (error: any) {
        // ✅ 停止模拟（错误时）
        cleanupSteps && cleanupSteps();
        console.error("❌ 处理失败:", error);

        // ✅ 检查是否是空内容错误（EMPTY_TRANSCRIPT）
        if (error.code === "EMPTY_TRANSCRIPT" || 
            (error.message && (
              error.message.includes("No valid speech detected") ||
              error.message.includes("空内容") ||
              error.message.includes("未能识别到") ||
              error.message.includes("识别到的内容过短") ||
              error.message.includes("检测到的内容过于简单") ||
              error.message.includes("检测到的内容主要是语气词") ||
              error.message.includes("检测到的内容只包含标点符号") ||
              error.message.includes("未能识别到任何语音内容")
            ))) {
          // 空内容错误：只提供"重录"选项
          Alert.alert(
            t("error.emptyRecording.title"),
            t("error.emptyRecording.message"),
            [
              {
                text: t("common.rerecord"),
                onPress: () => {
                  setIsProcessing(false);
                  startRecording();
                },
              },
            ]
          );
          return;
        }

        // 其他错误
        let errorMessage = t("error.retryMessage");
        if (error.message) {
          errorMessage = error.message;
        }

        Alert.alert(t("error.genericError"), errorMessage, [
          {
            text: t("common.retry"),
            onPress: () => {
              setIsProcessing(false);
              startRecording();
            },
          },
          {
            text: t("common.cancel"),
            style: "cancel",
            onPress: () => onCancel(),
          },
        ]);
      }
    } catch (error) {
      console.error("完成录音失败:", error);
      Alert.alert(t("error.genericError"), t("error.recordingFailed"));
      onCancel();
    }
  };

  /**
   * 模拟处理步骤和进度（优化版 - 更平滑，无卡顿）
   * 
   * 🎨 苹果风格优化：
   * 1. 使用连续的进度值（20%, 50%, 70%, 85%, 100%）而不是均匀分配
   * 2. 每个步骤的动画时长根据实际处理时间动态调整
   * 3. 步骤之间无缝衔接，避免在 20%、40%、60% 卡顿
   */
  function simulateProcessingSteps() {
    // ✅ 重置所有状态和动画值
    setProcessingStep(0);
    setProcessingProgress(0);
    currentProgressRef.current = 0; // 重置 ref
    progressAnimValue.setValue(0); // 重置动画值

    const totalSteps = processingSteps.length;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    let accumulatedTime = 0;

    processingSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        console.log(`📍 步骤 ${index + 1}/${totalSteps}: ${step.text} (目标: ${step.progress}%)`);
        setProcessingStep(index);

        // ✅ 动画时长 = 步骤时长，确保动画完成时步骤也完成
        // ✅ 使用步骤中定义的进度值
        smoothUpdateProgress(step.progress, step.duration);
      }, accumulatedTime);

      stepTimers.push(timer);
      accumulatedTime += step.duration;
    });

    // ✅ 返回清理函数
    return () => {
      console.log("🧹 清理步骤定时器");
      stepTimers.forEach((timer) => clearTimeout(timer));

      // ✅ 停止所有动画
      progressAnimValue.stopAnimation();
      
      // ✅ 清理进度动画
      if (progressAnimationRef.current) {
        // 如果是对象（新的格式），调用 cancel
        if (typeof progressAnimationRef.current === 'object' && progressAnimationRef.current.cancel) {
          progressAnimationRef.current.cancel();
        } else {
          // 如果是旧的格式（定时器），清理
          clearInterval(progressAnimationRef.current as any);
        }
        progressAnimationRef.current = null;
      }
    };
  }

  // ========== 结果预览相关函数 ==========

  /**
   * 播放结果页的音频
   */
  const handlePlayResultAudio = async () => {
    if (!resultDiary?.audio_url) return;

    try {
      // 如果正在播放,则暂停
      if (isPlayingResult) {
        if (resultSoundRef.current) {
          await resultSoundRef.current.pauseAsync();
          setIsPlayingResult(false);
          // ✅ 暂停时不清除定时器，保持 currentTime 不变（和日记列表页保持一致）
        }
        return;
      }
      
      // ✅ 恢复播放
      if (resultSoundRef.current) {
        await resultSoundRef.current.playAsync();
        setIsPlayingResult(true);
        return;
      }

      // 停止之前的音频
      if (resultSoundRef.current) {
        await resultSoundRef.current.unloadAsync();
        resultSoundRef.current = null;
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 创建音频播放器
      const { sound } = await Audio.Sound.createAsync(
        { uri: resultDiary.audio_url },
        { shouldPlay: true }
      );

      resultSoundRef.current = sound;
      setIsPlayingResult(true);
      setHasPlayedResultOnce(true); // ✅ 标记为已播放过，显示倒计时

      // ✅ 初始化 duration（优先使用数据库中的 audio_duration）
      const initialDuration = resultDiary.audio_duration || 0;
      if (initialDuration > 0) {
        setResultDuration(initialDuration);
      }

      // ✅ 初始化 currentTime 为 0
      setResultCurrentTime(0);

      // ✅ 清理之前的定时器
      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
        resultProgressIntervalRef.current = null;
      }

      // ✅ 使用定时器定期更新进度（和日记列表页保持一致）
      resultProgressIntervalRef.current = setInterval(async () => {
        try {
          if (!resultSoundRef.current) {
            clearInterval(resultProgressIntervalRef.current!);
            resultProgressIntervalRef.current = null;
            return;
          }

          const status = await resultSoundRef.current.getStatusAsync();
          
          if (status.isLoaded) {
            const durationMillis = status.durationMillis;
            const positionMillis = status.positionMillis;

            // ✅ 更新总时长（只在变化时更新）
            if (durationMillis !== undefined && durationMillis > 0) {
              const durationSeconds = Math.floor(durationMillis / 1000);
              setResultDuration((prev) => {
                if (prev !== durationSeconds) {
                  return durationSeconds;
                }
                return prev;
              });
            }

            // ✅ 更新当前时间（实时更新，确保倒计时正常显示）
            if (positionMillis !== undefined) {
              const currentTimeSeconds = Math.floor(positionMillis / 1000);
              setResultCurrentTime((prev) => {
                // 只在时间变化时更新（减少不必要的渲染）
                if (Math.abs(prev - currentTimeSeconds) >= 1) {
                  return currentTimeSeconds;
                }
                return prev;
              });
            }

            // ✅ 检查播放完成
            if (status.didJustFinish) {
              clearInterval(resultProgressIntervalRef.current!);
              resultProgressIntervalRef.current = null;
              setIsPlayingResult(false);
              setResultCurrentTime(0);
              await sound.unloadAsync();
              resultSoundRef.current = null;
            }
          }
        } catch (error) {
          console.error("❌ 更新播放进度失败:", error);
        }
      }, 100); // ✅ 每100ms更新一次（和日记列表页保持一致）

      // 监听播放状态（用于检测暂停等状态变化）
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying) {
          // 如果暂停了，不需要做任何事，定时器会继续更新currentTime
          // 这样暂停时也能保持当前时间不变
        }
      });

      console.log("🎵 播放结果音频");
    } catch (error: any) {
      console.error("❌ 播放失败:", error);
      Alert.alert(
        t("error.playbackFailed"),
        error.message || t("error.retryMessage")
      );
    }
  };

  /**
   * 保存并关闭
   */
  const handleSaveAndClose = async () => {
    // ✅ 防止重复调用
    if (isSavingRef.current) {
      console.log("⏳ 正在保存中，跳过重复调用");
      return;
    }

    isSavingRef.current = true;

    try {
      console.log("💾 保存日记...");

      // ✅ 检查是否有修改 - 使用实际值比较（更可靠）
      if (resultDiary) {
        const hasTitleChange = isEditingTitle && editedTitle.trim() !== resultDiary.title;
        const hasContentChange = isEditingContent && editedContent.trim() !== resultDiary.polished_content;

        if (hasTitleChange || hasContentChange) {
          console.log("📝 更新日记到后端:", resultDiary.diary_id);
          console.log("  - 标题变化:", hasTitleChange);
          console.log("  - 内容变化:", hasContentChange);

          await updateDiary(
            resultDiary.diary_id,
            hasContentChange ? editedContent.trim() : undefined,
            hasTitleChange ? editedTitle.trim() : undefined
          );
          console.log("✅ 后端更新成功");
        } else {
          console.log("📝 没有修改，跳过更新");
        }
      }

      // ✅ 清理音频播放相关资源
      if (resultSoundRef.current) {
        resultSoundRef.current.unloadAsync().catch(console.log);
        resultSoundRef.current = null;
      }
      
      // ✅ 清理进度更新定时器
      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
        resultProgressIntervalRef.current = null;
      }

      // 重置所有状态
      setShowResult(false);
      setResultDiary(null);
      setIsPlayingResult(false);
      setResultCurrentTime(0);
      setResultDuration(0);
      setHasPlayedResultOnce(false); // ✅ 重置播放状态
      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle("");
      setEditedContent("");
      setHasChanges(false);

      // ✅ 显示成功 Toast
      showToast(t("success.diaryCreated"));

      // ✅ 短暂延迟让用户看到 Toast
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 通知父组件刷新列表
      onSuccess();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
    } finally {
      isSavingRef.current = false;
    }
  };

  /**
   * 开始编辑标题
   */
  const startEditingTitle = () => {
    setEditedTitle(resultDiary.title);
    setIsEditingTitle(true);
  };

  /**
   * 开始编辑内容
   */
  const startEditingContent = () => {
    setEditedContent(resultDiary.polished_content);
    setIsEditingContent(true);
  };

  /**
   * 完成编辑 - 自动保存并关闭
   */
  const finishEditing = async () => {
    try {
      console.log("✅ 编辑完成,开始保存...");

      // ✅ 直接保存到后端并关闭（handleSaveAndClose会处理实际的API调用）
      await handleSaveAndClose();
    } catch (error) {
      console.error("❌ 保存失败:", error);
      Alert.alert(t("error.saveFailed"), t("error.retryMessage"));
    }
  };

  /**
   * 取消编辑
   */
  const cancelEditing = () => {
    setIsEditingTitle(false);
    setIsEditingContent(false);
    setEditedTitle("");
    setEditedContent("");
    setHasChanges(false);
    console.log("❌ 取消编辑");
  };

  /**
   * 格式化日期时间
   */
  const formatDateTime = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    if (Number.isNaN(date.getTime())) {
      return dateTimeString;
    }

    const locale = getCurrentLocale();
    const localeTag = locale === "zh" ? "zh-CN" : "en-US";

    const formatter = new Intl.DateTimeFormat(localeTag, {
      month: locale === "zh" ? "numeric" : "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const formatted = formatter.format(date);
    return locale === "en" ? formatted.replace(",", "") : formatted;
  };

  // ========== 渲染函数 ==========

  /**
   * 渲染录音视图
   */
  const renderRecordingView = () => (
    <>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancelRecording}
          style={styles.closeButton}
        >
          <Ionicons name="close-outline" size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.title}>{t("diary.voiceEntry")}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 录音动画区域 */}
      <View style={styles.animationArea}>
        {isProcessing ? (
          <View
            style={styles.processingCenter}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t("accessibility.status.processing", {
              step: processingStep + 1,
            })}
          >
            <View style={styles.processingContent}>
              {/* 当前步骤 */}
              <View style={styles.currentStepContainer}>
                <Text style={styles.stepEmoji}>
                  {processingSteps[processingStep]?.icon}
                </Text>
                <Text style={styles.currentStepText}>
                  {processingSteps[processingStep]?.text}
                </Text>
              </View>

              {/* 进度条和百分比 */}
              <View style={styles.progressSection}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${processingProgress}%` },
                    ]}
                  />
                </View>
                <Text
                  style={styles.progressText}
                  accessibilityLabel={`${t("accessibility.status.processing")}, ${Math.round(processingProgress)}%`}
                >
                  {Math.round(processingProgress)}%
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {isRecording && !isPaused && (
              <>
                <Animated.View
                  style={[
                    styles.wave,
                    {
                      transform: [{ scale: waveAnim1 }],
                      opacity: waveAnim1.interpolate({
                        inputRange: [0, 3],
                        outputRange: [0.7, 0],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.wave,
                    {
                      transform: [{ scale: waveAnim2 }],
                      opacity: waveAnim2.interpolate({
                        inputRange: [0, 3],
                        outputRange: [0.7, 0],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.wave,
                    {
                      transform: [{ scale: waveAnim3 }],
                      opacity: waveAnim3.interpolate({
                        inputRange: [0, 3],
                        outputRange: [0.7, 0],
                      }),
                    },
                  ]}
                />
              </>
            )}

            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Ionicons
                name={isPaused ? "pause" : "mic"}
                size={44}
                color="#E56C45"
              />
            </Animated.View>

            <Text style={styles.statusText}>
              {isPaused ? t("diary.pauseRecording") : nearLimit ? t("recording.nearLimit") : ""}
            </Text>

            <View style={styles.timeRow}>
              <Text style={styles.durationText}>{formatTime(duration)}</Text>
              <Text style={styles.maxDuration}> / 10:00</Text>
            </View>
          </>
        )}
      </View>

      {/* 底部控制按钮 */}
      <View style={styles.controls}>
        {isProcessing ? (
          <View style={{ height: 72 }} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelRecording}
              accessibilityLabel={t("common.cancel")}
              accessibilityHint={t("accessibility.button.cancelHint")}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={isPaused ? handleResumeRecording : handlePauseRecording}
              accessibilityLabel={
                isPaused
                  ? t("createVoiceDiary.resumeRecording")
                  : t("createVoiceDiary.pauseRecording")
              }
              accessibilityHint={
                isPaused
                  ? t("accessibility.button.recordHint")
                  : t("accessibility.button.stopHint")
              }
              accessibilityRole="button"
              accessibilityState={{ selected: !isPaused }}
            >
              <Ionicons
                name={isPaused ? "play" : "pause"}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleFinishRecording}
              accessibilityLabel={t("common.done")}
              accessibilityHint={t("accessibility.button.continueHint")}
              accessibilityRole="button"
            >
              <Text style={styles.finishText}>{t("common.done")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );

  /**
   * 渲染结果页的Header
   */
  const renderResultHeader = () => {
    const isEditing = isEditingTitle || isEditingContent;

    return (
      <View style={styles.resultHeader}>
        {/* 左侧按钮 */}
        <TouchableOpacity
          onPress={isEditing ? cancelEditing : handleCancelRecording}
          style={styles.resultHeaderButton}
          accessibilityLabel={isEditing ? t("common.cancel") : t("common.close")}
          accessibilityHint={t("accessibility.button.closeHint")}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isEditing ? (
            <Text style={styles.resultHeaderButtonText}>
              {t("common.cancel")}
            </Text>
          ) : (
            <Ionicons name="close-outline" size={24} color="#666" />
          )}
        </TouchableOpacity>

        {/* 中间标题 */}
        <Text style={styles.resultHeaderTitle}>
          {isEditing ? t("common.edit") : t("diary.yourEntry")}
        </Text>

        {/* 右侧按钮 */}
        {isEditing ? (
          <TouchableOpacity
            onPress={finishEditing}
            style={styles.resultHeaderButton}
            accessibilityLabel={t("common.done")}
            accessibilityHint={t("accessibility.button.saveHint")}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.resultHeaderButtonText,
                styles.resultHeaderSaveText,
              ]}
            >
              {t("common.done")}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.resultHeaderButton} />
        )}
      </View>
    );
  };
  /**
   * 渲染结果预览视图
   */
  const renderResultView = () => {
    if (!resultDiary) return null;

    return (
      <>
        {/* ✅ 新增:顶部Header */}
        {renderResultHeader()}

        {/* 可滚动内容 - 包裹键盘避让 */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <ScrollView
            style={styles.resultScrollView}
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* 音频播放器 */}
            {resultDiary.audio_url && (
              <AudioPlayer
                audioUrl={resultDiary.audio_url}
                audioDuration={resultDiary.audio_duration}
                isPlaying={isPlayingResult}
                currentTime={resultCurrentTime}
                totalDuration={resultDuration}
                hasPlayedOnce={hasPlayedResultOnce} // ✅ 传入 hasPlayedOnce，显示倒计时
                onPlayPress={handlePlayResultAudio}
                style={styles.resultAudioPlayer}
              />
            )}

            {/* 标题和内容卡片 */}
            <View style={styles.resultDiaryCard}>
              {/* 标题 */}
              {isEditingTitle ? (
                <TextInput
                  style={styles.editTitleInput}
                  value={editedTitle}
                  onChangeText={(text) => {
                    setEditedTitle(text);
                    // ✅ 检测标题是否有变化
                    setHasChanges(text.trim() !== resultDiary.title);
                  }}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderTitle")}
                  scrollEnabled={false} // ✅ 让外层ScrollView处理滚动
                  accessibilityLabel={t("diary.placeholderTitle")}
                  accessibilityHint={t("accessibility.input.textHint")}
                  accessibilityRole="text"
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingTitle}
                  activeOpacity={0.7}
                  accessibilityLabel={resultDiary.title}
                  accessibilityHint={t("accessibility.button.editHint")}
                  accessibilityRole="button"
                >
                  <Text style={styles.resultTitleText}>
                    {resultDiary.title}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 内容 */}
              {isEditingContent ? (
                <TextInput
                  style={styles.editContentInput}
                  value={editedContent}
                  onChangeText={(text) => {
                    setEditedContent(text);
                    // ✅ 检测内容是否有变化
                    setHasChanges(text.trim() !== resultDiary.polished_content);
                  }}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderContent")}
                  scrollEnabled={true} // ✅ 让外层ScrollView处理滚动
                  accessibilityLabel={t("diary.placeholderContent")}
                  accessibilityHint={t("accessibility.input.textHint")}
                  accessibilityRole="text"
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingContent}
                  activeOpacity={0.7}
                  accessibilityLabel={resultDiary.polished_content.substring(0, 100) + (resultDiary.polished_content.length > 100 ? "..." : "")}
                  accessibilityHint={t("accessibility.button.editHint")}
                  accessibilityRole="button"
                >
                  <Text style={styles.resultContentText}>
                    {resultDiary.polished_content}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AI反馈 - 编辑时隐藏 */}
            {!isEditingTitle &&
              !isEditingContent &&
              !!resultDiary?.ai_feedback && (
                <View style={styles.resultFeedbackCard}>
                  <View style={styles.resultFeedbackHeader}>
                    <Ionicons name="sparkles" size={18} color="#E56C45" />
                    <Text style={styles.resultFeedbackTitle}>
                      {t("diary.aiFeedbackTitle")}
                    </Text>
                  </View>
                  <Text
                    style={styles.resultFeedbackText}
                    numberOfLines={0}
                    ellipsizeMode="clip"
                  >
                    {resultDiary.ai_feedback}
                  </Text>
                </View>
              )}

            {/* 底部间距 */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 底部保存按钮 */}
        <View style={styles.resultBottomBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAndClose}
            accessibilityLabel={t("diary.saveToJournal")}
            accessibilityHint={t("accessibility.button.saveHint")}
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>
              {t("diary.saveToJournal")}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onCancel}
      >
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={showResult ? undefined : handleCancelRecording}
          />

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.modal,
                {
                  transform: [{ translateY: Animated.add(slideAnim, dragY) }],
                },
              ]}
            >
              {/* ✅ 根据状态显示不同内容 */}
              {showResult ? renderResultView() : renderRecordingView()}

              {/* Toast 提示 - 使用全屏容器确保居中 */}
              {toastVisible && (
                <View style={styles.toastOverlay} pointerEvents="none">
                  <View style={styles.toastContainer}>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    minHeight: 640,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    //borderBottomWidth: 1,
    //borderBottomColor: "#F0F0F0",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    ...Typography.sectionTitle,
    color: "#1A1A1A",
  },
  headerRight: {
    width: 36,
  },
  animationArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  wave: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFE8E0",
  },
  iconContainer: {
    position: "absolute", // ✅ 添加:绝对定位
    width: 96,
    height: 96,
    borderRadius: 48,
    //backgroundColor: "#FFF5F8",
    alignItems: "center",
    justifyContent: "center",
    //marginBottom: 40,
  },
  statusText: {
    ...Typography.body,
    color: "#666",
    marginBottom: 8,
    marginTop: 140, // ✅ 添加上边距,避开波纹区域
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline", // 对齐基线
  },
  durationText: {
    ...Typography.sectionTitle,
    color: "#E56C45", // ✅ 高亮红色
    fontVariant: ["tabular-nums"],
  },
  maxDuration: {
    ...Typography.sectionTitle,
    color: "#999",
    marginTop: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  cancelButton: {
    padding: 20,
  },
  cancelText: {
    ...Typography.body,
    color: "#E56C45", // 主题色
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButton: {
    padding: 20,
  },
  finishText: {
    ...Typography.body,
    color: "#E56C45",
  },
  // ===== 结果预览视图样式 =====
  headerLeft: {
    width: 36,
  },
  resultScrollView: {
    flex: 1,
  },
  resultScrollContent: {
    paddingBottom: 20,
  },

  resultAudioPlayer: {
    marginHorizontal: 20,
    marginTop: 16, // ✅ 增加顶部间距
    marginBottom: 12,
  },
  resultDiaryCard: {
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },

  resultTitleText: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  resultContentText: {
    ...Typography.body,
    lineHeight: 26,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },
  resultFeedbackCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  resultFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  resultFeedbackTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: "#E56C45",
    marginLeft: 6,
  },
  resultFeedbackText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: "#1A1A1A",
  },
  resultBottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: "#E56C45",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    ...Typography.body,
    color: "#fff",
  },

  editTitleInput: {
    ...Typography.diaryTitle,
    color: "#1A1A1A",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  editContentInput: {
    ...Typography.body,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 200, // ✅ 增加最小高度
    maxHeight: 400, // ✅ 限制最大高度
    textAlignVertical: "top",
  },
  // ===== 结果页Header =====
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20, // ✅ 增加顶部间距(原来是12)
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "transparent",
  },
  resultHeaderButton: {
    minWidth: 44,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  resultHeaderButtonText: {
    ...Typography.body,
    color: "#666",
  },
  resultHeaderTitle: {
    ...Typography.body,
    color: "#1A1A1A",
  },
  resultHeaderSaveText: {
    ...Typography.body,
    color: "#E56C45",
  },

  // ===== Toast（iOS）与列表删除一致 =====
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
    ...Typography.caption,
    color: "#fff",
  },
  // ===== 处理中UI =====
  processingCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  processingContent: {
    width: "100%",
    maxWidth: 260,
    alignItems: "center",
  },
  currentStepContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24, // ✅ 减小间距
  },
  stepEmoji: {
    fontSize: 24, // ✅ 缩小图标
    marginRight: 10,
  },
  currentStepText: {
    ...Typography.body,
    color: "#1A1A1A",
  },
  progressSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // ✅ 减小间距
  },
  progressBarBg: {
    flex: 1,
    height: 6, // ✅ 增加粗细
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#E56C45",
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: "#666",
    width: 45, // ✅ 固定宽度,防止换行
    textAlign: "right",
  },
});
