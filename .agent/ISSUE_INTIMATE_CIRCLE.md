# Issue: 亲密圈功能（Intimate Circle）

**类型**: 🚀 Feature
**优先级**: 🔴 HIGH（核心竞争力）
**预估工作量**: 4周（1个全职开发）
**创建时间**: 2026-01-27

---

## TL;DR

**一句话描述**：
> 让用户创建私密圈子（如"我的家"），通过邀请码邀请家人/好友加入，分享AI润色的日记，增进情感连接。

**核心场景**：
- 留守儿童与父母保持情感连接
- 异地情侣分享日常生活
- 家庭成员互相了解彼此状态

---

## 当前状态 vs 期望状态

### 当前状态 ❌
- 用户只能独自写日记
- 日记无法分享给特定人群
- 家人/好友想了解用户生活，但缺乏渠道
- 产品缺乏社交属性，留存依赖个人自律

### 期望状态 ✅
- 用户可以创建"亲密圈"（如"我的家"、"好友圈"）
- 通过邀请码邀请成员加入
- 写日记时可选择分享到圈子
- 成员可查看彼此的日记（包含AI反馈、情绪标签）
- 新日记发布时推送通知给圈子成员
- 通过"看见"而非"评论"建立情感连接（MVP不做评论点赞）

---

## MVP 功能清单（4周）

### Week 1：后端基础
- [ ] DynamoDB表设计（circles, circle_members, diary_shares）
- [ ] 圈子管理API（创建、加入、成员列表）
- [ ] 日记分享API（分享、取消分享、动态流）

### Week 2：前端页面
- [ ] 圈子列表页（[screens/CircleListScreen.tsx](mobile/src/screens/CircleListScreen.tsx)）
- [ ] 创建/加入圈子Modal
- [ ] 分享选择器（集成到日记创建流程）
- [ ] 圈子动态流（[screens/CircleDetailScreen.tsx](mobile/src/screens/CircleDetailScreen.tsx)）

### Week 3：推送通知 + 优化
- [ ] 集成Expo Push Notifications
- [ ] 新日记分享通知
- [ ] 新成员加入通知
- [ ] UI/UX打磨（空状态、加载动画、错误提示）

### Week 4：测试 + 打磨
- [ ] 完整流程测试
- [ ] 性能优化（动态流分页、缓存）
- [ ] 国际化（中英文翻译）
- [ ] 更新文档

---

## 核心技术要点

### 前端（React Native）
- **新增页面**：2个（CircleListScreen, CircleDetailScreen）
- **新增组件**：4个（CreateCircleModal, JoinCircleModal, CircleShareSelector, CircleDiaryCard）
- **新增服务**：1个（[services/circleService.ts](mobile/src/services/circleService.ts)）
- **集成点**：
  - [screens/DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx) - 添加"分享到圈子"选项
  - [components/RecordingModal.tsx](mobile/src/components/RecordingModal.tsx) - 语音日记分享
  - [navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) - 添加圈子页面路由

### 后端（FastAPI + AWS）
- **新增表**：3个（circles, circle_members, diary_shares）
- **新增路由**：1个（[backend/app/routers/circle.py](backend/app/routers/circle.py)）
- **新增服务**：2个（CircleService, NotificationService）
- **依赖**：Expo Push Notifications API

### 数据库设计（DynamoDB）

**circles 表**：
```
PK: circleId
GSI 1: userId-createdAt-index（查询我创建的圈子）
GSI 2: inviteCode-index（邀请码加入）
```

**circle_members 表**：
```
PK: circleId + userId（复合主键）
GSI: userId-joinedAt-index（查询我加入的圈子）
```

**diary_shares 表**：
```
PK: shareId
GSI 1: diaryId-index（查询日记分享到哪些圈子）
GSI 2: circleId-sharedAt-index（查询圈子动态流）
```

---

## 影响的文件（预估）

### 新增文件（~10个）
- `mobile/src/screens/CircleListScreen.tsx`
- `mobile/src/screens/CircleDetailScreen.tsx`
- `mobile/src/components/CreateCircleModal.tsx`
- `mobile/src/components/JoinCircleModal.tsx`
- `mobile/src/components/CircleShareSelector.tsx`
- `mobile/src/services/circleService.ts`
- `backend/app/routers/circle.py`
- `backend/app/services/circle_service.py`
- `backend/app/services/notification_service.py`
- `backend/app/models/circle.py`

### 修改文件（~5个）
- [mobile/src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx) - 添加圈子页面路由
- [mobile/src/screens/DiaryListScreen.tsx](mobile/src/screens/DiaryListScreen.tsx) - 添加侧边栏入口
- [mobile/src/components/RecordingModal.tsx](mobile/src/components/RecordingModal.tsx) - 集成分享选择器
- [backend/app/services/dynamodb_service.py](backend/app/services/dynamodb_service.py) - 添加圈子相关查询方法
- [mobile/src/i18n/en.ts](mobile/src/i18n/en.ts) + [mobile/src/i18n/zh.ts](mobile/src/i18n/zh.ts) - 翻译

---

## 风险与注意事项 ⚠️

### 高风险点
1. **推送通知可靠性**：Expo免费推送有限额，生产环境需考虑AWS SNS
2. **DynamoDB查询性能**：动态流需要分页 + GSI优化
3. **用户教育成本**：需要好的新手引导，避免用户困惑

### 技术难点
1. **邀请码唯一性**：需要collision检测
2. **推送跳转逻辑**：Deep Link配置
3. **权限控制**：非成员不能查看圈子内容

### 产品风险
1. **隐私顾虑**：用户可能不愿分享日记 → **解决**：分享默认关闭，可随时取消
2. **活跃度低**：圈子无互动会冷场 → **解决**：推送提醒 + 情绪可视化（V2.0）
3. **邀请门槛高**：邀请码输入繁琐 → **解决**：一键复制 + 二维码（V2.0）

---

## 成功指标

### 核心指标
- **圈子创建率** > 30%（有30%用户创建/加入圈子）
- **日记分享率** > 20%（有20%日记被分享到圈子）
- **推送点击率** > 40%（用户对圈子动态感兴趣）
- **7日留存提升** > 10%（相比无圈子用户）

### 验收标准
- ✅ 创建圈子 → 生成邀请码 → 分享给好友 → 好友加入成功
- ✅ 写日记 → 分享到圈子 → 成员收到推送 → 点击查看
- ✅ 圈子动态流展示所有成员日记，按时间倒序
- ✅ 取消分享后，日记从圈子中消失
- ✅ 退出圈子后，无法查看圈子内容
- ✅ 中英文翻译完整

---

## 相关文档

- 📄 **完整PRD**：[/Users/dengdan/Desktop/thankly/.agent/PRD_INTIMATE_CIRCLE.md](/Users/dengdan/Desktop/thankly/.agent/PRD_INTIMATE_CIRCLE.md)
- 📘 **项目协作指南**：[/Users/dengdan/Desktop/thankly/CLAUDE.md](/Users/dengdan/Desktop/thankly/CLAUDE.md)

---

## 下一步行动

1. **产品评审**：确认MVP范围是否合理
2. **技术评审**：评估技术方案可行性
3. **排期确认**：确定开发时间表
4. **用户调研**：访谈5-10个种子用户，验证需求

---

**问题讨论**：
- 圈子数量上限应该是多少？（建议免费3个，付费无限）
- 是否需要圈子管理员角色？（建议V2.0再加）
- 邀请码格式：6位数字 vs 6位字母+数字？（建议字母+数字，更安全）
