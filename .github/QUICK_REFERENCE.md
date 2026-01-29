# 🚀 亲密圈开发 - 快速参考卡片

## 📌 基本信息

| 项目 | 内容 |
|------|------|
| **功能分支** | `feature/intimate-circle` |
| **主分支** | `master` |
| **开发周期** | 4 周（2026-01-29 至 2026-02-26）|
| **文档位置** | `亲密圈.md`（本地不提交）|

---

## 🔄 每天工作流程

### 早上开始工作
```bash
cd /Users/dengdan/Desktop/thankly
git checkout feature/intimate-circle
git pull origin feature/intimate-circle

# 开始开发...
```

### 晚上结束工作
```bash
git add .
git commit -m "feat: 今天完成的功能描述"
git push origin feature/intimate-circle
```

---

## 🆘 常用场景

### 场景1：查看当前分支
```bash
git branch
# 带 * 的就是当前分支
```

### 场景2：修复线上紧急bug（在 master 分支）
```bash
# 1. 保存当前工作
git stash

# 2. 切换到主分支
git checkout master
git pull origin master

# 3. 修复bug
# ... 改代码 ...

# 4. 提交并推送
git add .
git commit -m "fix: 修复xxx问题"
git push origin master

# 5. 回到功能分支
git checkout feature/intimate-circle
git stash pop
```

### 场景3：误在错误分支改了代码
```bash
# 如果还没提交
git stash                           # 暂存改动
git checkout feature/intimate-circle # 切换到正确分支
git stash pop                       # 恢复改动

# 如果已经提交
git log                             # 找到提交的 hash
git checkout feature/intimate-circle
git cherry-pick <commit-hash>       # 应用到正确分支
```

### 场景4：每周同步 master（重要！）
```bash
git checkout feature/intimate-circle
git pull origin master
# 如果有冲突，手动解决后：
git add .
git commit -m "chore: 同步 master 最新代码"
git push origin feature/intimate-circle
```

---

## ⚠️ 安全检查

### 提交前检查
```bash
git status                    # 确认在正确分支
git diff                      # 查看改动内容
git branch                    # 再次确认分支
```

### 推送前检查
```bash
git log -3                    # 查看最近3次提交
# 确认没有敏感信息（密钥、token等）
```

---

## 🎯 Commit Message 规范

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 实现圈子创建功能` |
| `fix` | 修复bug | `fix: 修复邀请码验证问题` |
| `chore` | 杂项（同步代码等） | `chore: 同步 master 最新代码` |
| `docs` | 文档更新 | `docs: 更新亲密圈API文档` |
| `style` | 样式调整 | `style: 优化圈子列表卡片间距` |
| `test` | 测试相关 | `test: 添加圈子创建测试` |

---

## 📁 文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| **开发计划** | `亲密圈.md` | 功能设计文档（不提交） |
| **同步检查** | `.github/BRANCH_SYNC_CHECKLIST.md` | 每周同步记录 |
| **此文件** | `.github/QUICK_REFERENCE.md` | 快速参考 |

---

## 🔍 检查是否在正确分支

### 方法1：命令行
```bash
git branch
# * feature/intimate-circle  ✅ 正确
# * master                   ❌ 错误，需要切换
```

### 方法2：Git 状态
```bash
git status
# On branch feature/intimate-circle  ✅
```

### 方法3：VS Code 左下角
看编辑器左下角的分支图标，确认显示 `feature/intimate-circle`

---

## 📞 遇到问题？

### 常见错误1：冲突无法解决
**解决方案**：
```bash
git merge --abort  # 撤销合并
# 然后向 Claude 寻求帮助
```

### 常见错误2：推送失败
**解决方案**：
```bash
git pull origin feature/intimate-circle  # 先拉取
git push origin feature/intimate-circle  # 再推送
```

### 常见错误3：忘记在哪个分支
**解决方案**：
```bash
git status              # 查看状态
git log --oneline -5    # 查看最近5次提交
```

---

## ✅ 开发完成后（Week 4 结束）

### 最终合并步骤
```bash
# 1. 最后一次同步
git checkout feature/intimate-circle
git pull origin master

# 2. 解决所有冲突
git add .
git commit -m "chore: 最终同步 master"

# 3. 切换到主分支
git checkout master
git pull origin master

# 4. 合并功能分支
git merge feature/intimate-circle

# 5. 推送到远程
git push origin master

# 6. 删除功能分支（可选）
git branch -d feature/intimate-circle
git push origin --delete feature/intimate-circle
```

---

**创建日期**: 2026-01-29  
**最后更新**: 2026-01-29  
**维护者**: @dengdan

💡 **提示**：把这个文件加入书签，随时查看！
