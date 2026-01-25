/**
 * 文字输入 Modal 组件
 *
 * 功能:
 * - 文字输入界面
 * - 处理动画（与语音输入一致）
 * - 结果展示（与语音输入一致）
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import { createTextDiary, updateDiary } from "../services/diaryService";
import { t } from "../i18n";
import { Typography, getFontFamilyForText } from "../styles/typography";
import ProcessingModal from "./ProcessingModal";
import DiaryResultView from "./DiaryResultView";
import { EmotionData } from "../types/emotion";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ✅ 自动保存配置
const AUTO_SAVE_KEY = "draft_text_input_modal";
const AUTO_SAVE_INTERVAL = 5000; // 5秒自动保存一次
const MAX_DRAFT_AGE = 24 * 60 * 60 * 1000; // 24小时

interface TextInputModalProps {
  visible: boolean;
  onSuccess: () => void; // 成功后回调
  onCancel: () => void; // 取消回调
}

export default function TextInputModal({
  visible,
  onSuccess,
  onCancel,
}: TextInputModalProps) {
  // ========== 状态管理 ==========
  const [content, setContent] = useState("");
  const [polishedContent, setPolishedContent] = useState("");
  const [title, setTitle] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [emotionData, setEmotionData] = useState<EmotionData | undefined>(undefined);

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [currentDiaryId, setCurrentDiaryId] = useState<string | null>(null);

  // 处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const progressAnimationRef = useRef<number | null>(null);

  // ✅ 新增:保存状态保护 - 防止重复调用
  const isSavingRef = useRef(false);

  // ✅ 自动保存状态
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedContentRef = useRef(false); // 标记是否有未保存的内容

  // Toast 状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 文字输入的处理步骤（跳过语音上传和转录）
  const processingSteps = [
    { icon: "✨", text: t("diary.processingSteps.polish"), duration: 3000 },
    { icon: "💭", text: t("diary.processingSteps.title"), duration: 2000 },
    { icon: "💬", text: t("diary.processingSteps.feedback"), duration: 2000 },
  ];

  // Modal 动画
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  // ========== 副作用 ==========
  useEffect(() => {
    if (visible) {
      // Modal 打开动画
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // ✅ 恢复草稿
      restoreDraft();
    } else {
      // Modal 关闭动画
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // ✅ 清除自动保存定时器
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // 重置状态
      setContent("");
      setPolishedContent("");
      setTitle("");
      setAiFeedback("");
      setEmotionData(undefined);
      setIsProcessing(false);
      setShowResult(false);
      setIsEditing(false);
      setHasChanges(false);
      setEditedContent("");
      setCurrentDiaryId(null);
      setProcessingStep(0);
      setProcessingProgress(0);
      setLastSaved(null);
      setIsDraftRestored(false);
      hasUnsavedContentRef.current = false;
    }
  }, [visible]);

  // ✅ 恢复草稿函数
  const restoreDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem(AUTO_SAVE_KEY);
      if (draft) {
        const draftData = JSON.parse(draft);
        
        // 检查草稿是否过期 (24小时)
        const now = Date.now();
        const draftAge = now - draftData.timestamp;
        
        if (draftAge < MAX_DRAFT_AGE && draftData.content.trim()) {
          // 提示用户恢复草稿
          Alert.alert(
            t("draft.restoreTitle") || "发现未保存的内容",
            `${t("draft.restoreMessage") || "是否恢复上次未保存的内容?"}\n(${draftData.content.substring(0, 30)}...)`,
            [
              {
                text: t("draft.discard") || "放弃",
                style: "destructive",
                onPress: async () => {
                  await AsyncStorage.removeItem(AUTO_SAVE_KEY);
                  setIsDraftRestored(true);
                }
              },
              {
                text: t("draft.restore") || "恢复",
                onPress: () => {
                  setContent(draftData.content);
                  hasUnsavedContentRef.current = true;
                  console.log("✅ 已恢复草稿:", draftData.content.substring(0, 50));
                  setIsDraftRestored(true);
                }
              }
            ]
          );
        } else {
          // 草稿过期或为空,删除
          await AsyncStorage.removeItem(AUTO_SAVE_KEY);
          setIsDraftRestored(true);
        }
      } else {
        setIsDraftRestored(true);
      }
    } catch (error) {
      console.error("❌ 恢复草稿失败:", error);
      setIsDraftRestored(true);
    }
  };

  // ✅ 自动保存草稿
  useEffect(() => {
    // 等待草稿恢复完成后再开始自动保存
    if (!isDraftRestored || !visible) return;
    
    // 如果内容为空,不保存
    if (!content.trim()) {
      // 如果之前有内容但现在为空，清除草稿
      if (hasUnsavedContentRef.current) {
        AsyncStorage.removeItem(AUTO_SAVE_KEY).catch(console.error);
        hasUnsavedContentRef.current = false;
        setLastSaved(null);
      }
      return;
    }
    
    // 如果已经提交或正在处理,不保存
    if (showResult || isProcessing) {
      return;
    }
    
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 设置新的定时器 (5秒后保存)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const draftData = {
          content: content,
          timestamp: Date.now()
        };
        
        await AsyncStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(draftData));
        setLastSaved(new Date());
        hasUnsavedContentRef.current = true;
        console.log("💾 自动保存草稿:", content.substring(0, 30) + "...");
      } catch (error) {
        console.error("❌ 自动保存失败:", error);
      }
    }, AUTO_SAVE_INTERVAL);
    
    // 清理函数
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, isDraftRestored, visible, showResult, isProcessing]);

  // 清理进度动画定时器
  useEffect(() => {
    return () => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, []);

  // ========== 手势处理 ==========
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0 && !showResult) {
        dragY.setValue(event.translationY);
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        // 向下拖动超过100px，关闭Modal
        // ✅ 如果结果页，需要确认；否则直接关闭
        if (showResult) {
          handleCancel();
        } else {
          onCancel();
        }
        dragY.setValue(0);
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

  // ========== 文字输入相关函数 ==========

  // ✅ 使用 ref 保存当前进度值，确保连续性
  const currentProgressRef = useRef(0);

  /**
   * 🎯 教科书级别的平滑进度更新（与 RecordingModal 一致）
   */
  const smoothUpdateProgress = useCallback(
    (target: number, duration?: number) => {
      const safeTarget = Math.max(
        Math.min(target, 100),
        currentProgressRef.current
      );
      
      const currentValue = currentProgressRef.current;
      const progressDiff = safeTarget - currentValue;

      if (progressDiff <= 0.01) {
        return;
      }

      let calculatedDuration = duration;
      if (calculatedDuration === undefined) {
        if (progressDiff < 5) {
          calculatedDuration = 600;
        } else if (progressDiff < 10) {
          calculatedDuration = 1000;
        } else if (progressDiff < 20) {
          calculatedDuration = 1500;
        } else if (progressDiff < 30) {
          calculatedDuration = 2000;
        } else {
          calculatedDuration = 2500;
        }
      }

      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }

      const startTime = Date.now();
      const startValue = currentValue;

      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
      };

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / calculatedDuration, 1);
        const easedProgress = easeOutCubic(progress);
        const newValue = startValue + (safeTarget - startValue) * easedProgress;
        const clampedValue = Math.max(currentProgressRef.current, newValue);
        
        currentProgressRef.current = clampedValue;
        setProcessingProgress(clampedValue);

        if (progress < 1) {
          progressAnimationRef.current = requestAnimationFrame(animate);
        } else {
          currentProgressRef.current = safeTarget;
          setProcessingProgress(safeTarget);
          progressAnimationRef.current = null;
        }
      };

      progressAnimationRef.current = requestAnimationFrame(animate);
    },
    []
  );

  // 模拟处理步骤
  const simulateProcessingSteps = () => {
    currentProgressRef.current = 5; // ✅ 从 5% 开始
    setProcessingStep(0);
    setProcessingProgress(5);

    // ✅ 新增：启动伪进度，防止在第一个 3s 定时器触发前看起来卡在 0%
    const pseudoInterval = setInterval(() => {
      const next = Math.min(currentProgressRef.current + 2, 25); // 慢速增加到 25%
      currentProgressRef.current = next;
      setProcessingProgress(next);
    }, 800);

    const totalSteps = processingSteps.length;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    let accumulatedTime = 0;

    processingSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        if (index === 0) clearInterval(pseudoInterval); // 第一个真实步骤开始时停止伪进度
        setProcessingStep(index);
        const targetProgress = ((index + 1) / totalSteps) * 100;
        smoothUpdateProgress(targetProgress); 
      }, accumulatedTime);

      stepTimers.push(timer);
      accumulatedTime += step.duration;
    });

    return () => {
      clearInterval(pseudoInterval);
      stepTimers.forEach((timer) => clearTimeout(timer));
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  };

  const MIN_TEXT_LENGTH = 10;
  const isTextValid = content.trim().length >= MIN_TEXT_LENGTH;

  // 显示 Toast 提示
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const handleTextSubmit = async () => {
    if (!content.trim()) {
      showToast(t("createTextDiary.emptyContentToast"));
      return;
    }

    if (!isTextValid) {
      const remaining = MIN_TEXT_LENGTH - content.trim().length;
      showToast(
        `${t("createTextDiary.needMoreChars")}${remaining}${t(
          "createTextDiary.moreChars"
        )}`
      );
      return;
    }

    try {
      setIsProcessing(true);
      setShowResult(true);

      console.log("📝 提交文字到后端处理...");

      const cleanupSteps = simulateProcessingSteps();

      try {
        const diary = await createTextDiary({
          content: content.trim(),
        });

        console.log("✅ 后端返回:", diary);

        // 如果进度小于100%，等待动画完成
        if (currentProgressRef.current < 100) {
          smoothUpdateProgress(100, 800);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        cleanupSteps && cleanupSteps();

        setContent(diary.original_content);
        setPolishedContent(
          diary.polished_content || diary.original_content || ""
        );
        setTitle(diary.title || "");
        setAiFeedback(diary.ai_feedback || "");
        setEmotionData(diary.emotion_data); // ✅ 设置情绪数据
        setCurrentDiaryId(diary.diary_id);

        // ✅ 成功后清除草稿
        await AsyncStorage.removeItem(AUTO_SAVE_KEY);
        hasUnsavedContentRef.current = false;
        console.log("✅ 已清除草稿 (成功提交)");

        console.log("📊 设置的结果数据:");
        console.log("  - title:", diary.title);
        console.log(
          "  - polishedContent:",
          diary.polished_content?.substring(0, 50)
        );
        console.log("  - aiFeedback:", diary.ai_feedback?.substring(0, 50));

        setIsProcessing(false);

        console.log("✅ 文字处理完成");
      } catch (error: any) {
        cleanupSteps && cleanupSteps();
        throw error;
      }
    } catch (error: any) {
      console.error("❌ 处理失败:", error);
      setIsProcessing(false);
      setShowResult(false);

      Alert.alert(
        t("error.genericError"),
        error.message || t("diary.processingFailed")
      );
    }
  };

  // 编辑完成
  const finishEditing = async () => {
    try {
      if (isEditing && hasChanges && currentDiaryId && editedContent.trim()) {
        console.log("📝 保存用户编辑的内容:", editedContent);

        await updateDiary(
          currentDiaryId,
          editedContent !== polishedContent ? editedContent : undefined
        );

        setPolishedContent(editedContent);
        setIsEditing(false);
        setHasChanges(false);
      }

      // 直接保存并关闭（与 RecordingModal 一致）
      await handleSaveAndClose();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
    }
  };

  // 保存并关闭
  const handleSaveAndClose = async () => {
    // ✅ 防止重复调用
    if (isSavingRef.current) {
      console.log("⏳ 正在保存中，跳过重复调用");
      return;
    }

    isSavingRef.current = true;

    try {
      console.log("💾 保存日记...");

      // 如果用户编辑了内容，先调用后端API更新
      if (
        currentDiaryId &&
        isEditing &&
        hasChanges &&
        editedContent.trim() &&
        editedContent !== polishedContent
      ) {
        console.log("📝 更新日记到后端:", currentDiaryId);
        await updateDiary(currentDiaryId, editedContent);
        console.log("✅ 后端更新成功");
      }

      // ✅ 先重置所有状态，确保不会触发任何副作用
      setShowResult(false);
      setIsEditing(false);
      setHasChanges(false);
      setContent("");
      setPolishedContent("");
      setTitle("");
      setAiFeedback("");
      setEmotionData(undefined);
      setCurrentDiaryId(null);
      setIsProcessing(false);
      setProcessingStep(0);
      setProcessingProgress(0);

      // 显示 Toast
      showToast(t("success.diaryCreated"));

      // ✅ 成功后清除草稿
      await AsyncStorage.removeItem(AUTO_SAVE_KEY);
      hasUnsavedContentRef.current = false;
      console.log("✅ 已清除草稿 (成功保存)");

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
    }
  };

  // 开始编辑
  const startEditing = () => {
    if (!isEditing) {
      setIsEditing(true);
      setEditedContent(polishedContent);
    }
  };

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false);
    setEditedContent("");
    setHasChanges(false);
  };

  // ========== 渲染函数 ==========

  // ✅ 处理取消/关闭操作（带确认对话框）
  const handleCancel = () => {
    // ✅ 如果结果已生成但用户未保存，弹出确认对话框
    if (showResult && currentDiaryId) {
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
                console.log("🗑️ 用户确认放弃，删除未保存日记:", currentDiaryId);
                const { deleteDiary } = await import(
                  "../services/diaryService"
                );
                await deleteDiary(currentDiaryId);
              } catch (deleteError) {
                console.log("⚠️ 删除未保存日记失败（可忽略）:", deleteError);
              } finally {
                // ✅ 清除草稿
                await AsyncStorage.removeItem(AUTO_SAVE_KEY).catch(console.error);
                // 重置状态并关闭
                setCurrentDiaryId(null);
                setShowResult(false);
                setIsProcessing(false);
                setContent("");
                setPolishedContent("");
                setTitle("");
                setAiFeedback("");
                setEmotionData(undefined);
                setIsEditing(false);
                setHasChanges(false);
                setEditedContent("");
                hasUnsavedContentRef.current = false;
                onCancel();
              }
            },
          },
        ]
      );
      return; // 等待用户确认
    }

    // ✅ 如果有未保存的输入内容，提示用户
    if (hasUnsavedContentRef.current && content.trim() && !showResult) {
      Alert.alert(
        t("draft.unsavedTitle") || "有未保存的内容",
        t("draft.unsavedMessage") || "您输入的内容尚未保存，退出后内容将保存在草稿中，下次打开时可恢复。",
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("common.confirm") || "确定",
            onPress: () => {
              // 草稿已自动保存，直接关闭
              setCurrentDiaryId(null);
              setShowResult(false);
              setIsProcessing(false);
              setContent("");
              setPolishedContent("");
              setTitle("");
              setAiFeedback("");
              setEmotionData(undefined);
              setIsEditing(false);
              setHasChanges(false);
              setEditedContent("");
              hasUnsavedContentRef.current = false;
              onCancel();
            },
          },
        ]
      );
      return;
    }

    // ✅ 如果没有结果或已保存，直接取消并清除草稿
    AsyncStorage.removeItem(AUTO_SAVE_KEY).catch(console.error);
    setCurrentDiaryId(null);
    setShowResult(false);
    setIsProcessing(false);
    setContent("");
    setPolishedContent("");
    setTitle("");
    setAiFeedback("");
    setEmotionData(undefined);
    setIsEditing(false);
    setHasChanges(false);
    setEditedContent("");
    hasUnsavedContentRef.current = false;
    onCancel();
  };

  // 渲染结果页 Header
  const renderResultHeader = () => {
    const isEditingState = isEditing;

    return (
      <View style={styles.resultHeader}>
        <TouchableOpacity
          onPress={isEditingState ? cancelEditing : handleCancel}
          style={styles.resultHeaderButton}
        >
          {isEditingState ? (
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

        <Text
          style={[
            styles.resultHeaderTitle,
            {
              fontFamily: getFontFamilyForText(
                isEditingState ? t("common.edit") : t("diary.yourEntry"),
                "regular"
              ),
            },
          ]}
        >
          {isEditingState ? t("common.edit") : t("diary.yourEntry")}
        </Text>

        {isEditingState ? (
          <TouchableOpacity
            onPress={finishEditing}
            style={styles.resultHeaderButton}
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

  // 渲染输入界面
  const renderInputView = () => {
    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onCancel}
            accessibilityLabel={t("common.close")}
            accessibilityHint={t("accessibility.button.closeHint")}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                    t("createTextDiary.title"),
                    "medium"
                  ),
                },
              ]}
            >
              {t("createTextDiary.title")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerDoneButton}
            onPress={handleTextSubmit}
            accessibilityLabel={t("common.done")}
            accessibilityHint={t("accessibility.button.continueHint")}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.headerDoneButtonText,
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
        </View>
        <View style={styles.headerDivider} />

        {/* ✅ 使用 KeyboardAvoidingView 确保输入区域在键盘上方可见 */}
        <KeyboardAvoidingView
          style={styles.inputArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.inputScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    fontFamily: getFontFamilyForText(content, "regular"),
                  },
                ]}
                placeholder={t("createTextDiary.textPlaceholder")}
                placeholderTextColor="#999"
                value={content}
                onChangeText={setContent}
                multiline
                autoFocus
                maxLength={2000}
                accessibilityLabel={t("createTextDiary.textPlaceholder")}
                accessibilityHint={t("accessibility.input.textHint")}
                accessibilityRole="text"
              />

              <Text
                style={[
                  styles.charCount,
                  !isTextValid && content.length > 0 && styles.charCountWarning,
                ]}
              >
                {content.length}/2000
              </Text>

              {/* ✅ 自动保存指示器 */}
              {lastSaved && content.trim() && !showResult && (
                <Text style={styles.savedIndicator}>
                  💾 {t("draft.lastSaved") || "已自动保存"} {lastSaved.toLocaleTimeString()}
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  };

  // 渲染结果界面
  const renderResultView = () => {
    if (!showResult) return null;

    return (
      <>
        {renderResultHeader()}

        {/* ✅ 可滚动内容 - 包裹键盘避让（与 RecordingModal 保持一致） */}
        <KeyboardAvoidingView
          style={{ flexShrink: 1 }}
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
            {isProcessing ? (
              // ✅ 占位，实际显示在Modal中
              <View style={{ flex: 1 }} />
            ) : (
              <>
                <DiaryResultView
                  title={title}
                  polishedContent={polishedContent}
                  aiFeedback={aiFeedback}
                  emotionData={emotionData} // ✅ 传递情绪数据
                  language={t("common.save") === "Save" ? "en" : "zh"}
                  isEditingTitle={false} // TextInputModal 暂时不支持编辑标题，保持一致
                  isEditingContent={isEditing}
                  editedContent={editedContent}
                  onStartContentEditing={startEditing}
                  onContentChange={(text) => {
                    setEditedContent(text);
                    setHasChanges(text !== polishedContent);
                  }}
                />
                <View style={{ height: 100 }} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 底部保存按钮（与 RecordingModal 保持一致） */}
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
        onRequestClose={handleCancel}
      >
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={showResult ? undefined : handleCancel}
          />

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.modal,
                // ✅ 根据状态动态调整高度
                showResult
                  ? isProcessing
                    ? styles.modalProcessing // 加载状态：固定高度
                    : styles.modalResult // 结果状态：根据内容动态调整
                  : styles.modalInput, // 输入状态：最大高度
                {
                  transform: [{ translateY: Animated.add(slideAnim, dragY) }],
                },
              ]}
            >
              {showResult ? renderResultView() : renderInputView()}

              {/* Toast 提示 */}
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
  },
  // ✅ 输入状态：最大高度（键盘弹出时充分利用屏幕）
  modalInput: {
    height: SCREEN_HEIGHT - 80,
    maxHeight: SCREEN_HEIGHT - 80,
  },
  // ✅ 加载状态：固定高度（与语音处理保持一致）
  modalProcessing: {
    height: 640,
    minHeight: 640,
    maxHeight: 640,
  },
  // ✅ 结果状态：折中方案 - 75% 默认高度
  modalResult: {
    minHeight: "75%",
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // ✅ 还原为 20px
    paddingVertical: 16,
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
  headerDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerDoneButtonText: {
    ...Typography.body,
    color: "#E56C45",
    fontWeight: "600",
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20,
    marginBottom: 20, // ✅ 遵循只设置 marginBottom 的原则，通过这里控制下方间距
  },
  inputArea: {
    flex: 1,
  },
  inputScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0, // ✅ 移除 paddingTop，由上方组件的 marginBottom 控制
    paddingBottom: 40,
  },
  inputContainer: {
    position: "relative",
    marginBottom: 12,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    paddingBottom: 40,
    color: "#1A1A1A",
    textAlignVertical: "top",
    minHeight: 300,
  },
  charCount: {
    position: "absolute",
    right: 16,
    bottom: 12,
    ...Typography.caption,
    fontSize: 12,
    color: "#999",
  },
  charCountWarning: {
    color: "#E56C45",
  },
  savedIndicator: {
    position: "absolute",
    left: 16,
    bottom: 12,
    ...Typography.caption,
    fontSize: 11,
    color: "#999",
  },
  // ===== 结果页样式（与 RecordingModal 一致）=====
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // ✅ 还原为 20px
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
  resultScrollView: {
    flexShrink: 1, // ✅ 允许收缩以适应内容
  },
  resultScrollContent: {
    paddingHorizontal: 20, // ✅ 还原为 20px
    paddingTop: 16, // ✅ 分割线下方间距统一为 16px
    paddingBottom: 20, // ✅ 增加底部间距，确保内容不会被底部按钮遮挡
  },
  resultBottomBar: {
    paddingHorizontal: 20, // ✅ 还原为 20px
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
    fontWeight: "600",
  },
  // ===== Toast =====
  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: "30%",
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
});
