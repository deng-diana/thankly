/**
 * 记录图标 - SVG组件
 * 
 * 设计：简洁的笔记本/记录本图标
 */
import React from "react";
import Svg, { Path, Rect, Circle } from "react-native-svg";

interface RecordIconProps {
  width?: number;
  height?: number;
}

export default function RecordIcon({
  width = 120,
  height = 120,
}: RecordIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" fill="none">
      {/* 笔记本 */}
      <Rect
        x="30"
        y="25"
        width="60"
        height="80"
        rx="4"
        stroke="#1A1A1A"
        strokeWidth="3"
        fill="none"
      />
      {/* 装订线 */}
      <Path
        d="M40 25V105"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 线条 */}
      <Path
        d="M50 45H85"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M50 60H85"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M50 75H75"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 橙色圆点装饰 */}
      <Circle cx="95" cy="30" r="8" fill="#E56C45" />
    </Svg>
  );
}

