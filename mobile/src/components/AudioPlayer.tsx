/**
 * 可复用的音频播放器组件（带进度条）
 * 统一在日记列表页和详情页使用
 *
 * 使用 Animated API 实现平滑的进度条动画
 */

import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Animated,
  Pressable,
} from "react-native";
import { t } from "../i18n";
import AudioPlayIcon from "../assets/icons/audioPlayIcon.svg";
import AudioPauseIcon from "../assets/icons/audioPauseIcon.svg";

interface AudioPlayerProps {
  audioUrl?: string;
  audioDuration?: number;
  isPlaying?: boolean;
  currentTime?: number;
  totalDuration?: number;
  hasPlayedOnce?: boolean;
  onPlayPress: () => void;
  onSeek?: (position: number) => void;
  style?: any;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function AudioPlayer({
  audioUrl,
  audioDuration,
  isPlaying = false,
  currentTime = 0,
  totalDuration = 0,
  hasPlayedOnce = false,
  onPlayPress,
  onSeek,
  style,
}: AudioPlayerProps) {
  if (!audioUrl) return null;

  const progressBarWidth = useRef<number>(0);
  const progressBarRef = useRef<View | null>(null);
  const progressBarXRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  // ✅ 使用 Animated.Value 实现平滑的进度条动画
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentProgressRef = useRef<number>(0); // ✅ 使用 ref 同步跟踪当前进度值
  const lastProgressRef = useRef<number>(0); // ✅ 兼容旧引用，避免拖拽时报错
  const pendingSeekProgressRef = useRef<number | null>(null);

  const effectiveDuration =
    totalDuration > 0 ? totalDuration : audioDuration || 0;
  const activeTime = isDragging && dragTime !== null ? dragTime : currentTime;
  const displayTime =
    hasPlayedOnce && effectiveDuration > 0
      ? `-${formatDuration(Math.max(0, effectiveDuration - activeTime))}`
      : formatDuration(effectiveDuration);

  // ✅ 计算进度（0-1）
  const progress =
    effectiveDuration > 0
      ? Math.min(1, Math.max(0, currentTime / effectiveDuration))
      : 0;

  // ✅ 使用 useEffect 来平滑更新进度条动画
  useEffect(() => {
    if (!isDraggingRef.current && effectiveDuration > 0) {
      // 停止之前的动画
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }

      // ✅ 从 ref 获取当前进度值（同步方式，更可靠）
      const currentValue = currentProgressRef.current;
      const targetValue = progress;
      const pendingSeek = pendingSeekProgressRef.current;
      if (pendingSeek !== null) {
        const delta = Math.abs(targetValue - pendingSeek);
        if (delta > 0.02) {
          return;
        }
        if (delta <= 0.01) {
          pendingSeekProgressRef.current = null;
        }
      }
      const distance = Math.abs(targetValue - currentValue);

      // ✅ 只有当值有显著变化时才创建动画
      if (distance > 0.001) {
        // ✅ 计算动画时长：基于距离，确保平滑但不延迟
        // 小距离（<0.05）：50ms，大距离：150ms，确保平滑过渡
        const duration = Math.min(150, Math.max(50, distance * 300));

        // ✅ 确保动画值从当前值开始
        progressAnim.setValue(currentValue);

        // ✅ 使用 listener 更新 ref，确保 ref 和动画值同步
        const listenerId = progressAnim.addListener(({ value }) => {
          currentProgressRef.current = value;
          lastProgressRef.current = value;
        });

        animationRef.current = Animated.timing(progressAnim, {
          toValue: targetValue,
          duration: duration,
          useNativeDriver: false, // 进度条宽度动画需要 layout，不能用 native driver
        });

        animationRef.current.start(() => {
          progressAnim.removeListener(listenerId);
          currentProgressRef.current = targetValue;
          lastProgressRef.current = targetValue;
          progressAnim.setValue(targetValue); // ✅ 确保最终值精确
          animationRef.current = null;
        });
      } else {
        // ✅ 如果距离很小，直接设置值（避免不必要的动画）
        progressAnim.setValue(targetValue);
        currentProgressRef.current = targetValue;
        lastProgressRef.current = targetValue;
      }
    }
  }, [progress, isDragging, effectiveDuration]);

  // ✅ 重置动画值（当进度条隐藏时）
  useEffect(() => {
    if (!hasPlayedOnce && !isPlaying) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.setValue(0);
      currentProgressRef.current = 0;
      lastProgressRef.current = 0;
    }
  }, [hasPlayedOnce, isPlaying]);

  const handleLayout = (event: LayoutChangeEvent) => {
    progressBarWidth.current = event.nativeEvent.layout.width;
  };

  const handleSeekProgress = (newProgress: number, snapToSecond = false) => {
    if (!onSeek || effectiveDuration <= 0) return;
    const clampedProgress = Math.max(0, Math.min(1, newProgress));
    let seekTime = clampedProgress * effectiveDuration;
    if (snapToSecond) {
      seekTime = Math.max(0, Math.min(effectiveDuration, Math.round(seekTime)));
    }
    const snappedProgress =
      effectiveDuration > 0 ? seekTime / effectiveDuration : clampedProgress;
    const targetProgress = snapToSecond ? snappedProgress : clampedProgress;
    pendingSeekProgressRef.current = targetProgress;
    onSeek(seekTime);

    // ✅ Seek 后立即更新动画值到新位置（停止动画，直接设置）
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    if (snapToSecond) {
      progressAnim.stopAnimation();
      Animated.spring(progressAnim, {
        toValue: targetProgress,
        useNativeDriver: false,
        speed: 18,
        bounciness: 6,
      }).start();
    } else {
      progressAnim.setValue(targetProgress);
    }
    currentProgressRef.current = targetProgress;
    lastProgressRef.current = targetProgress;
    setDragTime(null);
  };

  const updateDragProgress = (x: number) => {
    if (progressBarWidth.current <= 0) return;
    const clampedX = Math.max(0, Math.min(x, progressBarWidth.current));
    const newProgress = clampedX / progressBarWidth.current;
    progressAnim.setValue(newProgress);
    currentProgressRef.current = newProgress;
    lastProgressRef.current = newProgress;
    setDragTime(newProgress * effectiveDuration);
  };

  // ✅ 创建 PanResponder 来处理拖动
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        setIsDragging(true);
        if (progressBarRef.current) {
          progressBarRef.current.measureInWindow((x, _y, width) => {
            progressBarXRef.current = x;
            progressBarWidth.current = width;
            const relativeX = evt.nativeEvent.pageX - x;
            updateDragProgress(relativeX);
          });
        }
        // ✅ 拖动开始时，停止动画并立即设置到拖动位置
        if (animationRef.current) {
          animationRef.current.stop();
          animationRef.current = null;
        }
        progressAnim.stopAnimation();
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (progressBarWidth.current <= 0) return;
        const relativeX = gestureState.moveX - progressBarXRef.current;
        // ✅ 拖动过程中，实时更新进度条位置
        updateDragProgress(relativeX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const relativeX = gestureState.moveX - progressBarXRef.current;
        if (progressBarWidth.current > 0) {
          handleSeekProgress(relativeX / progressBarWidth.current, false);
        }
        isDraggingRef.current = false;
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        // ✅ 拖动被中断时，恢复到当前播放进度
        isDraggingRef.current = false;
        setIsDragging(false);
        progressAnim.setValue(currentProgressRef.current);
        setDragTime(null);
      },
    })
  ).current;

  // ✅ 使用插值将动画值转换为百分比
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const thumbLeft = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // 默认状态（未播放过）：不显示进度条，只显示播放按钮和时间
  const shouldShowProgressBar = hasPlayedOnce || isPlaying;

  return (
    <Pressable
      style={[styles.container, style]}
      onPress={(event) => {
        event?.stopPropagation?.();
        if (!isDraggingRef.current) {
          onPlayPress();
        }
      }}
      onPressIn={(event) => {
        event?.stopPropagation?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={
        isPlaying
          ? t("accessibility.audio.paused")
          : t("accessibility.audio.playing")
      }
    >
      <TouchableOpacity
        style={styles.playButton}
        onPress={onPlayPress}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={
          isPlaying
            ? t("accessibility.audio.paused")
            : t("accessibility.audio.playing")
        }
        accessibilityRole="button"
      >
        <View style={styles.playIconContainer}>
          {isPlaying ? (
            <AudioPauseIcon width={28} height={28} />
          ) : (
            <AudioPlayIcon width={28} height={28} />
          )}
        </View>
      </TouchableOpacity>

      {shouldShowProgressBar ? (
        <View style={styles.progressContainer}>
          <View
            style={styles.progressBar}
            ref={progressBarRef}
            onLayout={handleLayout}
            {...panResponder.panHandlers}
          >
            {/* 视觉背景线 */}
            <View style={styles.progressBackground} />
            
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressWidth,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.progressThumb,
                {
                  left: thumbLeft,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <Text
        style={
          shouldShowProgressBar
            ? styles.timeTextWithProgress
            : styles.timeTextWithoutProgress
        }
      >
        {displayTime}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF5ED",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFE8D6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    height: 42, // ✅ 固定高度从 46 缩减 4px 到 42
  },
  playButton: {
    marginRight: 12,
  },
  playIconContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    // 弥散投影效果
    shadowColor: "#FFE5D0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4, // Android 阴影
  },
  progressContainer: {
    flex: 1,
    marginRight: 8,
  },
  timeTextWithProgress: {
    fontSize: 13,
    color: "#73483A",
    fontWeight: "500",
    fontFamily: "Menlo",
    letterSpacing: 0.5,
    minWidth: 45,
    textAlign: "right",
  },
  timeTextWithoutProgress: {
    fontSize: 13,
    color: "#73483A",
    fontWeight: "500",
    fontFamily: "Menlo",
    letterSpacing: 0.5,
  },
  progressBar: {
    height: 42, // ✅ 垂直热区同步缩减到 42px
    justifyContent: "center",
    position: "relative",
    width: "100%",
  },
  progressBackground: {
    height: 4,
    backgroundColor: "#FFE8D6",
    borderRadius: 2,
    width: "100%",
    position: "absolute",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    height: 4,
    backgroundColor: "#E56C45",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    width: 16, // ✅ 缩小 4px（从 20 调至 16）
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E56C45",
    top: 13, // (42-16)/2 = 13
    marginLeft: -8,
  },
});
