# 🚀 Thankly 语音上传和转录性能优化执行计划

**创建日期**: 2026-01-27  
**执行分支**: `feature/audio-upload-optimization`  
**负责人**: CTO + Google 产品工程师专家组  
**状态**: 🟡 执行中

---

## 📊 总体进度

| 阶段 | 状态 | 开始时间 | 完成时间 | 备注 |
|------|------|---------|---------|------|
| Phase 1.1 | ✅ 已完成 | 2026-01-27 11:00 | 2026-01-27 11:30 | AsyncOpenAI 替换 |
| Phase 1.2 | ✅ 已完成 | 2026-01-27 11:30 | 2026-01-27 11:35 | 修复情绪分析同步 |
| Phase 1.3 | ✅ 已完成 | 2026-01-27 11:35 | 2026-01-27 11:50 | 优化进度更新 |
| Phase 1.4 | ✅ 已完成 | 2026-01-27 11:50 | 2026-01-27 12:05 | 添加重试机制 |
| Phase 1.5 | ⚪ 待开始 | - | - | 测试和部署 |
| Phase 2.1 | ⚪ 待开始 | - | - | 后端接口开发 |
| Phase 2.2 | ⚪ 待开始 | - | - | 前端 ChunkUploadManager |
| Phase 2.3 | ⚪ 待开始 | - | - | 集成测试和 Rollout |

**图例**: ✅ 已完成 | 🟡 进行中 | ⚪ 待开始 | ❌ 阻塞

---

## 🎯 目标指标

| 指标 | 当前值 | 目标值 | 实际值 |
|------|--------|--------|--------|
| 5分钟音频总耗时 | 30-60s | 10-25s | - |
| 上传等待时间 | 15-30s | 3-8s | - |
| 后端处理时间 | 15-30s | 10-20s | - |
| 失败率 | 5-10% | < 3% | - |

---

## Phase 1: 后端异步化优化

### Phase 1.1: AsyncOpenAI 替换
**状态**: ✅ 已完成  
**预计时间**: 1 天  
**实际时间**: 30 分钟  
**风险等级**: 低

#### 任务清单
- [x] 检查 openai 库版本，确认支持 AsyncOpenAI (v1.54.0 ✅)
- [x] 在 `openai_service.py` 中添加 AsyncOpenAI client
- [x] 替换 `transcribe_audio` 方法中的同步调用 (httpx.Client → httpx.AsyncClient)
- [x] 替换 `_call_gpt4o_for_polish_and_title` 方法中的 asyncio.to_thread
- [x] 替换 `_call_gpt4o_for_feedback` 方法中的 asyncio.to_thread
- [x] 替换 `_download_and_encode_image` 方法中的 requests.get
- [ ] 本地测试验证（待 Phase 1.5）
- [ ] 更新单元测试（待 Phase 1.5）

#### 修改文件
- `backend/app/services/openai_service.py` ✅

#### 关键改动
1. **导入 AsyncOpenAI**：`from openai import OpenAI, AsyncOpenAI`
2. **初始化异步客户端**：`self.async_client = AsyncOpenAI(api_key=...)`
3. **Whisper 转录**：`httpx.Client` → `httpx.AsyncClient`
4. **GPT-4o 调用**：`asyncio.to_thread(self.openai_client.chat.completions.create, ...)` → `await self.async_client.chat.completions.create(...)`
5. **图片下载**：`requests.get` → `httpx.AsyncClient.get`

#### 执行记录
```
[2026-01-27 11:00] 开始执行 Phase 1.1
[2026-01-27 11:05] 检查 openai 库版本: v1.54.0，支持 AsyncOpenAI
[2026-01-27 11:10] 添加 AsyncOpenAI 导入和初始化
[2026-01-27 11:15] 替换 _call_gpt4o_for_polish_and_title 中的同步调用
[2026-01-27 11:20] 替换 _call_gpt4o_for_feedback 中的同步调用
[2026-01-27 11:25] 替换 transcribe_audio 中的 httpx.Client
[2026-01-27 11:28] 替换 _download_and_encode_image 中的 requests.get
[2026-01-27 11:30] Phase 1.1 完成 ✅
```

---

### Phase 1.2: 修复情绪分析同步调用
**状态**: ✅ 已完成  
**预计时间**: 0.5 天  
**实际时间**: 5 分钟  
**风险等级**: 低

#### 任务清单
- [x] 定位 `openai_service.py` 中 `analyze_emotion_only` 的同步调用（**关键 Bug！**）
- [x] 将同步调用改为异步调用
- [x] 确保调用方正确 await
- [ ] 本地测试验证（待 Phase 1.5）

#### 修改文件
- `backend/app/services/openai_service.py` ✅

#### 关键发现
🔥 **严重问题**：`analyze_emotion_only` 方法中存在同步阻塞调用！
```python
# 原代码（阻塞事件循环！）
response = self.openai_client.chat.completions.create(...)

# 修复后
response = await self.async_client.chat.completions.create(...)
```

这个 Bug 会导致整个事件循环被阻塞，严重影响并发性能。

#### 执行记录
```
[2026-01-27 11:30] 开始执行 Phase 1.2
[2026-01-27 11:32] 发现 analyze_emotion_only 中的同步阻塞调用
[2026-01-27 11:33] 修复为使用 AsyncOpenAI
[2026-01-27 11:35] Phase 1.2 完成 ✅
```

---

### Phase 1.3: 优化进度更新策略
**状态**: ✅ 已完成  
**预计时间**: 0.5 天  
**实际时间**: 15 分钟  
**风险等级**: 低

#### 任务清单
- [x] 分析当前进度更新频率（每 0.5-0.6s 一次，写入 DynamoDB）
- [x] 设计新的更新策略（关键节点持久化，虚拟进度仅内存）
- [x] 为 `update_task_progress` 添加 `persist` 参数
- [x] 修改虚拟进度循环使用 `persist=False`
- [ ] 本地测试验证（待 Phase 1.5）

#### 修改文件
- `backend/app/routers/diary.py` ✅

#### 关键改动
1. **添加 `persist` 参数**：
   - `persist=True`（默认）：写入 DynamoDB，用于关键节点
   - `persist=False`：只更新内存，用于虚拟进度循环

2. **优化 DynamoDB 访问**：
   - 优先从内存缓存读取，减少 DynamoDB 读取
   - 虚拟进度循环不再写入 DynamoDB

3. **受影响的循环**：
   - `process_pure_voice_diary_async` 中的 `smooth_progress()`
   - `process_voice_diary_async` 中的 `do_transcription()` 内的 `smooth_progress()`

#### 性能提升预估
- **DynamoDB 写入减少**：从 ~40 次/任务 减少到 ~10 次/任务
- **延迟降低**：每次 DynamoDB 写入约 10-50ms，减少 30 次 = 节省 300-1500ms

#### 执行记录
```
[2026-01-27 11:35] 开始执行 Phase 1.3
[2026-01-27 11:40] 为 update_task_progress 添加 persist 参数
[2026-01-27 11:45] 修改两个虚拟进度循环使用 persist=False
[2026-01-27 11:50] Phase 1.3 完成 ✅
```

---

### Phase 1.4: 添加重试机制
**状态**: ✅ 已完成  
**预计时间**: 1 天  
**实际时间**: 15 分钟  
**风险等级**: 低

#### 任务清单
- [x] 添加 tenacity 库到依赖 (v8.2.3)
- [x] 创建 `_call_gpt4o_with_retry` 通用重试方法
- [x] 为 `_call_gpt4o_for_polish_and_title` 添加重试
- [x] 为 `_call_gpt4o_for_feedback` 添加重试
- [x] 为 `analyze_emotion_only` 添加重试
- [ ] 为 S3 操作添加重试（暂缓，S3 通常较稳定）
- [ ] 本地测试验证（待 Phase 1.5）

#### 修改文件
- `backend/requirements.txt` ✅
- `backend/app/services/openai_service.py` ✅

#### 关键改动
1. **添加 tenacity 依赖**：`tenacity==8.2.3`
2. **创建通用重试方法**：`_call_gpt4o_with_retry`
3. **重试参数**：
   - 最多重试 3 次
   - 指数退避：1s → 2s → 4s
   - 记录重试日志

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((Exception,)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
async def _call_gpt4o_with_retry(self, model, messages, ...):
    ...
```

#### 执行记录
```
[2026-01-27 11:50] 开始执行 Phase 1.4
[2026-01-27 11:52] 添加 tenacity 到 requirements.txt
[2026-01-27 11:55] 创建 _call_gpt4o_with_retry 方法
[2026-01-27 12:00] 替换所有 GPT-4o 直接调用为带重试版本
[2026-01-27 12:05] Phase 1.4 完成 ✅
```

---

### Phase 1.5: 测试和部署
**状态**: ⚪ 待开始  
**预计时间**: 1-2 天  
**风险等级**: 低

#### 任务清单
- [ ] 运行所有单元测试
- [ ] 端到端测试（本地环境）
- [ ] 性能基准测试
- [ ] 代码 Review
- [ ] 部署到测试环境
- [ ] 验收测试
- [ ] 部署到生产环境

#### 执行记录
```
[待记录]
```

---

## Phase 2: 前端分块上传

### Phase 2.1: 后端接口开发
**状态**: ⚪ 待开始  
**预计时间**: 1 周  
**风险等级**: 中

#### 任务清单
- [ ] 设计 AudioSession 数据模型
- [ ] 实现 `POST /audio/session/create` 接口
- [ ] 实现 `GET /audio/session/{id}/presign` 接口
- [ ] 实现 `POST /audio/session/{id}/complete` 接口
- [ ] 实现后台合并 worker
- [ ] 实现 `GET /audio/session/{id}/status` 接口
- [ ] 配置 S3 生命周期规则
- [ ] 单元测试
- [ ] 集成测试

#### 修改文件
- `backend/app/routers/diary.py`
- `backend/app/services/s3_service.py`
- `backend/app/models/diary.py`

#### 执行记录
```
[待记录]
```

---

### Phase 2.2: 前端 ChunkUploadManager
**状态**: ⚪ 待开始  
**预计时间**: 1 周  
**风险等级**: 中

#### 任务清单
- [ ] 添加 Feature Flag 配置
- [ ] 创建 ChunkUploadManager 服务
- [ ] 实现 chunk 提取逻辑
- [ ] 实现并发上传队列
- [ ] 实现 fallback 机制
- [ ] 集成到 RecordingModal
- [ ] 更新进度条映射
- [ ] 单元测试

#### 修改文件
- `mobile/src/config/aws-config.ts`
- `mobile/src/services/chunkUploadManager.ts`（新建）
- `mobile/src/hooks/useVoiceRecording.ts`
- `mobile/src/components/RecordingModal.tsx`

#### 执行记录
```
[待记录]
```

---

### Phase 2.3: 集成测试和 Rollout
**状态**: ⚪ 待开始  
**预计时间**: 1 周  
**风险等级**: 中

#### 任务清单
- [ ] 内部测试（开发者账号）
- [ ] 不同录音时长测试（30s, 2min, 5min, 10min）
- [ ] 网络条件测试（慢网、断网）
- [ ] Fallback 测试
- [ ] 性能指标收集
- [ ] 5% 用户 A/B 测试
- [ ] 监控告警配置
- [ ] 渐进式 Rollout（20% → 50% → 100%）

#### 执行记录
```
[待记录]
```

---

## 📋 风险登记

| 风险 | 概率 | 影响 | 缓解措施 | 状态 |
|------|------|------|---------|------|
| AsyncOpenAI 兼容性问题 | 低 | 中 | 先在测试环境验证 | 监控中 |
| 进度更新降频影响体验 | 低 | 低 | 前端补间动画 | 待处理 |
| Chunk 合并失败 | 中 | 中 | 自动 fallback | 待处理 |
| S3 并发限制 | 低 | 低 | 控制并发数为 2 | 待处理 |

---

## 📝 变更日志

| 日期 | 变更内容 | 执行人 |
|------|---------|--------|
| 2026-01-27 | 创建执行计划 | Claude |
| 2026-01-27 | 开始执行 Phase 1.1 | Claude |

---

## 🔍 Review 记录

### Phase 1 Review
**状态**: ⚪ 待完成

### Phase 2 Review
**状态**: ⚪ 待完成

### 最终 Review
**状态**: ⚪ 待完成

---

## 📞 需要用户确认的事项

1. [ ] ~~确认可以开始执行~~ ✅ 已确认
2. [ ] Phase 1 完成后确认部署
3. [ ] Phase 2 Rollout 策略确认

---

*最后更新: 2026-01-27*
