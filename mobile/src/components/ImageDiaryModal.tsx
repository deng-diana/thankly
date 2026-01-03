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
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import {
  createImageOnlyDiary,
  createVoiceDiaryStream,
  createVoiceDiaryTask,
  addImagesToTask,
  pollTaskProgress,
  deleteDiary,
  updateDiary,
  ProgressCallback,
  Diary,
} from "../services/diaryService";
import { uploadDiaryImages } from "../services/diaryService";
import ImageInputIcon from "../assets/icons/addImageIcon.svg";
import TextInputIcon from "../assets/icons/textInputIcon.svg";
import CameraIcon from "../assets/icons/cameraIcon.svg";
import AlbumIcon from "../assets/icons/albumIcon.svg";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import MicIcon from "../assets/icons/micIcon.svg";
import { t } from "../i18n";
import ProcessingModal from "./ProcessingModal";
import VoiceRecordingPanel from "./VoiceRecordingPanel";
import AudioPlayer from "./AudioPlayer";
import { Typography, getFontFamilyForText } from "../styles/typography";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// 4列布局：左右padding 20*2=40，3个间距 8*3=6，尽可能填满宽度，不留多余空白
const THUMBNAIL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 24) / 4); // 4列，紧凑布局，向下取整

interface ImageDiaryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  maxImages?: number;
  onAddImage?: () => void; // 添加图片回调
  onAddText?: () => void; // 添加文字回调
}

export default function ImageDiaryModal({
  visible,
  onClose,
  onSuccess,
  maxImages = 9,
  onAddImage,
  onAddText,
}: ImageDiaryModalProps) {
  const [images, setImages] = useState<string[]>([]);

  const [showPicker, setShowPicker] = useState(false); // 显示底部选择器
  const [showConfirmModal, setShowConfirmModal] = useState(false); // 显示确认弹窗
  const [textContent, setTextContent] = useState(""); // 文字内容
  // ✅ 文字输入框默认显示（用户选择图片后自动显示）

  const [isSaving, setIsSaving] = useState(false); // ✅ 普通保存状态（无AI）
  // ✅ Toast 状态
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  };

  // ✅ 使用自定义 Hook 管理录音逻辑
  const {
    isRecording,
    isPaused,
    duration: recordingDuration,
    isStarting,
    nearLimit,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording();

  const [isRecordingMode, setIsRecordingMode] = useState(false); // 是否进入录音模式
  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ 新增：处理进度状态
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const progressAnimValue = useRef(new Animated.Value(0)).current;
  const currentProgressRef = useRef(0);
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ 新增：结果预览页面状态
  const [showResult, setShowResult] = useState(false);
  const [resultDiary, setResultDiary] = useState<Diary | null>(null);
  const [pendingDiaryId, setPendingDiaryId] = useState<string | null>(null);
  const [hasSavedPendingDiary, setHasSavedPendingDiary] = useState(false);

  // ✅ 新增：编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // ✅ 新增：音频播放状态（用于结果页面）
  const [isPlayingResult, setIsPlayingResult] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultDuration, setResultDuration] = useState(0);
  const resultSoundRef = useRef<Audio.Sound | null>(null);

  // ✅ 新增：录音动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // ✅ 处理步骤配置
  // 语音相关场景使用完整步骤（包含上传声音、倾听等）
  const voiceProcessingSteps = [
    { icon: "📤", text: t("diary.processingSteps.upload"), progress: 20 },
    { icon: "👂", text: t("diary.processingSteps.listen"), progress: 50 },
    { icon: "✨", text: t("diary.processingSteps.polish"), progress: 70 },
    { icon: "💭", text: t("diary.processingSteps.title"), progress: 85 },
    { icon: "💬", text: t("diary.processingSteps.feedback"), progress: 100 },
  ];

  // ✅ 图片+文字场景专用步骤（不包含语音相关步骤）
  const imageTextProcessingSteps = [
    { icon: "📤", text: t("diary.processingSteps.uploadImages"), progress: 25 },
    { icon: "✨", text: t("diary.processingSteps.polishText"), progress: 50 },
    {
      icon: "💭",
      text: t("diary.processingSteps.generateTitle"),
      progress: 75,
    },
    {
      icon: "💬",
      text: t("diary.processingSteps.generateFeedback"),
      progress: 100,
    },
  ];

  // ✅ 根据场景选择对应的处理步骤
  // 如果正在录音模式，使用语音步骤；否则使用图片+文字步骤
  const processingSteps = isRecordingMode
    ? voiceProcessingSteps
    : imageTextProcessingSteps;

  // ✅ 使用 useRef 存储 cancelRecording，避免依赖项变化导致无限循环
  const cancelRecordingRef = useRef(cancelRecording);
  useEffect(() => {
    cancelRecordingRef.current = cancelRecording;
  }, [cancelRecording]);

  // Modal 打开时，显示底部选择器
  useEffect(() => {
    // ✅ 关键修复：当 Modal 打开且没有图片时，显示选择器
    // 当有图片时，确保选择器关闭
    // ✅ 如果正在处理或显示结果页面，不显示选择器
    if (visible && !isProcessing && !showResult) {
      const shouldShowPicker = images.length === 0;
      // ✅ 使用函数式更新，只在状态真正需要改变时才更新
      setShowPicker((prev) => {
        if (shouldShowPicker && !prev) return true;
        if (!shouldShowPicker && prev) return false;
        return prev; // 状态不需要改变，返回原值
      });
    } else if (visible && (isProcessing || showResult)) {
      // ✅ 如果正在处理或显示结果，确保选择器关闭
      setShowPicker(false);
    }
    // ✅ 重置录音模式状态并清理录音资源
    if (!visible) {
      // ✅ Modal 关闭时，重置所有状态，防止下次打开时出现残留状态
      setIsRecordingMode(false);
      setIsProcessing(false);
      setShowResult(false);
      setShowPicker(false);
      setImages([]);
      setTextContent("");
      setResultDiary(null);
      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle("");
      setEditedContent("");
      setHasChanges(false);
      setProcessingStep(0);
      setProcessingProgress(0);
      setShowConfirmModal(false);
      // ✅ 关键修复：Modal 关闭时清理所有音频资源，防止下次打开时冲突
      // 1. 清理录音资源（使用 ref 避免依赖项变化）
      if (isRecording || recordingDuration > 0) {
        cancelRecordingRef.current().catch(console.error);
      }
      // 2. 清理音频播放器
      if (resultSoundRef.current) {
        resultSoundRef.current.unloadAsync().catch(console.error);
        resultSoundRef.current = null;
        setIsPlayingResult(false);
      }
    }
    // ✅ 移除 cancelRecording 从依赖项数组，使用 ref 代替
    // ✅ 添加 isProcessing 到依赖项，确保处理状态变化时也能正确控制选择器
  }, [
    visible,
    images.length,
    showResult,
    isProcessing,
    isRecording,
    recordingDuration,
  ]);

  // ✅ 清理录音资源
  useEffect(() => {
    return () => {
      if (progressAnimationRef.current) {
        clearInterval(progressAnimationRef.current);
      }
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

    // ✅ 如果没有文字内容，走纯图片快速保存通道
    if (textContent.trim().length === 0) {
      // 如果文字输入框为空，显示确认弹窗询问是否添加内容
      setShowConfirmModal(true);
      return;
    }

    // 如果有文字内容，走 AI 处理流程
    await doSaveWithAI();
  };

  // ✅ 纯图片保存（无AI，直接保存）
  const doSaveImageOnly = async () => {
    setIsSaving(true);
    try {
      // 直接调用创建图片日记接口
      await createImageOnlyDiary(images);

      // ✅ 统一使用toast反馈
      showToast(t("success.diaryCreated"));

      // ✅ 短暂延迟让用户看到toast，然后统一跳转
      await new Promise((resolve) => setTimeout(resolve, 500));

      setIsSaving(false);
      setImages([]);
      setTextContent("");
      setShowPicker(false);
      // ✅ 统一通过onSuccess回调跳转
      onSuccess();
    } catch (error: any) {
      console.error("保存失败:", error);
      Alert.alert("保存失败", error.message || "请重试");
      setIsSaving(false);
    }
  };

  const doSaveWithAI = async () => {
    setIsProcessing(true);
    setProcessingStep(0); // ✅ 重置步骤为0（上传图片步骤）
    setProcessingProgress(0);
    currentProgressRef.current = 0;
    progressAnimValue.setValue(0);

    try {
      // ✅ 优化：图片上传和AI处理并行执行
      // 图片不参与AI处理（已去掉Vision模型），所以可以并行，缩短总时间
      console.log("📤 启动图片上传（与AI处理并行）...");
      const imageUploadPromise = uploadDiaryImages(images).catch(
        (error: any) => {
          console.error("❌ 图片上传失败:", error);
          throw error;
        }
      );

      // ✅ 模拟AI处理进度（图片+文字场景专用）
      // 步骤：上传图片(0-25%) -> 润色文字(25-50%) -> 生成标题(50-75%) -> 生成反馈(75-100%)
      // 注意：此函数专门用于图片+文字场景，不包含语音相关步骤
      const simulateProgress = () => {
        let currentStep = 0;
        // ✅ 使用图片+文字专用步骤配置（不包含语音相关步骤）
        const steps = imageTextProcessingSteps.map((step, index) => ({
          step: index,
          progress: step.progress,
          text: step.text,
        }));

        const updateProgress = () => {
          if (currentStep < steps.length) {
            const stepInfo = steps[currentStep];
            // ✅ 确保步骤索引在 imageTextProcessingSteps 范围内（0-3）
            setProcessingStep(stepInfo.step);
            smoothUpdateProgress(stepInfo.progress);

            if (currentStep < steps.length - 1) {
              currentStep++;
              // ✅ 优化延迟时间，让进度更自然
              // 上传图片(300ms) -> 润色文字(800ms) -> 生成标题(1000ms) -> 生成反馈(800ms)
              const delay =
                currentStep === 1 ? 800 : currentStep === 2 ? 1000 : 800;
              setTimeout(updateProgress, delay);
            }
          }
        };

        // 先更新到上传步骤
        setTimeout(updateProgress, 300);
      };

      // ✅ 启动进度模拟
      simulateProgress();

      // ✅ 等待图片上传完成
      const imageUrls = await imageUploadPromise;
      console.log("✅ 图片上传完成，URLs:", imageUrls);

      // ✅ 调用后端API创建日记（AI处理在后端同步进行）
      // 注意：后端已经去掉了Vision模型，只处理文字内容
      const diary = await createImageOnlyDiary(
        imageUrls,
        textContent.trim() || undefined
      );

      console.log("✅ 图片+文字日记创建成功:", diary);

      // ✅ 确保进度到100%（使用图片+文字步骤的最后一个索引）
      setProcessingStep(imageTextProcessingSteps.length - 1);
      smoothUpdateProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setIsProcessing(false);
      setResultDiary(diary);
      setShowResult(true);
      setPendingDiaryId(diary.diary_id);
      setHasSavedPendingDiary(false);
      setEditedTitle(diary.title);
      setEditedContent(diary.polished_content);

      // ✅ 统一使用toast反馈
      showToast(t("success.diaryCreated"));

      // ✅ 短暂延迟让用户看到toast
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert("保存失败", error.message || "请重试");
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    // ✅ 如果显示结果页面且有未保存的日记，显示确认对话框
    if (showResult && pendingDiaryId && !hasSavedPendingDiary) {
      Alert.alert(
        t("confirm.discardUnsavedTitle"),
        t("confirm.discardUnsavedMessage"),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("common.confirm"),
            style: "destructive",
            onPress: async () => {
              // 删除未保存的日记
              try {
                await deleteDiary(pendingDiaryId);
                console.log("✅ 已删除未保存的日记:", pendingDiaryId);
              } catch (error) {
                console.error("❌ 删除日记失败:", error);
              }
              // 清理状态并关闭
              await cleanupAndClose();
            },
          },
        ]
      );
      return;
    }

    // ✅ 清理录音资源
    if (isRecording || recordingDuration > 0) {
      await cancelRecording();
    }

    await cleanupAndClose();
  };

  // ✅ 清理状态并关闭
  const cleanupAndClose = async () => {
    // 清理音频播放资源
    if (resultSoundRef.current) {
      try {
        await resultSoundRef.current.unloadAsync();
      } catch (_) {}
      resultSoundRef.current = null;
    }

    setImages([]);
    setTextContent("");
    setShowPicker(false);
    setIsRecordingMode(false);
    setShowResult(false);
    setResultDiary(null);
    setPendingDiaryId(null);
    setHasSavedPendingDiary(false);
    setIsEditingTitle(false);
    setIsEditingContent(false);
    setEditedTitle("");
    setEditedContent("");
    setHasChanges(false);
    setIsPlayingResult(false);
    setResultCurrentTime(0);
    setResultDuration(0);
    onClose();
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
   * 取消录音并退出录音模式
   */
  const handleCancelRecording = async () => {
    await cancelRecording();
    setIsRecordingMode(false);
  };

  /**
   * 完成录音并处理
   */
  const finishRecording = async () => {
    try {
      console.log("✅ 完成录音");

      const recordedDuration = recordingDuration;
      const uri = await stopRecording();

      console.log("录音时长:", recordedDuration, "秒");

      // ✅ 检查录音时长(最短3秒) - 与 RecordingModal 保持一致
      if (recordedDuration < 3) {
        Alert.alert("提示", "录音时间太短，请重新录制", [
          {
            text: "重新录制",
            style: "default",
            onPress: () => startRecording(),
          },
          {
            text: "取消",
            style: "cancel",
            onPress: () => handleCancelRecording(),
          },
        ]);
        return;
      }

      if (!uri) {
        Alert.alert("错误", "录音文件不存在，请重新录制");
        return;
      }

      setIsProcessing(true);
      setProcessingStep(0); // ✅ 关键修复：重置步骤为0（上传步骤）
      setProcessingProgress(0);
      currentProgressRef.current = 0;
      progressAnimValue.setValue(0);

      // ✅ 优化：图片上传和AI处理真正并行执行
      // 图片不参与AI处理，所以可以并行，缩短总时间
      let imageUploadPromise: Promise<string[]> | null = null;
      if (images.length > 0) {
        console.log("📤 启动图片上传（与AI处理并行）...");
        imageUploadPromise = uploadDiaryImages(images).catch((error: any) => {
          console.error("❌ 图片上传失败:", error);
          throw error;
        });
      }

      // ✅ 进度回调
      const progressCallback: ProgressCallback = (progressData) => {
        const progress = progressData.progress;
        // ✅ 直接使用 pollTaskProgress 中已经映射好的 step（无需再次映射）
        // pollTaskProgress 已经将后端 step 0-5 正确映射到前端 step 0-4
        let frontendStep = progressData.step ?? 0;

        // ✅ 确保步骤在有效范围内（根据场景：语音模式5个步骤0-4，图片+文字模式4个步骤0-3）
        frontendStep = Math.max(
          0,
          Math.min(frontendStep, processingSteps.length - 1)
        );

        console.log(
          `📊 进度更新: step=${frontendStep}, progress=${progress}%, message=${progressData.message}`
        );

        setProcessingStep(frontendStep);
        smoothUpdateProgress(progress);
      };

      // ✅ 立即启动AI处理（不等待图片上传）
      // 使用新的 createVoiceDiaryTask 函数，只创建任务并返回 task_id
      console.log("🎤 启动AI处理（与图片上传并行）...");

      // 创建任务（不传图片URL）
      const { taskId, headers } = await createVoiceDiaryTask(
        uri,
        recordedDuration,
        textContent.trim() || undefined
      );

      // ✅ 启动轮询（后台执行）
      const aiProcessPromise = pollTaskProgress(
        taskId,
        headers,
        progressCallback
      );

      // ✅ 等待图片上传完成，然后补充到任务中
      let imageUrls: string[] = [];
      if (imageUploadPromise) {
        try {
          imageUrls = await imageUploadPromise;
          console.log("✅ 图片上传完成，补充图片URL到任务...");

          // ✅ 补充图片URL到任务（AI处理还在进行中）
          await addImagesToTask(taskId, imageUrls);
          console.log("✅ 图片URL已补充到任务");
        } catch (error: any) {
          console.error("❌ 图片上传失败:", error);
          const errorMessage = error.message || "上传图片失败，请重试";
          Alert.alert("错误", errorMessage);
          setIsProcessing(false);
          return;
        }
      }

      // ✅ 等待AI处理完成（后端会在保存时等待图片URL）
      const diary = await aiProcessPromise;

      console.log("✅ 图片+语音日记创建成功:", diary);
      console.log("📸 日记中的图片URLs:", diary.image_urls);

      setIsProcessing(false);
      setResultDiary(diary);
      setShowResult(true);
      setPendingDiaryId(diary.diary_id);
      setHasSavedPendingDiary(false);
      setEditedTitle(diary.title);
      setEditedContent(diary.polished_content);
      setIsRecordingMode(false);
      try {
        deactivateKeepAwake();
      } catch (_) {}
    } catch (error: any) {
      console.error("❌ 处理失败:", error);
      Alert.alert("错误", error.message || "处理失败，请重试");
      setIsProcessing(false);
      deactivateKeepAwake();
    }
  };

  // ✅ 保存并关闭（结果页面）
  const handleSaveAndClose = async () => {
    if (!resultDiary) return;

    try {
      console.log("💾 保存日记...");

      // ✅ 检查是否有修改
      const hasTitleChange =
        isEditingTitle && editedTitle.trim() !== resultDiary.title;
      const hasContentChange =
        isEditingContent &&
        editedContent.trim() !== resultDiary.polished_content;

      if (hasTitleChange || hasContentChange) {
        console.log("📝 更新日记到后端:", resultDiary.diary_id);
        await updateDiary(
          resultDiary.diary_id,
          hasContentChange ? editedContent.trim() : undefined,
          hasTitleChange ? editedTitle.trim() : undefined
        );
        console.log("✅ 后端更新成功");
      }

      setHasSavedPendingDiary(true);
      setPendingDiaryId(null);

      // ✅ 清理音频播放资源
      if (resultSoundRef.current) {
        try {
          await resultSoundRef.current.unloadAsync();
        } catch (_) {}
        resultSoundRef.current = null;
      }

      // ✅ 先重置所有状态（必须在 onClose 之前重置，避免 useEffect 触发 showPicker）
      // 关键：先重置 images 和 showPicker，防止 useEffect 重新打开选择器
      setImages([]); // ✅ 先重置 images，这样 useEffect 不会触发 showPicker
      setShowPicker(false); // ✅ 确保选择器关闭
      setShowResult(false);
      setResultDiary(null);
      setIsPlayingResult(false);
      setResultCurrentTime(0);
      setResultDuration(0);
      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle("");
      setEditedContent("");
      setHasChanges(false);
      setTextContent("");
      setIsRecordingMode(false);
      setIsProcessing(false); // ✅ 确保处理状态已关闭
      setProcessingStep(0); // ✅ 重置处理步骤
      setProcessingProgress(0); // ✅ 重置处理进度
      setShowConfirmModal(false); // ✅ 确保确认弹窗关闭

      // ✅ 显示成功 Toast
      showToast(t("success.diaryCreated"));

      // ✅ 先关闭 Modal，确保所有 UI 状态都已清理
      // 在关闭前，确保 showResult 和 showPicker 都已重置，防止 useEffect 再次触发
      onClose();

      // ✅ 短暂延迟让用户看到 Toast，然后通知父组件刷新列表
      await new Promise((resolve) => setTimeout(resolve, 300));
      onSuccess();
    } catch (error: any) {
      console.error("❌ 保存失败:", error);
      Alert.alert(
        t("error.saveFailed"),
        error.message || t("error.retryMessage")
      );
    }
  };

  // ✅ 开始编辑标题
  const startEditingTitle = () => {
    if (!resultDiary) return;
    setEditedTitle(resultDiary.title);
    setIsEditingTitle(true);
  };

  // ✅ 开始编辑内容
  const startEditingContent = () => {
    if (!resultDiary) return;
    setEditedContent(resultDiary.polished_content);
    setIsEditingContent(true);
  };

  // ✅ 播放结果页面的音频
  const handlePlayResultAudio = async () => {
    if (!resultDiary?.audio_url) return;

    try {
      // 如果正在播放,则暂停
      if (isPlayingResult) {
        if (resultSoundRef.current) {
          await resultSoundRef.current.pauseAsync();
          setIsPlayingResult(false);
        }
        return;
      }

      // ✅ 恢复播放
      if (resultSoundRef.current) {
        await resultSoundRef.current.playAsync();
        setIsPlayingResult(true);
        return;
      }

      // 停止之前的音频
      const soundToUnload = resultSoundRef.current;
      if (soundToUnload) {
        try {
          await (soundToUnload as Audio.Sound).unloadAsync();
        } catch (_) {}
        resultSoundRef.current = null;
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 创建音频播放器
      const { sound } = await Audio.Sound.createAsync(
        { uri: resultDiary.audio_url },
        { shouldPlay: true }
      );

      resultSoundRef.current = sound;
      setIsPlayingResult(true);

      // ✅ 初始化 duration
      const initialDuration = resultDiary.audio_duration || 0;
      if (initialDuration > 0) {
        setResultDuration(initialDuration);
      } else {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setResultDuration(status.durationMillis / 1000);
        }
      }

      // ✅ 监听播放状态
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.positionMillis !== null) {
            setResultCurrentTime(status.positionMillis / 1000);
          }
          if (status.didJustFinish) {
            setIsPlayingResult(false);
            setResultCurrentTime(0);
          }
        }
      });
    } catch (error) {
      console.error("❌ 播放音频失败:", error);
      Alert.alert("错误", "播放音频失败，请重试");
    }
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

  // ✅ 渲染结果页面Header
  const renderResultHeader = () => {
    return (
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
    );
  };

  // ✅ 渲染结果预览页面
  const renderResultView = () => {
    if (!resultDiary) return null;

    return (
      <>
        {/* 顶部Header */}
        {renderResultHeader()}

        {/* 可滚动内容 */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <ScrollView
            style={styles.resultScrollView}
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* 图片网格 */}
            {resultDiary.image_urls && resultDiary.image_urls.length > 0 && (
              <View style={styles.resultImageGrid}>
                {resultDiary.image_urls.map((url, index) => (
                  <View
                    key={`${url}-${index}`}
                    style={[
                      styles.resultImageWrapper,
                      (index + 1) % 4 === 0 &&
                        styles.resultImageWrapperLastInRow,
                    ]}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.resultThumbnail}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* 音频播放器 */}
            {resultDiary.audio_url && (
              <AudioPlayer
                audioUrl={resultDiary.audio_url}
                audioDuration={resultDiary.audio_duration}
                isPlaying={isPlayingResult}
                currentTime={resultCurrentTime}
                totalDuration={resultDuration}
                hasPlayedOnce={false}
                onPlayPress={handlePlayResultAudio}
                style={styles.resultAudioPlayer}
              />
            )}

            {/* 标题和内容卡片 */}
            <View style={styles.resultDiaryCard}>
              {/* 标题 */}
              {isEditingTitle ? (
                <TextInput
                  style={[
                    styles.editTitleInput,
                    {
                      fontFamily: getFontFamilyForText(
                        editedTitle || resultDiary.title,
                        "bold"
                      ),
                    },
                  ]}
                  value={editedTitle}
                  onChangeText={(text) => {
                    setEditedTitle(text);
                    setHasChanges(text.trim() !== resultDiary.title);
                  }}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderTitle")}
                  scrollEnabled={false}
                  accessibilityLabel={t("diary.placeholderTitle")}
                  accessibilityHint={t("accessibility.input.textHint")}
                  accessibilityRole="text"
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingTitle}
                  activeOpacity={0.7}
                  accessibilityLabel={resultDiary.title}
                  accessibilityHint={t("accessibility.button.editHint")}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.resultTitleText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.title,
                          "bold"
                        ),
                      },
                    ]}
                  >
                    {resultDiary.title}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 内容 */}
              {isEditingContent ? (
                <TextInput
                  style={[
                    styles.editContentInput,
                    {
                      fontFamily: getFontFamilyForText(
                        editedContent || resultDiary.polished_content,
                        "regular"
                      ),
                    },
                  ]}
                  value={editedContent}
                  onChangeText={(text) => {
                    setEditedContent(text);
                    setHasChanges(text.trim() !== resultDiary.polished_content);
                  }}
                  autoFocus
                  multiline
                  placeholder={t("diary.placeholderContent")}
                  scrollEnabled={true}
                  accessibilityLabel={t("diary.placeholderContent")}
                  accessibilityHint={t("accessibility.input.textHint")}
                  accessibilityRole="text"
                />
              ) : (
                <TouchableOpacity
                  onPress={startEditingContent}
                  activeOpacity={0.7}
                  accessibilityLabel={
                    resultDiary.polished_content.substring(0, 100) +
                    (resultDiary.polished_content.length > 100 ? "..." : "")
                  }
                  accessibilityHint={t("accessibility.button.editHint")}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.resultContentText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.polished_content,
                          "regular"
                        ),
                      },
                    ]}
                  >
                    {resultDiary.polished_content}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AI反馈 - 编辑时隐藏 */}
            {!isEditingTitle &&
              !isEditingContent &&
              !!resultDiary?.ai_feedback && (
                <View style={styles.resultFeedbackCard}>
                  <View style={styles.resultFeedbackHeader}>
                    <PreciousMomentsIcon width={20} height={20} />
                    <Text
                      style={[
                        styles.resultFeedbackTitle,
                        {
                          fontFamily: getFontFamilyForText(
                            t("diary.aiFeedbackTitle"),
                            "medium"
                          ),
                        },
                      ]}
                    >
                      {t("diary.aiFeedbackTitle")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.resultFeedbackText,
                      {
                        fontFamily: getFontFamilyForText(
                          resultDiary.ai_feedback,
                          "regular"
                        ),
                      },
                    ]}
                    numberOfLines={0}
                    ellipsizeMode="clip"
                  >
                    {resultDiary.ai_feedback}
                  </Text>
                </View>
              )}

            {/* 底部间距 */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 底部保存按钮 */}
        <View style={styles.resultBottomBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAndClose}
            accessibilityLabel={t("diary.saveToJournal")}
            accessibilityHint={t("accessibility.button.saveHint")}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.saveButtonText,
                {
                  fontFamily: getFontFamilyForText(
                    t("diary.saveToJournal"),
                    "semibold"
                  ),
                },
              ]}
            >
              {t("diary.saveToJournal")}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // 如果没有图片，不渲染内容
  if (!visible) return null;

  // ✅ 如果显示结果页面，渲染结果视图
  if (showResult) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View
            style={[
              styles.modal,
              // ✅ 根据状态动态调整高度（与 TextInputModal 和 RecordingModal 保持一致）
              isProcessing
                ? styles.modalProcessing // 加载状态：固定高度
                : styles.modalResult, // 结果状态：根据内容动态调整
            ]}
          >
            {renderResultView()}

            {/* Toast 提示 */}
            {toastVisible && (
              <View style={styles.toastOverlay} pointerEvents="none">
                <View style={styles.toastContainer}>
                  <Text
                    style={[
                      styles.toastText,
                      {
                        fontFamily: getFontFamilyForText(
                          toastMessage,
                          "regular"
                        ),
                      },
                    ]}
                  >
                    {toastMessage}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ✅ 统一的处理加载Modal（覆盖整个屏幕） */}
        {isProcessing && (
          <ProcessingModal
            visible={isProcessing}
            processingStep={processingStep}
            processingProgress={processingProgress}
            steps={processingSteps.map((step) => ({
              icon: step.icon,
              text: step.text,
            }))}
          />
        )}
      </Modal>
    );
  }

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
              {/* 顶部Header: 标题 + 关闭按钮 */}
              <View style={styles.pickerHeader}>
                <Text
                  style={[
                    styles.pickerTitle,
                    {
                      fontFamily: getFontFamilyForText(
                        t("createImageDiary.selectImage"),
                        "medium"
                      ),
                    },
                  ]}
                >
                  {t("createImageDiary.selectImage")}
                </Text>
                <TouchableOpacity
                  style={styles.pickerCloseButton}
                  onPress={handlePickerCancel}
                  accessibilityLabel={t("common.close")}
                  accessibilityHint={t("accessibility.button.closeHint")}
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-outline" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 标题下方的分割线 */}
              <View style={styles.pickerHeaderDivider} />

              {/* 拍照选项 */}
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handleTakePhoto}
              >
                <View style={styles.pickerOptionIcon}>
                  <CameraIcon width={32} height={32} />
                </View>
                <Text
                  style={[
                    styles.pickerOptionText,
                    {
                      fontFamily: getFontFamilyForText(
                        t("createImageDiary.takePhoto"),
                        "regular"
                      ),
                    },
                  ]}
                >
                  {t("createImageDiary.takePhoto")}
                </Text>
              </TouchableOpacity>

              {/* 分隔线 */}
              <View style={styles.pickerDivider} />

              {/* 从相册选择选项 */}
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handlePickFromGallery}
              >
                <View style={styles.pickerOptionIcon}>
                  <AlbumIcon width={32} height={32} />
                </View>
                <Text
                  style={[
                    styles.pickerOptionText,
                    {
                      fontFamily: getFontFamilyForText(
                        t("createImageDiary.selectFromAlbum"),
                        "regular"
                      ),
                    },
                  ]}
                >
                  {t("createImageDiary.selectFromAlbum")}
                </Text>
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
        <View style={[styles.modal, styles.modalInput]}>
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
            <Text
              style={[
                styles.title,
                {
                  fontFamily: getFontFamilyForText(
                    t("createImageDiary.title"),
                    "medium"
                  ),
                },
              ]}
            >
              {t("createImageDiary.title")}
            </Text>
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
              contentContainerStyle={[
                styles.scrollContent,
                isProcessing && { flexGrow: 1, justifyContent: "center" },
                (isRecordingMode || isProcessing) && { paddingBottom: 320 }, // ✅ 增加底部留白，防止被录音面板遮挡
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ✅ 处理中时隐藏图片和输入框 */}
              {!isProcessing && (
                <>
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

                  {/* ✅ 显示之前输入的文字内容 - 紧接着图片预览，设置 paddingTop: 20 */}
                  {isRecordingMode && textContent.trim() && !isProcessing && (
                    <View style={styles.textPreviewContainer}>
                      <Text
                        style={[
                          styles.textPreviewTitle,
                          {
                            fontFamily: getFontFamilyForText(
                              t("createImageDiary.textPreview"),
                              "semibold"
                            ),
                          },
                        ]}
                      >
                        {t("createImageDiary.textPreview")}
                      </Text>
                      <Text
                        style={[
                          styles.textPreviewText,
                          {
                            fontFamily: getFontFamilyForText(
                              textContent,
                              "regular"
                            ),
                          },
                        ]}
                        numberOfLines={3}
                        ellipsizeMode="tail"
                      >
                        {textContent}
                      </Text>
                    </View>
                  )}

                  {/* 文字输入框 - 默认显示（当有图片且非录音模式时） */}
                  {images.length > 0 && !isRecordingMode && (
                    <>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              fontFamily: getFontFamilyForText(
                                textContent,
                                "regular"
                              ),
                            },
                          ]}
                          placeholder={t("createImageDiary.textPlaceholder")}
                          placeholderTextColor="#999"
                          value={textContent}
                          onChangeText={setTextContent}
                          multiline
                          maxLength={500}
                          textAlignVertical="top"
                          accessibilityLabel={t(
                            "createImageDiary.textPlaceholder"
                          )}
                          accessibilityHint={t("accessibility.input.textHint")}
                          accessibilityRole="text"
                        />
                        {/* 语音按钮 - 放在输入框左下角 */}
                        <TouchableOpacity
                          style={styles.inputVoiceButton}
                          onPress={async () => {
                            // ✅ 进入录音模式
                            try {
                              setIsRecordingMode(true);

                              // ✅ 关键修复1：先停止并清理所有音频播放器
                              if (resultSoundRef.current) {
                                try {
                                  await resultSoundRef.current.stopAsync();
                                  await resultSoundRef.current.unloadAsync();
                                } catch (error) {
                                  console.log("清理音频播放器时出错（可忽略）:", error);
                                }
                                resultSoundRef.current = null;
                                setIsPlayingResult(false);
                              }

                              // ✅ 关键修复2：先取消之前的录音，确保录音对象被完全清理
                              try {
                                await cancelRecording();
                              } catch (error) {
                                console.log("取消之前的录音时出错（可忽略）:", error);
                              }

                              // ✅ 关键修复3：增加等待时间，确保音频系统完全准备好
                              // 先等待 200ms 让音频播放器完全停止
                              await new Promise((resolve) => setTimeout(resolve, 200));
                              // 再等待 100ms 让音频系统完全重置
                              await new Promise((resolve) => setTimeout(resolve, 100));

                              // ✅ 现在可以安全地开始录音
                              await startRecording();
                            } catch (error) {
                              console.error("启动录音失败:", error);
                              Alert.alert("错误", "启动录音失败，请重试");
                              setIsRecordingMode(false);
                            }
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel={t("diary.startRecording")}
                          accessibilityHint={t("accessibility.button.recordHint")}
                          accessibilityRole="button"
                        >
                          <MicIcon width={16} height={16} />
                        </TouchableOpacity>
                        {/* 字符计数器 - 放在输入框右下角 */}
                        <Text
                          style={[
                            styles.charCount,
                            textContent.length > 0 &&
                              textContent.length < 10 &&
                              styles.charCountWarning,
                            {
                              fontFamily: getFontFamilyForText(
                                `${textContent.length}/500`,
                                "regular"
                              ),
                            },
                          ]}
                        >
                          {textContent.length}/500
                        </Text>
                      </View>

                      {/* 完成按钮 - 放在输入框正下面 */}
                      <TouchableOpacity
                        style={styles.completeButton}
                        onPress={handleSave}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.completeButtonText,
                            {
                              fontFamily: getFontFamilyForText(
                                isProcessing || isSaving
                                  ? t("common.saving")
                                  : t("createImageDiary.submitButton"),
                                "semibold"
                              ),
                            },
                          ]}
                        >
                          {isProcessing || isSaving
                            ? t("common.saving")
                            : t("createImageDiary.submitButton")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>

          {/* ✅ 统一的处理加载Modal */}
          {isProcessing && images.length > 0 && (
            <ProcessingModal
              visible={isProcessing}
              processingStep={processingStep}
              processingProgress={processingProgress}
              steps={processingSteps.map((step) => ({
                icon: step.icon,
                text: step.text,
              }))}
            />
          )}

          {/* ✅ 录音模式时，显示底部面板 */}
          {!isProcessing && isRecordingMode && images.length > 0 && (
            <View style={styles.recordingOverlay}>
              <VoiceRecordingPanel
                isRecording={isRecording}
                isPaused={isPaused}
                duration={recordingDuration}
                nearLimit={nearLimit}
                waveAnim1={waveAnim1}
                waveAnim2={waveAnim2}
                waveAnim3={waveAnim3}
                pulseAnim={pulseAnim}
                onCancel={handleCancelRecording}
                onTogglePause={isPaused ? resumeRecording : pauseRecording}
                onFinish={finishRecording}
              />
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
                  <Text
                    style={[
                      styles.confirmMessage,
                      {
                        fontFamily: getFontFamilyForText(
                          t("createImageDiary.confirmMessage"),
                          "regular"
                        ),
                      },
                    ]}
                  >
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
                        doSaveImageOnly(); // ✅ 纯图片直接保存
                      }}
                      accessibilityLabel={t("createImageDiary.saveAsIs")}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.confirmButtonTextSecondary,
                          {
                            fontFamily: getFontFamilyForText(
                              t("createImageDiary.saveAsIs"),
                              "regular"
                            ),
                          },
                        ]}
                      >
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
                      <Text
                        style={[
                          styles.confirmButtonTextPrimary,
                          {
                            fontFamily: getFontFamilyForText(
                              t("createImageDiary.addContent"),
                              "semibold"
                            ),
                          },
                        ]}
                      >
                        {t("createImageDiary.addContent")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
        {/* Toast 提示 - 使用全屏容器确保居中 */}
        {toastVisible && (
          <View style={styles.toastOverlay} pointerEvents="none">
            <View style={styles.toastContainer}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
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
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "left",
    color: "#333",
    flex: 1,
  },
  pickerCloseButton: {
    padding: 4,
  },
  pickerHeaderDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginBottom: 4,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 0,
  },
  pickerOptionIcon: {
    width: 28,
    height: 28,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: "400",
    textAlign: "left",
    color: "#1A1A1A",
    flex: 1,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 0,
  },

  // 图片预览界面样式
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, // ✅ 与 RecordingModal 保持一致（从 20 调整为 24）
    borderTopRightRadius: 24, // ✅ 与 RecordingModal 保持一致（从 20 调整为 24）
    paddingBottom: 40, // ✅ 与 TextInputModal 和 RecordingModal 保持一致
  },
  // ✅ 输入状态：最大高度（键盘弹出时充分利用屏幕）
  modalInput: {
    height: SCREEN_HEIGHT - 80,
    maxHeight: SCREEN_HEIGHT - 80,
  },
  // ✅ 加载状态：固定高度（与语音处理保持一致）
  modalProcessing: {
    height: 640,
    minHeight: 640,
    maxHeight: 640,
  },
  // ✅ 结果状态：根据内容动态调整（最小高度640，最大不超过屏幕高度）
  modalResult: {
    minHeight: 640,
    maxHeight: SCREEN_HEIGHT - 80,
    // 不设置固定 height，让内容决定高度
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
    marginBottom: 0, // ✅ 调整为0，与textPreviewContainer的marginTop配合，总间距为20px
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
    paddingLeft: 64, // 为左下角语音按钮留出空间
    paddingBottom: 40, // 为字符计数和按钮留出空间
    color: "#1A1A1A",
    textAlignVertical: "top",
    minHeight: 200,
  },
  inputVoiceButton: {
    position: "absolute",
    left: 12,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
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
    paddingVertical: 60, // ✅ 与 RecordingModal 的 animationArea 保持一致
    width: "100%",
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
    marginTop: 140, // ✅ 与 RecordingModal 的 statusText 保持一致，避开波纹区域
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline", // 对齐基线
    // ✅ 与 RecordingModal 保持一致，不需要额外的 marginTop
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
    paddingTop: 20, // ✅ 与 RecordingModal 的 controls 保持一致
    width: "100%",
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
  textPreviewContainer: {
    backgroundColor: "rgba(250, 246, 237, 0.95)", // ✅ 半透明背景
    borderRadius: 12,
    padding: 12,
    marginTop: 12, // ✅ 缩小与图片缩略图的间距，与页边距（20px）视觉上接近
    marginBottom: 0,
    // ✅ 去掉 marginHorizontal，与输入框保持一致（都使用 scrollContent 的 paddingHorizontal: 20）
    width: "auto", // ✅ 自动宽度
    maxHeight: 100,
    alignSelf: "stretch", // ✅ 确保宽度填满
  },
  textPreviewTitle: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    fontWeight: "600",
  },
  textPreviewText: {
    ...Typography.body,
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  recordingOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent", // ✅ 改为透明，去掉白色背景重叠
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingHorizontal: 20,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center", // ✅ 与 RecordingModal 保持一致
    flex: 1, // ✅ 确保占满可用空间
  },
  textPreviewContent: {
    width: "100%",
  },
  // ✅ 加载Modal样式
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    width: "80%",
    maxWidth: 300,
    alignItems: "center",
  },
  // ===== Toast（统一样式，与RecordingModal和列表删除一致）=====
  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    maxWidth: "80%",
  },
  toastText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "500",
    textAlign: "center",
  },
  // ===== 结果预览视图样式 =====
  resultScrollView: {
    flex: 1,
  },
  resultScrollContent: {
    paddingBottom: 20, // ✅ 与 RecordingModal 保持一致
    paddingHorizontal: 20,
  },
  resultImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 4,
  },
  resultImageWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  resultImageWrapperLastInRow: {
    marginRight: 0,
  },
  resultThumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  resultAudioPlayer: {
    marginTop: 4, // ✅ 进一步缩小间距，让图片和语音更紧凑
    marginBottom: 12,
  },
  resultDiaryCard: {
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultTitleText: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  resultContentText: {
    ...Typography.body,
    lineHeight: 26,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },
  resultFeedbackCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  resultFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  resultFeedbackTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: "#E56C45",
    marginLeft: 8,
  },
  resultFeedbackText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 28, // ✅ 增大行高，让中文内容不那么密集（从22增加到28）
    letterSpacing: 0.3, // ✅ 增加字间距，让阅读更舒适
    color: "#1A1A1A",
  },
  resultBottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: "#E56C45",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  editTitleInput: {
    ...Typography.diaryTitle,
    color: "#1A1A1A",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  editContentInput: {
    ...Typography.body,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E56C45",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    minHeight: 200,
    maxHeight: 400,
    textAlignVertical: "top",
  },
});
