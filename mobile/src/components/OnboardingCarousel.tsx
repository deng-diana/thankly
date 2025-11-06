/**
 * Onboarding轮播容器
 * 实现左右滑动切换引导页
 * 
 * 使用 FlatList 的水平滚动实现平滑的页面切换
 */
import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingScreen1 from "../screens/OnboardingScreen1";
import OnboardingScreen2 from "../screens/OnboardingScreen2";
import OnboardingScreen3 from "../screens/OnboardingScreen3";
import OnboardingPagination from "./OnboardingPagination";

const { width } = Dimensions.get("window");

export default function OnboardingCarousel() {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const screens = [
    { id: "1", component: OnboardingScreen1 },
    { id: "2", component: OnboardingScreen2 },
    { id: "3", component: OnboardingScreen3 },
  ];

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item }: { item: typeof screens[0] }) => {
    const ScreenComponent = item.component;
    return (
      <View style={styles.screenContainer}>
        <ScreenComponent />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={screens}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="center"
      />
      {/* 只在不是最后一页时显示分页指示器 */}
      {currentIndex < screens.length - 1 && (
        <View style={styles.paginationContainer}>
          <OnboardingPagination total={screens.length} current={currentIndex} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
  },
  screenContainer: {
    width: width,
    flex: 1,
  },
  paginationContainer: {
    position: "absolute",
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
});

