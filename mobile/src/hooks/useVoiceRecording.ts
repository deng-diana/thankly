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
import * as FileSystem from "expo-file-system";

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
  } catch (error: any) {
    if (error.message?.includes("already been unloaded")) {
      console.log(`💡 safeCleanupRecording [${reason}]: was already unloaded`);
    } else {
      console.warn(`⚠️ safeCleanupRecording [${reason}] error:`, error.message);
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

  // ============================================================================
  // Duration Timer
  // ============================================================================

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    durationIntervalRef.current = setInterval(async () => {
      if (recordingRef.current) {
        try {
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
        } catch (error) {
          console.log("Error getting recording status:", error);
        }
      }
    }, 1000);
  }, [maxDurationSeconds]);

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
    // ✅ 每 5 秒自动保存录音草稿
    if (isRecording && !isPaused) {
      // 立即保存一次（不等待5秒）
      saveRecordingDraft();
      
      // 然后每5秒保存一次
      draftSaveIntervalRef.current = setInterval(() => {
        saveRecordingDraft();
      }, DRAFT_SAVE_INTERVAL);
    } else {
      // 停止定时保存
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
  }, [isRecording, isPaused, duration, saveRecordingDraft]);

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
        if (recordingRef.current && isRecording) {
          await saveRecordingDraft();
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
  }, [isRecording, saveRecordingDraft, stopDurationTimer, instanceId]);

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
    } catch (error: any) {
      console.error(`❌ [${instanceId}] 复制录音文件到持久化存储失败:`, error.message);
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
    } catch (error: any) {
      console.error(`❌ [${instanceId}] 保存录音草稿失败:`, error.message);
    }
  }, [isRecording, duration, isPaused, instanceId, copyRecordingToPermanentStorage]);

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
  // Audio Interruption Listener (电话来电等中断)
  // ============================================================================

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    // ✅ 监听音频中断事件（电话来电、其他应用播放音频等）
    const interruptionSubscription = Audio.addAudioInterruptionListener((interruption) => {
      console.log(`⚠️ [${instanceId}] 音频中断事件:`, interruption);
      
      if (interruption.type === 'began') {
        // 录音被中断（可能是电话来电或其他应用播放音频）
        console.log(`⚠️ [${instanceId}] 录音被中断，立即保存草稿`);
        if (recordingRef.current && isRecording) {
          // 立即保存当前录音
          saveRecordingDraft();
        }
      } else if (interruption.type === 'ended') {
        // 中断结束（电话挂断等）
        console.log(`✅ [${instanceId}] 音频中断结束`);
        // 可以在这里恢复录音，但通常用户需要手动恢复
      }
    });

    return () => {
      interruptionSubscription.remove();
    };
  }, [isRecording, saveRecordingDraft, instanceId]);

  // ============================================================================
  // Audio Mode Configuration
  // ============================================================================

  const configureAudioMode = async (): Promise<void> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, // DoNotMix - stop other audio
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Give the system time to apply the mode
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Failed to configure audio mode:", error);
      throw error;
    }
  };

  // ============================================================================
  // Permission Request
  // ============================================================================

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("需要麦克风权限", "请在设置中允许访问麦克风");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Permission request failed:", error);
      return false;
    }
  };

  // ============================================================================
  // START RECORDING
  // ============================================================================

  const startRecording = async (): Promise<void> => {
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
      
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 96000, // ✅ 优化: 减少25%文件大小，加快上传
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 96000, // ✅ 优化: 减少25%文件大小，加快上传
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 96000, // ✅ 优化: 减少25%文件大小
        },
      };

      // Try up to 2 times (not 3, to fail faster)
      let recording: Audio.Recording | null = null;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        console.log(`📡 Recording attempt ${attempt}/2...`);
        
        const tempRecording = new Audio.Recording();
        
        try {
          await tempRecording.prepareToRecordAsync(recordingOptions);
          await tempRecording.startAsync();
          
          // Verify it's actually recording
          const status = await tempRecording.getStatusAsync();
          if (!status.isRecording) {
            throw new Error("Recording created but not in recording state");
          }
          
          recording = tempRecording;
          console.log("✅ Recording started successfully");
          break;
        } catch (error: any) {
          lastError = error;
          console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
          
          // CRITICAL: Clean up the failed instance
          await safeCleanupRecording(tempRecording);
          
          // If this is the "Only one Recording" error and we have attempts left
          if (error.message?.includes("Only one Recording") && attempt < 2) {
            console.log("🔄 Attempting aggressive reset...");
            await forceResetGlobalState();
            await new Promise(resolve => setTimeout(resolve, 500));
            await configureAudioMode();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      // If all attempts failed, throw the last error
      if (!recording) {
        throw lastError || new Error("Failed to create recording");
      }

      // Step 9: Save references
      recordingRef.current = recording;
      globalRecordingInstance = recording;

      // Step 10: Update state
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setNearLimit(false);
      hasShownWarningRef.current = false;
      
      // ✅ 记录录音开始时间
      startedAtRef.current = Date.now();

      // Step 11: Start duration timer
      startDurationTimer();
      
      // ✅ Step 12: 启动定时保存录音草稿（每5秒）
      // 注意：这里不立即保存，因为录音刚开始可能还没有 URI
      // 第一次保存会在定时器中执行

      console.log("✅ Recording flow completed successfully");
    } catch (error: any) {
      console.error(`❌ [${instanceId}] Recording start failed:`, error);

      // Clean up on error
      if (globalRecordingInstance) {
        await safeCleanupRecording(globalRecordingInstance, `error-${instanceId}`);
        if (globalActiveInstanceId === instanceId) {
          globalRecordingInstance = null;
        }
      }

      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);

      try {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch (e) {
        // Ignore
      }

      // Show user-friendly error
      const errorMessage = error.message?.includes("Only one Recording")
        ? "麦克风正被其他应用占用。请关闭其他正在使用麦克风的应用（如微信、电话等），然后重试。"
        : "无法启动录音。请检查麦克风权限并重试。";

      Alert.alert("录音失败", errorMessage);
    } finally {
      globalIsPreparingRecording = false;
      setIsStarting(false);
    }
  };


  // ============================================================================
  // PAUSE RECORDING
  // ============================================================================

  const pauseRecording = async (): Promise<void> => {
    if (!recordingRef.current || !isRecording || isPaused) {
      console.log("⚠️ Cannot pause: invalid state");
      return;
    }

    try {
      await recordingRef.current.pauseAsync();
      setIsPaused(true);
      stopDurationTimer();
      console.log("⏸️ Recording paused");
      
      // ✅ 暂停后立即保存草稿
      await saveRecordingDraft();
    } catch (error) {
      console.error("Failed to pause recording:", error);
    }
  };

  // ============================================================================
  // RESUME RECORDING
  // ============================================================================

  const resumeRecording = async (): Promise<void> => {
    if (!recordingRef.current || !isRecording || !isPaused) {
      console.log("⚠️ Cannot resume: invalid state");
      return;
    }

    try {
      await configureAudioMode();
      await recordingRef.current.startAsync();
      setIsPaused(false);
      startDurationTimer();
      console.log("▶️ Recording resumed");
      
      // ✅ 恢复后立即保存草稿
      await saveRecordingDraft();
    } catch (error) {
      console.error("Failed to resume recording:", error);
    }
  };

  // ============================================================================
  // STOP RECORDING
  // ============================================================================

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) {
      console.log(`⚠️ [${instanceId}] No recording to stop`);
      return null;
    }

    // Guard: Prevent concurrent stop calls for the same instance
    if (stopPromiseRef.current) {
      console.log(`⏳ [${instanceId}] Stop already in progress, returning existing promise`);
      return stopPromiseRef.current;
    }

    const localStopAction = async (): Promise<string | null> => {
      try {
        console.log(`⏹️ [${instanceId}] Stopping recording...`);
        
        // 1. Capture URI BEFORE stopAndUnload
        const uri = recordingRef.current?.getURI() || null;
        
        try {
          // 2. Try to stop and unload
          await recordingRef.current?.stopAndUnloadAsync();
          console.log(`✅ [${instanceId}] Recording stopped successfully`);
        } catch (unloadError: any) {
          // If it fails because it's already unloaded, that's actually fine - we want the URI!
          if (unloadError.message?.includes("already been unloaded")) {
            console.log(`💡 [${instanceId}] Recording was already unloaded, proceeding with URI`);
          } else {
            throw unloadError;
          }
        }
        
        // Clean up references
        if (globalRecordingInstance === recordingRef.current) {
          globalRecordingInstance = null;
          globalActiveInstanceId = null;
        }
        recordingRef.current = null;

        // Stop timer
        stopDurationTimer();
        
        // ✅ 停止定时保存
        if (draftSaveIntervalRef.current) {
          clearInterval(draftSaveIntervalRef.current);
          draftSaveIntervalRef.current = null;
        }

        // Update state
        setIsRecording(false);
        setIsPaused(false);
        
        // ✅ 录音完成后，清除草稿（因为录音已完成，不需要再保存草稿）
        try {
          await AsyncStorage.removeItem(RECORDING_DRAFT_KEY);
          console.log(`🗑️ [${instanceId}] 录音完成，已清除草稿`);
        } catch (error) {
          console.error(`❌ [${instanceId}] 清除草稿失败:`, error);
        }

        // Deactivate keep awake
        try {
          await deactivateKeepAwake(KEEP_AWAKE_TAG);
        } catch (e) {}

        return uri;
      } catch (error) {
        console.error(`❌ [${instanceId}] Failed to stop recording:`, error);
        // Reset state even on failure
        setIsRecording(false);
        setIsPaused(false);
        stopDurationTimer();
        recordingRef.current = null;
        return null;
      } finally {
        stopPromiseRef.current = null;
      }
    };

    stopPromiseRef.current = localStopAction();
    return stopPromiseRef.current;
  };


  // ============================================================================
  // CANCEL RECORDING
  // ============================================================================

  const cancelRecording = async (): Promise<void> => {
    // Prevent concurrent cleanup
    if (isCleaningUpRef.current) {
      console.log("⚠️ Cleanup already in progress");
      return;
    }

    isCleaningUpRef.current = true;
    console.log(`🧹 [${instanceId}] Canceling recording...`);

    try {
      // Clean up recording
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

      // Reset global flag
      globalIsPreparingRecording = false;

      // Stop timer
      stopDurationTimer();

      // Reset state
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setIsStarting(false);
      hasShownWarningRef.current = false;

      // Deactivate keep awake
      try {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch (e) {
        // Ignore
      }

      console.log("✅ Recording canceled successfully");
    } catch (error) {
      console.error("Error during cancel:", error);
    } finally {
      isCleaningUpRef.current = false;
    }
  };

  const startRecordingCallback = useCallback(startRecording, [isStarting, isRecording, maxDurationSeconds, startDurationTimer, stopDurationTimer]);
  const stopRecordingCallback = useCallback(stopRecording, [stopDurationTimer]);
  const pauseRecordingCallback = useCallback(pauseRecording, [isRecording, isPaused, stopDurationTimer, saveRecordingDraft]);
  const resumeRecordingCallback = useCallback(resumeRecording, [isRecording, isPaused, startDurationTimer, saveRecordingDraft]);
  const cancelRecordingCallback = useCallback(cancelRecording, [stopDurationTimer, isCleaningUpRef]);
  const saveRecordingDraftCallback = useCallback(saveRecordingDraft, [saveRecordingDraft]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    isRecording,
    isPaused,
    duration,
    isStarting,
    nearLimit,
    startRecording: startRecordingCallback,
    pauseRecording: pauseRecordingCallback,
    resumeRecording: resumeRecordingCallback,
    stopRecording: stopRecordingCallback,
    cancelRecording: cancelRecordingCallback,
    saveRecordingDraft: saveRecordingDraftCallback, // ✅ 导出保存草稿函数
  };
}
