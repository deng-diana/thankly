# Happiness Jar 页面入场动画设计方案

**版本**: v1.2.0  
**设计目标**: 创造有仪式感的页面入场体验  
**设计理念**: 舒缓、渐进、优雅

---

## 🎬 动画时序设计

### **阶段 1: 图标入场 + 摇晃动画** (0ms - 800ms)

**时间轴:**
- **0ms**: 图标淡入开始（opacity: 0 → 1）
- **0-400ms**: 图标淡入 + 轻微缩放（scale: 0.8 → 1.0）
- **400ms**: 图标淡入完成
- **400-800ms**: 图标左右摇晃动画（3次完整摆动）

**动画参数:**
```typescript
// 图标淡入 + 缩放
iconFadeAnim: 0 → 1 (400ms, ease-out)
iconScaleAnim: 0.8 → 1.0 (400ms, spring)

// 图标摇晃（在淡入完成后开始）
iconSwayAnim: 
  - 400ms: 开始摇晃
  - 摆动角度: -8° → +8° → -8° → +8° → 0°
  - 持续时间: 400ms
  - 缓动: ease-in-out
  - 摆动次数: 3次完整摆动
```

**视觉效果:**
- 图标从中心优雅地淡入并轻微放大
- 淡入完成后，图标开始左右摇晃，像在"打招呼"
- 摇晃结束后回到中心位置

---

### **阶段 2: 标题和副标题渐入** (600ms - 1200ms)

**时间轴:**
- **600ms**: 标题开始从下方滑入（延迟200ms，与图标摇晃重叠）
- **800ms**: 副标题开始从下方滑入（延迟200ms）
- **1200ms**: 标题和副标题动画完成

**动画参数:**
```typescript
// 标题动画
titleTranslateY: 30 → 0 (600ms, ease-out)
titleOpacity: 0 → 1 (600ms, ease-out)

// 副标题动画（延迟200ms）
subtitleTranslateY: 30 → 0 (600ms, ease-out)
subtitleOpacity: 0 → 1 (600ms, ease-out)
```

**视觉效果:**
- 标题从下方30px位置滑入并淡入
- 副标题紧随其后，从下方滑入
- 整体感觉像"内容慢慢浮现"

---

### **阶段 3: 卡片视差渐入** (1000ms - 1800ms+)

**时间轴:**
- **1000ms**: 第一张卡片开始动画
- **1100ms**: 第二张卡片开始动画（延迟100ms，与第一张重叠）
- **1200ms**: 第三张卡片开始动画（延迟100ms，与第二张重叠）
- **...**: 后续卡片依次延迟100ms，形成视差效果

**动画参数:**
```typescript
// 每张卡片的动画（延迟递增，但动画重叠）
cardTranslateY: 50 → 0 (600ms, ease-out) // ✅ 缩短时长，更紧凑
cardOpacity: 0 → 1 (600ms, ease-out)
cardScale: 0.95 → 1.0 (600ms, spring)

// 延迟计算（缩短延迟，形成视差重叠）
delay = index * 100ms // ✅ 从200ms改为100ms，让卡片动画有重叠
```

**视差效果:**
- 卡片之间延迟100ms（而非200ms），让动画有重叠
- 第一张卡片动画进行到50%时，第二张开始
- 形成"波浪式"的视差渐入效果
- 整体节奏更紧凑，不会拖沓

**视觉效果:**
- 每张卡片从下方50px位置滑入
- 同时伴随轻微缩放（0.95 → 1.0）
- 卡片按顺序依次出现，形成"渐进式展示"
- 整体节奏舒缓，不会感觉突兀

---

## 🎨 动画细节优化

### **1. 缓动函数选择**

```typescript
// 图标淡入
easing: Easing.out(Easing.ease)

// 图标摇晃
easing: Easing.inOut(Easing.ease)

// 内容滑入
easing: Easing.out(Easing.cubic)

// 卡片出现
easing: Easing.out(Easing.ease) + spring (轻微弹性)
```

### **2. 动画时长分配**

| 元素 | 时长 | 延迟 | 总时长 |
|------|------|------|--------|
| 图标淡入 | 400ms | 0ms | 400ms |
| 图标摇晃 | 400ms | 400ms | 800ms |
| 标题 | 600ms | 600ms | 1200ms |
| 副标题 | 600ms | 800ms | 1400ms |
| 卡片1 | 600ms | 1000ms | 1600ms |
| 卡片2 | 600ms | 1100ms | 1700ms | ✅ 与卡片1重叠
| 卡片3 | 600ms | 1200ms | 1800ms | ✅ 与卡片2重叠
| 卡片N | 600ms | 1000ms + N*100ms | ... | ✅ 视差效果

### **3. 性能优化**

- ✅ 使用 `useNativeDriver: true` 确保60fps
- ✅ 动画值使用 `Animated.Value` 而非 state
- ✅ 避免在动画过程中触发重渲染
- ✅ 卡片动画使用 `FlatList` 的 `renderItem` 优化

---

## 📐 实现方案

### **动画值定义**

```typescript
// 图标动画
const iconFadeAnim = useRef(new Animated.Value(0)).current;
const iconScaleAnim = useRef(new Animated.Value(0.8)).current;
const iconSwayAnim = useRef(new Animated.Value(0)).current;

// 标题动画
const titleTranslateY = useRef(new Animated.Value(30)).current;
const titleOpacity = useRef(new Animated.Value(0)).current;

// 副标题动画
const subtitleTranslateY = useRef(new Animated.Value(30)).current;
const subtitleOpacity = useRef(new Animated.Value(0)).current;

// 卡片动画（在 renderItem 中为每张卡片创建）
const cardAnimations = useRef<Map<string, {
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}>>(new Map()).current;
```

### **动画序列**

```typescript
useEffect(() => {
  // 阶段1: 图标淡入 + 缩放
  Animated.parallel([
    Animated.timing(iconFadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.spring(iconScaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }),
  ]).start(() => {
    // 图标淡入完成后，开始摇晃
    const swayAnimation = Animated.sequence([
      Animated.timing(iconSwayAnim, {
        toValue: -8,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconSwayAnim, {
        toValue: 8,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconSwayAnim, {
        toValue: -8,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconSwayAnim, {
        toValue: 8,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconSwayAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    swayAnimation.start();
  });

  // 阶段2: 标题和副标题（延迟开始）
  Animated.parallel([
    Animated.parallel([
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
    Animated.parallel([
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 600,
        delay: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  ]).start();
}, []);
```

### **卡片动画（在 renderItem 中，视差效果）**

```typescript
const renderItem = ({ item, index }: { item: Diary; index: number }) => {
  // 为每张卡片创建动画值（如果还没有）
  if (!cardAnimations.has(item.diary_id)) {
    cardAnimations.set(item.diary_id, {
      translateY: new Animated.Value(50),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.95),
    });
  }
  
  const cardAnim = cardAnimations.get(item.diary_id)!;
  const delay = 1000 + index * 100; // ✅ 第一张卡片1000ms，后续每张延迟100ms（视差重叠）

  // 启动卡片动画（只执行一次）
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardAnim.translateY, {
        toValue: 0,
        duration: 600, // ✅ 缩短到600ms，更紧凑
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim.opacity, {
        toValue: 1,
        duration: 600, // ✅ 缩短到600ms
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim.scale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 应用动画样式
  const cardAnimatedStyle = {
    transform: [
      { translateY: cardAnim.translateY },
      { scale: cardAnim.scale },
    ],
    opacity: cardAnim.opacity,
  };

  return (
    <Animated.View style={cardAnimatedStyle}>
      <DiaryCard ... />
    </Animated.View>
  );
};
```

---

## ✨ 仪式感设计要点

### **1. 节奏控制**
- 图标先出现，建立"焦点"
- 摇晃动画增加"生命力"和"欢迎感"
- 内容渐进式出现，不会一次性涌入

### **2. 视觉层次**
- 图标 → 标题 → 副标题 → 卡片
- 每个元素都有独立的"登场时刻"
- 形成清晰的视觉引导

### **3. 情感连接**
- 图标摇晃像在"打招呼"
- 内容从下方浮现，像"慢慢展开"
- 整体感觉温暖、舒缓、有仪式感

---

## 🎯 预期效果

用户进入页面时的体验：

1. **0-400ms**: 图标优雅地淡入并放大
2. **400-800ms**: 图标左右摇晃，像在"欢迎"用户
3. **600-1200ms**: 标题和副标题从下方滑入，内容开始浮现
4. **1000ms+**: 卡片以视差效果依次出现，动画重叠形成"波浪式"渐入
   - 第一张卡片开始动画时，第二张在100ms后也开始
   - 形成流畅的视差效果，不会拖沓
   - 每张卡片都有独立的"登场时刻"，但节奏紧凑
5. **整体感受**: 舒缓、渐进、有仪式感，视差效果让页面更有层次感

---

## ✅ 验收标准

- [ ] 图标首先淡入并轻微放大
- [ ] 图标淡入完成后开始左右摇晃（3次完整摆动）
- [ ] 标题和副标题从下方滑入并淡入
- [ ] 卡片按顺序依次出现（每张延迟200ms）
- [ ] 所有动画流畅，60fps
- [ ] 整体节奏舒缓，有仪式感
- [ ] 动画不影响页面交互性能

---

## 📝 注意事项

1. **性能**: 使用 `useNativeDriver: true` 确保动画在原生线程执行
2. **内存**: 卡片动画值使用 Map 存储，避免重复创建
3. **重置**: 页面重新进入时，需要重置所有动画值
4. **中断**: 如果用户在动画过程中离开页面，需要清理动画

---

**设计完成时间**: 2026-01-24  
**设计者**: AI Product Engineer (20年经验)  
**状态**: 待确认执行
