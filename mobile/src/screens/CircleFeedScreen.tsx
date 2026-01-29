/**
 * 圈子动态流页面
 *
 * 设计理念:
 * - 展示圈子中所有成员分享的日记
 * - 支持分页加载
 * - 空状态引导用户分享日记
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

// Components
import CircleFeedCard from '../components/CircleFeedCard';

// Services & Utils
import { t } from '../i18n';
import { getFontFamilyForText, getTypography } from '../styles/typography';
import { handleAuthErrorOnly } from '../utils/errorHandler';
import { getCircleFeed } from '../services/circleService';
import type { CircleFeedItem } from '../types/circle';

type CircleFeedScreenRouteProp = RouteProp<RootStackParamList, 'CircleFeed'>;

/**
 * 圈子动态流页面组件
 */
export default function CircleFeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CircleFeedScreenRouteProp>();
  const typography = getTypography();

  const { circleId, circleName } = route.params;

  // ========== 状态管理 ==========
  const [feedItems, setFeedItems] = useState<CircleFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastKey, setLastKey] = useState<string | undefined>(undefined);

  // ========== 数据加载 ==========
  const loadFeed = async (isRefresh: boolean = false, loadMore: boolean = false) => {
    if (loadMore) {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    } else if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getCircleFeed(
        circleId,
        20,
        loadMore ? lastKey : undefined
      );

      if (loadMore) {
        setFeedItems((prev) => [...prev, ...result.items]);
      } else {
        setFeedItems(result.items);
      }

      setLastKey(result.lastKey);
      setHasMore(!!result.lastKey);
    } catch (error: any) {
      handleAuthErrorOnly(error, navigation);
      Alert.alert(
        t('circle.errors.loadFailed'),
        error.message || t('circle.errors.networkError')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      loadFeed();
    }, [circleId])
  );

  // 下拉刷新
  const handleRefresh = () => {
    setLastKey(undefined);
    setHasMore(true);
    loadFeed(true);
  };

  // 加载更多
  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadFeed(false, true);
    }
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

      <View style={styles.headerCenter}>
        <Text
          style={[
            styles.headerTitle,
            {
              fontFamily: getFontFamilyForText(circleName, 'semibold'),
            },
          ]}
          numberOfLines={1}
        >
          {circleName}
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            {
              fontFamily: getFontFamilyForText(t('circle.circleFeed'), 'regular'),
            },
          ]}
        >
          {t('circle.circleFeed')}
        </Text>
      </View>

      <View style={styles.headerRight} />
    </View>
  );

  const renderFeedItem = ({ item }: { item: CircleFeedItem }) => (
    <CircleFeedCard item={item} />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#332824" />
        <Text
          style={[
            styles.footerText,
            {
              fontFamily: getFontFamilyForText(t('circle.loadMore'), 'regular'),
            },
          ]}
        >
          {t('circle.loadMore')}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="heart-outline" size={64} color="#B8A49A" />
        </View>
        <Text
          style={[
            styles.emptyTitle,
            {
              fontFamily: getFontFamilyForText(t('circle.noFeed'), 'semibold'),
            },
          ]}
        >
          {t('circle.noFeed')}
        </Text>
        <Text
          style={[
            styles.emptyHint,
            {
              fontFamily: getFontFamilyForText(t('circle.noFeedHint'), 'regular'),
            },
          ]}
        >
          {t('circle.noFeedHint')}
        </Text>
      </View>
    );
  };

  // ========== 主渲染 ==========
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderHeader()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#332824" />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.shareId}
          contentContainerStyle={[
            styles.listContent,
            feedItems.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#332824']}
              tintColor="#332824"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#332824',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#80645A',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
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
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#80645A',
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
