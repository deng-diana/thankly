/**
 * CircleFeedCard - 圈子动态卡片
 * 
 * 基于 DiaryCard，额外显示分享者信息
 * 使用 CircleFeedItem 的冗余字段，无需额外请求
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { getFontFamilyForText } from '../styles/typography';
import { formatDateTime } from '../utils/dateFormat';
import { EmotionCapsule } from './EmotionCapsule';
import { EmotionGlow } from './EmotionGlow';
import AudioPlayer from './AudioPlayer';
import CalendarIcon from '../assets/icons/calendarIcon.svg';
import type { CircleFeedItem } from '../types/circle';

interface CircleFeedCardProps {
  item: CircleFeedItem;
}

function CircleFeedCard({ item }: CircleFeedCardProps) {
  const { width: screenWidth } = Dimensions.get('window');

  // ======== 相对时间格式化 ========
  const formatSharedTime = (isoString: string): string => {
    const now = new Date();
    const date = new Date(isoString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return t('circle.feed.justNow');
    } else if (diffMinutes < 60) {
      return t('circle.feed.minutesAgo', { count: diffMinutes });
    } else if (diffHours < 24) {
      return t('circle.feed.hoursAgo', { count: diffHours });
    } else if (diffDays < 7) {
      return t('circle.feed.daysAgo', { count: diffDays });
    } else {
      // More than a week, show formatted date
      return formatDateTime(isoString);
    }
  };

  // ======== 图片网格渲染 ========
  // TODO: Week 3 - Add image preview functionality
  const renderImageGrid = (imageUrls: string[]) => {
    if (!imageUrls.length) return null;

    const imageCount = imageUrls.length;
    const cardPadding = 32;
    const availableWidth = screenWidth - cardPadding;
    const gap = 8;

    let gridLayout: { width: number; height: number; columns: number };

    if (imageCount === 1) {
      gridLayout = { width: availableWidth, height: 240, columns: 1 };
    } else if (imageCount === 2) {
      const imageWidth = (availableWidth - gap) / 2;
      gridLayout = { width: imageWidth, height: 160, columns: 2 };
    } else if (imageCount === 3) {
      const imageWidth = (availableWidth - gap) / 2;
      gridLayout = { width: imageWidth, height: 120, columns: 2 };
    } else {
      const imageWidth = (availableWidth - gap * 2) / 3;
      gridLayout = { width: imageWidth, height: 100, columns: 3 };
    }

    return (
      <View style={styles.imageGrid}>
        {imageUrls.map((url, index) => (
          <Pressable
            key={index}
            style={[
              styles.imageItem,
              {
                width: gridLayout.width,
                height: gridLayout.height,
                marginRight: (index + 1) % gridLayout.columns !== 0 ? gap : 0,
                marginBottom: gap,
              },
            ]}
          >
            <Image
              source={{ uri: url }}
              style={styles.image}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
    );
  };

  // ======== 主渲染 ========
  return (
    <View style={styles.card}>
      {/* Emotion Glow Background */}
      {item.emotion && (
        <EmotionGlow emotion={item.emotion} style={styles.emotionGlow} />
      )}

      {/* Shared By Header */}
      <View style={styles.sharedHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle-outline" size={32} color="#80645A" />
        </View>
        <View style={styles.sharedInfo}>
          <Text
            style={[
              styles.sharedByName,
              {
                fontFamily: getFontFamilyForText(item.sharedBy, 'semibold'),
              },
            ]}
          >
            {item.sharedBy}
          </Text>
          <Text
            style={[
              styles.sharedTime,
              {
                fontFamily: getFontFamilyForText(
                  formatSharedTime(item.sharedAt),
                  'regular'
                ),
              },
            ]}
          >
            {formatSharedTime(item.sharedAt)}
          </Text>
        </View>
      </View>

      {/* Diary Content */}
      <View style={styles.content}>
        {/* Title */}
        {item.diaryTitle && (
          <Text
            style={[
              styles.title,
              {
                fontFamily: getFontFamilyForText(item.diaryTitle, 'semibold'),
              },
            ]}
            numberOfLines={2}
          >
            {item.diaryTitle}
          </Text>
        )}

        {/* Date & Emotion */}
        <View style={styles.metaRow}>
          <View style={styles.dateContainer}>
            <CalendarIcon width={14} height={14} fill="#80645A" />
            <Text
              style={[
                styles.dateText,
                {
                  fontFamily: getFontFamilyForText(
                    formatDateTime(item.diaryCreatedAt),
                    'regular'
                  ),
                },
              ]}
            >
              {formatDateTime(item.diaryCreatedAt)}
            </Text>
          </View>

          {item.emotion && (
            <EmotionCapsule emotion={item.emotion} size="small" />
          )}
        </View>

        {/* Polished Content */}
        <Text
          style={[
            styles.polishedContent,
            {
              fontFamily: getFontFamilyForText(
                item.diaryPolishedContent,
                'regular'
              ),
            },
          ]}
          numberOfLines={6}
        >
          {item.diaryPolishedContent}
        </Text>

        {/* Audio Player */}
        {item.audioUrl && (
          <View style={styles.audioContainer}>
            {/* TODO: Week 3 - Implement audio playback state management */}
            <AudioPlayer
              audioUrl={item.audioUrl}
              isPlaying={false}
              currentTime={0}
              totalDuration={item.audioDuration || 0}
              hasPlayedOnce={false}
              onPlayPress={() => {}}
              onSeek={() => {}}
              compact={true}
            />
          </View>
        )}

        {/* Image Grid */}
        {item.imageUrls && item.imageUrls.length > 0 && renderImageGrid(item.imageUrls)}
      </View>
    </View>
  );
}

// ========== 样式 ==========
// Memoize component to prevent unnecessary re-renders
export default React.memo(CircleFeedCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    // Shadow for Android
    elevation: 3,
  },
  emotionGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sharedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE5',
  },
  avatarContainer: {
    marginRight: 12,
  },
  sharedInfo: {
    flex: 1,
  },
  sharedByName: {
    fontSize: 16,
    color: '#332824',
    marginBottom: 2,
  },
  sharedTime: {
    fontSize: 13,
    color: '#80645A',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    color: '#332824',
    marginBottom: 12,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#80645A',
  },
  polishedContent: {
    fontSize: 16,
    color: '#332824',
    lineHeight: 26,
    marginBottom: 12,
  },
  audioContainer: {
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  imageItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
