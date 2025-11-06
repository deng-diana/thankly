/**
 * 语音图标 - SVG组件
 *
 * 设计：黑色线条画 + 橙色圆点
 * 简洁、现代、有温度
 */
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface VoiceIconProps {
  width?: number;
  height?: number;
}

export default function VoiceIcon({
  width = 120,
  height = 120,
}: VoiceIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" fill="none">
      {/* 麦克风主体 */}
      <Path
        d="M60 20C55.6 20 52 23.6 52 28V62C52 66.4 55.6 70 60 70C64.4 70 68 66.4 68 62V28C68 23.6 64.4 20 60 20Z"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 麦克风底座 */}
      <Path
        d="M60 70V80"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Path
        d="M50 80H70"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* 声波 */}
      <Path
        d="M45 50C45 50 42 54 42 60C42 66 45 70 45 70"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M75 50C75 50 78 54 78 60C78 66 75 70 75 70"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 橙色圆点装饰 */}
      <Circle cx="85" cy="35" r="8" fill="#E56C45" />
    </Svg>
  );
}
