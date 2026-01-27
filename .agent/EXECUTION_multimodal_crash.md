# 🔧 执行计划：修复多模态闪退

## 根本原因

**重复图片上传导致竞态条件和内存泄漏**

### 代码问题（行779-1029）

```typescript
// 行821-828: 第一次启动图片上传
let imageUploadPromise: Promise<string[]> | null = null;
if (images.length > 0) {
  imageUploadPromise = uploadDiaryImages(images).catch(...);
}

// 行873-875: 第二次启动图片上传（覆盖了第一次！）
const localImages = [...images];
const imageUploadPromise = uploadDiaryImages(localImages); // ❌ 重复声明

// 行917: 使用imageUploadPromise（但已经被覆盖了）
if (imageUploadPromise) {
  attachImagesPromise = (async () => {
    const imageUrls = await imageUploadPromise; // ❌ 引用错误
    ...
  })();
}
```

### 问题分析

1. **重复上传**: 图片被上传两次，浪费资源
2. **变量覆盖**: 第二次声明覆盖了第一次的Promise
3. **竞态条件**: 两个上传任务同时进行，可能导致状态混乱
4. **内存泄漏**: 第一次的Promise没有被等待，可能导致未处理的rejection
5. **闪退**: 当两个上传任务冲突时，可能触发未捕获的异常

## 修复方案

### 方案1: 移除重复上传（推荐）✅

**改动**: 删除行873-875的重复声明
**风险**: 低
**测试**: 简单

### 方案2: 合并上传逻辑

**改动**: 重构整个上传流程
**风险**: 中
**测试**: 复杂

## 执行步骤

### Step 1: 移除重复声明

删除行873-875:

```typescript
// ❌ 删除这3行
const localImages = [...images];
const imageUploadPromise = uploadDiaryImages(localImages);
```

### Step 2: 修复变量引用

确保使用第一次的imageUploadPromise（行821-828）

### Step 3: 验证逻辑

确认图片上传只执行一次

### Step 4: 测试

- 测试图片+文字+语音
- 测试纯图片+语音
- 测试纯语音

## 预期结果

- ✅ 不再闪退
- ✅ 图片正确上传
- ✅ 日记正确保存
- ✅ 进度正常显示
