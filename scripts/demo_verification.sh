#!/bin/bash

# Demo前快速验证脚本
# 用途: 验证语音处理优化是否正常工作

echo "🚀 Demo前快速验证开始..."
echo ""

# 1. 检查Python语法
echo "1️⃣ 检查Python语法..."
cd /Users/dengdan/Desktop/thankly/backend
python -m py_compile app/routers/diary.py
if [ $? -eq 0 ]; then
    echo "   ✅ 语法检查通过"
else
    echo "   ❌ 语法检查失败"
    exit 1
fi
echo ""

# 2. 检查关键改动
echo "2️⃣ 检查关键优化点..."

# 检查虚拟进度更新频率
if grep -q "await asyncio.sleep(0.6)" app/routers/diary.py && \
   grep -q "await asyncio.sleep(0.5)" app/routers/diary.py; then
    echo "   ✅ 虚拟进度更新频率已优化 (0.5-0.6秒)"
else
    echo "   ⚠️ 虚拟进度更新频率未找到"
fi

# 检查进度区间
if grep -q "15% → 60%" app/routers/diary.py; then
    echo "   ✅ 进度区间已优化 (转录15%→60%)"
else
    echo "   ⚠️ 进度区间未找到"
fi

# 检查AI虚拟进度移除
if ! grep -q "ai_smooth_progress" app/routers/diary.py; then
    echo "   ✅ AI虚拟进度已移除（纯语音日记）"
else
    echo "   ℹ️ AI虚拟进度仍存在（可能在混合媒体中）"
fi

echo ""

# 3. 统计改动
echo "3️⃣ 统计改动..."
DEMO_OPTIMIZATIONS=$(grep -c "Demo优化" app/routers/diary.py)
echo "   📊 发现 $DEMO_OPTIMIZATIONS 处 'Demo优化' 标记"
echo ""

# 4. 建议
echo "4️⃣ Demo前建议..."
echo "   ✅ 重启后端服务"
echo "   ✅ 测试一次完整的语音输入"
echo "   ✅ 观察进度条是否流畅"
echo "   ✅ 确认结果正确保存"
echo ""

echo "🎉 验证完成！准备好Demo了！"
