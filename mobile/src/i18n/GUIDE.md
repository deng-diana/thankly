# 🌍 i18n 改造指南 - Learning by Doing

## 🎯 目标

将所有硬编码的中文/英文文本改为使用 `t()` 翻译函数，实现自动语言切换。

---

## 📝 三步改造法（适用于任何组件）

### **Step 1: 导入翻译函数**

```typescript
// 在文件顶部，其他import后面添加：
import { t } from "../i18n";
```

### **Step 2: 找到所有硬编码文本**

使用编辑器搜索功能：

- 搜索中文字符：`[\u4e00-\u9fff]+`（正则表达式）
- 或直接搜索引号内的文本

### **Step 3: 替换为翻译函数**

```typescript
// ❌ Before
<Text>欢迎</Text>

// ✅ After
<Text>{t('login.title')}</Text>
```

---

## 📚 实战案例：DiaryListScreen 改造

### 🔍 **找到需要改的文本（示例）**

```typescript
// 文件：DiaryListScreen.tsx

// 案例1：欢迎语
<Text style={styles.title}>Welcome to thankly</Text>
<Text style={styles.subtitle}>your gentle space for gratitude</Text>

// 案例2：空状态提示
<Text>还没有日记</Text>
<Text>点击 + 按钮创建你的第一条感恩记录</Text>

// 案例3：按钮文本
<Text>开始录音</Text>
<Text>停止</Text>
<Text>保存</Text>
```

### ✏️ **你的改造任务（动手练习）**

**Step 1：** 在 `DiaryListScreen.tsx` 顶部添加导入

```typescript
import { t } from "../i18n";
```

**Step 2：** 替换文本

```typescript
// ❌ 原来
<Text style={styles.title}>Welcome to thankly</Text>

// ✅ 改成
<Text style={styles.title}>{t('home.welcome')}</Text>

// ❌ 原来
<Text style={styles.subtitle}>your gentle space for gratitude</Text>

// ✅ 改成
<Text style={styles.subtitle}>{t('home.subtitle')}</Text>
```

---

## 🎨 特殊情况处理

### **1. Alert 对话框**

```typescript
// ❌ Before
Alert.alert("删除日记", "确定要删除吗？", [
  { text: "取消" },
  { text: "删除", onPress: handleDelete },
]);

// ✅ After
Alert.alert(t("confirm.deleteTitle"), t("confirm.deleteMessage"), [
  { text: t("common.cancel") },
  { text: t("common.delete"), onPress: handleDelete },
]);
```

### **2. 字符串拼接**

```typescript
// ❌ 不推荐：硬编码拼接
const message = `已保存 ${count} 条日记`;

// ✅ 推荐：使用参数
// 1. 先在 zh.ts 添加：
// success: {
//   savedCount: "已保存 {{count}} 条日记"
// }

// 2. 使用时传参：
const message = t("success.savedCount", { count });
```

### **3. 动态文本**

```typescript
// 如果文本内容本身是变量（如用户输入的日记内容）
// 不需要翻译！只翻译UI文本

// ❌ 错误：不要翻译用户内容
<Text>{t(diaryContent)}</Text>

// ✅ 正确：用户内容直接显示
<Text>{diaryContent}</Text>
```

---

## ✅ 改造检查清单

完成一个文件后，用这个清单自查：

- [ ] **导入了 t 函数**：`import { t } from "../i18n"`
- [ ] **所有 UI 文本都用了 t()**：搜索文件，确保没有裸露的中文/英文
- [ ] **Alert 都改了**：包括 title 和按钮文本
- [ ] **错误提示都改了**：try-catch 里的错误信息
- [ ] **没有翻译用户内容**：只翻译 UI，不翻译数据
- [ ] **测试了两种语言**：切换系统语言测试

---

## 🐛 常见错误

### **错误 1：Key 写错**

```typescript
// ❌ 错误：key不存在
t("home.welcom"); // 少了个e

// ✅ 正确
t("home.welcome");
```

### **错误 2：忘记用花括号**

```typescript
// ❌ 错误：JSX中忘记花括号
<Text>t('home.welcome')</Text>

// ✅ 正确
<Text>{t('home.welcome')}</Text>
```

### **错误 3：翻译了变量**

```typescript
// ❌ 错误：尝试翻译变量内容
const userName = "张三";
<Text>{t(userName)}</Text>

// ✅ 正确：变量不翻译
<Text>{userName}</Text>
```

---

## 📊 改造优先级（按重要性排序）

### 🔥 **高优先级（用户直接看到的）**

1. ✅ LoginScreen（已完成）
2. 📝 DiaryListScreen - 首页，用户最常看
3. 📝 RecordingModal - 录音界面
4. 📝 CreateDiaryScreen - 创建日记

### 📦 **中优先级（常用功能）**

5. 📝 DiaryDetailScreen - 日记详情
6. 📝 错误提示（errorHandler.ts）

### 📦 **低优先级（次要功能）**

7. 📝 其他辅助页面

---

## 🎓 学习资源

### **快速测试**

```typescript
// 临时测试当前语言
import { getCurrentLocale } from "../i18n";
console.log("当前语言:", getCurrentLocale());

// 临时切换语言（测试用）
import { changeLocale } from "../i18n";
changeLocale("zh"); // 切换到中文
changeLocale("en"); // 切换到英文
```

### **添加新翻译**

如果发现缺少某个翻译 key：

1. 打开 `src/i18n/en.ts`
2. 在合适的分组添加英文
3. 打开 `src/i18n/zh.ts`
4. 在相同位置添加中文
5. 确保 key 完全一致

---

## 💡 Google 工程师的建议

1. **一次改一个文件**

   - 不要贪多，改完一个测试一个

2. **优先改用户最常看的页面**

   - 比如首页比设置页更重要

3. **保持翻译 key 简洁**

   - `t('home.welcome')` ✅
   - `t('homePageWelcomeTitle')` ❌ 太长

4. **测试是必须的**

   - 切换系统语言测试（设置 → 语言 → 中文/English）
   - 确保两种语言都正常显示

5. **提交前自查**
   - 用检查清单检查每个文件
   - 搜索文件中的中文字符，确保都改了

---

## 🚀 开始你的第一个改造

**建议：** 从 DiaryListScreen 开始

- 这个页面用户最常看
- 改完能立即看到效果
- 文本不多，容易上手

**准备好了吗？** 打开 `DiaryListScreen.tsx`，开始你的改造之旅！

记住：Learning by Doing！💪
