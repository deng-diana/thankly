# 语音处理性能优化方案

> **问题**: 语音日记在生产环境处理缓慢（卡在 25%），长录音出现 403 错误导致内容丢失
> **目标**: 达到类似 Wispr Flow 的快速体验
> **创建日期**: 2026-01-30
> **状态**: 🚧 进行中

---

## 1. 诊断报告

### 1.1 问题症状

| 症状 | 描述 | 严重程度 |
|------|------|----------|
| **25% 卡顿** | 短音频（5-6秒）卡在 25% 长达 10-30 秒 | 🔴 Critical |
| **403 错误** | 长录音上传失败，珍贵内容丢失 | 🔴 Critical |
| **本地/线上差异** | 本地快，线上慢 | 🟡 Medium |

### 1.2 根因分析

#### 问题 1：为什么卡在 25%？

```
当前流程时序：
┌─────────────────────────────────────────────────────────────────┐
│ 0s     用户停止录音                                              │
│ 1-2s   读取文件 + 获取预签名URL（已并行优化 ✅）                   │
│ 3-15s  S3 上传（进度 0% → 100%）                                 │
│ 15s    调用 /diary/voice/async-with-url → 创建 task_id          │
│ 16s    开始轮询后端进度...                                       │
│        ┌────────────────────────────────────────────────────┐   │
│        │ ⚠️ 问题发生在这里！                                 │   │
│        │ • Lambda 冷启动 (2-5s)                              │   │
│        │ • 后端从 S3 下载音频 (2-5s)                         │   │
│        │ • Whisper 转录中... (15-45s)                        │   │
│        │                                                     │   │
│        │ 前端看到：25% → 卡住 → 卡住 → 卡住...               │   │
│        └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**根因**: Lambda 冷启动 + Whisper 转录延迟 + 音频文件过大

#### 问题 2：为什么长音频 403 错误？

| 错误码 | 原因 | 当前代码问题 |
|--------|------|-------------|
| **403** | S3 预签名 URL 过期（默认 15 分钟） | 长音频上传 + 网络慢可能超时 |
| **413** | 请求体超限 | 图片上传触发（不是音频） |

#### 问题 3：为什么本地快、线上慢？

| 环境 | 原因 |
|------|------|
| **本地** | 后端持续运行，无冷启动，localhost 网络快 |
| **线上 Lambda** | 冷启动 2-5 秒 + 从 S3 下载音频 + 网络延迟 |

### 1.3 当前音频配置分析

**文件**: `mobile/src/hooks/useVoiceRecording.ts:554-564`

| 参数 | 当前值 | 问题 |
|------|--------|------|
| **比特率** | 96 kbps | 语音识别不需要这么高 |
| **采样率** | 44.1 kHz | Whisper 会重采样到 16kHz |
| **声道** | 2 (立体声) | 语音不需要立体声 |

**典型文件大小**:
- 1 分钟 @ 96kbps 立体声 = ~1.4 MB
- 5 分钟 @ 96kbps 立体声 = ~3.6 MB
- 10 分钟 @ 96kbps 立体声 = ~7.2 MB

---

## 2. Wispr Flow 学习分析

> 参考: [Wispr Flow 官方](https://wisprflow.ai/features), [技术评测](https://zackproser.com/blog/wisprflow-review)

### 2.1 Wispr Flow 为什么快？

1. **实时流式处理** - 边说边转录，不是录完再处理
2. **本地预处理** - 客户端先做 VAD（语音活动检测）
3. **云端并行** - 多个小 chunk 并行转录
4. **持久连接** - 保持 WebSocket 连接避免重复握手
5. **优化音频格式** - 低比特率，单声道

### 2.2 可借鉴的点

| Wispr Flow 特性 | 我们可以做 | 复杂度 |
|-----------------|-----------|--------|
| 低比特率音频 | ✅ Phase 1 实现 | 低 |
| 预热服务 | ✅ Phase 2 实现 | 低 |
| 流式转录 | Phase 4 长期目标 | 高 |

---

## 3. 解决方案（分阶段）

### Phase 1: 音频压缩 ⭐️ 立即见效

**目标**: 减少文件体积 66%，加速上传和转录

**改动对比**:

| 参数 | 当前 | 优化后 | 效果 |
|------|------|--------|------|
| **比特率** | 96 kbps | **64 kbps** | 体积 -33% |
| **采样率** | 44.1 kHz | **16 kHz** | 跳过重采样 |
| **声道** | 2 (立体声) | **1 (单声道)** | 体积 -50% |

**预期效果**:
- 5 分钟音频：3.6 MB → **~0.6 MB**（减少 83%）
- 上传时间：10-20s → **2-4s**
- Whisper 处理：跳过重采样，节省 0.5-1s

**技术依据**:
- [OpenAI 社区](https://community.openai.com/t/what-minimum-bitrate-should-i-use-for-whisper/178210): 64kbps 对语音识别无质量损失
- [DEV.to 优化指南](https://dev.to/mxro/optimise-openai-whisper-api-audio-format-sampling-rate-and-quality-29fj): 16kHz 是 Whisper 原生采样率

**涉及文件**:
- `mobile/src/hooks/useVoiceRecording.ts:554-564`

**状态**: ⏳ 待执行

---

### Phase 2: Lambda 预热 ⭐️ 避免冷启动

**目标**: 消除 2-5 秒的 Lambda 冷启动延迟

**方案 A: CloudWatch 定时 Ping（推荐）**

```
成本: ~$0.50/月
实现: EventBridge 每 5 分钟调用一次 Lambda
效果: 保持 Lambda 温暖状态
适用: 低频使用场景
```

**方案 B: Provisioned Concurrency（备选）**

```
成本: ~$50-100/月（1 个实例 × 24/7）
实现: 预分配 1-2 个 Lambda 实例
效果: 完全消除冷启动
适用: 高频使用、对延迟极度敏感
```

**技术依据**:
- [AWS 官方博客](https://aws.amazon.com/blogs/compute/understanding-and-remediating-cold-starts-an-aws-lambda-perspective/)

**涉及配置**:
- AWS EventBridge (CloudWatch Events)
- Lambda 函数配置

**状态**: ⏳ 待执行

---

### Phase 3: 403 错误处理 ⭐️ 防止内容丢失

**目标**: 长音频上传不再失败

**改动**:
1. 增加预签名 URL 有效期：15 分钟 → 60 分钟
2. 添加 403 错误重试逻辑（重新获取 URL 后重试）
3. 添加上传超时保护

**涉及文件**:
- `mobile/src/services/audioUploadService.ts`
- `backend/app/services/s3_service.py`（预签名 URL 生成）

**状态**: 📋 计划中

---

### Phase 4: 流式转录（长期）

**目标**: 实现类似 Wispr Flow 的实时体验

**技术选型**:
- OpenAI [Realtime Transcription API](https://platform.openai.com/docs/guides/realtime-transcription)
- 或 [whisper-flow](https://github.com/dimastatz/whisper-flow) 开源方案

**涉及改动**:
- 前端：分 chunk 录制 + WebSocket
- 后端：流式接收 + 增量转录

**状态**: 📋 长期规划

---

## 4. 执行记录

### Phase 1 执行记录

| 时间 | 操作 | 结果 |
|------|------|------|
| 2026-01-30 | 修改音频参数 | ✅ 完成 |
| | - sampleRate: 44100 → 16000 | ✅ |
| | - numberOfChannels: 2 → 1 | ✅ |
| | - bitRate: 96000 → 64000 | ✅ |
| | 测试录音质量 | ⏳ 待测试 |
| | 对比文件大小 | ⏳ 待测试 |

### Phase 2 执行记录

| 时间 | 操作 | 结果 |
|------|------|------|
| 2026-01-30 14:37 | 创建 EventBridge Schedule | ✅ 完成 |
| | - 名称: lambda-warmup-thankly | ✅ |
| | - Lambda 函数: gratitude-diary-api | ✅ |
| | - 区域: us-east-1 | ✅ |
| | - 定时间隔: rate(5 minutes) | ✅ |
| | - Payload: GET /health | ✅ |
| | - 状态: Enabled | ✅ |
| | 测试 Lambda 冷启动 | ⏳ 待测试 |

---

## 5. 验证清单

### Phase 1 验证

- [ ] 新录音文件大小减少 >50%
- [ ] 转录准确度无明显下降
- [ ] iOS 录音正常
- [ ] Android 录音正常

### Phase 2 验证

- [ ] CloudWatch 日志显示定时调用
- [ ] Lambda 冷启动次数减少
- [ ] 语音处理响应时间改善

### 整体验证

- [ ] 5 秒短音频处理时间 < 10 秒
- [ ] 5 分钟长音频稳定完成
- [ ] 不再出现 403 错误
- [ ] 25% 卡顿问题解决

---

## 6. 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 音频压缩影响转录准确度 | 低 | 中 | 64kbps 已被验证足够 |
| Lambda 预热增加成本 | 中 | 低 | CloudWatch ping 成本极低 |
| Provisioned Concurrency 成本 | 高 | 中 | 先用 ping 方案评估效果 |

---

## 7. 参考资料

- [OpenAI Whisper 最佳比特率讨论](https://community.openai.com/t/what-minimum-bitrate-should-i-use-for-whisper/178210)
- [优化 Whisper API 音频格式](https://dev.to/mxro/optimise-openai-whisper-api-audio-format-sampling-rate-and-quality-29fj)
- [AWS Lambda 冷启动优化](https://aws.amazon.com/blogs/compute/understanding-and-remediating-cold-starts-an-aws-lambda-perspective/)
- [Wispr Flow 官方](https://wisprflow.ai/features)
- [OpenAI Realtime Transcription](https://platform.openai.com/docs/guides/realtime-transcription)

---

**文档维护者**: Claude AI + @dengdan
**最后更新**: 2026-01-30
