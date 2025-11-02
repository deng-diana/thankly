/**
 * 创建日记页面 - 文字输入
 *
 * 功能：支持文字输入创建日记
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Typography } from "../styles/typography";

import { createTextDiary, updateDiary } from "../services/diaryService";
import { t } from "../i18n";
import ProcessingAnimation from "../components/ProcessingAnimation";
import DiaryResultView from "../components/DiaryResultView";

export default function CreateTextDiaryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ========== 状态管理 ==========
  const [content, setContent] = useState("");
  const [polishedContent, setPolishedContent] = useState("");
  const [title, setTitle] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");

  // 文字输入相关状态
  const [isProcessing, setIsProcessing] = useState(false); // AI处理状态
  const [showSaveButton, setShowSaveButton] = useState(false); // 是否显示保存按钮
  const [textSubmitted, setTextSubmitted] = useState(false); // 文字是否已提交处理

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [currentDiaryId, setCurrentDiaryId] = useState<string | null>(null);

  // Toast 状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 处理步骤状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 文字输入的处理步骤（跳过语音上传和转录，直接从润色开始）
  const processingSteps = [
    { icon: "✨", text: t("diary.processingSteps.polish"), duration: 3000 },
    { icon: "💭", text: t("diary.processingSteps.title"), duration: 2000 },
    { icon: "💬", text: t("diary.processingSteps.feedback"), duration: 2000 },
  ];

  // ========== 副作用 ==========
  // 清理进度动画定时器
  useEffect(() => {
    return () => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, []);

  // ========== 文字输入相关函数 ==========

  // 平滑更新进度条
  const smoothUpdateProgress = useCallback(
    (target: number, speed: number = 0.8) => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
      }

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
            return current + 0.2;
          }

          // 微增长阶段:超过目标后继续慢慢爬
          if (current < 99) {
            return current + 0.05;
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

    // 返回清理函数
    return () => {
      stepTimers.forEach((timer) => clearTimeout(timer));
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  };

  // ========== 文字输入相关函数 ==========
  const MIN_TEXT_LENGTH = 10; // 最少10个字符
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
      // ✅ 立即进入处理状态（与语音输入一致的体验）
      setIsProcessing(true);
      setTextSubmitted(true);
      setSubmitted(true);

      console.log("📝 提交文字到后端处理...");

      // ✅ 启动步骤动画（文字输入专用步骤，更快）
      const cleanupSteps = simulateProcessingSteps();

      try {
        // 调用后端API
        const diary = await createTextDiary({
          content: content.trim(),
        });

        console.log("✅ 后端返回:", diary);

        // 如果进度小于100%，等待动画完成
        if (processingProgress < 100) {
          console.log(`⏳ 当前进度${processingProgress}%,等待到100%`);
          // 快速推进到100%
          smoothUpdateProgress(100, 2.0);
          // 等待1秒让动画完成
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // 停止模拟
        cleanupSteps && cleanupSteps();

        // 设置处理结果
        setContent(diary.original_content);
        setPolishedContent(diary.polished_content);
        setTitle(diary.title || "");
        setAiFeedback(diary.ai_feedback);
        setCurrentDiaryId(diary.diary_id);
        setShowSaveButton(true);

        setIsProcessing(false);

        console.log("✅ 文字处理完成");
      } catch (error: any) {
        // 停止模拟（错误时）
        cleanupSteps && cleanupSteps();
        throw error;
      }
    } catch (error: any) {
      console.error("❌ 处理失败:", error);

      setIsProcessing(false);
      setTextSubmitted(false);
      setSubmitted(false);

      // 显示错误信息
      let errorMessage = t("diary.processingFailed");
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(t("error.genericError"), errorMessage);
    }
  };

  // ✅ 编辑完成（与 RecordingModal 的 finishEditing 一致）
  const handleSave = async () => {
    try {
      console.log("💾 编辑完成,开始保存...");

      // ✅ 如果有修改，先保存修改
      if (isEditing && hasChanges && currentDiaryId && editedContent.trim()) {
        console.log("📝 保存用户编辑的内容:", editedContent);

        // 调用后端API更新日记
        await updateDiary(
          currentDiaryId,
          editedContent !== polishedContent ? editedContent : undefined
        );

        setPolishedContent(editedContent);
        setIsEditing(false);
        setHasChanges(false);
      }

      // ✅ 直接保存并返回列表页（与 RecordingModal 一致）
      await handleSaveAndReturn();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
      setSaving(false);
    }
  };

  // ✅ 保存并返回日记列表（与 RecordingModal 完全一致）
  const handleSaveAndReturn = async () => {
    try {
      setSaving(true);
      console.log("💾 保存并返回日记列表...");

      // ✅ 如果用户编辑了内容，先调用后端API更新
      if (isEditing && hasChanges && currentDiaryId && editedContent.trim()) {
        console.log("📝 更新日记到后端:", currentDiaryId);
        console.log("  - 内容:", editedContent.substring(0, 50) + "...");

        await updateDiary(
          currentDiaryId,
          editedContent !== polishedContent ? editedContent : undefined
        );
        console.log("✅ 后端更新成功");

        setPolishedContent(editedContent);
        setIsEditing(false);
        setHasChanges(false);
      }

      // ✅ 显示与列表删除一致风格的轻量 Toast
      showToast(t("success.diaryCreated"));

      // ✅ 短暂延迟后返回，让用户看到 Toast（和 RecordingModal 一致）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 返回日记列表（useFocusEffect 会自动刷新列表）
      navigation.goBack();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
    } finally {
      setSaving(false);
    }
  };

  // ✅ 开始编辑润色后的内容
  const startEditing = () => {
    if (!isEditing) {
      setIsEditing(true);
      setEditedContent(polishedContent);
    }
  };

  const handleGoBack = async () => {
    // ✅ 如果用户正在编辑，提示是否保存
    if (isEditing && hasChanges) {
      Alert.alert(t("diary.unsavedChanges"), t("diary.unsavedChangesMessage"), [
        {
          text: t("diary.dontSave"),
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
        {
          text: t("common.save"),
          onPress: async () => {
            try {
              await handleSave();
              navigation.goBack();
            } catch (error) {
              console.error("保存失败，不导航:", error);
            }
          },
        },
      ]);
      return;
    }

    // 直接返回
    navigation.goBack();
  };

  // ========== 渲染 ==========

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("createTextDiary.title")}</Text>
        </View>

        {/* 完成按钮（仅在编辑模式下显示） */}
        {submitted && isEditing && (
          <TouchableOpacity style={styles.doneButton} onPress={handleSave}>
            <Text style={styles.doneButtonText}>{t("common.done")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 主要内容 */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!submitted ? (
            <View style={styles.inputSection}>
              {/* 文字输入界面 */}
              <View style={styles.textSection}>
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

                  {/* 字数计数器在输入框内右下角 */}
                  <Text
                    style={[
                      styles.charCount,
                      !isTextValid &&
                        content.length > 0 &&
                        styles.charCountWarning,
                    ]}
                  >
                    {content.length}/500
                  </Text>
                </View>

                {/* 完成按钮 - 始终显示 */}
                {!textSubmitted && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={handleTextSubmit}
                  >
                    <Text style={styles.completeButtonText}>
                      {t("common.done")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            /* 结果展示 */
            <View style={styles.resultSection}>
              {/* AI处理状态 - 使用共享组件 */}
              {isProcessing ? (
                <ProcessingAnimation
                  processingStep={processingStep}
                  processingProgress={processingProgress}
                  steps={processingSteps}
                />
              ) : (
                <>
                  {/* 日记结果 - 使用共享组件 */}
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
                </>
              )}

              {/* 底部间距 */}
              <View style={{ height: 100 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部保存按钮 */}
      {showSaveButton && !isProcessing && (
        <View style={styles.resultBottomBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAndReturn}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                {t("diary.saveToJournal")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Toast 提示 - 使用全屏容器确保居中 */}
      {toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FAF6ED",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    padding: 4,
  },

  headerTitle: {
    ...Typography.sectionTitle,
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },

  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#D96F4C",
    borderRadius: 20,
  },

  doneButtonText: {
    ...Typography.body,
    color: "#fff",
  },

  content: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  inputSection: {
    flex: 1,
  },

  textSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
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

  resultSection: {
    paddingTop: 16,
  },

  // ===== 底部保存按钮栏 =====
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

  // ===== Toast（居中显示）=====
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
