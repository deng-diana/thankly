/**
 * apiService测试
 * 
 * 这个文件用于测试apiService是否正常工作
 * 在实际项目中很重要！
 */

import apiService from '../apiService';

// 模拟测试
export async function testApiService() {
  try {
    console.log('🧪 开始测试apiService...');
    
    // 测试1：GET请求
    console.log('\n测试1: GET /health');
    const health = await apiService.get('/health', { requireAuth: false });
    console.log('✅ Health check通过:', health);
    
    // 测试2：带认证的GET请求
    console.log('\n测试2: GET /diaries (需要认证)');
    const diaries = await apiService.get('/diaries');
    console.log('✅ 获取日记成功:', diaries);
    
    console.log('\n🎉 所有测试通过！');
    
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
  }
}