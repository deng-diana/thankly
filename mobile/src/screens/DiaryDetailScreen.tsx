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
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import CalendarIcon from "../assets/icons/calendarIcon.svg";
import TimeIcon from "../assets/icons/time.svg";
import { useDiaryAudio } from "../hooks/useDiaryAudio"; // ✅ 使用顶级统一标准 Hook
import { getDiaryDetail } from "../services/diaryService";
import { updateDiary } from "../services/diaryService"; // ✅ 添加
import AudioPlayer from "../components/AudioPlayer";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { EmotionCapsule } from "../components/EmotionCapsule"; // ✅ 导入情绪胶囊组件
import { EmotionGlow } from "../components/EmotionGlow"; // ✅ 导入情绪光晕组件
import { DiaryContentCard } from "../components/DiaryContentCard"; // ✅ 导入通用的日记卡片组件
import { AIFeedbackCard } from "../components/AIFeedbackCard"; // ✅ 导入 AI 暖心回复组件
import { EmotionType, EMOTION_MAP, DEFAULT_EMOTION } from "../types/emotion"; // ✅ 导入情绪配置用于动态颜色

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t, getCurrentLocale } from "../i18n";
import {
  Typography,
  getFontFamilyForText,
  detectTextLanguage,
} from "../styles/typography";

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
  emotion_data?: { emotion: string; [key: string]: any }; // ✅ 情感数据
}


const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
const MAX_IMAGE_HEIGHT = windowHeight * 0.6;

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
  // ✅ Image viewer states (DRY from DiaryListScreen)
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);

  // ✅ 新增:编辑相关状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");

  // ✅ 新增:保存状态保护
  const isSavingRef = useRef(false);

  // ✅ Image deletion state
  const [selectedImageForDeletion, setSelectedImageForDeletion] = useState<number | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);

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

  // ========== 图片相关函数 ==========
  const handleDeleteImage = async (index: number) => {
    if (!diary || !diary.image_urls) return;

    Alert.alert(
      t("detail.deleteImageTitle"), // ✅ 使用更专业的标题
      t("detail.deleteImageConfirm"), // ✅ 使用更简洁友好的文案
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeletingImage(true);
              const newImageUrls = diary.image_urls!.filter((_, i) => i !== index);
              const updatedDiary = await updateDiary(
                diary.diary_id,
                undefined,
                undefined,
                newImageUrls
              );
              setDiary(updatedDiary);
              if (onUpdate) onUpdate();
              
              // ✅ 删除成功后显示Toast,而不是Alert
              showToast(t("detail.imageDeleted"));
            } catch (error) {
              // ✅ 只在失败时才显示Alert
              Alert.alert(t("common.error"), t("error.deleteFailed"));
            } finally {
              setIsDeletingImage(false);
            }
          },
        },
      ]
    );
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
      onClose();
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

  // ========== 音频播放 (统一标准版本) ==========
  const {
    currentPlayingId,
    currentTimeMap,
    durationMap,
    hasPlayedOnceSet,
    handlePlayAudio,
    handleSeek,
  } = useDiaryAudio();

  const isPlaying = diary ? currentPlayingId === diary.diary_id : false;
  const currentTime = diary ? currentTimeMap.get(diary.diary_id) || 0 : 0;
  const duration = diary
    ? durationMap.get(diary.diary_id) || diary.audio_duration || 0
    : 0;
  const hasPlayedOnce = diary ? hasPlayedOnceSet.has(diary.diary_id) : false;

  const handlePlayPress = async () => {
    if (diary) {
      await handlePlayAudio(diary);
    }
  };

  const handleSeekPress = (seconds: number) => {
    if (diary) {
      handleSeek(diary.diary_id, seconds);
    }
  };

  // ========== 工具函数 ==========
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
            <TimeIcon width={20} height={20} color="#80645A" />
            <Text
              style={[
                styles.dateText,
                {
                  fontFamily: getFontFamilyForText(
                    diary ? formatDateTime(diary.created_at) : "",
                    "regular"
                  ),
                },
              ]}
            >
              {diary ? formatDateTime(diary.created_at) : ""}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.detailHeaderButtonText,
                  styles.cancelText,
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
            </TouchableOpacity>

            <Text
              style={[
                styles.detailHeaderTitle,
                {
                  fontFamily: getFontFamilyForText(t("common.edit"), "regular"),
                },
              ]}
            >
              {t("common.edit")}
            </Text>

            <TouchableOpacity
              onPress={finishEditing}
              style={styles.detailHeaderButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.detailHeaderButtonText,
                  styles.saveText,
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
          </>
        ) : (
          // 预览模式
          <>
            <View style={styles.dateContainer}>
              <TimeIcon width={20} height={20} color="#80645A" />
              <Text style={styles.dateText}>
                {diary ? formatDateTime(diary.created_at) : ""}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
      <Text
        style={[
          styles.errorTitle,
          {
            fontFamily: getFontFamilyForText("加载失败", "semibold"),
          },
        ]}
      >
        加载失败
      </Text>
      <Text
        style={[
          styles.errorText,
          {
            fontFamily: getFontFamilyForText(error || "", "regular"),
          },
        ]}
      >
        {error}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadDiaryDetail}>
        <Text
          style={[
            styles.retryButtonText,
            {
              fontFamily: getFontFamilyForText("重试", "semibold"),
            },
          ]}
        >
          重试
        </Text>
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

  const renderDiaryDetail = () => {
    if (!diary) return null;

    // 如果是纯图片日记，只显示图片轮播
    if (isImageOnlyDiary()) {
      const imageUrls = diary.image_urls || [];

      return (
        <View style={styles.imageOnlyContainer}>
          <FlatList
            data={imageUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.imageSlide,
                  {
                    maxHeight: MAX_IMAGE_HEIGHT,
                    height: MAX_IMAGE_HEIGHT,
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
                />
              </View>
            )}
            style={[
              styles.imageList,
              {
                paddingTop: Platform.OS === "ios" ? 52 : 40,
                paddingBottom: Platform.OS === "ios" ? 50 : 30,
              },
            ]}
            contentContainerStyle={{ flexGrow: 1 }}
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
            <View style={styles.imageIndicator}>
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
    const isEditing = isEditingTitle || isEditingContent;

    return (
      <>
        {/* ✅ 图片缩略图 - 编辑时隐藏以释放空间并保持稳定性 */}
        {!isEditing && diary.image_urls && diary.image_urls.length > 0 && (
          <View style={styles.imageGridContainer}>
            <View style={styles.imageGrid}>
              {diary.image_urls.map((url, index) => {
                const isLastInRow = (index + 1) % 4 === 0;
                return (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    style={[
                      styles.imageWrapper,
                      isLastInRow && styles.imageWrapperLastInRow,
                    ]}
                    onPress={() => {
                      if (showDeleteButtons) {
                        setShowDeleteButtons(false);
                        return;
                      }
                      setImagePreviewUrls(diary.image_urls!);
                      setImagePreviewIndex(index);
                      setImagePreviewVisible(true);
                    }}
                    onLongPress={() => setShowDeleteButtons(true)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: url }}
                      style={[
                        styles.thumbnail,
                        { opacity: showDeleteButtons ? 0.7 : 1 }
                      ]}
                      resizeMode="cover"
                    />
                    
                    {showDeleteButtons && (
                      <TouchableOpacity
                        style={styles.deleteButtonMask}
                        onPress={() => handleDeleteImage(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 音频播放器 - 编辑时隐藏 */}
        {!isEditing && diary.audio_url && (
          <AudioPlayer
            audioUrl={diary.audio_url}
            audioDuration={diary.audio_duration}
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={duration}
            hasPlayedOnce={hasPlayedOnce}
            onPlayPress={handlePlayPress}
            onSeek={handleSeekPress}
            style={styles.audioSection}
          />
        )}

        {/* 日记主体卡片 - 可编辑 */}
        <DiaryContentCard
          title={diary.title}
          content={diary.polished_content}
          emotion={diary.emotion_data?.emotion}
          language={diary.language}
          
          isEditingTitle={isEditingTitle}
          isEditingContent={isEditingContent}
          editedTitle={editedTitle}
          editedContent={editedContent}
          
          onStartTitleEditing={startEditingTitle}
          onStartContentEditing={startEditingContent}
          onTitleChange={setEditedTitle}
          onContentChange={setEditedContent}

          style={styles.diaryCardOverride}
        />

        {/* AI反馈 - 编辑时彻底隐藏，腾出滚动空间 */}
        {!isEditing && !!diary.ai_feedback && (
          <AIFeedbackCard
            aiFeedback={diary.ai_feedback}
            style={styles.feedbackCard}
          />
        )}

        {/* 底部间距 - 极简稳健设计：编辑时 600px 避让键盘，预览时 60px 确保滑出底部遮挡 */}
        <View style={{ height: (isEditingTitle || isEditingContent) ? 600 : 60 }} />
      </>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* 背景遮罩 */}
      <Pressable style={styles.overlay} onPress={onClose} />
      
      {/* 底部详情面板 */}
      <View style={styles.modal}>
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          {renderDetailHeader()}
          {/* 主体滚动区域 */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {loading ? renderLoading() : error ? renderError() : renderDiaryDetail()}
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* 图片预览 Modal */}
      {diary && diary.image_urls && diary.image_urls.length > 0 && (
        <ImagePreviewModal
          visible={imagePreviewVisible}
          images={diary.image_urls}
          initialIndex={imagePreviewIndex}
          onClose={() => setImagePreviewVisible(false)}
        />
      )}
      
      {/* Toast 提示 */}
      {toastVisible && (
        <View style={styles.toastOverlay}>
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}


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
    // ✅ 极简稳健设计：详情页统一使用固定比例高度，确保滚动锚点不再失效
    height: windowHeight * 0.9, 
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
    flex: 1, // ✅ 核心修复：锁定 flex: 1，强制 ScrollView 获取主轴高度
  },

  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40, 
  },

  // ===== 加载状态 =====
  loadingContainer: {
    paddingTop: 80, // ✅ 增大间距，不再边缘
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#80645A", // 统一的时间颜色
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
    color: "#80645A", // 统一的时间颜色
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
    gap: 4, // 图标和文字之间的间距
    flex: 1,
  },

  dateText: {
    ...Typography.caption,
    color: "#80645A", // 统一的时间颜色
  },

  // ===== 音频区域 =====
  audioSection: {
    marginHorizontal: 24,
    marginTop: 0, // ✅ 禁用 marginTop
    marginBottom: 12, // ✅ 统一标准：语音距离下方内容 12px
  },

  // ===== 日记内容卡片覆盖样式 =====
  diaryCardOverride: {
    marginHorizontal: 24,
    marginBottom: 12,
  },

  // ===== AI反馈区域 - 与语音记录页保持一致 =====
  feedbackCard: {
    marginHorizontal: 24,
    marginBottom: 12, // ✅ 统一标准：距离下方 12px
    marginTop: 0,
  },

  // ===== 详情页Header =====
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24, // ⬅️ 调整这里：控制左右间距
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
    color: "#80645A", // 统一的时间颜色
  },
  cancelText: {
    fontSize: 15, // ✅ 缩小 cancel 文字大小
    color: "#999", // ✅ 使用更浅的灰色
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
    minHeight: 250, 
    maxHeight: 320, // ✅ 黄金比例：确保编辑框在键盘弹出时能完整显示在剩余视口中
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
  
  
  

  // ===== 图片缩略图容器（图片+文字日记）- 动态列数 + 横向滚动 =====
  
  
  deleteButtonOverlay: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // imageThumbnailLastInRow: { // 不再需要，动态计算
  //   marginRight: 0,
  // },
  imageThumbnail: {
    // 尺寸在行内样式中动态计算
  },
  moreBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // ✅ Image Grid Styles (aligned with ImageDiaryModal & user request)
  imageGridContainer: {
    marginHorizontal: 24, // ✅ 左右间距24px，与其他内容元素保持一致
    marginTop: 4,
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  imageWrapper: {
    width: (Dimensions.get("window").width - 24*2 - 24) / 4, // ✅ 24*2=左右margin, 24=3个8px间隙
    height: (Dimensions.get("window").width - 24*2 - 24) / 4,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden", // This might be clipping the button if it's positioned outside, 
                       // but in ImageDiaryModal it's 'hidden' and button is inside.
    position: "relative",
  },
  imageWrapperLastInRow: {
    marginRight: 0,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  deleteButtonMask: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Matches ImageDiaryModal
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },


  imageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    width: "100%",
    gap: 8,
  },
  imageIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  imageIndicatorDotActive: {
    backgroundColor: "#E56C45",
  },

});