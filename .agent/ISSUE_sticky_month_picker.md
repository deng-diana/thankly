# 首页吸顶年月 + 月份快速跳转（Sticky Year-Month Header + Month Picker）

**类型**: Feature  
**优先级**: Normal  
**工作量**: Medium  
**状态**: 待探索  

---

## TL;DR

在 Thankly 首页日记列表中，新增「吸顶年月栏」：随滚动显示当前可见区域对应的年份·月份；点击弹出月份选择 Modal，可快速跳转到指定月份的第一条日记。轻量、不打扰、符合微信级直觉。

---

## 一、功能目标（Product Goal）

- 用户**上下滚动**日记列表时，**页面顶部吸顶**显示当前滚动位置对应的「年份 · 月份」
- **点击**该时间区域 → 弹出「月份选择 Modal」
- 用户可**快速跳转**到指定月份的第一条日记
- 功能应**轻量、不打扰、不影响阅读流畅性**

---

## 二、吸顶时间显示（Sticky Header）

### 2.1 显示规则

- 显示**当前列表滚动位置中，最上方可见日记**的时间
- 精度：**年份 + 月份**
- Header **随滚动实时更新**
- Header **高度固定**，不随内容抖动

### 2.2 显示格式（i18n）

| 语言 | 格式 | 示例 |
|------|------|------|
| 中文 | `{{year}} 年 · {{month}} 月` | 2026 年 · 1 月 |
| 英文 | `{{month}} {{year}}`，月份**简写**（Jan / Feb / Mar …） | Jan 2026 |

需在 **i18n** 中新增/更新年月展示格式及英文月份简写（Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec）。

- **年份**：只显示用户**有日记记录**的年份；不显示空年份、不显示未来年份
- **月份**：只允许跳转到**有记录**的月份（Modal 中体现）

### 2.3 交互细节（UX）

- 吸顶 Header：滚动时可加**轻微 fade / translateY 动效**（可选），不抢内容焦点
- 文字与箭头间距：**8px**

### 2.4 视觉规范（按附图 + 需求）

| 属性 | 要求 |
|------|------|
| 高度 | **36px** |
| 背景色 | 与页面背景一致 **#FAF6ED** |
| 文字颜色 | 与日记时间一致 **#82665B** |
| 字号 | **14px** |
| 字体 | 使用**主题字体**（`getFontFamilyForText`） |
| 右侧箭头 | 颜色 **#82665B**，尺寸与字号相当，**outline 风格**（如 `chevron-down-outline`） |
| 文字与箭头间距 | **8px** |

---

## 三、点击交互（Month Picker Modal）

### 3.1 触发方式

- 点击吸顶的「年份 · 月份」区域
- 弹出**自底向上的 Modal**（Action Sheet / Bottom Sheet 风格）

### 3.2 Modal 结构

**年份（分组标题）**

- 只显示**用户有日记记录的年份**
- 若用户 2026 年才开始使用：不显示 2025、不显示未来年份，只显示 2026

**月份（可选择）**

- 每个年份下展示 **1–12 月**
- **有记录**的月份：可点击，样式正常
- **无记录**的月份：**置灰、禁用点击**

### 3.3 交互细节

- 月份点击反馈明确（**active / disabled 区分明显**）
- **禁止**出现「跳空白页」：仅可跳转到有日记的月份

---

## 四、数据与逻辑约束（Engineering）

### 4.1 数据来源

- 日记已有 `created_at`（ISO 字符串）
- 从中派生 `year`、`month`

### 4.2 年月数据结构（示例）

```ts
// 仅包含「实际有记录」的年月
{
  2026: [1, 2, 3],
  2025: [10, 11, 12]
}
```

### 4.3 其他约束

- **不改变**现有日记排序逻辑（仍按 `created_at` 降序）
- **不破坏**现有首页列表结构（FlatList、ListHeaderComponent、日记卡片等保持不变）

---

## 五、禁止事项（Important）

- ❌ 不显示没有日记的年份
- ❌ 不允许跳转到空月份
- ❌ 不使用技术格式（如 `2026-01` / `2026/01`）
- ❌ 不改变现有日记排序逻辑

---

## 六、验收标准（Done When）

- [ ] 滚动时，吸顶年月与**当前可见最上方日记**始终一致
- [ ] 点击年月 → 可**精准跳转**到对应月份的第一条日记
- [ ] 中英文格式**完全符合**规范（中文 `2026 年 · 1 月`，英文 `Jan 2026`，月份简写 Jan/Feb/Mar…）
- [ ] 首次使用 & 记录较少用户**不会看到多余年份**

---

## 七、相关文件（初步判断）

| 文件 | 用途 |
|------|------|
| `mobile/src/screens/DiaryListScreen.tsx` | 首页列表、FlatList、ListHeader；需新增吸顶栏、`onViewableItemsChanged`、跳转逻辑、Month Picker Modal |
| `mobile/src/i18n/zh.ts` | 新增年月展示格式、月份简写（若放 i18n）、Modal 相关 Copy |
| `mobile/src/i18n/en.ts` | 同上，英文 |
| `mobile/src/utils/dateFormat.ts` | 可选：新增 `formatYearMonth(created_at)` 或复用/扩展既有格式化逻辑 |
| `mobile/src/styles/typography.ts` | 已有 `getFontFamilyForText`，吸顶栏需使用 |

---

## 八、风险与依赖

- **列表结构**：需在现有 `SafeAreaView` → `FlatList` 之上增加**固定吸顶栏**，且 FlatList 需 `ref` + `onViewableItemsChanged`（或 `onScroll`）以追踪「当前最上方可见日记」；**不**改动 `ListHeaderComponent` 结构，仅在其上叠加一层 UI。
- **搜索态**：`searchQuery !== ''` 时展示 `searchResults`；需明确吸顶栏 + 月份跳转在**搜索态下**是否隐藏或禁用（建议：搜索时隐藏吸顶栏，避免与搜索结果的「时间」语义冲突）。
- **空列表 / 无日记**：吸顶栏不显示或隐藏，避免无意义展示。

---

## 九、交付预期

- 符合**微信级直觉**、比微信更**细腻（月级）**
- **不增加**认知负担
- **工程复杂度可控**的增强功能

---

## 十、下一步

1. ~~**Explore**~~：已确认布局与策略。
2. **实现**：🟩 吸顶栏 → 🟩 月份 Modal → 🟩 跳转逻辑 → 🟩 i18n。
3. **验收**：按「六、验收标准」逐项检查。

---

## 十一、实现进度（Execute）

- 🟩 Phase 1: i18n + dateFormat `getYearMonth` / `MONTH_NAMES_SHORT`
- 🟩 Phase 2: 吸顶栏 + `onViewableItemsChanged` + `viewabilityConfig` + 初始年月
- 🟩 Phase 3: Month Picker Modal（自底向上、按年分组、1–12 月、有记录可点）
- 🟩 Phase 4: `scrollToMonth` 跳转逻辑
- 🟩 Review：已完成（见 `.agent/REVIEW_sticky_month_picker.md`）
