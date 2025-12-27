/**
 * 日记服务
 *
 * 负责所有日记相关的API操作
 */

import apiService from "./apiService";
import { getAccessToken } from "./authService"; // ← 需要这个
import { refreshAccessToken } from "./authService"; // ← 自动刷新
import { API_BASE_URL } from "../config/aws-config"; // ← 需要这个

/**
 * 日记数据类型（后端返回的格式）
 * 使用snake_case命名，与后端一致
 */
export interface Diary {
  diary_id: string; // 日记ID
  user_id: string; // 用户ID
  created_at: string; // 创建时间（ISO字符串）
  date: string; // 日期（YYYY-MM-DD）
  language: string; // ← 新增：语言代码
  title: string; // ← 新增：AI生成的标题
  original_content: string; // 原始内容
  polished_content: string; // AI润色后的内容
  ai_feedback: string; // AI反馈
  audio_url?: string; // ← 新增：音频URL（可选）
  audio_duration?: number; // ← 新增：音频时长（可选）
  image_urls?: string[]; // ← 新增：图片URL数组（可选，最多9张）
}

/**
 * 创建日记的请求参数
 * 对应后端的DiaryCreate模型
 */
export interface CreateDiaryRequest {
  content: string; // 只需要这一个字段！
}
/**
 * 获取日记列表
 *
 * @param page - 页码（从1开始）
 * @param pageSize - 每页数量
 */
export async function getDiaries(): Promise<Diary[]> {
  console.log("📖 获取日记列表");

  const response = await apiService.get<Diary[]>("/diary/list");

  return response;
}

/**
 * 获取日记详情
 */
export async function getDiaryDetail(diaryId: string): Promise<Diary> {
  console.log("📖 获取日记详情:", diaryId);

  const response = await apiService.get<Diary>(`/diary/${diaryId}`);

  return response;
}

/**
 * 创建文字日记
 */
export async function createTextDiary(
  data: CreateDiaryRequest
): Promise<Diary> {
  console.log("📝 创建文字日记");
  const response = await apiService.post<Diary>("/diary/text", {
    body: data,
  });
  console.log("✅ 文字日记创建成功:", response.diary_id);
  return response;
}

/**
 * 创建纯图片日记
 *
 * Flow:
 * 1. Upload images to S3 via uploadDiaryImages()
 * 2. Get image URLs
 * 3. Call this function with URLs to create diary
 *
 * @param imageUris - Local image URIs (file:// paths from camera/gallery)
 * @returns Created diary entry
 */
export async function createImageOnlyDiary(
  imageUris: string[],
  content?: string
): Promise<Diary> {
  console.log("📸 创建图片日记");
  console.log("图片数量:", imageUris.length);
  console.log("是否有文字:", !!content);

  try {
    // Step 1: Upload all images to S3
    console.log("📤 Step 1: 上传图片到 S3...");
    const imageUrls = await uploadDiaryImages(imageUris);
    console.log("✅ 图片上传成功，URLs:", imageUrls);

    // Step 2: Create diary with image URLs (and optional content)
    console.log("📝 Step 2: 创建日记记录...");
    const requestBody: { image_urls: string[]; content?: string } = {
      image_urls: imageUrls,
    };

    // Add content if provided
    if (content && content.trim()) {
      requestBody.content = content.trim();
    }

    const response = await apiService.post<Diary>("/diary/image-only", {
      body: requestBody,
    });

    console.log("✅ 图片日记创建成功:", response.diary_id);
    return response;
  } catch (error: any) {
    console.error("❌ 创建图片日记失败:", error);
    throw new Error(error.message || "创建日记失败，请重试");
  }
}

/**
 * 上传多张图片到 S3（使用预签名 URL，绕过 Lambda 6MB 限制）
 *
 * Flow:
 * 1. 获取预签名 URL（从后端）
 * 2. 直接上传到 S3（使用预签名 URL）
 * 3. 返回最终的 S3 URL 列表
 *
 * @param imageUris - Local image file URIs
 * @returns Array of S3 URLs
 */
export async function uploadDiaryImages(
  imageUris: string[]
): Promise<string[]> {
  console.log("📤 上传图片到 S3（使用预签名 URL），数量:", imageUris.length);

  if (!imageUris || imageUris.length === 0) {
    throw new Error("没有选择图片");
  }

  if (imageUris.length > 9) {
    throw new Error("最多只能上传9张图片");
  }

  try {
    // Step 1: Get auth token
    let token = await getAccessToken();
    if (!token) {
      console.log("🔄 Token 不存在，尝试刷新...");
      await refreshAccessToken();
      token = await getAccessToken();
      if (!token) {
        throw new Error("未登录，请先登录");
      }
    }

    // Step 2: Extract file names and content types
    const fileNames: string[] = [];
    const contentTypes: string[] = [];

    imageUris.forEach((uri, index) => {
      const filename = uri.split("/").pop() || `image${index + 1}.jpg`;
      fileNames.push(filename);

      // Detect content type from filename
      let contentType = "image/jpeg"; // default
      if (filename.toLowerCase().endsWith(".png")) {
        contentType = "image/png";
      } else if (filename.toLowerCase().endsWith(".heic")) {
        contentType = "image/heic";
      }
      contentTypes.push(contentType);

      console.log(
        `  📎 准备图片 ${index + 1}/${
          imageUris.length
        }: ${filename} (${contentType})`
      );
    });

    // Step 3: Get presigned URLs from backend
    console.log("📤 Step 1: 获取预签名 URL...");
    const presignedResponse = await fetch(
      `${API_BASE_URL}/diary/images/presigned-urls`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_names: fileNames,
          content_types: contentTypes,
        }),
      }
    );

    if (!presignedResponse.ok) {
      // Handle token refresh
      if (presignedResponse.status === 401) {
        console.log("🔄 Token 过期，刷新后重试...");
        await refreshAccessToken();
        token = await getAccessToken();

        if (!token) {
          throw new Error("登录已过期，请重新登录");
        }

        const retryResponse = await fetch(
          `${API_BASE_URL}/diary/images/presigned-urls`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              file_names: fileNames,
              content_types: contentTypes,
            }),
          }
        );

        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new Error(
            `获取预签名 URL 失败: ${retryResponse.status} - ${errorText}`
          );
        }

        const retryData = await retryResponse.json();
        // Continue with retryData below
        const presignedUrls = retryData.presigned_urls;

        // Step 4: Upload each image directly to S3
        console.log("📤 Step 2: 直接上传到 S3...");
        const finalUrls: string[] = [];

        for (let i = 0; i < imageUris.length; i++) {
          const uri = imageUris[i];
          const presignedData = presignedUrls[i];

          console.log(`  📤 上传图片 ${i + 1}/${imageUris.length} 到 S3...`);

          // Read image file
          const response = await fetch(uri);
          const blob = await response.blob();

          // Upload to S3 using presigned URL
          const uploadResponse = await fetch(presignedData.presigned_url, {
            method: "PUT",
            headers: {
              "Content-Type": presignedData.content_type || contentTypes[i],
            },
            body: blob,
          });

          if (!uploadResponse.ok) {
            throw new Error(
              `上传图片 ${i + 1} 到 S3 失败: ${uploadResponse.status}`
            );
          }

          finalUrls.push(presignedData.final_url);
          console.log(
            `  ✅ 图片 ${i + 1} 上传成功: ${presignedData.final_url}`
          );
        }

        console.log("✅ 所有图片上传成功:", finalUrls);
        return finalUrls;
      }

      const errorText = await presignedResponse.text();
      throw new Error(
        `获取预签名 URL 失败: ${presignedResponse.status} - ${errorText}`
      );
    }

    const presignedData = await presignedResponse.json();
    const presignedUrls = presignedData.presigned_urls;

    // Step 4: Upload each image directly to S3
    console.log("📤 Step 2: 直接上传到 S3...");
    const finalUrls: string[] = [];

    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      const presignedData = presignedUrls[i];

      console.log(`  📤 上传图片 ${i + 1}/${imageUris.length} 到 S3...`);

      // Read image file
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to S3 using presigned URL
      const uploadResponse = await fetch(presignedData.presigned_url, {
        method: "PUT",
        headers: {
          "Content-Type": contentTypes[i],
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `上传图片 ${i + 1} 到 S3 失败: ${uploadResponse.status}`
        );
      }

      finalUrls.push(presignedData.final_url);
      console.log(`  ✅ 图片 ${i + 1} 上传成功: ${presignedData.final_url}`);
    }

    console.log("✅ 所有图片上传成功:", finalUrls);
    return finalUrls;
  } catch (error: any) {
    console.error("❌ 上传图片失败:", error);
    throw new Error(error.message || "上传失败，请重试");
  }
}

/**
 * 创建语音日记
 *
 * @param audioUri - 本地音频文件URI
 * @param duration - 音频时长（秒）
 */
export async function createVoiceDiary(
  audioUri: string,
  duration: number
): Promise<Diary> {
  console.log("🎤 创建语音日记");
  console.log("音频URI:", audioUri);
  console.log("时长:", duration, "秒");

  try {
    // 第1步：创建FormData
    const formData = new FormData();

    //添加音频文件
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "recording.m4a",
    } as any);

    // 添加时长
    formData.append("duration", duration.toString());

    // 第3步：上传到后端
    // 这里需要特殊处理，不能用apiService
    // 因为FormData需要不同的headers

    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("未登录");
    }

    // ✅ 获取用户名字（从本地存储）
    const { getCurrentUser } = await import("./authService");
    const currentUser = await getCurrentUser();
    const userName = currentUser?.name?.trim();

    // 发送请求的封装（方便重试）
    const sendWithToken = async (token: string) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      // ✅ 如果JWT token中没有名字，通过请求头传递（作为备用方案）
      if (userName) {
        headers["X-User-Name"] = userName;
        console.log(`📤 通过请求头传递用户名字: ${userName}`);
      }

      const resp = await fetch(`${API_BASE_URL}/diary/voice`, {
        method: "POST",
        headers,
        body: formData,
      });
      return resp;
    };

    // 第一次请求
    let response = await sendWithToken(accessToken);

    // 如果401，尝试刷新token后重试一次
    if (response.status === 401) {
      console.log("🔄 语音上传遇到401，尝试刷新token后重试...");
      try {
        await refreshAccessToken();
        const newToken = await getAccessToken();
        if (!newToken) {
          throw new Error("刷新后无法获取新token");
        }
        response = await sendWithToken(newToken);
      } catch (e) {
        // 刷新失败，直接抛错（保持与apiService一致的文案）
        throw new Error("登录已过期，请重新登录");
      }
    }

    if (!response.ok) {
      // 尝试解析友好的错误
      let errorMessage = "上传失败";
      let errorCode = null;
      try {
        const error = await response.json();
        // 检查是否是结构化错误（包含 code 字段）
        if (typeof error.detail === "string") {
          try {
            const parsed = JSON.parse(error.detail);
            if (parsed.code) {
              errorCode = parsed.code;
              errorMessage = parsed.message || errorMessage;
            }
          } catch {
            // 如果不是 JSON，使用原字符串
            errorMessage = error.detail || error.error || errorMessage;
          }
        } else if (error.detail) {
          errorMessage = error.detail;
        } else if (error.error) {
          errorMessage = error.error;
        }
      } catch (_) {}

      // 规范化提示
      if (
        errorMessage.includes("Token已过期") ||
        errorMessage.includes("401")
      ) {
        errorMessage = "登录已过期，请重新登录";
      }

      // 创建错误对象，携带错误码
      const error = new Error(errorMessage) as any;
      error.code = errorCode;
      throw error;
    }

    const diary = await response.json();
    console.log("✅ 语音日记创建成功:", diary.diary_id);
    return diary;
  } catch (error: any) {
    console.log("⚠️ 创建语音日记失败:", error);
    throw error;
  }
}

/**
 * 进度更新回调函数类型
 */
export interface ProgressCallback {
  (progress: {
    step: number;
    step_name: string;
    progress: number;
    message: string;
  }): void;
}

/**
 * 创建语音日记（实时进度版 - 轮询模式）
 *
 * 📚 学习点：这是专业的任务队列模式
 * - 后端创建任务并返回task_id
 * - 前端定期轮询查询进度（每500ms）
 * - 跨平台兼容，所有平台都支持
 *
 * @param audioUri - 本地音频文件URI
 * @param duration - 音频时长（秒）
 * @param onProgress - 进度回调函数（可选）
 * @returns Promise<Diary> - 最终创建的日记
 */
export async function createVoiceDiaryStream(
  audioUri: string,
  duration: number,
  onProgress?: ProgressCallback,
  imageUrls?: string[] // ✅ 新增：图片URL列表（用于图片+语音日记）
): Promise<Diary> {
  console.log("🎤 创建语音日记（实时进度版 - 轮询模式）");
  console.log("音频URI:", audioUri);
  console.log("时长:", duration, "秒");
  console.log("图片数量:", imageUrls?.length || 0);

  try {
    // 第1步：创建FormData
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "recording.m4a",
    } as any);
    formData.append("duration", duration.toString());

    // ✅ 如果有图片，添加图片URL列表（JSON字符串）
    if (imageUrls && imageUrls.length > 0) {
      formData.append("image_urls", JSON.stringify(imageUrls));
    }

    // 第2步：获取认证token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("未登录");
    }

    // 获取用户名字
    const { getCurrentUser } = await import("./authService");
    const currentUser = await getCurrentUser();
    const userName = currentUser?.name?.trim();

    // 第3步：创建任务（发送到异步端点）
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (userName) {
      headers["X-User-Name"] = userName;
    }

    const createResponse = await fetch(`${API_BASE_URL}/diary/voice/async`, {
      method: "POST",
      headers,
      body: formData,
    });

    // 处理401错误（token过期）
    if (createResponse.status === 401) {
      console.log("🔄 Token过期，尝试刷新...");
      await refreshAccessToken();
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error("登录已过期，请重新登录");
      }

      headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}/diary/voice/async`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!retryResponse.ok) {
        throw new Error("登录已过期，请重新登录");
      }

      const retryData = await retryResponse.json();
      return await pollTaskProgress(retryData.task_id, headers, onProgress);
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text().catch(() => "未知错误");
      throw new Error(`创建任务失败: ${createResponse.status} - ${errorText}`);
    }

    const taskData = await createResponse.json();
    const taskId = taskData.task_id;

    console.log("✅ 任务已创建:", taskId);

    // 第4步：轮询查询进度
    return await pollTaskProgress(taskId, headers, onProgress);
  } catch (error: any) {
    console.log("⚠️ 创建语音日记失败:", error);
    throw error;
  }
}

/**
 * 轮询查询任务进度（智能轮询策略）
 *
 * 📚 学习点：智能轮询策略
 * - 前10秒：每300ms查询一次（快速响应，确保捕获所有中间进度）
 * - 后面：降到800ms（省电省流量，但仍保持响应性）
 * - 网络错误时使用指数退避（更稳定）
 *
 * 📚 指数退避（Exponential Backoff）：
 * - 当遇到网络错误时，等待时间按指数增长
 * - 第1次错误：等待1秒
 * - 第2次错误：等待2秒
 * - 第3次错误：等待4秒
 * - 第4次错误：等待8秒
 * - 最大等待时间：16秒
 * - 优点：网络差时不会频繁重试，减少服务器压力，更省电
 */
async function pollTaskProgress(
  taskId: string,
  headers: Record<string, string>,
  onProgress?: ProgressCallback
): Promise<Diary> {
  const startTime = Date.now();
  const FAST_POLL_DURATION = 10000; // 前10秒使用快速轮询（确保捕获所有中间进度）
  const FAST_POLL_INTERVAL = 300; // 快速轮询：300ms（更频繁，确保不遗漏进度）
  const SLOW_POLL_INTERVAL = 800; // 慢速轮询：800ms（稍快一些，保持响应性）
  const MAX_POLL_DURATION = 5 * 60 * 1000; // 最多轮询5分钟
  const MAX_BACKOFF_INTERVAL = 16000; // 最大退避时间：16秒

  let consecutiveErrors = 0; // 连续错误次数（用于指数退避）

  while (Date.now() - startTime < MAX_POLL_DURATION) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/diary/voice/progress/${taskId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (response.status === 404) {
        throw new Error("任务不存在或已过期");
      }

      if (!response.ok) {
        throw new Error(`查询进度失败: ${response.status}`);
      }

      // ✅ 成功请求，重置错误计数
      consecutiveErrors = 0;

      const progressData = await response.json();
      const status = progressData.status;

      // 更新进度回调
      if (onProgress) {
        // 步骤映射：后端step 0-5 映射到前端step 0-4
        let frontendStep = progressData.step;
        if (progressData.step > 0) {
          frontendStep = progressData.step - 1;
        }
        frontendStep = Math.max(0, Math.min(frontendStep, 4));

        onProgress({
          step: frontendStep,
          step_name: progressData.step_name || "",
          progress: progressData.progress || 0,
          message: progressData.message || "",
        });
      }

      // 检查任务状态
      if (status === "completed") {
        if (!progressData.diary) {
          throw new Error("任务完成但未返回日记数据");
        }
        console.log("✅ 任务完成:", progressData.diary.diary_id);
        return progressData.diary;
      }

      if (status === "failed") {
        const errorMsg = progressData.error || "任务处理失败";
        throw new Error(errorMsg);
      }

      // ✅ 智能轮询间隔：前10秒快速（300ms），后面慢速（800ms）
      const elapsed = Date.now() - startTime;
      const pollInterval =
        elapsed < FAST_POLL_DURATION ? FAST_POLL_INTERVAL : SLOW_POLL_INTERVAL;

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      // 如果是最终错误（完成或失败），直接抛出
      if (
        error.message.includes("任务完成") ||
        error.message.includes("任务处理失败") ||
        error.message.includes("任务不存在")
      ) {
        throw error;
      }

      // ✅ 网络错误：使用指数退避
      consecutiveErrors++;
      const backoffInterval = Math.min(
        Math.pow(2, consecutiveErrors - 1) * 1000, // 1s, 2s, 4s, 8s, 16s...
        MAX_BACKOFF_INTERVAL
      );

      console.warn(
        `⚠️ 轮询错误 (连续${consecutiveErrors}次), ${backoffInterval}ms后重试:`,
        error.message
      );

      await new Promise((resolve) => setTimeout(resolve, backoffInterval));
    }
  }

  throw new Error("任务处理超时，请稍后重试");
}

/**
 * 解析SSE流
 *
 * 📚 学习点：SSE数据格式
 * - 每行以 "data: " 开头
 * - 可以指定事件类型：event: progress
 * - 两个换行符 \n\n 表示一个事件结束
 *
 * 例子：
 * event: progress
 * data: {"step": 1, "progress": 20}
 *
 */
async function parseSSEStream(
  response: Response,
  onProgress?: ProgressCallback
): Promise<Diary> {
  // 检查响应状态
  if (!response.ok) {
    const errorText = await response.text().catch(() => "未知错误");
    throw new Error(`服务器错误: ${response.status} - ${errorText}`);
  }

  // 检查响应体
  if (!response.body) {
    console.error("❌ 响应体为空，响应状态:", response.status);
    console.error("响应头:", Object.fromEntries(response.headers.entries()));
    throw new Error("无法读取响应流：响应体为空");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();
  let buffer = "";
  let diary: Diary | null = null;
  let error: Error | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码数据块
      buffer += decoder.decode(value, { stream: true });

      // 处理完整的SSE事件（以\n\n结尾）
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // 保留最后一个不完整的事件

      for (const eventBlock of lines) {
        if (!eventBlock.trim()) continue;

        // 解析SSE事件
        const eventLines = eventBlock.split("\n");
        let eventType = "message";
        let eventData = "";

        for (const line of eventLines) {
          if (line.startsWith("event: ")) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.substring(6).trim();
          }
        }

        if (!eventData) continue;

        try {
          const data = JSON.parse(eventData);

          // 处理进度更新
          if (eventType === "progress" && onProgress) {
            onProgress({
              step: data.step || 0,
              step_name: data.step_name || "",
              progress: data.progress || 0,
              message: data.message || "",
            });
          }

          // 处理完成事件
          if (eventType === "complete" && data.diary) {
            diary = data.diary;
          }

          // 处理错误事件
          if (eventType === "error") {
            error = new Error(data.error || "处理失败");
          }
        } catch (e) {
          console.warn("解析SSE数据失败:", e, eventData);
        }
      }
    }

    if (error) {
      throw error;
    }

    if (!diary) {
      throw new Error("未收到完整结果");
    }

    console.log("✅ 语音日记创建成功（流式）:", diary.diary_id);
    return diary;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 更新日记内容和/或标题
 *
 * @param diaryId - 日记ID
 * @param content - 新的日记内容（可选）
 * @param title - 新的标题（可选）
 */
export async function updateDiary(
  diaryId: string,
  content?: string,
  title?: string
): Promise<Diary> {
  console.log("✏️ 更新日记", diaryId);

  const body: { content?: string; title?: string } = {};
  if (content !== undefined) {
    body.content = content;
    console.log("📝 更新内容:", content);
  }
  if (title !== undefined) {
    body.title = title;
    console.log("📝 更新标题:", title);
  }

  try {
    const response = await apiService.put<Diary>(`/diary/${diaryId}`, {
      body,
    });

    console.log("✅ 日记更新成功:", response.diary_id);
    return response;
  } catch (error: any) {
    console.log("⚠️ 更新日记失败:", error);
    console.log("⚠️ 错误详情:", error.message);
    throw error;
  }
}

/**
 * 删除日记
 *
 * @param diaryId - 日记ID
 */
export async function deleteDiary(diaryId: string): Promise<void> {
  console.log("🗑️ 删除日记", diaryId);

  await apiService.delete(`/diary/${diaryId}`);

  console.log("✅ 日记删除成功");
}

export default {
  getDiaries,
  createTextDiary,
  createVoiceDiary,
  updateDiary,
  deleteDiary,
};
