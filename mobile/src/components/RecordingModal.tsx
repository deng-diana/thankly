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

  // ✅ 新增:处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // ✅ 新增:目标进度(我们要到达的进度)
  const [targetProgress, setTargetProgress] = useState(0);

  // ✅ 新增:平滑动画定时器
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  const processingSteps = [
    { icon: "📤", text: t("diary.processingSteps.upload"), duration: 1500 },
    { icon: "👂", text: t("diary.processingSteps.listen"), duration: 4000 },
    { icon: "✨", text: t("diary.processingSteps.polish"), duration: 3000 },
    { icon: "💭", text: t("diary.processingSteps.title"), duration: 2000 },
    { icon: "💬", text: t("diary.processingSteps.feedback"), duration: 2000 },
  ];

  /**
   * 平滑更新进度条
   *
   * 📚 学习:这个函数让进度条像扶梯一样平滑上升
   *
   * @param target - 目标进度(0-100)
   * @param speed - 速度(每次增加多少,默认0.5)
   */
  /**
   * 平滑更新进度条(带持续爬升)
   */
  const smoothUpdateProgress = useCallback(
    (target: number, speed: number = 0.8) => {
      console.log(`🎯 目标: ${target}%`);

      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
      }

      setTargetProgress(target);

      progressAnimationRef.current = setInterval(() => {
        setProcessingProgress((current) => {
          // 快速增长阶段:还没到目标
          if (current < target - 1) {
            const diff = target - current;
            const step = Math.min(speed, diff);
            return current + step;
          }

          // 慢速爬升阶段:接近或到达目标
          if (current < target) {
            // 最后1%用慢速
            return current + 0.2;
          }

          // 微增长阶段:超过目标后继续慢慢爬
          if (current < 99) {
            return current + 0.05; // ✅ 极慢速度持续增长
          }

          // 到达99%,停止
          if (progressAnimationRef.current) {
            clearInterval(progressAnimationRef.current);
            progressAnimationRef.current = null;
          }
          return current;
        });
      }, 40);
    },
    []
  );

  // ✅ 新增:结果预览状态
  const [showResult, setShowResult] = useState(false);
  const [resultDiary, setResultDiary] = useState<any>(null);

  // ✅ 新增:编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");

  // ✅ 新增:音频播放状态(用于结果页)
  const [isPlayingResult, setIsPlayingResult] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultDuration, setResultDuration] = useState(0);
  const resultSoundRef = useRef<Audio.Sound | null>(null);

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
      isStartingRef.current = false;
      hasShown9MinWarning.current = false;

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
      hasShown9MinWarning.current = false;

      // 开始计时
      const interval = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const seconds = Math.floor(status.durationMillis / 1000);
              setDuration(seconds);

              // ✅ 9分钟预警
              if (seconds === 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                Alert.alert(t("confirm.hint"), t("confirm.timeLimit"), [
                  {
                    text: t("diary.resumeRecording"),
                    style: "default",
                  },
                  {
                    text: t("common.done"),
                    style: "default",
                    onPress: () => handleFinishRecording(),
                  },
                ]);
              }

              // ✅ 10分钟自动停止
              if (seconds >= 600) {
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

              // 9分钟预警
              if (seconds === 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                Alert.alert(t("confirm.hint"), t("confirm.timeLimit"), [
                  {
                    text: t("diary.resumeRecording"),
                    style: "default",
                  },
                  {
                    text: t("common.done"),
                    style: "default",
                    onPress: () => handleFinishRecording(),
                  },
                ]);
              }

              // 10分钟自动停止
              if (seconds >= 600) {
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

        // 如果进度小于100%,等待动画完成
        // currentProgress 报错的原因是：这个变量没有定义。
        // 这个地方其实想用 processingProgress，它是 useState 里的进度条状态。
        if (processingProgress < 100) {
          console.log(`⏳ 当前进度${processingProgress}%,等待到100%`);

          // 快速推进到100%
          smoothUpdateProgress(100, 2.0);
          // 等待2秒让动画完成
          await new Promise((resolve) => setTimeout(resolve, 2000));
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

        // ✅ 检查是否是空内容错误
        if (
          error.message &&
          (error.message.includes("空内容") ||
            error.message.includes("未能识别到") ||
            error.message.includes("识别到的内容过短") ||
            error.message.includes("检测到的内容过于简单") ||
            error.message.includes("检测到的内容主要是语气词") ||
            error.message.includes("检测到的内容只包含标点符号") ||
            error.message.includes("未能识别到任何语音内容"))
        ) {
          Alert.alert(t("confirm.hint"), t("diary.noVoiceDetected"), [
            {
              text: t("diary.startRecording"),
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

        // 其他错误
        let errorMessage = t("error.retryMessage");
        if (error.message) {
          errorMessage = error.message;
        }

        Alert.alert(t("error.genericError"), errorMessage, [
          {
            text: t("common.retry"),
            onPress: () => startRecording(),
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
   * 模拟处理步骤和进度
   */
  function simulateProcessingSteps() {
    setProcessingStep(0);
    setProcessingProgress(0);

    const totalSteps = processingSteps.length;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    let accumulatedTime = 0;

    processingSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        console.log(`📍 步骤 ${index + 1}/${totalSteps}: ${step.text}`);
        setProcessingStep(index);

        // 平滑更新进度
        const targetProgress = ((index + 1) / totalSteps) * 100;
        smoothUpdateProgress(targetProgress, 0.8); // 速度调快一点
      }, accumulatedTime);

      stepTimers.push(timer);
      accumulatedTime += step.duration;
    });

    // ✅ 返回清理函数
    return () => {
      console.log("🧹 清理步骤定时器");
      stepTimers.forEach((timer) => clearTimeout(timer));

      // ✅ 清理进度动画
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
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
        }
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

      // 监听播放状态
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const durationMillis = status.durationMillis;
          const positionMillis = status.positionMillis;

          if (durationMillis !== undefined && positionMillis !== undefined) {
            setResultCurrentTime(Math.floor(positionMillis / 1000));
            setResultDuration(Math.floor(durationMillis / 1000));
          }

          // 播放完成
          if (status.didJustFinish) {
            setIsPlayingResult(false);
            setResultCurrentTime(0);
            sound.unloadAsync();
            resultSoundRef.current = null;
          }
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
    try {
      console.log("💾 保存日记...");

      // ✅ 如果用户编辑了内容或标题,先调用后端API更新
      if (resultDiary && (editedTitle.trim() || editedContent.trim())) {
        const finalContent =
          editedContent.trim() || resultDiary.polished_content;
        const finalTitle = editedTitle.trim() || resultDiary.title;

        console.log("📝 更新日记到后端:", resultDiary.diary_id);
        console.log("  - 标题:", finalTitle);
        console.log("  - 内容:", finalContent.substring(0, 50) + "...");

        await updateDiary(
          resultDiary.diary_id,
          finalContent !== resultDiary.polished_content
            ? finalContent
            : undefined,
          finalTitle !== resultDiary.title ? finalTitle : undefined
        );
        console.log("✅ 后端更新成功");
      }

      // 清理音频
      if (resultSoundRef.current) {
        resultSoundRef.current.unloadAsync().catch(console.log);
        resultSoundRef.current = null;
      }

      // 重置所有状态
      setShowResult(false);
      setResultDiary(null);
      setIsPlayingResult(false);
      setResultCurrentTime(0);
      setResultDuration(0);
      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle("");
      setEditedContent("");

      // ✅ 显示与列表删除一致风格的轻量 Toast
      showToast(t("success.diaryCreated"));

      // 通知父组件刷新列表
      onSuccess();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
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
      // ✅ 更新本地 resultDiary
      if (isEditingTitle && editedTitle.trim()) {
        resultDiary.title = editedTitle.trim();
      }
      if (isEditingContent && editedContent.trim()) {
        resultDiary.polished_content = editedContent.trim();
      }

      setIsEditingTitle(false);
      setIsEditingContent(false);

      console.log("✅ 编辑完成,开始保存...");

      // ✅ 直接保存到后端并关闭
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
          <View style={styles.processingCenter}>
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
                <Text style={styles.progressText}>
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
                color="#D96F4C"
              />
            </Animated.View>

            <Text style={styles.statusText}>
              {isPaused ? t("diary.pauseRecording") : ""}
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
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={isPaused ? handleResumeRecording : handlePauseRecording}
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
                  onChangeText={setEditedTitle}
                  onBlur={finishEditing}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderTitle")}
                  scrollEnabled={false} // ✅ 让外层ScrollView处理滚动
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingTitle}
                  activeOpacity={0.7}
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
                  onChangeText={setEditedContent}
                  onBlur={finishEditing}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderContent")}
                  scrollEnabled={true} // ✅ 让外层ScrollView处理滚动
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingContent}
                  activeOpacity={0.7}
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
                    <Ionicons name="sparkles" size={18} color="#D96F4C" />
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
    color: "#D96F4C", // ✅ 高亮红色
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
    color: "#999",
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#D96F4C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D96F4C",
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
    color: "#D96F4C",
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
    color: "#D96F4C",
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
    backgroundColor: "#D96F4C",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#D96F4C",
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
    borderColor: "#D96F4C",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  editContentInput: {
    ...Typography.body,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#D96F4C",
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
    color: "#D96F4C",
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
    backgroundColor: "#D96F4C",
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: "#666",
    width: 45, // ✅ 固定宽度,防止换行
    textAlign: "right",
  },
});
