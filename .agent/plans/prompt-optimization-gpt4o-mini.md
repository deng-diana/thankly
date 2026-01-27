# Prompt Optimization for GPT-4o-mini

**Overall Progress:** `90%` 🟨 待部署

## TLDR

将 Polish 和 Feedback 的模型从 GPT-4o 切换到 GPT-4o-mini，同时优化提示词以保持高质量输出。预期速度提升 3 倍，质量保持 90-95%。

## Critical Decisions

基于用户确认的探索结果：

- **润色优先级**: 自然流畅 > 语法正确 - 用户体验优先
- **反馈长度**: 简短有力 (1-2 句) - 减少 token 消耗，提升速度
- **学习笔记**: 保留 📚 Learning 功能 - 用户认为有价值
- **温度调整**: Polish 0.3→0.2, Feedback 0.7→0.5 - Mini 需要更低温度

## Tasks

### Phase 1: Polish Prompt 优化

- [ ] 🟥 **Step 1.1: 精简语言规则**
  - [ ] 🟥 移除冗余的语言检测规则（保留核心 3 条）
  - [ ] 🟥 合并重复的格式化指令
  - [ ] 🟥 将 "自然流畅" 提升为第一优先级

- [ ] 🟥 **Step 1.2: 优化示例**
  - [ ] 🟥 从 6 个例子精简到 3 个高质量例子
  - [ ] 🟥 每个例子必须展示不同的优化类型
  - [ ] 🟥 保留 📚 Learning 解释格式

- [ ] 🟥 **Step 1.3: 强化输出格式**
  - [ ] 🟥 简化 JSON schema 说明
  - [ ] 🟥 添加字段长度约束
  - [ ] 🟥 移除不必要的警告文本

### Phase 2: Feedback Prompt 优化

- [ ] 🟥 **Step 2.1: 精简情绪列表**
  - [ ] 🟥 将 23 种情绪的说明从 3 行/个 减少到 1 行/个
  - [ ] 🟥 移除冗余的区分规则（保留 3 个最重要的）
  - [ ] 🟥 使用表格格式替代列表格式

- [ ] 🟥 **Step 2.2: 优化回复规则**
  - [ ] 🟥 强调 "1-2 句" 的长度限制
  - [ ] 🟥 添加简洁回复的正面示例
  - [ ] 🟥 移除 "温暖详细" 的引导

- [ ] 🟥 **Step 2.3: 强化输出格式**
  - [ ] 🟥 简化 JSON schema
  - [ ] 🟥 移除不必要的 confidence 和 rationale 字段
  - [ ] 🟥 减少输出 token 消耗

### Phase 3: 模型配置更新

- [ ] 🟥 **Step 3.1: 修改 MODEL_CONFIG**
  - [ ] 🟥 将 polish 从 gpt-4o 改为 gpt-4o-mini
  - [ ] 🟥 将 feedback 从 gpt-4o 改为 gpt-4o-mini
  - [ ] 🟥 调整温度参数

- [ ] 🟥 **Step 3.2: 更新日志输出**
  - [ ] 🟥 修改初始化日志，反映新的模型配置

### Phase 4: 验证与部署

- [ ] 🟥 **Step 4.1: 本地测试**
  - [ ] 🟥 测试中文短句 ("我好累")
  - [ ] 🟥 测试英文长段落
  - [ ] 🟥 验证 Learning 笔记正常生成

- [ ] 🟥 **Step 4.2: 部署**
  - [ ] 🟥 提交代码
  - [ ] 🟥 创建 backend tag
  - [ ] 🟥 触发 GitHub Actions 部署

## Success Metrics

| 指标 | 目标 |
|------|------|
| 处理速度 | 提升 50%+ |
| 润色质量 | 保持 90%+ |
| 反馈质量 | 保持 90%+ |
| 无 Linter 错误 | ✓ |

## Rollback Plan

如果质量明显下降：
1. 将 MODEL_CONFIG 改回 gpt-4o
2. 重新部署

---

*Created: 2026-01-27*
*Status: Pending Approval*
