/**
 * ✅ 音频直传S3服务
 * 
 * 优化音频上传速度的专业解决方案
 * 
 * 传统方式 (慢):
 * 手机 → Lambda → S3
 * - 音频数据传输2次
 * - 受Lambda 6MB限制
 * - 无法显示精确进度
 * - 5分钟音频可能需要30-60秒
 * 
 * 预签名URL直传 (快):
 * 手机 → S3 (直接)
 * - 音频数据只传输1次
 * - 不受Lambda限制
 * - 可显示精确进度 (1%, 2%, 3%...)
 * - 5分钟音频只需10-20秒
 * 
 * 速度提升: 50-70%
 */

import { API_BASE_URL } from "../config/aws-config";
import { getAccessToken } from "./authService";
import * as FileSystem from "expo-file-system";
import apiService from "./apiService";

/**
 * 获取音频文件的预签名URL
 * 
 * @param fileName - 音频文件名 (例如: recording.m4a)
 * @param contentType - 文件MIME类型 (例如: audio/m4a)
 * @returns 预签名URL数据
 */
export async function getAudioPresignedUrl(
  fileName: string = "recording.m4a",
  contentType: string = "audio/m4a"
): Promise<{
  presigned_url: string;
  s3_key: string;
  final_url: string;
}> {
  const formData = new FormData();
  formData.append("file_name", fileName);
  formData.append("content_type", contentType);

  try {
    return await apiService.post<{
      presigned_url: string;
      s3_key: string;
      final_url: string;
    }>("/diary/audio/presigned-url", {
      body: formData,
    });
  } catch (error: any) {
    console.error("❌ 获取预签名URL失败:", error);
    throw new Error(`获取请求链接失败: ${error.message}`);
  }
}

/**
 * 直接上传音频文件到S3 (使用预签名URL)
 * 
 * 📚 学习点: 这是专业的大文件上传方案
 * - 使用XMLHttpRequest而不是fetch,因为需要监听上传进度
 * - 直接上传到S3,不经过Lambda
 * - 支持精确的进度回调 (1%, 2%, 3%...)
 * 
 * @param audioUri - 本地音频文件URI
 * @param presignedUrl - S3预签名URL
 * @param contentType - 文件MIME类型
 * @param onProgress - 进度回调函数 (0-100)
 * @returns 上传成功的Promise
 */
export async function uploadAudioDirectToS3(
  audioUri: string,
  presignedUrl: string,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("📤 开始直传音频到S3...");
      console.log(`  - URI: ${audioUri}`);
      console.log(`  - Content-Type: ${contentType}`);

      // 读取音频文件内容 - 使用 fetch 绕过 getInfoAsync 弃用问题
      const response = await fetch(audioUri);
      if (!response.ok) {
        throw new Error("音频文件读取失败");
      }
      const blob = await response.blob();
      const fileSize = blob.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      console.log(`  - 文件大小: ${fileSizeMB}MB (${fileSize} bytes)`);

      // 使用XMLHttpRequest进行上传 (支持进度监听)
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
          console.log(`📊 上传进度: ${progress}% (${event.loaded}/${event.total} bytes)`);
        }
      });

      // 监听上传完成
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          console.log("✅ 音频直传S3成功");
          if (onProgress) {
            onProgress(100);
          }
          resolve();
        } else {
          reject(new Error(`S3上传失败: HTTP ${xhr.status}`));
        }
      });

      // 监听上传错误
      xhr.addEventListener("error", () => {
        reject(new Error("网络错误: 上传失败"));
      });

      // 监听上传超时
      xhr.addEventListener("timeout", () => {
        reject(new Error("上传超时"));
      });

      // 配置请求
      xhr.open("PUT", presignedUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.timeout = 5 * 60 * 1000; // 5分钟超时

      // 开始上传
      xhr.send(blob);
    } catch (error: any) {
      console.error("❌ 音频直传S3失败:", error);
      reject(error);
    }
  });
}

/**
 * ✅ 优化版: 上传音频并创建语音日记任务 (使用直传)
 * 
 * 工作流程:
 * 1. 获取预签名URL (快速,只需几十ms)
 * 2. 直接上传音频到S3 (显示精确进度 0-100%)
 * 3. 创建语音日记任务 (使用final_url,不再上传音频)
 * 
 * @param audioUri - 本地音频文件URI
 * @param duration - 音频时长(秒)
 * @param onUploadProgress - 上传进度回调 (0-100)
 * @returns 任务ID和请求头
 */
export async function uploadAudioAndCreateTask(
  audioUri: string,
  duration: number,
  onUploadProgress?: (progress: number) => void,
  content?: string,
  imageUrls?: string[],
  expectImages?: boolean
): Promise<{ taskId: string; headers: Record<string, string> }> {
  console.log("🎤 优化版音频上传流程启动");
  
  try {
    // 第1步 & 第2步并行准备: 获取预签名URL 和 准备文件
    console.log("📋 步骤1: 正在并行获取预签名URL和准备音频文件...");
    const startTime = Date.now();
    
    // ✅ 并行执行：1. 获取URL, 2. 读取文件Blob (读取大文件需要时间)
    const [presignedData, blob] = await Promise.all([
      getAudioPresignedUrl("recording.m4a", "audio/m4a"),
      (async () => {
        const response = await fetch(audioUri);
        if (!response.ok) throw new Error("音频文件读取失败");
        return await response.blob();
      })()
    ]);
    
    console.log(`✅ 准备就绪: URL已获取, 文件已转换为Blob (耗时: ${((Date.now() - startTime)/1000).toFixed(2)}s)`);

    // 第3步: 直接上传音频到S3
    console.log("📤 步骤2: 直传音频到S3...");
    const uploadStartTime = Date.now();
    
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onUploadProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onUploadProgress(progress);
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          onUploadProgress?.(100);
          resolve();
        } else {
          reject(new Error(`S3上传失败: ${xhr.status}`));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("网络错误")));
      xhr.open("PUT", presignedData.presigned_url, true);
      xhr.setRequestHeader("Content-Type", "audio/m4a");
      xhr.send(blob);
    });
    
    console.log(`✅ 音频上传完成 (耗时${((Date.now() - uploadStartTime) / 1000).toFixed(1)}秒)`);
    
    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ 音频上传完成 (耗时${uploadTime}秒)`);

    // 第3步: 创建语音日记任务 (使用final_url,不再上传音频)
    console.log("📝 步骤3: 创建语音日记任务...");
    
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("未登录");
    }

    // 获取用户名字
    const { getCurrentUser } = await import("./authService");
    const currentUser = await getCurrentUser();
    const userName = currentUser?.name?.trim();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (userName) {
      headers["X-User-Name"] = userName;
    }

    // 创建FormData (只传元数据,不传音频文件)
    const formData = new FormData();
    formData.append("audio_url", presignedData.final_url); // ✅ 使用已上传的URL
    formData.append("duration", duration.toString());

    if (content && content.trim()) {
      formData.append("content", content.trim());
    }
    
    // ✅ 专家优化：真正的并行逻辑
    // 只有当已经拿到图片URL时，才传给后端
    if (imageUrls && imageUrls.length > 0) {
      formData.append("image_urls", JSON.stringify(imageUrls));
      formData.append("expect_images", "false"); // 已经有了，不需要后端等
    } else if (expectImages === true) {
      formData.append("expect_images", "true"); // 告诉后端：图片随后就到
    }

    // 调用新的API端点 (接收audio_url而不是audio文件)
    const response = await fetch(`${API_BASE_URL}/diary/voice/async-with-url`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "未知错误");
      throw new Error(`创建任务失败: ${response.status} - ${errorText}`);
    }

    const taskData = await response.json();
    console.log("✅ 任务创建成功:", taskData.task_id);

    return { taskId: taskData.task_id, headers };
  } catch (error: any) {
    console.error("❌ 优化版音频上传失败:", error);
    throw error;
  }
}

/**
 * 检查音频文件大小
 * 
 * @param audioUri - 音频文件URI
 * @returns 文件大小(字节)
 */
export async function getAudioFileSize(audioUri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(audioUri, { size: true } as any);
    if (!fileInfo.exists) {
      throw new Error("音频文件不存在");
    }
    return typeof fileInfo.size === "number" ? fileInfo.size : 0;
  } catch (error) {
    console.warn("⚠️ 无法获取音频文件大小:", error);
    return 0;
  }
}
