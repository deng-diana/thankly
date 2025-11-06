/**
 * 可复用的音频播放器组件
 * 统一在日记列表页和详情页使用
 */

import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";

interface AudioPlayerProps {
  audioUrl?: string;
  audioDuration?: number;
  isPlaying?: boolean;
  currentTime?: number;
  totalDuration?: number;
  hasPlayedOnce?: boolean; // 是否曾经播放过（用于判断是否显示倒计时）
  onPlayPress: () => void;
  style?: any;
}

export default function AudioPlayer({
  audioUrl,
  audioDuration,
  isPlaying = false,
  currentTime = 0,
  totalDuration = 0,
  hasPlayedOnce = false, // 是否曾经播放过
  onPlayPress,
  style,
}: AudioPlayerProps) {
  if (!audioUrl) return null;

  const formatAudioDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 确定使用的总时长（优先使用 totalDuration，如果为 0 则使用 audioDuration）
  const effectiveTotalDuration = totalDuration > 0 ? totalDuration : (audioDuration || 0);

  // 格式化显示时间
  const formatDisplayTime = (): string => {
    // 如果从未播放过，只显示总时长，不显示倒计时
    if (!hasPlayedOnce) {
      return formatAudioDuration(effectiveTotalDuration);
    }

    // 如果播放过，显示 "剩余时间 | 总时长"
    if (effectiveTotalDuration <= 0) {
      return formatAudioDuration(audioDuration || 0);
    }

    // 计算剩余时间（使用当前时间，无论是播放还是暂停）
    const remaining = Math.max(0, effectiveTotalDuration - currentTime);
    const remainingFormatted = formatAudioDuration(remaining);
    const totalFormatted = formatAudioDuration(effectiveTotalDuration);

    return `${remainingFormatted} | ${totalFormatted}`;
  };

  const displayTime = formatDisplayTime();

  // 计算剩余时间用于无障碍标签
  const remaining = hasPlayedOnce && effectiveTotalDuration > 0
    ? Math.max(0, effectiveTotalDuration - currentTime)
    : effectiveTotalDuration;
  const remainingFormatted = formatAudioDuration(remaining);
  const totalFormatted = formatAudioDuration(effectiveTotalDuration);

  // 生成无障碍标签
  const getAccessibilityLabel = (): string => {
    if (isPlaying) {
      return t("accessibility.audio.playing", {
        remaining: remainingFormatted,
        total: totalFormatted,
      });
    } else {
      return t("accessibility.audio.paused", {
        total: totalFormatted,
      });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.audioButton, style]}
      onPress={onPlayPress}
      activeOpacity={0.8}
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityHint={t("accessibility.audio.hint")}
      accessibilityRole="button"
      accessibilityState={{
        playing: isPlaying,
        paused: !isPlaying,
      }}
    >
      <View style={styles.audioIconContainer}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={16}
          color="#E56C45"
          style={styles.playIcon}
        />
      </View>
      <Text style={styles.audioDurationText}>{displayTime}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ===== Apple风格：极简音频播放器 =====
  audioButton: {
    backgroundColor: "#FFF8F2",
    borderRadius: 8,
    borderWidth: 1, // 描边线的粗细
    borderColor: "#FFF0E5", // 描边的颜色
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    // 整条可点击，增大热区
    minHeight: 44, // Apple HIG 推荐最小点击区域
  },

  audioIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1, // 描边线的粗细
    borderColor: "#FFF0E5", // 描边的颜色
    marginRight: 8, // 与时长保持间距
  },

  playIcon: {
    marginLeft: 1, // 视觉居中：三角形向左微调1px
  },

  audioDurationText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    fontFamily: "Menlo", // 等宽字体，时间对齐
    letterSpacing: 0.5,
  },
});
