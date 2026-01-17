/**
 * 搜索页面
 * 
 * 功能：
 * - 全屏搜索页面
 * - 左对齐搜索框 + Cancel 按钮
 * - 显示搜索结果列表（使用 DiaryCard 组件）
 * - 支持关键词高亮
 * - 支持音频播放
 * - 支持图片预览
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  createAudioPlayer,
  type AudioPlayer as ExpoAudioPlayer,
} from "expo-audio";  // ✅ 使用新的 expo-audio API
import { Audio } from "expo-av";  // ✅ For setAudioModeAsync
import SearchIcon from "../assets/icons/searchIcon.svg";
import { t } from "../i18n";
import { getFontFamilyForText } from "../styles/typography";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import { DiaryCard } from "../components/DiaryCard";
import { searchDiaries } from "../services/diaryService";
import ImagePreviewModal from "../components/ImagePreviewModal";
import DiaryDetailScreen from "./DiaryDetailScreen";
import { formatDateTime } from "../utils/dateFormat"; // ✅ 重新导入日期格式化工具
import { searchEmotionsByKeyword } from "../utils/emotionSearch";  // ✅ 导入情绪搜索工具
import { useDiaryAudio } from "../hooks/useDiaryAudio"; // ✅ 使用顶级统一标准 Hook

interface Diary {
  diary_id: string;
  title: string;
  original_content: string;
  polished_content: string;
  created_at: string;
  image_urls?: string[];
  audio_url?: string;
  audio_duration?: number;
  language?: string;
  emotion_data?: {
    emotion: string;
    [key: string]: any;
  };
  date: string;
}

interface SearchScreenProps {
  route: {
    params: {
      diaries: Diary[];
    };
  };
}

export default function SearchScreen({ route }: SearchScreenProps) {
  const navigation = useNavigation();
  const searchInputRef = useRef<TextInput>(null);

  // 使用统一的顶级标准音频 Hook ✅
  const {
    currentPlayingId,
    currentTimeMap: currentTime,
    durationMap: duration,
    hasPlayedOnceSet: hasPlayedOnce,
    handlePlayAudio,
    handleSeek,
    stopAllAudio,
  } = useDiaryAudio();


  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Diary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 图片预览状态
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  // 日记详情状态
  const [diaryDetailVisible, setDiaryDetailVisible] = useState(false);
  const [selectedDiaryForDetail, setSelectedDiaryForDetail] = useState<Diary | null>(null);

  const diaries = route.params?.diaries || [];

  // 自动聚焦搜索框
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    return () => {
      stopAllAudio(); // ✅ 使用 Hook 提供的清理函数
    };
  }, [stopAllAudio]);


  // 搜索逻辑（文字 + 情绪）
  const performSearch = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const lowercaseQuery = query.toLowerCase();

      // ========== 1. 文字匹配（优先级最高）==========
      const textMatches = diaries.filter((diary) => {
        const title = (diary.title || "").toLowerCase();
        const originalContent = (diary.original_content || "").toLowerCase();
        const polishedContent = (diary.polished_content || "").toLowerCase();

        return (
          title.includes(lowercaseQuery) ||
          originalContent.includes(lowercaseQuery) ||
          polishedContent.includes(lowercaseQuery)
        );
      });

      // ========== 2. 情绪匹配（次优先）==========
      const matchedEmotions = searchEmotionsByKeyword(query);
      const emotionMatches = matchedEmotions.length > 0
        ? diaries.filter((diary) => {
            // 排除已经被文字匹配的日记
            const isAlreadyMatched = textMatches.some(
              (d) => d.diary_id === diary.diary_id
            );
            if (isAlreadyMatched) return false;

            // 检查情绪是否匹配
            return (
              diary.emotion_data?.emotion &&
              matchedEmotions.includes(diary.emotion_data.emotion as any)
            );
          })
        : [];

      console.log(`🔍 搜索 "${query}":`);
      console.log(`  📝 文字匹配: ${textMatches.length} 条`);
      console.log(`  😊 情绪匹配: ${emotionMatches.length} 条 (${matchedEmotions.join(", ")})`);

      // ========== 3. 后端搜索（补充）==========
      let backendResults: Diary[] = [];
      const totalLocalResults = textMatches.length + emotionMatches.length;
      if (totalLocalResults < 10) {
        try {
          backendResults = await searchDiaries(query);
        } catch (error) {
          console.warn("后端搜索失败", error);
        }
      }

      // ========== 4. 合并去重 ==========
      const seen = new Set<string>();
      const merged: Diary[] = [];

      // 按优先级合并：文字匹配 > 情绪匹配 > 后端结果
      for (const diary of [...textMatches, ...emotionMatches, ...backendResults]) {
        if (!seen.has(diary.diary_id)) {
          seen.add(diary.diary_id);
          merged.push(diary);
        }
      }

      // ========== 5. 分组排序 ==========
      // 文字匹配内部按时间排序
      const sortedTextMatches = textMatches.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // 情绪匹配内部按时间排序
      const sortedEmotionMatches = emotionMatches.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // 后端结果按时间排序
      const sortedBackendResults = backendResults
        .filter((d) => !seen.has(d.diary_id) || 
          textMatches.some((t) => t.diary_id === d.diary_id) ||
          emotionMatches.some((e) => e.diary_id === d.diary_id)
        )
        .sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      // 最终结果：文字匹配 + 情绪匹配 + 后端结果
      const finalResults = [
        ...sortedTextMatches,
        ...sortedEmotionMatches,
        ...sortedBackendResults.filter(
          (d) =>
            !textMatches.some((t) => t.diary_id === d.diary_id) &&
            !emotionMatches.some((e) => e.diary_id === d.diary_id)
        ),
      ];

      setSearchResults(finalResults);
    } catch (error) {
      console.error("搜索失败", error);
    } finally {
      setIsSearching(false);
    }
  };


  // 处理搜索输入
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (text.trim() === "") {
      setSearchResults([]);
      setIsSearching(false);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text.trim());
    }, 300);
  };

  // 清空搜索
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    searchInputRef.current?.focus();
  };

  // 返回
  const handleCancel = () => {
    Keyboard.dismiss();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // 如果没有返回层级，则返回首页
      (navigation as any).navigate("DiaryList");
    }
  };

  // 渲染日记卡片
  const renderDiaryCard = ({ item, index }: { item: Diary; index: number }) => {
    const displayDate = formatDateTime(item.date);
    const totalDuration = duration.get(item.diary_id) || item.audio_duration || 0;

    return (
      <DiaryCard
        diary={item}
        index={index}
        totalCount={searchResults.length}
        searchQuery={searchQuery}
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
          // ✅ 使用 modal 显示详情
          setSelectedDiaryForDetail(item);
          setDiaryDetailVisible(true);
        }}
        showOptions={false} // 搜索页不显示三点菜单
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 搜索栏 */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrapper}>
          <SearchIcon width={20} height={20} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              {
                fontFamily: getFontFamilyForText(
                  searchQuery || t("search.placeholder"),
                  "regular"
                ),
              },
            ]}
            placeholder={t("search.placeholder")}
            placeholderTextColor="#B8A89D"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#B8A89D" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text
            style={[
              styles.cancelText,
              {
                fontFamily: getFontFamilyForText(t("search.cancel"), "regular"),
              },
            ]}
          >
            {t("search.cancel")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 搜索结果 */}
      <View style={styles.resultsContainer}>
        {/* 结果标题 */}
        {searchQuery.trim() !== "" && !isSearching && (
          <View style={styles.resultsTitleContainer}>
            <PreciousMomentsIcon width={20} height={20} />
            <Text 
              style={[
                styles.resultsTitle,
                { fontFamily: getFontFamilyForText(t("search.matchingEntriesSuffix"), "regular") }
              ]}
            >
              {searchResults.length > 0 ? (
                <>
                  {t("search.matchingEntriesPrefix") ? (
                    <Text>{t("search.matchingEntriesPrefix")}{" "}</Text>
                  ) : null}
                  <Text
                    style={[
                      styles.resultsCount,
                      {
                        fontFamily: getFontFamilyForText(
                          searchResults.length.toString(),
                          "bold"
                        ),
                      },
                    ]}
                  >
                    {searchResults.length}
                  </Text>
                  {t("search.matchingEntriesSuffix")}
                </>
              ) : (
                t("search.noResultsTitle")
              )}
            </Text>
          </View>
        )}

        {/* 搜索中 */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#80645A" />
            <Text style={styles.loadingText}>{t("search.searching")}</Text>
          </View>
        )}

        {/* 搜索结果列表 */}
        {!isSearching && searchQuery.trim() !== "" && (
          <FlatList
            data={searchResults}
            renderItem={renderDiaryCard}
            keyExtractor={(item) => item.diary_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* 图片预览 */}
      <ImagePreviewModal
        visible={imagePreviewVisible}
        images={imagePreviewUrls}
        initialIndex={imagePreviewIndex}
        onClose={() => setImagePreviewVisible(false)}
      />

      {/* 日记详情 */}
      {diaryDetailVisible && selectedDiaryForDetail && (
        <DiaryDetailScreen
          diaryId={selectedDiaryForDetail.diary_id}
          onClose={() => {
            setDiaryDetailVisible(false);
            setSelectedDiaryForDetail(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 38, // 略微增加高度确保图标不裁剪
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#332824",
    paddingVertical: 0,
    paddingLeft: 0,
    height: "100%",
  },
  clearButton: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 16,
    color: "#E56C45",
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  resultsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 15,
    color: "#80645A",
  },
  resultsCount: {
    color: "#FF6B35",
    fontWeight: "bold",
    fontSize: 14, // ✅ 再降 1px 达到精致平衡
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  loadingText: {
    fontSize: 14,
    color: "#80645A",
  },
  listContent: {
    paddingBottom: 24,
  },
});
