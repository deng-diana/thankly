/**
 * useVoiceRecording Hook
 *
 * Production-grade voice recording hook with robust error handling and resource management.
 * 
 * Key principles:
 * - Single source of truth for recording state
 * - Explicit resource lifecycle management
 * - Graceful degradation on errors
 * - No silent failures
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Audio } from "expo-av";
import { Alert, AppState } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import i18n from "../i18n";

// ============================================================================
// Global State Management
// ============================================================================
// We use a global singleton to prevent multiple recording instances
// This is critical because iOS/Android only allow ONE active recording at a time

let globalRecordingInstance: Audio.Recording | null = null;
let globalIsPreparingRecording = false;
let globalActiveInstanceId: string | null = null;
let instanceCounter = 0;

/**
 * Safely cleanup a recording instance
 * This is the ONLY way to properly release native audio resources
 */
async function safeCleanupRecording(
  recording: Audio.Recording | null,
  reason: string = "unspecified"
): Promise<void> {
  if (!recording) return;
  
  try {
    const status = await recording.getStatusAsync();
    if (status.canRecord || status.isRecording) {
      console.log(`🧹 safeCleanupRecording [${reason}]: stopping and unloading...`);
      await recording.stopAndUnloadAsync();
      console.log(`✅ safeCleanupRecording [${reason}]: instance cleaned up successfully`);
    } else {
      console.log(`💡 safeCleanupRecording [${reason}]: already stopped/unloaded`);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (typeof msg === "string" && msg.includes("already been unloaded")) {
      console.log(`💡 safeCleanupRecording [${reason}]: was already unloaded`);
    } else {
      console.warn(`⚠️ safeCleanupRecording [${reason}] error:`, msg);
    }
  }
}

/**
 * Force reset global state
 * Use this as a last resort when things go wrong
 */
async function forceResetGlobalState(): Promise<void> {
  console.log("🔄 Force resetting global recording state...");
  
  if (globalRecordingInstance) {
    await safeCleanupRecording(globalRecordingInstance);
    globalRecordingInstance = null;
  }
  
  globalIsPreparingRecording = false;
  
  // Reset audio mode to default
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  } catch (error) {
    console.log("Could not reset audio mode:", error);
  }
  
  console.log("✅ Global state reset complete");
}

// ============================================================================
// Hook Interface
// ============================================================================

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
  saveRecordingDraft: () => Promise<void>; // ✅ 导出保存草稿函数
}

export function useVoiceRecording(
  maxDurationSeconds: number = 600
): UseVoiceRecordingReturn {
  const KEEP_AWAKE_TAG = "voice-recording-session";
  
  // ============================================================================
  // Recording Draft Constants
  // ============================================================================
  const RECORDING_DRAFT_KEY = "recording_draft";
  const DRAFT_SAVE_INTERVAL = 5000; // 5秒保存一次

  // ============================================================================
  // State
  // ============================================================================
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [nearLimit, setNearLimit] = useState(false);
  
  // ============================================================================
  // Recording Draft Refs
  // ============================================================================
  const startedAtRef = useRef<number | null>(null); // 录音开始时间戳
  const draftSaveIntervalRef = useRef<NodeJS.Timeout | null>(null); // 定时保存定时器

  // ============================================================================
  // Refs (for values that shouldn't trigger re-renders)
  // ============================================================================
  
  const [instanceId] = useState(() => `rec-inst-${++instanceCounter}`);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownWarningRef = useRef(false);
  const isCleaningUpRef = useRef(false); // Prevent concurrent cleanup
  const stopPromiseRef = useRef<Promise<string | null> | null>(null); // Concurrency guard for stopping
  const isRecordingRef = useRef(false);
  const saveRecordingDraftRef = useRef<(() => Promise<void>) | null>(null);
  
  // ✅ 解决循环依赖：使用 ref 来引用 stopRecording，避免声明前使用的问题
  const stopRecordingRef = useRef<(() => Promise<string | null>) | null>(null);

  // ============================================================================
  // Save Recording Draft
  // ============================================================================

  /**
   * ✅ 将录音文件复制到持久化存储（应用文档目录）
   * 临时文件可能在应用关闭后被系统清理，需要复制到持久化存储
   */
  const copyRecordingToPermanentStorage = useCallback(async (tempUri: string): Promise<string | null> => {
    try {
      // 生成唯一的文件名
      const fileName = `recording-${Date.now()}-${Math.random().toString(36).substring(7)}.m4a`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // 复制文件到文档目录
      await FileSystem.copyAsync({
        from: tempUri,
        to: permanentUri,
      });
      
      console.log(`📁 [${instanceId}] 录音文件已复制到持久化存储: ${permanentUri}`);
      return permanentUri;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${instanceId}] 复制录音文件到持久化存储失败:`, msg);
      // 如果复制失败，返回原始 URI（总比没有好）
      return tempUri;
    }
  }, [instanceId]);

  /**
   * ✅ 保存录音草稿到 AsyncStorage
   * 保存录音 URI、时长、状态等信息，用于恢复
   * 如果可能，将临时文件复制到持久化存储
   */
  const saveRecordingDraft = useCallback(async () => {
    if (!recordingRef.current || !isRecording) {
      return;
    }

    try {
      const tempUri = recordingRef.current.getURI();
      if (!tempUri) {
        // 录音还未开始，没有 URI
        return;
      }

      // ✅ 尝试将临时文件复制到持久化存储
      // 如果复制失败，仍然使用临时 URI（总比没有好）
      const permanentUri = await copyRecordingToPermanentStorage(tempUri);
      const audioUri = permanentUri || tempUri;

      const draftData = {
        audioUri: audioUri,
        startTime: startedAtRef.current || Date.now(),
        duration: duration,
        isPaused: isPaused,
        timestamp: Date.now(),
        isPermanent: permanentUri !== null, // 标记是否为持久化存储
      };

      await AsyncStorage.setItem(RECORDING_DRAFT_KEY, JSON.stringify(draftData));
      console.log(`💾 [${instanceId}] 录音草稿已保存: ${audioUri.substring(0, 50)}... (时长: ${duration}秒, 持久化: ${permanentUri !== null})`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${instanceId}] 保存录音草稿失败:`, msg);
    }
  }, [isRecording, duration, isPaused, instanceId, copyRecordingToPermanentStorage]);

  // Keep latest values for unmount cleanup without re-running the effect
  useEffect(() => {
    isRecordingRef.current = isRecording;
    saveRecordingDraftRef.current = saveRecordingDraft;
  }, [isRecording, saveRecordingDraft]);

  // ============================================================================
  // Duration Timer
  // ============================================================================

  // ============================================================================
  // Duration Timer
  // ============================================================================

  const pausedDurationRef = useRef(0); // 累计暂停时长 (毫秒)
  const lastPauseTimeRef = useRef<number | null>(null); // 上次暂停的时间点

  const updateDuration = useCallback(() => {
    if (startedAtRef.current) {
      const now = Date.now();
      const totalElapsed = now - startedAtRef.current - pausedDurationRef.current;
      const seconds = Math.floor(totalElapsed / 1000);
      const finalDuration = Math.max(0, seconds);

      // ✅ 添加调试日志（仅在开发环境或前几秒）
      if (finalDuration < 5) {
        console.log(`⏱️ [${instanceId}] Duration update: ${finalDuration}s (elapsed: ${totalElapsed}ms, paused: ${pausedDurationRef.current}ms)`);
      }

      setDuration(finalDuration);

      if (finalDuration >= maxDurationSeconds - 60 && !hasShownWarningRef.current) {
        hasShownWarningRef.current = true;
        setNearLimit(true);
      }

      if (finalDuration >= maxDurationSeconds) {
        if (stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }
    } else {
      // ✅ 如果 startedAtRef 为 null，说明录音还没开始或已停止
      // 这不应该发生，但为了安全起见，我们记录一下
      console.warn(`⚠️ [${instanceId}] updateDuration called but startedAtRef is null!`);
    }
  }, [maxDurationSeconds, instanceId]);

  const startDurationTimer = useCallback(() => {
    // ✅ 先停止现有的计时器（如果有）
    if (durationIntervalRef.current) {
      console.log(`🛑 [${instanceId}] Stopping existing duration timer`);
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // ✅ 验证 startedAtRef 是否已设置
    if (!startedAtRef.current) {
      console.error(`❌ [${instanceId}] startDurationTimer called but startedAtRef is null!`);
      return;
    }
    
    // ✅ 立即更新一次 duration，确保 UI 立即显示
    console.log(`⏰ [${instanceId}] Starting duration timer...`);
    updateDuration();
    
    // ✅ 启动定时器，每秒更新一次
    durationIntervalRef.current = setInterval(() => {
      updateDuration();
    }, 1000);
    
    console.log(`✅ [${instanceId}] Duration timer started (interval ID: ${durationIntervalRef.current})`);
  }, [updateDuration, instanceId]); 

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // ============================================================================
  // Auto-save recording draft (every 5 seconds)
  // ============================================================================

  useEffect(() => {
    // ✅ 每 5 秒自动保存录音草稿。不依赖 duration，否则每秒重跑 effect 会重置定时器、重复 copyAsync 并刷屏报错。
    if (isRecording && !isPaused) {
      saveRecordingDraft();
      draftSaveIntervalRef.current = setInterval(
        () => saveRecordingDraft(),
        DRAFT_SAVE_INTERVAL
      );
    } else {
      if (draftSaveIntervalRef.current) {
        clearInterval(draftSaveIntervalRef.current);
        draftSaveIntervalRef.current = null;
      }
    }
    return () => {
      if (draftSaveIntervalRef.current) {
        clearInterval(draftSaveIntervalRef.current);
        draftSaveIntervalRef.current = null;
      }
    };
  }, [isRecording, isPaused, saveRecordingDraft]);

  // ============================================================================
  // App state handling (background/foreground)
  // ============================================================================

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      // ✅ 应用切换到后台时，立即保存录音草稿
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (recordingRef.current && isRecording) {
          await saveRecordingDraft();
        }
      }

      // 原有的恢复逻辑
      if (nextAppState === "active" && recordingRef.current) {
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
          console.log("Error restoring recording state:", error);
        }
      }
    });

    return () => subscription.remove();
  }, [startDurationTimer, isRecording, saveRecordingDraft]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    console.log(`🏗️ [${instanceId}] useVoiceRecording initialized`);
    return () => {
      // Component unmounting - clean up everything
      (async () => {
        console.log(`🗑️ [${instanceId}] useVoiceRecording unmounting...`);

        // ✅ 组件卸载前，如果有正在进行的录音，立即保存草稿
        if (recordingRef.current && isRecordingRef.current) {
          await saveRecordingDraftRef.current?.();
        }

        // 停止定时保存
        if (draftSaveIntervalRef.current) {
          clearInterval(draftSaveIntervalRef.current);
          draftSaveIntervalRef.current = null;
        }

        // If this instance owns the global recording, release it
        if (globalActiveInstanceId === instanceId) {
          console.log(`👋 [${instanceId}] Releasing global ownership on unmount`);
          globalActiveInstanceId = null;
        }

        if (recordingRef.current) {
          await safeCleanupRecording(recordingRef.current, `unmount-${instanceId}`);
          if (globalRecordingInstance === recordingRef.current) {
            globalRecordingInstance = null;
          }
          recordingRef.current = null;
        }

        stopDurationTimer();
        try {
          await deactivateKeepAwake(KEEP_AWAKE_TAG);
        } catch (e) {}
      })();
    };
  }, [instanceId, stopDurationTimer]);

  // ============================================================================
  // Audio Interruption (电话来电等)
  // ============================================================================
  // 注意：expo-av 未提供 addAudioInterruptionListener API，调用会导致
  // TypeError: undefined is not a function（热更新后空页 + Sentry 报错）。
  // 电话/切后台时由 AppState 监听（background/inactive）已立即保存草稿，保护足够。

  // ============================================================================
  // Audio Mode Configuration
  // ============================================================================

  const configureAudioMode = useCallback(async (): Promise<void> => {
    try {
      console.log(`🔧 [${instanceId}] Configuring audio mode for recording...`);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, 
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log(`✅ [${instanceId}] Audio mode configured successfully`);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${instanceId}] Failed to configure audio mode:`, msg);
      throw error;
    }
  }, [instanceId]);

  // ============================================================================
  // Permission Request
  // ============================================================================

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log(`🔐 [${instanceId}] Requesting microphone permission...`);
      const { granted, status } = await Audio.requestPermissionsAsync();
      console.log(`🔐 [${instanceId}] Permission result:`, { granted, status });
      
      if (!granted) {
        console.error(`❌ [${instanceId}] Microphone permission denied (status: ${status})`);
        Alert.alert("需要麦克风权限", "请在设置中允许访问麦克风");
        return false;
      }
      
      console.log(`✅ [${instanceId}] Microphone permission granted`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [${instanceId}] Permission request failed:`, msg);
      return false;
    }
  }, [instanceId]);

  // ============================================================================
  // START RECORDING
  // ============================================================================

  const startRecording = useCallback(async (): Promise<void> => {
    // Guard: Prevent concurrent start attempts
    if (isStarting) {
      console.log(`⚠️ [${instanceId}] Recording start already in progress, ignoring`);
      return;
    }

    setIsStarting(true);
    console.log(`🎤 [${instanceId}] Starting recording flow...`);
    
    // Take ownership immediately
    const previousOwner = globalActiveInstanceId;
    globalActiveInstanceId = instanceId;
    if (previousOwner && previousOwner !== instanceId) {
      console.log(`🔄 [${instanceId}] Taking ownership from ${previousOwner}`);
    }

    try {
      // Step 1: Check permissions
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        throw new Error("Microphone permission denied");
      }

      // Step 2: Force cleanup any existing recording state before starting
      // This ensures we can recover from any "Already recording" deadlock
      if (isRecording || recordingRef.current || globalRecordingInstance) {
        console.log(`🧹 [${instanceId}] Forcing cleanup of existing recording state before start...`);
        stopDurationTimer();

        // ✅ 重置所有计时相关的 refs
        startedAtRef.current = null;
        pausedDurationRef.current = 0;
        lastPauseTimeRef.current = null;

        if (recordingRef.current) {
          await safeCleanupRecording(recordingRef.current, `start-local-${instanceId}`);
          recordingRef.current = null;
        }

        if (globalRecordingInstance) {
          await safeCleanupRecording(globalRecordingInstance, `start-global-${instanceId}`);
          globalRecordingInstance = null;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Wait for native cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Wait for any concurrent preparation to finish
      let waitCount = 0;
      while (globalIsPreparingRecording && waitCount < 20) {
        console.log(`⏳ Waiting for concurrent preparation to finish... (${waitCount + 1}/20)`);
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }

      if (globalIsPreparingRecording) {
        console.warn("⚠️ Concurrent preparation timeout, forcing reset");
        await forceResetGlobalState();
      }

      // Step 4: Mark as preparing
      globalIsPreparingRecording = true;

      // Step 5: Stop duration timer
      stopDurationTimer();

      // Step 6: Configure audio mode
      console.log("🔧 Configuring audio mode...");
      await configureAudioMode();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 7: Activate keep awake
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);

      // Step 8: Create recording instance
      console.log("📱 Creating recording instance...");
      
      // ✅ Phase 1 优化 (2026-01-30): 音频压缩提升上传速度
      // - 64kbps: 语音识别足够，体积减少 33%
      // - 22050Hz: iOS 兼容的低采样率（16kHz 不被 iOS AAC 支持）
      // - 单声道: 语音不需要立体声，体积减少 50%
      // 参考: https://community.openai.com/t/what-minimum-bitrate-should-i-use-for-whisper/178210
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 22050,       // 优化: 44100 → 22050 (低采样率，节省空间)
          numberOfChannels: 1,     // 优化: 2 → 1 (单声道，语音足够)
          bitRate: 64000,          // 优化: 96000 → 64000 (语音识别足够)
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM, // 优化: HIGH → MEDIUM (配合低比特率)
          sampleRate: 22050,       // 优化: 44100 → 22050 (iOS 兼容的低采样率)
          numberOfChannels: 1,     // 优化: 2 → 1 (单声道，语音足够)
          bitRate: 64000,          // 优化: 96000 → 64000 (语音识别足够)
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 64000,    // 优化: 96000 → 64000
        },
      };

      // Try up to 2 times
      let recording: Audio.Recording | null = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        console.log(`📡 [${instanceId}] Recording attempt ${attempt}/2...`);
        
        const tempRecording = new Audio.Recording();
        
        try {
          console.log(`🔧 [${instanceId}] Preparing recording...`);
          await tempRecording.prepareToRecordAsync(recordingOptions);
          console.log(`✅ [${instanceId}] Recording prepared successfully`);
          
          console.log(`🎤 [${instanceId}] Starting recording...`);
          await tempRecording.startAsync();
          console.log(`✅ [${instanceId}] startAsync() called`);
          
          // ✅ 关键修复：等待一小段时间让 Native 层真正启动录音
          // iOS/Android 的录音启动是异步的，需要给系统一些时间
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // ✅ 验证录音状态 - 多次检查确保真正启动
          let status = await tempRecording.getStatusAsync();
          console.log(`📊 [${instanceId}] Initial status check:`, {
            isRecording: status.isRecording,
            canRecord: status.canRecord,
            durationMillis: status.durationMillis,
          });
          
          // ✅ 如果第一次检查失败，再等待并重试一次
          if (!status.isRecording) {
            console.log(`⏳ [${instanceId}] First check failed, waiting 200ms and retrying...`);
            await new Promise(resolve => setTimeout(resolve, 200));
            status = await tempRecording.getStatusAsync();
            console.log(`📊 [${instanceId}] Retry status check:`, {
              isRecording: status.isRecording,
              canRecord: status.canRecord,
              durationMillis: status.durationMillis,
            });
          }
          
          // ✅ 最终验证：确保录音真正启动
          if (!status.isRecording) {
            const errorMsg = `Recording created but not in recording state. Status: ${JSON.stringify(status)}`;
            console.error(`❌ [${instanceId}] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          // ✅ 额外验证：检查是否有录音时长（表示真正在录音）
          if (status.durationMillis === undefined || status.durationMillis === null) {
            console.warn(`⚠️ [${instanceId}] Warning: durationMillis is undefined, but isRecording is true`);
          }
          
          recording = tempRecording;
          console.log(`✅ [${instanceId}] Recording started successfully! Status:`, {
            isRecording: status.isRecording,
            durationMillis: status.durationMillis,
          });
          break;
        } catch (error: unknown) {
          lastError = error;
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`❌ [${instanceId}] Attempt ${attempt} failed:`, msg);
          
          await safeCleanupRecording(tempRecording);
          
          if (typeof msg === "string" && msg.includes("Only one Recording") && attempt < 2) {
            console.log(`🔄 [${instanceId}] Attempting aggressive reset...`);
            await forceResetGlobalState();
            await new Promise(resolve => setTimeout(resolve, 500));
            await configureAudioMode();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      if (!recording) {
        throw lastError || new Error("Failed to create recording");
      }

      recordingRef.current = recording;
      globalRecordingInstance = recording;

      // ✅ 关键修复：先重置所有状态，确保干净的开始
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setNearLimit(false);
      hasShownWarningRef.current = false;
      
      // ✅ 关键修复：先设置开始时间戳，再启动计时器
      // 确保 startedAtRef 在计时器启动前就已经设置好
      const startTime = Date.now();
      startedAtRef.current = startTime;
      pausedDurationRef.current = 0;
      lastPauseTimeRef.current = null;
      
      console.log(`⏰ [${instanceId}] Started at timestamp: ${startTime}`);

      // ✅ 关键修复：确保计时器正确启动
      // 先立即更新一次 duration，确保 UI 立即显示 0 秒
      updateDuration();

      // 然后启动定时器
      startDurationTimer();

      // ✅ 关键修复：双重验证计时器是否启动，如果失败则强制重试
      if (durationIntervalRef.current) {
        console.log(`✅ [${instanceId}] Duration timer started successfully`);
      } else {
        console.error(`❌ [${instanceId}] Duration timer failed to start! Retrying...`);
        // ⚠️ 强制重试：如果计时器没有启动，可能是因为某些边缘情况
        // 在 100ms 后再次尝试启动计时器
        setTimeout(() => {
          if (!durationIntervalRef.current && startedAtRef.current) {
            console.log(`🔄 [${instanceId}] Force retrying duration timer...`);
            updateDuration();
            durationIntervalRef.current = setInterval(() => {
              updateDuration();
            }, 1000);
            console.log(`✅ [${instanceId}] Duration timer force-started (interval ID: ${durationIntervalRef.current})`);
          }
        }, 100);
      }
      
      // ✅ 验证状态
      console.log(`📊 [${instanceId}] Final recording state:`, {
        isRecording: true,
        startedAt: startedAtRef.current,
        durationInterval: durationIntervalRef.current !== null,
      });
      
      // ✅ 关键修复：在启动后 1 秒再次验证录音状态，确保真正在录音
      setTimeout(async () => {
        try {
          if (recordingRef.current) {
            const verifyStatus = await recordingRef.current.getStatusAsync();
            console.log(`🔍 [${instanceId}] Post-start verification (1s later):`, {
              isRecording: verifyStatus.isRecording,
              durationMillis: verifyStatus.durationMillis,
            });
            
            if (!verifyStatus.isRecording) {
              console.error(`❌ [${instanceId}] CRITICAL: Recording stopped unexpectedly after 1 second!`);
              // 尝试恢复
              try {
                await recordingRef.current.startAsync();
                console.log(`🔄 [${instanceId}] Attempted to restart recording`);
              } catch (restartError) {
                console.error(`❌ [${instanceId}] Failed to restart recording:`, restartError);
              }
            } else if (verifyStatus.durationMillis && verifyStatus.durationMillis > 0) {
              console.log(`✅ [${instanceId}] Recording confirmed active (duration: ${verifyStatus.durationMillis}ms)`);
            }
          }
        } catch (verifyError) {
          console.error(`❌ [${instanceId}] Post-start verification failed:`, verifyError);
        }
      }, 1000);
      
      console.log(`✅ [${instanceId}] Recording flow completed successfully`);
    } catch (error: unknown) {
      console.error(`❌ [${instanceId}] Recording start failed:`, error);
      if (globalRecordingInstance) {
        await safeCleanupRecording(globalRecordingInstance, `error-${instanceId}`);
        if (globalActiveInstanceId === instanceId) {
          globalRecordingInstance = null;
        }
      }
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      try { await deactivateKeepAwake(KEEP_AWAKE_TAG); } catch (e) {}
      const msg = error instanceof Error ? error.message : String(error);
      const errorMessage = typeof msg === "string" && msg.includes("Only one Recording")
        ? i18n.t("errors.microphoneInUse")
        : i18n.t("errors.unableToStartRecording");
      Alert.alert(i18n.t("errors.recordingFailed"), errorMessage);
    } finally {
      globalIsPreparingRecording = false;
      setIsStarting(false);
    }
  }, [instanceId, requestPermission, startDurationTimer, configureAudioMode]);


  // ============================================================================
  // PAUSE RECORDING
  // ============================================================================

  const pauseRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !isRecording || isPaused) {
      console.log("⚠️ Cannot pause: invalid state");
      return;
    }

    try {
      await recordingRef.current.pauseAsync();
      setIsPaused(true);
      stopDurationTimer();
      console.log("⏸️ Recording paused");
      
      lastPauseTimeRef.current = Date.now();
      await saveRecordingDraft();
    } catch (error) {
      console.error("Failed to pause recording:", error);
    }
  }, [isRecording, isPaused, saveRecordingDraft, stopDurationTimer]);

  // ============================================================================
  // RESUME RECORDING
  // ============================================================================

  const resumeRecording = useCallback(async (): Promise<void> => {
    if (!recordingRef.current || !isRecording || !isPaused) {
      console.log("⚠️ Cannot resume: invalid state");
      return;
    }

    try {
      await configureAudioMode();
      await recordingRef.current.startAsync();
      setIsPaused(false);
      
      if (lastPauseTimeRef.current) {
        const pauseDuration = Date.now() - lastPauseTimeRef.current;
        pausedDurationRef.current += pauseDuration;
        lastPauseTimeRef.current = null;
        console.log(`▶️ Resuming after pause of ${Math.floor(pauseDuration/1000)}s`);
      }
      
      startDurationTimer();
      console.log("▶️ Recording resumed");
      await saveRecordingDraft();
    } catch (error) {
      console.error("Failed to resume recording:", error);
    }
  }, [isRecording, isPaused, configureAudioMode, saveRecordingDraft, startDurationTimer]);

  // ============================================================================
  // STOP RECORDING
  // ============================================================================

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) {
      console.log(`⚠️ [${instanceId}] No recording to stop`);
      return null;
    }

    if (stopPromiseRef.current) {
      console.log(`⏳ [${instanceId}] Stop already in progress, returning existing promise`);
      return stopPromiseRef.current;
    }

    const localStopAction = async (): Promise<string | null> => {
      try {
        console.log(`⏹️ [${instanceId}] Stopping recording...`);
        const uri = recordingRef.current?.getURI() || null;
        
        try {
          await recordingRef.current?.stopAndUnloadAsync();
          console.log(`✅ [${instanceId}] Recording stopped successfully`);
        } catch (unloadError: unknown) {
          const uMsg = unloadError instanceof Error ? unloadError.message : String(unloadError);
          if (typeof uMsg === "string" && uMsg.includes("already been unloaded")) {
            console.log(`💡 [${instanceId}] Recording was already unloaded, proceeding with URI`);
          } else {
            throw unloadError;
          }
        }
        
        if (globalRecordingInstance === recordingRef.current) {
          globalRecordingInstance = null;
          globalActiveInstanceId = null;
        }
        recordingRef.current = null;

        stopDurationTimer();
        if (draftSaveIntervalRef.current) {
          clearInterval(draftSaveIntervalRef.current);
          draftSaveIntervalRef.current = null;
        }

        // ✅ 关键修复：重置所有计时器相关的 refs
        startedAtRef.current = null;
        pausedDurationRef.current = 0;
        lastPauseTimeRef.current = null;

        setIsRecording(false);
        setIsPaused(false);
        
        try {
          await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
          console.log(`🗑️ [${instanceId}] 录音完成，已清除草稿`);
        } catch (error) {
          console.error(`❌ [${instanceId}] 清除草稿失败:`, error);
        }

        try {
          await deactivateKeepAwake(KEEP_AWAKE_TAG);
        } catch (e) {}

        return uri;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [${instanceId}] Failed to stop recording:`, msg);
        stopDurationTimer();
        
        // ✅ 关键修复：重置所有计时器相关的 refs
        startedAtRef.current = null;
        pausedDurationRef.current = 0;
        lastPauseTimeRef.current = null;
        
        setIsRecording(false);
        setIsPaused(false);
        recordingRef.current = null;
        return null;
      } finally {
        stopPromiseRef.current = null;
      }
    };

    stopPromiseRef.current = localStopAction();
    return stopPromiseRef.current;
  }, [instanceId, stopDurationTimer]);

  // ✅ 更新 ref，解决循环依赖
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);


  // ============================================================================
  // CANCEL RECORDING
  // ============================================================================

  const cancelRecording = useCallback(async (): Promise<void> => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    console.log(`🧹 [${instanceId}] Canceling recording...`);
    try {
      if (recordingRef.current) {
        await safeCleanupRecording(recordingRef.current, `cancel-local-${instanceId}`);
        if (globalRecordingInstance === recordingRef.current) {
          globalRecordingInstance = null;
          globalActiveInstanceId = null;
        }
        recordingRef.current = null;
      } else if (globalRecordingInstance && globalActiveInstanceId === instanceId) {
        await safeCleanupRecording(globalRecordingInstance, `cancel-global-${instanceId}`);
        globalRecordingInstance = null;
        globalActiveInstanceId = null;
      }
      globalIsPreparingRecording = false;
      stopDurationTimer();
      
      // ✅ 关键修复：重置所有计时器相关的 refs
      startedAtRef.current = null;
      pausedDurationRef.current = 0;
      lastPauseTimeRef.current = null;
      
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setIsStarting(false);
      hasShownWarningRef.current = false;
      try {
        await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
      } catch (e) {}
      try {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch (e) {}
      console.log(`✅ [${instanceId}] Recording canceled successfully`);
    } catch (error) {
      console.error("Error during cancel:", error);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, [instanceId, stopDurationTimer]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

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
    saveRecordingDraft,
  };
}
