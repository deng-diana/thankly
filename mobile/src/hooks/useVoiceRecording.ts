/**
 * useVoiceRecording Hook
 *
 * 📚 学习点：自定义 Hook (Custom Hook)
 * 1. **逻辑复用**：将复杂的录音逻辑（权限、状态、定时器、音频模式）封装在一起，
 *    让不同的组件（如 RecordingModal 和 ImageDiaryModal）可以共享同一套逻辑。
 * 2. **关注点分离**：UI 组件只负责展示，Hook 负责业务逻辑。
 * 3. **易于测试**：逻辑独立后，可以更方便地进行单元测试。
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Audio } from "expo-av";
import { Alert, AppState } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  isStarting: boolean;
  nearLimit: boolean;
  startRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
}

export function useVoiceRecording(
  maxDurationSeconds: number = 600
): UseVoiceRecordingReturn {
  const KEEP_AWAKE_TAG = "voice-recording-session";

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [nearLimit, setNearLimit] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownWarningRef = useRef(false);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    durationIntervalRef.current = setInterval(async () => {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          const seconds = Math.floor(status.durationMillis / 1000);
          setDuration(seconds);

          if (seconds >= maxDurationSeconds - 60 && !hasShownWarningRef.current) {
            hasShownWarningRef.current = true;
            setNearLimit(true);
          }

          if (seconds >= maxDurationSeconds) {
            stopRecording();
          }
        }
      }
    }, 1000);
  }, [maxDurationSeconds]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !recordingRef.current) {
        return;
      }

      try {
        const status = await recordingRef.current.getStatusAsync();
        const seconds = Math.floor(status.durationMillis / 1000);
        setDuration(seconds);

        if (status.isRecording) {
          setIsRecording(true);
          setIsPaused(false);
          startDurationTimer();
          await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        } else if (status.canRecord) {
          setIsRecording(true);
          setIsPaused(true);
          await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        }
      } catch (error) {
        console.log("恢复录音状态失败:", error);
      }
    });

    return () => subscription.remove();
  }, [startDurationTimer]);

  const configureAudioMode = async () => {
    try {
      // ✅ 关键修复：先设置音频模式为录音模式
      // 使用数字值：1 = DoNotMix (停止其他音频), 2 = DuckOthers (降低其他音频)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, // ✅ DoNotMix - 停止其他音频，避免冲突
        interruptionModeAndroid: 1, // ✅ DoNotMix - 停止其他音频，避免冲突
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // ✅ 额外等待一小段时间，确保音频模式切换完成
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Failed to configure audio mode:", error);
      throw error; // ✅ 抛出错误，让调用者知道配置失败
    }
  };

  const requestPermission = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("需要麦克风权限", "请在设置中允许访问麦克风");
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    if (isStarting) return;
    setIsStarting(true);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsStarting(false);
        return;
      }

      // ✅ 关键修复：在创建新录音之前，先清理之前的录音对象
      // 这可以防止 "Only one Recording object can be prepared at a given time" 错误
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          // ✅ 更彻底的清理：无论什么状态，都尝试停止并卸载
          if (status.isLoaded) {
            if (status.isRecording) {
              await recordingRef.current.stopAndUnloadAsync();
            } else if (status.canRecord) {
              // 如果已经准备好但还没开始录音，也需要卸载
              await recordingRef.current.unloadAsync();
            } else {
              // 其他状态也尝试卸载
              try {
                await recordingRef.current.unloadAsync();
              } catch (e) {
                // 如果卸载失败，尝试停止并卸载
                try {
                  await recordingRef.current.stopAndUnloadAsync();
                } catch (e2) {
                  // 如果还是失败，忽略错误
                }
              }
            }
          }
        } catch (error) {
          console.log("清理之前的录音对象时出错（可忽略）:", error);
          // ✅ 即使出错，也确保 ref 被清空
        }
        recordingRef.current = null;
        // ✅ 额外等待，确保录音对象完全释放
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // ✅ 清理之前的定时器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // ✅ 关键修复：先配置音频模式（这会停止所有播放），再创建录音对象
      try {
        await configureAudioMode();
      } catch (error) {
        console.error("配置音频模式失败:", error);
        // ✅ 即使配置失败，也尝试继续（某些情况下可能仍然可以录音）
        // 但记录错误以便调试
      }
      
      // ✅ 额外等待，确保所有音频播放器已完全停止
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setNearLimit(false);
      hasShownWarningRef.current = false;

      startDurationTimer();
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("错误", "启动录音失败，请重试");
    } finally {
      setIsStarting(false);
    }
  };

  const pauseRecording = async () => {
    if (!recordingRef.current || !isRecording || isPaused) return;
    try {
      await recordingRef.current.pauseAsync();
      setIsPaused(true);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    } catch (error) {
      console.error("Failed to pause recording:", error);
    }
  };

  const resumeRecording = async () => {
    if (!recordingRef.current || !isRecording || !isPaused) return;
    try {
      await configureAudioMode();
      await recordingRef.current.startAsync();
      setIsPaused(false);

      startDurationTimer();
    } catch (error) {
      console.error("Failed to resume recording:", error);
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      const uri = recordingRef.current.getURI();
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      setIsRecording(false);
      setIsPaused(false);
      deactivateKeepAwake(KEEP_AWAKE_TAG);

      return uri;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      return null;
    }
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    deactivateKeepAwake(KEEP_AWAKE_TAG);
  };

  return {
    isRecording,
    isPaused,
    duration,
    isStarting,
    nearLimit,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}
