/**
 * 日记详情页面
 *
 * 设计理念:
 * - 展示完整的日记内容
 * - 显示AI反馈和所有元数据
 * - 支持音频播放
 * - 多语言支持
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing,
  Pressable,
  TextInput, // ✅ 添加
  KeyboardAvoidingView, // ✅ 添加
  Platform, // ✅ 添加
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { getDiaryDetail } from "../services/diaryService";
import { updateDiary } from "../services/diaryService"; // ✅ 添加
import AudioPlayer from "../components/AudioPlayer";

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";
import { Typography } from "../styles/typography";

/**
 * 日记数据类型定义
 */
interface Diary {
  diary_id: string;
  created_at: string;
  date: string;
  language: string;
  title: string;
  original_content: string;
  polished_content: string;
  ai_feedback: string;
  audio_url?: string;
  audio_duration?: number;
}

interface DiaryDetailScreenProps {
  diaryId: string;
  onClose: () => void;
  onUpdate?: () => void; // ✅ 新增:更新回调
}

/**
 * 日记详情页面组件
 */
export default function DiaryDetailScreen({
  diaryId,
  onClose,
  onUpdate, // ✅ 新增
}: DiaryDetailScreenProps) {
  // ========== 状态管理 ==========
  const [diary, setDiary] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 音频播放相关状态
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // ✅ 新增:编辑相关状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");

  // ✅ 新增:保存状态保护
  const isSavingRef = useRef(false);

  // ✅ 新增:Toast状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ✅ 轻量 Toast（iOS 自绘，Android 可替换为 ToastAndroid）
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  };

  // ========== 生命周期 ==========
  useEffect(() => {
    loadDiaryDetail();

    // 组件卸载时清理音频
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.log);
      }
    };
  }, []);

  // ========== 数据加载 ==========
  const loadDiaryDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📖 加载日记详情:", diaryId);

      const diaryData = await getDiaryDetail(diaryId);
      setDiary(diaryData);
    } catch (error: any) {
      console.error("❌ 加载日记详情失败:", error);
      setError(error.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  // ========== 编辑相关函数 ==========

  /**
   * 开始编辑标题
   */
  const startEditingTitle = () => {
    if (!diary) return;
    setEditedTitle(diary.title);
    setIsEditingTitle(true);
  };

  /**
   * 开始编辑内容
   */
  const startEditingContent = () => {
    if (!diary) return;
    setEditedContent(diary.polished_content);
    setIsEditingContent(true);
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
   * 完成编辑 - 保存到后端并关闭Modal
   */
  const finishEditing = async () => {
    if (!diary) return;

    // ✅ 防止重复调用
    if (isSavingRef.current) {
      console.log("⏳ 正在保存中，跳过重复调用");
      return;
    }
    isSavingRef.current = true;

    try {
      console.log("💾 保存到后端...");

      // ✅ 检查是否有修改
      const hasTitleChange = isEditingTitle && editedTitle.trim() !== diary.title;
      const hasContentChange = isEditingContent && editedContent.trim() !== diary.polished_content;

      // ✅ 如果有修改，调用后端API更新
      if (hasTitleChange || hasContentChange) {
        console.log("📝 更新日记到后端:", diary.diary_id);
        console.log("  - 标题变化:", hasTitleChange);
        console.log("  - 内容变化:", hasContentChange);

        await updateDiary(
          diary.diary_id,
          hasContentChange ? editedContent.trim() : undefined,
          hasTitleChange ? editedTitle.trim() : undefined
        );

        console.log("✅ 后端更新成功");

        // ✅ 更新本地状态
        if (hasTitleChange) {
          setDiary({ ...diary, title: editedTitle.trim() });
        }
        if (hasContentChange) {
          setDiary({ ...diary, polished_content: editedContent.trim() });
        }
      } else {
        console.log("📝 没有修改，跳过更新");
      }

      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle("");
      setEditedContent("");

      console.log("✅ 保存成功");

      // ✅ 显示Toast提示
      showToast(t("success.saved"));

      // ✅ 通知父组件刷新列表
      if (onUpdate) {
        onUpdate();
      }

      // ✅ 关闭Modal
      closeSheet();
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

  // ========== 音频播放 ==========
  const handlePlayAudio = async () => {
    if (!diary?.audio_url) return;

    try {
      // 如果正在播放，则暂停
      if (currentPlayingId === diary.diary_id) {
        if (soundRef.current) {
          await soundRef.current.pauseAsync();
          setCurrentPlayingId(null);
        }
        return;
      }

      // 停止当前播放的音频
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 创建新的音频播放器
      const { sound } = await Audio.Sound.createAsync(
        { uri: diary.audio_url },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setCurrentPlayingId(diary.diary_id);

      // 监听播放状态更新
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const durationMillis = status.durationMillis;
          const positionMillis = status.positionMillis;

          if (durationMillis !== undefined && positionMillis !== undefined) {
            setCurrentTime(Math.floor(positionMillis / 1000));
            setDuration(Math.floor(durationMillis / 1000));
          }

          // 播放完成
          if (status.didJustFinish) {
            setCurrentPlayingId(null);
            setCurrentTime(0);
            sound.unloadAsync();
            soundRef.current = null;
          }
        }
      });
    } catch (error: any) {
      console.error("❌ 播放失败:", error);
      Alert.alert(
        t("error.playbackFailed"),
        error.message || t("error.retryMessage")
      );
    }
  };

  // ========== 工具函数 ==========
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const formatted = formatter.format(date);
    return locale === "en" ? formatted.replace(",", "") : formatted;
  };

  const formatAudioDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatProgress = (current: number, total: number): string => {
    return `${formatAudioDuration(current)} / ${formatAudioDuration(total)}`;
  };

  // ========== 渲染Header ==========

  /**
   * 渲染详情页Header
   */
  const renderDetailHeader = () => {
    const isEditing = isEditingTitle || isEditingContent;

    return (
      <View style={styles.detailHeader}>
        {isEditing ? (
          // 编辑模式
          <>
            <TouchableOpacity
              onPress={cancelEditing}
              style={styles.detailHeaderButton}
            >
              <View style={styles.cancelButtonContent}>
                <Ionicons name="arrow-back" size={20} color="#666" />
                <Text style={styles.detailHeaderButtonText}>
                  {t("common.cancel")}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.detailHeaderTitle}>{t("common.edit")}</Text>

            <TouchableOpacity
              onPress={finishEditing}
              style={styles.detailHeaderButton}
            >
              <Text style={[styles.detailHeaderButtonText, styles.saveText]}>
                {t("common.done")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          // 预览模式
          <>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.dateText}>
                {diary ? formatDateTime(diary.created_at) : ""}
              </Text>
            </View>

            <TouchableOpacity onPress={closeSheet} style={styles.closeButton}>
              <Ionicons name="close-outline" size={24} color="#666" />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ========== 渲染函数 ==========
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E56C45" />
      <Text style={styles.loadingText}>加载中...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
      <Text style={styles.errorTitle}>加载失败</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadDiaryDetail}>
        <Text style={styles.retryButtonText}>重试</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiaryDetail = () => {
    if (!diary) return null;

    return (
      <>
        {/* 音频播放器 */}
        {diary.audio_url && (
          <AudioPlayer
            audioUrl={diary.audio_url}
            audioDuration={diary.audio_duration}
            isPlaying={currentPlayingId === diary.diary_id}
            currentTime={currentTime}
            totalDuration={duration}
            onPlayPress={handlePlayAudio}
            style={styles.audioSection}
          />
        )}

        {/* 日记内容卡片 - 可编辑 */}
        <View style={styles.diaryCard}>
          {/* 标题 */}
          {isEditingTitle ? (
            <TextInput
              style={styles.editTitleInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              autoFocus
              multiline
              placeholder="输入标题..."
              scrollEnabled={false}
              accessibilityLabel={t("diary.placeholderTitle")}
              accessibilityHint={t("accessibility.input.textHint")}
              accessibilityRole="text"
            />
          ) : (
            <TouchableOpacity
              onPress={startEditingTitle}
              activeOpacity={0.7}
              accessibilityLabel={diary.title}
              accessibilityHint={t("accessibility.button.editHint")}
              accessibilityRole="button"
            >
              <Text style={styles.titleText}>{diary.title}</Text>
            </TouchableOpacity>
          )}

          {/* 内容 */}
          {isEditingContent ? (
            <TextInput
              style={styles.editContentInput}
              value={editedContent}
              onChangeText={setEditedContent}
              autoFocus
              multiline
              placeholder="输入内容..."
              scrollEnabled={true}
              textAlignVertical="top"
              accessibilityLabel={t("diary.placeholderContent")}
              accessibilityHint={t("accessibility.input.textHint")}
              accessibilityRole="text"
            />
          ) : (
            <TouchableOpacity
              onPress={startEditingContent}
              activeOpacity={0.7}
              accessibilityLabel={diary.polished_content.substring(0, 100) + (diary.polished_content.length > 100 ? "..." : "")}
              accessibilityHint={t("accessibility.button.editHint")}
              accessibilityRole="button"
            >
              <Text style={styles.contentText}>{diary.polished_content}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI反馈 - 编辑时隐藏 */}
        {!isEditingTitle && !isEditingContent && (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <Ionicons name="sparkles" size={18} color="#E56C45" />
              <Text style={styles.feedbackTitle}>
                {t("diary.aiFeedbackTitle")}
              </Text>
            </View>
            <Text style={styles.feedbackText}>{diary.ai_feedback}</Text>
          </View>
        )}
      </>
    );
  };

  // ====== 底部上弹动画 ======
  const slideY = useRef(new Animated.Value(300)).current;
  const [visible, setVisible] = useState(false);
  const windowHeight = Dimensions.get("window").height;
  const MAX_SHEET_RATIO = 0.85;
  const maxSheetHeight = Math.round(windowHeight * MAX_SHEET_RATIO);
  const MIN_SHEET_HEIGHT = 160;
  const [contentHeight, setContentHeight] = useState(0);

  // ✅ 动态高度:编辑时用最大高度,预览时自适应
  const isEditing = isEditingTitle || isEditingContent;
  const sheetHeight = isEditing
    ? maxSheetHeight // 编辑模式:使用最大高度
    : Math.max(Math.min(contentHeight, maxSheetHeight), MIN_SHEET_HEIGHT); // 预览模式:自适应

  useEffect(() => {
    setVisible(true);
    Animated.timing(slideY, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const closeSheet = () => {
    Animated.timing(slideY, {
      toValue: 300,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => onClose());
  };

  // ========== 主渲染 ==========
  return (
    <View style={styles.container}>
      {/* 黑色遮罩：静态全屏，点击关闭 */}
      <Pressable style={styles.overlay} onPress={closeSheet} />

      {/* 底部卡片：与ActionSheet一致，仅底部上弹 */}
      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ translateY: slideY }],
            height: sheetHeight,
            maxHeight: maxSheetHeight,
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          {loading ? (
            renderLoading()
          ) : error ? (
            renderError()
          ) : (
            <>
              {/* ✅ 拖拽指示器移到最顶部 */}
              <View style={styles.dragIndicator} />

              {/* ✅ 添加Header */}
              {renderDetailHeader()}

              {/* ✅ 包裹KeyboardAvoidingView */}
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
              >
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_, h) => setContentHeight(h + 24)}
                  bounces
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                >
                  {/* 拖拽指示器 */}
                  {renderDiaryDetail()}
                </ScrollView>
              </KeyboardAvoidingView>
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* iOS 轻量 Toast 提示 - 使用全屏容器确保居中 */}
      {Platform.OS === "ios" && toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ========== 样式定义 ==========
const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  modal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },

  safeArea: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // 固定底部间距
  },

  // ===== 加载状态 =====
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },

  // ===== 错误状态 =====
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: 16,
    marginBottom: 8,
  },

  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },

  retryButton: {
    backgroundColor: "#E56C45",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // ===== 拖拽指示器 =====
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: "#E5E5E5",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 12,
  },

  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  dateText: {
    ...Typography.caption,
    color: "#666",
  },

  // ===== 音频区域 =====
  audioSection: {
    marginHorizontal: 20,
    marginTop: 16, // ✅ 增加顶部间距
    marginBottom: 12, // 减少底部间距，让音频和内容卡片更近
  },

  // ===== 日记内容卡片 =====
  diaryCard: {
    backgroundColor: "#FAF6ED", // 米白色卡片背景
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    //borderWidth: 1,
    borderColor: "#E8E0D0",
  },

  titleText: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  contentText: {
    ...Typography.body,
    lineHeight: 26,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },

  // ===== AI反馈区域 - 与语音记录页保持一致 =====
  feedbackCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFECE5",
  },

  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  feedbackTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: "#E56C45",
    marginLeft: 6,
  },

  feedbackText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: "#1A1A1A",
  },

  // ===== 详情页Header =====
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "transparent",
  },
  detailHeaderButton: {
    minWidth: 44,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  detailHeaderButtonText: {
    ...Typography.body,
    fontSize: 17,
    color: "#666",
  },
  detailHeaderTitle: {
    ...Typography.sectionTitle,
    fontSize: 17,
    color: "#1A1A1A",
  },
  cancelButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveText: {
    color: "#E56C45",
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  // ===== 编辑输入框 =====
  editTitleInput: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  editContentInput: {
    ...Typography.body,
    lineHeight: 26,
    color: "#1A1A1A",
    letterSpacing: 0.2,
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 200,
    maxHeight: 400,
    textAlignVertical: "top",
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
});
