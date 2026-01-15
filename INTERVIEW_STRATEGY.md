# 🎓 Thankly Project: Interview Strategy & Success Stories

作为一名 AI 产品工程师，在面试中展示你的**技术深度**和**产品洞察**至关重要。以下是将本项目转化为面试谈资的精华总结。

---

### 🌟 场景 1：AI 幻觉与质量控制 (Handling AI Hallucinations)

**面试问题**：_“在使用 OpenAI Whisper 等模型时，你遇到过什么预料之外的挑战？是如何解决的？”_

- **Situation**: 在测试阶段，发现当用户在吵闹环境下（或有背景音乐）使用语音日记时，Whisper 偶尔会将噪音误识别为长串的韩语、日语或重复的无意义文本。
- **Action**: 我没有简单地接受 AI 的输出，而是实现了一个**规则引擎过滤层**：
  1. **语言白名单**：检测识别出的语言是否在 [中, 英] 之内。
  2. **密度/重复率检测**：计算字符重复率。如果某词出现频率超过 40%，判定为 AI 幻觉并拦截，提示用户重新录制。
  3. **字符集校验**：通过正则检查文本中是否包含大量非目标语言字符。
- **Result**: 这一机制确保了进入数据库和 AI 润色环节的数据是高质量的，避免了 AI 反馈出现乱码，极大地提升了产品的健壮性。

---

### 🌟 场景 2：多模态数据的性能优化 (Performance for Multimodal Data)

**面试问题**：_“你是如何优化图片和语音日记的处理速度的？”_

- **Situation**: 图片日记涉及多个大文件的 S3 上传，同时还需要触发 AI 接口。
- **Action**:
  1. **并行化处理 (Async Gather)**：在后端，我使用 `asyncio.gather` 并行执行 S3 上传验证和 AI 预处理。
  2. **预签名 URL (Presigned URLs)**：App 端直接上传到 S3，绕过 Lambda 的 6MB 负载限制，减轻了服务器压力。
  3. **愿景 (Vision) 降级策略**：在 AI 分析时使用 `low-res` 模式，在不损失理解能力的前提下，将响应速度提升了 30%。
- **Result**: 即便包含多张图片和长语音，用户也能在 3-5 秒内获得完整的分析反馈。

---

### 🌟 场景 3：以用户为中心的设计与合规 (User-Centric Policy & UX)

**面试问题**：_“在项目交付的最后阶段，你关注哪些细节？”_

- **Situation**: 随着功能从纯文字扩展到音视频和图片，原有的隐私披露已经过时。
- **Action**:
  1. **合规审计**：主动重写了中英文双语的隐私政策，详细披露了相机权限、相册权限的使用目的，以及数据如何加密存储在 AWS。
  2. **空状态优化 (Empty States)**：不仅仅是显示“无数据”，而是设计了带有“心理暗示”的引导文案，将空页面转化为功能入口，降低用户的创作门槛。
- **Result**: 这种对细节的关注不仅让应用在 App Store 审核中更顺利，也体现了开发者对用户隐私的敬畏。

---

### 💡 核心技术栈关键词 (Cheat Sheet)

在面试中多提及以下专业术语，展示你的资历：

- **Concurrency & Parallelism**: `asyncio`, `gather`, `httpx` (Python)
- **State Management**: `useState`, `useRef` 优化性能 (React Native)
- **Cloud Native**: Serverless architecture, JWT authentication via Cognito.
- **AI Engineering**: Prompt Engineering, Token optimization, Hallucination filtering.

---

**记住：最好的工程师不只是码农，而是能解决复杂问题的产品塑造者 (Product Shaper)。祝你面试顺利！** 🚀

