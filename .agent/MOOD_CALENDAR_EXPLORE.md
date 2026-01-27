# 情绪日历（Mood Calendar）· Explore 阶段

## 1. 理解摘要

- **功能定位**：回顾型（Reflection Layer），从时间维度回看情绪与记录；非记录/效率工具。
- **入口**：首页「My precious moment」右侧仅图标；抽屉菜单「情绪日历」/「Mood Calendar」图标+文案。
- **日历页**：单页三区——(1) 顶部统计：累计天数、累计条数，**不显示连续记录天数**；(2) 月份切换 YYYY-MM，左右箭头，禁止早于首条记录/晚于当前月，**首次进入默认当前月**；(3) 月历 + 点击有记录日期后在下方展示该日日记列表（不跳转，卡片与首页一致）。
- **日历格**：7 列周一～周日，本地化。有记录：**圆形**表示心情，颜色=日记情绪色、**透明度 80%**；多条日记时 **multiply 叠加**，参考设计图（重叠、轻微错位）。无记录：浅灰/空白，不点。选中日有明显反馈。
- **数据**：`created_at` → year/month/day；情绪色复用 `EMOTION_MAP` / `DEFAULT_EMOTION`。首页日历图标暂用 `calendarIcon.svg`。

---

## 2. 代码位置与依赖

| 模块 | 文件/目录 | 说明 |
|------|-----------|------|
| 首页入口 | `mobile/src/screens/DiaryListScreen.tsx` | `sectionTitleContainer` 右侧加日历图标，`navigate("MoodCalendar")` |
| 抽屉入口 | `mobile/src/components/AppDrawerContent.tsx` | 新增菜单项「情绪日历」+ 图标，`navigateTo("MoodCalendar")` |
| 路由 | `mobile/src/navigation/AppNavigator.tsx` | `RootStackParamList`、`MainStack` 新增 `MoodCalendar` |
| 日历页 | `mobile/src/screens/MoodCalendarScreen.tsx`（新建） | 统计、月份切换、月历、日记联动；`getDiaries()` 自拉数据 |
| 日期工具 | `mobile/src/utils/dateFormat.ts` | 新增 `getDateKey(ts)=> "YYYY-MM-DD"`；已有 `getYearMonth` |
| 情绪配色 | `mobile/src/types/emotion.ts` | `EMOTION_MAP`、`DEFAULT_EMOTION`、`EmotionType` |
| 日记卡片 | `mobile/src/components/DiaryCard.tsx` | 日历下方列表复用，或复用首页 `renderDiaryCard` 逻辑 |
| 图标 | `mobile/src/assets/icons/calendarIcon.svg` | 首页 + 抽屉入口暂用 |
| i18n | `mobile/src/i18n/en.ts`, `zh.ts` | 新增 `moodCalendar.*`（标题、副标题、统计、周几、空状态等） |

---

## 3. 风险与约束

- **Multiply 叠加**：RN 的 View 不支持 `mix-blend-mode`；react-native-svg 的 Circle 也不支持。可选方案：
  - **A) 预计算 multiply**：对当日多条情绪色做 `multiply(c1,c2,c3)`（RGB 逐通道相乘），**单圆**、该色 80% 透明度。语义正确，但无「多圆重叠」视觉。
  - **B) 多圆堆叠**：2～3 个圆轻微错位、各 80% 透明度，普通 alpha 叠加。视觉贴近设计图，但非严格 multiply。
  - **建议**：优先 **B** 以贴近参考图；若后期接入 react-native-skia 等再改为 true multiply。
- **月份边界**：需基于日记算出「最早有记录的 (year,month)」与「当前 (year,month)」，箭头逻辑禁选 outside [最早, 当前]。
- **周起始**：周一为一周第一天，中/英 weekday 文案需 i18n（如一～日 / Mon～Sun）。
- **日历空月**：当前月无记录时仍显示当月月历，仅格子无圆、无记录日不可点；统计照常。

---

## 4. 待澄清（可选）

- 无。三大拍板点（不展示连续天数、默认当前月、暂用 `calendarIcon`）已定；multiply 采用上述折中即可推进。
