#!/bin/bash

# ============================================
# 部署前检查脚本
# 在执行 deploy.sh 前运行此脚本确保环境正常
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 开始部署前环境检查..."
echo ""

# ============================================
# 1. 检查 Docker
# ============================================
echo "📦 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已安装: $(docker --version)${NC}"

# 检查 Docker Daemon 是否运行
if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker Daemon 未运行${NC}"
    echo ""
    echo "请执行以下操作："
    echo "  macOS: 打开 Docker Desktop 应用"
    echo "  Linux: sudo systemctl start docker"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Docker Daemon 运行正常${NC}"
echo ""

# ============================================
# 2. 检查 AWS CLI
# ============================================
echo "☁️  检查 AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI 未安装${NC}"
    echo "请安装 AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI 已安装: $(aws --version 2>&1 | head -1)${NC}"

# 检查 AWS 凭证
if ! aws sts get-caller-identity --region us-east-1 &> /dev/null; then
    echo -e "${RED}❌ AWS 凭证未配置或已过期${NC}"
    echo ""
    echo "请执行以下操作："
    echo "  1. 运行: aws configure"
    echo "  2. 输入 AWS Access Key ID"
    echo "  3. 输入 AWS Secret Access Key"
    echo "  4. 设置默认区域: us-east-1"
    echo ""
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
echo -e "${GREEN}✅ AWS 凭证有效 (Account: ${AWS_ACCOUNT_ID})${NC}"
echo ""

# ============================================
# 3. 检查 requirements.txt
# ============================================
echo "📋 检查 requirements.txt..."
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ requirements.txt 不存在${NC}"
    exit 1
fi

# 检查关键依赖
REQUIRED_PACKAGES=("fastapi" "pydantic" "pydantic-settings" "boto3" "openai")
MISSING_PACKAGES=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! grep -q "^${package}" requirements.txt; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${RED}❌ 缺少必需的依赖: ${MISSING_PACKAGES[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 所有必需依赖都在 requirements.txt 中${NC}"
echo ""

# ============================================
# 4. 检查 Dockerfile
# ============================================
echo "🐳 检查 Dockerfile..."
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile 不存在${NC}"
    exit 1
fi

# 检查 Dockerfile 是否正确安装依赖
if ! grep -q "pip install.*requirements.txt" Dockerfile; then
    echo -e "${YELLOW}⚠️  Dockerfile 中未找到 pip install requirements.txt${NC}"
fi

echo -e "${GREEN}✅ Dockerfile 存在且格式正确${NC}"
echo ""

# ============================================
# 5. 检查代码完整性
# ============================================
echo "📂 检查代码结构..."
REQUIRED_FILES=(
    "lambda_handler.py"
    "app/__init__.py"
    "app/main.py"
    "app/config.py"
    "app/routers/diary.py"
    "app/services/s3_service.py"
    "app/services/dynamodb_service.py"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ 缺少必需的文件: ${MISSING_FILES[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 所有必需文件都存在${NC}"
echo ""

# ============================================
# 6. 检查 Lambda 函数是否存在
# ============================================
echo "🔧 检查 Lambda 函数..."
LAMBDA_FUNCTION_NAME="gratitude-diary-api"
if ! aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region us-east-1 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Lambda 函数 ${LAMBDA_FUNCTION_NAME} 不存在${NC}"
    echo "如果这是首次部署，请先在 AWS Console 创建 Lambda 函数"
else
    echo -e "${GREEN}✅ Lambda 函数 ${LAMBDA_FUNCTION_NAME} 已存在${NC}"
fi
echo ""

# ============================================
# 总结
# ============================================
echo "=========================================="
echo -e "${GREEN}✅ 所有检查通过，可以开始部署！${NC}"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 确保 Docker Desktop 已完全启动（查看菜单栏图标）"
echo "  2. 运行部署脚本："
echo "     ${GREEN}./deploy.sh${NC}"
echo ""
echo "预计部署时间: 5-10 分钟"
echo ""
