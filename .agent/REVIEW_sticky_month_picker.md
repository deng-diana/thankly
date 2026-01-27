# Code Review: 吸顶年月 + 月份快速跳转

**审查范围**: 本次实现相关改动（i18n、dateFormat、DiaryListScreen）  
**标准**: `@.claude/commands/review.md`

---

## ✅ Looks Good

- **Error Handling**: `scrollToMonth` 内 `scrollToIndex` 已用 try-catch 包裹，避免未布局/动态高度时崩溃。
- **TypeScript**: 未新增 `any` 或 `@ts-ignore`；`getYearMonth`、`yearMonthMap`、`formatStickyYearMonth` 等类型明确。
- **Production Readiness**: 无新增 debug、TODO、硬编码密钥；吸顶栏与 Month Picker 仅用现有主题色与 i18n。
- **React/Hooks**: `useEffect` 依赖完整（初始吸顶、清空重置、Month Picker 动画）；`useCallback` 用于 `formatStickyYearMonth`、`onViewableItemsChanged`、`scrollToMonth`；`yearMonthMap` 已 `useMemo`；无循环依赖。
- **Performance**: `viewabilityConfig` 使用 `useRef` 保持稳定；吸顶栏仅在 `diaries` 有数据且非搜索时渲染；Month Picker 按年分组、1–12 月 grid 复用同一套样式。
- **Architecture**: 沿用现有 Modal  bottom-sheet 风格、`getFontFamilyForText`、`t()`、Action Sheet 动画模式；`getYearMonth` / `MONTH_NAMES_SHORT` 放在 `dateFormat` 便于复用。

---

## ⚠️ Issues Found

### [LOW] DiaryListScreen – 未使用 logger

- **描述**: 项目其余处仍有大量 `console.log` / `console.error`，本次改动未新增。Review 要求使用带上下文的 logger。
- **Fix**: 本次不改动既有日志；若后续统一接入 logger，可顺带替换 DiaryListScreen 中的 `console.*`。

### [LOW] `formatStickyYearMonth` – `useCallback` 依赖未含 `t` / `getCurrentLocale`

- **描述**: `formatStickyYearMonth` 使用 `t("home.stickyYearMonthFormat")` 与 `getCurrentLocale()`，但 `useCallback` 依赖为 `[]`。
- **Fix**: 若 `exhaustive-deps` 报错，可改为 `[t, getCurrentLocale]`；二者来自 i18n 模块，通常稳定，当前无 lint 报错可暂不改。

### [LOW] Month Picker – `gap` 兼容性

- **描述**: `monthPickerGrid` 使用 `gap: 8`。RN 0.71+ 支持 flex `gap`，项目为 0.81，无问题；若将来降级 RN 需改用 `margin`。
- **Fix**: 保持现状；若降级再改为 `marginBottom` / `marginRight` 等。

---

## 📊 Summary

- **Files reviewed**: 4（`DiaryListScreen.tsx`、`dateFormat.ts`、`i18n/zh.ts`、`i18n/en.ts`）
- **Critical issues**: 0
- **Warnings (HIGH/MEDIUM)**: 0
- **LOW**: 2（logger 沿用、`gap` 兼容性，均可后续按需处理；`useCallback` 依赖已修复）

---

## ✅ 生产环境修复（Best Practice）

### 1. viewabilityConfig Invariant Violation

- **现象**: `Must set exactly one of itemVisiblePercentThreshold or viewAreaCoveragePercentThreshold`
- **原因**: 同时设置了 `viewAreaCoveragePercentThreshold` 与 `itemVisiblePercentThreshold`。
- **修复**: 仅保留 `viewAreaCoveragePercentThreshold: 0`，移除 `itemVisiblePercentThreshold`。RN 规定二者**必须二选一**。

### 2. i18n "missing {{year}} / {{month}} value"

- **现象**: `WARN ⚠️ 翻译键未找到: home.stickyYearMonthFormat [missing "{{year}}" value] [missing "{{month}}" value]`
- **原因**: 使用 `t("home.stickyYearMonthFormat")` 取模板后再手动 `replace`，i18n-js 仍会解析 `{{year}}`/`{{month}}`，未传 options 即报 missing。
- **修复**: 改为 `t("home.stickyYearMonthFormat", { year: String(year), month: monthStr })`，用 i18n 插值，不再手动 replace。

---

## 验收核对（对照 ISSUE）

- [x] 滚动时吸顶年月与当前可见最上方日记一致（`onViewableItemsChanged` + 首条 fallback）
- [x] 点击年月 → Month Picker → 选择月份 → 精准跳转该月第一条日记（`scrollToMonth`）
- [x] 中英文格式：中文 `2026 年 · 1 月`，英文 `Jan 2026`，i18n + `MONTH_NAMES_SHORT`
- [x] 仅展示有记录年份；无记录月份置灰禁用；搜索态隐藏吸顶栏；空列表隐藏且重置吸顶状态
