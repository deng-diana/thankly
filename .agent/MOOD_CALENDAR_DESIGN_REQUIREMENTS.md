# 🎨 情绪日历页面设计需求 - 参考图一效果

**需求时间**: 2026-01-26  
**参考**: 图一效果

---

## 📋 需求复述与确认

### ✅ 需求 1: 日期文字颜色 - 必须是黑色
**当前问题**: 日期文字是白色，看不清楚  
**需求**: 
- 所有日期（1号到31号）必须是**黑色文字**
- 确保在任何背景下都清晰可读

### ✅ 需求 2: 有记录的日期背景 - 使用圆形，可重叠
**当前问题**: 使用填满的矩形背景  
**需求**:
- 使用**圆形**作为日期背景（不是矩形）
- 圆形**不要填满**整个单元格，留出边距
- 如果一天有多条日记，可以**重叠显示**
- 重叠时可以**稍微错开位置**（offset），形成层次感

### ✅ 需求 3: 年份位置 - 靠左对齐
**当前问题**: 年份居中显示  
**需求**:
- 年份（如 "2026-01"）**靠左对齐**
- 不是居中显示

### ✅ 需求 4: 左右箭头 - 放在一起
**当前问题**: 左右箭头分开在两端  
**需求**:
- 左右箭头（`<` 和 `>`）**放在一起**
- 不是分开在两端

---

## 🔍 当前实现分析

### 当前问题

1. **日期文字颜色**:
   - 当前：`cellDayWithBackground: { color: "#FFFFFF" }` - 白色
   - 需要：改为黑色 `#1A1A1A`

2. **日期背景样式**:
   - 当前：使用 `cellInner` 填满整个单元格，`borderRadius: 8`（圆角矩形）
   - 需要：改为圆形，不填满，可重叠

3. **年份位置**:
   - 当前：`monthNav` 使用 `justifyContent: "space-between"`，年份居中
   - 需要：年份靠左，箭头放在一起

4. **重叠显示**:
   - 当前：只使用第一个颜色 `colors[0]`
   - 需要：显示多个圆形，可以重叠和错开

---

## ✅ 修复方案

### 方案 1: 修改日期文字颜色为黑色
```typescript
cellDayWithBackground: {
  color: "#1A1A1A", // ✅ 改为黑色，确保可读性
}
```

### 方案 2: 使用圆形背景，不填满
```typescript
// 移除 cellInner 的填满背景
// 改为使用圆形，大小约为单元格的 70-80%
const CIRCLE_SIZE = Math.floor(CELL_SIZE * 0.75); // 75% 大小
```

### 方案 3: 支持多个圆形重叠显示
```typescript
// 显示所有颜色（最多3个），可以重叠
{colors.map((colorData, index) => (
  <View
    key={index}
    style={{
      position: "absolute",
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      backgroundColor: colorData.rgba,
      // ✅ 错开位置：每个圆形稍微偏移
      left: index * CIRCLE_OFFSET,
      top: index * CIRCLE_OFFSET,
    }}
  />
))}
```

### 方案 4: 年份靠左，箭头放在一起
```typescript
monthNav: {
  flexDirection: "row",
  alignItems: "center",
  // ✅ 改为左对齐
  justifyContent: "flex-start",
  gap: 12, // ✅ 箭头之间的间距
}
```

---

**等待确认后开始实施！** 🚀
