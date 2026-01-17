/**
 * Thankly 官方标准音频播放 Hook (useDiaryAudio)
 * 
 * 遵循顶级专业 DRY 原则：
 * 1. 统一管理：适配列表页、搜索页、详情页。
 * 2. 状态锁定：50ms 高频更新、播放完自动重置 UI（隐藏进度条）。
 * 3. 资源节约：自动清理定时器、播放器实例。
 * 4. 交互一致：点击新音频自动停止旧音频。
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createAudioPlayer, type AudioPlayer as ExpoAudioPlayer } from "expo-audio";
import { Audio } from "expo-av";

export function useDiaryAudio() {
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [currentTimeMap, setCurrentTimeMap] = useState(new Map<string, number>());
  const [durationMap, setDurationMap] = useState(new Map<string, number>());
  const [hasPlayedOnceSet, setHasPlayedOnceSet] = useState(new Set<string>());
  
  const soundRefs = useRef(new Map<string, ExpoAudioPlayer>());
  const intervalRefs = useRef(new Map<string, NodeJS.Timeout>());

  // 核心私有函数：重置特定日记的音频 UI 状态
  const resetDiaryStatus = useCallback((diaryId: string) => {
    setCurrentTimeMap(prev => {
      const next = new Map(prev);
      next.delete(diaryId);
      return next;
    });
    setDurationMap(prev => {
      const next = new Map(prev);
      next.delete(diaryId);
      return next;
    });
    setHasPlayedOnceSet(prev => {
      const next = new Set(prev);
      next.delete(diaryId);
      return next;
    });
  }, []);

  const stopAllAudio = useCallback(() => {
    soundRefs.current.forEach((player) => {
      try {
        player.pause();
        player.remove();
      } catch (_) {}
    });
    soundRefs.current.clear();

    intervalRefs.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalRefs.current.clear();
    
    setCurrentPlayingId(null);
  }, []);

  useEffect(() => {
    return () => stopAllAudio();
  }, [stopAllAudio]);

  const handlePlayAudio = async (diary: { diary_id: string; audio_url?: string; audio_duration?: number }) => {
    if (!diary.audio_url) return;
    const diaryId = diary.diary_id;

    try {
      // 1. 处理暂停逻辑
      if (currentPlayingId === diaryId) {
        const sound = soundRefs.current.get(diaryId);
        if (sound) {
          sound.pause();
          setCurrentPlayingId(null);
          // 检查播放器是否已经触发了自然结束逻辑（避免手动暂停误触重置）
          if (sound.isLoaded && sound.duration > 0 && sound.currentTime >= sound.duration - 0.5) {
            resetDiaryStatus(diaryId);
          }
        }
        return;
      }

      // 2. 停止其他正在播放的音频（互斥播放）
      if (currentPlayingId) {
        const oldSound = soundRefs.current.get(currentPlayingId);
        if (oldSound) {
          oldSound.pause();
          oldSound.remove();
          soundRefs.current.delete(currentPlayingId);
          const oldInterval = intervalRefs.current.get(currentPlayingId);
          if (oldInterval) clearInterval(oldInterval);
        }
      }

      // 3. 准备/创建播放器
      let player = soundRefs.current.get(diaryId);
      let isResuming = false;
      const savedProgress = currentTimeMap.get(diaryId) || 0;

      if (player && player.isLoaded) {
        isResuming = true;
      } else {
        // 确保 iOS 静音开关打开时也能播放
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        }).catch(() => {});

        player = createAudioPlayer(diary.audio_url, { updateInterval: 100 });
        soundRefs.current.set(diaryId, player);
        setHasPlayedOnceSet((prev) => new Set(prev).add(diaryId));

        // ✅ 核心修复：如果有关联的旧进度，在新播器加载后立即同步进度
        if (savedProgress > 0) {
          player.seekTo(savedProgress);
        }
      }

      // 4. 执行播放
      player.play();
      setCurrentPlayingId(diaryId);

      // 5. 初始化状态
      const dur = player.duration || diary.audio_duration || 0;
      if (dur > 0) setDurationMap((prev) => new Map(prev).set(diaryId, dur));
      
      // 注意：如果是从 0 开始的新播放，才强制设置 0；否则保持 savedProgress
      if (!isResuming && savedProgress === 0) {
        setCurrentTimeMap((prev) => new Map(prev).set(diaryId, 0));
      }

      // 6. 开启 50ms 监控
      setupInterval(diaryId, player, dur);

    } catch (e: any) {
      console.error("音频播放器异常:", e);
      const { Alert } = require("react-native");
      const { t } = require("../i18n");
      Alert.alert(
        t("error.playbackFailed"),
        e?.message || t("error.retryMessage")
      );
    }
  };

  const handleSeek = useCallback((diaryId: string, seconds: number) => {
    const player = soundRefs.current.get(diaryId);
    if (player && player.isLoaded) {
      setCurrentTimeMap(prev => new Map(prev).set(diaryId, seconds));
      setHasPlayedOnceSet(prev => new Set(prev).add(diaryId));
      player.seekTo(seconds);
    }
  }, []);

  const setupInterval = (diaryId: string, player: ExpoAudioPlayer, defaultDur: number) => {
    if (intervalRefs.current.has(diaryId)) clearInterval(intervalRefs.current.get(diaryId));

    const interval = setInterval(() => {
      if (!soundRefs.current.has(diaryId)) {
        clearInterval(interval);
        return;
      }

      const p = soundRefs.current.get(diaryId)!;
      
      // 更新进度
      if (p.playing && !p.paused) {
        const cur = p.currentTime;
        setCurrentTimeMap(prev => {
          const old = prev.get(diaryId) || 0;
          return Math.abs(old - cur) > 0.001 ? new Map(prev).set(diaryId, cur) : prev;
        });
      }

      // 播放完毕自动重置逻辑 ✅
      const total = p.duration || defaultDur;
      if (p.isLoaded && !p.playing && p.currentTime > 0 && total > 0 && Math.abs(p.currentTime - total) < 0.5) {
        clearInterval(interval);
        intervalRefs.current.delete(diaryId);
        setCurrentPlayingId(null);
        p.remove();
        soundRefs.current.delete(diaryId);
        resetDiaryStatus(diaryId);
      }
    }, 50);

    intervalRefs.current.set(diaryId, interval);
  };

  return {
    currentPlayingId,
    currentTimeMap,
    durationMap,
    hasPlayedOnceSet,
    handlePlayAudio,
    handleSeek,
    stopAllAudio,
  };
}
