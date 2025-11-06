/**
 * Onboarding分页指示器组件
 *
 * 设计理念：简洁、优雅、不打扰
 * 显示当前页面位置，帮助用户理解进度
 */
import React from "react";
import { View, StyleSheet } from "react-native";

interface OnboardingPaginationProps {
  total: number; // 总页数
  current: number; // 当前页（从0开始）
}

export default function OnboardingPagination({
  total,
  current,
}: OnboardingPaginationProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#E56C45", // 主题色
    width: 24, // 活跃状态更长
  },
  dotInactive: {
    backgroundColor: "#F2E2C2", // 灰色
  },
});
