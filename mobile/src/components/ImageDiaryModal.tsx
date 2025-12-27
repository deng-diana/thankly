/**
 * 图片日记 Modal - 极简设计
 *
 * 功能：选择图片 → 显示预览 → 添加语音/文字（可选）→ 保存
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  createImageOnlyDiary,
  createVoiceDiaryStream,
  ProgressCallback,
} from "../services/diaryService";
import { uploadDiaryImages } from "../services/diaryService";
import ImageInputIcon from "../assets/icons/addImageIcon.svg";
import TextInputIcon from "../assets/icons/textInputIcon.svg";
import { t } from "../i18n";
import { Typography } from "../styles/typography";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// 4列布局：左右padding 20*2=40，3个间距 8*3=6，尽可能填满宽度，不留多余空白
const THUMBNAIL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 24) / 4); // 4列，紧凑布局，向下取整

interface ImageDiaryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  maxImages?: number;
  onAddImage?: () => void; // 添加图片回调
  onAddVoice?: () => void; // ✅ 移除：不再需要回调，直接在内部处理
  onAddText?: () => void; // 添加文字回调
}

export default function ImageDiaryModal({
  visible,
  onClose,
  onSuccess,
  maxImages = 9,
  onAddImage,
  onAddVoice,
  onAddText,
}: ImageDiaryModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false); // 显示底部选择器
  const [showConfirmModal, setShowConfirmModal] = useState(false); // 显示确认弹窗
  const [textContent, setTextContent] = useState(""); // 文字内容
  // ✅ 文字输入框默认显示（用户选择图片后自动显示）

  // ✅ 新增：录音相关状态
  const [isRecordingMode, setIsRecordingMode] = useState(false); // 是否进入录音模式
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nearLimit, setNearLimit] = useState(false);

  // ✅ 新增：处理进度状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  const currentProgressRef = useRef(0);
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 新增：录音动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // ✅ 新增：录音相关refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);
  const hasShown9MinWarning = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  // ✅ 处理步骤配置（与 RecordingModal 保持一致）
  const processingSteps = [
    { icon: "📤", text: t("diary.processingSteps.upload"), progress: 20 },
    { icon: "👂", text: t("diary.processingSteps.listen"), progress: 50 },
    { icon: "✨", text: t("diary.processingSteps.polish"), progress: 70 },
    { icon: "💭", text: t("diary.processingSteps.title"), progress: 85 },
    { icon: "💬", text: t("diary.processingSteps.feedback"), progress: 100 },
  ];

  // Modal 打开时，显示底部选择器
  useEffect(() => {
    if (visible && images.length === 0) {
      setShowPicker(true);
    }
    // ✅ 重置录音模式状态
    if (!visible) {
      setIsRecordingMode(false);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);
      setIsProcessing(false);
    }
  }, [visible]);

  // ✅ 清理录音资源
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.log);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      deactivateKeepAwake();
    };
  }, []);

  // 拍照
  const handleTakePhoto = async () => {
    setShowPicker(false); // 关闭选择器

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要相机权限", "请在设置中允许访问相机");
        onClose();
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        onClose();
        return;
      }

      setImages([result.assets[0].uri]);
    } catch (error) {
      console.error("拍照失败:", error);
      Alert.alert("拍照失败", "请重试");
      onClose();
    }
  };

  // 从相册选择
  const handlePickFromGallery = async () => {
    setShowPicker(false); // 关闭选择器

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要相册权限", "请在设置中允许访问相册");
        onClose();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: maxImages,
      });

      if (result.canceled || !result.assets?.length) {
        onClose();
        return;
      }

      const uris = result.assets.map((asset) => asset.uri);
      setImages(uris);
    } catch (error) {
      console.error("选择图片失败:", error);
      Alert.alert("选择失败", "请重试");
      onClose();
    }
  };

  // 取消选择
  const handlePickerCancel = () => {
    setShowPicker(false);
    setImages([]);
    onClose();
  };

  // 添加更多图片
  const handleAddMore = async () => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      Alert.alert("提示", `最多只能选择${maxImages}张图片`);
      return;
    }

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要相册权限", "请在设置中允许访问相册");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
      });

      if (!result.canceled && result.assets?.length) {
        const newUris = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newUris]);
      }
    } catch (error) {
      console.error("添加图片失败:", error);
      Alert.alert("添加失败", "请重试");
    }
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    if (newImages.length === 0) {
      Alert.alert("提示", "至少需要一张图片", [
        { text: "取消", onPress: onClose, style: "cancel" },
        { text: "重新选择", onPress: () => setShowPicker(true) },
      ]);
    } else {
      setImages(newImages);
    }
  };

  // 保存图片日记（支持图片+文字）
  const handleSave = async () => {
    if (images.length === 0) {
      Alert.alert("提示", "请至少选择一张图片");
      return;
    }

    // ✅ 如果用户已经输入了文字内容，直接提交，不显示确认弹窗
    if (textContent.trim().length > 0) {
      await doSave();
      return;
    }

    // 如果文字输入框为空，显示确认弹窗询问是否添加内容
    setShowConfirmModal(true);
  };

  const doSave = async () => {
    setIsSaving(true);
    try {
      // 如果有文字内容，一起保存；否则只保存图片
      await createImageOnlyDiary(images, textContent.trim() || undefined);
      Alert.alert("成功", "图片日记已保存", [
        {
          text: "好的",
          onPress: () => {
            setImages([]);
            setTextContent("");
            setShowPicker(false);
            setIsSaving(false);
            onSuccess();
          },
        },
      ]);
    } catch (error: any) {
      console.error("保存失败:", error);
      Alert.alert("保存失败", error.message || "请重试");
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setImages([]);
    setTextContent("");
    setShowPicker(false);
    setIsRecordingMode(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    onClose();
  };

  // ========== 录音相关函数 ==========

  /**
   * 配置录音音频模式
   */
  const configureRecordingAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 2,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error("配置录音音频模式失败:", error);
    }
  };

  /**
   * 请求录音权限
   */
  const requestAudioPermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("需要麦克风权限", "请在设置中允许访问麦克风");
        return false;
      }
      return true;
    } catch (error) {
      console.error("请求权限失败:", error);
      return false;
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /**
   * 平滑更新进度条
   */
  const smoothUpdateProgress = useCallback(
    (target: number) => {
      const safeTarget = Math.max(target, currentProgressRef.current);
      const currentValue = currentProgressRef.current;
      const progressDiff = safeTarget - currentValue;

      let calculatedDuration = 600;
      if (progressDiff < 5) {
        calculatedDuration = 300;
      } else if (progressDiff < 20) {
        calculatedDuration = 600;
      } else {
        calculatedDuration = 1000;
      }

      progressAnimValue.stopAnimation();
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }

      setProcessingProgress(safeTarget);
      const startValue = currentProgressRef.current;
      progressAnimValue.setValue(startValue);

      const animation = Animated.timing(progressAnimValue, {
        toValue: safeTarget,
        duration: calculatedDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      });

      const listenerId = progressAnimValue.addListener(({ value }) => {
        const clampedValue = Math.max(
          currentProgressRef.current,
          Math.min(100, value)
        );
        currentProgressRef.current = clampedValue;
        setProcessingProgress(clampedValue);
      });

      animation.start(() => {
        currentProgressRef.current = safeTarget;
        setProcessingProgress(safeTarget);
        progressAnimValue.removeListener(listenerId);
      });
    },
    [progressAnimValue]
  );

  /**
   * 开始录音
   */
  const startRecording = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (_) {}
        recordingRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        setIsRecordingMode(false);
        return;
      }

      await configureRecordingAudioMode();
      await activateKeepAwakeAsync();

      const { recording: newRecording } = await Audio.Recording.createAsync({
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

      recordingRef.current = newRecording;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      setNearLimit(false);
      hasShown9MinWarning.current = false;
      startedAtRef.current = Date.now();

      const interval = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const seconds = Math.floor(status.durationMillis / 1000);
              setRecordingDuration(seconds);

              if (seconds >= 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                setNearLimit(true);
              }

              if (seconds >= 600) {
                setNearLimit(false);
                await finishRecording();
              }
            }
          }
        } catch (error) {
          console.error("获取录音状态失败:", error);
        }
      }, 1000);

      durationIntervalRef.current = interval;
    } catch (error) {
      console.error("❌ 录音失败:", error);
      Alert.alert("错误", "录音失败，请重试");
      setIsRecordingMode(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  /**
   * 暂停录音
   */
  const pauseRecording = async () => {
    if (!recordingRef.current) return;

    try {
      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording) return;

      await recordingRef.current.pauseAsync();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    } catch (error) {
      console.error("暂停失败:", error);
    }
  };

  /**
   * 继续录音
   */
  const resumeRecording = async () => {
    if (!recordingRef.current) return;

    try {
      const status = await recordingRef.current.getStatusAsync();
      if (status.isRecording) return;
      if (status.isDoneRecording) return;

      await configureRecordingAudioMode();
      await recordingRef.current.startAsync();
      setIsPaused(false);

      const interval = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const seconds = Math.floor(status.durationMillis / 1000);
              setRecordingDuration(seconds);

              if (seconds >= 540 && !hasShown9MinWarning.current) {
                hasShown9MinWarning.current = true;
                setNearLimit(true);
              }

              if (seconds >= 600) {
                setNearLimit(false);
                await finishRecording();
              }
            }
          }
        } catch (error) {
          console.error("获取录音状态失败:", error);
        }
      }, 1000);

      durationIntervalRef.current = interval;
    } catch (error) {
      console.error("恢复录音失败:", error);
    }
  };

  /**
   * 完成录音并处理
   */
  const finishRecording = async () => {
    if (!recordingRef.current) return;

    try {
      console.log("✅ 完成录音");

      // 获取URI（在停止之前）
      const uri = recordingRef.current.getURI();
      console.log("录音文件URI:", uri);

      // 清理定时器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // 停止录音
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      try {
        deactivateKeepAwake();
      } catch (_) {}

      // ✅ 使用 state 中的 recordingDuration，而不是从 status 获取（更准确）
      const recordedDuration = Math.floor(recordingDuration);
      console.log("录音时长:", recordedDuration, "秒");

      // ✅ 检查录音时长(最短3秒) - 与 RecordingModal 保持一致
      if (recordedDuration < 3) {
        setIsRecording(false);
        setIsPaused(false);
        setRecordingDuration(0);

        Alert.alert("提示", "录音时间太短，请重新录制", [
          {
            text: "重新录制",
            style: "default",
            onPress: () => startRecording(),
          },
          {
            text: "取消",
            style: "cancel",
            onPress: () => cancelRecording(),
          },
        ]);
        return;
      }

      if (!uri) {
        Alert.alert("错误", "录音文件不存在，请重新录制");
        setIsRecording(false);
        setIsPaused(false);
        setRecordingDuration(0);
        return;
      }

      setIsRecording(false);
      setIsPaused(false);
      setIsProcessing(true);
      setProcessingProgress(0);
      currentProgressRef.current = 0;
      progressAnimValue.setValue(0);

      // ✅ 先上传图片到S3
      let imageUrls: string[] = [];
      if (images.length > 0) {
        try {
          imageUrls = await uploadDiaryImages(images);
          console.log("✅ 图片上传成功，URLs:", imageUrls);
        } catch (error: any) {
          console.error("上传图片失败:", error);
          Alert.alert("错误", "上传图片失败，请重试");
          setIsProcessing(false);
          return;
        }
      }

      // ✅ 进度回调
      const progressCallback: ProgressCallback = (progressData) => {
        const progress = progressData.progress;
        let frontendStep = 0;

        if (progress < 20) {
          frontendStep = 0;
        } else if (progress < 50) {
          frontendStep = 1;
        } else if (progress < 70) {
          frontendStep = 2;
        } else if (progress < 85) {
          frontendStep = 3;
        } else {
          frontendStep = 4;
        }

        frontendStep = Math.max(
          0,
          Math.min(frontendStep, processingSteps.length - 1)
        );

        setProcessingStep(frontendStep);
        smoothUpdateProgress(progress);
      };

      // ✅ 调用后端API（图片+语音）
      const diary = await createVoiceDiaryStream(
        uri,
        recordedDuration,
        progressCallback,
        imageUrls.length > 0 ? imageUrls : undefined
      );

      console.log("✅ 图片+语音日记创建成功:", diary);

      setIsProcessing(false);
      setImages([]);
      setTextContent("");
      setIsRecordingMode(false);
      try {
        deactivateKeepAwake();
      } catch (_) {}

      Alert.alert("成功", "日记已保存", [
        {
          text: "好的",
          onPress: () => {
            onSuccess();
          },
        },
      ]);
    } catch (error: any) {
      console.error("❌ 处理失败:", error);
      Alert.alert("错误", error.message || "处理失败，请重试");
      setIsProcessing(false);
      setIsRecording(false);
      setIsPaused(false);
      deactivateKeepAwake();
    }
  };

  /**
   * 取消录音
   */
  const cancelRecording = () => {
    setIsRecordingMode(false);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(console.log);
      recordingRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    deactivateKeepAwake();
  };

  // ✅ 录音动画效果
  useEffect(() => {
    if (!(isRecording && !isPaused)) {
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
      return;
    }

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    const loopWave = (val: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 3,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );

    pulseAnim.setValue(1);
    waveAnim1.setValue(0);
    waveAnim2.setValue(0);
    waveAnim3.setValue(0);

    breathe.start();

    const w1 = loopWave(waveAnim1);
    w1.start();

    const t2 = setTimeout(() => {
      const w2 = loopWave(waveAnim2);
      w2.start();
    }, 400);
    const t3 = setTimeout(() => {
      const w3 = loopWave(waveAnim3);
      w3.start();
    }, 1000);

    return () => {
      breathe.stop();
      w1.stop();
      clearTimeout(t2);
      clearTimeout(t3);
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
    };
  }, [isRecording, isPaused]);

  // 如果没有图片，不渲染内容
  if (!visible) return null;

  // 显示底部选择器
  if (showPicker) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={handlePickerCancel}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>选择图片</Text>

              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handleTakePhoto}
              >
                <Text style={styles.pickerOptionText}>📷 拍照</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handlePickFromGallery}
              >
                <Text style={styles.pickerOptionText}>🖼️ 从相册选择</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerCancel}
                onPress={handlePickerCancel}
              >
                <Text style={styles.pickerCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // 如果正在加载图片
  if (images.length === 0) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#E56C45" />
        </View>
      </Modal>
    );
  }

  // 显示图片预览界面
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* 顶部栏 - 与 TextInputModal 保持一致 */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancel}
              accessibilityLabel={t("common.close")}
              accessibilityHint={t("accessibility.button.closeHint")}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-outline" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>{t("createImageDiary.title")}</Text>
            <View style={styles.headerRight} />
          </View>

          {/* 图片网格和文字输入 */}
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 图片网格 */}
              <View style={styles.imageGrid}>
                {images.map((uri, index) => (
                  <View
                    key={`${uri}-${index}`}
                    style={[
                      styles.imageWrapper,
                      (index + 1) % 4 === 0 && styles.imageWrapperLastInRow, // 每行最后一个
                    ]}
                  >
                    <Image source={{ uri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveImage(index)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {images.length < maxImages && (
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      (images.length + 1) % 4 === 0 &&
                        styles.imageWrapperLastInRow, // 每行最后一个
                    ]}
                    onPress={handleAddMore}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={28} color="#D96F4C" />
                  </TouchableOpacity>
                )}
              </View>

              {/* 文字输入框 - 默认显示（当有图片且非录音模式时） */}
              {images.length > 0 && !isRecordingMode && (
                <>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder={t("createImageDiary.textPlaceholder")}
                      placeholderTextColor="#999"
                      value={textContent}
                      onChangeText={setTextContent}
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                      accessibilityLabel={t("createImageDiary.textPlaceholder")}
                      accessibilityHint={t("accessibility.input.textHint")}
                      accessibilityRole="text"
                    />
                    <Text
                      style={[
                        styles.charCount,
                        textContent.length > 0 &&
                          textContent.length < 10 &&
                          styles.charCountWarning,
                      ]}
                    >
                      {textContent.length}/500
                    </Text>
                  </View>

                  {/* 完成按钮 - 放在输入框正下面 */}
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.completeButtonText}>
                      {isSaving
                        ? t("common.saving")
                        : t("createImageDiary.submitButton")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ✅ 录音界面（录音模式时显示） */}
              {isRecordingMode && images.length > 0 && (
                <>
                  {/* 录音动画区域 - 完全复用 RecordingModal 的结构 */}
                  <View style={styles.recordingAnimationArea}>
                    {isProcessing ? (
                      <View
                        style={styles.processingCenter}
                        accessibilityLiveRegion="polite"
                        accessibilityLabel={t(
                          "accessibility.status.processing",
                          {
                            step: processingStep + 1,
                          }
                        )}
                      >
                        <View style={styles.processingContent}>
                          {/* Emoji - 单独一行，居中对齐 */}
                          <View style={styles.emojiContainer}>
                            <Text style={styles.stepEmoji}>
                              {processingSteps[processingStep]?.icon}
                            </Text>
                          </View>

                          {/* 步骤文案 - 单独一行，居中对齐 */}
                          <View style={styles.textContainer}>
                            <Text style={styles.currentStepText}>
                              {processingSteps[processingStep]?.text}
                            </Text>
                          </View>

                          {/* 进度条和百分比 */}
                          <View style={styles.progressSection}>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${processingProgress}%` },
                                ]}
                              />
                            </View>
                            <Text
                              style={styles.progressText}
                              accessibilityLabel={`${t(
                                "accessibility.status.processing"
                              )}, ${Math.round(processingProgress)}%`}
                            >
                              {Math.round(processingProgress)}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <>
                        {/* 录音波纹动画 - 完全复用 RecordingModal 的样式 */}
                        {isRecording && !isPaused && (
                          <>
                            <Animated.View
                              style={[
                                styles.wave,
                                {
                                  transform: [{ scale: waveAnim1 }],
                                  opacity: waveAnim1.interpolate({
                                    inputRange: [0, 3],
                                    outputRange: [0.7, 0],
                                  }),
                                },
                              ]}
                            />
                            <Animated.View
                              style={[
                                styles.wave,
                                {
                                  transform: [{ scale: waveAnim2 }],
                                  opacity: waveAnim2.interpolate({
                                    inputRange: [0, 3],
                                    outputRange: [0.7, 0],
                                  }),
                                },
                              ]}
                            />
                            <Animated.View
                              style={[
                                styles.wave,
                                {
                                  transform: [{ scale: waveAnim3 }],
                                  opacity: waveAnim3.interpolate({
                                    inputRange: [0, 3],
                                    outputRange: [0.7, 0],
                                  }),
                                },
                              ]}
                            />
                          </>
                        )}

                        {/* 麦克风图标 - 完全复用 RecordingModal 的样式 */}
                        <Animated.View
                          style={[
                            styles.iconContainer,
                            {
                              transform: [{ scale: pulseAnim }],
                            },
                          ]}
                        >
                          <Ionicons
                            name={isPaused ? "pause" : "mic"}
                            size={44}
                            color="#E56C45"
                          />
                        </Animated.View>

                        {/* 状态文字 - 完全复用 RecordingModal 的样式 */}
                        <Text style={styles.recordingStatusText}>
                          {isPaused
                            ? t("diary.pauseRecording")
                            : nearLimit
                            ? t("recording.nearLimit")
                            : ""}
                        </Text>

                        {/* 时间显示 - 完全复用 RecordingModal 的样式 */}
                        <View style={styles.timeRow}>
                          <Text style={styles.durationText}>
                            {formatTime(recordingDuration)}
                          </Text>
                          <Text style={styles.maxDuration}> / 10:00</Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>

          {/* ✅ 录音控制按钮 - 放在 ScrollView 外面，靠近底部（录音模式时显示） */}
          {isRecordingMode && images.length > 0 && (
            <View style={styles.recordingControls}>
              {isProcessing ? (
                <View style={{ height: 72 }} />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelRecording}
                    accessibilityLabel={t("common.cancel")}
                    accessibilityHint={t("accessibility.button.cancelHint")}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.pauseButton}
                    onPress={isPaused ? resumeRecording : pauseRecording}
                    accessibilityLabel={
                      isPaused
                        ? t("createVoiceDiary.resumeRecording")
                        : t("createVoiceDiary.pauseRecording")
                    }
                    accessibilityHint={
                      isPaused
                        ? t("accessibility.button.recordHint")
                        : t("accessibility.button.stopHint")
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: !isPaused }}
                  >
                    <Ionicons
                      name={isPaused ? "play" : "pause"}
                      size={32}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.finishButton}
                    onPress={finishRecording}
                    accessibilityLabel={t("common.done")}
                    accessibilityHint={t("accessibility.button.continueHint")}
                    accessibilityRole="button"
                  >
                    <Text style={styles.finishText}>{t("common.done")}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* 底部工具栏 - 只保留语音按钮，居中显示（非录音模式时） */}
          {images.length > 0 && !isRecordingMode && (
            <View style={styles.bottomToolbar}>
              <TouchableOpacity
                style={styles.toolbarRecordButton}
                onPress={() => {
                  // ✅ 进入录音模式
                  setIsRecordingMode(true);
                  startRecording();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="mic" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 确认弹窗 */}
        {showConfirmModal && (
          <Modal visible={showConfirmModal} transparent animationType="fade">
            <TouchableOpacity
              style={styles.confirmOverlay}
              activeOpacity={1}
              onPress={() => setShowConfirmModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.confirmContainer}>
                  {/* 右上角关闭按钮 - 使用更细的outline风格 */}
                  <TouchableOpacity
                    style={styles.confirmCloseButton}
                    onPress={() => setShowConfirmModal(false)}
                    accessibilityLabel={t("common.close")}
                    accessibilityHint={t("accessibility.button.closeHint")}
                    accessibilityRole="button"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-outline" size={24} color="#999" />
                  </TouchableOpacity>

                  {/* 去掉标题，直接显示鼓励性文案 */}
                  <Text style={styles.confirmMessage}>
                    {t("createImageDiary.confirmMessage")}
                  </Text>

                  <View style={styles.confirmButtons}>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        styles.confirmButtonSecondary,
                      ]}
                      onPress={() => {
                        setShowConfirmModal(false);
                        doSave();
                      }}
                      accessibilityLabel={t("createImageDiary.saveAsIs")}
                      accessibilityRole="button"
                    >
                      <Text style={styles.confirmButtonTextSecondary}>
                        {t("createImageDiary.saveAsIs")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        styles.confirmButtonPrimary,
                      ]}
                      onPress={() => {
                        // 关闭弹窗，回到原页面（原页面已有文字输入框和语音按钮）
                        setShowConfirmModal(false);
                      }}
                      accessibilityLabel={t("createImageDiary.addContent")}
                      accessibilityRole="button"
                    >
                      <Text style={styles.confirmButtonTextPrimary}>
                        {t("createImageDiary.addContent")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 底部选择器样式
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  pickerOption: {
    backgroundColor: "#F5F5F5",
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    color: "#333",
  },
  pickerCancel: {
    marginTop: 8,
    padding: 18,
  },
  pickerCancelText: {
    fontSize: 16,
    textAlign: "center",
    color: "#999",
  },

  // 图片预览界面样式
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT - 80,
    //paddingTop: 20,
  },
  // Header 样式 - 与 TextInputModal 保持一致
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    ...Typography.sectionTitle,
    color: "#1A1A1A",
  },
  headerRight: {
    width: 36, // 与 TextInputModal 保持一致
  },
  saveText: {
    fontSize: 16,
    color: "#E56C45",
    fontWeight: "600",
  },
  saveTextDisabled: {
    color: "#ccc",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20, // 减少左右 padding，让图片更紧凑
    paddingBottom: 120, // 增加底部 padding，为工具栏留出空间
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingTop: 24,
    marginBottom: 16,
  },
  // 文字输入框样式 - 与 TextInputModal 保持一致
  inputContainer: {
    position: "relative",
    marginTop: 4, // 进一步缩小与顶部图片的间距
    marginBottom: 12,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    paddingBottom: 40, // 为字符计数留出空间
    color: "#1A1A1A",
    textAlignVertical: "top",
    minHeight: 200,
  },
  charCount: {
    position: "absolute",
    right: 16,
    bottom: 12,
    ...Typography.caption,
    fontSize: 12,
    color: "#999",
  },
  charCountWarning: {
    color: "#E56C45",
  },
  // 完成按钮样式 - 放在输入框正下面，与 TextInputModal 保持一致
  completeButton: {
    backgroundColor: "#E56C45",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  completeButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  imageWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginRight: 8, // 最小间距，更紧凑
    marginBottom: 10,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  imageWrapperLastInRow: {
    marginRight: 0, // 每行最后一个没有右边距
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)", // 黑色带透明度
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    backgroundColor: "transparent", // 去掉背景色
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 184, 160, 0.6)", // 虚线描边颜色，60%透明度
    borderStyle: "dashed", // 虚线样式
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // 确认弹窗样式
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  confirmContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    position: "relative",
  },
  confirmCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  confirmMessage: {
    ...Typography.body,
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 32, // 增加与关闭按钮的间距
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonSecondary: {
    backgroundColor: "#F5F5F5",
  },
  confirmButtonPrimary: {
    backgroundColor: "#E56C45",
  },
  confirmButtonTextSecondary: {
    ...Typography.body,
    fontWeight: "500",
    color: "#666",
  },
  confirmButtonTextPrimary: {
    ...Typography.body,
    fontWeight: "600",
    color: "#fff",
  },

  // 底部工具栏样式 - 只保留语音按钮，居中显示
  bottomToolbar: {
    position: "absolute",
    bottom: 32,
    left: "50%",
    marginLeft: -28, // 按钮宽度56的一半，居中
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarRecordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // ✅ 录音界面样式 - 完全复用 RecordingModal 的样式
  recordingAnimationArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  processingCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  processingContent: {
    width: "100%",
    maxWidth: 260,
    alignItems: "center",
  },
  emojiContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    height: 40, // 固定高度，确保布局稳定
  },
  stepEmoji: {
    fontSize: 32, // 稍微大一点，更醒目
    textAlign: "center",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    minHeight: 24, // 最小高度，防止布局跳动
  },
  currentStepText: {
    ...Typography.body,
    color: "#1A1A1A",
    textAlign: "center",
  },
  progressSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // ✅ 减小间距
  },
  progressBarBg: {
    flex: 1,
    height: 6, // ✅ 增加粗细
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#E56C45",
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: "#666",
    width: 45, // ✅ 固定宽度,防止换行
    textAlign: "right",
  },
  wave: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFE8E0",
  },
  iconContainer: {
    position: "absolute", // ✅ 添加:绝对定位
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingStatusText: {
    ...Typography.body,
    color: "#666",
    marginBottom: 8,
    marginTop: 140, // ✅ 添加上边距,避开波纹区域
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline", // 对齐基线
  },
  durationText: {
    ...Typography.sectionTitle,
    color: "#E56C45", // ✅ 高亮红色
    fontVariant: ["tabular-nums"],
  },
  maxDuration: {
    ...Typography.sectionTitle,
    color: "#999",
    marginTop: 4,
  },
  recordingControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 48,
  },
  cancelButton: {
    padding: 20,
  },
  cancelText: {
    ...Typography.body,
    color: "#E56C45", // 主题色
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButton: {
    padding: 20,
  },
  finishText: {
    ...Typography.body,
    color: "#E56C45",
  },
});
