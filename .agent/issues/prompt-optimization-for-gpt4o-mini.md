# Prompt Optimization for GPT-4o-mini

**Type**: improvement  
**Priority**: high  
**Effort**: medium  
**Created**: 2026-01-27

---

## TL;DR

优化提示词，使 GPT-4o-mini 达到接近 GPT-4o 的质量，同时保持 3 倍速度优势。

---

## Current State vs Expected

| 项目 | 当前状态 | 期望状态 |
|------|----------|----------|
| 模型 | gpt-4o (polish, feedback) | gpt-4o-mini (全部) |
| 速度 | 2.5秒/请求 | 0.8秒/请求 |
| 质量 | 高 | 同等质量 |
| 提示词长度 | ~200行 | ~80行 (精简) |

---

## 专家级优化策略

### 1. 精简提示词 (Reduce Token Count)

**原理**: GPT-4o-mini 处理更少的 token 会更快且更精准

**当前问题**:
- Polish prompt: ~4000 tokens
- Feedback prompt: ~3000 tokens
- 大量例子，有些冗余

**优化方向**:
```
# 之前: 6个例子，每个3-4行
Example 1 - Article/Tense Errors:
❌ Original: "Today I go to park and see beautiful flower..."
✅ Polished: "Today I went to the park and saw beautiful flowers..."
📚 Learning: Removed all fillers...

# 之后: 3个精选例子，每个1-2行
Examples:
1. "I go to park" → "I went to the park" (tense+article)
2. "um, like, I think" → "I think" (remove fillers)
3. "very like this" → "really love this" (native patterns)
```

### 2. 结构化指令 (Structured Instructions)

**原理**: Mini 模型对清晰结构响应更好

**当前问题**:
- 指令分散在多个段落
- 优先级不明确

**优化方向**:
```
# 使用 PRIORITY 标记
[PRIORITY 1] Title language = Input language (NEVER translate)
[PRIORITY 2] Remove ALL fillers (um, like, you know)
[PRIORITY 3] Keep length ≤115% of original

# 使用明确的 DO/DON'T
DO: Fix grammar, improve flow
DON'T: Change meaning, add new content
```

### 3. Few-Shot 优化 (Better Examples)

**原理**: Mini 模型高度依赖示例质量

**当前问题**:
- 示例覆盖边缘案例，但基础案例不够强

**优化方向**:
- 保留 3 个高质量核心示例
- 移除冗余示例
- 每个示例必须展示一个清晰规则

### 4. 输出格式强化 (Explicit Output Format)

**原理**: Mini 模型需要更明确的输出格式指导

**优化方向**:
```json
{
  "title": "string, 5-15 chars, same language as input",
  "polished_content": "string, preserve meaning, fix grammar only"
}
```

### 5. 温度调优 (Temperature Tuning)

**当前设置**:
- polish: 0.3 (保守)
- feedback: 0.7 (创意)

**建议调整**:
- polish: 0.2 → 更一致的输出
- feedback: 0.6 → 稍微保守但仍有温度

---

## 实施计划

### Phase 1: Polish Prompt 优化 (预计节省 50% tokens)

1. 精简语言规则 (200行 → 60行)
2. 保留 3 个核心示例
3. 强化 JSON 输出格式
4. 测试 10 个案例

### Phase 2: Feedback Prompt 优化 (预计节省 40% tokens)

1. 精简情绪列表说明 (每个情绪 1 行 vs 3 行)
2. 移除冗余的区分规则
3. 强化 reply 简洁规则
4. 测试 10 个案例

### Phase 3: 模型切换

1. 修改 MODEL_CONFIG
2. 部署到测试环境
3. 对比测试 (速度 + 质量)
4. 生产部署

---

## 相关文件

- `backend/app/services/openai_service.py` - 主要修改
- `backend/app/services/openai_service_emotion_agent.py` - 情绪分析 (已是 mini)

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 质量下降 | 中 | 中 | A/B 测试，保留回滚能力 |
| 标题语言错误 | 低 | 高 | 强化语言规则示例 |
| JSON 解析失败 | 低 | 高 | 添加 fallback 逻辑 |

---

## 成功指标

1. **速度**: 总处理时间减少 30%+
2. **质量**: 用户满意度不下降 (主观评估)
3. **成本**: API 费用降低 50%+

---

## 参考资料

- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [GPT-4o-mini Best Practices](https://platform.openai.com/docs/models/gpt-4o-mini)
