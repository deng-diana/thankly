/**
 * Circle Share Selector - 圈子分享选择器
 * 
 * 用途：
 * 1. 新建日记时选择分享到哪些圈子
 * 2. 已有日记的操作菜单中"分享到圈子"
 * 
 * 功能：
 * - 显示用户的所有圈子
 * - 多选分享目标
 * - 查询并显示已分享状态
 * - 支持取消分享
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { getFontFamilyForText } from '../styles/typography';
import {
  getMyCircles,
  shareDiary,
  unshareDiary,
  getDiaryShares,
  handleCircleError,
} from '../services/circleService';
import type { Circle } from '../types/circle';

const { width } = Dimensions.get('window');

interface CircleShareSelectorProps {
  visible: boolean;
  onClose: () => void;
  diaryId?: string; // 如果提供，则查询已分享状态；否则为新建日记
  onShareComplete?: (sharedCircleIds: string[]) => void;
}

export default function CircleShareSelector({
  visible,
  onClose,
  diaryId,
  onShareComplete,
}: CircleShareSelectorProps) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(new Set());
  const [initialSharedIds, setInitialSharedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 加载圈子列表和已分享状态
  const loadCircles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyCircles();
      setCircles(data);

      // 如果是已有日记，查询已分享状态
      if (diaryId) {
        const shares = await getDiaryShares(diaryId);
        const sharedIds = new Set(shares.map(s => s.circleId));
        setSelectedCircleIds(sharedIds);
        setInitialSharedIds(sharedIds);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(t('circle.errors.loadFailed'), message);
    } finally {
      setLoading(false);
    }
  }, [diaryId]);

  // Modal 打开时加载数据
  useEffect(() => {
    if (visible) {
      loadCircles();
    } else {
      // Modal 关闭时重置状态 (with cleanup to prevent memory leak)
      const timer = setTimeout(() => {
        setCircles([]);
        setSelectedCircleIds(new Set());
        setInitialSharedIds(new Set());
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [visible, loadCircles]);

  // 切换圈子选中状态
  const toggleCircle = (circleId: string) => {
    setSelectedCircleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(circleId)) {
        newSet.delete(circleId);
      } else {
        newSet.add(circleId);
      }
      return newSet;
    });
  };

  // 提交分享
  const handleSubmit = async () => {
    if (!diaryId) {
      // 新建日记：直接返回选中的圈子 ID
      onShareComplete?.(Array.from(selectedCircleIds));
      onClose();
      return;
    }

    // 已有日记：计算需要添加/移除的分享
    const toAdd = Array.from(selectedCircleIds).filter(id => !initialSharedIds.has(id));
    const toRemove = Array.from(initialSharedIds).filter(id => !selectedCircleIds.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      // 没有变化
      onClose();
      return;
    }

    setSubmitting(true);

    try {
      // 并行执行添加和移除操作
      const operations = [
        ...toAdd.map(circleId => shareDiary(diaryId, circleId)),
        ...toRemove.map(circleId => unshareDiary(diaryId, circleId)),
      ];

      await Promise.all(operations);

      Alert.alert(
        t('common.success'),
        t('circle.shareSuccess'),
        [{ text: t('common.ok') }]
      );

      onShareComplete?.(Array.from(selectedCircleIds));
      onClose();
    } catch (error: unknown) {
      const errorMessage = handleCircleError(error);
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染圈子选项
  const renderCircleItem = (circle: Circle) => {
    const isSelected = selectedCircleIds.has(circle.circleId);

    return (
      <TouchableOpacity
        key={circle.circleId}
        style={[styles.circleItem, isSelected && styles.circleItemSelected]}
        onPress={() => toggleCircle(circle.circleId)}
        activeOpacity={0.7}
      >
        <View style={styles.circleInfo}>
          <View style={[styles.circleIcon, isSelected && styles.circleIconSelected]}>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'people-outline'}
              size={24}
              color={isSelected ? '#4CAF50' : '#80645A'}
            />
          </View>
          <View style={styles.circleText}>
            <Text
              style={[
                styles.circleName,
                {
                  fontFamily: getFontFamilyForText(circle.name, 'semibold'),
                },
              ]}
              numberOfLines={1}
            >
              {circle.name}
            </Text>
            <Text
              style={[
                styles.circleMeta,
                {
                  fontFamily: getFontFamilyForText(
                    `${circle.memberCount} ${t('circle.common.members')}`,
                    'regular'
                  ),
                },
              ]}
            >
              {circle.memberCount} {t('circle.common.members')}
            </Text>
          </View>
        </View>

        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={20} color="#4CAF50" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#332824" />
            </TouchableOpacity>
            <Text
              style={[
                styles.headerTitle,
                {
                  fontFamily: getFontFamilyForText(
                    t('circle.shareToCircle'),
                    'semibold'
                  ),
                },
              ]}
            >
              {t('circle.shareToCircle')}
            </Text>
            <View style={styles.headerRight} />
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#332824" />
            </View>
          ) : circles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#B8A49A" />
              <Text
                style={[
                  styles.emptyTitle,
                  {
                    fontFamily: getFontFamilyForText(
                      t('circle.share.noCircles'),
                      'semibold'
                    ),
                  },
                ]}
              >
                {t('circle.share.noCircles')}
              </Text>
              <Text
                style={[
                  styles.emptyHint,
                  {
                    fontFamily: getFontFamilyForText(
                      t('circle.share.noCirclesHint'),
                      'regular'
                    ),
                  },
                ]}
              >
                {t('circle.share.noCirclesHint')}
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.circleList}>
                  {circles.map(renderCircleItem)}
                </View>

                {selectedCircleIds.size > 0 && (
                  <Text
                    style={[
                      styles.selectionHint,
                      {
                        fontFamily: getFontFamilyForText(
                          t('circle.share.selectedCount', {
                            count: selectedCircleIds.size,
                          }),
                          'regular'
                        ),
                      },
                    ]}
                  >
                    {t('circle.share.selectedCount', {
                      count: selectedCircleIds.size,
                    })}
                  </Text>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    submitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.submitButtonText,
                        {
                          fontFamily: getFontFamilyForText(
                            t('common.confirm'),
                            'medium'
                          ),
                        },
                      ]}
                    >
                      {t('common.confirm')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE5',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: '#332824',
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    color: '#332824',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#80645A',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    maxHeight: 400,
  },
  circleList: {
    padding: 20,
  },
  circleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF6ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circleItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
  },
  circleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  circleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  circleIconSelected: {
    backgroundColor: '#E8F5E9',
  },
  circleText: {
    flex: 1,
  },
  circleName: {
    fontSize: 16,
    color: '#332824',
    marginBottom: 4,
  },
  circleMeta: {
    fontSize: 13,
    color: '#80645A',
  },
  checkmark: {
    marginLeft: 12,
  },
  selectionHint: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE5',
  },
  submitButton: {
    height: 56,
    backgroundColor: '#332824',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#B8A49A',
  },
  submitButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
