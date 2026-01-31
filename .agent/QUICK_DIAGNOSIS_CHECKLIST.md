# 🚨 生产环境缓慢问题 - 快速诊断清单

**执行时间**: 5-10分钟  
**目标**: 确定生产环境是否部署了最新代码

---

## ✅ 第一步：运行自动诊断脚本（推荐）

```bash
# 在项目根目录执行
cd /Users/dengdan/Desktop/thankly
./scripts/diagnose-production-deployment.sh
```

这个脚本会自动检查：
- ✅ 远程tag是否存在
- ✅ GitHub Actions运行状态
- ✅ Lambda函数镜像版本
- ✅ CloudWatch日志中的新版本特征

---

## 📋 第二步：手动检查（如果脚本无法运行）

### 1. 检查GitHub Actions ⭐ **最重要**

**网址**: https://github.com/deng-diana/thankly/actions/workflows/deploy-backend.yml

**检查项**:
- [ ] 是否有 `backend-v1.4.0` tag触发的workflow运行？
- [ ] 运行状态是 ✅ Success 还是 ❌ Failed？
- [ ] 运行时间是否在 2026-01-27 或之后？

**如果看到 Failed**:
```
进入失败的workflow → 点击查看详细日志 → 
查找错误关键词: "login", "ECR", "credentials", "denied"
```

**如果没有任何运行记录**:
```
说明tag未推送，或workflow未触发
解决: git push --tags
```

---

### 2. 检查远程tag

```bash
git ls-remote --tags origin | grep backend-v1.4.0
```

**预期输出**:
```
48827b3665222eaaeb3d666f6c6b0b24aca8d227 refs/tags/backend-v1.4.0
```

**如果为空**: tag未推送
```bash
git push --tags
```

---

### 3. 检查AWS Lambda（需要AWS Console访问）

**网址**: https://console.aws.amazon.com/lambda/

**步骤**:
1. 进入 Lambda → Functions → `gratitude-diary-api`
2. 点击 "Image" 标签
3. 查看 "Image URI" 和 "Last modified"

**关键检查**:
- [ ] Last modified 是否 >= 2026-01-27?
- [ ] Image URI 是否包含 `:latest` tag?

**如果 Last modified < 2026-01-27**:
```
说明Lambda未更新，需要强制更新或重新部署
```

---

### 4. 检查CloudWatch日志（最直接的证据）

**网址**: https://console.aws.amazon.com/cloudwatch/

**步骤**:
1. 进入 Logs → Log groups → `/aws/lambda/gratitude-diary-api`
2. 点击最新的 Log stream
3. 搜索关键字: `⏱️ Whisper 转录完成，耗时`

**关键判断**:
- ✅ **找到该日志**: 说明 backend-v1.4.0 已部署（新版本特征）
- ❌ **未找到该日志**: 说明仍在运行旧版本

**新版本vs旧版本日志对比**:

```
# 新版本 (v1.4.0) - 有详细计时
⏱️ Whisper 转录完成，耗时: 5.23 秒
⏱️ AI 总耗时: 12.45 秒

# 旧版本 (v1.3.x) - 无计时日志
✅ 临时文件准备完成
📤 正在识别语音（verbose_json 模式 - 异步）...
```

---

### 5. 检查GitHub Secrets（如果怀疑凭证问题）

**网址**: https://github.com/deng-diana/thankly/settings/secrets/actions

**检查项**:
- [ ] `AWS_ACCESS_KEY_ID` - 是否存在？
- [ ] `AWS_SECRET_ACCESS_KEY` - 是否存在？
- [ ] `AWS_ACCOUNT_ID` - 是否存在？

**如果修改了AWS凭证但未更新Secrets**:
```
1. 进入 AWS IAM Console
2. 创建新的 Access Key
3. 在 GitHub Secrets 中更新
4. 手动触发一次部署测试
```

---

## 🎯 根据检查结果的行动方案

### 场景A: Tag未推送 ❌

**症状**: `git ls-remote` 无输出，GitHub Actions无运行记录

**解决**:
```bash
git push --tags
# 等待2-3分钟，GitHub Actions会自动触发
```

---

### 场景B: GitHub Actions失败 ❌

**症状**: Workflow状态显示 Failed

**可能原因**:
1. AWS凭证失效 → 更新GitHub Secrets
2. ECR登录失败 → 检查AWS权限
3. Lambda更新失败 → 检查Lambda配置

**解决**:
1. 查看失败日志，确定具体错误
2. 修复错误后，手动触发重新部署:
   - 进入 GitHub Actions → Deploy Backend → Run workflow

---

### 场景C: Actions成功，但Lambda未更新 ⚠️

**症状**: 
- GitHub Actions显示 Success
- 但Lambda的 Last modified 仍是旧日期
- CloudWatch无新版本日志

**可能原因**:
1. Lambda使用了镜像缓存
2. ECR镜像推送成功，但Lambda未拉取
3. 网络延迟导致更新未完成

**解决**:
```bash
# 方法1: 强制更新Lambda（推荐）
aws lambda update-function-code \
  --function-name gratitude-diary-api \
  --image-uri $(aws lambda get-function \
    --function-name gratitude-diary-api \
    --region us-east-1 \
    --query 'Code.ImageUri' \
    --output text) \
  --region us-east-1

# 方法2: 手动重新部署
# 删除并重新创建tag
git tag -d backend-v1.4.0
git push origin :refs/tags/backend-v1.4.0
git tag backend-v1.4.0 48827b3
git push --tags
```

---

### 场景D: 一切正常，但仍然缓慢 😢

**症状**:
- ✅ GitHub Actions成功
- ✅ Lambda已更新
- ✅ CloudWatch有新版本日志
- ❌ 但处理仍然超过1分钟

**可能原因**:
1. **Lambda冷启动**: 首次调用需要拉取镜像（10-20秒）
2. **OpenAI API慢**: Whisper转录本身慢（检查日志中的实际耗时）
3. **网络延迟**: Lambda到OpenAI的网络慢
4. **资源不足**: Lambda内存/CPU不够

**解决方案**:

#### 立即优化（无需修改代码）:
```bash
# 1. 增加Lambda内存（提升CPU和网络带宽）
aws lambda update-function-configuration \
  --function-name gratitude-diary-api \
  --memory-size 3008 \
  --region us-east-1

# 2. 启用Provisioned Concurrency（避免冷启动）
aws lambda put-provisioned-concurrency-config \
  --function-name gratitude-diary-api \
  --provisioned-concurrent-executions 2 \
  --qualifier \$LATEST \
  --region us-east-1
```

#### 中期优化（需要代码改动）:
1. 使用更快的语音转录服务（Deepgram, AssemblyAI）
2. 添加转录结果缓存
3. 优化AI Prompt减少Token数量

---

## 📊 诊断结果记录表

请填写以下表格，方便后续分析：

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 远程tag存在? | ☐ 是 ☐ 否 | |
| GitHub Actions状态 | ☐ Success ☐ Failed ☐ 无记录 | |
| Lambda Last modified | | 填写日期和时间 |
| CloudWatch新版本日志 | ☐ 有 ☐ 无 | |
| GitHub Secrets完整? | ☐ 是 ☐ 否 | |
| 实际处理耗时 | | 测试一次5秒音频的总耗时 |

---

## 🆘 仍然无法解决？

请提供以下信息给CTO：

1. **GitHub Actions截图**: 最近一次运行的完整日志
2. **Lambda信息**: Image URI + Last modified时间
3. **CloudWatch日志**: 最近一次调用的完整日志（至少50行）
4. **测试结果**: 录制5秒音频，记录每个进度点的停留时间
5. **诊断脚本输出**: `./scripts/diagnose-production-deployment.sh` 的完整输出

---

## ⏱️ 预期时间线

```
正常流程:
1. git push --tags        → 立即完成
2. GitHub Actions触发     → 2-3分钟内开始
3. 构建并推送镜像        → 5-8分钟
4. 更新Lambda函数        → 1-2分钟
5. 验证生产环境          → 1分钟

总计: 10-15分钟从推送到生产可用
```

如果超过20分钟仍未生效，说明某个环节卡住了，需要深入诊断。

---

**快速联系方式**: 
- 紧急问题: 立即在会话中@我
- 异步沟通: 提供上述诊断结果

祝顺利解决！🚀
