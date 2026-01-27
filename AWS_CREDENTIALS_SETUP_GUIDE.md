# 🔑 AWS 凭证配置完整指南

## 📖 目录
1. [在 AWS 控制台获取凭证](#第一部分在-aws-控制台获取凭证)
2. [在本地电脑配置凭证](#第二部分在本地电脑配置凭证)
3. [验证配置是否成功](#第三部分验证配置)

---

## 第一部分：在 AWS 控制台获取凭证

### 步骤 1: 登录 AWS 控制台

1. 打开浏览器
2. 访问：https://console.aws.amazon.com/
3. 输入你的 AWS 账号、用户名和密码
4. 点击"登录"

---

### 步骤 2: 进入 IAM 服务

1. **在顶部搜索框**（页面最上方中间位置）输入：`IAM`
2. 在下拉列表中点击：**IAM** (Identity and Access Management)
3. 你会看到 IAM 控制面板

```
💡 提示：IAM 是管理用户和权限的地方
```

---

### 步骤 3: 找到你的用户

有两种方式，选择一种：

#### 方式A: 使用当前登录用户（推荐）

1. 点击右上角你的用户名（显示为你的账号名）
2. 在下拉菜单中点击 **"Security credentials"（安全凭证）**
3. 滚动到 **"Access keys"（访问密钥）** 部分

#### 方式B: 从用户列表查找

1. 在左侧菜单点击 **"Users"（用户）**
2. 在用户列表中找到你的用户名
3. 点击你的用户名
4. 点击 **"Security credentials"（安全凭证）** 标签
5. 滚动到 **"Access keys"（访问密钥）** 部分

---

### 步骤 4: 创建访问密钥

1. 在 **"Access keys"** 部分，点击 **"Create access key"（创建访问密钥）** 按钮

2. 选择使用场景：
   - 选择：**"Command Line Interface (CLI)"**
   - ✅ 勾选下方的确认框（"我了解上述建议..."）
   - 点击 **"Next"（下一步）**

3. 设置描述标签（可选）：
   - 输入描述：`Thankly 后端部署`
   - 点击 **"Create access key"（创建访问密钥）**

4. **⚠️ 重要：保存凭证信息**

   你会看到两个重要信息：
   ```
   Access key ID（访问密钥 ID）
   例如：AKIAIOSFODNN7EXAMPLE
   
   Secret access key（私有访问密钥）
   例如：wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

5. **立即下载或复制这些信息**：
   - 点击 **"Download .csv file"（下载 .csv 文件）** 按钮
   - 或者分别复制 Access key ID 和 Secret access key
   
   ```
   ⚠️ 重要警告：
   Secret access key 只会显示这一次！
   关闭窗口后就再也看不到了！
   一定要保存好！
   ```

6. 点击 **"Done"（完成）**

---

## 第二部分：在本地电脑配置凭证

### 方式 1: 使用 `aws configure` 命令（推荐）

1. **打开终端**（Terminal）
   - macOS: Spotlight 搜索 "Terminal" 或 Dock 中的终端图标

2. **输入配置命令**：
   ```bash
   aws configure
   ```

3. **按提示输入信息**：

   ```bash
   AWS Access Key ID [None]: 
   👉 粘贴你刚才复制的 Access Key ID
   例如：AKIAIOSFODNN7EXAMPLE
   
   AWS Secret Access Key [None]: 
   👉 粘贴你刚才复制的 Secret Access Key
   例如：wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   
   Default region name [None]: 
   👉 输入：us-east-1
   
   Default output format [None]: 
   👉 输入：json
   （或者直接按 Enter 使用默认值）
   ```

4. **完成！** 凭证已自动保存

---

### 方式 2: 手动编辑配置文件（仅当方式1不行时使用）

如果 `aws configure` 命令不工作，可以手动创建配置文件：

1. **打开终端**

2. **创建 AWS 配置目录**（如果不存在）：
   ```bash
   mkdir -p ~/.aws
   ```

3. **创建凭证文件**：
   ```bash
   nano ~/.aws/credentials
   ```

4. **输入以下内容**（替换为你的真实凭证）：
   ```ini
   [default]
   aws_access_key_id = AKIAIOSFODNN7EXAMPLE
   aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

5. **保存文件**：
   - 按 `Control + X`
   - 按 `Y`（确认保存）
   - 按 `Enter`（确认文件名）

6. **创建配置文件**：
   ```bash
   nano ~/.aws/config
   ```

7. **输入以下内容**：
   ```ini
   [default]
   region = us-east-1
   output = json
   ```

8. **保存文件**（同样的步骤：Control+X, Y, Enter）

---

## 配置文件保存在哪里？

配置完成后，你的 AWS 凭证会保存在以下位置：

### macOS / Linux:
```
🏠 主目录下的隐藏文件夹：

1. 凭证文件（包含 Access Key）：
   /Users/你的用户名/.aws/credentials
   完整路径示例：/Users/dengdan/.aws/credentials

2. 配置文件（包含区域设置）：
   /Users/你的用户名/.aws/config
   完整路径示例：/Users/dengdan/.aws/config
```

### 查看配置文件内容：
```bash
# 查看凭证文件
cat ~/.aws/credentials

# 查看配置文件
cat ~/.aws/config
```

---

## 第三部分：验证配置

### 验证步骤 1: 测试 AWS CLI

在终端运行：
```bash
aws sts get-caller-identity
```

**成功的输出示例**：
```json
{
    "UserId": "AIDAI23HXA2E4EXAMPLE",
    "Account": "633404778395",
    "Arn": "arn:aws:iam::633404778395:user/your-username"
}
```

如果看到类似输出，说明配置成功！✅

**失败的输出**：
```
Unable to locate credentials
```
→ 说明配置有问题，需要重新配置

---

### 验证步骤 2: 重新运行预检查脚本

```bash
cd /Users/dengdan/Desktop/thankly/backend
./pre-deploy-check.sh
```

**预期结果**：
```
✅ AWS CLI 已安装: aws-cli/2.x.x
✅ AWS 凭证有效 (Account: 633404778395)
```

---

## 🔒 安全提示

### ⚠️ 重要安全规则：

1. **永远不要分享你的 Secret Access Key**
   - 不要通过邮件、聊天工具发送
   - 不要提交到 Git 仓库
   - 不要截图包含密钥的界面

2. **定期轮换访问密钥**
   - 建议每 90 天更换一次
   - 在 IAM 控制台可以创建新密钥并删除旧密钥

3. **如果密钥泄露**：
   - 立即在 IAM 控制台停用或删除该密钥
   - 创建新的访问密钥
   - 检查 CloudTrail 日志查看是否有异常活动

4. **`.aws/credentials` 文件权限**：
   ```bash
   # 确保只有你能读取凭证文件
   chmod 600 ~/.aws/credentials
   ```

---

## 🎯 快速参考

### 配置命令（推荐方式）：
```bash
aws configure
```

### 配置文件位置：
```
~/.aws/credentials  # 凭证文件
~/.aws/config       # 配置文件
```

### 测试命令：
```bash
aws sts get-caller-identity
```

### 查看当前配置：
```bash
aws configure list
```

---

## 🆘 常见问题

### Q1: 忘记保存 Secret Access Key 怎么办？
**答**: 无法找回，需要创建新的访问密钥：
1. 回到 IAM 控制台
2. 删除旧密钥（如果不再使用）
3. 创建新的访问密钥
4. 重新配置

### Q2: 提示"Unable to locate credentials"？
**答**: 检查以下几点：
1. 确认已运行 `aws configure`
2. 检查 `~/.aws/credentials` 文件是否存在
3. 检查文件内容格式是否正确
4. 确认没有多余的空格或换行

### Q3: 提示"The security token included in the request is invalid"？
**答**: 可能原因：
1. Access Key 已被停用
2. Access Key 已被删除
3. 输入的密钥有误（包含多余空格）

解决方案：在 IAM 控制台检查密钥状态，必要时重新创建

### Q4: 如何查看我配置了什么？
```bash
# 查看配置概要（不显示完整密钥）
aws configure list

# 输出示例：
#       Name                    Value             Type    Location
#       ----                    -----             ----    --------
#    profile                <not set>             None    None
# access_key     ****************MPLE shared-credentials-file    
# secret_key     ****************MPLE shared-credentials-file    
#     region                us-east-1      config-file    ~/.aws/config
```

---

## ✅ 配置成功后的下一步

配置成功后，返回部署流程：

```bash
cd /Users/dengdan/Desktop/thankly/backend
./pre-deploy-check.sh && ./deploy.sh
```

---

**最后更新**: 2026-01-27  
**适用版本**: AWS CLI v2.x
