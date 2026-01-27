# PRD: 亲密圈功能（Intimate Circle）

**文档版本**: 1.0
**创建日期**: 2026-01-27
**产品经理**: AI Product Manager
**优先级**: 🔴 HIGH（核心竞争力功能）

---

## 📋 目录

1. [需求背景](#需求背景)
2. [产品定位](#产品定位)
3. [核心价值](#核心价值)
4. [竞品分析](#竞品分析)
5. [功能设计（MVP）](#功能设计mvp)
6. [用户流程](#用户流程)
7. [技术方案](#技术方案)
8. [数据模型](#数据模型)
9. [UI/UX 设计要点](#uiux-设计要点)
10. [实施计划](#实施计划)
11. [风险评估](#风险评估)
12. [成功指标](#成功指标)
13. [后续迭代方向](#后续迭代方向)

---

## 需求背景

### 用户痛点

**核心场景**：留守儿童、海外华人、异地情侣/夫妻、父母与孩子

> "我一个人在国外，跟父母交流不频繁，但互相挂念。电话太正式，微信聊天太碎片，想要一种更深入、更有温度的连接方式。"

**现有解决方案的不足**：
- ❌ **微信朋友圈**：太公开，不够私密，信息噪音大
- ❌ **小红书/Instagram**：偏展示性，缺乏情感深度
- ❌ **私聊**：太碎片化，难以系统回顾
- ❌ **传统日记App**：只能自己看，无法分享

**Thankly 的机会**：
- ✅ **已有AI润色能力**：让用户敢于分享真实情感
- ✅ **情绪分析**：可视化情感变化，让家人更懂彼此
- ✅ **语音/图片/文字**：多模态表达，更有温度
- ✅ **隐私优先**：天然适合私密分享场景

---

## 产品定位

### 一句话定位

> **亲密圈 = 小红书的私密度 × 日记的情感深度 × AI的温暖陪伴**

### 核心差异化

| 维度 | 微信/朋友圈 | 小红书 | Thankly 亲密圈 |
|------|------------|--------|---------------|
| **隐私性** | 中（可见范围难控制） | 低（公开） | 🔒 高（邀请制，端到端加密） |
| **情感深度** | 浅（碎片化聊天） | 浅（展示性内容） | ✨ 深（AI润色日记，情绪可视化） |
| **表达门槛** | 高（担心措辞） | 高（需要精修图片） | 🎤 低（AI自动美化，语音转文字） |
| **回顾价值** | 低（难以整理） | 中（仅图片） | 📅 高（情绪日历，时间线） |
| **互动方式** | 多（评论/点赞） | 多（评论/点赞） | 🤐 少（MVP无评论，避免表演性） |

### 关键洞察

**为什么不做评论点赞？（MVP阶段）**
- 📝 **真实性优先**：避免"表演式分享"，保持日记的私密性
- 💭 **被动理解**：通过"看见"而非"回应"来建立连接
- 🕰️ **时间沉淀**：先积累内容，再考虑互动

**类比产品**：BeReal + Day One + 微信"仅聊天可见"

---

## 核心价值

### 对用户的价值

#### 1️⃣ 情感陪伴（Emotional Companionship）
- **场景**：父母看到孩子的日记，感到安心："原来Ta在国外过得还不错"
- **价值**：减少焦虑，增加连接感

#### 2️⃣ 深度理解（Deep Understanding）
- **场景**：伴侣通过情绪曲线，发现对方最近压力大
- **价值**：察觉情绪变化，及时关心

#### 3️⃣ 低成本表达（Low-effort Sharing）
- **场景**：录30秒语音 → AI自动美化 → 一键分享到圈子
- **价值**：降低分享门槛，提高频率

#### 4️⃣ 时光胶囊（Time Capsule）
- **场景**：一年后回顾，看到彼此的成长轨迹
- **价值**：情感归档，关系增值

### 对产品的价值

#### 📈 提升用户粘性
- **日活提升**：分享到圈子 → 成员收到通知 → 打开查看 → 形成正反馈
- **留存提升**：社交关系 = 最强留存锚点

#### 💎 差异化竞争
- **护城河**：AI + 私密社交 = 难以复制的组合
- **口碑传播**：用户主动邀请家人/好友加入

#### 💰 商业化潜力
- **会员功能**：圈子数量上限、高级权限
- **企业版**：团队情绪健康管理

---

## 竞品分析

### 直接竞品

| 产品 | 定位 | 优势 | 劣势 | Thankly 差异化 |
|------|------|------|------|---------------|
| **微信朋友圈** | 社交网络 | 生态强大，用户基数大 | 隐私性差，信息噪音 | 🔒 私密 + AI润色 |
| **小红书** | 生活方式社区 | 内容质量高，视觉精美 | 太公开，表演性强 | 💭 真实情感 + 亲密关系 |
| **Daylio/Moodflow** | 情绪追踪 | 数据可视化 | 无社交，难坚持 | 🤝 社交驱动 + AI生成内容 |
| **Locket Widget** | 照片分享 | 轻量，实时 | 仅照片，无文字深度 | 📝 多模态 + AI润色 |

### 间接竞品

- **BeReal**：真实性 + 好友圈层（但缺乏情感深度）
- **Day One**：优秀的日记工具（但完全私密，无社交）
- **微信视频号**：视频日记（但太公开）

### 竞品启示

✅ **学习**：
- Locket Widget 的轻量化交互（无评论点赞）
- BeReal 的"真实性优先"理念
- Day One 的情感记录深度

❌ **避免**：
- 朋友圈的公开焦虑
- 小红书的表演压力
- 传统日记的孤独感

---

## 功能设计（MVP）

### MVP 范围界定

#### ✅ 包含功能

1. **创建圈子**
   - 命名圈子（如"我的家"）
   - 生成邀请码（6位数字/字母）
   - 设置圈子头像（可选）

2. **加入圈子**
   - 输入邀请码加入
   - 显示圈子成员列表
   - 退出圈子功能

3. **分享日记到圈子**
   - 写日记时选择是否分享
   - 可选择分享到哪个圈子（多圈子场景）
   - 已发布的日记可补充分享

4. **查看圈子动态**
   - 时间流展示成员日记
   - 显示作者头像+名字
   - 显示情绪标签

5. **实时通知**
   - 成员发新日记时推送
   - 新成员加入提醒

#### ❌ 暂不包含（后续迭代）

- 评论/点赞功能
- @提及成员
- 圈子公告/置顶
- 圈子设置（权限管理、踢人）
- 圈子数据统计（情绪趋势对比）
- 圈子日历视图

---

## 用户流程

### 流程 1：创建圈子

```
用户打开 App → 侧边栏"亲密圈" → "创建圈子"
→ 输入圈子名称（如"我的家"）
→ 系统生成6位邀请码（如 A3F9K2）
→ 用户复制邀请码 → 通过微信分享给家人
```

**关键决策点**：
- ❓ **圈子数量上限**：免费用户3个，付费无限（商业化方向）
- ❓ **邀请码有效期**：永久有效（简化逻辑）

### 流程 2：加入圈子

```
家人收到邀请码 → 打开 Thankly → "加入圈子"
→ 输入邀请码（A3F9K2）
→ 显示圈子信息（名称、成员数）
→ 确认加入 → 加入成功 → 可查看圈子动态
```

**关键决策点**：
- ❓ **需要审批吗？**：不需要（信任机制）
- ❓ **邀请码复用**：可以（一码多用）

### 流程 3：分享日记到圈子

**场景A：写新日记时分享**
```
录音/写文字 → AI处理完成 → 显示日记预览
→ 底部显示"分享到圈子"开关
→ 打开开关 → 选择圈子（多选）
→ 确认保存 → 日记同步到圈子
→ 圈子成员收到推送通知
```

**场景B：已有日记补充分享**
```
打开已发布的日记 → 点击"分享"按钮
→ 选择要分享的圈子
→ 确认 → 日记出现在圈子动态中
```

**关键决策点**：
- ❓ **默认是否分享**：默认关闭（保护隐私）
- ❓ **可以取消分享吗**：可以（删除圈子分享，但原日记保留）

### 流程 4：查看圈子动态

```
侧边栏"亲密圈" → 选择一个圈子
→ 看到成员日记时间流（最新在上）
→ 每条日记显示：
   - 作者头像 + 名字
   - 日记标题
   - 情绪标签
   - 发布时间
   - 缩略图（如有）
→ 点击日记 → 查看完整内容
```

**关键决策点**：
- ❓ **可以看到AI反馈吗**：可以（增加温暖感）
- ❓ **可以看到音频吗**：可以（完整体验）

---

## 技术方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React Native)                  │
├─────────────────────────────────────────────────────────────┤
│  - CircleListScreen (圈子列表)                               │
│  - CircleDetailScreen (圈子动态流)                           │
│  - CreateCircleModal (创建圈子)                              │
│  - JoinCircleModal (加入圈子)                                │
│  - DiaryShareSelector (分享选择器)                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│                    后端 (FastAPI + AWS)                       │
├─────────────────────────────────────────────────────────────┤
│  - /circle (圈子管理)                                        │
│  - /circle/{id}/members (成员管理)                           │
│  - /circle/{id}/diaries (圈子动态)                           │
│  - /diary/{id}/share (分享日记)                              │
└─────────────────────────────────────────────────────────────┘
        ↓ boto3                    ↓ SNS/FCM
┌──────────────────┐      ┌──────────────────┐
│   DynamoDB       │      │   推送通知        │
│  - circles 表    │      │  - iOS APNs      │
│  - circle_       │      │  - Android FCM   │
│    members 表    │      └──────────────────┘
│  - diary_shares  │
│    表            │
└──────────────────┘
```

### 数据表设计

#### 1. `circles` 表（圈子基本信息）

```python
{
  "circleId": "uuid",              # 主键
  "userId": "创建者ID",            # GSI: userId-createdAt-index
  "circleName": "我的家",
  "inviteCode": "A3F9K2",          # GSI: inviteCode-index（唯一）
  "avatarUrl": "https://...",      # 可选
  "createdAt": "2026-01-27T10:00:00Z",
  "memberCount": 3,                # 冗余字段，提高查询性能
  "itemType": "circle"
}
```

**索引设计**：
- 主键：`circleId`
- GSI 1：`userId-createdAt-index`（查询我创建的圈子）
- GSI 2：`inviteCode-index`（通过邀请码加入）

#### 2. `circle_members` 表（圈子成员关系）

```python
{
  "circleId": "uuid",              # 主键（分区键）
  "userId": "uuid",                # 主键（排序键）
  "userName": "小明",              # 冗余字段
  "userAvatar": "https://...",     # 冗余字段
  "joinedAt": "2026-01-27T10:00:00Z",
  "role": "owner" | "member",      # owner=创建者, member=成员
  "itemType": "circle_member"
}
```

**复合主键**：`circleId + userId`（天然去重）

**GSI**：`userId-joinedAt-index`（查询我加入的所有圈子）

#### 3. `diary_shares` 表（日记分享关系）

```python
{
  "shareId": "uuid",               # 主键
  "diaryId": "uuid",               # GSI: diaryId-index
  "circleId": "uuid",              # GSI: circleId-sharedAt-index
  "userId": "分享者ID",
  "sharedAt": "2026-01-27T10:00:00Z",
  "itemType": "diary_share"
}
```

**索引设计**：
- 主键：`shareId`
- GSI 1：`diaryId-index`（查询日记分享到哪些圈子）
- GSI 2：`circleId-sharedAt-index`（查询圈子动态流，按时间倒序）

**为什么需要独立的分享表？**
- ✅ 一篇日记可以分享到多个圈子
- ✅ 可以取消分享（删除 share 记录，不删除原日记）
- ✅ 性能优化：避免扫描整个 diary 表

#### 4. `diaries` 表（扩展字段）

**新增字段**：
```python
{
  # ... 原有字段 ...
  "sharedCircles": ["circleId1", "circleId2"],  # 冗余字段，用于快速判断
  "isShared": true,                              # 是否已分享到任何圈子
}
```

---

### API 设计

#### 1. 圈子管理

**创建圈子**
```http
POST /circle
Authorization: Bearer {token}
Content-Type: application/json

{
  "circle_name": "我的家",
  "avatar_url": "https://..."  # 可选
}

Response 200:
{
  "circle_id": "uuid",
  "circle_name": "我的家",
  "invite_code": "A3F9K2",
  "created_at": "2026-01-27T10:00:00Z"
}
```

**通过邀请码加入圈子**
```http
POST /circle/join
Authorization: Bearer {token}
Content-Type: application/json

{
  "invite_code": "A3F9K2"
}

Response 200:
{
  "circle": {
    "circle_id": "uuid",
    "circle_name": "我的家",
    "member_count": 3
  }
}

Error 404:
{
  "error": "邀请码不存在"
}
```

**获取我的圈子列表**
```http
GET /circle/my-circles
Authorization: Bearer {token}

Response 200:
{
  "circles": [
    {
      "circle_id": "uuid",
      "circle_name": "我的家",
      "member_count": 3,
      "role": "owner",
      "avatar_url": "https://..."
    },
    {
      "circle_id": "uuid2",
      "circle_name": "好友圈",
      "member_count": 5,
      "role": "member",
      "avatar_url": "https://..."
    }
  ]
}
```

**获取圈子成员列表**
```http
GET /circle/{circle_id}/members
Authorization: Bearer {token}

Response 200:
{
  "members": [
    {
      "user_id": "uuid",
      "user_name": "小明",
      "user_avatar": "https://...",
      "joined_at": "2026-01-27T10:00:00Z",
      "role": "owner"
    }
  ]
}
```

**退出圈子**
```http
DELETE /circle/{circle_id}/members/{user_id}
Authorization: Bearer {token}

Response 200:
{
  "message": "已退出圈子"
}

Error 403:
{
  "error": "创建者不能退出圈子（请先转让或删除圈子）"
}
```

#### 2. 日记分享

**分享日记到圈子**
```http
POST /diary/{diary_id}/share
Authorization: Bearer {token}
Content-Type: application/json

{
  "circle_ids": ["uuid1", "uuid2"]
}

Response 200:
{
  "message": "已分享到 2 个圈子",
  "shared_circles": [
    {
      "circle_id": "uuid1",
      "circle_name": "我的家"
    }
  ]
}
```

**取消分享**
```http
DELETE /diary/{diary_id}/share/{circle_id}
Authorization: Bearer {token}

Response 200:
{
  "message": "已取消分享"
}
```

**获取圈子动态流**
```http
GET /circle/{circle_id}/diaries?limit=20&last_evaluated_key={token}
Authorization: Bearer {token}

Response 200:
{
  "diaries": [
    {
      "diary_id": "uuid",
      "user_id": "uuid",
      "user_name": "小明",
      "user_avatar": "https://...",
      "title": "今天很开心",
      "emotion": "happy",
      "shared_at": "2026-01-27T10:00:00Z",
      "preview_content": "今天天气很好...",  # 前100字
      "has_audio": true,
      "has_images": true,
      "image_urls": ["https://..."]
    }
  ],
  "last_evaluated_key": "..."  # 分页token
}
```

#### 3. 推送通知

**新日记分享通知**
```
标题: 📝 小明分享了新日记
内容: "今天很开心" - 来自"我的家"圈子
跳转: 打开圈子动态页
```

**新成员加入通知**
```
标题: 👋 新成员加入
内容: 小红加入了"我的家"圈子
跳转: 打开圈子成员页
```

---

### 前端实现

#### 新增页面/组件

| 文件路径 | 说明 |
|---------|------|
| `screens/CircleListScreen.tsx` | 圈子列表页（侧边栏入口） |
| `screens/CircleDetailScreen.tsx` | 圈子动态流 |
| `components/CreateCircleModal.tsx` | 创建圈子弹窗 |
| `components/JoinCircleModal.tsx` | 加入圈子弹窗 |
| `components/CircleShareSelector.tsx` | 日记分享选择器 |
| `components/CircleDiaryCard.tsx` | 圈子动态卡片（复用DiaryCard） |
| `services/circleService.ts` | 圈子API调用 |

#### 关键技术点

**1. 推送通知（使用 Expo Notifications）**

```typescript
// mobile/src/services/notificationService.ts

// 已有的每日提醒逻辑
// ✅ 扩展：新增圈子消息推送

export async function registerPushToken() {
  const token = await Notifications.getExpoPushTokenAsync();
  // 上传到后端，关联 userId
  await apiService.post('/user/push-token', {
    push_token: token.data
  });
}

// 监听推送点击，跳转到对应圈子
Notifications.addNotificationResponseReceivedListener(response => {
  const { circleId } = response.notification.request.content.data;
  if (circleId) {
    navigation.navigate('CircleDetail', { circleId });
  }
});
```

**2. 分享选择器（类似微信发朋友圈的"谁可以看"）**

```typescript
// CreateTextDiaryScreen.tsx 中集成

<CircleShareSelector
  selectedCircles={selectedCircles}
  onSelectCircles={(circles) => setSelectedCircles(circles)}
/>

// 保存日记时
const newDiary = await createTextDiary({ content });
if (selectedCircles.length > 0) {
  await shareDiaryToCircles(newDiary.diary_id, selectedCircles);
}
```

**3. 圈子动态流（复用 DiaryCard，添加作者信息）**

```typescript
<FlatList
  data={circleDiaries}
  renderItem={({ item }) => (
    <View>
      {/* 作者信息条 */}
      <View style={styles.authorBar}>
        <Image source={{ uri: item.user_avatar }} />
        <Text>{item.user_name}</Text>
        <Text>{formatTime(item.shared_at)}</Text>
      </View>
      {/* 复用日记卡片 */}
      <DiaryCard diary={item} />
    </View>
  )}
/>
```

---

### 后端实现

#### 新增路由

```python
# backend/app/routers/circle.py

from fastapi import APIRouter, Depends, HTTPException
from ..services.circle_service import CircleService
from ..utils.cognito_auth import get_current_user

router = APIRouter(prefix="/circle", tags=["circle"])
circle_service = CircleService()

@router.post("")
async def create_circle(
    circle_name: str,
    avatar_url: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """创建圈子"""
    return circle_service.create_circle(
        user_id=user['sub'],
        circle_name=circle_name,
        avatar_url=avatar_url
    )

@router.post("/join")
async def join_circle(
    invite_code: str,
    user: dict = Depends(get_current_user)
):
    """通过邀请码加入圈子"""
    return circle_service.join_circle(
        user_id=user['sub'],
        invite_code=invite_code
    )

@router.get("/my-circles")
async def get_my_circles(
    user: dict = Depends(get_current_user)
):
    """获取我的圈子列表"""
    return circle_service.get_user_circles(user['sub'])

@router.get("/{circle_id}/members")
async def get_circle_members(
    circle_id: str,
    user: dict = Depends(get_current_user)
):
    """获取圈子成员"""
    # 验证用户是否在圈子中
    if not circle_service.is_member(circle_id, user['sub']):
        raise HTTPException(403, "无权访问此圈子")
    return circle_service.get_members(circle_id)

@router.delete("/{circle_id}/members/{user_id}")
async def leave_circle(
    circle_id: str,
    user_id: str,
    user: dict = Depends(get_current_user)
):
    """退出圈子"""
    # 只能退出自己
    if user_id != user['sub']:
        raise HTTPException(403, "只能退出自己")
    return circle_service.leave_circle(circle_id, user_id)

@router.get("/{circle_id}/diaries")
async def get_circle_diaries(
    circle_id: str,
    limit: int = 20,
    last_evaluated_key: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """获取圈子动态流"""
    if not circle_service.is_member(circle_id, user['sub']):
        raise HTTPException(403, "无权访问此圈子")
    return circle_service.get_circle_diaries(
        circle_id,
        limit,
        last_evaluated_key
    )
```

#### 新增服务

```python
# backend/app/services/circle_service.py

import uuid
import random
import string
from typing import List, Dict, Optional
from ..services.dynamodb_service import DynamoDBService
from ..services.notification_service import NotificationService

class CircleService:
    def __init__(self):
        self.db = DynamoDBService()
        self.notification_service = NotificationService()

    def _generate_invite_code(self) -> str:
        """生成6位邀请码（字母+数字，大写）"""
        while True:
            code = ''.join(random.choices(
                string.ascii_uppercase + string.digits,
                k=6
            ))
            # 检查邀请码是否已存在
            existing = self.db.query_by_invite_code(code)
            if not existing:
                return code

    def create_circle(
        self,
        user_id: str,
        circle_name: str,
        avatar_url: Optional[str] = None
    ) -> Dict:
        """创建圈子"""
        circle_id = str(uuid.uuid4())
        invite_code = self._generate_invite_code()

        # 创建圈子记录
        circle = self.db.create_circle(
            circle_id=circle_id,
            user_id=user_id,
            circle_name=circle_name,
            invite_code=invite_code,
            avatar_url=avatar_url
        )

        # 创建者自动加入
        self.db.add_circle_member(
            circle_id=circle_id,
            user_id=user_id,
            role="owner"
        )

        return circle

    def join_circle(self, user_id: str, invite_code: str) -> Dict:
        """通过邀请码加入圈子"""
        # 查找圈子
        circle = self.db.query_by_invite_code(invite_code)
        if not circle:
            raise ValueError("邀请码不存在")

        circle_id = circle['circleId']

        # 检查是否已加入
        if self.is_member(circle_id, user_id):
            raise ValueError("已经是圈子成员")

        # 添加成员
        self.db.add_circle_member(
            circle_id=circle_id,
            user_id=user_id,
            role="member"
        )

        # 更新成员数
        self.db.increment_member_count(circle_id)

        # 通知其他成员
        await self.notification_service.notify_new_member(
            circle_id,
            user_id
        )

        return {"circle": circle}

    def get_user_circles(self, user_id: str) -> List[Dict]:
        """获取用户加入的所有圈子"""
        # 查询 circle_members 表（GSI: userId-joinedAt-index）
        memberships = self.db.query_user_circles(user_id)

        # 补充圈子详细信息
        circles = []
        for m in memberships:
            circle = self.db.get_circle(m['circleId'])
            circle['role'] = m['role']
            circles.append(circle)

        return circles

    def is_member(self, circle_id: str, user_id: str) -> bool:
        """检查用户是否在圈子中"""
        member = self.db.get_circle_member(circle_id, user_id)
        return member is not None

    def get_circle_diaries(
        self,
        circle_id: str,
        limit: int = 20,
        last_evaluated_key: Optional[str] = None
    ) -> Dict:
        """获取圈子动态流（带分页）"""
        # 1. 查询 diary_shares 表（GSI: circleId-sharedAt-index）
        shares = self.db.query_circle_shares(
            circle_id,
            limit,
            last_evaluated_key
        )

        # 2. 批量获取日记详情（使用 BatchGetItem）
        diary_ids = [s['diaryId'] for s in shares['items']]
        diaries = self.db.batch_get_diaries(diary_ids)

        # 3. 合并数据（日记 + 分享信息）
        result = []
        for share in shares['items']:
            diary = next(
                (d for d in diaries if d['diary_id'] == share['diaryId']),
                None
            )
            if diary:
                diary['shared_at'] = share['sharedAt']
                result.append(diary)

        return {
            "diaries": result,
            "last_evaluated_key": shares.get('last_evaluated_key')
        }
```

---

### 推送通知方案

#### 技术选型

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|-------|
| **Expo Push Notifications** | 简单易用，跨平台 | 免费有限额 | ⭐⭐⭐⭐⭐ MVP首选 |
| **AWS SNS + APNs/FCM** | 稳定，无限额 | 配置复杂 | ⭐⭐⭐⭐ 生产环境 |
| **OneSignal** | 功能强大，免费额度大 | 第三方依赖 | ⭐⭐⭐ 备选 |

**MVP 推荐**：Expo Push Notifications

#### 实现流程

```
1. 用户打开App → 请求推送权限
2. 获取 Expo Push Token → 上传到后端 → 存储到 DynamoDB
3. 新日记分享时 → 后端查询圈子成员 → 获取Push Token → 发送推送
4. 用户点击推送 → 跳转到圈子详情页
```

**代码示例**：

```python
# backend/app/services/notification_service.py

import httpx
from typing import List

class NotificationService:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

    async def notify_new_diary(
        self,
        circle_id: str,
        diary_title: str,
        author_name: str
    ):
        """新日记分享通知"""
        # 1. 获取圈子所有成员的 Push Token（排除作者自己）
        members = self.db.get_circle_members(circle_id)
        tokens = [m['pushToken'] for m in members if m['pushToken']]

        # 2. 构造推送消息
        messages = []
        for token in tokens:
            messages.append({
                "to": token,
                "title": f"📝 {author_name}分享了新日记",
                "body": diary_title,
                "data": {
                    "circleId": circle_id,
                    "type": "new_diary"
                },
                "sound": "default"
            })

        # 3. 批量发送（Expo支持单次最多100条）
        async with httpx.AsyncClient() as client:
            await client.post(self.EXPO_PUSH_URL, json=messages)
```

---

## UI/UX 设计要点

### 视觉风格

**整体基调**：温暖、私密、轻量

- **配色**：
  - 主色：柔和橙色（继承Thankly品牌色）
  - 辅色：淡粉色（情感连接）
  - 背景：米白色（温暖）

- **图标**：
  - 圈子：圆形头像 + 成员数气泡
  - 分享：向外扩散的爱心
  - 动态流：时间线样式

### 关键交互

#### 1. 创建圈子流程

```
[空状态] → 显示"创建你的第一个圈子"插画
        → 点击"创建" → 弹窗输入名称
        → 生成邀请码 → 显示分享卡片（可复制/截图）
```

**细节**：
- ✅ 输入框自动聚焦
- ✅ 邀请码大字号展示（方便截图）
- ✅ 一键复制 + Toast提示

#### 2. 加入圈子流程

```
[输入邀请码] → 自动转大写，6位自动提交
              → 显示圈子预览卡片（名称、成员数）
              → 确认加入 → 动画庆祝 → 进入圈子
```

**细节**：
- ✅ 输入框限制6位
- ✅ 错误码抖动反馈
- ✅ 加入成功显示confetti动画

#### 3. 分享选择器

```
[日记编辑页] → 底部"分享到圈子"开关
             → 打开 → 展开圈子列表（多选）
             → 已选中显示✓标记
             → 保存 → Toast提示"已分享到2个圈子"
```

**细节**：
- ✅ 默认收起（不打扰创作）
- ✅ 圈子按最近互动排序
- ✅ 没有圈子时显示"创建圈子"引导

#### 4. 圈子动态流

```
[时间流] → 最新日记在上
         → 每条显示：头像+名字+时间+情绪标签
         → 点击 → 查看完整日记
         → 长按 → "取消分享"选项（仅自己的日记）
```

**细节**：
- ✅ 下拉刷新
- ✅ 滚动到底部加载更多
- ✅ 空状态：温暖插画 + "快分享你的第一篇日记吧"

### 空状态设计

| 场景 | 插画 | 文案 |
|------|------|------|
| 无圈子 | 两个人牵手 | "创建圈子，和家人朋友分享生活" |
| 无成员 | 信封 | "邀请TA加入，开始记录美好" |
| 无动态 | 日记本 | "圈子里还没有日记，快去分享吧" |

---

## 实施计划

### 开发阶段（4周）

#### Week 1：后端基础 ✅

**目标**：数据库设计 + 核心API

- [ ] Day 1-2：DynamoDB表设计 + GSI创建
  - `circles`
  - `circle_members`
  - `diary_shares`
- [ ] Day 3-4：圈子管理API
  - POST `/circle`（创建圈子）
  - POST `/circle/join`（加入圈子）
  - GET `/circle/my-circles`（我的圈子）
  - GET `/circle/{id}/members`（成员列表）
- [ ] Day 5：日记分享API
  - POST `/diary/{id}/share`（分享）
  - DELETE `/diary/{id}/share/{circleId}`（取消分享）
  - GET `/circle/{id}/diaries`（动态流）

**验收标准**：
- ✅ 所有API通过Postman测试
- ✅ 邀请码唯一性校验
- ✅ 权限控制（非成员无法查看）

#### Week 2：前端页面 ✅

**目标**：圈子管理 + 分享流程

- [ ] Day 1-2：圈子列表页
  - `CircleListScreen.tsx`
  - 创建/加入圈子Modal
  - 邀请码复制/分享
- [ ] Day 3-4：分享选择器
  - `CircleShareSelector.tsx`
  - 集成到日记创建流程
  - 已有日记补充分享
- [ ] Day 5：圈子动态流
  - `CircleDetailScreen.tsx`
  - 动态列表展示
  - 下拉刷新 + 加载更多

**验收标准**：
- ✅ 创建/加入圈子流程顺畅
- ✅ 分享日记到圈子成功
- ✅ 动态流正确显示成员日记

#### Week 3：推送通知 + 细节优化 ✅

**目标**：实时通知 + 交互优化

- [ ] Day 1-2：推送通知
  - 注册Push Token
  - 新日记分享通知
  - 新成员加入通知
  - 点击跳转逻辑
- [ ] Day 3-4：UI/UX优化
  - 空状态设计
  - 加载动画
  - 错误提示
  - 成功反馈（Toast/动画）
- [ ] Day 5：权限 + 边界处理
  - 圈子数量限制（免费3个）
  - 成员数量显示
  - 退出圈子逻辑
  - 创建者不能退出

**验收标准**：
- ✅ 推送通知及时送达
- ✅ 空状态友好引导
- ✅ 边界case无崩溃

#### Week 4：测试 + 打磨 ✅

**目标**：全流程测试 + 性能优化

- [ ] Day 1-2：功能测试
  - 完整用户流程走通
  - 多设备协同测试
  - 边界case测试
- [ ] Day 3：性能优化
  - 动态流分页优化
  - 图片懒加载
  - 缓存策略
- [ ] Day 4：国际化
  - i18n翻译（中英文）
  - 时间格式本地化
- [ ] Day 5：发布准备
  - 更新CLAUDE.md
  - 代码Review
  - 写技术文档

**验收标准**：
- ✅ 核心流程无bug
- ✅ 动态流加载流畅（<2s）
- ✅ 中英文翻译完整

---

### 上线计划

#### 灰度发布（1周）

**策略**：
1. **内部测试**：团队成员 + 种子用户（50人）
2. **小范围开放**：邀请制，限额500人
3. **收集反馈**：
   - 创建圈子转化率
   - 分享日记频率
   - 推送点击率
   - 用户访谈（5-10人）

**关键指标**：
- 圈子创建率 > 30%（有30%用户创建圈子）
- 分享率 > 20%（有20%日记被分享）
- 推送点击率 > 40%
- 无严重bug

#### 全量发布

**触发条件**：
- ✅ 灰度期无严重bug
- ✅ 用户反馈正面（NPS > 8）
- ✅ 核心指标达标

**发布方式**：
- OTA更新（Expo）
- 应用商店更新（标注"新功能：亲密圈"）
- 站内公告 + 引导

---

## 风险评估

### 技术风险 ⚠️

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| **Lambda冷启动导致推送延迟** | 中 | 中 | 使用Lambda ProvisionedConcurrency保持热启动 |
| **DynamoDB查询性能问题** | 低 | 高 | GSI设计合理 + 分页 + 缓存 |
| **推送送达率低** | 中 | 高 | 使用Expo的可靠推送服务 + 重试机制 |
| **邀请码冲突** | 极低 | 低 | 6位36进制=2176782336种组合，几乎不可能 |

### 产品风险 ⚠️

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| **用户不愿分享隐私** | 中 | 高 | 强调私密性 + 分享默认关闭 + 可取消分享 |
| **圈子变成"表演场"** | 中 | 中 | MVP不做评论点赞 + 强调真实记录 |
| **活跃度低（无互动就放弃）** | 高 | 高 | 推送提醒 + 情绪可视化 + 回顾功能 |
| **邀请难度高（邀请码繁琐）** | 中 | 中 | 一键复制 + 分享海报 + 二维码（后续） |

### 运营风险 ⚠️

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| **用户教育成本高** | 高 | 中 | 新手引导 + 示例圈子 + 视频教程 |
| **增长缓慢（需要邀请）** | 高 | 高 | 病毒传播机制（分享海报） + 激励体系 |
| **滥用风险（垃圾圈子）** | 低 | 低 | 举报机制 + 圈子数量限制 |

---

## 成功指标

### 北极星指标 🌟

**定义**：**活跃圈子数**（至少有2个成员且近7天有分享行为的圈子）

**为什么？**
- ✅ 反映核心价值：私密社交 + 内容生产
- ✅ 平衡用户增长和活跃度
- ✅ 可分解为子指标

### 关键指标（OKR）

**O1：用户采用率**
- KR1：30%用户创建/加入至少1个圈子（Week 4）
- KR2：20%日记被分享到圈子（Week 8）
- KR3：平均每用户加入1.5个圈子（Week 12）

**O2：用户活跃度**
- KR1：圈子内日记分享频率 = 2次/周（Week 8）
- KR2：推送点击率 > 40%（Week 4）
- KR3：7日留存提升10%（相比无圈子用户）（Week 12）

**O3：用户满意度**
- KR1：NPS > 8（用户访谈）（Week 8）
- KR2：功能满意度 > 4.5/5（应用内评分）（Week 12）
- KR3：推荐给家人/朋友意愿 > 80%（调研）（Week 8）

### 监控看板

**实时监控**：
- 今日新增圈子数
- 今日圈子分享数
- 今日推送点击率
- API错误率

**每周复盘**：
- 活跃圈子数趋势
- 用户画像分析（家庭/情侣/朋友）
- 流失原因分析

---

## 后续迭代方向

### V2.0：深度互动（3个月后）

**新增功能**：
- ✅ 评论功能（轻量，无楼中楼）
- ✅ "抱抱"按钮（代替点赞，更温暖）
- ✅ @提及成员
- ✅ 圈子公告（置顶消息）

**目标**：提升互动深度，但保持克制

### V3.0：情绪洞察（6个月后）

**新增功能**：
- ✅ 圈子情绪仪表盘（成员情绪趋势对比）
- ✅ AI洞察："最近小明情绪低落，记得关心Ta"
- ✅ 情绪同步提醒："你和妈妈都很开心哦"
- ✅ 圈子回忆（一年前今天）

**目标**：从"看见"升级为"理解"

### V4.0：商业化探索（9个月后）

**会员功能**：
- 圈子数量无限制（免费3个）
- 高级权限管理（管理员、只读成员）
- 圈子数据导出（PDF电子书）
- 专属主题/贴纸

**企业版**：
- 团队情绪健康管理
- 匿名树洞模式
- 管理员看板

---

## 附录：关键决策记录

### 为什么选择"邀请码"而非"二维码"？

**决策**：MVP使用邀请码，后续迭代加入二维码

**原因**：
1. ✅ 技术简单：无需二维码生成/扫描库
2. ✅ 跨平台兼容：文字可以通过任何渠道分享
3. ✅ 降低门槛：老年用户不熟悉扫码
4. ❌ 缺点：输入繁琐（但只需输入一次）

**后续优化**：V2.0加入二维码分享

---

### 为什么不做"圈子搜索"功能？

**决策**：不做公开搜索，仅邀请制

**原因**：
1. ✅ 保护隐私：避免陌生人加入
2. ✅ 聚焦亲密关系：不是兴趣社区
3. ✅ 降低运营成本：无需内容审核
4. ❌ 缺点：传播慢（但符合私密定位）

---

### 为什么不做"圈子设置"（踢人/转让）？

**决策**：MVP不做，V2.0再加

**原因**：
1. ✅ 简化MVP：降低开发成本
2. ✅ 信任机制：邀请制天然过滤陌生人
3. ✅ 边界清晰：创建者可以删除圈子
4. ❌ 缺点：遇到"讨厌的人"无法踢出（用户反馈后再决定）

---

## 总结

### 为什么这个功能值得做？ ✅

1. **市场空白**：私密社交 + AI日记 = 独特赛道
2. **用户刚需**：留守儿童、异地恋、亲子关系 = 千万级用户
3. **护城河**：AI能力 + 情感数据 = 难以复制
4. **商业价值**：社交关系 = 最强留存 + 付费意愿高

### 难度评估 📊

| 维度 | 难度 | 说明 |
|------|-----|------|
| **技术实现** | 🟡 中等 | DynamoDB表设计需谨慎，推送通知有坑 |
| **产品设计** | 🟡 中等 | 需平衡私密性和互动性 |
| **用户教育** | 🔴 较高 | 需引导用户理解"亲密圈"概念 |
| **运营增长** | 🔴 较高 | 邀请制传播慢，需病毒机制 |

**综合评估**：**中等偏上**，但**ROI高**，值得投入。

### 最后的建议 💡

**DO**：
- ✅ 快速迭代，小步快跑
- ✅ 重视用户反馈，灵活调整
- ✅ 强调隐私保护，建立信任
- ✅ 用数据验证假设，而非直觉

**DON'T**：
- ❌ 不要一次做太多功能（MVP克制）
- ❌ 不要忽视性能（动态流卡顿=致命）
- ❌ 不要强推互动（评论点赞等V2.0再说）
- ❌ 不要低估用户教育成本（需要好的引导）

---

**文档状态**：✅ 已完成，待评审
**下一步**：用户确认 → 进入开发排期

---

**问题？反馈？**
欢迎随时讨论调整！这是我们的第一版思考，最终方案会根据你的反馈持续优化。🚀
