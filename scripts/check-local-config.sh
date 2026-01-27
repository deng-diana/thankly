#!/bin/bash

# 🔍 本地开发环境配置检查脚本
# 用途：检查 IS_LOCAL_DEV 和 IP 地址配置是否正确

set -e

echo "🔍 本地开发环境配置检查"
echo ""

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/mobile/src/config/aws-config.ts"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ 配置文件不存在: $CONFIG_FILE"
  exit 1
fi

# 1. 检查 IS_LOCAL_DEV
echo "📋 检查 IS_LOCAL_DEV 配置..."
IS_LOCAL_DEV=$(grep -E "const IS_LOCAL_DEV" "$CONFIG_FILE" | grep -oE "(true|false)" | head -1)

if [ "$IS_LOCAL_DEV" = "true" ]; then
  echo "   ✅ IS_LOCAL_DEV: true (本地开发模式)"
else
  echo "   ⚠️  IS_LOCAL_DEV: $IS_LOCAL_DEV (不是本地开发模式)"
  echo "   💡 建议: 如果要在本地开发，请设置为 true"
fi
echo ""

# 2. 提取配置的 IP 地址
echo "📋 检查 IP 地址配置..."
CONFIGURED_IP=$(grep -E "API_BASE_URL.*192\.168\." "$CONFIG_FILE" | grep -oE "192\.168\.[0-9]+\.[0-9]+" | head -1)

if [ -z "$CONFIGURED_IP" ]; then
  echo "   ⚠️  未找到配置的 IP 地址（可能使用生产环境）"
  CONFIGURED_IP="未配置"
else
  echo "   📝 配置文件中的 IP: $CONFIGURED_IP"
fi
echo ""

# 3. 检测当前机器的实际 IP 地址
echo "📋 检测当前机器 IP 地址..."

# macOS 方法
if [[ "$OSTYPE" == "darwin"* ]]; then
  # 优先尝试 Wi-Fi (en0)
  CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
  
  # 如果 Wi-Fi 没有，尝试其他接口
  if [ -z "$CURRENT_IP" ]; then
    CURRENT_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
  fi
else
  # Linux 方法
  CURRENT_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}')
fi

if [ -z "$CURRENT_IP" ]; then
  echo "   ❌ 无法检测到当前 IP 地址"
  CURRENT_IP="未知"
else
  echo "   📱 当前机器 IP: $CURRENT_IP"
fi
echo ""

# 4. 对比 IP 地址
echo "📊 IP 地址对比:"
if [ "$CONFIGURED_IP" != "未配置" ] && [ "$CURRENT_IP" != "未知" ]; then
  if [ "$CONFIGURED_IP" = "$CURRENT_IP" ]; then
    echo "   ✅ IP 地址匹配！"
  else
    echo "   ⚠️  IP 地址不匹配！"
    echo "      - 配置文件: $CONFIGURED_IP"
    echo "      - 当前机器: $CURRENT_IP"
    echo ""
    echo "   💡 建议更新配置:"
    echo "      将 aws-config.ts 中的 IP 更新为: $CURRENT_IP"
    echo "      即: export const API_BASE_URL = IS_LOCAL_DEV ? \"http://$CURRENT_IP:8000\" : PRODUCTION_URL;"
  fi
else
  echo "   ⚠️  无法完成对比（配置或检测失败）"
fi
echo ""

# 5. 检查后端服务（仅在本地开发模式）
if [ "$IS_LOCAL_DEV" = "true" ] && [ "$CURRENT_IP" != "未知" ]; then
  echo "📡 检查后端服务可达性..."
  BACKEND_URL="http://$CURRENT_IP:8000"
  
  # 尝试连接（3秒超时）
  # 先尝试根路径，如果没有则尝试 /health
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$BACKEND_URL/" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "000" ]; then
    # 如果根路径失败，尝试 /health
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$BACKEND_URL/health" 2>/dev/null || echo "000")
  fi
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "405" ]; then
    echo "   ✅ 后端服务可达 (HTTP $HTTP_CODE)"
  elif [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ 后端服务不可达（连接超时或拒绝连接）"
    echo "   💡 建议: 启动后端服务"
    echo "      cd backend"
    echo "      python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
  else
    echo "   ⚠️  后端服务响应异常 (HTTP $HTTP_CODE)"
    echo "   💡 建议: 检查后端服务状态"
  fi
  echo ""
fi

# 6. 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 检查总结:"

ISSUES=0

if [ "$IS_LOCAL_DEV" != "true" ]; then
  echo "   ⚠️  IS_LOCAL_DEV 不是 true"
  ISSUES=$((ISSUES + 1))
fi

if [ "$CONFIGURED_IP" != "未配置" ] && [ "$CURRENT_IP" != "未知" ] && [ "$CONFIGURED_IP" != "$CURRENT_IP" ]; then
  echo "   ⚠️  IP 地址不匹配"
  ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
  echo "   ✅ 所有检查通过！"
  exit 0
else
  echo "   ❌ 发现 $ISSUES 个问题，请修复后重试"
  exit 1
fi
