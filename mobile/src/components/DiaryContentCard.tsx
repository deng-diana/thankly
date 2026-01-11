import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { EmotionCapsule } from './EmotionCapsule';
import { EmotionType, EMOTION_MAP, DEFAULT_EMOTION } from '../types/emotion';
import { Typography, getFontFamilyForText, detectTextLanguage } from '../styles/typography';
import { t } from '../i18n';

interface DiaryContentCardProps {
  title: string;
  content: string;
  emotion?: string;
  language?: string;
  
  // 编辑相关
  isEditingTitle?: boolean;
  isEditingContent?: boolean;
  editedTitle?: string;
  editedContent?: string;
  
  onStartTitleEditing?: () => void;
  onStartContentEditing?: () => void;
  onTitleChange?: (text: string) => void;
  onContentChange?: (text: string) => void;
  
  style?: any;
}

/**
 * 统一的日记内容卡片组件
 * 用于详情页和结果页，保持视觉一致性
 */
export const DiaryContentCard: React.FC<DiaryContentCardProps> = ({
  title,
  content,
  emotion,
  language = 'en',
  isEditingTitle,
  isEditingContent,
  editedTitle,
  editedContent,
  onStartTitleEditing,
  onStartContentEditing,
  onTitleChange,
  onContentChange,
  style
}) => {
  // ✅ 动态计算语言
  const isChineseTitle = detectTextLanguage(title || "") === "zh";
  const isChineseContent = detectTextLanguage(content || "") === "zh";

  // ✅ 处理内容：如果内容开头重复了标题，去掉重复部分
  const processedContent = React.useMemo(() => {
    if (!title || !content) return content;
    
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    
    // 如果内容以标题开头，去掉标题部分
    if (trimmedContent.startsWith(trimmedTitle)) {
      return trimmedContent.slice(trimmedTitle.length).replace(/^\s+/, '');
    }
    
    return content;
  }, [title, content]);

  // ✅ 动态配色逻辑
  const emotionType = emotion as EmotionType;
  const emotionConfig = emotionType && EMOTION_MAP[emotionType] ? EMOTION_MAP[emotionType] : DEFAULT_EMOTION;
  const dynamicBorderColor = emotionConfig.color;
  const dynamicBackgroundColor = `${dynamicBorderColor}4D`; // ✅ 30% 透明度 (增加10%使背景更明显)

  return (
    <View style={[
      styles.diaryCard, 
      { 
        borderColor: dynamicBorderColor,
        backgroundColor: dynamicBackgroundColor 
      },
      style
    ]}>
      {/* 标题 + 情绪标签行 */}
      <View style={styles.titleAndTagContainer}>
        <View style={styles.titleWrapper}>
          {isEditingTitle ? (
            <TextInput
              style={[
                styles.editTitleInput,
                {
                  fontFamily: getFontFamilyForText(editedTitle || title || "", "bold"),
                },
              ]}
              value={editedTitle}
              onChangeText={onTitleChange}
              autoFocus
              multiline
              placeholder={t("diary.placeholderTitle")}
              scrollEnabled={false}
              accessibilityLabel={t("diary.placeholderTitle")}
            />
          ) : (
            <TouchableOpacity
              onPress={onStartTitleEditing}
              activeOpacity={0.7}
              disabled={!onStartTitleEditing}
            >
              <Text
                style={[
                  styles.titleText,
                  {
                    fontFamily: getFontFamilyForText(
                      title,
                      isChineseTitle ? "bold" : "semibold"
                    ),
                    fontWeight: isChineseTitle ? "700" : "600",
                    fontSize: isChineseTitle ? 16 : 18,
                    lineHeight: isChineseTitle ? 26 : 24,
                  },
                ]}
              >
                {title}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ 情绪标签 - 距离顶部和右边间距一致 */}
        {(emotion || !!title || !!content) && (
          <View style={styles.capsuleWrapper}>
            <EmotionCapsule 
              emotion={emotion}
              language={language}
              content={content}
            />
          </View>
        )}
      </View>

      {/* 正文内容区域 */}
      <View style={styles.contentContainer}>
        {isEditingContent ? (
          <TextInput
            style={[
              styles.editContentInput,
              {
                fontFamily: getFontFamilyForText(editedContent || content || "", "regular"),
              },
            ]}
            value={editedContent}
            onChangeText={onContentChange}
            autoFocus
            multiline
            placeholder={t("diary.placeholderContent")}
            scrollEnabled={true}
            textAlignVertical="top"
            accessibilityLabel={t("diary.placeholderContent")}
          />
        ) : (
          <TouchableOpacity
            onPress={onStartContentEditing}
            activeOpacity={0.7}
            disabled={!onStartContentEditing}
          >
            <Text
              style={[
                styles.contentText,
                {
                  fontFamily: getFontFamilyForText(processedContent, "regular"),
                  lineHeight: isChineseContent ? 28 : 26, // ✅ 恢复原始行间距
                },
              ]}
            >
              {processedContent}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  diaryCard: {
    borderRadius: 12,
    padding: 20, // ✅ 增加内边距提升呼吸感 (从 16px 增加到 20px)
    borderWidth: 1,
    overflow: "hidden",
  },
  titleAndTagContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // ✅ 确保标签在顶部对齐
    marginBottom: 8,
    gap: 12,
  },
  titleWrapper: {
    flex: 1,
  },
  titleText: {
    ...Typography.diaryTitle,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  capsuleWrapper: {
    marginTop: 0, // ✅ 确保与顶部和右侧间距完全一致 (16px)
  },
  contentContainer: {
    marginTop: 4,
  },
  contentText: {
    ...Typography.body,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },
  editTitleInput: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 8,
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
    minHeight: 150,
    textAlignVertical: "top",
  },
});
