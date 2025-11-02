/**
 * 可复用的音频播放器组件
 * 统一在日记列表页和详情页使用
 */

import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AudioPlayerProps {
  audioUrl?: string;
  audioDuration?: number;
  isPlaying?: boolean;
  currentTime?: number;
  totalDuration?: number;
  onPlayPress: () => void;
  style?: any;
}

export default function AudioPlayer({
  audioUrl,
  audioDuration,
  isPlaying = false,
  currentTime = 0,
  totalDuration = 0,
  onPlayPress,
  style,
}: AudioPlayerProps) {
  if (!audioUrl) return null;

  const formatAudioDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatProgress = (current: number, total: number): string => {
    const remaining = total - current;
    return formatAudioDuration(remaining);
  };

  const displayTime = isPlaying
    ? formatProgress(currentTime, totalDuration || audioDuration || 0)
    : formatAudioDuration(audioDuration || 0);

  return (
    <TouchableOpacity
      style={[styles.audioButton, style]}
      onPress={onPlayPress}
      activeOpacity={0.8}
    >
      <View style={styles.audioIconContainer}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={16}
          color="#D96F4C"
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
