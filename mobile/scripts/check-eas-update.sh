#!/bin/bash

echo "🔍 检查 EAS Update 状态..."
echo ""

# 检查当前分支
echo "📍 当前分支:"
git branch --show-current
echo ""

# 检查最近的 commits
echo "📝 最近的提交:"
git log --oneline -3
echo ""

# 检查 app.json 中的版本和 runtime version
echo "📱 App 配置:"
cat app.json | grep -A 2 '"version"'
cat app.json | grep -A 2 '"runtimeVersion"'
echo ""

# 列出最近的 updates（需要在 mobile 目录下有 node_modules）
echo "🚀 最近的 EAS Updates:"
if command -v npx &> /dev/null; then
    npx eas-cli update:list --branch master --limit 3 2>/dev/null || echo "❌ 无法获取 update 列表，请确保已登录 EAS"
else
    echo "❌ npx 命令不可用"
fi
echo ""

# 列出 channels
echo "📡 EAS Channels:"
if command -v npx &> /dev/null; then
    npx eas-cli channel:list 2>/dev/null || echo "❌ 无法获取 channel 列表"
else
    echo "❌ npx 命令不可用"
fi
