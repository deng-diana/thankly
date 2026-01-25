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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import {
  createVoiceDiary,
  createVoiceDiaryStream,
  deleteDiary,
  ProgressCallback,
  pollTaskProgress,
  uploadDiaryImages, // ✅ 添加图片上传
  addImagesToTask,   // ✅ 添加辅助补充图片
} from "../services/diaryService";
import { uploadAudioAndCreateTask } from "../services/audioUploadService";
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
import { EmotionCapsule } from "../components/EmotionCapsule";
const { width } = Dimensions.get("window");

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";
import { Typography, getFontFamilyForText } from "../styles/typography";
import ProcessingModal from "./ProcessingModal";
import VoiceRecordingPanel from "./VoiceRecordingPanel";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import DiaryResultView from "./DiaryResultView"; // ✅ 导入共享组件

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
    saveRecordingDraft, // ✅ 获取保存草稿函数
  } = useVoiceRecording();

  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ 新增:处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // ✅ 新增:目标进度(我们要到达的进度)
  const [targetProgress, setTargetProgress] = useState(0);

  // ✅ 新增:平滑动画定时器
  // ✅ 支持 requestAnimationFrame 返回的 number 类型
  const progressAnimationRef = useRef<number | null>(null);

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
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  // ✅ 使用 ref 保存当前进度值，确保跨步骤连续性
  const currentProgressRef = useRef(0);

  /**
   * 🎯 教科书级别的平滑进度更新
   * 
   * 核心原则：
   * 1. 使用 requestAnimationFrame 实现 60fps 流畅动画
   * 2. 使用缓动函数（easeOutCubic）实现自然的加速/减速
   * 3. 确保进度永远不会倒退或跳跃
   * 4. 支持快速连续更新而不会卡顿
   * 5. 自动清理，防止内存泄漏
   * 
   * @param target - 目标进度 (0-100)
   * @param duration - 动画时长（毫秒），默认根据跳跃大小智能计算
   */
  const smoothUpdateProgress = useCallback(
    (target: number, duration?: number) => {
      // ✅ 1. 确保目标值在有效范围内且不倒退
      const safeTarget = Math.max(
        Math.min(target, 100),
        currentProgressRef.current
      );
      
      const currentValue = currentProgressRef.current;
      const progressDiff = safeTarget - currentValue;

      // ✅ 如果已经到达目标，直接返回
      if (progressDiff <= 0.01) {
        return;
      }

      // ✅ 2. 智能计算动画时长
      // 增加时长，让大跳跃也能平滑过渡，消除卡顿感
      let calculatedDuration = duration;
      if (calculatedDuration === undefined) {
        if (progressDiff < 5) {
          calculatedDuration = 600;  // 小跳跃：稍慢一点，更平滑
        } else if (progressDiff < 10) {
          calculatedDuration = 1000; // 中小跳跃：1秒过渡
        } else if (progressDiff < 20) {
          calculatedDuration = 1500; // 中等跳跃：1.5秒过渡
        } else if (progressDiff < 30) {
          calculatedDuration = 2000; // 大跳跃：2秒平滑过渡
        } else {
          calculatedDuration = 2500; // 超大跳跃：2.5秒慢速平滑
        }
      }

      console.log(
        `🎯 进度动画: ${currentValue.toFixed(1)}% → ${safeTarget.toFixed(1)}% (Δ${progressDiff.toFixed(1)}%, ${calculatedDuration}ms)`
      );

      // ✅ 3. 取消之前的动画
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }

      // ✅ 4. 使用 requestAnimationFrame 实现 60fps 流畅动画
      const startTime = Date.now();
      const startValue = currentValue;

      // 缓动函数：easeOutCubic（先快后慢，更自然）
      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
      };

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / calculatedDuration, 1);

        // 应用缓动函数
        const easedProgress = easeOutCubic(progress);
        
        // 计算当前值
        const newValue = startValue + (safeTarget - startValue) * easedProgress;
        
        // ✅ 5. 更新进度（确保不倒退）
        const clampedValue = Math.max(currentProgressRef.current, newValue);
        currentProgressRef.current = clampedValue;
        setProcessingProgress(clampedValue);

        // ✅ 6. 继续动画或完成
        if (progress < 1) {
          progressAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // 动画完成，确保最终值精确
          currentProgressRef.current = safeTarget;
          setProcessingProgress(safeTarget);
          progressAnimationRef.current = null;
          console.log(`✅ 进度到达: ${safeTarget.toFixed(1)}%`);
        }
      };

      // 启动动画
      progressAnimationRef.current = requestAnimationFrame(animate);
    },
    []
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

  // ✅ 新增:音频播放负载状态(防止双重播放)
  const isLoadingSoundRef = useRef(false);
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

  // ✅ 录音草稿恢复相关状态
  const RECORDING_DRAFT_KEY = "recording_draft";
  const MAX_DRAFT_AGE = 24 * 60 * 60 * 1000; // 24小时
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState<{
    audioUri: string;
    duration: number;
    startTime: number;
  } | null>(null);

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
    .enabled(!isEditingTitle && !isEditingContent) // ✅ 编辑时禁用拖动手势，避开键盘冲突
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

  // ✅ Track auto-start attempts to prevent infinite loops
  const autoStartAttemptedRef = useRef(false);
  const startFailedRef = useRef(false);

  // ✅ 检查录音文件是否存在
  const checkFileExists = async (uri: string): Promise<boolean> => {
    try {
      const response = await fetch(uri, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // ✅ 恢复录音草稿
  // 返回 true 表示有草稿，false 表示没有草稿
  const restoreRecordingDraft = useCallback(async (): Promise<boolean> => {
    try {
      const draft = await AsyncStorage.getItem(RECORDING_DRAFT_KEY);
      if (!draft) return false;

      const draftData = JSON.parse(draft);
      
      // 检查草稿是否过期（24小时）
      const now = Date.now();
      const draftAge = now - draftData.timestamp;
      
      if (draftAge >= MAX_DRAFT_AGE) {
        // 草稿过期，清除
        await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
        return false;
      }

      if (draftData.audioUri) {
        // 检查录音文件是否还存在
        const fileExists = await checkFileExists(draftData.audioUri);
        
        if (fileExists) {
          // 文件存在，显示恢复确认弹窗
          setRestoredDraft({
            audioUri: draftData.audioUri,
            duration: draftData.duration || 0,
            startTime: draftData.startTime || Date.now(),
          });
          setShowRestoreConfirm(true);
          return true; // 返回 true 表示有草稿
        } else {
          // 文件不存在，清除草稿
          await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error("❌ 恢复录音草稿失败:", error);
      return false;
    }
  }, []);

  // ✅ Modal 打开时检查草稿并自动开始录音（仅尝试一次）
  useEffect(() => {
    // Reset on modal close
    if (!visible) {
      autoStartAttemptedRef.current = false;
      startFailedRef.current = false;
      setShowRestoreConfirm(false);
      setRestoredDraft(null);
      return;
    }

    // Only auto-start once per modal open
    if (autoStartAttemptedRef.current) {
      return;
    }

    // Don't auto-start if we're already in a valid state
    if (isRecording || isProcessing || showResult || isStarting) {
      return;
    }

    // Don't auto-start if previous attempt failed
    if (startFailedRef.current) {
      return;
    }

    // Mark as attempted
    autoStartAttemptedRef.current = true;

    // Delay to avoid animation conflicts
    const timer = setTimeout(async () => {
      try {
        // ✅ 先检查是否有录音草稿
        const hasDraft = await restoreRecordingDraft();
        
        // 如果没有草稿，则自动开始录音
        if (!hasDraft) {
          await startRecording();
        }
        // 如果有草稿，restoreRecordingDraft 已经设置了 showRestoreConfirm = true
        // 用户会在弹窗中选择"继续录音"或"重新开始"
      } catch (error) {
        console.error("Auto-start failed:", error);
        startFailedRef.current = true;
        // Don't retry automatically - user must manually retry
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [visible, isRecording, isProcessing, showResult, isStarting, restoreRecordingDraft]);

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

  // ✅ 顶级优化：监听 visible 变化，在关闭 Modal 时立即停止并卸载音频
  useEffect(() => {
    if (!visible) {
      (async () => {
        try {
          // ✅ Modal 关闭前，如果有正在进行的录音，立即保存草稿
          if (isRecording && !showResult) {
            await saveRecordingDraft();
          }
          
          if (resultSoundRef.current) {
            console.log("🎵 Modal 关闭，停止播放结果音频");
            await resultSoundRef.current.unloadAsync();
            resultSoundRef.current = null;
          }
          setIsPlayingResult(false);
          setResultCurrentTime(0);
          
          if (resultProgressIntervalRef.current) {
            clearInterval(resultProgressIntervalRef.current);
            resultProgressIntervalRef.current = null;
          }
          
          // 重置加载锁
          isLoadingSoundRef.current = false;
        } catch (error) {
          console.log("⚠️ 关闭 Modal 时清理音频失败:", error);
        }
      })();
    }
  }, [visible, isRecording, showResult, saveRecordingDraft]);

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

      // ✅ 清理进度动画
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, []);
  
  /**
   * ✅ 统一处理“重新录制”或“重试”逻辑
   * 彻底清理之前的所有状态，防止锁死或时间残留
   */
  const handleRerecord = async () => {
    console.log("🔄 开始重置录音状态并重新录制...");
    try {
      // 1. 彻底重置 UI 和处理状态
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStep(0);
      currentProgressRef.current = 0;
      if (progressAnimValue) {
        progressAnimValue.setValue(0);
      }
      
      // 2. 清理临时结果数据
      setPendingDiaryId(null);
      setHasSavedPendingDiary(false);
      
      // 3. 这里的关键：给 React 一个喘息时间，确保状态已经完全更新
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 4. 调用 Hook 的取消逻辑确保 Native 资源释放
      await cancelRecording();
      
      // 5. 调用重新录制
      await startRecording();
      console.log("✅ 重新录制已启动");
    } catch (error) {
      console.error("❌ 重新录制失败:", error);
    }
  };

  // ========== 录音相关函数 ==========
  /**
   * 完成录音并开始处理
   */
  const handleFinishRecording = async () => {
    try {
      // ✅ 1. 先暂停录音，用于检查时长
      await pauseRecording();
      const recordedDuration = duration;

      // ✅ 2. 统一逻辑：检查录音时长(最短5秒)
      if (recordedDuration < 5) {
        Alert.alert(
          t("diary.shortRecordingTitle"), 
          t("diary.shortRecordingMessage"), 
          [
            {
              text: t("diary.resumeRecording"),
              style: "default",
              onPress: () => resumeRecording(), // ✅ 真正继续录音，不重置时长
            },
            {
              text: t("common.cancel"),
              style: "cancel",
              onPress: () => handleCancelRecording(),
            },
          ]
        );
        return;
      }

      // ✅ 3. 符合时长要求，正式停止录音并获取 URI
      const uri = await stopRecording();

      // 显示处理中
      setIsProcessing(true);

      // ✅ 重置进度状态
      setProcessingStep(0);
      setProcessingProgress(0);
      currentProgressRef.current = 0; 
      progressAnimValue.setValue(0); 

      // ✅ 进入处理阶段：启动“伪进度”以消除初始 0% 的僵持感
      setProcessingProgress(5);
      currentProgressRef.current = 5; 
      const uploadInterval = setInterval(() => {
        const next = Math.min(currentProgressRef.current + 2, 15); // 慢速递增到 15%
        currentProgressRef.current = next;
        setProcessingProgress(next);
      }, 800);

      let taskId: string;
      let headers: Record<string, string>;

      try {
        try {
          // 把进度映射逻辑提取出来，确保平滑
          const updateCombinedProgress = (audioP: number, imageP: number) => {
            // 音频占 70%, 图片占 30% (在 0-20% 的总进度空间内)
            const audioWeight = 0.7;
            const imageWeight = 0.3;
            
            let totalUploadProgress = audioP * audioWeight;
            if (imageUrls && imageUrls.length > 0) {
              totalUploadProgress += imageP * imageWeight;
            } else {
              totalUploadProgress = audioP; // 如果没图片，音频就是 100%
            }
            
            const mappedProgress = Math.round(totalUploadProgress * 0.2);
            smoothUpdateProgress(Math.max(mappedProgress, currentProgressRef.current));
          };

          let lastAudioP = 0;
          let lastImageP = 0;

          // 如果有图片，先启动图片上传任务
          let imageUploadPromise = Promise.resolve([] as string[]);
          if (imageUrls && imageUrls.length > 0) {
            console.log(`📸 正在并行上传 ${imageUrls.length} 张图片...`);
            imageUploadPromise = uploadDiaryImages(imageUrls, (p) => {
              lastImageP = p;
              updateCombinedProgress(lastAudioP, lastImageP);
            });
          }

          // ✅ 专家优化：真正的并行启动
          // 我们不再在这里 await imageUploadPromise，而是直接启动音频上传和任务创建
          // 这样音频和图片就在同时上传了！速度翻倍！
          const result = await uploadAudioAndCreateTask(
            savedUri!,
            savedDuration,
            (uploadProgress) => {
              lastAudioP = uploadProgress;
              updateCombinedProgress(lastAudioP, lastImageP);
            },
            undefined,
            undefined, // 初始不传图片URL，让图片在后台传
            imageUrls && imageUrls.length > 0 // 如果有图片，告诉后端 expectImages=true
          );
          
          taskId = result.taskId;
          headers = result.headers;
          console.log(`✅ [RecordingModal] 任务创建成功 (TaskID: ${taskId})，开始后台处理图片...`);

          // ✅ 后台处理图片补充逻辑 (不阻塞主线程)
          if (imageUrls && imageUrls.length > 0) {
            console.log(`📸 [RecordingModal] 检测到 ${imageUrls.length} 张图片，启动补充逻辑...`);
            (async () => {
              try {
                const finalUrls = await imageUploadPromise;
                console.log(`📸 [RecordingModal] 图片上传终于完成了 (共${finalUrls.length}张)，正在调用补充接口: ${taskId}`);
                await addImagesToTask(taskId, finalUrls);
                console.log(`✅ [RecordingModal] 图片已成功补充到后台任务: ${taskId}`);
              } catch (err) {
                console.error(`❌ [RecordingModal] 补充图片到任务失败 (ID: ${taskId}):`, err);
              }
            })();
          } else {
            console.log("ℹ️ [RecordingModal] 此日记无图片需要补充");
          }
        } finally {
          clearInterval(uploadInterval);
        }

        // ✅ 优化 20% 卡顿：在第一个轮询结果回来前，继续积极推进进度到 30%
        // 速度: 从 20% 到 32%，每 800ms 推进 1.2%，给后端预留约 8 秒的冷启动时间
        smoothUpdateProgress(20); 
        const transitionInterval = setInterval(() => {
          const next = Math.min(currentProgressRef.current + 1.2, 32); 
          currentProgressRef.current = next;
          setProcessingProgress(next);
        }, 800);

        // ✅ 步骤2: 轮询任务进度
        const progressCallback: ProgressCallback = (progressData) => {
          const progress = progressData.progress;
          
          // ✅ 专家优化：只有当后端进度真正“超过”了我们的预测进度时，才停止并切换到真实进度
          // 否则会造成进度条回退或卡死在 20%
          if (progress > currentProgressRef.current + 2) {
            if (transitionInterval) {
              console.log(`📡 [专家小组] 后端进度 (${progress}%) 已赶上，停止过渡动画`);
              clearInterval(transitionInterval);
            }
          }
          let frontendStep = progressData.step ?? 0;
          frontendStep = Math.max(0, Math.min(frontendStep, processingSteps.length - 1));

          setProcessingStep(frontendStep);
          smoothUpdateProgress(progress);
        };

        const diary = await pollTaskProgress(taskId, headers, progressCallback);
        if (transitionInterval) clearInterval(transitionInterval);

        setIsProcessing(false);
        setResultDiary(diary);
        setShowResult(true);
        setPendingDiaryId(diary.diary_id);
        setHasSavedPendingDiary(false);
        console.log("✅ 日记创建成功:", diary.diary_id);
      } catch (error: any) {
        setIsProcessing(false);
        console.log("❌ 处理失败:", error);
        setPendingDiaryId(null);
        setHasSavedPendingDiary(false);

        // ✅ 弱网保护：上传失败时保存草稿
        // 检查是否是网络错误或上传失败
        const isNetworkError = 
          error.message?.includes("网络") ||
          error.message?.includes("network") ||
          error.message?.includes("timeout") ||
          error.message?.includes("超时") ||
          error.message?.includes("上传失败") ||
          error.message?.includes("upload failed") ||
          error.code === "NETWORK_ERROR" ||
          error.code === "TIMEOUT";
        
        if (isNetworkError && savedUri) {
          console.log("⚠️ 检测到网络错误，保存录音草稿以便稍后重试");
          // 保存录音草稿（包含 URI 和时长）
          try {
            const draftData = {
              audioUri: savedUri,
              startTime: Date.now(),
              duration: savedDuration,
              isPaused: false,
              timestamp: Date.now(),
              uploadFailed: true, // 标记为上传失败
              imageUrls: imageUrls || [],
            };
            await AsyncStorage.setItem("recording_draft", JSON.stringify(draftData));
            console.log("💾 录音草稿已保存（上传失败）");
          } catch (draftError) {
            console.error("❌ 保存草稿失败:", draftError);
          }
        }

        if (
          error.code === "EMPTY_TRANSCRIPT" ||
          (error.message && error.message.includes("No valid speech detected"))
        ) {
          Alert.alert(
            t("error.emptyRecording.title"),
            t("error.emptyRecording.message"),
            [{ text: t("common.rerecord"), onPress: () => handleRerecord() }]
          );
          return;
        }

        // 如果是网络错误，提示用户稍后重试
        if (isNetworkError) {
          Alert.alert(
            t("error.genericError") || "网络错误",
            (t("error.networkError") || "网络连接失败，录音已保存为草稿，稍后可以重试") + (error.message ? `\n\n${error.message}` : ""),
            [
              { text: t("common.retry") || "重试", onPress: () => handleRerecord() },
              { text: t("common.cancel") || "取消", style: "cancel", onPress: () => handleCancelRecording() },
            ]
          );
        } else {
          Alert.alert(t("error.genericError"), error.message || t("error.retryMessage"), [
            { text: t("common.retry"), onPress: () => handleRerecord() },
            { text: t("common.cancel"), style: "cancel", onPress: () => handleCancelRecording() },
          ]);
        }
      }
    } catch (error: any) {
      console.log("完成录音主流程失败:", error);
      setIsProcessing(false);
      
      // ✅ 弱网保护：主流程失败时也尝试保存草稿
      // 注意：这里 uri 可能未定义，需要从作用域获取
      const finalUri = savedUri;
      const finalDuration = savedDuration;
      if (finalUri) {
        try {
          const draftData = {
            audioUri: finalUri,
            startTime: Date.now(),
            duration: finalDuration,
            isPaused: false,
            timestamp: Date.now(),
            uploadFailed: true,
            imageUrls: imageUrls || [],
          };
          await AsyncStorage.setItem("recording_draft", JSON.stringify(draftData));
          console.log("💾 录音草稿已保存（主流程失败）");
        } catch (draftError) {
          console.error("❌ 保存草稿失败:", draftError);
        }
      }
      
      Alert.alert(t("error.genericError"), t("error.recordingFailed"));
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
        cancelAnimationFrame(progressAnimationRef.current);
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

    // ✅ 顶级保护：防止双击导致并发加载音频
    if (isLoadingSoundRef.current) {
      console.log("⏳ 音频正在加载中，跳过重复点击");
      return;
    }

    try {
      // 1. 如果正在播放，则暂停
      if (isPlayingResult) {
        if (resultSoundRef.current) {
          await resultSoundRef.current.pauseAsync();
          setIsPlayingResult(false);
        }
        return;
      }

      // 2. 如果已经加载过播放器（处于暂停状态），则直接恢复播放
      if (resultSoundRef.current) {
        await resultSoundRef.current.playAsync();
        setIsPlayingResult(true);
        return;
      }

      // 3. 初始加载：设置加载锁
      isLoadingSoundRef.current = true;

      // 设置音频模式：确保使用扬声器外放
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
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
      setHasPlayedResultOnce(true); 
      isLoadingSoundRef.current = false; // 加载完成，释放锁

      // 初始化进度
      const initialDuration = resultDiary.audio_duration || 0;
      if (initialDuration > 0) {
        setResultDuration(initialDuration);
      }
      setResultCurrentTime(0);

      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
      }

      // 启动进度更新定时器
      resultProgressIntervalRef.current = setInterval(async () => {
        try {
          if (!resultSoundRef.current) {
            if (resultProgressIntervalRef.current) clearInterval(resultProgressIntervalRef.current);
            return;
          }

          const status = await resultSoundRef.current.getStatusAsync();

          if (status.isLoaded) {
            const durationMillis = status.durationMillis;
            const positionMillis = status.positionMillis;

            if (durationMillis && durationMillis > 0) {
              setResultDuration(Math.floor(durationMillis / 1000));
            }

            if (positionMillis !== undefined) {
              setResultCurrentTime(positionMillis / 1000);
            }

            if (status.didJustFinish) {
              if (resultProgressIntervalRef.current) clearInterval(resultProgressIntervalRef.current);
              resultProgressIntervalRef.current = null;
              setIsPlayingResult(false);
              setResultCurrentTime(0);
              setHasPlayedResultOnce(false); 
              await sound.unloadAsync();
              resultSoundRef.current = null;
            }
          }
        } catch (error) {
          console.error("❌ 更新播放进度失败:", error);
        }
      }, 100);

      console.log("🎵 播放结果音频");
    } catch (error: any) {
      isLoadingSoundRef.current = false; // 出错也释放锁
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

    if (locale === "zh") {
      // 中文格式：2026 年 1 月 11 日 · 下午 2:52
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      const period = hours < 12 ? "上午" : "下午";
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
        <View style={styles.titleRow}>
          <PreciousMomentsIcon width={20} height={20} />
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
        </View>
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
      ) : null}
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
          enabled={isEditingTitle || isEditingContent}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={{ flex: 1 }} // ✅ 明确占用所有剩余空间
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={true} // ✅ 显示进度条协助浏览
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag" // ✅ 更好的移动端滚动体验
            bounces={false} // ✅ 彻底禁用弹性回弹，解决“滑不动”和“跳动”问题
          >
            {/* 音频播放器 */}
            {/* 编辑时隐藏播放器，聚焦编辑体验，防止布局跳动 */}
            {!isEditingTitle && !isEditingContent && resultDiary.audio_url && (
              <AudioPlayer
                audioUrl={resultDiary.audio_url}
                audioDuration={resultDiary.audio_duration}
                isPlaying={isPlayingResult}
                currentTime={resultCurrentTime}
                totalDuration={resultDuration}
                hasPlayedOnce={hasPlayedResultOnce}
                onPlayPress={handlePlayResultAudio}
                onSeek={async (seekTime) => {
                  if (resultSoundRef.current) {
                    await resultSoundRef.current.setPositionAsync(seekTime * 1000);
                    setResultCurrentTime(seekTime);
                  }
                }}
                style={styles.resultAudioPlayer}
              />
            )}

            {/* 标题、内容和AI反馈卡片 - 使用共享组件 */}
            <DiaryResultView
              title={resultDiary.title}
              polishedContent={resultDiary.polished_content}
              aiFeedback={resultDiary.ai_feedback}
              emotionData={resultDiary.emotion_data}
              language={resultDiary.language}
              isEditingTitle={isEditingTitle}
              isEditingContent={isEditingContent}
              editedTitle={editedTitle}
              editedContent={editedContent}
              onStartTitleEditing={startEditingTitle}
              onStartContentEditing={startEditingContent}
              onTitleChange={(text) => {
                setEditedTitle(text);
                setHasChanges(text.trim() !== resultDiary.title);
              }}
              onContentChange={(text) => {
                setEditedContent(text);
                setHasChanges(text.trim() !== resultDiary.polished_content);
              }}
            />

            {/* 底部间距 - 编辑时增加 600px 间距，预览时仅留 20px */}
            <View style={{ height: (isEditingTitle || isEditingContent) ? 600 : 20 }} />
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
                // ✅ 根据状态应用不同的高度策略
                showResult
                  ? styles.modalResult  // 结果页：自适应高度
                  : styles.modalRecording, // 录音页：固定高度
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

        {/* ✅ 录音草稿恢复确认弹窗（与TextInputModal样式一致） */}
        <Modal
          visible={showRestoreConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRestoreConfirm(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              {/* ✅ 右上角关闭按钮 */}
              <TouchableOpacity
                style={styles.confirmCloseButton}
                onPress={async () => {
                  // 点击关闭按钮：清除草稿并开始新录音
                  await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
                  setShowRestoreConfirm(false);
                  setRestoredDraft(null);
                  // 开始新录音
                  try {
                    await startRecording();
                  } catch (error) {
                    console.error("开始新录音失败:", error);
                  }
                }}
              >
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>

              {/* 标题 */}
              <Text
                style={[
                  styles.confirmTitle,
                  {
                    fontFamily: getFontFamilyForText(
                      t("draft.recordingRestoreTitle"),
                      "semibold"
                    ),
                  },
                ]}
              >
                {t("draft.recordingRestoreTitle")}
              </Text>

              {/* 正文 */}
              <Text
                style={[
                  styles.confirmMessage,
                  {
                    fontFamily: getFontFamilyForText(
                      t("draft.recordingRestoreMessage"),
                      "regular"
                    ),
                  },
                ]}
              >
                {t("draft.recordingRestoreMessage")}
              </Text>

              {/* 按钮容器 */}
              <View style={styles.confirmButtons}>
                {/* Secondary 按钮：重新开始 */}
                <TouchableOpacity
                  style={styles.confirmButtonSecondary}
                  onPress={async () => {
                    // 用户选择重新开始，清除草稿并开始新录音
                    await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
                    setShowRestoreConfirm(false);
                    setRestoredDraft(null);
                    // 开始新录音
                    try {
                      await startRecording();
                    } catch (error) {
                      console.error("开始新录音失败:", error);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.confirmButtonTextSecondary,
                      {
                        fontFamily: getFontFamilyForText(
                          t("draft.startNew"),
                          "medium"
                        ),
                      },
                    ]}
                  >
                    {t("draft.startNew")}
                  </Text>
                </TouchableOpacity>

                {/* Primary 按钮：继续录音（橙色背景，白色文字） */}
                <TouchableOpacity
                  style={styles.confirmButtonPrimary}
                  onPress={async () => {
                    // 用户选择继续录音
                    if (restoredDraft) {
                      setShowRestoreConfirm(false);
                      
                      // 清除草稿，因为我们要使用已保存的录音
                      await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
                      
                      // 直接使用已保存的录音文件，进入处理流程
                      const savedAudioUri = restoredDraft.audioUri;
                      const savedDuration = restoredDraft.duration;
                      
                      // 清除恢复状态
                      setRestoredDraft(null);
                      
                      // 直接使用已保存的录音文件开始处理
                      // 调用处理流程，使用已保存的录音文件
                      try {
                        setIsProcessing(true);
                        setProcessingStep(0);
                        setProcessingProgress(0);
                        currentProgressRef.current = 0;
                        
                        // 使用已保存的录音文件创建日记
                        const diary = await createVoiceDiaryStream(
                          savedAudioUri,
                          savedDuration,
                          (step, progress, message) => {
                            updateProcessingProgress(step, progress);
                          },
                          imageUrls
                        );
                        
                        // 处理成功
                        setResultDiary(diary);
                        setShowResult(true);
                        setIsProcessing(false);
                        showToast(t("diary.saveToJournal") || "已保存");
                      } catch (error: any) {
                        console.error("❌ 处理已保存录音失败:", error);
                        setIsProcessing(false);
                        showToast(error.message || "处理失败");
                      }
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.confirmButtonTextPrimary,
                      {
                        fontFamily: getFontFamilyForText(
                          t("draft.continueRecording"),
                          "semibold"
                        ),
                      },
                    ]}
                  >
                    {t("draft.continueRecording")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    paddingBottom: 16, // ✅ 减少底部间距，避免过多空白
  },
  // ✅ 录音界面：固定高度，确保动画和控制按钮有足够空间
  modalRecording: {
    minHeight: 640,
  },
  // ✅ 结果预览界面：自适应高度但带有最小高度保障（锁定范围以防止键盘弹出时剧烈抖动）
  modalResult: {
    minHeight: "75%", 
    maxHeight: "95%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#fff',
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    flexShrink: 1, // ✅ 允许收缩以适应内容，而不是强制占满空间
  },
  resultScrollContent: {
    paddingHorizontal: 24, // ✅ 统一页边距为 24px
    paddingTop: 16, // ✅ 分割线下方间距统一为 16px
    paddingBottom: 20,
  },

  resultAudioPlayer: {
    marginTop: 0, // ✅ 间距由父容器 paddingTop 控制
    marginBottom: 12,
  },
  resultDiaryCard: {
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0, // ✅ 移除外边距，改用 ScrollView 的内边距
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
    marginHorizontal: 0, // ✅ 移除外边距
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
    paddingHorizontal: 24, // ✅ 统一页边距为 24px
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
    minHeight: 350, // ✅ 顶级优化：增加初始高度，让编辑框在 Modal 中顶天立地
    textAlignVertical: "top",
  },
  // ===== 结果页Header =====
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24, // ✅ 统一页边距为 24px
    paddingTop: 20,
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
  // ===== 自定义确认弹窗样式（与TextInputModal一致）=====
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  confirmContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    position: "relative", // ✅ 为关闭按钮提供定位参照
  },
  confirmCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "left", // ✅ 左对齐
    marginTop: 8, // ✅ 为关闭按钮留出空间
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "left", // ✅ 左对齐
    lineHeight: 24,
    marginBottom: 16, // ✅ 缩小间距
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5", // ✅ 很浅很浅的灰色背景
  },
  confirmButtonTextSecondary: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
  },
  confirmButtonPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E56C45", // ✅ Primary 按钮：橙色背景
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonTextPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff", // ✅ Primary 按钮：白色文字
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
