/**
 * 图片选择器 Modal
 * 
 * 功能：
 * 1. 让用户选择拍照或从相册选择图片
 * 2. 显示已选择的图片缩略图
 * 3. 支持最多9张图片（与微信朋友圈一致）
 * 4. 提供删除功能
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 60) / 3; // 每行3张，留出间距

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImagesSelected: (imageUris: string[]) => void;
  maxImages?: number; // 最多选择多少张，默认9张
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onClose,
  onImagesSelected,
  maxImages = 9,
}) => {
  const [selectedImages, setSelectedImages] = React.useState<string[]>([]);

  // 请求相机权限
  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "需要相机权限",
          "请在设置中允许访问相机",
          [{ text: "好的" }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("请求相机权限失败:", error);
      return false;
    }
  };

  // 请求相册权限
  const requestMediaLibraryPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "需要相册权限",
          "请在设置中允许访问相册",
          [{ text: "好的" }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("请求相册权限失败:", error);
      return false;
    }
  };

  // 拍照
  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // 压缩质量，节省空间
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = result.assets[0].uri;
        handleAddImage(newImage);
      }
    } catch (error) {
      console.error("拍照失败:", error);
      Alert.alert("拍照失败", "请重试");
    }
  };

  // 从相册选择
  const handlePickFromGallery = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    // 计算还能选择多少张
    const remainingSlots = maxImages - selectedImages.length;
    if (remainingSlots <= 0) {
      Alert.alert("提示", `最多只能选择${maxImages}张图片`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, // 支持多选
        quality: 0.8, // 压缩质量
        selectionLimit: remainingSlots, // 限制选择数量
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => asset.uri);
        handleAddImages(newImages);
      }
    } catch (error) {
      console.error("选择图片失败:", error);
      Alert.alert("选择失败", "请重试");
    }
  };

  // 添加单张图片
  const handleAddImage = (uri: string) => {
    if (selectedImages.length >= maxImages) {
      Alert.alert("提示", `最多只能选择${maxImages}张图片`);
      return;
    }
    setSelectedImages([...selectedImages, uri]);
  };

  // 添加多张图片
  const handleAddImages = (uris: string[]) => {
    const remainingSlots = maxImages - selectedImages.length;
    const imagesToAdd = uris.slice(0, remainingSlots);
    setSelectedImages([...selectedImages, ...imagesToAdd]);

    if (uris.length > remainingSlots) {
      Alert.alert("提示", `已达到最大数量限制（${maxImages}张），部分图片未添加`);
    }
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    const newImages = [...selectedImages];
    newImages.splice(index, 1);
    setSelectedImages(newImages);
  };

  // 确认选择
  const handleConfirm = () => {
    if (selectedImages.length === 0) {
      Alert.alert("提示", "请至少选择一张图片");
      return;
    }
    onImagesSelected(selectedImages);
    setSelectedImages([]); // 清空选择
    onClose();
  };

  // 取消
  const handleCancel = () => {
    setSelectedImages([]);
    onClose();
  };

  // 如果没有选择图片，显示选择方式界面
  if (selectedImages.length === 0) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.selectionContainer}>
            <Text style={styles.title}>选择图片</Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleTakePhoto}
            >
              <Text style={styles.optionText}>📷 拍照</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handlePickFromGallery}
            >
              <Text style={styles.optionText}>🖼️ 从相册选择</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // 如果已选择图片，显示预览界面
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.previewContainer}>
        {/* 顶部标题栏 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.headerButton}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            已选择 {selectedImages.length}/{maxImages}
          </Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text style={[styles.headerButton, styles.confirmButton]}>
              完成
            </Text>
          </TouchableOpacity>
        </View>

        {/* 图片预览区域 */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.thumbnailGrid}
        >
          {/* 已选择的图片 */}
          {selectedImages.map((uri, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              <Image source={{ uri }} style={styles.thumbnail} />
              {/* 删除按钮 */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 添加更多按钮 */}
          {selectedImages.length < maxImages && (
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={handlePickFromGallery}
            >
              <Text style={styles.addMoreText}>+</Text>
              <Text style={styles.addMoreLabel}>添加</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* 底部提示 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            提示：完成后可以继续添加语音或文字
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ===== 选择方式界面 =====
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  selectionContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  optionButton: {
    backgroundColor: "#F5F5F5",
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    color: "#333",
  },
  cancelButton: {
    marginTop: 8,
    padding: 18,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: "#999",
  },

  // ===== 预览界面 =====
  previewContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerButton: {
    fontSize: 16,
    color: "#666",
  },
  confirmButton: {
    color: "#007AFF",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  scrollView: {
    flex: 1,
  },
  thumbnailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 15,
    gap: 15, // 注意：gap在某些旧版RN中可能不支持，可以用margin代替
  },
  thumbnailWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  addMoreButton: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  addMoreText: {
    fontSize: 36,
    color: "#999",
    fontWeight: "300",
  },
  addMoreLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  footerText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});

