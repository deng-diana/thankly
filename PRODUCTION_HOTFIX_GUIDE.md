# 🚨 生产环境紧急修复指南 - Thankly 后端

**问题**: Lambda 无法启动 - `Runtime.ImportModuleError`  
**影响**: 所有 API 返回 500 错误，移动端无法正常使用  
**修复时间**: 10-15 分钟

---

## ⚡️ 快速修复（3 步）

### 第 1 步: 启动 Docker Desktop
```bash
# macOS: 打开 Dock 中的 Docker Desktop 应用
# 等待 Docker 图标显示为绿色（约 30 秒）
```

### 第 2 步: 进入后端目录并检查环境
```bash
cd /Users/dengdan/Desktop/thankly/backend

# 运行预检查脚本
./pre-deploy-check.sh
```

**如果预检查失败**，根据提示修复：
- Docker 未运行 → 启动 Docker Desktop
- AWS 凭证无效 → 运行 `aws configure` 重新配置

### 第 3 步: 部署到生产环境
```bash
# 重新构建并部署（自动执行所有步骤）
./deploy.sh

# 预计时间: 5-10 分钟
# 观察输出，确保每一步都成功（绿色 ✅）
```

### 第 4 步: 验证部署
```bash
# 等待 1-2 分钟让 Lambda 更新
sleep 120

# 运行验证脚本
./post-deploy-verify.sh
```

---

## 🔍 验证清单

部署完成后，确认以下项目：

### Lambda 函数
- [ ] Lambda 状态为 "Active"
- [ ] 最新日志中看到 `✅ 配置加载成功`
- [ ] 没有 `ImportModuleError` 错误

### 移动端测试
- [ ] 打开 App
- [ ] 尝试创建**图片日记**
- [ ] 确认不再出现 "获取预签名 URL 失败: 500" 错误
- [ ] 日记列表可以正常加载

### API 端点测试
```bash
# 替换为你的 Lambda Function URL
curl https://your-lambda-url.amazonaws.com/health

# 预期响应:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-27T...",
#   "service": "Gratitude Diary API",
#   "version": "1.0.0"
# }
```

---

## 🐛 如果部署失败

### 问题 1: Docker 推送失败
```
Error: denied: Your authorization token has expired
```

**解决方案**:
```bash
# 重新登录 ECR
aws ecr get-login-password --region us-east-1 | \
docker login --username AWS --password-stdin \
633404778395.dkr.ecr.us-east-1.amazonaws.com

# 重新运行部署
./deploy.sh
```

### 问题 2: Lambda 更新失败
```
Error: ResourceNotFoundException
```

**解决方案**:
1. 登录 AWS Console
2. 进入 Lambda → Functions
3. 确认函数名为 `gratitude-diary-api`
4. 如果不存在，需要先创建 Lambda 函数

### 问题 3: 部署后仍然报错
**查看 CloudWatch 日志**:
```bash
# 方式 1: 使用 AWS CLI
aws logs tail /aws/lambda/gratitude-diary-api --follow --region us-east-1

# 方式 2: 在浏览器中打开
# https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fgratitude-diary-api
```

**查找关键错误**:
- `ImportModuleError` → 依赖问题（本次修复的核心）
- `ResourceNotFoundException` → DynamoDB 表或 S3 桶不存在
- `AccessDeniedException` → IAM 权限不足

---

## 📊 部署进度说明

### deploy.sh 执行步骤（约 7-10 分钟）

1. ✅ **检查工具** (10 秒)
   - Docker 已安装
   - AWS CLI 已配置

2. ✅ **登录 ECR** (5 秒)
   - 获取 AWS 认证令牌

3. ✅ **检查/创建 ECR 仓库** (5 秒)
   - 仓库名: `gratitude-diary`

4. ✅ **构建 Docker 镜像** (3-5 分钟) ← **最耗时**
   - 安装 Python 依赖
   - 复制源代码
   - **关键**: 安装 `pydantic-settings`

5. ✅ **推送镜像到 ECR** (2-3 分钟) ← **需要网络**
   - 上传完整镜像到 AWS

6. ✅ **更新 Lambda 函数** (10 秒)
   - Lambda 拉取新镜像
   - 更新函数代码

7. ✅ **等待生效** (1-2 分钟)
   - Lambda 冷启动
   - 加载新代码

---

## 🎯 核心修复内容

### 问题根因
```
RuntimeError: cannot import name 'get_boto3_kwargs' from 'app.config'
  ↓
原因: pydantic_settings 模块未安装
  ↓
根因: Lambda 镜像是旧版本
```

### 修复内容
```diff
# requirements.txt (第9行)
+ pydantic-settings==2.6.0  ✅ 已添加

# config.py (第1行)
+ from pydantic_settings import BaseSettings  ✅ 正确导入

# Dockerfile (第11-12行)
+ RUN pip install -r requirements.txt  ✅ 会安装所有依赖
```

### 验证修复
部署后在 CloudWatch 日志中看到：
```
✅ 配置加载成功 - 表名: GratitudeDiaries, 区域: us-east-1
```

---

## 📞 需要帮助？

### 查看详细文档
- **Code Review 报告**: `backend/CODE_REVIEW_REPORT.md`
- **紧急修复指南**: `backend/EMERGENCY_FIX.md`
- **预检查脚本**: `backend/pre-deploy-check.sh`
- **验证脚本**: `backend/post-deploy-verify.sh`

### AWS Console 快捷链接
- **Lambda 函数**: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/gratitude-diary-api
- **CloudWatch 日志**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fgratitude-diary-api
- **ECR 仓库**: https://console.aws.amazon.com/ecr/repositories?region=us-east-1

---

## ✅ 部署成功标志

看到以下输出说明部署成功：

```bash
========================================
✅ 部署完成!
========================================

API端点: 请在AWS Lambda控制台查看 Function URL 或 API Gateway URL
```

然后在移动端测试时：
- ✅ 图片日记可以成功保存
- ✅ 日记列表正常显示
- ✅ 没有 500 错误

---

**最后更新**: 2026-01-27  
**审查人**: AI Senior Engineer  
**状态**: ✅ Ready to Deploy
