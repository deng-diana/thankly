/**
 * ✅ Phase 2: 分块并行上传服务
 * 
 * Google Best Practice: 将大文件分成多个小块并行上传
 * 
 * 优势:
 * - 并行上传多个 chunks，充分利用带宽
 * - 单个 chunk 失败可以单独重试
 * - 更精确的进度显示
 * - 大幅减少总上传时间
 * 
 * 工作流程:
 * 1. 录音完成后，生成 session_id
 * 2. 将音频文件分成多个 chunks
 * 3. 为每个 chunk 获取预签名 URL
 * 4. 并行上传所有 chunks
 * 5. 调用后端合并并开始处理
 */

import { API_BASE_URL } from "../config/aws-config";
import { getAccessToken } from "./authService";
import apiService from "./apiService";

// 配置常量
const CHUNK_SIZE = 512 * 1024; // 512KB per chunk
const MAX_PARALLEL_UPLOADS = 3; // 最多同时上传 3 个 chunks
const CHUNK_UPLOAD_TIMEOUT = 30000; // 30 秒超时
const MAX_RETRIES = 2; // 每个 chunk 最多重试 2 次

// 类型定义
interface ChunkInfo {
  index: number;
  data: Blob;
  presignedUrl?: string;
  s3Key?: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
}

interface ChunkUploadProgress {
  totalChunks: number;
  completedChunks: number;
  percentage: number;
  currentSpeed?: number; // KB/s
}

interface ChunkUploadResult {
  taskId: string;
  audioUrl: string;
  totalChunks: number;
  uploadTimeMs: number;
}

/**
 * 生成唯一的 session ID
 */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 将音频文件分割成多个 chunks
 */
async function splitAudioIntoChunks(audioUri: string): Promise<Blob[]> {
  console.log("📦 开始分割音频文件...");
  
  // 读取音频文件
  const response = await fetch(audioUri);
  if (!response.ok) {
    throw new Error("无法读取音频文件");
  }
  
  const blob = await response.blob();
  const totalSize = blob.size;
  const chunks: Blob[] = [];
  
  console.log(`  - 文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  // 如果文件小于 CHUNK_SIZE，不需要分割
  if (totalSize <= CHUNK_SIZE) {
    console.log("  - 文件较小，无需分割");
    chunks.push(blob);
    return chunks;
  }
  
  // 分割成多个 chunks
  let offset = 0;
  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunk = blob.slice(offset, end);
    chunks.push(chunk);
    offset = end;
  }
  
  console.log(`  - 分割成 ${chunks.length} 个 chunks`);
  return chunks;
}

/**
 * 创建分块上传会话
 */
async function createChunkSession(sessionId: string): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("未登录");
  }
  
  const formData = new FormData();
  formData.append("session_id", sessionId);
  
  const response = await fetch(`${API_BASE_URL}/diary/audio/chunk-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "未知错误");
    throw new Error(`创建会话失败: ${response.status} - ${errorText}`);
  }
  
  console.log("✅ 分块上传会话创建成功");
}

/**
 * 获取单个 chunk 的预签名 URL
 */
async function getChunkPresignedUrl(
  sessionId: string,
  chunkIndex: number
): Promise<{ presignedUrl: string; s3Key: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("未登录");
  }
  
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("chunk_index", chunkIndex.toString());
  formData.append("content_type", "audio/m4a");
  
  const response = await fetch(`${API_BASE_URL}/diary/audio/chunk-presigned-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`获取预签名URL失败: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    presignedUrl: data.presigned_url,
    s3Key: data.s3_key,
  };
}

/**
 * 上传单个 chunk 到 S3
 */
async function uploadChunk(
  chunk: Blob,
  presignedUrl: string,
  chunkIndex: number,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // 设置超时
    xhr.timeout = CHUNK_UPLOAD_TIMEOUT;
    
    // 监听进度
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    };
    
    // 监听完成
    xhr.onload = () => {
      if (xhr.status === 200) {
        console.log(`✅ Chunk ${chunkIndex} 上传完成`);
        resolve();
      } else {
        reject(new Error(`Chunk ${chunkIndex} 上传失败: HTTP ${xhr.status}`));
      }
    };
    
    // 监听错误
    xhr.onerror = () => {
      reject(new Error(`Chunk ${chunkIndex} 网络错误`));
    };
    
    xhr.ontimeout = () => {
      reject(new Error(`Chunk ${chunkIndex} 上传超时`));
    };
    
    // 发送请求
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", "audio/m4a");
    xhr.send(chunk);
  });
}

/**
 * 并行上传所有 chunks
 */
async function uploadChunksInParallel(
  sessionId: string,
  chunks: Blob[],
  onProgress?: (progress: ChunkUploadProgress) => void
): Promise<void> {
  console.log(`📤 开始并行上传 ${chunks.length} 个 chunks...`);
  
  const chunkInfos: ChunkInfo[] = chunks.map((data, index) => ({
    index,
    data,
    status: 'pending' as const,
    retryCount: 0,
  }));
  
  let completedCount = 0;
  const totalChunks = chunks.length;
  
  // 更新进度
  const updateProgress = () => {
    if (onProgress) {
      onProgress({
        totalChunks,
        completedChunks: completedCount,
        percentage: Math.round((completedCount / totalChunks) * 100),
      });
    }
  };
  
  // 上传单个 chunk（带重试）
  const uploadWithRetry = async (chunkInfo: ChunkInfo): Promise<void> => {
    while (chunkInfo.retryCount <= MAX_RETRIES) {
      try {
        // 获取预签名 URL（如果还没有）
        if (!chunkInfo.presignedUrl) {
          const urlData = await getChunkPresignedUrl(sessionId, chunkInfo.index);
          chunkInfo.presignedUrl = urlData.presignedUrl;
          chunkInfo.s3Key = urlData.s3Key;
        }
        
        chunkInfo.status = 'uploading';
        
        // 上传
        await uploadChunk(
          chunkInfo.data,
          chunkInfo.presignedUrl,
          chunkInfo.index
        );
        
        chunkInfo.status = 'completed';
        completedCount++;
        updateProgress();
        return;
        
      } catch (error) {
        chunkInfo.retryCount++;
        console.warn(`⚠️ Chunk ${chunkInfo.index} 上传失败，重试 ${chunkInfo.retryCount}/${MAX_RETRIES}`);
        
        if (chunkInfo.retryCount > MAX_RETRIES) {
          chunkInfo.status = 'failed';
          throw error;
        }
        
        // 重试前等待
        await new Promise(resolve => setTimeout(resolve, 1000 * chunkInfo.retryCount));
        // 清除预签名 URL，重新获取
        chunkInfo.presignedUrl = undefined;
      }
    }
  };
  
  // 使用并发池上传
  const pool: Promise<void>[] = [];
  let currentIndex = 0;
  
  const startNext = async (): Promise<void> => {
    if (currentIndex >= chunkInfos.length) {
      return;
    }
    
    const chunkInfo = chunkInfos[currentIndex];
    currentIndex++;
    
    try {
      await uploadWithRetry(chunkInfo);
    } finally {
      // 完成后启动下一个
      await startNext();
    }
  };
  
  // 启动初始的并行任务
  const initialCount = Math.min(MAX_PARALLEL_UPLOADS, chunkInfos.length);
  for (let i = 0; i < initialCount; i++) {
    pool.push(startNext());
  }
  
  // 等待所有完成
  await Promise.all(pool);
  
  // 检查是否有失败的
  const failedChunks = chunkInfos.filter(c => c.status === 'failed');
  if (failedChunks.length > 0) {
    throw new Error(`${failedChunks.length} 个 chunks 上传失败`);
  }
  
  console.log("✅ 所有 chunks 上传完成");
}

/**
 * 完成分块上传并创建任务
 */
async function completeChunkUpload(
  sessionId: string,
  chunkCount: number,
  duration: number,
  content?: string,
  imageUrls?: string[],
  expectImages?: boolean,
  userName?: string
): Promise<{ taskId: string; audioUrl: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("未登录");
  }
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  
  if (userName) {
    headers["X-User-Name"] = userName;
  }
  
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("chunk_count", chunkCount.toString());
  formData.append("duration", duration.toString());
  
  if (content && content.trim()) {
    formData.append("content", content.trim());
  }
  
  if (imageUrls && imageUrls.length > 0) {
    formData.append("image_urls", JSON.stringify(imageUrls));
    formData.append("expect_images", "false");
  } else if (expectImages) {
    formData.append("expect_images", "true");
  }
  
  const response = await fetch(`${API_BASE_URL}/diary/audio/chunk-complete`, {
    method: "POST",
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "未知错误");
    throw new Error(`完成上传失败: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return {
    taskId: data.task_id,
    audioUrl: data.audio_url,
  };
}

/**
 * ✅ 主入口：分块上传音频并创建任务
 * 
 * 这是 Phase 2 的核心函数，替代原有的 uploadAudioAndCreateTask
 * 
 * @param audioUri - 本地音频文件 URI
 * @param duration - 音频时长（秒）
 * @param onProgress - 进度回调（0-100）
 * @param content - 可选的文字内容
 * @param imageUrls - 可选的图片 URL 列表
 * @param expectImages - 是否期待后续图片
 * @returns 任务信息
 */
export async function uploadAudioWithChunks(
  audioUri: string,
  duration: number,
  onProgress?: (progress: number) => void,
  content?: string,
  imageUrls?: string[],
  expectImages?: boolean
): Promise<{ taskId: string; headers: Record<string, string> }> {
  console.log("🚀 Phase 2: 分块并行上传启动");
  const startTime = Date.now();
  
  try {
    // Step 1: 生成 session ID
    const sessionId = generateSessionId();
    console.log(`📋 Session ID: ${sessionId}`);
    
    // Step 2: 创建会话
    await createChunkSession(sessionId);
    onProgress?.(5);
    
    // Step 3: 分割音频文件
    const chunks = await splitAudioIntoChunks(audioUri);
    onProgress?.(10);
    
    // Step 4: 并行上传 chunks
    await uploadChunksInParallel(sessionId, chunks, (chunkProgress) => {
      // 上传进度占 10% - 80%
      const uploadPercent = 10 + (chunkProgress.percentage * 0.7);
      onProgress?.(Math.round(uploadPercent));
    });
    onProgress?.(80);
    
    // Step 5: 获取用户名
    const { getPreferredName } = await import("./authService");
    const preferredName = await getPreferredName();
    
    // Step 6: 完成上传并创建任务
    const result = await completeChunkUpload(
      sessionId,
      chunks.length,
      duration,
      content,
      imageUrls,
      expectImages,
      preferredName || undefined
    );
    onProgress?.(100);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ 分块上传完成: task_id=${result.taskId}, 耗时=${(totalTime / 1000).toFixed(1)}s`);
    
    // 返回与原 API 兼容的格式
    const accessToken = await getAccessToken();
    return {
      taskId: result.taskId,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(preferredName ? { "X-User-Name": preferredName } : {}),
      },
    };
    
  } catch (error: any) {
    console.error("❌ 分块上传失败:", error);
    throw error;
  }
}

/**
 * 检查是否应该使用分块上传
 * 
 * 策略：文件大于 1MB 时使用分块上传
 */
export async function shouldUseChunkUpload(audioUri: string): Promise<boolean> {
  try {
    const response = await fetch(audioUri);
    if (!response.ok) return false;
    
    const blob = await response.blob();
    const threshold = 1 * 1024 * 1024; // 1MB
    
    return blob.size > threshold;
  } catch {
    return false;
  }
}

export default {
  uploadAudioWithChunks,
  shouldUseChunkUpload,
};
