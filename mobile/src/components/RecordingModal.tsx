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
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Alert } from "react-native";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import {
  createVoiceDiary,
  createVoiceDiaryStream,
  deleteDiary,
  ProgressCallback,
} from "../services/diaryService";
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
import { Typography, getFontFamilyForText } from "../styles/typography";
import ProcessingModal from "./ProcessingModal";
import VoiceRecordingPanel from "./VoiceRecordingPanel";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";

interface RecordingModalProps {
  visible: boolean;
  onSuccess: () => void; // ✅ 录音成功后回调
  onCancel: () => void; // ✅ 取消录音回调
  onDiscard?: () => void; // ✅ 删除未保存日记后回调
  imageUrls?: string[]; // ✅ 新增：图片URL列表
}

export default function RecordingModal({
  visible,
  onSuccess,
  onCancel,
  onDiscard,
  imageUrls,
}: RecordingModalProps) {
  const KEEP_AWAKE_TAG = "recording-modal-session";

  // ✅ 动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // ✅ 使用自定义 Hook 管理录音逻辑
  const {
    isRecording,
    isPaused,
    duration,
    isStarting,
    nearLimit,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording();

  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ 新增:处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // ✅ 新增:目标进度(我们要到达的进度)
  const [targetProgress, setTargetProgress] = useState(0);

  // ✅ 新增:平滑动画定时器
  const progressAnimationRef = useRef<{ cancel: () => void } | null>(null);

  // ✅ 优化步骤时长：更合理的分配，减少卡顿
  // 🎯 策略：前面的步骤稍快，后面的步骤稍慢，总体更流畅
  const processingSteps = [
    {
      icon: "📤",
      text: t("diary.processingSteps.upload"),
      duration: 800,
      progress: 20,
    }, // 20% - 快速上传
    {
      icon: "👂",
      text: t("diary.processingSteps.listen"),
      duration: 3000,
      progress: 50,
    }, // 30% - 转录（最耗时）
    {
      icon: "✨",
      text: t("diary.processingSteps.polish"),
      duration: 2000,
      progress: 70,
    }, // 20% - 润色
    {
      icon: "💭",
      text: t("diary.processingSteps.title"),
      duration: 1200,
      progress: 85,
    }, // 15% - 标题
    {
      icon: "💬",
      text: t("diary.processingSteps.feedback"),
      duration: 1200,
      progress: 100,
    }, // 15% - 反馈
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
    (target: number, duration?: number) => {
      // ✅ 确保目标值不小于当前值
      const safeTarget = Math.max(target, currentProgressRef.current);
      const currentValue = currentProgressRef.current;
      const progressDiff = safeTarget - currentValue;

      // ✅ 智能计算动画时长：根据进度跳跃大小动态调整
      // 小跳跃（<5%）：快速更新（300ms）
      // 中跳跃（5-20%）：中等速度（600ms）
      // 大跳跃（>20%）：慢速平滑（1000ms）
      let calculatedDuration = duration;
      if (calculatedDuration === undefined) {
        if (progressDiff < 5) {
          calculatedDuration = 300; // 小跳跃：快速
        } else if (progressDiff < 20) {
          calculatedDuration = 600; // 中跳跃：中等
        } else {
          calculatedDuration = 1000; // 大跳跃：慢速平滑
        }
      }

      console.log(
        `🎯 更新进度: ${currentValue}% → ${safeTarget}% (跳跃: ${progressDiff}%, 时长: ${calculatedDuration}ms)`
      );

      // 停止之前的动画（但不重置值）
      progressAnimValue.stopAnimation();

      // 清理之前的监听器
      if (progressAnimationRef.current) {
        if (
          typeof progressAnimationRef.current === "object" &&
          progressAnimationRef.current.cancel
        ) {
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
      // 使用更平滑的缓动函数，让大跳跃也能平滑过渡
      const animation = Animated.timing(progressAnimValue, {
        toValue: safeTarget,
        duration: calculatedDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // 使用贝塞尔曲线，更平滑自然
        useNativeDriver: false,
      });

      // 使用监听器实时更新状态和 ref
      const listenerId = progressAnimValue.addListener(({ value }) => {
        // ✅ 确保值只增不减
        const clampedValue = Math.max(
          currentProgressRef.current,
          Math.min(100, value)
        );
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
        },
      } as any;
    },
    [progressAnimValue]
  );

  // ✅ 新增:结果预览状态
  const [showResult, setShowResult] = useState(false);
  const [resultDiary, setResultDiary] = useState<any>(null);
  const [pendingDiaryId, setPendingDiaryId] = useState<string | null>(null);
  const [hasSavedPendingDiary, setHasSavedPendingDiary] = useState(false);

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

  /**
   * 🎚️ 统一管理录音音频模式
   * - 录音时保持音频会话在后台活跃
   * - 结束后及时恢复，避免占用系统资源
   */

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
      // ✅ 如果结果已生成但用户未保存，弹出确认对话框
      if (showResult && pendingDiaryId && !hasSavedPendingDiary) {
        Alert.alert(
          t("confirm.discardUnsavedTitle"),
          t("confirm.discardUnsavedMessage"),
          [
            {
              text: t("common.cancel"),
              style: "cancel",
            },
            {
              text: t("common.confirm"),
              style: "destructive",
              onPress: async () => {
                try {
                  console.log("🗑️ 用户确认放弃，删除未保存日记:", pendingDiaryId);
                  await deleteDiary(pendingDiaryId);
                  setPendingDiaryId(null);
                  setHasSavedPendingDiary(false);
                  await cancelRecording();
                  setIsProcessing(false);
                  setShowResult(false);
                  setResultDiary(null);
                  onCancel();
                  onDiscard?.();
                } catch (deleteError) {
                  console.log("⚠️ 删除未保存日记失败（可忽略）:", deleteError);
                  // 即使删除失败，也继续关闭
                  setPendingDiaryId(null);
                  setHasSavedPendingDiary(false);
                  await cancelRecording();
                  setIsProcessing(false);
                  setShowResult(false);
                  setResultDiary(null);
                  onCancel();
                  onDiscard?.();
                }
              },
            },
          ]
        );
        return; // 等待用户确认
      }

      // ✅ 如果没有结果或已保存，直接取消
      setPendingDiaryId(null);
      setHasSavedPendingDiary(false);
      await cancelRecording();
      setIsProcessing(false);
      setShowResult(false);
      setResultDiary(null);
      console.log("❌ 录音已取消");
      onCancel();
    } catch (error) {
      console.error("取消录音失败:", error);
      // ✅ 即使出错也要重置状态
      setIsProcessing(false);
      onCancel();
    }
  }

  // ✅ 手势拖动处理
  // ✅ 新的手势 API
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // 只允许向下拖动（结果页时也允许，但会触发确认）
      if (event.translationY > 0) {
        dragY.setValue(event.translationY);
      }
    })
    .onEnd((event) => {
      // 拖动距离超过100px 或 快速向下滑动
      if (event.translationY > 100 || event.velocityY > 500) {
        // ✅ 如果结果页，需要确认；否则直接关闭
        if (showResult) {
          // 弹回原位，然后触发确认对话框
          Animated.spring(dragY, {
            toValue: 0,
            damping: 20,
            stiffness: 300,
            useNativeDriver: true,
          }).start(() => {
            handleCancelRecording();
          });
        } else {
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
        }
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
  }, [visible, isRecording, isProcessing, showResult]);

  // ✅ 录音时保持屏幕常亮，防止自动锁屏导致录音中断
  useEffect(() => {
    const manageKeepAwake = async () => {
      try {
        if (visible && !showResult && (isRecording || isPaused)) {
          await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        } else {
          await deactivateKeepAwake(KEEP_AWAKE_TAG);
        }
      } catch (error) {
        console.log("KeepAwake 控制失败:", error);
      }
    };

    manageKeepAwake();

    return () => {
      void (async () => {
        try {
          await deactivateKeepAwake(KEEP_AWAKE_TAG);
        } catch (_) {}
      })();
    };
  }, [visible, showResult, isRecording, isPaused]);

  useEffect(() => {
    if (!visible && pendingDiaryId && !hasSavedPendingDiary) {
      (async () => {
        try {
          console.log("🗑️ Modal 关闭，清理未保存日记:", pendingDiaryId);
          await deleteDiary(pendingDiaryId);
          onDiscard?.();
        } catch (error) {
          console.log("⚠️ 关闭时删除未保存日记失败:", error);
        } finally {
          setPendingDiaryId(null);
          setHasSavedPendingDiary(false);
        }
      })();
    }
  }, [visible, pendingDiaryId, hasSavedPendingDiary]);

  // ✅ 组件卸载时清理
  useEffect(() => {
    return () => {
      (async () => {
        try {
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
        progressAnimationRef.current.cancel();
        progressAnimationRef.current = null;
      }
    };
  }, []);

  // ========== 录音相关函数 ==========
  /**
   * 完成录音并开始处理
   */
  const handleFinishRecording = async () => {
    try {
      const recordedDuration = duration;
      const uri = await stopRecording();

      // ✅ 检查录音时长(最短3秒)
      if (recordedDuration < 3) {
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

      // ✅ 重置进度状态（准备接收真实进度）
      setProcessingStep(0);
      setProcessingProgress(0);
      currentProgressRef.current = 0; // ✅ 重置 ref，确保从 0 开始
      progressAnimValue.setValue(0); // ✅ 重置动画值，确保从 0 开始

      try {
        const progressCallback: ProgressCallback = (progressData) => {
          console.log("📊 收到进度更新:", progressData);
          const progress = progressData.progress;
          
          // ✅ 直接使用 pollTaskProgress 中已经映射好的 step（无需再次映射）
          // pollTaskProgress 已经将后端 step 0-5 正确映射到前端 step 0-4
          let frontendStep = progressData.step ?? 0;

          // ✅ 确保步骤在有效范围内（0-4，对应5个步骤）
          frontendStep = Math.max(0, Math.min(frontendStep, processingSteps.length - 1));

          console.log(`📊 进度更新: step=${frontendStep}, progress=${progress}%, message=${progressData.message || progressData.step_name}`);
          
          setProcessingStep(frontendStep);
          smoothUpdateProgress(progress);
        };

        const diary = await createVoiceDiaryStream(
          uri!,
          recordedDuration,
          progressCallback,
          imageUrls // ✅ 传递图片URL
        );

        setIsProcessing(false);
        setResultDiary(diary);
        setShowResult(true);
        setPendingDiaryId(diary.diary_id);
        setHasSavedPendingDiary(false);

        console.log("✅ 日记创建成功:", diary.diary_id);
      } catch (error: any) {
        console.log("❌ 处理失败:", error);
        setPendingDiaryId(null);
        setHasSavedPendingDiary(false);

        if (
          error.code === "EMPTY_TRANSCRIPT" ||
          (error.message &&
            (error.message.includes("No valid speech detected") ||
              error.message.includes("空内容") ||
              error.message.includes("未能识别到") ||
              error.message.includes("识别到的内容过短") ||
              error.message.includes("检测到的内容过于简单") ||
              error.message.includes("检测到的内容主要是语气词") ||
              error.message.includes("检测到的内容只包含标点符号") ||
              error.message.includes("未能识别到任何语音内容")))
        ) {
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
      console.log("完成录音失败:", error);
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
        console.log(
          `📍 步骤 ${index + 1}/${totalSteps}: ${step.text} (目标: ${
            step.progress
          }%)`
        );
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
        if (
          typeof progressAnimationRef.current === "object" &&
          progressAnimationRef.current.cancel
        ) {
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
        await (resultSoundRef.current as any).unloadAsync();
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
        const hasTitleChange =
          isEditingTitle && editedTitle.trim() !== resultDiary.title;
        const hasContentChange =
          isEditingContent &&
          editedContent.trim() !== resultDiary.polished_content;

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

      setHasSavedPendingDiary(true);
      setPendingDiaryId(null);

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

      // ✅ 先重置所有状态，确保不会触发任何副作用
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
      setIsProcessing(false);
      setProcessingStep(0);
      setProcessingProgress(0);

      // ✅ 显示成功 Toast
      showToast(t("success.diaryCreated"));

      // ✅ 短暂延迟让用户看到 Toast
      await new Promise((resolve) => setTimeout(resolve, 500));

      // ✅ 通知父组件刷新列表（父组件会在 onSuccess 中关闭 modal）
      // 使用 setTimeout 确保状态更新已完成
      setTimeout(() => {
        onSuccess();
      }, 0);
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
    } finally {
      isSavingRef.current = false;
      try {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch (_) {}
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
        <Text
          style={[
            styles.title,
            {
              fontFamily: getFontFamilyForText(
                t("diary.voiceEntry"),
                "medium"
              ),
            },
          ]}
        >
          {t("diary.voiceEntry")}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {!isProcessing ? (
        <VoiceRecordingPanel
          isRecording={isRecording}
          isPaused={isPaused}
          duration={duration}
          nearLimit={nearLimit}
          waveAnim1={waveAnim1}
          waveAnim2={waveAnim2}
          waveAnim3={waveAnim3}
          pulseAnim={pulseAnim}
          onCancel={handleCancelRecording}
          onTogglePause={isPaused ? resumeRecording : pauseRecording}
          onFinish={handleFinishRecording}
        />
      ) : (
        <View style={styles.animationArea}>
          <View style={styles.processingContent}>
            <ProcessingAnimation />
          </View>
        </View>
      )}
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
          accessibilityLabel={
            isEditing ? t("common.cancel") : t("common.close")
          }
          accessibilityHint={t("accessibility.button.closeHint")}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isEditing ? (
            <Text
              style={[
                styles.resultHeaderButtonText,
                {
                  fontFamily: getFontFamilyForText(
                    t("common.cancel"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("common.cancel")}
            </Text>
          ) : (
            <Ionicons name="close-outline" size={24} color="#666" />
          )}
        </TouchableOpacity>

        {/* 中间标题 */}
        <Text
          style={[
            styles.resultHeaderTitle,
            {
              fontFamily: getFontFamilyForText(
                isEditing ? t("common.edit") : t("diary.yourEntry"),
                "regular"
              ),
            },
          ]}
        >
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
                {
                  fontFamily: getFontFamilyForText(
                    t("common.done"),
                    "semibold"
                  ),
                },
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
                  <Text
                    style={[
                      styles.resultTitleText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.title,
                          "bold"
                        ),
                      },
                    ]}
                  >
                    {resultDiary.title}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 内容 */}
              {isEditingContent ? (
                <TextInput
                  style={[
                    styles.editContentInput,
                    {
                      fontFamily: getFontFamilyForText(
                        editedContent || resultDiary.polished_content,
                        "regular"
                      ),
                    },
                  ]}
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
                  accessibilityLabel={
                    resultDiary.polished_content.substring(0, 100) +
                    (resultDiary.polished_content.length > 100 ? "..." : "")
                  }
                  accessibilityHint={t("accessibility.button.editHint")}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.resultContentText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.polished_content,
                          "regular"
                        ),
                      },
                    ]}
                  >
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
                    <PreciousMomentsIcon width={20} height={20} />
                    <Text
                      style={[
                        styles.resultFeedbackTitle,
                        {
                          fontFamily: getFontFamilyForText(
                            t("diary.aiFeedbackTitle"),
                            "medium"
                          ),
                        },
                      ]}
                    >
                      {t("diary.aiFeedbackTitle")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.resultFeedbackText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.ai_feedback,
                          "regular"
                        ),
                      },
                    ]}
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
            <Text
              style={[
                styles.saveButtonText,
                {
                  fontFamily: getFontFamilyForText(
                    t("diary.saveToJournal"),
                    "semibold"
                  ),
                },
              ]}
            >
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
        onRequestClose={showResult ? handleCancelRecording : onCancel}
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
                    <Text
                      style={[
                        styles.toastText,
                        {
                          fontFamily: getFontFamilyForText(
                            toastMessage,
                            "regular"
                          ),
                        },
                      ]}
                    >
                      {toastMessage}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        </Animated.View>

        {/* ✅ 统一的处理加载Modal（覆盖整个屏幕） */}
        {isProcessing && (
          <ProcessingModal
            visible={isProcessing}
            processingStep={processingStep}
            processingProgress={processingProgress}
            steps={processingSteps.map((step) => ({
              icon: step.icon,
              text: step.text,
            }))}
          />
        )}
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
    marginLeft: 8,
  },
  resultFeedbackText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 28, // ✅ 增大行高，让中文内容不那么密集（从22增加到28）
    letterSpacing: 0.3, // ✅ 增加字间距，让阅读更舒适
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
  emojiContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    height: 40, // 固定高度，确保布局稳定
  },
  stepEmoji: {
    fontSize: 32, // 稍微大一点，更醒目
    textAlign: "center",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    minHeight: 24, // 最小高度，防止布局跳动
  },
  currentStepText: {
    ...Typography.body,
    color: "#1A1A1A",
    textAlign: "center",
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
