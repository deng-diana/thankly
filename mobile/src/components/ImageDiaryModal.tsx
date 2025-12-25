/**
 * 图片日记 Modal 组件
 *
 * 设计理念：与 RecordingModal 和 TextInputModal 保持一致
 *
 * 功能：
 * 1. 显示已选择的图片缩略图（顶部）
 * 2. 底部工具栏：继续添加图片、语音、文字
 * 3. 支持删除图片
 * 4. 最终上传并创建日记
 */

import React, { useState, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

// 导入图标
import ImageInputIcon from "../assets/icons/addImageIcon.svg";
import TextInputIcon from "../assets/icons/textInputIcon.svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 80) / 3; // 3列，留出边距

interface ImageDiaryModalProps {
  visible: boolean;
  initialImages: string[]; // 初始选择的图片
  onSuccess: () => void; // 成功创建日记后的回调
  onCancel: () => void; // 取消回调
  maxImages?: number; // 最多选择多少张，默认9张
}

export default function ImageDiaryModal({
  visible,
  initialImages,
  onSuccess,
  onCancel,
  maxImages = 9,
}: ImageDiaryModalProps) {
  // ========== 状态管理 ==========
  const [selectedImages, setSelectedImages] = useState<string[]>(initialImages);

  // ========== 重置状态（Modal 关闭时） ==========
  const resetState = () => {
    setSelectedImages(initialImages);
  };

  // ========== 图片操作 ==========

  /**
   * 删除图片
   */
  const handleRemoveImage = (index: number) => {
    const newImages = [...selectedImages];
    newImages.splice(index, 1);
    setSelectedImages(newImages);

    // 如果删除后没有图片了，关闭 Modal
    if (newImages.length === 0) {
      Alert.alert("提示", "至少需要一张图片", [
        {
          text: "取消",
          onPress: handleCancel,
          style: "cancel",
        },
        {
          text: "重新选择",
          onPress: handleAddMoreImages,
        },
      ]);
    }
  };

  /**
   * 添加更多图片
   */
  const handleAddMoreImages = async () => {
    const remainingSlots = maxImages - selectedImages.length;
    if (remainingSlots <= 0) {
      Alert.alert("提示", `最多只能选择${maxImages}张图片`);
      return;
    }

    try {
      // 请求相册权限
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
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => asset.uri);
        setSelectedImages([...selectedImages, ...newImages]);
      }
    } catch (error) {
      console.error("选择图片失败:", error);
      Alert.alert("选择失败", "请重试");
    }
  };

  /**
   * 打开录音 Modal
   * TODO: 实现与 RecordingModal 的集成
   */
  const handleAddVoice = () => {
    Alert.alert("功能开发中", "即将支持图片+语音混合日记");
  };

  /**
   * 打开文字输入
   * TODO: 实现与 TextInputModal 的集成
   */
  const handleAddText = () => {
    Alert.alert("功能开发中", "即将支持图片+文字混合日记");
  };

  /**
   * 取消并关闭
   */
  const handleCancel = () => {
    resetState();
    onCancel();
  };

  /**
   * 完成 - 将图片URI数组传递给父组件
   * ⚠️ 注意：这里不上传到S3，只是收集用户选择的内容
   * 真正的上传会在用户添加完所有内容（图片+语音/文字）后统一处理
   */
  const handleComplete = () => {
    if (selectedImages.length === 0) {
      Alert.alert("提示", "请至少选择一张图片");
      return;
    }

    // TODO: 这里应该打开下一步的流程
    // 比如：询问用户是否继续添加语音或文字
    // 目前先临时用 Alert 提示
    Alert.alert(
      "下一步",
      "图片已准备好，接下来可以：\n1. 继续添加语音\n2. 继续添加文字\n3. 直接保存（仅图片日记）",
      [
        {
          text: "直接保存",
          onPress: () => {
            // TODO: 调用创建纯图片日记的接口
            console.log("📸 创建纯图片日记:", selectedImages);
            resetState();
            onSuccess();
          },
        },
        { text: "添加语音", onPress: handleAddVoice },
        { text: "添加文字", onPress: handleAddText },
        { text: "取消", style: "cancel" },
      ]
    );
  };

  // ========== 渲染 ==========

  /**
   * 渲染顶部标题栏
   */
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleCancel}>
        <Text style={styles.headerButton}>取消</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        已选择 {selectedImages.length}/{maxImages}
      </Text>
      <TouchableOpacity
        onPress={handleComplete}
        disabled={selectedImages.length === 0}
      >
        <Text
          style={[
            styles.headerButton,
            styles.headerButtonPrimary,
            selectedImages.length === 0 && styles.headerButtonDisabled,
          ]}
        >
          完成
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * 渲染图片网格
   */
  const renderImageGrid = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.imageGrid}
      showsVerticalScrollIndicator={false}
    >
      {selectedImages.map((uri, index) => (
        <View key={index} style={styles.imageWrapper}>
          <Image source={{ uri }} style={styles.thumbnail} />
          {/* 删除按钮 */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveImage(index)}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}

      {/* 添加更多按钮 */}
      {selectedImages.length < maxImages && (
        <TouchableOpacity
          style={styles.addMoreButton}
          onPress={handleAddMoreImages}
        >
          <Ionicons name="add" size={36} color="#999" />
          <Text style={styles.addMoreText}>添加</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  /**
   * 渲染底部工具栏
   */
  const renderBottomToolbar = () => (
    <View style={styles.bottomToolbar}>
      {/* 图片按钮 */}
      <TouchableOpacity
        style={styles.toolbarButton}
        onPress={handleAddMoreImages}
        disabled={selectedImages.length >= maxImages}
      >
        <ImageInputIcon
          width={28}
          height={28}
          fill={selectedImages.length >= maxImages ? "#CCC" : "#332824"}
        />
      </TouchableOpacity>

      {/* 语音按钮 - 主按钮 */}
      <TouchableOpacity
        style={styles.toolbarButtonMain}
        onPress={handleAddVoice}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 文字按钮 */}
      <TouchableOpacity style={styles.toolbarButton} onPress={handleAddText}>
        <TextInputIcon width={28} height={28} fill="#332824" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* 顶部标题栏 */}
          {renderHeader()}

          {/* 图片网格 */}
          {renderImageGrid()}

          {/* 底部工具栏 */}
          {renderBottomToolbar()}
        </View>
      </View>
    </Modal>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#FAF6ED", // 使用应用主题色
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 640, // 与 RecordingModal 保持一致
    paddingBottom: Platform.OS === "ios" ? 34 : 20, // 适配 iPhone 底部安全区域
  },

  // ===== 顶部标题栏 =====
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8DFD0",
  },
  headerButton: {
    fontSize: 16,
    color: "#666",
  },
  headerButtonPrimary: {
    color: "#E56C45",
    fontWeight: "600",
  },
  headerButtonDisabled: {
    color: "#CCC",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#332824",
  },

  // ===== 图片网格 =====
  scrollView: {
    flex: 1,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 20,
    gap: 10, // 间距
  },
  imageWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F5F0E8",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  addMoreButton: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E8DFD0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  addMoreText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },

  // ===== 底部工具栏 =====
  bottomToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 40,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E8DFD0",
    borderRadius: 200,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#E56C45",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toolbarButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarButtonMain: {
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
});
