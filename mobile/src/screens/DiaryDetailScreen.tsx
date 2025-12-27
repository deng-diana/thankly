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
  Image, // ✅ 添加：用于显示图片
  FlatList, // ✅ 添加：用于图片轮播
  Modal, // ✅ 添加：用于全屏图片查看器
} from "react-native";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
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
  image_urls?: string[]; // 图片URL数组
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
      const hasTitleChange =
        isEditingTitle && editedTitle.trim() !== diary.title;
      const hasContentChange =
        isEditingContent && editedContent.trim() !== diary.polished_content;

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
    const isImageOnly = isImageOnlyDiary();

    // 纯图片日记：显示完整 header（绝对定位在顶部）
    if (isImageOnly) {
      return (
        <View style={styles.imageOnlyHeader}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {diary ? formatDateTime(diary.created_at) : ""}
            </Text>
          </View>

          <TouchableOpacity onPress={closeSheet} style={styles.closeButton}>
            <Ionicons name="close-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      );
    }

    // 普通日记：显示完整 header
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

  // 检测是否为纯图片日记
  const isImageOnlyDiary = () => {
    if (!diary) return false;
    const hasImages = diary.image_urls && diary.image_urls.length > 0;
    const hasNoContent =
      !diary.polished_content || diary.polished_content.trim() === "";
    const hasNoTitle = !diary.title || diary.title.trim() === "";
    return hasImages && hasNoContent && hasNoTitle;
  };

  // 图片轮播当前索引状态
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ✅ 全屏图片查看器状态
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);
  // ✅ 新增：缩略图位置信息（用于动画）
  const [thumbnailLayout, setThumbnailLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const thumbnailRefs = useRef<{ [key: number]: View | null }>({});

  const renderDiaryDetail = () => {
    if (!diary) return null;

    // 如果是纯图片日记，只显示图片轮播
    if (isImageOnlyDiary()) {
      const imageUrls = diary.image_urls || [];

      // 调试：检查图片数据
      if (imageUrls.length === 0) {
        console.warn("⚠️ 纯图片日记但没有图片URLs");
      }

      return (
        <View style={styles.imageOnlyContainer}>
          {/* Header 在顶部（绝对定位） */}
          {renderDetailHeader()}

          <FlatList
            data={imageUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => {
              console.log("🖼️ 渲染图片:", item);
              return (
                <View
                  style={[
                    styles.imageSlide,
                    {
                      maxHeight: MAX_IMAGE_HEIGHT,
                      height: MAX_IMAGE_HEIGHT, // 明确设置容器高度
                    },
                  ]}
                >
                  <Image
                    source={{ uri: item }}
                    style={{
                      width: windowWidth,
                      height: MAX_IMAGE_HEIGHT,
                      maxWidth: windowWidth,
                      maxHeight: MAX_IMAGE_HEIGHT,
                    }}
                    resizeMode="contain"
                    onLoad={() => {
                      console.log("✅ 图片加载成功:", item);
                    }}
                    onError={(error) => {
                      console.error(
                        "❌ 图片加载失败:",
                        item,
                        error.nativeEvent.error
                      );
                    }}
                  />
                </View>
              );
            }}
            style={[
              styles.imageList,
              {
                paddingTop: Platform.OS === "ios" ? 52 : 40, // header 实际高度：44 + 8 = 52px
                paddingBottom: Platform.OS === "ios" ? 50 : 30,
              },
            ]}
            contentContainerStyle={{ flexGrow: 1 }}
            getItemLayout={(data, index) => ({
              length: Dimensions.get("window").width,
              offset: Dimensions.get("window").width * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x /
                  Dimensions.get("window").width
              );
              setCurrentImageIndex(index);
            }}
          />

          {/* 底部点状指示器 */}
          {imageUrls.length > 1 && (
            <View style={styles.imageIndicatorContainer}>
              {imageUrls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.imageIndicatorDot,
                    index === currentImageIndex &&
                      styles.imageIndicatorDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      );
    }

    // 普通日记：显示文字内容
    return (
      <>
        {/* ✅ 图片缩略图（如果有图片）- 一行3个 */}
        {diary.image_urls && diary.image_urls.length > 0 && (
          <View style={styles.imageThumbnailContainer}>
            <View style={styles.imageThumbnailGrid}>
              {diary.image_urls.map((url, index) => (
                <TouchableOpacity
                  key={`${url}-${index}`}
                  style={[
                    styles.imageThumbnailWrapper,
                    (index + 1) % 3 === 0 && styles.imageThumbnailLastInRow, // 每行最后一个
                  ]}
                  onPress={() => {
                    // ✅ 获取缩略图位置信息（用于动画）
                    const thumbnailRef = thumbnailRefs.current[index];
                    if (thumbnailRef) {
                      thumbnailRef.measure(
                        (x, y, width, height, pageX, pageY) => {
                          setThumbnailLayout({
                            x: pageX,
                            y: pageY,
                            width,
                            height,
                          });
                          setFullScreenImageIndex(index);
                          setFullScreenImageVisible(true);
                        }
                      );
                    } else {
                      // 如果 measure 失败，直接打开（无动画）
                      setThumbnailLayout(null);
                      setFullScreenImageIndex(index);
                      setFullScreenImageVisible(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    ref={(ref) => {
                      thumbnailRefs.current[index] = ref;
                    }}
                    collapsable={false}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.imageThumbnail}
                      resizeMode="cover"
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
              accessibilityLabel={
                diary.polished_content.substring(0, 100) +
                (diary.polished_content.length > 100 ? "..." : "")
              }
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
  const windowWidth = Dimensions.get("window").width;
  const MAX_SHEET_RATIO = 0.85;
  const maxSheetHeight = Math.round(windowHeight * MAX_SHEET_RATIO);
  const MIN_SHEET_HEIGHT = 160;
  const [contentHeight, setContentHeight] = useState(0);

  // 图片显示区域最大高度（屏幕高度的 70%）
  const MAX_IMAGE_HEIGHT = Math.round(windowHeight * 0.7);

  // ✅ 动态高度:编辑时用最大高度,预览时自适应,纯图片日记全屏
  const isEditing = isEditingTitle || isEditingContent;
  const isImageOnly = isImageOnlyDiary();
  const sheetHeight = isImageOnly
    ? windowHeight // 纯图片日记:全屏显示
    : isEditing
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
      <Pressable
        style={styles.overlay}
        onPress={closeSheet}
        // 确保可以点击（纯图片日记时 modal 全屏，但 overlay 仍然在下方）
      />

      {/* 底部卡片：与ActionSheet一致，仅底部上弹 */}
      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ translateY: slideY }],
            height: sheetHeight,
            maxHeight: maxSheetHeight,
            backgroundColor: isImageOnly ? "transparent" : "#FFFFFF",
            borderTopLeftRadius: isImageOnly ? 0 : 20,
            borderTopRightRadius: isImageOnly ? 0 : 20,
          },
        ]}
        pointerEvents={isImageOnly ? "box-none" : "auto"}
      >
        <SafeAreaView
          style={styles.safeArea}
          edges={isImageOnly ? [] : ["bottom"]}
        >
          {loading ? (
            renderLoading()
          ) : error ? (
            renderError()
          ) : (
            <>
              {/* 纯图片日记：直接显示图片轮播，不使用 ScrollView */}
              {isImageOnlyDiary() ? (
                renderDiaryDetail()
              ) : (
                <>
                  {/* ✅ 添加Header */}
                  {renderDetailHeader()}
                  {/* 普通日记：使用 ScrollView */}
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
                      {renderDiaryDetail()}
                    </ScrollView>
                  </KeyboardAvoidingView>
                </>
              )}
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

      {/* ✅ 全屏图片查看器 */}
      {diary && diary.image_urls && diary.image_urls.length > 0 && (
        <FullScreenImageViewer
          visible={fullScreenImageVisible}
          imageUrls={diary.image_urls}
          initialIndex={fullScreenImageIndex}
          thumbnailLayout={thumbnailLayout}
          onClose={() => {
            setFullScreenImageVisible(false);
            // 延迟清除布局信息，确保关闭动画完成
            setTimeout(() => setThumbnailLayout(null), 300);
          }}
          onIndexChange={setFullScreenImageIndex}
        />
      )}
    </View>
  );
}

// ========== 全屏图片查看器组件 ==========
interface FullScreenImageViewerProps {
  visible: boolean;
  imageUrls: string[];
  initialIndex: number;
  thumbnailLayout: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null; // ✅ 新增：缩略图位置信息
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({
  visible,
  imageUrls,
  initialIndex,
  thumbnailLayout,
  onClose,
  onIndexChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  // ✅ 新增：存储每张图片的尺寸信息（用于等比显示）
  const [imageDimensions, setImageDimensions] = useState<{
    [key: number]: { width: number; height: number };
  }>({});

  // ✅ 动画值：用于平滑过渡
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backgroundOpacityAnim = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false); // ✅ 跟踪动画状态

  // ✅ 新增：手势缩放相关状态和动画值
  const [zoomScale, setZoomScale] = useState<{ [key: number]: number }>({});
  const [translateX, setTranslateX] = useState<{ [key: number]: number }>({});
  const [translateY, setTranslateY] = useState<{ [key: number]: number }>({});
  const scaleAnims = useRef<{ [key: number]: Animated.Value }>({});
  const translateXAnims = useRef<{ [key: number]: Animated.Value }>({});
  const translateYAnims = useRef<{ [key: number]: Animated.Value }>({});

  // ✅ 计算动画的起始和结束值
  const getAnimationValues = () => {
    if (!thumbnailLayout) {
      // 无缩略图信息：使用淡入淡出
      return {
        startScale: 0.8,
        endScale: 1,
        startX: 0,
        endX: 0,
        startY: 0,
        endY: 0,
      };
    }

    // 计算缩略图中心点（相对于屏幕）
    const thumbnailCenterX = thumbnailLayout.x + thumbnailLayout.width / 2;
    const thumbnailCenterY = thumbnailLayout.y + thumbnailLayout.height / 2;

    // 计算屏幕中心点
    const screenCenterX = windowWidth / 2;
    const screenCenterY = windowHeight / 2;

    // 计算需要移动的距离（从缩略图中心移动到屏幕中心）
    const translateX = screenCenterX - thumbnailCenterX;
    const translateY = screenCenterY - thumbnailCenterY;

    // 计算缩放比例：从缩略图尺寸放大到全屏尺寸
    // 使用较大的比例，确保图片能够填充屏幕（但保持 contain 模式）
    const scaleX = windowWidth / thumbnailLayout.width;
    const scaleY = windowHeight / thumbnailLayout.height;
    // 使用较大的比例，让图片能够放大到全屏
    const scale = Math.max(scaleX, scaleY) * 1.1; // 稍微放大一点，确保填充效果

    return {
      startScale: 1, // 从原始尺寸开始
      endScale: scale, // 放大到全屏
      startX: 0, // 从缩略图位置开始（translateX 会处理位置）
      endX: translateX, // 移动到屏幕中心
      startY: 0,
      endY: translateY,
    };
  };

  // ✅ 打开动画：从缩略图位置放大到全屏
  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
      const { startScale, endScale, startX, endX, startY, endY } =
        getAnimationValues();

      // ✅ 关键修复：确保初始值正确设置
      // 如果是从缩略图开始的动画，初始 scale 应该是缩略图相对于全屏的比例
      if (thumbnailLayout) {
        // 计算缩略图相对于全屏的初始缩放比例
        const initialScale = Math.min(
          thumbnailLayout.width / windowWidth,
          thumbnailLayout.height / windowHeight
        );
        scaleAnim.setValue(initialScale);
        // 初始位置：需要将图片从屏幕中心移动到缩略图位置
        // 所以 translate 应该是负的移动距离
        const thumbnailCenterX = thumbnailLayout.x + thumbnailLayout.width / 2;
        const thumbnailCenterY = thumbnailLayout.y + thumbnailLayout.height / 2;
        const screenCenterX = windowWidth / 2;
        const screenCenterY = windowHeight / 2;
        translateXAnim.setValue(screenCenterX - thumbnailCenterX);
        translateYAnim.setValue(screenCenterY - thumbnailCenterY);
      } else {
        scaleAnim.setValue(startScale);
        translateXAnim.setValue(startX);
        translateYAnim.setValue(startY);
      }
      opacityAnim.setValue(0);
      backgroundOpacityAnim.setValue(0);

      // 执行动画（250ms，行业标准）
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: endScale,
          duration: 250,
          easing: Easing.out(Easing.cubic), // 使用 cubic 缓动，更自然
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: endX,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: endY,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundOpacityAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAnimating(false);
      });
    }
  }, [visible, thumbnailLayout]);

  // ✅ 关闭动画：从全屏缩小回缩略图位置
  const handleClose = () => {
    setIsAnimating(true);
    const { startScale, startX, startY } = getAnimationValues();

    // ✅ 计算关闭时的目标值
    let targetScale = startScale;
    let targetX = startX;
    let targetY = startY;

    if (thumbnailLayout) {
      // ✅ 计算缩略图相对于全屏的缩放比例
      // 参考微信朋友圈逻辑：宽度固定，所以缩放比例 = 缩略图宽度 / 屏幕宽度
      targetScale = thumbnailLayout.width / windowWidth;
      // 计算需要移动回缩略图位置的距离
      const thumbnailCenterX = thumbnailLayout.x + thumbnailLayout.width / 2;
      const thumbnailCenterY = thumbnailLayout.y + thumbnailLayout.height / 2;
      const screenCenterX = windowWidth / 2;
      const screenCenterY = windowHeight / 2;
      targetX = screenCenterX - thumbnailCenterX;
      targetY = screenCenterY - thumbnailCenterY;
    }

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: targetScale,
        duration: 250,
        easing: Easing.in(Easing.cubic), // 关闭时使用 ease-in
        useNativeDriver: true,
      }),
      Animated.timing(translateXAnim, {
        toValue: targetX,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: targetY,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200, // 背景稍快一点
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(backgroundOpacityAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
      onClose();
    });
  };

  // 当 initialIndex 变化时，更新当前索引并滚动到对应位置
  useEffect(() => {
    if (visible && initialIndex !== currentIndex) {
      setCurrentIndex(initialIndex);
      flatListRef.current?.scrollToIndex({
        index: initialIndex,
        animated: false,
      });
    }
  }, [visible, initialIndex]);

  // 当索引变化时，通知父组件
  useEffect(() => {
    if (onIndexChange) {
      onIndexChange(currentIndex);
    }
  }, [currentIndex, onIndexChange]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / windowWidth);
    if (index !== currentIndex && index >= 0 && index < imageUrls.length) {
      setCurrentIndex(index);
    }
  };

  // ✅ 计算当前图片的动画样式
  const getImageAnimatedStyle = () => {
    if (!thumbnailLayout) {
      // 无缩略图信息：使用淡入淡出
      return {
        opacity: opacityAnim,
        transform: [
          {
            scale: scaleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            }),
          },
        ],
      };
    }

    // 有缩略图信息：使用位置和缩放动画
    // 关键：transform 的顺序很重要！先 translate 再 scale
    return {
      opacity: opacityAnim,
      transform: [
        { translateX: translateXAnim },
        { translateY: translateYAnim },
        { scale: scaleAnim },
      ],
    };
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Modal
        visible={visible}
        transparent
        animationType="none" // ✅ 禁用默认动画，使用自定义动画
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <StatusBar hidden />
        <View style={fullScreenStyles.container}>
          {/* 黑色背景 - 带透明度动画 */}
          <Animated.View
            style={[
              fullScreenStyles.background,
              { opacity: backgroundOpacityAnim },
            ]}
          />

          {/* 顶部关闭按钮 - 更细的outline风格，更大的间距 */}
          <Animated.View
            style={[fullScreenStyles.headerWrapper, { opacity: opacityAnim }]}
          >
            <SafeAreaView style={fullScreenStyles.header} edges={["top"]}>
              <TouchableOpacity
                style={fullScreenStyles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={t("common.close")}
                accessibilityHint={t("accessibility.button.closeHint")}
                accessibilityRole="button"
              >
                <Ionicons name="close-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </SafeAreaView>
          </Animated.View>

          {/* 图片轮播 - 支持点击图片关闭（模仿微信） */}
          <FlatList
            ref={flatListRef}
            data={imageUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}-${index}`}
            initialScrollIndex={initialIndex}
            getItemLayout={(data, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            scrollEnabled={!isAnimating} // ✅ 动画期间禁用滚动
            renderItem={({ item, index }) => {
              // ✅ 只有当前索引的图片才显示动画
              const isCurrentImage = index === currentIndex;
              const animatedStyle =
                isCurrentImage && thumbnailLayout
                  ? getImageAnimatedStyle()
                  : { opacity: opacityAnim };

              // ✅ 初始化手势动画值
              if (!scaleAnims.current[index]) {
                scaleAnims.current[index] = new Animated.Value(1);
                translateXAnims.current[index] = new Animated.Value(0);
                translateYAnims.current[index] = new Animated.Value(0);
              }

              // ✅ 计算图片尺寸（等比例，宽度固定为屏幕宽度，高度根据比例计算但不超过屏幕高度）
              const dimensions = imageDimensions[index];
              let imageWidth = windowWidth;
              let imageHeight = windowHeight;
              if (dimensions) {
                const aspectRatio = dimensions.height / dimensions.width;
                const calculatedHeight = windowWidth * aspectRatio;
                // ✅ 如果计算出的高度超过屏幕高度，则限制为屏幕高度（图片会在容器内居中显示）
                imageHeight = Math.min(calculatedHeight, windowHeight);
              }

              // ✅ 创建手势
              const pinchGesture = Gesture.Pinch()
                .onUpdate((event) => {
                  const newScale = Math.max(1, Math.min(event.scale, 5)); // 限制缩放范围 1-5倍
                  scaleAnims.current[index].setValue(newScale);
                  setZoomScale((prev) => ({ ...prev, [index]: newScale }));
                })
                .onEnd(() => {
                  // 缩放结束后，如果小于1，则重置为1
                  const currentScale = zoomScale[index] || 1;
                  if (currentScale < 1) {
                    Animated.spring(scaleAnims.current[index], {
                      toValue: 1,
                      useNativeDriver: true,
                    }).start();
                    setZoomScale((prev) => ({ ...prev, [index]: 1 }));
                  }
                });

              const panGesture = Gesture.Pan()
                .enabled((zoomScale[index] || 1) > 1) // 只有在放大时才允许拖动
                .onUpdate((event) => {
                  const currentScale = zoomScale[index] || 1;
                  if (currentScale > 1) {
                    // 限制拖动范围，防止图片移出屏幕
                    const maxTranslateX =
                      (imageWidth * currentScale - windowWidth) / 2;
                    const maxTranslateY =
                      (imageHeight * currentScale - windowHeight) / 2;
                    const newTranslateX = Math.max(
                      -maxTranslateX,
                      Math.min(maxTranslateX, event.translationX)
                    );
                    const newTranslateY = Math.max(
                      -maxTranslateY,
                      Math.min(maxTranslateY, event.translationY)
                    );
                    translateXAnims.current[index].setValue(newTranslateX);
                    translateYAnims.current[index].setValue(newTranslateY);
                    setTranslateX((prev) => ({
                      ...prev,
                      [index]: newTranslateX,
                    }));
                    setTranslateY((prev) => ({
                      ...prev,
                      [index]: newTranslateY,
                    }));
                  }
                })
                .onEnd(() => {
                  // 拖动结束后，如果缩放回到1，重置位置
                  const currentScale = zoomScale[index] || 1;
                  if (currentScale <= 1) {
                    Animated.parallel([
                      Animated.spring(translateXAnims.current[index], {
                        toValue: 0,
                        useNativeDriver: true,
                      }),
                      Animated.spring(translateYAnims.current[index], {
                        toValue: 0,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setTranslateX((prev) => ({ ...prev, [index]: 0 }));
                    setTranslateY((prev) => ({ ...prev, [index]: 0 }));
                  }
                });

              // ✅ 组合手势：同时支持缩放和拖动
              const composedGesture = Gesture.Simultaneous(
                pinchGesture,
                panGesture
              );

              // ✅ 双击手势：双击放大/缩小
              const doubleTapGesture = Gesture.Tap()
                .numberOfTaps(2)
                .onEnd(() => {
                  const currentScale = zoomScale[index] || 1;
                  const targetScale = currentScale > 1 ? 1 : 2; // 双击在1倍和2倍之间切换
                  Animated.spring(scaleAnims.current[index], {
                    toValue: targetScale,
                    useNativeDriver: true,
                  }).start();
                  setZoomScale((prev) => ({ ...prev, [index]: targetScale }));
                  // 如果缩小到1倍，重置位置
                  if (targetScale === 1) {
                    Animated.parallel([
                      Animated.spring(translateXAnims.current[index], {
                        toValue: 0,
                        useNativeDriver: true,
                      }),
                      Animated.spring(translateYAnims.current[index], {
                        toValue: 0,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setTranslateX((prev) => ({ ...prev, [index]: 0 }));
                    setTranslateY((prev) => ({ ...prev, [index]: 0 }));
                  }
                });

              // ✅ 单击手势：只有在未缩放时才能关闭
              const singleTapGesture = Gesture.Tap()
                .numberOfTaps(1)
                .onEnd(() => {
                  const currentScale = zoomScale[index] || 1;
                  if (currentScale <= 1 && !isAnimating) {
                    handleClose();
                  }
                });

              const tapGesture = Gesture.Race(
                doubleTapGesture,
                singleTapGesture
              );
              const finalGesture = Gesture.Simultaneous(
                composedGesture,
                tapGesture
              );

              return (
                <View
                  style={[
                    fullScreenStyles.imageContainer,
                    { width: windowWidth },
                  ]}
                >
                  <GestureDetector gesture={finalGesture}>
                    <Animated.View
                      style={[
                        fullScreenStyles.imageWrapper,
                        {
                          transform: [
                            { scale: scaleAnims.current[index] },
                            { translateX: translateXAnims.current[index] },
                            { translateY: translateYAnims.current[index] },
                          ],
                        },
                      ]}
                    >
                      <Animated.Image
                        source={{ uri: item }}
                        style={[
                          fullScreenStyles.image,
                          // ✅ 等比例显示：宽度固定为屏幕宽度，高度根据图片比例自动计算
                          // 如果高度超过屏幕，则限制为屏幕高度，图片会在容器内居中显示
                          {
                            width: imageWidth,
                            height: imageHeight,
                          },
                          animatedStyle,
                        ]}
                        resizeMode="contain" // ✅ 使用 contain，确保图片完整显示，不裁切，在容器内居中
                        onLoad={(event) => {
                          // ✅ 获取图片实际尺寸，用于计算等比高度
                          const { width, height } = event.nativeEvent.source;
                          if (width && height) {
                            console.log(
                              `📐 图片 ${index} 实际尺寸: ${width}x${height}, 宽高比: ${(
                                height / width
                              ).toFixed(2)}`
                            );
                            setImageDimensions((prev) => ({
                              ...prev,
                              [index]: { width, height },
                            }));
                          }
                        }}
                      />
                    </Animated.View>
                  </GestureDetector>
                </View>
              );
            }}
          />

          {/* 底部指示器（多张图片时显示） */}
          {imageUrls.length > 1 && (
            <Animated.View
              style={[fullScreenStyles.footerWrapper, { opacity: opacityAnim }]}
            >
              <SafeAreaView style={fullScreenStyles.footer} edges={["bottom"]}>
                <View style={fullScreenStyles.indicatorContainer}>
                  <Text style={fullScreenStyles.indicatorText}>
                    {currentIndex + 1} / {imageUrls.length}
                  </Text>
                </View>
              </SafeAreaView>
            </Animated.View>
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

// ========== 全屏图片查看器样式 ==========
const fullScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 20, // ✅ 增加右边距
    paddingTop: 20, // ✅ 增加顶部间距
    paddingBottom: 8,
  },
  closeButton: {
    width: 36, // ✅ 稍微缩小，更精致
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // ✅ 降低背景透明度，更精致
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center", // ✅ 垂直居中
    alignItems: "center", // ✅ 水平居中
  },
  imageWrapper: {
    justifyContent: "center", // ✅ 垂直居中
    alignItems: "center", // ✅ 水平居中
  },
  image: {
    // ✅ 尺寸在 renderItem 中根据图片比例动态计算
    // 宽度固定为屏幕宽度，高度根据图片宽高比自动计算
  },
  footerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  indicatorContainer: {
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  indicatorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

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
    zIndex: 1,
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
    zIndex: 2,
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
    paddingHorizontal: 20, // ⬅️ 调整这里：控制左右间距
    paddingTop: 12, // ⬅️ 调整这里：控制顶部间距
    paddingBottom: 8, // ⬅️ 调整这里：控制底部间距
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

  // ===== 纯图片日记样式 =====
  imageOnlyContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  imageOnlyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 20 : 20, // ⬅️ 调整这里：控制顶部间距（考虑状态栏）
    paddingHorizontal: 16, // ⬅️ 调整这里：控制左右间距
    paddingBottom: 8, // ⬅️ 调整这里：控制底部间距
    zIndex: 100,
    backgroundColor: "transparent",
  },
  imageList: {
    flex: 1,
    marginTop: 12,
  },
  imageSlide: {
    width: Dimensions.get("window").width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200, // 确保容器有最小高度
  },
  fullScreenImage: {
    // 宽度和最大高度在 renderItem 中动态设置
    // 使用 contain 模式时，高度会根据图片比例自动计算
  },
  // 点状指示器
  imageIndicatorContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    zIndex: 200,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  imageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F2E2C2", // 非活跃状态：灰色
  },
  imageIndicatorDotActive: {
    backgroundColor: "#E56C45", // 活跃状态：主题色
    width: 24, // 活跃状态更长
    height: 8,
    borderRadius: 4,
  },

  // ===== 图片缩略图容器（图片+文字日记）- 一行3个 =====
  imageThumbnailContainer: {
    marginHorizontal: 20, // 左右各20px，总共40px
    marginTop: 16,
    marginBottom: 12,
  },
  imageThumbnailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  imageThumbnailWrapper: {
    marginRight: 8, // 图片之间的间距
    marginBottom: 8, // 行之间的间距
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
    // 动态计算宽度：(屏幕宽度 - 左右margin 40px - 间距 8*2) / 3
    width: Math.floor((Dimensions.get("window").width - 40 - 16) / 3),
    height: Math.floor((Dimensions.get("window").width - 40 - 16) / 3),
  },
  imageThumbnailLastInRow: {
    marginRight: 0, // 每行最后一个没有右边距
  },
  imageThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
});
