#!/bin/bash

# ============================================
# 部署后验证脚本
# 在 deploy.sh 完成后运行，验证部署是否成功
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

AWS_REGION="us-east-1"
LAMBDA_FUNCTION_NAME="gratitude-diary-api"

echo "🔍 开始验证部署结果..."
echo ""

# ============================================
# 1. 检查 Lambda 函数状态
# ============================================
echo "📦 检查 Lambda 函数状态..."

FUNCTION_STATUS=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Configuration.State' \
    --output text 2>/dev/null)

if [ "$FUNCTION_STATUS" != "Active" ]; then
    echo -e "${YELLOW}⚠️  Lambda 函数状态: ${FUNCTION_STATUS}${NC}"
    echo "函数可能正在更新中，请等待 30 秒..."
    sleep 30
    
    # 重新检查
    FUNCTION_STATUS=$(aws lambda get-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --query 'Configuration.State' \
        --output text 2>/dev/null)
fi

if [ "$FUNCTION_STATUS" = "Active" ]; then
    echo -e "${GREEN}✅ Lambda 函数状态: Active${NC}"
else
    echo -e "${RED}❌ Lambda 函数状态异常: ${FUNCTION_STATUS}${NC}"
    exit 1
fi

# 获取 Function URL
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'FunctionUrl' \
    --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ]; then
    echo -e "${YELLOW}⚠️  未找到 Function URL，请在 AWS Console 中配置${NC}"
else
    echo -e "${GREEN}✅ Function URL: ${FUNCTION_URL}${NC}"
fi
echo ""

# ============================================
# 2. 测试健康检查端点
# ============================================
echo "🏥 测试健康检查端点..."

if [ -n "$FUNCTION_URL" ]; then
    HEALTH_CHECK_URL="${FUNCTION_URL}health"
    echo "  URL: $HEALTH_CHECK_URL"
    
    # 测试健康检查（最多尝试 3 次，因为可能需要冷启动）
    MAX_RETRIES=3
    SUCCESS=false
    
    for i in $(seq 1 $MAX_RETRIES); do
        echo -e "${BLUE}  尝试 $i/$MAX_RETRIES...${NC}"
        
        HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ 健康检查通过 (HTTP $HTTP_CODE)${NC}"
            cat /tmp/health_response.json | python3 -m json.tool 2>/dev/null || cat /tmp/health_response.json
            SUCCESS=true
            break
        else
            echo -e "${YELLOW}⚠️  HTTP 状态码: $HTTP_CODE${NC}"
            if [ $i -lt $MAX_RETRIES ]; then
                echo "  等待 5 秒后重试..."
                sleep 5
            fi
        fi
    done
    
    if [ "$SUCCESS" = false ]; then
        echo -e "${RED}❌ 健康检查失败${NC}"
        echo "响应内容:"
        cat /tmp/health_response.json 2>/dev/null || echo "(无响应)"
        echo ""
        echo "请检查 CloudWatch 日志以获取详细错误信息"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  跳过健康检查（Function URL 未配置）${NC}"
fi
echo ""

# ============================================
# 3. 检查 CloudWatch 日志
# ============================================
echo "📊 检查最近的 CloudWatch 日志..."

LOG_GROUP_NAME="/aws/lambda/${LAMBDA_FUNCTION_NAME}"

# 获取最新的日志流
LATEST_LOG_STREAM=$(aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP_NAME" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --region "$AWS_REGION" \
    --query 'logStreams[0].logStreamName' \
    --output text 2>/dev/null || echo "")

if [ -z "$LATEST_LOG_STREAM" ] || [ "$LATEST_LOG_STREAM" = "None" ]; then
    echo -e "${YELLOW}⚠️  未找到最新日志流（函数可能还未被调用）${NC}"
else
    echo "  最新日志流: $LATEST_LOG_STREAM"
    echo ""
    echo "  最近的日志:"
    echo "  ----------------------------------------"
    
    # 获取最近 20 条日志
    aws logs get-log-events \
        --log-group-name "$LOG_GROUP_NAME" \
        --log-stream-name "$LATEST_LOG_STREAM" \
        --limit 20 \
        --region "$AWS_REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null | tail -20 || echo "  (无法获取日志)"
    
    echo "  ----------------------------------------"
    echo ""
    
    # 检查是否有错误
    ERROR_COUNT=$(aws logs get-log-events \
        --log-group-name "$LOG_GROUP_NAME" \
        --log-stream-name "$LATEST_LOG_STREAM" \
        --limit 50 \
        --region "$AWS_REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null | grep -i "error" | wc -l || echo "0")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  发现 $ERROR_COUNT 条错误日志${NC}"
    else
        echo -e "${GREEN}✅ 未发现明显错误${NC}"
    fi
fi
echo ""

# ============================================
# 4. 检查关键配置
# ============================================
echo "⚙️  检查 Lambda 配置..."

MEMORY_SIZE=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Configuration.MemorySize' \
    --output text 2>/dev/null)

TIMEOUT=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Configuration.Timeout' \
    --output text 2>/dev/null)

ARCHITECTURE=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Configuration.Architectures[0]' \
    --output text 2>/dev/null)

echo "  内存: ${MEMORY_SIZE} MB"
echo "  超时: ${TIMEOUT} 秒"
echo "  架构: ${ARCHITECTURE}"

# 建议检查
if [ "$MEMORY_SIZE" -lt 512 ]; then
    echo -e "${YELLOW}  ⚠️  建议增加内存至 512MB 以上以提升性能${NC}"
fi

if [ "$TIMEOUT" -lt 60 ]; then
    echo -e "${YELLOW}  ⚠️  建议增加超时时间至 60 秒以上（AI 处理需要时间）${NC}"
fi
echo ""

# ============================================
# 总结
# ============================================
echo "=========================================="
echo -e "${GREEN}✅ 部署验证完成！${NC}"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 在移动端测试创建图片日记"
echo "  2. 检查日记列表是否正常显示"
echo "  3. 监控 CloudWatch 日志确保无错误"
echo ""
echo "CloudWatch 日志 URL:"
echo "  https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F${LAMBDA_FUNCTION_NAME}"
echo ""

if [ -n "$FUNCTION_URL" ]; then
    echo "API 端点:"
    echo "  ${FUNCTION_URL}"
    echo ""
fi
