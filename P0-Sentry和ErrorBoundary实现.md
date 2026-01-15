# P0 紧急修复: Sentry 和 Error Boundary 实现

## 📝 已创建文件

### ✅ 文件 1: ErrorBoundary.tsx

```
位置: mobile/src/components/ErrorBoundary.tsx
状态: 已创建
功能: 捕获React错误,防止整个App崩溃
```

---

## 🔧 需要修改的文件

### 文件 2: App.tsx

#### 修改 1: 取消注释 Sentry 初始化 (第 33-52 行)

**当前代码** (被注释):

```typescript
// import * as Sentry from '@sentry/react-native';

// Sentry.init({
//   dsn: 'https://76689860c832af9ae294f1729a01a7e0@o4510687210962944.ingest.us.sentry.io/4510687420350464',
//   ...
// });
```

**修改为** (取消注释并优化):

```typescript
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://76689860c832af9ae294f1729a01a7e0@o4510687210962944.ingest.us.sentry.io/4510687420350464",

  // ✅ 添加更多上下文信息
  sendDefaultPii: true,

  // ✅ 启用日志
  enableLogs: true,

  // ✅ 配置Session Replay (可以看到崩溃前的用户操作)
  replaysSessionSampleRate: 0.1, // 10%的正常session
  replaysOnErrorSampleRate: 1.0, // 100%的错误session

  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // ✅ 添加环境标识
  environment: __DEV__ ? "development" : "production",

  // ✅ 添加版本信息
  release: "thankly@1.1.0",
});
```

#### 修改 2: 添加 ErrorBoundary import (第 32 行后)

```typescript
import * as SecureStore from "expo-secure-store";
import { ErrorBoundary } from "./src/components/ErrorBoundary"; // ← 新增
```

#### 修改 3: 包裹 App 组件 (第 140-149 行)

**当前代码**:

```typescript
return (
  <SafeAreaProvider>
    <View
      style={{ flex: 1, backgroundColor: "#FAF6ED" }}
      onLayout={onLayoutRootView}
    >
      {appIsReady ? <AppNavigator /> : null}
    </View>
  </SafeAreaProvider>
);
```

**修改为**:

```typescript
return (
  <SafeAreaProvider>
    <ErrorBoundary>
      {" "}
      {/* ← 新增 */}
      <View
        style={{ flex: 1, backgroundColor: "#FAF6ED" }}
        onLayout={onLayoutRootView}
      >
        {appIsReady ? <AppNavigator /> : null}
      </View>
    </ErrorBoundary>{" "}
    {/* ← 新增 */}
  </SafeAreaProvider>
);
```

---

## 🚀 实施步骤

### 步骤 1: 修改 App.tsx (5 分钟)

1. 打开 `mobile/App.tsx`
2. 第 33 行: 取消注释 `import * as Sentry from '@sentry/react-native';`
3. 第 35-52 行: 取消注释 Sentry.init()代码,并按上面的代码优化
4. 第 32 行后: 添加 ErrorBoundary import
5. 第 140-149 行: 用 ErrorBoundary 包裹 App

### 步骤 2: 保存文件

### 步骤 3: 测试 Sentry (可选)

```typescript
// 在App.tsx中临时添加测试代码
useEffect(() => {
  // 测试Sentry是否工作
  setTimeout(() => {
    Sentry.captureMessage("Test: Sentry is working!");
  }, 3000);
}, []);
```

### 步骤 4: 测试 Error Boundary

在任意组件中添加:

```typescript
// 测试错误捕获
const [shouldCrash, setShouldCrash] = useState(false);

if (shouldCrash) {
  throw new Error("Test Error Boundary");
}

// 添加按钮触发错误
<Button title="Test Crash" onPress={() => setShouldCrash(true)} />;
```

---

## ✅ 完成检查清单

- [ ] ErrorBoundary.tsx 已创建
- [ ] App.tsx 中 Sentry 已启用
- [ ] App.tsx 中 ErrorBoundary 已添加
- [ ] 测试 Sentry 是否工作
- [ ] 测试 ErrorBoundary 是否捕获错误

---

## 📊 预期效果

### 崩溃前 ❌

```
用户操作 → 组件错误 → 整个App白屏/崩溃 → 内容丢失
```

### 崩溃后 ✅

```
用户操作 → 组件错误 → ErrorBoundary捕获 → 显示友好错误页 → 可重新加载
                    ↓
                Sentry记录 → 开发者收到通知 → 快速修复
```

---

## ⏱️ 总耗时

- 自动保存实现: 15-20 分钟
- Sentry + Error Boundary: 10 分钟
- **总计: 25-30 分钟**

完成后,您的 App 将拥有**三层防护**:

1. ✅ 自动保存 (防止内容丢失)
2. ✅ Sentry 监控 (追踪崩溃原因)
3. ✅ Error Boundary (防止整个 App 崩溃)

**用户信任度提升 100%!** 🎉
