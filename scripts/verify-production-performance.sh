#!/bin/bash
# 🔍 验证生产环境性能脚本
# 用途: 查找最近的语音处理日志并分析性能

set -e

echo "🔍 正在查找最近的语音上传请求..."
echo "=========================================="

LOG_GROUP="/aws/lambda/gratitude-diary-api"
AWS_REGION="us-east-1"

# 查找最近24小时内的语音处理日志
echo "📊 搜索最近24小时的语音处理记录..."
echo ""

# 方法1: 查找包含"语音识别"的日志
echo "1️⃣ 查找语音识别日志:"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "\"语音识别\" OR \"voice/upload\"" \
  --region "$AWS_REGION" \
  --max-items 5 \
  --output text \
  --query 'events[*].[timestamp,message]' 2>&1 | while read -r line; do
    timestamp=$(echo "$line" | awk '{print $1}')
    if [ ! -z "$timestamp" ] && [ "$timestamp" != "None" ]; then
        # 转换时间戳（毫秒）为可读格式
        date_str=$(date -r $((timestamp / 1000)) "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "")
        echo "[$date_str] $(echo "$line" | cut -f2-)"
    else
        echo "$line"
    fi
done

echo ""
echo "2️⃣ 查找AI处理日志:"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "\"开始AI处理\" OR \"处理完成\"" \
  --region "$AWS_REGION" \
  --max-items 10 \
  --output text \
  --query 'events[*].[timestamp,message]' 2>&1 | tail -20

echo ""
echo "3️⃣ 查找Whisper转录日志:"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "\"正在识别语音\" OR \"Whisper检测\" OR \"识别完成\"" \
  --region "$AWS_REGION" \
  --max-items 10 \
  --output text \
  --query 'events[*].[timestamp,message]' 2>&1 | tail -20

echo ""
echo "4️⃣ 查找并行处理日志（新版本特征）:"
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "\"启动两组并行\" OR \"并行组\" OR \"Agent完成\"" \
  --region "$AWS_REGION" \
  --max-items 10 \
  --output text \
  --query 'events[*].[timestamp,message]' 2>&1 | tail -20

echo ""
echo "=========================================="
echo "📋 分析建议:"
echo "=========================================="
echo ""
echo "如果看到:"
echo "  ✅ '启动两组并行' → 新版本正在运行"
echo "  ✅ '🌍 Whisper检测' → 新版本语言检测功能正常"
echo "  ✅ 'Agent完成' → 并行处理正常工作"
echo ""
echo "如果最近24小时内无日志:"
echo "  ⚠️  说明最近没有用户上传语音"
echo "  ⚠️  需要实际测试一次才能验证性能"
echo ""
echo "下一步操作:"
echo "  1. 在App中录制5秒语音并上传"
echo "  2. 重新运行此脚本查看日志"
echo "  3. 或实时监控: aws logs tail $LOG_GROUP --follow --region $AWS_REGION"
echo ""
