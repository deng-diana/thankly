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
  Keyboard,
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
import { EmotionCapsule } from "./EmotionCapsule";
import { Typography, getFontFamilyForText } from "../styles/typography";
import DiaryResultView from "./DiaryResultView"; // ✅ 导入共享组件


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// Image Grid Layout Configuration
// ============================================================================
//
// Image Picker Grid: 4 columns with 8px gap
// Horizontal padding: 20px (left) + 20px (right) = 40px
// Total gap width: 3 gaps × 8px = 24px
// Available width: screenWidth - 40px - 24px
// Image size: availableWidth / 4
//
const HORIZONTAL_PADDING = 20;  // Page padding for image picker
const IMAGE_GAP = 8;            // Gap between images
const COLUMNS = 4;              // 4 columns for compact layout
const TOTAL_GAPS = (COLUMNS - 1) * IMAGE_GAP;  // 24px
const AVAILABLE_WIDTH = SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - TOTAL_GAPS;
const THUMBNAIL_SIZE = Math.floor(AVAILABLE_WIDTH / COLUMNS);


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
  const progressAnimationRef = useRef<number | null>(null);

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
  const resultProgressIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  // ✅ 新增：录音动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // ✅ 新增：TextInput 和 ScrollView 的 ref，用于键盘遮挡处理
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ✅ 处理光标位置变化，自动滚动到当前输入行（键盘遮挡处理）
  const handleTextSelectionChange = useCallback(() => {
    if (!textInputRef.current || !scrollViewRef.current) {
      return;
    }

    // 使用 setTimeout 确保在键盘弹出后执行
    setTimeout(() => {
      textInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
        // 估算键盘高度（iOS 约 300-350px，Android 约 250-300px）
        const keyboardHeight = Platform.OS === "ios" ? 350 : 280;
        // 屏幕高度
        const screenHeight = Dimensions.get("window").height;
        // 键盘顶部位置
        const keyboardTop = screenHeight - keyboardHeight;
        // TextInput 底部位置（相对于屏幕）
        const inputBottom = pageY + height;
        // 安全区域顶部偏移（考虑状态栏和导航栏）
        const safeAreaTop = Platform.OS === "ios" ? 100 : 80;

        // 如果输入框底部被键盘遮挡
        if (inputBottom > keyboardTop - safeAreaTop) {
          // 计算需要滚动的距离：输入框底部位置 - 键盘顶部位置 + 安全间距
          // 注意：pageY 是相对于屏幕的位置，需要转换为相对于 ScrollView 的滚动位置
          const scrollOffset = pageY - safeAreaTop + height + 20; // 20px 安全间距
          
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffset),
            animated: true,
          });
        }
      });
    }, 100); // 延迟 100ms 确保键盘已弹出
  }, []);

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
      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
        resultProgressIntervalRef.current = null;
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
      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
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
    setProcessingStep(0);
    setProcessingProgress(0);
    currentProgressRef.current = 0;
    progressAnimValue.setValue(0);

    try {
      console.log("📤 开始上传图片...");
      
      // ✅ 使用真实的上传进度回调：0-70%
      setProcessingStep(0); // 上传图片步骤
      const imageUrls = await uploadDiaryImages(images, (uploadProgress) => {
        // 将上传进度映射到0-70%
        const mappedProgress = Math.round(uploadProgress * 0.7);
        console.log(`📊 真实上传进度: ${uploadProgress}% → 显示进度: ${mappedProgress}%`);
        smoothUpdateProgress(mappedProgress);
      });
      
      // 上传完成，立即更新到70%
      console.log("✅ 图片上传完成，URLs:", imageUrls);
      setProcessingStep(1); // 切换到AI处理步骤
      smoothUpdateProgress(70);

      // ✅ AI处理占70-100%
      console.log("🤖 开始AI处理...");
      const diary = await createImageOnlyDiary(
        imageUrls,
        textContent.trim() || undefined
      );

      console.log("✅ 图片+文字日记创建成功:", diary);

      // ✅ AI处理完成，平滑过渡到100%
      setProcessingStep(imageTextProcessingSteps.length - 1);
      smoothUpdateProgress(100);
      
      // ✅ 等待进度动画完成后再显示结果 (smoothUpdateProgress(100) 的 duration 是 1000ms)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // ✅ 显示结果
      setIsProcessing(false);
      setResultDiary(diary);
      setShowResult(true);
      setPendingDiaryId(diary.diary_id);
      setHasSavedPendingDiary(false);
      setEditedTitle(diary.title);
      setEditedContent(diary.polished_content);

      // ✅ 移除toast - 结果页已经足够明确，不需要额外提示
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
   * 🎯 教科书级别的平滑进度更新（与 RecordingModal 一致）
   */
  const smoothUpdateProgress = useCallback(
    (target: number, duration?: number) => {
      const safeTarget = Math.max(
        Math.min(target, 100),
        currentProgressRef.current
      );
      
      const currentValue = currentProgressRef.current;
      const progressDiff = safeTarget - currentValue;

      if (progressDiff <= 0.01) {
        return;
      }

      let calculatedDuration = duration;
      if (calculatedDuration === undefined) {
        if (progressDiff < 5) {
          calculatedDuration = 600;
        } else if (progressDiff < 10) {
          calculatedDuration = 1000;
        } else if (progressDiff < 20) {
          calculatedDuration = 1500;
        } else if (progressDiff < 30) {
          calculatedDuration = 2000;
        } else {
          calculatedDuration = 2500;
        }
      }

      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }

      const startTime = Date.now();
      const startValue = currentValue;

      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
      };

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / calculatedDuration, 1);
        const easedProgress = easeOutCubic(progress);
        const newValue = startValue + (safeTarget - startValue) * easedProgress;
        const clampedValue = Math.max(currentProgressRef.current, newValue);
        
        currentProgressRef.current = clampedValue;
        setProcessingProgress(clampedValue);

        if (progress < 1) {
          progressAnimationRef.current = requestAnimationFrame(animate);
        } else {
          currentProgressRef.current = safeTarget;
          setProcessingProgress(safeTarget);
          progressAnimationRef.current = null;
        }
      };

      progressAnimationRef.current = requestAnimationFrame(animate);
    },
    []
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
    // ✅ 添加组件卸载检测
    let isMounted = true;

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

      // ✅ 进度回调 - 添加组件卸载检测
      const progressCallback: ProgressCallback = (progressData) => {
        if (!isMounted) {
          console.log("⚠️ 组件已卸载,跳过进度更新");
          return;
        }

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
        textContent.trim() || undefined,
        images.length > 0
      );

      // ✅ 检查组件是否已卸载
      if (!isMounted) {
        console.log("⚠️ 组件已卸载,取消AI处理");
        return;
      }

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

          // ✅ 检查组件是否已卸载
          if (!isMounted) {
            console.log("⚠️ 组件已卸载,取消补充图片");
            return;
          }

          console.log("✅ 图片上传完成，补充图片URL到任务...");

          // ✅ 补充图片URL到任务（AI处理还在进行中）
          await addImagesToTask(taskId, imageUrls);
          console.log("✅ 图片URL已补充到任务");
        } catch (error: any) {
          console.error("❌ 图片上传失败:", error);
          const errorMessage = error.message || "上传图片失败，请重试";

          // ✅ 关键修复：图片上传失败时,正确清理状态
          if (isMounted) {
            setIsProcessing(false);
            setIsRecordingMode(false);
            Alert.alert("错误", errorMessage);
          }

          // ✅ 清理 Keep Awake
          try {
            deactivateKeepAwake();
          } catch (_) {}

          return;
        }
      }

      // ✅ 等待AI处理完成（后端会在保存时等待图片URL）
      const diary = await aiProcessPromise;

      // ✅ 检查组件是否已卸载
      if (!isMounted) {
        console.log("⚠️ 组件已卸载,跳过结果显示");
        return;
      }

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

      // ✅ 关键修复：所有错误都要正确清理状态
      if (isMounted) {
        setIsProcessing(false);
        setIsRecordingMode(false);

        // ✅ 区分不同类型的错误,提供更友好的提示
        let errorMessage = "处理失败，请重试";
        if (error.message) {
          if (error.message.includes("网络") || error.message.includes("Network")) {
            errorMessage = "网络连接失败，请检查网络后重试";
          } else if (error.message.includes("超时")) {
            errorMessage = "处理超时，请重试";
          } else if (error.message.includes("任务失败")) {
            errorMessage = error.message;
          } else {
            errorMessage = error.message;
          }
        }

        Alert.alert("错误", errorMessage);
      }

      // ✅ 清理 Keep Awake
      try {
        deactivateKeepAwake();
      } catch (_) {}
    } finally {
      // ✅ 标记组件已卸载
      isMounted = false;
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
      if (resultProgressIntervalRef.current) {
        clearInterval(resultProgressIntervalRef.current);
        resultProgressIntervalRef.current = null;
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

      // ✅ 关键修复：先关闭 Modal
      onClose();
      
      // ✅ 等待 Modal 完全关闭（使用 requestAnimationFrame 确保渲染完成）
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          });
        });
      });

      // ✅ 显示成功 Toast（在 Modal 关闭后）
      showToast(t("success.diaryCreated"));

      // ✅ 等待 Toast 显示，然后刷新列表
      await new Promise((resolve) => setTimeout(resolve, 500));
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
      const startProgressTimer = () => {
        if (resultProgressIntervalRef.current) {
          clearInterval(resultProgressIntervalRef.current);
          resultProgressIntervalRef.current = null;
        }
        resultProgressIntervalRef.current = setInterval(async () => {
          try {
            if (!resultSoundRef.current) {
              clearInterval(resultProgressIntervalRef.current!);
              resultProgressIntervalRef.current = null;
              return;
            }
            const status = await resultSoundRef.current.getStatusAsync();
            if (status.isLoaded) {
              if (status.durationMillis) {
                setResultDuration((prev) => {
                  const seconds = Math.floor(status.durationMillis! / 1000);
                  return prev !== seconds ? seconds : prev;
                });
              }
              if (status.positionMillis !== undefined) {
                setResultCurrentTime(status.positionMillis / 1000);
              }
              if (status.didJustFinish) {
                clearInterval(resultProgressIntervalRef.current!);
                resultProgressIntervalRef.current = null;
                setIsPlayingResult(false);
                setResultCurrentTime(0);
                await resultSoundRef.current.setPositionAsync(0);
              }
            }
          } catch (error) {
            console.error("❌ 更新播放进度失败:", error);
          }
        }, 50);
      };

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
        const status = await resultSoundRef.current.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          const nearEnd = status.positionMillis >= status.durationMillis - 200;
          if (nearEnd) {
            await resultSoundRef.current.setPositionAsync(0);
            setResultCurrentTime(0);
          }
        }
        await resultSoundRef.current.setProgressUpdateIntervalAsync(100);
        await resultSoundRef.current.playAsync();
        setIsPlayingResult(true);
        startProgressTimer();
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
      await sound.setProgressUpdateIntervalAsync(100);

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

      startProgressTimer();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingResult(false);
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
      <>
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
          <View style={styles.titleRow}>
            <PreciousMomentsIcon width={20} height={20} />
            <Text style={styles.title}>{t("createImageDiary.title")}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.resultHeaderDivider} />
      </>
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
          style={{ flexShrink: 1 }} // ✅ 使用 flexShrink 让内容自适应
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
                onSeek={async (seekTime) => {
                  if (resultSoundRef.current) {
                    await resultSoundRef.current.setPositionAsync(
                      seekTime * 1000
                    );
                    setResultCurrentTime(seekTime);
                  }
                }}
                style={styles.resultAudioPlayer}
              />
            )}

            {/* 标题、内容和AI反馈卡片 - 使用共享组件 */}
            <DiaryResultView
              title={resultDiary.title}
              polishedContent={resultDiary.polished_content}
              aiFeedback={resultDiary.ai_feedback}
              emotionData={resultDiary.emotion_data}
              language={resultDiary.language}
              isEditingTitle={isEditingTitle}
              isEditingContent={isEditingContent}
              editedTitle={editedTitle}
              editedContent={editedContent}
              onStartTitleEditing={startEditingTitle}
              onStartContentEditing={startEditingContent}
              onTitleChange={(text) => {
                setEditedTitle(text);
                setHasChanges(text.trim() !== resultDiary.title);
              }}
              onContentChange={(text) => {
                setEditedContent(text);
                setHasChanges(text.trim() !== resultDiary.polished_content);
              }}
            />

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
              {/* 顶部Header: 标题（带图标）左对齐 + 关闭按钮右对齐 */}
              <View style={styles.pickerHeader}>
                <View style={styles.pickerTitleRow}>
                  <PreciousMomentsIcon width={20} height={20} />
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
                </View>
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
            <View style={styles.titleRow}>
              <PreciousMomentsIcon width={20} height={20} />
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
            </View>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.headerDivider} />

          {/* 图片网格和文字输入 */}
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <ScrollView
              ref={scrollViewRef}
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
                          ref={textInputRef}
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
                          onSelectionChange={handleTextSelectionChange}
                          multiline
                          maxLength={1000}
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
                            try {
                              // Clean up audio player if playing
                              if (resultSoundRef.current) {
                                try {
                                  await resultSoundRef.current.stopAsync();
                                  await resultSoundRef.current.unloadAsync();
                                  resultSoundRef.current = null;
                                  setIsPlayingResult(false);
                                } catch (error) {
                                  console.log("Audio cleanup error (ignorable):", error);
                                }
                              }

                              // Cancel any existing recording (hook handles cleanup)
                              await cancelRecording();

                              // Small delay to ensure cleanup completes
                              await new Promise((resolve) => setTimeout(resolve, 200));

                              // Enter recording mode
                              setIsRecordingMode(true);

                              // Start recording (hook handles all the complexity)
                              await startRecording();
                            } catch (error) {
                              console.error("Failed to start recording:", error);
                              setIsRecordingMode(false);
                              // Error alert is already shown by the hook
                            }
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel={t("diary.startRecording")}
                          accessibilityHint={t(
                            "accessibility.button.recordHint"
                          )}
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
                                `${textContent.length}/1000`,
                                "regular"
                              ),
                            },
                          ]}
                        >
                          {textContent.length}/1000
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
  pickerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pickerTitle: {
    ...Typography.sectionTitle,
    color: "#1A1A1A",
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
  // ✅ 结果状态：折中方案 - 75% 默认高度
  modalResult: {
    minHeight: "75%",
    maxHeight: "90%",
  },
  // Header 样式 - 与 TextInputModal 保持一致
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // ✅ 还原为 20px
    paddingVertical: 16,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    ...Typography.sectionTitle,
    color: "#1A1A1A",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    width: 36, // 与 TextInputModal 保持一致
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20, // ✅ 还原为 20px
    marginBottom: 16, // ✅ 输入页：分割线下方间距统一为 16px
  },
  resultHeaderDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20, // ✅ 还原为 20px
    marginBottom: 0, // ✅ 结果页：移除 marginBottom，间距由 resultScrollContent 的 paddingTop 统一控制
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
    paddingHorizontal: 20, // ✅ 还原为 20px
    paddingBottom: 120, // 增加底部 padding，为工具栏留出空间
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    // ✅ 移除 rowGap（兼容性问题），改用每个 wrapper 的 marginBottom
    marginBottom: 10, // ✅ 统一规则：间距由 marginBottom 控制。计算：图片自带 10 + 容器 10 = 20px
    // ✅ 移除 paddingTop：间距由 headerDivider 的 marginBottom 统一控制
  },
  // 文字输入框样式 - 与 TextInputModal 保持一致
  inputContainer: {
    position: "relative",
    marginBottom: 12, // ✅ 统一规则：间距由 marginBottom 控制
  },
  textInput: {
    ...Typography.body,
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 12,
    paddingLeft: 12, // 让占位文字与常规输入对齐
    paddingRight: 12, // 给右下角计数器留出空间，避免过早折行
    paddingBottom: 56, // ✅ 增加底部内边距，为语音按钮和字符计数器留出更多空间（原40，现56）
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
    marginRight: 8, // 水平间距 8px
    marginBottom: 8, // ✅ 添加垂直间距 8px
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
    paddingVertical: 10,
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
    marginBottom: 0,
    // ✅ 移除 marginTop：间距由上方 imageGrid 的 marginBottom 统一控制 (20px)
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
    paddingBottom: 16, // ✅ 与 RecordingModal 的 modal paddingBottom 保持一致
    paddingHorizontal: 0, // ✅ 移除横向 padding，由 VoiceRecordingPanel 内部控制
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
    flexShrink: 1, // ✅ 允许收缩以适应内容
  },
  resultScrollContent: {
    paddingTop: 16, // ✅ 分割线下方间距统一为 16px
    paddingBottom: 20, // ✅ 与 RecordingModal 保持一致
    paddingHorizontal: 20, // ✅ 还原为 20px
  },
  resultImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start", // 控制行间距
    marginBottom: 8, // ✅ 图片(8px) + 容器(8px) = 16px 总间距
    gap: 0, // ✅ 确保没有额外的间距（React Native 18+ 支持）
  },
  resultImageWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    marginRight: 8,
    marginBottom: 8, // ✅ 添加行间距 8px
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
    marginBottom: 12, // ✅ 统一规则：间距由 marginBottom 控制
  },
  resultDiaryCard: {
    backgroundColor: "#FAF6ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12, // ✅ 统一规则：间距由 marginBottom 控制
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  resultTitleText: {
    ...Typography.diaryTitle,
    fontSize: 18,
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 0, // ✅ 移至 resultTitleRow 控制
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
    paddingHorizontal: 20, // ✅ 还原为 20px
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
    marginBottom: 0, // ✅ 移至 resultTitleRow 控制
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
