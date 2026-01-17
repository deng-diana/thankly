/**
 * DiaryCard - 可复用的日记卡片组件
 * 
 * 功能：
 * - 显示日记的完整内容（标题、文本、图片、音频）
 * - 支持搜索关键词高亮
 * - 支持音频播放控制
 * - 支持图片预览
 * - 情绪标签和光晕效果
 * - 响应式布局
 * 
 * 使用场景：
 * - DiaryListScreen（日记列表页）
 * - SearchScreen（搜索结果页）
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Pressable,
  Dimensions,
  StyleSheet,
} from "react-native";
import { t } from "../i18n";
import { getFontFamilyForText, detectTextLanguage } from "../styles/typography";
import { formatDateTime } from "../utils/dateFormat";  // ✅ 使用统一的日期格式化
import { HighlightedText } from "./HighlightedText";
import { EmotionCapsule } from "./EmotionCapsule";
import { EmotionGlow } from "./EmotionGlow";
import AudioPlayer from "./AudioPlayer";
import CalendarIcon from "../assets/icons/calendarIcon.svg";
import MoreIcon from "../assets/icons/moreIcon.svg";

interface Diary {
  diary_id: string;
  title: string;
  original_content: string;
  polished_content: string;
  created_at: string;
  image_urls?: string[];
  audio_url?: string;
  audio_duration?: number;
  language?: string;
  emotion_data?: {
    emotion: string;
  };
}

interface DiaryCardProps {
  diary: Diary;
  index?: number;
  totalCount?: number;
  searchQuery?: string;
  
  // 音频播放相关
  isPlaying?: boolean;
  currentTime?: number;
  totalDuration?: number;
  hasPlayedOnce?: boolean;
  onPlayPress?: () => void;
  onSeek?: (time: number) => void;
  
  // 图片预览相关
  onImagePress?: (imageUrls: string[], index: number) => void;
  
  // 卡片点击
  onPress?: () => void;
  
  // 选项菜单（三点按钮）
  onOptionsPress?: () => void;
  showOptions?: boolean;
}

export function DiaryCard({
  diary,
  index = 0,
  totalCount = 0,
  searchQuery = "",
  isPlaying = false,
  currentTime = 0,
  totalDuration = 0,
  hasPlayedOnce = false,
  onPlayPress,
  onSeek,
  onImagePress,
  onPress,
  onOptionsPress,
  showOptions = true,
}: DiaryCardProps) {
  
  // ======== 图片网格渲染 ========
  const renderImageGrid = (imageUrls: string[]) => {
    if (!imageUrls.length) return null;

    const GAP = 8;
    const CARD_PADDING = 24;
    const PAGE_MARGIN = 24;
    const TOTAL_HORIZONTAL_PADDING = (CARD_PADDING + PAGE_MARGIN) * 2;

    const screenWidth = Dimensions.get("window").width;
    const availableWidth = screenWidth - TOTAL_HORIZONTAL_PADDING;
    const IMAGE_HEIGHT = Math.floor((availableWidth - 2 * GAP) / 3);

    const imageCount = imageUrls.length;
    const displayCount = Math.min(imageCount, 3);
    const hasMore = imageCount > 3;
    const remainingCount = imageCount - 3;

    let imageWidth: number;
    if (displayCount === 1) {
      imageWidth = availableWidth;
    } else if (displayCount === 2) {
      imageWidth = Math.floor((availableWidth - GAP) / 2);
    } else {
      imageWidth = Math.floor((availableWidth - 2 * GAP) / 3);
    }

    return (
      <View style={{ flexDirection: "row" }}>
        {imageUrls.slice(0, displayCount).map((url, imgIndex) => {
          const isLast = imgIndex === displayCount - 1;
          const showBadge = isLast && hasMore;

          return (
            <Pressable
              key={imgIndex}
              onPress={(event) => {
                event?.stopPropagation?.();
                onImagePress?.(imageUrls, imgIndex);
              }}
              style={{
                width: imageWidth,
                height: IMAGE_HEIGHT,
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#f0f0f0",
                marginRight: isLast ? 0 : GAP,
              }}
            >
              <Image
                source={{ uri: url }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />

              {showBadge && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 20,
                      fontWeight: "600",
                    }}
                  >
                    +{remainingCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const displayDate = formatDateTime(diary.created_at);

  // ======== 判断是否为纯图片日记 ========
  const isImageOnly =
    diary.image_urls &&
    diary.image_urls.length > 0 &&
    (!diary.title || diary.title.trim() === "") &&
    (!diary.polished_content || diary.polished_content.trim() === "");

  // ======== 动态字体 ========
  const isChineseTitle = detectTextLanguage(diary.title || "") === "zh";
  const titleFontFamily = getFontFamilyForText(
    diary.title || "",
    isChineseTitle ? "bold" : "semibold"
  );
  
  const contentText = isImageOnly
    ? ""
    : diary.polished_content || diary.original_content;
  const isChineseContent = detectTextLanguage(contentText) === "zh";
  const contentFontFamily = getFontFamilyForText(contentText, "regular");

  // ======== 无障碍标签 ========
  const accessibilityLabel = totalCount > 0
    ? `${t("accessibility.list.diaryCard")} ${index + 1} ${t(
        "accessibility.list.of"
      )} ${totalCount}, ${diary.title || "图片日记"}`
    : diary.title || "图片日记";

  return (
    <TouchableOpacity
      style={styles.diaryCard}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t("accessibility.button.viewDetailHint")}
      accessibilityRole="button"
    >
      {/* 情绪光晕效果 */}
      <EmotionGlow emotion={diary.emotion_data?.emotion} />

      {/* 内容容器 */}
      <View style={styles.cardContentContainer} pointerEvents="box-none">
        {/* 纯图片日记 */}
        {isImageOnly ? (
          <>
            {diary.image_urls && diary.image_urls.length > 0 && (
              <View style={[styles.imageGrid, { marginTop: 0, marginBottom: 12 }]}>
                {renderImageGrid(diary.image_urls)}
              </View>
            )}
          </>
        ) : (
          <>
            {/* 标题行 + 情绪标签 */}
            {(diary.title || diary.emotion_data?.emotion || !isImageOnly) && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                  zIndex: 10,
                }}
              >
                {/* 标题 */}
                {diary.title && diary.title.trim() !== "" ? (
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <HighlightedText
                      text={diary.title}
                      searchQuery={searchQuery}
                      style={[
                        styles.cardTitle,
                        {
                          fontFamily: titleFontFamily,
                          fontWeight: isChineseTitle ? "700" : "600",
                          fontSize: isChineseTitle ? 18 : 18,
                          lineHeight: isChineseTitle ? 26 : 24,
                        },
                      ]}
                      numberOfLines={2}
                    />
                  </View>
                ) : (
                  <View style={{ flex: 1 }} />
                )}

                {/* 情绪标签 */}
                {(diary.emotion_data?.emotion || !isImageOnly) && (
                  <View style={{ marginLeft: 8 }}>
                    <EmotionCapsule
                      emotion={diary.emotion_data?.emotion}
                      language={diary.language || "en"}
                      content={diary.polished_content || diary.original_content}
                    />
                  </View>
                )}
              </View>
            )}

            {/* 内容预览 */}
            {contentText && contentText.trim() !== "" && (
              <HighlightedText
                text={contentText}
                searchQuery={searchQuery}
                style={[
                  styles.cardContent,
                  {
                    fontFamily: contentFontFamily,
                    fontSize: isChineseContent ? 16 : 16,
                    lineHeight: isChineseContent ? 28 : 24,
                  },
                ]}
                numberOfLines={3}
              />
            )}

            {/* 图片缩略图 */}
            {diary.image_urls && diary.image_urls.length > 0 && (
              <View
                style={[
                  styles.imageGrid,
                  diary.audio_url ? styles.imageGridWithAudio : null,
                ]}
              >
                {renderImageGrid(diary.image_urls)}
              </View>
            )}
          </>
        )}

        {/* 音频播放器 */}
        {diary.audio_url && onPlayPress && onSeek && (
          <AudioPlayer
            audioUrl={diary.audio_url}
            audioDuration={diary.audio_duration}
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={totalDuration}
            hasPlayedOnce={hasPlayedOnce}
            onPlayPress={onPlayPress}
            onSeek={onSeek}
            style={styles.audioButton}
          />
        )}

        {/* 底部：日期 + 选项菜单 */}
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <CalendarIcon width={20} height={20} />
            <Text
              style={[
                styles.cardDate,
                {
                  fontFamily: getFontFamilyForText(displayDate, "regular"),
                },
              ]}
            >
              {displayDate}
            </Text>
          </View>

          {/* 三点菜单 */}
          {showOptions && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onOptionsPress?.();
              }}
              style={styles.optionsButton}
              accessibilityLabel={t("home.diaryOptionsButton")}
              accessibilityHint={t("accessibility.button.editHint")}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MoreIcon width={24} height={24} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  diaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: "visible",
    position: "relative",
  },
  cardContentContainer: {
    padding: 24,
  },
  cardTitle: {
    color: "#332824",
    marginBottom: 4,
  },
  cardContent: {
    color: "#5D5550",
    marginBottom: 12,  // ✅ 与 DiaryListScreen 保持一致
  },
  imageGrid: {
    marginTop: 0,
    marginBottom: 12,
  },
  imageGridWithAudio: {
    marginBottom: 12, // 统一为 12px
  },
  audioButton: {
    marginTop: 0,
    marginBottom: 12, // 语音条下方间距
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 0,
    height: 20, // 保持与图标高度一致
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4, // 统一为 4px
  },
  cardDate: {
    fontSize: 14,
    color: "#B8A89D",
  },
  optionsButton: {
    padding: 4,
  },
});
