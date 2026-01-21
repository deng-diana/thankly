# 亲密圈功能 - 完整实施方案

## 📋 功能概述

**功能名称：** Intimate Circle（亲密圈）

**核心价值：** 创建私密小圈子，与最亲密的人（情侣、夫妻、父母和孩子）安全地分享日记和真心话。

**目标用户：**

- 情侣/夫妻 — 分享日常甜蜜瞬间
- 父母和孩子 — 记录成长点滴
- 亲密好友 — 分享真实感受

**核心机制：** 邀请码 + 权限控制 + 隐私保护

---

## 🎯 导航架构重构（方案二：底部 Tab）

### 当前结构 vs 新结构

**当前：** Drawer Navigation（抽屉导航）

```
DrawerNavigator
├── DiaryListScreen
├── SearchScreen
├── SettingsScreen
└── ...
```

**新结构：** Bottom Tab Navigation（底部标签导航）

```
DrawerNavigator (保留，用于"更多"Tab)
└── TabNavigator (新增)
    ├── DiaryListScreen (📖 日记)
    ├── HappinessJarScreen (🍯 幸福罐)
    ├── CreateDiaryModal (➕ 创建) ← 模态页面
    ├── CircleScreen (💕 亲密圈)
    └── MoreScreen (☰ 更多)
```

### 底部导航栏设计

```
┌─────────────────────────────────┐
│                                 │
│  [页面内容]                     │
│                                 │
├─────────────────────────────────┤
│  📖      🍯      ➕      💕      ☰ │
│  日记    幸福罐   创建   亲密圈  更多│
└─────────────────────────────────┘
```

**Tab 说明：**

1. **📖 日记** — 日记列表（首页）
2. **🍯 幸福罐** — 快乐回忆集合
3. **➕ 创建** — 创建新日记（中间大按钮，突出显示）
4. **💕 亲密圈** — 亲密圈列表和管理
5. **☰ 更多** — 设置、统计、关于等（原 Drawer 内容）

**设计规范：**

- 背景色：`#FFFBF5`
- 激活色：`#E56C45`（品牌橙）
- 未激活色：`#80645A`
- 高度：`60px`
- 字体：`Lora-Regular, 11px`
- 中间按钮：`56x56px`，向上突出 `20px`

---

## 🗄️ 数据库设计

### 表 1: Circle（圈子表）

| 字段         | 类型      | 说明          | 示例                   |
| ------------ | --------- | ------------- | ---------------------- |
| id           | UUID      | 圈子唯一 ID   | `circle_abc123`        |
| name         | String    | 圈子名称      | `我和老公的小世界`     |
| invite_code  | String(6) | 邀请码        | `ABC123`               |
| creator_id   | UUID      | 创建者用户 ID | `user_diana`           |
| member_limit | Integer   | 成员上限      | `2`                    |
| created_at   | DateTime  | 创建时间      | `2026-01-18T10:00:00Z` |
| updated_at   | DateTime  | 更新时间      | `2026-01-18T10:00:00Z` |

**索引：**

- `invite_code` (唯一索引)
- `creator_id`

---

### 表 2: CircleMember（成员表）

| 字段      | 类型     | 说明        | 示例                   |
| --------- | -------- | ----------- | ---------------------- |
| id        | UUID     | 成员记录 ID | `member_1`             |
| circle_id | UUID     | 所属圈子 ID | `circle_abc123`        |
| user_id   | UUID     | 用户 ID     | `user_diana`           |
| role      | Enum     | 角色        | `creator` / `member`   |
| joined_at | DateTime | 加入时间    | `2026-01-18T10:00:00Z` |

**索引：**

- `circle_id, user_id` (联合唯一索引)
- `user_id`

**角色权限：**

- `creator` — 创建者（可邀请、移除成员、解散圈子）
- `member` — 普通成员（可分享日记、退出圈子）

---

### 表 3: SharedDiary（分享表）

| 字段      | 类型     | 说明        | 示例                   |
| --------- | -------- | ----------- | ---------------------- |
| id        | UUID     | 分享记录 ID | `share_1`              |
| diary_id  | UUID     | 日记 ID     | `diary_abc`            |
| circle_id | UUID     | 圈子 ID     | `circle_abc123`        |
| shared_by | UUID     | 分享者 ID   | `user_diana`           |
| shared_at | DateTime | 分享时间    | `2026-01-20T15:30:00Z` |

**索引：**

- `circle_id, shared_at` (用于按时间排序)
- `diary_id, circle_id` (联合唯一索引，防止重复分享)

---

## 🔧 后端 API 设计

### API 1: 创建圈子

**Endpoint:** `POST /api/circle/create`

**请求：**

```json
{
  "name": "我和老公的小世界",
  "member_limit": 2
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "circle_id": "circle_abc123",
    "name": "我和老公的小世界",
    "invite_code": "ABC123",
    "created_at": "2026-01-18T10:00:00Z"
  }
}
```

**业务逻辑：**

1. 生成 6 位邀请码（大写字母+数字，排除 0/O/I/1）
2. 创建圈子记录
3. 自动将创建者加入圈子（role: creator）
4. 返回邀请码

---

### API 2: 加入圈子

**Endpoint:** `POST /api/circle/join`

**请求：**

```json
{
  "invite_code": "ABC123"
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "circle_id": "circle_abc123",
    "circle_name": "我和老公的小世界",
    "member_count": 2
  }
}
```

**业务逻辑：**

1. 验证邀请码是否存在
2. 检查圈子是否已满
3. 检查用户是否已是成员
4. 添加成员记录（role: member）
5. 返回圈子信息

---

### API 3: 获取我的圈子列表

**Endpoint:** `GET /api/circle/my-circles`

**响应：**

```json
{
  "success": true,
  "data": {
    "circles": [
      {
        "circle_id": "circle_abc123",
        "name": "我和老公的小世界",
        "role": "creator",
        "member_count": 2,
        "shared_count": 15,
        "invite_code": "ABC123",
        "created_at": "2026-01-18T10:00:00Z"
      }
    ]
  }
}
```

---

### API 4: 分享日记到圈子

**Endpoint:** `POST /api/circle/share-diary`

**请求：**

```json
{
  "diary_id": "diary_abc",
  "circle_id": "circle_abc123"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已分享到「我和老公的小世界」"
}
```

**业务逻辑：**

1. 验证日记所有权
2. 验证用户是否是圈子成员
3. 检查是否已分享（防止重复）
4. 创建分享记录
5. 返回成功

---

### API 5: 获取圈子分享的日记

**Endpoint:** `GET /api/circle/{circle_id}/shared-diaries`

**响应：**

```json
{
  "success": true,
  "data": {
    "circle_name": "我和老公的小世界",
    "diaries": [
      {
        "diary_id": "diary_abc",
        "content": "今天做了你最爱吃的红烧肉...",
        "emotion": "Joyful",
        "images": ["https://..."],
        "audio_url": "https://...",
        "shared_by": {
          "user_id": "user_diana",
          "username": "Diana"
        },
        "shared_at": "2026-01-20T15:30:00Z"
      }
    ]
  }
}
```

---

### API 6: 撤回分享

**Endpoint:** `DELETE /api/circle/unshare-diary`

**请求：**

```json
{
  "diary_id": "diary_abc",
  "circle_id": "circle_abc123"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已撤回分享"
}
```

---

### API 7: 移除成员（仅创建者）

**Endpoint:** `POST /api/circle/remove-member`

**请求：**

```json
{
  "circle_id": "circle_abc123",
  "user_id": "user_husband"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已移除成员"
}
```

---

### API 8: 退出圈子

**Endpoint:** `POST /api/circle/leave`

**请求：**

```json
{
  "circle_id": "circle_abc123"
}
```

**响应：**

```json
{
  "success": true,
  "message": "已退出圈子"
}
```

---

### API 9: 解散圈子（仅创建者）

**Endpoint:** `DELETE /api/circle/{circle_id}`

**响应：**

```json
{
  "success": true,
  "message": "圈子已解散"
}
```

**业务逻辑：**

1. 验证创建者权限
2. 删除所有分享记录
3. 删除所有成员记录
4. 删除圈子记录

---

## 🎨 前端 UI 设计

### 页面 1: 亲密圈列表（CircleScreen）

```
┌─────────────────────────────────┐
│  亲密圈 💕                       │
├─────────────────────────────────┤
│                                 │
│  [+ 创建新圈子]                 │
│  [🔗 加入圈子]                  │
│                                 │
│  我的圈子 (2)                   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 我和老公的小世界         │   │
│  │ 2 人 · 15 条分享        │   │
│  │ 创建者 · 邀请码: ABC123 │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 我和宝宝的成长记录       │   │
│  │ 2 人 · 8 条分享         │   │
│  │ 成员                    │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

### 页面 2: 圈子详情（CircleDetailScreen）

```
┌─────────────────────────────────┐
│  ← 我和老公的小世界      [设置] │
├─────────────────────────────────┤
│  成员 (2/2)                     │
│  👤 Diana (创建者)              │
│  👤 老公                        │
│                                 │
│  邀请码：ABC123  [分享]  [复制] │
│                                 │
│  ─────────────────────────      │
│                                 │
│  分享的日记 (15)                │
│                                 │
│  📅 今天 15:30                  │
│  Diana 分享：                   │
│  "今天做了你最爱吃的..."        │
│  😊 Joyful                      │
│  [查看完整内容]                 │
│                                 │
│  📅 昨天 20:15                  │
│  老公 分享：                    │
│  "今天加班很累，但想到你..."    │
│  💪 Confident                   │
│  [查看完整内容]                 │
│                                 │
└─────────────────────────────────┘
```

---

### 页面 3: 创建圈子（CreateCircleModal）

```
┌─────────────────────────────────┐
│  创建亲密圈                     │
├─────────────────────────────────┤
│                                 │
│  圈子名称                       │
│  ┌─────────────────────────┐   │
│  │ 我和老公的小世界         │   │
│  └─────────────────────────┘   │
│                                 │
│  成员上限                       │
│  ┌─────────────────────────┐   │
│  │ 2 人                    │   │
│  └─────────────────────────┘   │
│                                 │
│  💡 提示：                      │
│  • 圈子创建后会生成邀请码       │
│  • 只有你邀请的人才能加入       │
│  • 你可以随时管理成员           │
│                                 │
│  [取消]              [创建]     │
│                                 │
└─────────────────────────────────┘
```

---

### 页面 4: 加入圈子（JoinCircleModal）

```
┌─────────────────────────────────┐
│  加入亲密圈                     │
├─────────────────────────────────┤
│                                 │
│  请输入邀请码                   │
│  ┌─────────────────────────┐   │
│  │ ABC123                  │   │
│  └─────────────────────────┘   │
│                                 │
│  💡 提示：                      │
│  • 邀请码由圈子创建者提供       │
│  • 输入后即可查看圈子信息       │
│  • 确认后即可加入               │
│                                 │
│  [取消]              [加入]     │
│                                 │
└─────────────────────────────────┘
```

---

### 页面 5: 日记详情页（新增分享按钮）

在现有的 `DiaryDetailScreen` 中添加"分享到亲密圈"按钮。

```
┌─────────────────────────────────┐
│  ← 日记详情              [···]  │
├─────────────────────────────────┤
│                                 │
│  [日记内容]                     │
│                                 │
│  ─────────────────────────      │
│                                 │
│  [💕 分享到亲密圈]              │  ← 新增按钮
│                                 │
└─────────────────────────────────┘
```

点击后弹出圈子选择器：

```
┌─────────────────────────────────┐
│  分享到哪个圈子？               │
├─────────────────────────────────┤
│  ○ 我和老公的小世界             │
│  ○ 我和宝宝的成长记录           │
│                                 │
│  [取消]              [分享]     │
└─────────────────────────────────┘
```

---

## 🔐 隐私与安全

### 1. 邀请码生成算法

```python
import random
import string

def generate_invite_code():
    # 排除易混淆字符：0, O, I, 1
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    code = ''.join(random.choice(chars) for _ in range(6))

    # 检查唯一性
    while db.query(Circle).filter(Circle.invite_code == code).first():
        code = ''.join(random.choice(chars) for _ in range(6))

    return code
```

**安全性分析：**

- 字符集：30 个字符
- 长度：6 位
- 组合数：30^6 = 729,000,000（7.29 亿）
- 暴力破解难度：极高

---

### 2. 权限控制矩阵

| 操作           | 创建者 | 成员 | 非成员 |
| -------------- | ------ | ---- | ------ |
| 查看圈子信息   | ✅     | ✅   | ❌     |
| 查看分享的日记 | ✅     | ✅   | ❌     |
| 分享日记       | ✅     | ✅   | ❌     |
| 撤回自己的分享 | ✅     | ✅   | ❌     |
| 邀请新成员     | ✅     | ❌   | ❌     |
| 移除成员       | ✅     | ❌   | ❌     |
| 解散圈子       | ✅     | ❌   | ❌     |
| 退出圈子       | ❌     | ✅   | ❌     |

---

### 3. 数据隐私保护

**原则：**

1. **日记所有权不变** — 分享只是创建引用，不复制数据
2. **可撤回** — 用户随时可以撤回分享
3. **级联删除** — 删除日记时自动删除分享记录
4. **退出即失效** — 退出圈子后立即失去访问权限

**实现：**

```python
# 级联删除
class Diary(Base):
    shared_records = relationship(
        "SharedDiary",
        cascade="all, delete-orphan"
    )

# 退出圈子时的处理
def leave_circle(user_id, circle_id):
    # 删除成员记录
    db.query(CircleMember).filter(
        CircleMember.user_id == user_id,
        CircleMember.circle_id == circle_id
    ).delete()

    # 不删除分享记录，但用户无法再访问
    db.commit()
```

---

## 🚀 实施步骤

### Phase 1: 导航重构（2 天）

1. ✅ 安装 `@react-navigation/bottom-tabs`
2. ✅ 创建 `TabNavigator.tsx`
3. ✅ 重构 `AppNavigator.tsx`
4. ✅ 调整各页面的 header 配置
5. ✅ 测试导航切换

### Phase 2: 后端开发（3 天）

1. ✅ 创建数据库表（Circle, CircleMember, SharedDiary）
2. ✅ 实现 9 个 API 接口
3. ✅ 编写单元测试
4. ✅ 部署到 Lambda

### Phase 3: 前端开发（4 天）

1. ✅ 创建 `CircleScreen.tsx`（列表页）
2. ✅ 创建 `CircleDetailScreen.tsx`（详情页）
3. ✅ 创建 `CreateCircleModal.tsx`（创建圈子）
4. ✅ 创建 `JoinCircleModal.tsx`（加入圈子）
5. ✅ 修改 `DiaryDetailScreen.tsx`（添加分享按钮）
6. ✅ 添加国际化文案

### Phase 4: 测试与优化（1 天）

1. ✅ 功能测试（创建、加入、分享、退出）
2. ✅ 权限测试（创建者 vs 成员）
3. ✅ 边界测试（圈子已满、邀请码错误等）
4. ✅ UI 细节调整

---

## 📊 成功指标

### 数据指标

- 圈子创建率 > 20%（DAU 中的占比）
- 日记分享率 > 30%（有圈子的用户）
- 圈子活跃度 > 50%（7 天内有分享）

### 用户反馈

- App Store 评论提及"亲密圈"
- 用户推荐给亲密伙伴

---

## 🔄 未来迭代

### v1.4.0 可能的优化

1. **评论功能** — 圈子成员可以评论分享的日记
2. **通知功能** — 有新分享时推送通知
3. **圈子主题** — 自定义圈子背景和图标
4. **多圈子管理** — 支持创建多个圈子

---

## 📚 相关文档

- [幸福罐功能实施文档](./HAPPINESS_JAR_FEATURE.md)
- [搜索功能实施文档](./SEARCH_FEATURE_IMPLEMENTATION.md)
- [导航架构设计](./NAVIGATION_ARCHITECTURE.md)

---

**文档版本：** v1.0  
**创建日期：** 2026-01-18  
**最后更新：** 2026-01-18  
**负责人：** Diana Deng  
**优先级：** P1（核心功能）  
**预计工期：** 10 天
