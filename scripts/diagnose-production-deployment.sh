#!/bin/bash
# 🔍 生产环境部署诊断脚本
# 作者: CTO专家组
# 用途: 快速诊断为什么生产环境没有使用最新代码

set -e

echo "🔍 开始诊断生产环境部署状态..."
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
EXPECTED_TAG="backend-v1.4.0"
EXPECTED_COMMIT="48827b3"
LAMBDA_FUNCTION="gratitude-diary-api"
AWS_REGION="us-east-1"

# 1. 检查远程tag是否存在
echo "📌 检查1: 验证远程tag是否存在"
echo "----------------------------------------"
REMOTE_TAG=$(git ls-remote --tags origin | grep "$EXPECTED_TAG" || echo "")
if [ -z "$REMOTE_TAG" ]; then
    echo -e "${RED}❌ 失败: tag $EXPECTED_TAG 不存在于远程仓库${NC}"
    echo "   原因: 未执行 git push --tags"
    echo "   解决: git push --tags"
    TAG_EXISTS=false
else
    echo -e "${GREEN}✅ 成功: tag $EXPECTED_TAG 存在于远程${NC}"
    echo "   $REMOTE_TAG"
    TAG_EXISTS=true
fi
echo ""

# 2. 检查本地未提交的改动
echo "📌 检查2: 验证本地工作区状态"
echo "----------------------------------------"
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  警告: 发现 $UNCOMMITTED 个未提交的改动${NC}"
    git status --short
    echo "   注意: 未提交的改动不会被部署"
    echo "   解决: 如需部署，请先提交并创建新tag"
else
    echo -e "${GREEN}✅ 成功: 工作区干净，无未提交改动${NC}"
fi
echo ""

# 3. 检查GitHub Secrets（需要手动验证）
echo "📌 检查3: GitHub Secrets验证（需要手动操作）"
echo "----------------------------------------"
echo "   请在浏览器中打开:"
echo "   https://github.com/deng-diana/thankly/settings/secrets/actions"
echo ""
echo "   需要确认以下Secrets存在:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - AWS_ACCOUNT_ID"
echo ""
read -p "   按Enter继续，或Ctrl+C退出..."
echo ""

# 4. 检查GitHub Actions运行状态（需要手动验证）
echo "📌 检查4: GitHub Actions部署状态（需要手动操作）"
echo "----------------------------------------"
echo "   请在浏览器中打开:"
echo "   https://github.com/deng-diana/thankly/actions/workflows/deploy-backend.yml"
echo ""
echo "   需要确认:"
echo "   1. 是否有 $EXPECTED_TAG 触发的workflow运行?"
echo "   2. 运行状态是 Success 还是 Failed?"
echo "   3. 如果 Failed，在哪一步失败?"
echo ""
read -p "   GitHub Actions状态 (success/failed/none): " ACTIONS_STATUS
echo ""

if [ "$ACTIONS_STATUS" == "success" ]; then
    echo -e "${GREEN}✅ GitHub Actions运行成功${NC}"
elif [ "$ACTIONS_STATUS" == "failed" ]; then
    echo -e "${RED}❌ GitHub Actions运行失败${NC}"
    echo "   需要查看日志定位失败原因"
elif [ "$ACTIONS_STATUS" == "none" ]; then
    echo -e "${RED}❌ 未找到相关workflow运行${NC}"
    echo "   可能原因: tag未推送，或workflow配置错误"
else
    echo -e "${YELLOW}⚠️  未知状态${NC}"
fi
echo ""

# 5. 检查AWS CLI配置
echo "📌 检查5: 验证AWS CLI配置"
echo "----------------------------------------"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ 失败: AWS CLI未安装${NC}"
    echo "   安装: brew install awscli"
    AWS_CLI_OK=false
else
    echo -e "${GREEN}✅ AWS CLI已安装${NC}"
    AWS_CLI_OK=true
    
    # 测试AWS凭证
    echo "   测试AWS凭证..."
    if aws sts get-caller-identity &> /dev/null; then
        echo -e "${GREEN}✅ AWS凭证有效${NC}"
        aws sts get-caller-identity | grep -E "Account|Arn"
        AWS_CREDS_OK=true
    else
        echo -e "${RED}❌ AWS凭证无效或未配置${NC}"
        echo "   配置: aws configure"
        AWS_CREDS_OK=false
    fi
fi
echo ""

# 6. 检查Lambda函数状态
if [ "$AWS_CLI_OK" == true ] && [ "$AWS_CREDS_OK" == true ]; then
    echo "📌 检查6: 验证Lambda函数状态"
    echo "----------------------------------------"
    
    echo "   获取Lambda函数信息..."
    LAMBDA_INFO=$(aws lambda get-function \
        --function-name "$LAMBDA_FUNCTION" \
        --region "$AWS_REGION" 2>&1 || echo "ERROR")
    
    if [[ "$LAMBDA_INFO" == *"ERROR"* ]] || [[ "$LAMBDA_INFO" == *"ResourceNotFoundException"* ]]; then
        echo -e "${RED}❌ 失败: 无法获取Lambda函数信息${NC}"
        echo "   可能原因: 函数不存在，或无权限访问"
    else
        echo -e "${GREEN}✅ 成功: 获取到Lambda函数信息${NC}"
        
        # 提取镜像URI和最后更新时间
        IMAGE_URI=$(echo "$LAMBDA_INFO" | grep -o '"ImageUri": "[^"]*"' | cut -d'"' -f4)
        LAST_MODIFIED=$(echo "$LAMBDA_INFO" | grep -o '"LastModified": "[^"]*"' | cut -d'"' -f4)
        
        echo ""
        echo "   镜像URI: $IMAGE_URI"
        echo "   最后更新时间: $LAST_MODIFIED"
        echo ""
        
        # 检查更新时间
        EXPECTED_DATE="2026-01-27"
        if [[ "$LAST_MODIFIED" == *"$EXPECTED_DATE"* ]] || [[ "$LAST_MODIFIED" > "$EXPECTED_DATE"* ]]; then
            echo -e "${GREEN}✅ Lambda镜像更新时间符合预期 (>= $EXPECTED_DATE)${NC}"
        else
            echo -e "${RED}❌ Lambda镜像更新时间过旧 (< $EXPECTED_DATE)${NC}"
            echo "   这说明最新代码未部署到生产环境"
        fi
    fi
    echo ""
    
    # 7. 检查CloudWatch日志
    echo "📌 检查7: 查看CloudWatch最新日志"
    echo "----------------------------------------"
    echo "   获取最新日志流..."
    
    LOG_GROUP="/aws/lambda/$LAMBDA_FUNCTION"
    LATEST_STREAM=$(aws logs describe-log-streams \
        --log-group-name "$LOG_GROUP" \
        --order-by LastEventTime \
        --descending \
        --max-items 1 \
        --region "$AWS_REGION" 2>&1 | grep -o '"logStreamName": "[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -z "$LATEST_STREAM" ]; then
        echo -e "${YELLOW}⚠️  警告: 无法获取日志流${NC}"
        echo "   可能原因: Lambda最近未被调用"
    else
        echo "   最新日志流: $LATEST_STREAM"
        echo ""
        echo "   最近10条日志:"
        aws logs get-log-events \
            --log-group-name "$LOG_GROUP" \
            --log-stream-name "$LATEST_STREAM" \
            --limit 10 \
            --region "$AWS_REGION" \
            --output text \
            --query 'events[*].[message]' 2>&1 | tail -10 || echo "   无法获取日志"
        
        echo ""
        echo "   🔍 关键检查: 查找新版本特征日志"
        HAS_NEW_LOGS=$(aws logs get-log-events \
            --log-group-name "$LOG_GROUP" \
            --log-stream-name "$LATEST_STREAM" \
            --limit 100 \
            --region "$AWS_REGION" \
            --output text 2>&1 | grep -c "⏱️ Whisper 转录完成，耗时" || echo "0")
        
        if [ "$HAS_NEW_LOGS" -gt 0 ]; then
            echo -e "${GREEN}✅ 发现新版本特征日志 (带计时)${NC}"
            echo "   这说明 backend-v1.4.0 已部署"
        else
            echo -e "${RED}❌ 未发现新版本特征日志${NC}"
            echo "   这说明仍在运行旧版本代码"
        fi
    fi
    echo ""
else
    echo "📌 检查6-7: 跳过（AWS CLI不可用）"
    echo "----------------------------------------"
    echo ""
fi

# 8. 生成诊断报告
echo "=========================================="
echo "📊 诊断报告汇总"
echo "=========================================="
echo ""

ISSUES=0

echo "1. 远程tag状态:"
if [ "$TAG_EXISTS" == true ]; then
    echo -e "   ${GREEN}✅ 正常${NC}"
else
    echo -e "   ${RED}❌ 异常: tag未推送${NC}"
    ISSUES=$((ISSUES + 1))
fi

echo ""
echo "2. 本地工作区:"
if [ "$UNCOMMITTED" -eq 0 ]; then
    echo -e "   ${GREEN}✅ 干净${NC}"
else
    echo -e "   ${YELLOW}⚠️  有 $UNCOMMITTED 个未提交改动（不影响已提交代码的部署）${NC}"
fi

echo ""
echo "3. GitHub Actions:"
if [ "$ACTIONS_STATUS" == "success" ]; then
    echo -e "   ${GREEN}✅ 运行成功${NC}"
elif [ "$ACTIONS_STATUS" == "failed" ]; then
    echo -e "   ${RED}❌ 运行失败${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "   ${YELLOW}⚠️  状态未知，需要手动检查${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$AWS_CLI_OK" == true ] && [ "$AWS_CREDS_OK" == true ]; then
    echo ""
    echo "4. AWS Lambda状态:"
    if [[ "$LAST_MODIFIED" == *"$EXPECTED_DATE"* ]] || [[ "$LAST_MODIFIED" > "$EXPECTED_DATE"* ]]; then
        echo -e "   ${GREEN}✅ 镜像已更新${NC}"
    else
        echo -e "   ${RED}❌ 镜像未更新${NC}"
        ISSUES=$((ISSUES + 1))
    fi
    
    echo ""
    echo "5. CloudWatch日志:"
    if [ "$HAS_NEW_LOGS" -gt 0 ]; then
        echo -e "   ${GREEN}✅ 发现新版本日志${NC}"
    else
        echo -e "   ${RED}❌ 未发现新版本日志${NC}"
        ISSUES=$((ISSUES + 1))
    fi
fi

echo ""
echo "=========================================="
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 诊断完成: 未发现明显问题${NC}"
    echo "   如果仍然缓慢，可能是性能问题（非部署问题）"
else
    echo -e "${RED}⚠️  诊断完成: 发现 $ISSUES 个问题${NC}"
    echo "   建议查看详细报告: .agent/PRODUCTION_SLOWNESS_ROOT_CAUSE_ANALYSIS.md"
fi
echo "=========================================="
echo ""

# 9. 提供快速修复建议
echo "🛠️  快速修复建议:"
echo "----------------------------------------"

if [ "$TAG_EXISTS" == false ]; then
    echo "1. 推送tag到远程:"
    echo "   git push --tags"
    echo ""
fi

if [ "$ACTIONS_STATUS" == "failed" ] || [ "$ACTIONS_STATUS" == "none" ]; then
    echo "2. 手动触发部署:"
    echo "   访问: https://github.com/deng-diana/thankly/actions/workflows/deploy-backend.yml"
    echo "   点击 'Run workflow' 按钮"
    echo ""
fi

if [ "$AWS_CLI_OK" == true ] && [ "$AWS_CREDS_OK" == true ]; then
    if [[ ! "$LAST_MODIFIED" == *"$EXPECTED_DATE"* ]] && [[ ! "$LAST_MODIFIED" > "$EXPECTED_DATE"* ]]; then
        echo "3. 强制更新Lambda:"
        echo "   aws lambda update-function-code \\"
        echo "     --function-name $LAMBDA_FUNCTION \\"
        echo "     --image-uri \$(aws lambda get-function --function-name $LAMBDA_FUNCTION --region $AWS_REGION --query 'Code.ImageUri' --output text) \\"
        echo "     --region $AWS_REGION"
        echo ""
    fi
fi

echo "详细操作指南请查看:"
echo "  .agent/PRODUCTION_SLOWNESS_ROOT_CAUSE_ANALYSIS.md"
echo ""
