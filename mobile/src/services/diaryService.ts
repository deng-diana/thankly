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
 * 上传图片到服务器
 *
 * @param imageUris - 本地图片URI数组（最多9张）
 * @returns S3 URL数组
 */
export async function uploadDiaryImages(
  imageUris: string[]
): Promise<string[]> {
  console.log("📸 上传图片");
  console.log("图片URI:", imageUris);
  console.log("数量:", imageUris.length);

  try {
    // 验证图片数量
    if (imageUris.length === 0) {
      throw new Error("请至少选择一张图片");
    }
    if (imageUris.length > 9) {
      throw new Error("最多只能上传9张图片");
    }

    // 第1步：创建FormData
    const formData = new FormData();

    // 添加每张图片到FormData
    imageUris.forEach((uri, index) => {
      // 检测图片类型（从URI中获取）
      let mimeType = "image/jpeg"; // 默认JPEG
      let extension = "jpg";
      
      if (uri.toLowerCase().endsWith(".png")) {
        mimeType = "image/png";
        extension = "png";
      } else if (uri.toLowerCase().endsWith(".heic")) {
        mimeType = "image/heic";
        extension = "heic";
      }

      formData.append("images", {
        uri: uri,
        type: mimeType,
        name: `photo_${index + 1}.${extension}`,
      } as any);
    });

    // 第2步：获取access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Not logged in");
    }

    // 发送请求的封装（方便重试）
    const sendWithToken = async (token: string) => {
      return await fetch(`${API_BASE_URL}/diary/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
    };

    // 第3步：上传到后端
    console.log("📤 发送上传请求...");
    let response = await sendWithToken(accessToken);

    // 如果401，尝试刷新token后重试一次
    if (response.status === 401) {
      console.log("🔄 图片上传遇到401，尝试刷新token后重试...");
      try {
        await refreshAccessToken();
        const newToken = await getAccessToken();
        if (!newToken) {
          throw new Error("刷新后无法获取新token");
        }
        response = await sendWithToken(newToken);
      } catch (e) {
        throw new Error("登录已过期，请重新登录");
      }
    }

    if (!response.ok) {
      // 尝试解析友好的错误
      let errorMessage = "图片上传失败";
      try {
        const error = await response.json();
        if (error.detail) {
          errorMessage = error.detail;
        } else if (error.error) {
          errorMessage = error.error;
        }
      } catch (_) {
        errorMessage = `上传失败: ${response.status}`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 图片上传成功:", data.image_urls);

    return data.image_urls; // 返回S3 URL数组
  } catch (error: any) {
    console.log("⚠️ 图片上传失败:", error);
    throw error;
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
