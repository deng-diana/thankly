# /check-local-config

检查本地开发环境配置，确保 `IS_LOCAL_DEV` 和 IP 地址配置正确。

## 你的目标

快速诊断本地开发环境配置问题，避免因 IP 地址变化或配置错误导致的连接失败。

## 检查内容

1. **`IS_LOCAL_DEV` 配置**
   - 检查是否为 `true`（本地开发模式）
   - 如果不是，提示切换到本地模式

2. **IP 地址一致性**
   - 读取配置文件中的 IP 地址
   - 检测当前机器的实际局域网 IP
   - 对比两者是否一致
   - 如果不一致，提供更新建议

3. **后端服务可达性**（可选）
   - 如果 `IS_LOCAL_DEV = true`，尝试连接后端服务
   - 检查端口 8000 是否可访问
   - 提供连接状态反馈

## 执行步骤

### 1. 读取配置文件

```bash
# 读取 aws-config.ts
cat mobile/src/config/aws-config.ts | grep -E "IS_LOCAL_DEV|192\.168\."
```

**检查点：**
- `IS_LOCAL_DEV` 的值
- 配置的 IP 地址（从 `API_BASE_URL` 中提取）

### 2. 检测当前机器 IP

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1

# 或者使用更精确的方法
ipconfig getifaddr en0  # macOS Wi-Fi
ipconfig getifaddr en1  # macOS 以太网
```

**注意：** 优先选择非 127.0.0.1 的局域网 IP。

### 3. 对比 IP 地址

- **如果一致：** ✅ 配置正确
- **如果不一致：** ⚠️ 需要更新配置文件

### 4. 检查后端服务（可选）

```bash
# 尝试连接后端
curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://[检测到的IP]:8000/health || echo "连接失败"
```

## 输出格式

```
🔍 本地开发环境配置检查

✅ IS_LOCAL_DEV: true
⚠️  IP 地址不匹配！
   - 配置文件: 192.168.0.94
   - 当前机器: 192.168.0.28
   - 建议: 更新 aws-config.ts 中的 IP 为 192.168.0.28

📡 后端服务检查:
   - 状态: ❌ 不可达
   - 原因: 连接超时
   - 建议: 检查后端是否在运行 (cd backend && python -m uvicorn app.main:app --reload)
```

## 自动修复建议

如果检测到问题，提供：

1. **IP 地址不匹配：**
   ```typescript
   // 建议更新为：
   export const API_BASE_URL = IS_LOCAL_DEV ? "http://192.168.0.28:8000" : PRODUCTION_URL;
   ```

2. **IS_LOCAL_DEV 错误：**
   ```typescript
   // 建议更新为：
   const IS_LOCAL_DEV = true;  // 本地开发模式
   ```

3. **后端服务不可达：**
   ```bash
   # 启动后端服务：
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## 使用场景

- **开发前检查：** 每次开始开发前运行，确保配置正确
- **连接失败时：** 遇到 "Network request timed out" 时立即检查
- **网络环境变化：** 切换 Wi-Fi 或网络后检查
- **新机器设置：** 在新机器上配置开发环境时使用

## 注意事项

1. **IP 地址可能变化：**
   - 切换 Wi-Fi 网络
   - 路由器重启
   - DHCP 重新分配

2. **多网卡情况：**
   - 如果机器有多个网络接口（Wi-Fi + 以太网），优先使用活跃的接口

3. **端口检查：**
   - 确保后端服务运行在 8000 端口
   - 确保防火墙允许 8000 端口

## 快速命令

```bash
# 一键检查（需要实现为脚本）
cd /Users/dengdan/Desktop/thankly
./scripts/check-local-config.sh
```

## 集成到开发流程

建议在以下时机自动检查：
- Git pre-commit hook（如果 `IS_LOCAL_DEV = true`）
- 开发服务器启动时
- 遇到网络错误时

---

**创建日期：** 2025-01-24  
**维护者：** AI Assistant  
**相关文件：** `mobile/src/config/aws-config.ts`
