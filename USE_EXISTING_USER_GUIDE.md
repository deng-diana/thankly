# 🔑 使用现有 IAM 用户创建访问密钥

## 你当前的情况

你已经有现成的 IAM 用户：**`gratitude-journal-backend`**

这个用户专门为 Thankly 后端创建，可以直接使用！

---

## 📋 操作步骤（超简单）

### 步骤 1: 点击用户名

在 IAM 用户列表页面，点击蓝色的用户名：
```
gratitude-journal-backend
```

### 步骤 2: 进入"安全凭证"标签

点击用户详情页面顶部的 **"Security credentials"**（安全凭证）标签

### 步骤 3: 找到"Access keys"部分

往下滚动页面，找到 **"Access keys"**（访问密钥）这一栏

你可能会看到：
- **情况 A**: 已经有 1-2 个访问密钥（显示为 Active 或 Inactive）
- **情况 B**: 没有访问密钥（空的）

---

## 🔍 根据你的情况选择：

### 情况 A: 已经有密钥了

如果你看到已经有访问密钥，有两个选项：

#### 选项 1: 使用现有密钥（如果你还记得）

如果你之前保存过这个密钥，可以直接使用：
- 找到你之前保存的 Access Key ID 和 Secret Access Key
- 跳到下面的"配置到本地电脑"部分

#### 选项 2: 创建新密钥（推荐）

如果你忘记了或没保存过 Secret Access Key：

1. **（可选）删除旧密钥**：
   - 如果已经有 2 个密钥（达到上限），需要先删除一个
   - 选择一个旧的密钥，点击 **"Delete"**
   - 确认删除

2. **创建新密钥**：
   - 点击橙色的 **"Create access key"** 按钮
   - 继续下面的步骤

---

### 情况 B: 没有密钥（或已删除旧密钥）

点击橙色的 **"Create access key"** 按钮

---

## 🔧 创建新访问密钥

### 步骤 1: 选择使用场景

在弹出的窗口中：
1. 选择：**"Command Line Interface (CLI)"**
2. ✅ 勾选下方的确认框（我了解上述建议...）
3. 点击 **"Next"**（下一步）

### 步骤 2: 添加描述（可选）

- 描述标签（可选）：`Local deployment - 2026-01`
- 点击 **"Create access key"**（创建访问密钥）

### 步骤 3: 🚨 立即保存密钥！

现在你会看到两个重要信息：

```
Access key ID（访问密钥 ID）
例如：AKIAIOSFODNN7EXAMPLE

Secret access key（私有访问密钥）
例如：wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**⚠️ 超级重要**：
- 点击 **"Download .csv file"** 下载到电脑
- 或者用记事本分别复制这两个密钥
- **Secret access key 只显示这一次！关闭后就看不到了！**

保存好后，点击 **"Done"**

---

## 💻 配置到本地电脑

### 方法：使用 aws configure 命令

1. **打开终端**（Terminal）

2. **运行配置命令**：
   ```bash
   aws configure
   ```

3. **输入信息**：
   ```bash
   AWS Access Key ID [None]: 
   👉 粘贴你刚才保存的 Access Key ID
   
   AWS Secret Access Key [None]: 
   👉 粘贴你刚才保存的 Secret Access Key
   
   Default region name [None]: 
   👉 输入：us-east-1
   
   Default output format [None]: 
   👉 直接按回车
   ```

---

## ✅ 验证配置

在终端运行：
```bash
aws sts get-caller-identity
```

**成功示例**：
```json
{
    "UserId": "AIDAI...",
    "Account": "633404778395",
    "Arn": "arn:aws:iam::633404778395:user/gratitude-journal-backend"
}
```

看到 `gratitude-journal-backend` 说明配置成功！✅

---

## 🚀 继续部署

配置成功后，回到部署流程：

```bash
cd /Users/dengdan/Desktop/thankly/backend
./pre-deploy-check.sh
```

应该会显示：
```
✅ AWS CLI 已配置
✅ AWS 凭证有效 (Account: 633404778395)
```

然后运行部署：
```bash
./deploy.sh
```

---

## 📝 快速总结

1. ✅ 使用现有用户：`gratitude-journal-backend`
2. ✅ 创建新的 Access Key（如果需要）
3. ✅ 下载并保存密钥（CSV 文件）
4. ✅ 运行 `aws configure` 配置到本地
5. ✅ 验证：`aws sts get-caller-identity`
6. ✅ 继续部署：`./deploy.sh`

---

**最后更新**: 2026-01-27  
**用户**: gratitude-journal-backend
