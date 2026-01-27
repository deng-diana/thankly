# 🚨 生产环境紧急修复指南

## 问题诊断
- **错误**: `Runtime.ImportModuleError: cannot import name 'get_boto3_kwargs' from 'app.config'`
- **根因**: Lambda 环境缺少 `pydantic-settings` 依赖
- **影响**: 所有 API 返回 500 错误，移动端无法正常使用

## 立即修复步骤

### 步骤 1: 确认当前目录
```bash
cd /Users/dengdan/Desktop/thankly/backend
pwd
```

### 步骤 2: 检查 Docker 是否运行
```bash
docker ps
# 如果报错 "Cannot connect to the Docker daemon"
# 请先启动 Docker Desktop
```

### 步骤 3: 清理旧镜像（可选但推荐）
```bash
# 删除本地旧镜像，确保使用最新代码
docker rmi gratitude-diary:latest 2>/dev/null || true
```

### 步骤 4: 重新构建并部署
```bash
# 设置 AWS 区域（如果需要）
export AWS_REGION=us-east-1

# 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 步骤 5: 等待部署完成并验证

部署脚本会执行以下操作：
1. ✅ 登录到 AWS ECR
2. ✅ 构建新的 Docker 镜像（包含 pydantic-settings）
3. ✅ 推送镜像到 ECR
4. ✅ 更新 Lambda 函数代码

**预计时间**: 5-10 分钟

### 步骤 6: 验证修复

部署完成后，等待 1-2 分钟让 Lambda "冷启动"，然后测试：

```bash
# 测试健康检查端点
curl https://your-lambda-url.amazonaws.com/health

# 预期返回：
# {
#   "status": "healthy",
#   "timestamp": "2026-01-27T...",
#   "service": "Gratitude Diary API",
#   "version": "1.0.0"
# }
```

或者直接在移动端测试：
1. 打开 App
2. 尝试创建图片日记
3. 确认不再出现 "获取预签名 URL 失败" 错误

---

## 如果部署失败

### 常见问题 1: Docker 未启动
**错误信息**: `Cannot connect to the Docker daemon`  
**解决方案**: 启动 Docker Desktop，等待完全启动后重试

### 常见问题 2: AWS 凭证过期
**错误信息**: `Unable to locate credentials`  
**解决方案**: 
```bash
aws configure
# 重新输入 Access Key 和 Secret Key
```

### 常见问题 3: ECR 推送失败
**错误信息**: `denied: Your authorization token has expired`  
**解决方案**: 
```bash
# 重新登录 ECR
aws ecr get-login-password --region us-east-1 | \
docker login --username AWS --password-stdin \
633404778395.dkr.ecr.us-east-1.amazonaws.com
```

---

## 监控修复效果

### 查看 CloudWatch 日志
1. 进入 AWS Console → Lambda → gratitude-diary-api
2. 点击 "Monitor" → "View logs in CloudWatch"
3. 查看最新日志流
4. 确认看到 "✅ 配置加载成功" 而不是导入错误

### 关键成功标志
- ✅ 日志中出现: `✅ 配置加载成功`
- ✅ 移动端可以创建图片日记
- ✅ API 返回 200 状态码而非 500
- ✅ 日记列表可以正常加载

---

## Code Review 检查清单

在部署前，我已经检查了：
- ✅ `requirements.txt` 包含 `pydantic-settings==2.6.0`（第 9 行）
- ✅ `Dockerfile` 正确安装依赖（第 11-12 行）
- ✅ `config.py` 导入语句正确（第 1 行）
- ✅ `get_boto3_kwargs` 函数存在（第 99-107 行）
- ✅ 所有服务（S3、DynamoDB）都正确使用 `get_boto3_kwargs`
- ✅ Lambda handler 入口正确（`lambda_handler.handler`）

---

## 后续优化建议

1. **添加 CI/CD 流水线** - 自动化测试和部署
2. **依赖锁定** - 使用 `pip freeze` 锁定精确版本
3. **健康检查告警** - CloudWatch Alarm 监控健康端点
4. **回滚机制** - 保留上一个可用镜像版本

---

**最后更新**: 2026-01-27  
**修复时长**: 预计 10-15 分钟（包括部署和验证）
