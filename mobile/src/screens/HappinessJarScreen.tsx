/**
 * Happiness Jar Screen - 幸福罐页面
 * 
 * 功能：
 * - 显示所有幸福时刻的日记
 * - 使用统一的 DiaryCard 组件完整显示（图片、音频、文本）
 * - 支持音频播放
 * - 支持图片预览
 * - 支持跳转详情页
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  StatusBar,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Diary } from './DiaryListScreen';
import DiaryDetailScreen from './DiaryDetailScreen';
import { HAPPY_EMOTIONS, isHappyEmotion } from '../constants/happinessEmotions';
import { t } from '../i18n';
import { DiaryCard } from '../components/DiaryCard';
import { useDiaryAudio } from '../hooks/useDiaryAudio';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { getFontFamilyForText } from '../styles/typography';
import HappinessIllustration from '../components/HappinessIllustration.svg';
import CopyIcon from '../assets/icons/copyIcon.svg';
import DeleteIcon from '../assets/icons/deleteIcon.svg';
import * as Clipboard from 'expo-clipboard';
import { deleteDiary as deleteDiaryApi } from '../services/diaryService';

const ILLUSTRATION_WIDTH = 120;
const ILLUSTRATION_HEIGHT = (ILLUSTRATION_WIDTH * 56) / 92; // match viewBox ratio

const HappinessJarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { diaries } = route.params as { diaries: Diary[] };

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current; // ✅ 滚动位置
  const actionSheetSlide = useRef(new Animated.Value(300)).current;

  // ✅ 本地数据（用于删除后即时更新）
  const [localDiaries, setLocalDiaries] = useState<Diary[]>(diaries);

  useEffect(() => {
    setLocalDiaries(diaries);
  }, [diaries]);

  // 1. 筛选 + 排序幸福日记（按时间排序，最新在前）
  const happyDiaries = useMemo(() => {
    const filtered = localDiaries.filter((d) =>
      isHappyEmotion(d.emotion_data?.emotion)
    );
    // ✅ 按创建时间倒序排列（最新的在最前面）
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [localDiaries]);

  // 2. 入场动画
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // 3. ✅ 标题透明度：滚动 50px 后完全显示
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // 4. ✅ 获取页面标题和主题字体
  const pageTitle = t('happinessJar.pageTitle');
  const titleFontFamily = getFontFamilyForText(pageTitle, 'semibold');
  
  // 5. ✅ 获取 Header 文案和字体
  const headerTitle = t('happinessJar.headerTitle');
  const headerDescription = t('happinessJar.headerDescription');
  const headerTitleFont = getFontFamilyForText(headerTitle, 'bold');
  const headerDescFont = getFontFamilyForText(headerDescription, 'regular');

  // ✅ 使用统一的音频播放 Hook
  const {
    currentPlayingId,
    currentTimeMap: currentTime,
    durationMap: duration,
    hasPlayedOnceSet: hasPlayedOnce,
    handlePlayAudio,
    handleSeek,
    stopAllAudio,
  } = useDiaryAudio();

  // 图片预览状态
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  // 详情页状态
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // ✅ Action Sheet 状态
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedDiaryForAction, setSelectedDiaryForAction] = useState<Diary | null>(null);

  // ✅ 轻量 Toast（Android 用原生，iOS 用自绘）
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  };

  useEffect(() => {
    if (actionSheetVisible) {
      Animated.spring(actionSheetSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      actionSheetSlide.setValue(300);
    }
  }, [actionSheetVisible, actionSheetSlide]);

  type DiaryAction = "copyEntry" | "delete";

  const getCopyText = (diary: Diary) => {
    const title = diary.title?.trim();
    const content = (
      diary.polished_content ||
      diary.original_content ||
      ""
    ).trim();
    const parts = [title, content].filter(Boolean);
    return parts.join("\n\n").trim();
  };

  const handleAction = React.useCallback(async (action: DiaryAction) => {
    setActionSheetVisible(false);

    if (!selectedDiaryForAction) return;

    switch (action) {
      case "copyEntry":
        {
          const copyText = getCopyText(selectedDiaryForAction);
          if (!copyText) {
            Alert.alert(t("confirm.hint"), t("home.copyUnavailable"));
            return;
          }
          await Clipboard.setStringAsync(copyText);
          showToast(t("success.copied"));
        }
        break;
      case "delete":
        Alert.alert(t("confirm.deleteTitle"), t("confirm.deleteMessage"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => handleDeleteDiary(selectedDiaryForAction.diary_id),
          },
        ]);
        break;
    }
  }, [selectedDiaryForAction, t]);

  const handleDeleteDiary = async (diaryId: string) => {
    try {
      await deleteDiaryApi(diaryId);
      setLocalDiaries((prev) => prev.filter((d) => d.diary_id !== diaryId));
      if (selectedDiary?.diary_id === diaryId) {
        setDetailVisible(false);
        setSelectedDiary(null);
      }
      showToast(t("success.deleted"));
    } catch (error: any) {
      console.error("删除日记失败:", error);
      const message = error?.message || "";
      if (
        message.includes("找不到日记ID") ||
        message.includes("Not Found") ||
        message.includes("diaryID")
      ) {
        setLocalDiaries((prev) => prev.filter((d) => d.diary_id !== diaryId));
        return;
      }
      Alert.alert(
        t("error.genericError"),
        error.message || t("error.deleteFailed")
      );
    }
  };

  const handleDiaryOptions = React.useCallback((item: Diary) => {
    setSelectedDiaryForAction(item);
    setActionSheetVisible(true);
  }, []);

  // ✅ 渲染日记卡片（使用统一的 DiaryCard 组件）
  const renderItem = ({ item, index }: { item: Diary; index: number }) => {
    const totalDuration = duration.get(item.diary_id) || item.audio_duration || 0;

    return (
      <DiaryCard
        diary={item}
        index={index}
        totalCount={happyDiaries.length}
        disableShadow
        isPlaying={currentPlayingId === item.diary_id}
        currentTime={currentTime.get(item.diary_id) || 0}
        totalDuration={totalDuration}
        hasPlayedOnce={hasPlayedOnce.has(item.diary_id)}
        onPlayPress={() => handlePlayAudio(item)}
        onSeek={(seekTime) => handleSeek(item.diary_id, seekTime)}
        onImagePress={(imageUrls, imgIndex) => {
          setImagePreviewUrls(imageUrls);
          setImagePreviewIndex(imgIndex);
          setImagePreviewVisible(true);
        }}
        onPress={() => {
          setSelectedDiary(item);
          setDetailVisible(true);
        }}
        showOptions // ✅ 与首页一致，显示三点菜单（复制/删除）
        onOptionsPress={() => handleDiaryOptions(item)}
      />
    );
  };

  const renderActionSheet = () => {
    if (!selectedDiaryForAction) return null;
    const shouldShowCopy = getCopyText(selectedDiaryForAction).length > 0;

    return (
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActionSheetVisible(false)}
          />

          <Animated.View
            style={[
              styles.actionSheetContainer,
              { transform: [{ translateY: actionSheetSlide }] },
            ]}
          >
            <View style={styles.actionSheetHeader}>
              <Text
                style={[
                  styles.actionSheetTitle,
                  {
                    fontFamily: getFontFamilyForText(
                      t("home.actionSheetTitle"),
                      "medium"
                    ),
                  },
                ]}
              >
                {t("home.actionSheetTitle")}
              </Text>
              <TouchableOpacity
                style={styles.actionSheetCloseButton}
                onPress={() => setActionSheetVisible(false)}
                accessibilityLabel={t("common.close")}
                accessibilityHint={t("accessibility.button.closeHint")}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {shouldShowCopy && <View style={styles.actionSheetHeaderDivider} />}

            {shouldShowCopy && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleAction("copyEntry")}
              >
                <View style={styles.actionIcon}>
                  <CopyIcon width={28} height={28} />
                </View>
                <Text
                  style={[
                    styles.actionText,
                    {
                      fontFamily: getFontFamilyForText(
                        t("home.copyEntry"),
                        "regular"
                      ),
                    },
                  ]}
                >
                  {t("home.copyEntry")}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.actionSheetItem,
                styles.deleteAction,
                !shouldShowCopy && { marginTop: 0 },
              ]}
              onPress={() => handleAction("delete")}
            >
              <View style={styles.actionIcon}>
                <DeleteIcon width={28} height={28} />
              </View>
              <Text
                style={[
                  styles.actionText,
                  styles.deleteText,
                  {
                    fontFamily: getFontFamilyForText(
                      t("common.delete"),
                      "regular"
                    ),
                  },
                ]}
              >
                {t("common.delete")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* ✅ 状态栏配置 */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFE699"
        translucent={false}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ✅ 标准顶部导航栏（详情页打开时隐藏） */}
        {!detailVisible && (
          <View style={styles.navbar}>
            {/* 返回按钮 */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.navBackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            {/* 标题（滚动时淡入） */}
            <Animated.Text
              style={[
                styles.navTitle,
                {
                  opacity: titleOpacity,
                  fontFamily: titleFontFamily, // ✅ 使用主题字体
                },
              ]}
            >
              {pageTitle}
            </Animated.Text>

            {/* 右侧占位（保持居中） */}
            <View style={{ width: 40 }} />
          </View>
        )}

        {/* 日记列表 */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <Animated.FlatList
            data={happyDiaries}
            renderItem={renderItem}
            keyExtractor={(item) => item.diary_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            ListHeaderComponent={
              !detailVisible ? (
                <View style={styles.headerContainer}>
                  {/* 插图 */}
                  <View style={styles.illustrationContainer}>
                    <HappinessIllustration
                      width={ILLUSTRATION_WIDTH}
                      height={ILLUSTRATION_HEIGHT}
                    />
                  </View>
                  
                  {/* 标题 */}
                  <Text
                    style={[
                      styles.headerTitle,
                      { fontFamily: headerTitleFont },
                    ]}
                  >
                    {headerTitle}
                  </Text>
                  
                  {/* 描述文案 */}
                  <Text
                    style={[
                      styles.headerDescription,
                      { fontFamily: headerDescFont },
                    ]}
                  >
                    {headerDescription}
                  </Text>
                </View>
              ) : null
            }
          />
        </Animated.View>

      {/* 图片预览 Modal */}
      <ImagePreviewModal
        visible={imagePreviewVisible}
        images={imagePreviewUrls}
        initialIndex={imagePreviewIndex}
        onClose={() => setImagePreviewVisible(false)}
      />

      {renderActionSheet()}

      {/* ✅ 详情页 - 与首页一致：直接条件渲染，不需要包裹 Modal */}
      {detailVisible && selectedDiary && (
        <DiaryDetailScreen
          diaryId={selectedDiary.diary_id}
          onClose={() => {
            setDetailVisible(false);
            setSelectedDiary(null);
          }}
        />
      )}

      {/* iOS 轻量 Toast */}
      {Platform.OS === "ios" && toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={styles.toastContainer}>
            <Text
              style={[
                styles.toastText,
                {
                  fontFamily: getFontFamilyForText(toastMessage, "regular"),
                },
              ]}
            >
              {toastMessage}
            </Text>
          </View>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE699',
  },
  safeArea: {
    flex: 1,
  },
  // ✅ 标准顶部导航栏
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#FFE699',
    borderBottomWidth: 0, // ✅ 无分隔线，保持沉浸感
  },
  navBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  // ✅ Header 区域
  headerContainer: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 16, // ✅ 减少左右间距，扩大文字显示空间
  },
  illustrationContainer: {
    marginBottom: 8, // ✅ 插图与标题间距 12px
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700', // 加粗
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 24,
  },
  headerDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#80645A',
    textAlign: 'center',
    lineHeight: 20,
    width: '100%', // ✅ 占满整个宽度（左右24px由父容器控制）
    marginBottom: 24, // ✅ 间距改为6px
  },
  list: {
    paddingTop: 0, // ✅ Header 已经有 padding
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  // ===== 自定义 Action Sheet =====
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  actionSheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "left",
    color: "#333",
    flex: 1,
  },
  actionSheetCloseButton: {
    padding: 4,
  },
  actionSheetHeaderDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginBottom: 4,
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    marginTop: 8,
  },
  actionIcon: {
    marginRight: 8,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  deleteText: {
    color: "#FF3B30",
  },
  // ===== Toast（iOS）=====
  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
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
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default HappinessJarScreen;
