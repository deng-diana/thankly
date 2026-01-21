# 幸福罐功能 - 完整实施方案

## 📋 功能概述

**功能名称：** Happiness Jar（幸福罐）

**核心价值：** 自动收集用户所有正向情绪的日记，创建一个专属的"快乐回忆空间"。

**用户场景：**

- 用户想快速回顾所有快乐时刻
- 用户情绪低落时需要正能量
- 用户想统计自己的幸福瞬间数量

---

## 🎯 产品设计

### 1. 入口设计

**位置：** 日记列表页（DiaryListScreen）顶部，问候语下方

**视觉设计：**

```
┌─────────────────────────────────────┐
│ Hi, Diana                           │
│ Anything to appreciate or capture?  │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ Open your Happiness Jar  🍯 │   │
│ │ 18 moments that ignite      │   │
│ │ your days                   │   │
│ └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**文案：**

- 标题：`Open your Happiness Jar`
- 副标题：`{count} moments that ignite your days`
- 空状态：`Start collecting your happy moments ✨`

**视觉元素：**

- 背景色：淡橙色 `#FFF5E6`
- 强调色：品牌橙 `#E56C45`
- 罐子插画：手绘风格，内含小纸条

---

### 2. 幸福罐页面（HappinessJarScreen）

**页面结构：**

```
┌─────────────────────────────────────┐
│ ← Happiness Jar              🔊     │  ← 返回按钮 + 音乐开关
│                                     │
│ 🍯 你已经收集了 18 个快乐瞬间 ✨      │  ← 统计信息
│                                     │
│ ┌─────────────────────────────┐   │
│ │ 📅 Jan 15, 2026             │   │
│ │ 今天和朋友去爬山，看到了日出！  │   │  ← 日记卡片
│ │ 😊 Joyful                   │   │
│ │ [图片]                      │   │
│ └─────────────────────────────┘   │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ 📅 Jan 10, 2026             │   │
│ │ ...                         │   │
│ └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**设计细节：**

- 主题色：温暖金黄色 `#FFD700` + 柔和橙色
- 卡片光晕：淡金色边框 `rgba(255, 215, 0, 0.3)`
- 进入动画：卡片从下往上飘入（0.3s ease-out）
- 空状态插画：空罐子 + "开始记录你的快乐时刻吧！"

---

### 3. 背景音乐功能

**音乐风格：** 舒缓纯音乐（钢琴独奏 / Lo-fi Chill）

**用户体验：**

- 进入页面自动播放（音量 30%）
- 循环播放
- 右上角音乐图标可开关
- 离开页面自动停止

**首次进入提示：**

```
Toast: "🎵 轻音乐已为你准备好，点击右上角可关闭"
```

**音频要求：**

- 格式：MP3 或 M4A
- 时长：2-3 分钟
- 大小：< 2MB
- 版权：免费音乐库（Epidemic Sound / Artlist）

---

## 🔧 技术架构

### 1. 数据库设计

**无需新建表！** 复用现有 `diary` 表。

**筛选逻辑：**

```sql
SELECT * FROM diary
WHERE user_id = :user_id
  AND emotion IN ('Joyful', 'Excited', 'Grateful', 'Confident', 'Peaceful', 'Hopeful')
ORDER BY created_at DESC
LIMIT 50
```

**正向情绪列表：**

- `Joyful` — 快乐
- `Excited` — 兴奋
- `Grateful` — 感恩
- `Confident` — 自信
- `Peaceful` — 平静
- `Hopeful` — 充满希望

---

### 2. 后端 API 设计

#### **接口 1：获取幸福罐日记列表**

**Endpoint:**

```
GET /api/diary/happiness-jar
```

**请求参数：**

```json
{
  "user_id": "string (required)",
  "limit": "integer (optional, default: 50)",
  "offset": "integer (optional, default: 0)"
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "total": 23,
    "diaries": [
      {
        "id": "abc123",
        "content": "今天和朋友去爬山，看到了日出！",
        "emotion": "Joyful",
        "emotion_display": "快乐",
        "created_at": "2026-01-15T08:00:00Z",
        "images": ["https://..."],
        "audio_url": "https://...",
        "ai_feedback": "..."
      }
    ]
  }
}
```

**错误处理：**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

---

#### **接口 2：获取幸福罐统计**

**Endpoint:**

```
GET /api/diary/happiness-jar/stats
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "total_count": 23,
    "emotion_breakdown": {
      "Joyful": 10,
      "Excited": 5,
      "Grateful": 4,
      "Confident": 2,
      "Peaceful": 1,
      "Hopeful": 1
    },
    "first_moment": "2025-06-15T10:00:00Z",
    "latest_moment": "2026-01-15T08:00:00Z"
  }
}
```

---

### 3. 后端实现（Python FastAPI）

**文件路径：** `backend/app/routers/diary.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Diary
from app.auth import get_current_user

router = APIRouter()

# 正向情绪列表
POSITIVE_EMOTIONS = ['Joyful', 'Excited', 'Grateful', 'Confident', 'Peaceful', 'Hopeful']

@router.get("/happiness-jar")
async def get_happiness_jar(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    获取用户的幸福罐日记列表
    """
    try:
        # 查询正向情绪的日记
        diaries = db.query(Diary).filter(
            Diary.user_id == current_user.id,
            Diary.emotion.in_(POSITIVE_EMOTIONS)
        ).order_by(
            Diary.created_at.desc()
        ).offset(offset).limit(limit).all()

        # 统计总数
        total = db.query(Diary).filter(
            Diary.user_id == current_user.id,
            Diary.emotion.in_(POSITIVE_EMOTIONS)
        ).count()

        return {
            "success": True,
            "data": {
                "total": total,
                "diaries": [diary.to_dict() for diary in diaries]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/happiness-jar/stats")
async def get_happiness_jar_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    获取幸福罐统计信息
    """
    try:
        # 查询所有正向情绪日记
        diaries = db.query(Diary).filter(
            Diary.user_id == current_user.id,
            Diary.emotion.in_(POSITIVE_EMOTIONS)
        ).all()

        # 统计各情绪数量
        emotion_breakdown = {}
        for emotion in POSITIVE_EMOTIONS:
            count = sum(1 for d in diaries if d.emotion == emotion)
            if count > 0:
                emotion_breakdown[emotion] = count

        # 获取第一条和最新一条
        first_moment = min(diaries, key=lambda d: d.created_at) if diaries else None
        latest_moment = max(diaries, key=lambda d: d.created_at) if diaries else None

        return {
            "success": True,
            "data": {
                "total_count": len(diaries),
                "emotion_breakdown": emotion_breakdown,
                "first_moment": first_moment.created_at if first_moment else None,
                "latest_moment": latest_moment.created_at if latest_moment else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### 4. 前端实现（React Native）

#### **文件结构：**

```
mobile/src/
├── screens/
│   └── HappinessJarScreen.tsx       # 幸福罐主页面
├── components/
│   └── HappinessJarCard.tsx         # 入口卡片组件
├── services/
│   └── happinessJarService.ts       # API 调用
├── assets/
│   ├── music/
│   │   └── happiness-jar-bgm.mp3    # 背景音乐
│   └── images/
│       └── jar-icon.png             # 罐子图标
└── i18n/
    ├── en.ts                        # 英文文案
    └── zh.ts                        # 中文文案
```

---

#### **Step 1: API Service**

**文件：** `mobile/src/services/happinessJarService.ts`

```typescript
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/auth";

export interface HappinessJarDiary {
  id: string;
  content: string;
  emotion: string;
  emotion_display: string;
  created_at: string;
  images: string[];
  audio_url?: string;
  ai_feedback?: string;
}

export interface HappinessJarResponse {
  success: boolean;
  data: {
    total: number;
    diaries: HappinessJarDiary[];
  };
}

export const happinessJarService = {
  /**
   * 获取幸福罐日记列表
   */
  async getDiaries(
    limit: number = 50,
    offset: number = 0,
  ): Promise<HappinessJarResponse> {
    const token = await getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/diary/happiness-jar?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch happiness jar");
    }

    return response.json();
  },

  /**
   * 获取幸福罐统计
   */
  async getStats() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/diary/happiness-jar/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch happiness jar stats");
    }

    return response.json();
  },
};
```

---

#### **Step 2: 入口卡片组件**

**文件：** `mobile/src/components/HappinessJarCard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { happinessJarService } from '../services/happinessJarService';
import { useTranslation } from '../i18n';

export const HappinessJarCard: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    loadCount();
  }, []);

  const loadCount = async () => {
    try {
      const stats = await happinessJarService.getStats();
      setCount(stats.data.total_count);
    } catch (error) {
      console.error('Failed to load happiness jar count:', error);
    }
  };

  const handlePress = () => {
    navigation.navigate('HappinessJar');
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {t('happinessJar.openYour')}
            <Text style={styles.highlight}> {t('happinessJar.happiness')}</Text>
            {t('happinessJar.jar')}
          </Text>
          <Text style={styles.subtitle}>
            <Text style={styles.count}>{count}</Text> {t('happinessJar.moments')}
          </Text>
        </View>
        <Image
          source={require('../assets/images/jar-icon.png')}
          style={styles.jarIcon}
          resizeMode="contain"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF5E6',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#E56C45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Lora-Regular',
    color: '#332824',
    marginBottom: 4,
  },
  highlight: {
    color: '#E56C45',
    fontFamily: 'Lora-Bold',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Lora-Regular',
    color: '#80645A',
  },
  count: {
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    color: '#E56C45',
  },
  jarIcon: {
    width: 60,
    height: 60,
  },
});
```

---

#### **Step 3: 幸福罐主页面**

**文件：** `mobile/src/screens/HappinessJarScreen.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { happinessJarService, HappinessJarDiary } from '../services/happinessJarService';
import { DiaryCard } from '../components/DiaryCard';
import { useTranslation } from '../i18n';
import Toast from 'react-native-toast-message';

export const HappinessJarScreen: React.FC = () => {
  const { t } = useTranslation();
  const [diaries, setDiaries] = useState<HappinessJarDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDiaries();
    loadAndPlayMusic();
    showMusicToast();

    // 进入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => {
      // 离开页面时停止音乐
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadDiaries = async () => {
    try {
      const response = await happinessJarService.getDiaries();
      setDiaries(response.data.diaries);
    } catch (error) {
      console.error('Failed to load happiness jar:', error);
      Toast.show({
        type: 'error',
        text1: t('happinessJar.loadError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAndPlayMusic = async () => {
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../assets/music/happiness-jar-bgm.mp3'),
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.3,
        }
      );
      setSound(newSound);
    } catch (error) {
      console.log('Music load failed:', error);
    }
  };

  const showMusicToast = () => {
    setTimeout(() => {
      Toast.show({
        type: 'info',
        text1: '🎵 ' + t('happinessJar.musicReady'),
        visibilityTime: 3000,
      });
    }, 500);
  };

  const toggleMusic = async () => {
    if (sound) {
      if (isMusicEnabled) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsMusicEnabled(!isMusicEnabled);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerText}>
        🍯 {t('happinessJar.collected')}
        <Text style={styles.count}> {diaries.length} </Text>
        {t('happinessJar.moments')} ✨
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {t('happinessJar.emptyState')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E56C45" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 音乐开关 */}
      <TouchableOpacity
        style={styles.musicToggle}
        onPress={toggleMusic}
      >
        <Ionicons
          name={isMusicEnabled ? 'volume-high' : 'volume-mute'}
          size={24}
          color="#E56C45"
        />
      </TouchableOpacity>

      {/* 日记列表 */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={diaries}
          renderItem={({ item }) => <DiaryCard diary={item} />}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  musicToggle: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Lora-Regular',
    color: '#332824',
    textAlign: 'center',
  },
  count: {
    fontSize: 20,
    fontFamily: 'Lora-Bold',
    color: '#E56C45',
  },
  listContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFBF5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Lora-Regular',
    color: '#80645A',
    textAlign: 'center',
  },
});
```

---

#### **Step 4: 国际化文案**

**文件：** `mobile/src/i18n/en.ts`

```typescript
export default {
  // ... 其他翻译
  happinessJar: {
    openYour: "Open your",
    happiness: "Happiness",
    jar: "Jar",
    moments: "moments that ignite your days",
    collected: "You have collected",
    emptyState: "Start collecting your happy moments ✨",
    loadError: "Failed to load happiness jar",
    musicReady: "Soft music is ready, tap top-right to turn off",
  },
};
```

**文件：** `mobile/src/i18n/zh.ts`

```typescript
export default {
  // ... 其他翻译
  happinessJar: {
    openYour: "打开你的",
    happiness: "幸福",
    jar: "罐",
    moments: "个点亮生活的瞬间",
    collected: "你已经收集了",
    emptyState: "开始记录你的快乐时刻吧 ✨",
    loadError: "加载幸福罐失败",
    musicReady: "轻音乐已为你准备好，点击右上角可关闭",
  },
};
```

---

#### **Step 5: 添加路由**

**文件：** `mobile/src/navigation/AppNavigator.tsx`

```typescript
import { HappinessJarScreen } from '../screens/HappinessJarScreen';

// 在 Stack.Navigator 中添加
<Stack.Screen
  name="HappinessJar"
  component={HappinessJarScreen}
  options={{
    title: 'Happiness Jar',
    headerStyle: {
      backgroundColor: '#FFFBF5',
    },
    headerTintColor: '#332824',
    headerTitleStyle: {
      fontFamily: 'Lora-Bold',
    },
  }}
/>
```

---

#### **Step 6: 集成到首页**

**文件：** `mobile/src/screens/DiaryListScreen.tsx`

```typescript
import { HappinessJarCard } from '../components/HappinessJarCard';

// 在 renderHeader 函数中添加
const renderHeader = () => (
  <View>
    <Text style={styles.greeting}>Hi, {userName}</Text>
    <Text style={styles.subtitle}>Anything to appreciate or capture today?</Text>

    {/* 幸福罐入口 */}
    <HappinessJarCard />

    <Text style={styles.sectionTitle}>My precious moment</Text>
  </View>
);
```

---

## 🚀 实施步骤

### Phase 1: 后端开发（1 天）

1. ✅ 在 `diary.py` 中添加两个 API 接口
2. ✅ 测试 API（使用 Postman 或 curl）
3. ✅ 部署到 Lambda

### Phase 2: 前端开发（2 天）

1. ✅ 创建 `happinessJarService.ts`
2. ✅ 创建 `HappinessJarCard.tsx`
3. ✅ 创建 `HappinessJarScreen.tsx`
4. ✅ 添加国际化文案
5. ✅ 添加路由配置
6. ✅ 集成到首页

### Phase 3: 音乐功能（0.5 天）

1. ✅ 下载/购买背景音乐
2. ✅ 添加到 `assets/music/`
3. ✅ 实现音乐播放逻辑
4. ✅ 测试音乐开关

### Phase 4: 测试与优化（0.5 天）

1. ✅ 功能测试（iOS + Android）
2. ✅ 性能测试（大量日记时的加载速度）
3. ✅ UI 细节调整
4. ✅ 用户体验优化

---

## 📊 性能优化

### 1. 分页加载

```typescript
const [page, setPage] = useState(0);
const PAGE_SIZE = 20;

const loadMore = async () => {
  const response = await happinessJarService.getDiaries(
    PAGE_SIZE,
    page * PAGE_SIZE,
  );
  setDiaries([...diaries, ...response.data.diaries]);
  setPage(page + 1);
};
```

### 2. 缓存策略

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

// 缓存日记列表
await AsyncStorage.setItem("happiness_jar_cache", JSON.stringify(diaries));

// 读取缓存
const cached = await AsyncStorage.getItem("happiness_jar_cache");
if (cached) {
  setDiaries(JSON.parse(cached));
}
```

### 3. 图片懒加载

```typescript
<Image
  source={{ uri: diary.images[0] }}
  style={styles.image}
  resizeMode="cover"
  loadingIndicatorSource={require('../assets/placeholder.png')}
/>
```

---

## 🧪 测试用例

### 后端测试

```bash
# 测试获取幸福罐列表
curl -X GET "http://localhost:8000/api/diary/happiness-jar?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试获取统计
curl -X GET "http://localhost:8000/api/diary/happiness-jar/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 前端测试

- [ ] 入口卡片正确显示数量
- [ ] 点击卡片跳转到幸福罐页面
- [ ] 日记列表正确加载
- [ ] 空状态正确显示
- [ ] 音乐自动播放
- [ ] 音乐开关正常工作
- [ ] 离开页面音乐停止
- [ ] 下拉刷新正常
- [ ] 分页加载正常

---

## 🎨 设计资源

### 需要准备的资源

1. **罐子图标** (`jar-icon.png`)
   - 尺寸：120x120px @3x
   - 风格：手绘、温暖
2. **背景音乐** (`happiness-jar-bgm.mp3`)
   - 时长：2-3 分钟
   - 风格：钢琴独奏 / Lo-fi Chill
   - 音量：适中，不刺耳
3. **空状态插画** (`empty-jar.png`)
   - 尺寸：200x200px @3x
   - 内容：空罐子 + 温馨提示

---

## 💬 面试话术

**问题：介绍一下幸福罐功能的设计思路。**

**回答：**

> "幸福罐是一个基于情绪筛选的功能。我们的 AI 会给每条日记打上情绪标签，幸福罐会自动收集所有正向情绪的日记，比如 Joyful、Grateful 等。
>
> 技术上，我们不需要新建数据库表，只需要在查询时加一个 WHERE 条件筛选情绪。后端提供了两个 API：一个返回日记列表，一个返回统计信息。
>
> 用户体验上，我们设计了温暖的金色主题，并加入了舒缓的背景音乐，让用户在回顾快乐时刻时有更强的情感共鸣。音乐是可选的，用户可以随时关闭。
>
> 这个功能的核心价值是帮助用户在情绪低落时快速找到正能量，提升 App 的情感价值和用户粘性。"

---

## 📈 成功指标

### 数据指标

- 幸福罐打开率 > 30%（DAU 中的占比）
- 平均停留时长 > 2 分钟
- 音乐开启率 > 60%

### 用户反馈

- App Store 评论提及"幸福罐"
- 用户截图分享幸福罐页面

---

## 🔄 未来迭代

### v1.3.0 可能的优化

1. **分享功能：** 允许用户分享幸福罐截图到社交媒体
2. **时间筛选：** 按月份/年份查看幸福罐
3. **情绪趋势：** 显示快乐时刻的时间分布图
4. **随机回顾：** "今天看看一年前的快乐"

---

## 📚 相关文档

- [搜索功能实施文档](./SEARCH_FEATURE_IMPLEMENTATION.md)
- [情绪识别 Agent 设计](../backend/docs/EMOTION_AGENT.md)
- [UI 设计规范](./UI_DESIGN_GUIDELINES.md)

---

**文档版本：** v1.0  
**创建日期：** 2026-01-18  
**最后更新：** 2026-01-18  
**负责人：** Diana Deng
