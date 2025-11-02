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
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import { createTextDiary, updateDiary } from "../services/diaryService";
import { t } from "../i18n";
import { Typography } from "../styles/typography";
import ProcessingAnimation from "./ProcessingAnimation";
import DiaryResultView from "./DiaryResultView";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

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

      // 重置状态
      setContent("");
      setPolishedContent("");
      setTitle("");
      setAiFeedback("");
      setIsProcessing(false);
      setShowResult(false);
      setIsEditing(false);
      setHasChanges(false);
      setEditedContent("");
      setCurrentDiaryId(null);
      setProcessingStep(0);
      setProcessingProgress(0);
    }
  }, [visible]);

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
        onCancel();
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

  // 平滑更新进度条
  const smoothUpdateProgress = useCallback(
    (target: number, speed: number = 0.8) => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
      }

      progressAnimationRef.current = setInterval(() => {
        setProcessingProgress((current) => {
          if (current < target - 1) {
            const diff = target - current;
            const step = Math.min(speed, diff);
            return current + step;
          }
          if (current < target) {
            return current + 0.2;
          }
          if (current < 99) {
            return current + 0.05;
          }
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

  // 模拟处理步骤
  const simulateProcessingSteps = () => {
    setProcessingStep(0);
    setProcessingProgress(0);

    const totalSteps = processingSteps.length;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    let accumulatedTime = 0;

    processingSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        setProcessingStep(index);
        const targetProgress = ((index + 1) / totalSteps) * 100;
        smoothUpdateProgress(targetProgress, 0.8);
      }, accumulatedTime);

      stepTimers.push(timer);
      accumulatedTime += step.duration;
    });

    return () => {
      stepTimers.forEach((timer) => clearTimeout(timer));
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
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

        if (processingProgress < 100) {
          smoothUpdateProgress(100, 2.0);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        cleanupSteps && cleanupSteps();

        setContent(diary.original_content);
        setPolishedContent(diary.polished_content || diary.original_content || "");
        setTitle(diary.title || "");
        setAiFeedback(diary.ai_feedback || "");
        setCurrentDiaryId(diary.diary_id);

        console.log("📊 设置的结果数据:");
        console.log("  - title:", diary.title);
        console.log("  - polishedContent:", diary.polished_content?.substring(0, 50));
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

      // 显示 Toast
      showToast(t("success.diaryCreated"));

      // 短暂延迟后关闭
      await new Promise((resolve) => setTimeout(resolve, 500));

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

  // 渲染结果页 Header
  const renderResultHeader = () => {
    const isEditingState = isEditing;

    return (
      <View style={styles.resultHeader}>
        <TouchableOpacity
          onPress={isEditingState ? cancelEditing : onCancel}
          style={styles.resultHeaderButton}
        >
          {isEditingState ? (
            <Text style={styles.resultHeaderButtonText}>
              {t("common.cancel")}
            </Text>
          ) : (
            <Ionicons name="close-outline" size={24} color="#666" />
          )}
        </TouchableOpacity>

        <Text style={styles.resultHeaderTitle}>
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
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <Ionicons name="close-outline" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>{t("createTextDiary.title")}</Text>
          <View style={styles.headerRight} />
        </View>

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
            <Text style={styles.promptText}>
              {t("createTextDiary.promptTitle")}
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={t("createTextDiary.textPlaceholder")}
                placeholderTextColor="#999"
                value={content}
                onChangeText={setContent}
                multiline
                autoFocus
                maxLength={500}
              />

              <Text
                style={[
                  styles.charCount,
                  !isTextValid && content.length > 0 && styles.charCountWarning,
                ]}
              >
                {content.length}/500
              </Text>
            </View>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleTextSubmit}
            >
              <Text style={styles.completeButtonText}>{t("common.done")}</Text>
            </TouchableOpacity>
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

        {/* ✅ 加载状态：使用 flex: 1 占满固定高度 */}
        {/* ✅ 结果状态：使用 flexGrow 让内容自适应高度 */}
        <KeyboardAvoidingView
          style={isProcessing ? { flex: 1 } : { flexGrow: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <ScrollView
            style={isProcessing ? styles.resultScrollView : styles.resultScrollViewFlexible}
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isProcessing ? (
              <ProcessingAnimation
                processingStep={processingStep}
                processingProgress={processingProgress}
                steps={processingSteps}
              />
            ) : (
              <>
                <DiaryResultView
                  title={title}
                  polishedContent={polishedContent}
                  aiFeedback={aiFeedback}
                  isEditing={isEditing}
                  editedContent={editedContent}
                  onStartEditing={startEditing}
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

        {!isProcessing && (
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
        )}
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
            onPress={showResult ? undefined : onCancel}
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
  // ✅ 结果状态：根据内容动态调整（最小高度640，最大不超过屏幕高度）
  modalResult: {
    minHeight: 640,
    maxHeight: SCREEN_HEIGHT - 80,
    // 不设置固定 height，让内容决定高度
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  inputArea: {
    flex: 1,
  },
  inputScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40, // ✅ 增加底部间距，确保按钮在键盘上方可见
  },
  promptText: {
    ...Typography.sectionTitle,
    fontSize: 18,
    fontWeight: "500",
    color: "#1A1A1A",
    marginBottom: 12,
    marginTop: 12,
  },
  inputContainer: {
    position: "relative",
    marginBottom: 12,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: "#F5EDDB",
    borderRadius: 12,
    padding: 16,
    paddingBottom: 40,
    color: "#1A1A1A",
    textAlignVertical: "top",
    minHeight: 200,
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
    color: "#D96F4C",
  },
  completeButton: {
    backgroundColor: "#D96F4C",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  completeButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  // ===== 结果页样式（与 RecordingModal 一致）=====
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
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
    color: "#D96F4C",
  },
  resultScrollView: {
    flex: 1, // ✅ 加载状态时使用（固定高度）
  },
  // ✅ 结果状态：使用 flexGrow 让内容自适应，而不是固定 flex: 1
  resultScrollViewFlexible: {
    flexGrow: 1,
    flexShrink: 1,
  },
  resultScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20, // ✅ 增加底部间距，确保内容不会被底部按钮遮挡
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
});

