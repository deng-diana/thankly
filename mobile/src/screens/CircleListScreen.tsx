/**
 * 亲密圈列表页面
 *
 * 设计理念:
 * - 顶部显示标题和操作按钮
 * - 中间是圈子卡片列表，每张卡片显示圈子名称、成员数、最新动态
 * - 首次进入显示引导Modal
 * - 支持下拉刷新
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

// Components
import CircleOnboarding from '../components/CircleOnboarding';

// Services & Utils
import { t } from '../i18n';
import { getFontFamilyForText, getTypography } from '../styles/typography';
import { handleAuthErrorOnly } from '../utils/errorHandler';
import { getMyCircles } from '../services/circleService';
import type { Circle } from '../types/circle';

const { width } = Dimensions.get('window');

/**
 * 圈子列表页面组件
 */
export default function CircleListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const typography = getTypography();

  // ========== 状态管理 ==========
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ========== 首次引导逻辑 ==========
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenCircleOnboarding');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasSeenCircleOnboarding', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // ========== 数据加载 ==========
  const loadCircles = async (isRefreshing: boolean = false) => {
    if (!isRefreshing) {
      setLoading(true);
    }

    try {
      const data = await getMyCircles();
      setCircles(data);
    } catch (error: any) {
      handleAuthErrorOnly(error, navigation);
      Alert.alert(
        t('circle.errors.loadFailed'),
        error.message || t('circle.errors.networkError')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      loadCircles();
    }, [])
  );

  // 下拉刷新
  const handleRefresh = () => {
    setRefreshing(true);
    loadCircles(true);
  };

  // ========== 操作处理 ==========
  const handleCreateCircle = () => {
    // TODO: Open CreateCircleModal
    Alert.alert(t('circle.create.title'), 'CreateCircleModal - To be implemented');
  };

  const handleJoinCircle = () => {
    // TODO: Open JoinCircleModal
    Alert.alert(t('circle.join.title'), 'JoinCircleModal - To be implemented');
  };

  const handleCirclePress = (circle: Circle) => {
    navigation.navigate('CircleFeed', {
      circleId: circle.circleId,
      circleName: circle.name,
    });
  };

  // ========== 渲染函数 ==========
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#332824" />
      </TouchableOpacity>

      <Text
        style={[
          styles.headerTitle,
          {
            fontFamily: getFontFamilyForText(t('circle.list.title'), 'semibold'),
          },
        ]}
      >
        {t('circle.list.title')}
      </Text>

      <View style={styles.headerRight} />
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreateCircle}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text
          style={[
            styles.createButtonText,
            {
              fontFamily: getFontFamilyForText(t('circle.create.button'), 'medium'),
            },
          ]}
        >
          {t('circle.create.button')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.joinButton}
        onPress={handleJoinCircle}
      >
        <Ionicons name="enter-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.joinButtonText,
            {
              fontFamily: getFontFamilyForText(t('circle.join.button'), 'medium'),
            },
          ]}
        >
          {t('circle.join.button')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCircleCard = ({ item }: { item: Circle }) => (
    <TouchableOpacity
      style={styles.circleCard}
      onPress={() => handleCirclePress(item)}
      activeOpacity={0.7}
    >
      {/* Circle Icon */}
      <View style={styles.circleIconContainer}>
        <Ionicons name="people" size={28} color="#332824" />
      </View>

      {/* Circle Info */}
      <View style={styles.circleInfo}>
        <Text
          style={[
            styles.circleName,
            {
              fontFamily: getFontFamilyForText(item.name, 'semibold'),
            },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        <View style={styles.circleMetaRow}>
          <View style={styles.circleMeta}>
            <Ionicons name="people-outline" size={14} color="#80645A" />
            <Text
              style={[
                styles.circleMetaText,
                {
                  fontFamily: getFontFamilyForText(
                    `${item.memberCount} ${t('circle.common.members')}`,
                    'regular'
                  ),
                },
              ]}
            >
              {item.memberCount} {t('circle.common.members')}
            </Text>
          </View>

          <View style={styles.circleMeta}>
            <Ionicons name="time-outline" size={14} color="#80645A" />
            <Text
              style={[
                styles.circleMetaText,
                {
                  fontFamily: getFontFamilyForText(
                    formatRelativeTime(item.createdAt),
                    'regular'
                  ),
                },
              ]}
            >
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </View>

        {item.role === 'owner' && (
          <View style={styles.ownerBadge}>
            <Text
              style={[
                styles.ownerBadgeText,
                {
                  fontFamily: getFontFamilyForText(t('circle.common.owner'), 'medium'),
                },
              ]}
            >
              {t('circle.common.owner')}
            </Text>
          </View>
        )}
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={20} color="#B8A49A" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={64} color="#B8A49A" />
      </View>
      <Text
        style={[
          styles.emptyTitle,
          {
            fontFamily: getFontFamilyForText(t('circle.list.emptyTitle'), 'semibold'),
          },
        ]}
      >
        {t('circle.list.emptyTitle')}
      </Text>
      <Text
        style={[
          styles.emptyHint,
          {
            fontFamily: getFontFamilyForText(t('circle.list.emptyHint'), 'regular'),
          },
        ]}
      >
        {t('circle.list.emptyHint')}
      </Text>
    </View>
  );

  // ========== 主渲染 ==========
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderHeader()}
      {renderActionButtons()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#332824" />
        </View>
      ) : (
        <FlatList
          data={circles}
          renderItem={renderCircleCard}
          keyExtractor={(item) => item.circleId}
          contentContainerStyle={[
            styles.listContent,
            circles.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#332824']}
              tintColor="#332824"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Onboarding Modal */}
      <CircleOnboarding
        visible={showOnboarding}
        onComplete={completeOnboarding}
        onCreateCircle={() => {
          completeOnboarding();
          handleCreateCircle();
        }}
        onJoinCircle={() => {
          completeOnboarding();
          handleJoinCircle();
        }}
      />
    </SafeAreaView>
  );
}

// ========== 辅助函数 ==========
function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t('circle.common.today');
  } else if (diffDays === 1) {
    return t('circle.common.yesterday');
  } else if (diffDays < 7) {
    return t('circle.common.daysAgo', { count: diffDays });
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return t('circle.common.weeksAgo', { count: weeks });
  } else {
    const months = Math.floor(diffDays / 30);
    return t('circle.common.monthsAgo', { count: months });
  }
}

// ========== 样式 ==========
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF6ED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAF6ED',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    color: '#332824',
  },
  headerRight: {
    width: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#332824',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5D9C8',
  },
  joinButtonText: {
    fontSize: 16,
    color: '#332824',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 2,
  },
  circleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFE699',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  circleInfo: {
    flex: 1,
    gap: 6,
  },
  circleName: {
    fontSize: 18,
    color: '#332824',
  },
  circleMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  circleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  circleMetaText: {
    fontSize: 13,
    color: '#80645A',
  },
  ownerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE699',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 11,
    color: '#332824',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#332824',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 16,
    color: '#80645A',
    textAlign: 'center',
    lineHeight: 24,
  },
});
