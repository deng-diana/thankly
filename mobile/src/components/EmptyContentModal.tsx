/**
 * 空内容处理Modal组件
 * 按照苹果设计规范和UX最佳实践设计
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ============================================================================
// 🌍 导入翻译函数
// ============================================================================
import { t } from "../i18n";

const { width } = Dimensions.get("window");

interface EmptyContentModalProps {
  visible: boolean;
  onRetry: () => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

export default function EmptyContentModal({
  visible,
  onRetry,
  onSwitchToText,
  onClose,
}: EmptyContentModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <SafeAreaView style={styles.container}>
            {/* 图标区域 */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBackground}>
                <Ionicons name="mic-off" size={32} color="#D96F4C" />
              </View>
            </View>

            {/* 标题 */}
            <Text style={styles.title}>{t("diary.emptyContent")}</Text>

            {/* 描述 */}
            <Text style={styles.description}>
              {t("diary.emptyContentMessage")}
            </Text>

            {/* 建议列表 */}
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>{t("confirm.hint")}：</Text>
              <View style={styles.suggestionItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.suggestionText}>
                  说一个完整的句子，描述今天发生的事情
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.suggestionText}>
                  分享你的想法、感受或感恩的事情
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.suggestionText}>
                  确保说话声音清晰，距离麦克风适中
                </Text>
              </View>
            </View>

            {/* 操作按钮 */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  {t("diary.startRecording")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSwitchToText}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={20} color="#D96F4C" />
                <Text style={styles.secondaryButtonText}>
                  {t("diary.typeHere")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 取消按钮 */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  container: {
    padding: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF5F1",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  suggestionsContainer: {
    marginBottom: 32,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D96F4C",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#D96F4C",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D96F4C",
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
  },
});
