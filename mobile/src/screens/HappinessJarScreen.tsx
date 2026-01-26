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
  Easing,
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

  // ✅ 入场动画值（图标、标题、副标题）
  const iconFadeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.8)).current;
  const iconSwayAnim = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  // ✅ 卡片动画值存储（Map: diary_id -> animation values）
  const cardAnimationsRef = useRef<Map<string, {
    translateY: Animated.Value;
    opacity: Animated.Value;
    scale: Animated.Value;
  }>>(new Map()).current;
  
  // ✅ 跟踪哪些卡片已经启动了动画（避免重复执行）
  const animatedCardsRef = useRef<Set<string>>(new Set()).current;

  // ✅ 本地数据（用于删除后即时更新）
  const [localDiaries, setLocalDiaries] = useState<Diary[]>(diaries);

  useEffect(() => {
    setLocalDiaries(diaries);
  }, [diaries]);

  // 1. 筛选 + 排序幸福日记
  // ✅ 新逻辑：前5条按幸福程度排序，之后按时间倒序
  const happyDiaries = useMemo(() => {
    const filtered = localDiaries.filter((d) =>
      isHappyEmotion(d.emotion_data?.emotion)
    );
    
    if (filtered.length <= 5) {
      // 如果总数≤5条，全部按幸福程度排序
      return filtered.sort((a, b) => {
        const emotionA = a.emotion_data?.emotion;
        const emotionB = b.emotion_data?.emotion;
        
        const happinessOrder: Record<string, number> = {
          'Joyful': 5,
          'Loved': 4,
          'Fulfilled': 3,
          'Excited': 2,
          'Proud': 1,
        };
        
        const scoreA = happinessOrder[emotionA || ''] || 0;
        const scoreB = happinessOrder[emotionB || ''] || 0;
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    
    // 按幸福程度排序（用于选出前5条）
    const sortedByHappiness = [...filtered].sort((a, b) => {
      const emotionA = a.emotion_data?.emotion;
      const emotionB = b.emotion_data?.emotion;
      
      const happinessOrder: Record<string, number> = {
        'Joyful': 5,
        'Loved': 4,
        'Fulfilled': 3,
        'Excited': 2,
        'Proud': 1,
      };
      
      const scoreA = happinessOrder[emotionA || ''] || 0;
      const scoreB = happinessOrder[emotionB || ''] || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // 取前5条最幸福的
    const top5 = sortedByHappiness.slice(0, 5);
    const top5Ids = new Set(top5.map(d => d.diary_id));
    
    // 剩余的按时间倒序排序
    const rest = filtered
      .filter(d => !top5Ids.has(d.diary_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return [...top5, ...rest];
  }, [localDiaries]);


  // ✅ 2. 入场动画序列（有仪式感的动画）
  useEffect(() => {
    // ✅ 立即显示列表容器（不等待动画）
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 0, // 立即显示，不延迟
      useNativeDriver: true,
    }).start();

    // 阶段1: 图标淡入 + 缩放 (0-400ms)
    Animated.parallel([
      Animated.timing(iconFadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 图标淡入完成后，开始摇晃 (400-800ms)
      const swayAnimation = Animated.sequence([
        Animated.timing(iconSwayAnim, {
          toValue: -8,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconSwayAnim, {
          toValue: 8,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconSwayAnim, {
          toValue: -8,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconSwayAnim, {
          toValue: 8,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconSwayAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
      swayAnimation.start();
    });

    // 阶段2: 标题和副标题渐入 (600-1400ms)
    Animated.parallel([
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          delay: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          delay: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 600,
          delay: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          delay: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // 3. ✅ 导航栏标题透明度：滚动 50px 后完全显示
  const navTitleOpacity = scrollY.interpolate({
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

  // ✅ 渲染日记卡片（使用统一的 DiaryCard 组件 + 视差动画）
  const renderItem = ({ item, index }: { item: Diary; index: number }) => {
    const totalDuration = duration.get(item.diary_id) || item.audio_duration || 0;

    // ✅ 为每张卡片创建动画值（如果还没有）
    if (!cardAnimationsRef.has(item.diary_id)) {
      cardAnimationsRef.set(item.diary_id, {
        translateY: new Animated.Value(50),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.95),
      });
    }

    const cardAnim = cardAnimationsRef.get(item.diary_id)!;
    const delay = 1000 + index * 100; // ✅ 视差效果：第一张1000ms，后续每张延迟100ms

    // ✅ 启动卡片动画（只执行一次，使用 useRef 跟踪）
    if (!animatedCardsRef.has(item.diary_id)) {
      animatedCardsRef.add(item.diary_id);
      Animated.parallel([
        Animated.timing(cardAnim.translateY, {
          toValue: 0,
          duration: 600,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim.opacity, {
          toValue: 1,
          duration: 600,
          delay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim.scale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // ✅ 应用动画样式
    const cardAnimatedStyle = {
      transform: [
        { translateY: cardAnim.translateY },
        { scale: cardAnim.scale },
      ],
      opacity: cardAnim.opacity,
    };

    return (
      <Animated.View style={cardAnimatedStyle}>
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
      </Animated.View>
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
        backgroundColor="#FFD2A6"
        translucent={false}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
                  opacity: navTitleOpacity,
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
                  {/* ✅ 插图（带摇晃动画） */}
                  <Animated.View
                    style={[
                      styles.illustrationContainer,
                      {
                        opacity: iconFadeAnim,
                        transform: [
                          { scale: iconScaleAnim },
                          {
                            rotate: iconSwayAnim.interpolate({
                              inputRange: [-8, 8],
                              outputRange: ['-8deg', '8deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <HappinessIllustration
                      width={ILLUSTRATION_WIDTH}
                      height={ILLUSTRATION_HEIGHT}
                    />
                  </Animated.View>
                  
                  {/* ✅ 标题（带滑入动画） */}
                  <Animated.Text
                    style={[
                      styles.headerTitle,
                      {
                        fontFamily: headerTitleFont,
                        opacity: titleOpacity,
                        transform: [{ translateY: titleTranslateY }],
                      },
                    ]}
                  >
                    {headerTitle}
                  </Animated.Text>
                  
                  {/* ✅ 描述文案（带滑入动画） */}
                  <Animated.Text
                    style={[
                      styles.headerDescription,
                      {
                        fontFamily: headerDescFont,
                        opacity: subtitleOpacity,
                        transform: [{ translateY: subtitleTranslateY }],
                      },
                    ]}
                  >
                    {headerDescription}
                  </Animated.Text>
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
    backgroundColor: '#FFCF9E', // ✅ 暖橙色背景
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
    backgroundColor: '#FFCF9E', // ✅ 与页面背景一致的暖橙色
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
    paddingBottom: 20, // ✅ 底部留出一些空间，避免内容贴底（沉浸式显示）
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
