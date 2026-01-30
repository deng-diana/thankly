# CLAUDE.md - Thankly 项目协作指南

## 1. 项目概览

### 项目简介
**Thankly** 是一款 **AI 驱动的感恩日记应用**，让用户通过语音、文字或图片记录生活中的美好时刻，AI 自动润色内容、分析情绪并提供温暖反馈。

### 核心用户流程
```
注册/登录 → 创建日记（语音/文字/图片）→ AI 处理（转录、润色、情绪分析）
→ 查看日记列表 → 搜索/筛选 → 幸福罐/情绪日历回顾
```

### 关键特性
- 🎙️ **语音日记**: Whisper 转录 + GPT-4o 润色
- ✍️ **文字日记**: 自动保存草稿 + AI 增强
- 📸 **图片日记**: 支持多张图片上传
- 😊 **24 种情绪**: AI 自动分析并分类
- 🏺 **幸福罐**: 收集正面情绪时刻
- 📅 **情绪日历**: 时间维度回顾
- 🔒 **隐私优先**: Apple/Google 登录 + 端到端加密

---

## 2. 技术栈与架构

### 2.1 前端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| **Expo** | 54.0.31 | React Native 开发框架 |
| **React Native** | 0.81.5 | 跨平台移动应用 |
| **React** | 19.1.0 | UI 框架 |
| **TypeScript** | 5.9.2 | 类型安全 |
| **React Navigation** | 7.x | 导航系统 (Stack + Drawer) |
| **Expo Audio/AV** | 1.1.1 / 16.0.8 | 录音与音频播放 |
| **AsyncStorage** | 2.2.0 | 本地持久化存储 |
| **SecureStore** | 15.0.8 | 敏感信息加密存储 |
| **i18n-js** | 4.5.1 | 国际化（中英双语） |
| **AWS Amplify** | 6.15.7 | Cognito 认证集成 |
| **Sentry** | 7.2.0 | 错误监控与崩溃报告 |

### 2.2 后端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| **FastAPI** | 0.115.0 | Python 高性能 API 框架 |
| **AWS Cognito** | - | 用户认证与 JWT Token |
| **AWS DynamoDB** | - | NoSQL 数据库 |
| **AWS S3** | - | 音频/图片存储 |
| **AWS Lambda** | - | Serverless 部署 |
| **OpenAI API** | 1.38.0 | Whisper、GPT-4o、GPT-4o-mini |
| **boto3** | 1.35.53 | AWS Python SDK |

### 2.3 项目目录结构

```
thankly/
├── mobile/                          # 📱 移动端 (Expo/React Native)
│   ├── App.tsx                      # 入口文件：字体加载、Sentry、通知、OTA 更新
│   ├── index.ts                     # Expo 注册组件
│   ├── app.json                     # Expo 配置：权限、插件、版本
│   ├── package.json                 # 依赖管理
│   │
│   └── src/
│       ├── navigation/              # 🧭 导航系统
│       │   ├── AppNavigator.tsx    # 路由定义 (Stack + Drawer)
│       │   └── navigationRef.ts    # 导航引用（用于非组件内跳转）
│       │
│       ├── screens/                 # 📄 页面组件（13 个主要屏幕）
│       │   ├── WelcomeScreen.tsx           # 欢迎页
│       │   ├── OnboardingScreen1-3.tsx     # 新手引导（3 步）
│       │   ├── LoginScreen.tsx             # 登录页 (Apple/Google)
│       │   ├── DiaryListScreen.tsx         # 主页：日记列表（核心）
│       │   ├── CreateTextDiaryScreen.tsx   # 文字日记创建
│       │   ├── DiaryDetailScreen.tsx       # 日记详情与编辑
│       │   ├── SearchScreen.tsx            # 日记搜索
│       │   ├── HappinessJarScreen.tsx      # 幸福罐
│       │   ├── MoodCalendarScreen.tsx      # 情绪日历
│       │   ├── ReminderSettingsScreen.tsx  # 提醒设置
│       │   ├── PrivacyPolicyScreen.tsx     # 隐私政策
│       │   └── TermsOfServiceScreen.tsx    # 服务条款
│       │
│       ├── components/              # 🧩 可复用组件（34+ 个）
│       │   ├── DiaryCard.tsx               # 日记卡片（核心组件）
│       │   ├── RecordingModal.tsx          # 语音录制弹窗（核心）
│       │   ├── TextInputModal.tsx          # 文字输入弹窗
│       │   ├── ImageDiaryModal.tsx         # 图片选择弹窗
│       │   ├── AudioPlayer.tsx             # 音频播放器
│       │   ├── EmotionCapsule.tsx          # 情绪标签胶囊
│       │   ├── EmotionGlow.tsx             # 情绪光晕效果
│       │   ├── AIFeedbackCard.tsx          # AI 反馈卡片
│       │   ├── ProcessingAnimation.tsx     # AI 处理动画
│       │   ├── ErrorBoundary.tsx           # 错误边界
│       │   ├── AppDrawerContent.tsx        # 侧边栏菜单
│       │   ├── HighlightedText.tsx         # 搜索结果高亮
│       │   └── ...（30+ 其他组件）
│       │
│       ├── services/                # 🛠️ 业务逻辑层（关键）
│       │   ├── apiService.ts               # HTTP 请求封装 + Token 管理
│       │   ├── authService.ts              # Apple/Google 登录 + Token 刷新
│       │   ├── diaryService.ts             # 日记 CRUD + 搜索
│       │   ├── audioUploadService.ts       # S3 预签名 URL 上传
│       │   ├── notificationService.ts      # 每日提醒
│       │   └── accountService.ts           # 账户管理
│       │
│       ├── hooks/                   # 🪝 自定义 Hooks
│       │   ├── useVoiceRecording.ts        # 语音录制管理（核心）
│       │   └── useDiaryAudio.ts            # 音频播放管理
│       │
│       ├── utils/                   # 🔧 工具函数
│       │   ├── dateFormat.ts               # 日期格式化
│       │   ├── emotionSearch.ts            # 情绪关键词搜索
│       │   ├── errorHandler.ts             # 统一错误处理
│       │   └── imageGridLayout.ts          # 图片网格布局
│       │
│       ├── config/                  # ⚙️ 配置文件（重要）
│       │   └── aws-config.ts               # AWS Cognito + API Base URL
│       │
│       ├── types/                   # 📝 TypeScript 类型定义
│       │   └── emotion.ts                  # 24 种情绪类型 + 配置
│       │
│       ├── i18n/                    # 🌍 国际化（中英双语）
│       │   ├── index.ts                    # i18n 初始化
│       │   ├── en.ts                       # 英文翻译（2000+ 条）
│       │   └── zh.ts                       # 中文翻译（2000+ 条）
│       │
│       ├── constants/               # 📌 常量
│       │   └── happinessEmotions.ts        # 幸福情绪配置
│       │
│       ├── styles/                  # 🎨 全局样式
│       │   └── globalStyles.ts
│       │
│       └── assets/                  # 🖼️ 静态资源
│           ├── icons/                      # SVG 图标
│           ├── app-icon.png                # 应用图标
│           └── splash-logo.png             # 启动页
│
├── backend/                         # 🐍 后端 (FastAPI + Python)
│   ├── app/
│   │   ├── main.py                         # FastAPI 应用入口
│   │   ├── config.py                       # 配置管理
│   │   ├── lambda_handler.py               # AWS Lambda 入口
│   │   │
│   │   ├── routers/                        # 路由层
│   │   │   ├── diary.py                    # 日记 API
│   │   │   ├── auth.py                     # 认证 API
│   │   │   └── account.py                  # 账户 API
│   │   │
│   │   ├── services/                       # 业务逻辑层
│   │   │   ├── openai_service.py           # AI 服务（核心）
│   │   │   ├── openai_service_emotion_agent.py  # 情绪分析 Agent
│   │   │   ├── dynamodb_service.py         # DynamoDB 操作
│   │   │   └── s3_service.py               # S3 文件存储
│   │   │
│   │   └── utils/                          # 工具函数
│   │       ├── transcription.py            # Whisper 转录
│   │       ├── cognito_auth.py             # Cognito JWT 验证
│   │       └── auth.py                     # JWT 处理
│   │
│   ├── requirements.txt                    # Python 依赖
│   └── .env                                # 环境变量（敏感信息）
│
└── .agent/                          # 🤖 项目文档与计划（自动生成）
```

### 2.4 核心模块说明

| 目录/文件 | 职责 | 关键文件路径 |
|---------|------|-------------|
| **[navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx)** | 路由配置，定义所有屏幕 | `/mobile/src/navigation/AppNavigator.tsx` |
| **[screens/DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx)** | 主页，日记列表展示 | `/mobile/src/screens/DiaryListScreen.tsx` |
| **[services/apiService.ts](mobile/src/services/apiService.ts)** | HTTP 请求封装，自动处理 Token | `/mobile/src/services/apiService.ts` |
| **[services/authService.ts](mobile/src/services/authService.ts)** | 认证逻辑，Apple/Google 登录 | `/mobile/src/services/authService.ts` |
| **[hooks/useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts)** | 语音录制管理（权限、生命周期） | `/mobile/src/hooks/useVoiceRecording.ts` |
| **[components/RecordingModal.tsx](mobile/src/components/RecordingModal.tsx)** | 语音录制弹窗 | `/mobile/src/components/RecordingModal.tsx` |
| **[config/aws-config.ts](mobile/src/config/aws-config.ts)** | AWS 配置 + API Base URL | `/mobile/src/config/aws-config.ts` |

---

## 3. 本地开发与运行

### 3.1 开发命令

```bash
# 进入项目目录
cd /Users/dengdan/Desktop/thankly/mobile

# 安装依赖
npm install

# 启动开发服务器（选择平台）
npm start          # 显示 Expo 开发菜单
npm run ios        # 启动 iOS 模拟器
npm run android    # 启动 Android 模拟器
npm run web        # 启动 Web 版本（预览用）
```

### 3.2 开发环境配置

**关键配置：** [mobile/src/config/aws-config.ts](mobile/src/config/aws-config.ts)

```typescript
// 切换开发/生产环境
const IS_LOCAL_DEV = true;  // ✅ 本地开发时设置为 true
                             // ⚠️ 发布生产时必须改为 false

export const API_BASE_URL = IS_LOCAL_DEV
  ? "http://192.168.0.28:8000"        // 本地后端地址
  : "https://api.thankly.app";        // 生产 API 地址
```

**本地开发检查清单：**
- [ ] `IS_LOCAL_DEV = true`（开发模式）
- [ ] 后端服务已启动（`http://192.168.0.28:8000`）
- [ ] 确认手机/模拟器与后端在同一网络（局域网）
- [ ] iOS 模拟器：Command + D 打开调试菜单
- [ ] Android 模拟器：Command + M 打开调试菜单

### 3.3 构建与发布前注意事项

**⚠️ 生产发布前必须检查：**

1. **关闭本地开发模式**
   ```typescript
   // mobile/src/config/aws-config.ts
   const IS_LOCAL_DEV = false;  // ⚠️ 必须设置为 false
   ```

2. **更新版本号**
   ```json
   // mobile/app.json
   "version": "1.2.1",          // 语义化版本
   "ios": { "buildNumber": "7" },
   "android": { "versionCode": 8 }
   ```

3. **检查权限声明**
   - iOS: `app.json` 中的 `NSMicrophoneUsageDescription` 等
   - Android: `permissions` 数组

4. **测试多语言**
   ```bash
   # 切换系统语言测试
   Settings → General → Language & Region → 简体中文/English
   ```

5. **OTA 更新发布**
   ```bash
   # 使用 Expo EAS Update
   eas update --channel production
   ```

6. **原生构建**
   ```bash
   # iOS
   eas build --platform ios --profile production

   # Android
   eas build --platform android --profile production
   ```

---

## 4. Claude 与本项目协作规则 ⭐️

### 4.1 核心原则

#### ✅ 永远先给 Plan，再改代码
- 对于任何非 trivial 的改动，必须先使用 `EnterPlanMode` 生成计划
- 计划需包含：
  - 影响哪些文件
  - 为什么这样改
  - 如何验证
  - 潜在风险
- 等待用户确认后再执行

#### ✅ 改动要小，避免无关重构
- 只改必须改的代码，不做"顺便优化"
- 不添加未被要求的功能
- 不重构无关代码
- 不添加不必要的类型注解或注释

#### ✅ 明确说明改了哪些文件、为什么
- 每次改动后，清楚列出：
  ```markdown
  已修改以下文件：
  - [mobile/src/services/apiService.ts](mobile/src/services/apiService.ts:123-145) - 添加错误重试逻辑
  - [mobile/src/screens/DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx:67) - 修复日记删除后状态未更新
  ```

#### ✅ Expo 项目必须考虑 iOS / Android 兼容
- 所有涉及平台 API 的改动，必须测试双平台
- 使用 `Platform.OS === 'ios'` 处理平台差异
- 权限请求必须在 `app.json` 中声明

#### ✅ 每次改动都给"如何验证"的步骤
```markdown
验证步骤：
1. 重启应用（完全退出后重新打开）
2. 进入日记列表页
3. 点击"+"按钮选择"语音"
4. 录制 10 秒后停止
5. 确认：
   - ✅ 录音按钮正常
   - ✅ 上传进度显示
   - ✅ 日记成功保存
```

#### ✅ 不修改或输出任何密钥/敏感信息
- 不读取或显示 `.env` 文件内容
- 不输出 Sentry DSN、AWS Access Key 等敏感信息
- 如需修改配置，使用占位符：`YOUR_SENTRY_DSN`

---

### 4.2 高风险模块 ⚠️ 改之前必须提醒

| 模块 | 文件路径 | 风险 | 改之前必须做 |
|------|---------|------|------------|
| **AWS 配置** | [mobile/src/config/aws-config.ts](mobile/src/config/aws-config.ts) | 切换错误会导致生产/开发环境混乱 | ✅ 询问用户是否在开发/生产环境 |
| **认证逻辑** | [mobile/src/services/authService.ts](mobile/src/services/authService.ts) | Token 管理错误会导致用户掉线 | ✅ 备份当前 Token 刷新逻辑 |
| **API Service** | [mobile/src/services/apiService.ts](mobile/src/services/apiService.ts) | 影响所有网络请求 | ✅ 测试所有 API 端点（日记、搜索、上传） |
| **语音录制** | [mobile/src/hooks/useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts) | 核心功能，影响用户体验 | ✅ 测试录音权限、开始/停止/取消流程 |
| **音频上传** | [mobile/src/services/audioUploadService.ts](mobile/src/services/audioUploadService.ts) | 涉及 S3 预签名 URL，上传失败会丢失数据 | ✅ 测试上传流程，确认进度和错误处理 |
| **导航系统** | [mobile/src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) | 改错会导致页面跳转混乱 | ✅ 测试所有页面跳转 |
| **数据库模型** | `backend/app/models/` | 改错会导致数据丢失 | ✅ 必须执行数据库迁移脚本 |
| **情绪系统** | [mobile/src/types/emotion.ts](mobile/src/types/emotion.ts) | 24 种情绪的核心定义 | ✅ 确保颜色、翻译、图标保持一致 |
| **OTA 更新** | [mobile/App.tsx:138-215](mobile/App.tsx#L138-L215) | 影响自动更新机制 | ✅ 测试更新检查、下载、应用流程 |

---

### 4.3 常见任务的最佳实践

#### 🔨 添加新功能
1. **探索阶段**：先使用 `Task(subagent_type=Explore)` 了解相关代码
2. **计划阶段**：使用 `EnterPlanMode` 制定实施计划
3. **实施阶段**：
   - 优先复用现有组件（查看 [components/](mobile/src/components/) 目录）
   - 遵循现有代码风格（参考 [DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx)）
   - 添加 i18n 翻译（同时修改 [i18n/en.ts](mobile/src/i18n/en.ts) 和 [i18n/zh.ts](mobile/src/i18n/zh.ts)）
4. **验证阶段**：提供详细测试步骤

#### 🐛 修复 Bug
1. **定位问题**：
   - 读取相关文件
   - 使用 Grep 搜索错误信息
   - 检查 Sentry 错误日志（如果有）
2. **最小改动原则**：只修改必要的代码
3. **回归测试**：确保修复没有引入新问题

#### 🎨 UI/UX 改进
1. **检查现有样式**：查看 [mobile/src/styles/globalStyles.ts](mobile/src/styles/globalStyles.ts)
2. **保持一致性**：使用现有的颜色、字体、间距
3. **双平台测试**：iOS + Android 都要测试

#### 🌍 添加翻译
1. **同时更新**：[i18n/en.ts](mobile/src/i18n/en.ts) 和 [i18n/zh.ts](mobile/src/i18n/zh.ts)
2. **保持键名一致**：使用 `section.subsection.key` 格式
3. **验证翻译**：切换语言测试

#### 📱 处理权限
1. **先声明**：在 [mobile/app.json](mobile/app.json) 中添加权限声明
2. **再请求**：使用 `expo-*` 库请求权限
3. **错误处理**：提供友好的权限拒绝提示

---

### 4.4 工作流示例

#### 示例 1：添加新情绪类型 "Curious"（好奇）

**步骤：**
1. ✅ 提醒用户：这是高风险改动，会影响情绪系统
2. ✅ 生成计划：
   - 修改 [mobile/src/types/emotion.ts](mobile/src/types/emotion.ts) 添加 `Curious` 类型
   - 在 `EMOTION_MAP` 中添加配置（颜色、中英翻译）
   - 更新后端 `openai_service_emotion_agent.py` 的情绪列表
   - 添加 i18n 翻译
3. ✅ 实施改动
4. ✅ 验证步骤：
   ```
   1. 创建一篇新日记
   2. 确认 AI 能识别并分类为 "Curious"
   3. 检查情绪标签显示正常
   4. 测试中英文翻译
   ```

#### 示例 2：修复语音录制崩溃

**步骤：**
1. ✅ 读取 [mobile/src/hooks/useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts)
2. ✅ 定位问题：多次调用导致全局单例未清理
3. ✅ 最小改动：添加 `forceResetGlobalState()` 调用
4. ✅ 验证步骤：
   ```
   1. 打开录音弹窗 → 取消 → 重新打开（重复 3 次）
   2. 确认不会崩溃
   3. 确认录音正常
   ```

---

## 5. 给未来的 Claude 的提示 🤖

### 5.1 加新功能时，优先查看的目录/文件

| 功能类型 | 优先查看 |
|---------|---------|
| **添加新页面** | [navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) → [screens/](mobile/src/screens/) |
| **修改日记功能** | [screens/DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx) → [services/diaryService.ts](mobile/src/services/diaryService.ts) |
| **修改录音功能** | [hooks/useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts) → [components/RecordingModal.tsx](mobile/src/components/RecordingModal.tsx) |
| **修改 AI 处理** | `backend/app/services/openai_service.py` → `backend/app/routers/diary.py` |
| **修改情绪系统** | [types/emotion.ts](mobile/src/types/emotion.ts) → [components/EmotionCapsule.tsx](mobile/src/components/EmotionCapsule.tsx) |
| **修改认证登录** | [services/authService.ts](mobile/src/services/authService.ts) → [screens/LoginScreen.tsx](mobile/src/screens/LoginScreen.tsx) |
| **修改网络请求** | [services/apiService.ts](mobile/src/services/apiService.ts) |
| **添加翻译** | [i18n/en.ts](mobile/src/i18n/en.ts) + [i18n/zh.ts](mobile/src/i18n/zh.ts) |
| **修改权限** | [mobile/app.json](mobile/app.json) (infoPlist 或 permissions) |
| **修改导航** | [navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) |

### 5.2 理解代码库的最佳起点

1. **理解整体架构**：先读 [App.tsx](mobile/App.tsx) + [AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx)
2. **理解核心流程**：
   - 认证流程：[authService.ts](mobile/src/services/authService.ts)
   - 网络层：[apiService.ts](mobile/src/services/apiService.ts)
   - 日记创建：[DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx)
3. **理解关键组件**：
   - 日记卡片：[components/DiaryCard.tsx](mobile/src/components/DiaryCard.tsx)
   - 语音录制：[hooks/useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts)
   - 音频播放：[components/AudioPlayer.tsx](mobile/src/components/AudioPlayer.tsx)

### 5.3 常见陷阱 ⚠️

| 陷阱 | 原因 | 解决方案 |
|------|------|---------|
| **改了代码不生效** | Metro bundler 缓存 | 运行 `npm start -- --clear` 清除缓存 |
| **录音功能异常** | 全局单例未清理 | 检查 [useVoiceRecording.ts](mobile/src/hooks/useVoiceRecording.ts) 的 `globalRecordingInstance` |
| **Token 一直过期** | refreshToken 未保存到 SecureStore | 检查 [authService.ts](mobile/src/services/authService.ts) 的 `refreshAccessToken()` |
| **图片上传失败** | 预签名 URL 过期 | 检查 [audioUploadService.ts](mobile/src/services/audioUploadService.ts) 的超时时间 |
| **翻译显示 key** | 忘记添加翻译 | 同时更新 [en.ts](mobile/src/i18n/en.ts) 和 [zh.ts](mobile/src/i18n/zh.ts) |
| **iOS/Android 表现不一致** | 平台 API 差异 | 使用 `Platform.select()` 或 `Platform.OS` 处理 |
| **OTA 更新不生效** | runtimeVersion 不匹配 | 检查 [app.json](mobile/app.json) 的 `runtimeVersion` 配置 |

### 5.4 Code Review 反复出现的问题 ⚠️⚠️⚠️

**这些是历次 Code Review 中反复出现的问题，必须在写代码时避免！**

#### **🔴 CRITICAL - React Hooks 依赖问题**

| 问题 | 错误示例 | 正确做法 |
|------|---------|---------|
| **useFocusEffect 依赖不完整** | `useFocusEffect(React.useCallback(() => { loadData(); }, []))` | ✅ 将 `loadData` 包装在 `useCallback` 中，添加完整依赖 |
| **useEffect 依赖缺失** | `useEffect(() => { fetch(url); }, [])` | ✅ 添加 `url` 到依赖数组，或使用 `useCallback` |
| **useCallback 依赖不完整** | `useCallback(() => { setState(data); }, [])` | ✅ 添加 `data` 到依赖数组 |

**正确示例**：
```typescript
// ✅ 正确：loadFeed 包装在 useCallback，依赖完整
const loadFeed = useCallback(async (isRefresh = false) => {
  // ... logic using circleId, hasMore, lastKey
}, [circleId, hasMore, lastKey, navigation]); // 完整依赖

useFocusEffect(
  useCallback(() => {
    loadFeed();
  }, [loadFeed]) // 依赖 loadFeed
);
```

**为什么重要**：缺少依赖会导致闭包陷阱、无限循环、状态不同步等严重 bug。

---

#### **🔴 CRITICAL - Memory Leak（内存泄漏）**

| 问题 | 错误示例 | 正确做法 |
|------|---------|---------|
| **setTimeout 没有清理** | `const handleClose = () => { setTimeout(() => reset(), 300); onClose(); }` | ✅ 使用 `useEffect` + cleanup |
| **setInterval 没有清理** | `useEffect(() => { setInterval(() => tick(), 1000); }, [])` | ✅ 返回 `clearInterval` |
| **订阅没有取消** | `useEffect(() => { subscribe(); }, [])` | ✅ 返回 `unsubscribe` |

**正确示例**：
```typescript
// ✅ 正确：setTimeout 在 useEffect 中，有 cleanup
useEffect(() => {
  if (!visible) {
    const timer = setTimeout(() => {
      reset();
    }, 300);
    return () => clearTimeout(timer); // 清理
  }
}, [visible]);
```

**为什么重要**：组件卸载后仍执行的代码会导致内存泄漏、崩溃、状态错乱。

---

#### **🟡 MEDIUM - 代码清洁度**

| 问题 | 检查方法 | 修复 |
|------|---------|-----|
| **未使用的导入** | ESLint 会提示 | ✅ 删除未使用的 `import` |
| **未使用的变量** | TypeScript 会提示 | ✅ 删除未使用的变量（如 `insets`, `typography`） |
| **未使用的函数** | 搜索引用 | ✅ 删除或注释说明保留原因 |

**检查清单**：
- [ ] 所有 `import` 都被使用
- [ ] 所有声明的变量/常量都被引用
- [ ] 没有注释掉的大段代码（用 TODO 代替）

---

#### **🟡 MEDIUM - TypeScript 类型**

| 问题 | 错误示例 | 正确做法 |
|------|---------|---------|
| **过度使用 `any`** | `catch (error: any)` | ✅ 使用 `unknown` 或具体类型 |
| **缺少类型定义** | `const [data, setData] = useState()` | ✅ `useState<DataType>()` |
| **忽略 null/undefined** | `item.name.toUpperCase()` | ✅ `item.name?.toUpperCase()` |

**正确示例**：
```typescript
// ✅ 使用 unknown 而非 any
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  Alert.alert(t('common.error'), message);
}
```

---

#### **📋 开发前自查清单**

**每次写代码前问自己**：
1. ✅ 确认在 `feature/*` 分支，不是 `master`？
2. ✅ 所有 `useEffect`/`useCallback`/`useMemo` 依赖完整？
3. ✅ 所有 `setTimeout`/`setInterval` 有 cleanup？
4. ✅ 所有导入和变量都被使用？
5. ✅ TypeScript 类型明确，避免 `any`？
6. ✅ 添加了 i18n 翻译（中英双语）？
7. ✅ 测试了双平台（iOS + Android）兼容性？

**提交前自查清单**：
1. ✅ 运行 `ReadLints` 检查错误？
2. ✅ `git status` 确认修改的文件正确？
3. ✅ Commit message 使用英文？
4. ✅ 功能已手动测试验证？

---

### 5.5 调试技巧

```typescript
// 1. 使用 console.log（开发环境会自动显示）
console.log('🔍 调试信息:', data);

// 2. 使用 React DevTools（Chrome 开发者工具）
// 在浏览器中打开 http://localhost:19006 查看组件树

// 3. 使用 Sentry 查看生产错误
// 登录 Sentry Dashboard: https://sentry.io/

// 4. 使用 Expo 开发菜单
// iOS 模拟器：Command + D
// Android 模拟器：Command + M

// 5. 查看网络请求
// 在 apiService.ts 中添加 console.log
console.log('📡 API Request:', url, options);
```

---

## 6. 项目统计与规模

| 指标 | 数值 |
|------|------|
| **TypeScript 文件** | 71 个 |
| **主要屏幕** | 13 个 |
| **可复用组件** | 34+ 个 |
| **后端 API 端点** | 20+ 个 |
| **i18n 翻译条目** | 2000+ 个 |
| **情绪类型** | 24 种 |
| **支持语言** | 中文、英文 |
| **App 体积** | ~80MB (Expo build) |

---

## 7. 关键配置文件快速索引

| 配置项 | 文件路径 | 用途 |
|-------|---------|------|
| **Expo 配置** | [mobile/app.json](mobile/app.json) | 权限、插件、版本、图标 |
| **依赖管理** | [mobile/package.json](mobile/package.json) | npm 依赖版本 |
| **AWS 配置** | [mobile/src/config/aws-config.ts](mobile/src/config/aws-config.ts) | Cognito + API URL |
| **国际化** | [mobile/src/i18n/index.ts](mobile/src/i18n/index.ts) | 语言初始化 |
| **情绪定义** | [mobile/src/types/emotion.ts](mobile/src/types/emotion.ts) | 24 种情绪类型 |
| **后端入口** | `backend/app/main.py` | FastAPI 应用 |
| **后端环境变量** | `backend/.env` | 敏感配置（不提交到 Git） |

---

## 8. 安全与隐私

### 8.1 敏感信息管理
- ✅ JWT Token 存储在 **SecureStore**（iOS Keychain / Android Keystore）
- ✅ `.env` 文件永远不提交到 Git（已在 `.gitignore` 中）
- ✅ API 密钥通过环境变量注入（Lambda 环境变量）
- ✅ Sentry DSN 可以暴露（公开无安全风险）

### 8.2 权限最小化原则
- 只请求必需的权限（麦克风、相册、通知）
- 在 `app.json` 中提供清晰的权限说明

### 8.3 数据加密
- 传输层：HTTPS（API + S3 预签名 URL）
- 存储层：SecureStore 加密存储

---

- 🔒 **隐私优先**: Apple/Google 登录 + 端到端加密
## 9. 总结

Thankly 是一个**架构清晰、功能完整的生产级 React Native 应用**，具有以下特点：

✅ **前端**：
- Expo/React Native 跨平台方案
- 模块化组件架构（34+ 可复用组件）
- Hook-based 状态管理
- 双语 i18n 支持
- 复杂的音频/图片处理流程

✅ **后端**：
- FastAPI 高性能 API
- AWS 生态集成（Cognito、DynamoDB、S3、Lambda）
- 多模型 AI（Whisper、GPT-4o、GPT-4o-mini）
- 异步并行处理

✅ **协作原则**：
- 先计划后执行
- 最小改动原则
- 明确改动说明
- 双平台兼容
- 详细验证步骤
- 保护敏感信息

---

**版本**: 1.0
**最后更新**: 2026-01-26
**维护者**: @dengdan (CTO)

---

*这份文档将帮助未来的 Claude 快速理解项目、遵循协作规则、避免常见陷阱。*
