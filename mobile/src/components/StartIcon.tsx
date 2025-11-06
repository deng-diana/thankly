/**
 * 开始图标 - SVG组件
 * 
 * 设计：简洁的开始/播放图标
 */
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface StartIconProps {
  width?: number;
  height?: number;
}

export default function StartIcon({
  width = 120,
  height = 120,
}: StartIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" fill="none">
      {/* 圆形背景 */}
      <Circle
        cx="60"
        cy="60"
        r="40"
        stroke="#1A1A1A"
        strokeWidth="3"
        fill="none"
      />
      {/* 播放/开始三角形 */}
      <Path
        d="M50 45L50 75L75 60L50 45Z"
        fill="#1A1A1A"
      />
      {/* 橙色圆点装饰 */}
      <Circle cx="25" cy="25" r="8" fill="#E56C45" />
    </Svg>
  );
}






