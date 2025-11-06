# 🎨 Splash Screen 替换教程

## 📚 第一步：理解 Splash Screen 的概念

### 什么是 Splash Screen？
Splash Screen（启动画面）是用户打开应用时看到的第一个画面。它有两个层级：

1. **Native Splash Screen（系统级）**
   - 在应用真正启动之前显示
   - 配置在 `app.json` 中
   - 显示速度快，适合显示 logo 和品牌色

2. **代码级 Splash Screen（可选）**
   - 在 JavaScript 代码加载时显示
   - 可以在 `App.tsx` 中自定义
   - 更灵活，可以添加动画等效果

### Splash Screen 是必须的吗？
**是的！** 原因：
- ✅ 避免应用启动时的黑屏/白屏
- ✅ 提供品牌展示机会
- ✅ 在资源加载时给用户反馈
- ✅ iOS/Android 系统要求

---

## 📂 第二步：准备你的资源文件

### 你需要准备的文件：

1. **Splash Logo 图片**
   - 格式：PNG（支持透明背景）
   - 尺寸建议：1242x1242px（iOS）或 1024x1024px（Android）
   - 位置：`mobile/assets/splash.png`（或你想要的名称）

2. **App Icon**
   - 格式：PNG
   - 尺寸：1024x1024px
   - 位置：`mobile/assets/icon.png`

3. **自定义字体文件（可选）**
   - 格式：`.ttf` 或 `.otf`
   - 位置：`mobile/assets/fonts/`（需要创建这个文件夹）

### 📝 操作步骤：

1. **创建资源目录（如果不存在）**
   ```bash
   cd mobile
   mkdir -p assets/fonts
   ```

2. **放置你的文件**
   - 将你的 logo 图片命名为 `splash.png`，放到 `mobile/assets/` 目录
   - 将你的字体文件放到 `mobile/assets/fonts/` 目录

---

## ⚙️ 第三步：配置 app.json

### 当前配置（第9-11行）：
```json
"splash": {
  "backgroundColor": "#FAF6ED"
}
```

### 更新后的配置：
```json
"splash": {
  "image": "./assets/splash.png",  // 👈 添加这行
  "resizeMode": "contain",          // 👈 添加这行（可选：contain/cover/native）
  "backgroundColor": "#FAF6ED"      // 👈 保持背景色
}
```

### 参数说明：
- `image`: Splash 图片路径（相对于 `mobile/` 目录）
- `resizeMode`: 
  - `"contain"`: 完整显示图片，保持比例（推荐）
  - `"cover"`: 填充整个屏幕，可能裁剪
  - `"native"`: 使用原始尺寸
- `backgroundColor`: 背景色（图片加载前的颜色）

---

## 🎨 第四步：替换 WelcomeScreen 中的 Logo

### 当前代码（第93-96行）：
```tsx
<View style={styles.logoContainer}>
  <View style={styles.logoPlaceholder} />
</View>
```

### 更新后的代码：
```tsx
<View style={styles.logoContainer}>
  <Image 
    source={require("../../assets/splash.png")}  // 👈 使用你的 logo
    style={styles.logo}
    resizeMode="contain"
  />
</View>
```

### 需要添加的样式（在 styles 对象中）：
```tsx
logo: {
  width: 120,
  height: 120,
  // 如果需要圆角，可以添加：
  // borderRadius: 24,
},
```

### 别忘了导入 Image：
```tsx
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,  // 👈 添加这行
} from "react-native";
```

---

## 🔤 第五步：替换字体（如果使用自定义字体）

### 方式一：使用 Expo 字体服务（推荐，简单）

如果你的字体是 Google Fonts 中的，可以直接使用：

1. **安装字体包**（在 `mobile/` 目录下）：
   ```bash
   npx expo install @expo-google-fonts/你的字体名
   ```

2. **在 App.tsx 中导入**（参考当前的 Lora 和 Noto Serif SC）：
   ```tsx
   import {
     你的字体_400Regular,
     你的字体_500Medium,
     你的字体_600SemiBold,
   } from "@expo-google-fonts/你的字体名";
   ```

3. **在 useFonts 中添加**：
   ```tsx
   const [fontsLoaded, fontError] = useFonts({
     // ... 现有的字体
     你的字体_400Regular,
     你的字体_500Medium,
     你的字体_600SemiBold,
   });
   ```

### 方式二：使用本地字体文件（自定义字体）

1. **将字体文件放到 `mobile/assets/fonts/` 目录**

2. **在 App.tsx 中加载**：
   ```tsx
   import * as Font from "expo-font";
   
   const [fontsLoaded] = useFonts({
     // ... 现有的字体
     "你的字体名-Regular": require("./assets/fonts/你的字体-Regular.ttf"),
     "你的字体名-Medium": require("./assets/fonts/你的字体-Medium.ttf"),
     "你的字体名-SemiBold": require("./assets/fonts/你的字体-SemiBold.ttf"),
   });
   ```

3. **在 typography.ts 中更新字体名称**：
   ```tsx
   const FONT_NAMES = {
     lora: {
       regular: "你的字体名-Regular",  // 👈 替换
       medium: "你的字体名-Medium",    // 👈 替换
       semibold: "你的字体名-SemiBold", // 👈 替换
     },
     // ...
   };
   ```

---

## 🚀 第六步：测试你的更改

### 开发模式下测试：

1. **清除缓存并重启**：
   ```bash
   cd mobile
   npx expo start --clear
   ```

2. **查看 Splash Screen**：
   - 在 iOS 模拟器中：按 `Cmd + R` 重新加载
   - 在 Android 模拟器中：按 `R` 两次重新加载
   - 在真机上：完全关闭应用后重新打开

### 检查清单：

- [ ] Splash Screen 显示你的 logo
- [ ] 背景色正确
- [ ] Logo 位置和大小合适
- [ ] WelcomeScreen 显示你的 logo（不是占位符）
- [ ] 字体正确加载（如果替换了字体）

---

## 🎯 常见问题

### Q1: Logo 显示不完整或太小？
**A**: 调整 `resizeMode` 或修改图片尺寸。如果使用 `contain`，确保图片有足够的透明边距。

### Q2: Splash Screen 太快，看不到？
**A**: 这是正常的！Native Splash 会自动消失。如果需要更长的显示时间，可以在 `App.tsx` 中添加代码级 Splash。

### Q3: 字体没有加载？
**A**: 
- 检查字体文件路径是否正确
- 检查字体名称是否正确
- 查看控制台是否有错误信息

### Q4: 想要添加动画效果？
**A**: 可以在 `App.tsx` 中创建一个自定义 Splash Screen 组件，使用 `Animated` API 添加淡入淡出等效果。

---

## 📋 下一步：引导页优化

完成 Splash Screen 后，我们可以继续优化：
- OnboardingCarousel（引导页轮播）
- 各个 OnboardingScreen（引导页内容）
- 添加你的引导页插图

---

## 💡 提示

1. **图片优化**：使用工具压缩图片（如 TinyPNG），减少应用体积
2. **一致性**：确保 Splash Screen 和 WelcomeScreen 的 logo 保持一致
3. **测试**：在不同设备上测试，确保在不同屏幕尺寸下都能正常显示

准备好了吗？让我们开始第一步！🚀

