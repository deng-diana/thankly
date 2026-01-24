/**
 * API服务 - 基础HTTP请求封装
 *
 * 这个文件的作用：
 * - 封装所有HTTP请求（GET, POST, PUT, DELETE）
 * - 自动添加认证Token
 * - 统一错误处理
 * - 简化API调用
 *
 * 就像一个"万能遥控器"，控制所有的API请求
 */

import { API_BASE_URL } from "../config/aws-config";
import { getAccessToken } from "./authService";

/**
 * API响应类型
 * 定义服务器返回的数据格式
 */
interface ApiResponse<T> {
  data?: T; // 成功时返回的数据
  error?: string; // 失败时的错误信息
  message?: string; // 服务器消息
}

/**
 * 请求配置类型
 * 定义发送请求时可以配置的选项
 */
interface RequestConfig {
  headers?: Record<string, string>; // 自定义请求头
  body?: any; // 请求体数据
  requireAuth?: boolean; // 是否需要认证（默认true）
}

/**
 * APIService类
 * 提供所有的HTTP请求方法
 */
class APIService {
  // ✅ 认证过期回调列表
  private authExpiredCallbacks: Array<() => void> = [];

  /**
   * 注册认证过期监听器
   */
  onAuthExpired(callback: () => void) {
    this.authExpiredCallbacks.push(callback);
  }

  /**
   * 移除认证过期监听器
   */
  offAuthExpired(callback: () => void) {
    this.authExpiredCallbacks = this.authExpiredCallbacks.filter(
      (cb) => cb !== callback
    );
  }

  /**
   * 触发认证过期事件
   */
  private triggerAuthExpired() {
    this.authExpiredCallbacks.forEach((callback) => callback());
  }
  /**
   * 基础请求方法
   * 所有其他方法（GET, POST等）都会调用这个
   *
   * @param endpoint - API端点路径（如：'/diaries'）
   * @param method - HTTP方法（GET, POST, PUT, DELETE）
   * @param config - 请求配置
   */
  private async request<T>(
    endpoint: string,
    method: string,
    config: RequestConfig = {}
  ): Promise<T> {
    // 第1步：构造完整URL
    // 例如：BASE_URL + '/diaries' = 'https://xxx.com/diaries'
    // 移除endpoint开头多余的斜杠
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    console.log(`📡 API请求: ${method} ${url}`);

    // 第2步：准备请求头（Headers）
    const headers: Record<string, string> = {
      ...config.headers, // 合并自定义headers
    };

    // 如果不是 FormData，默认设置为 application/json
    const isFormData = config.body instanceof FormData;
    if (!isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // 第3步：添加认证Token（如果需要）
    // requireAuth默认为true，表示大多数API都需要登录
    if (config.requireAuth !== false) {
      const token = await getAccessToken(); // 从安全存储获取Cognito Access Token

      if (!token) {
        throw new Error("未登录，请先登录");
      }

      // ✅ 调试：检查token信息
      try {
        const { parseJWT } = await import("./authService");
        const tokenInfo = parseJWT(token);
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = tokenInfo.exp - currentTime;

        // 简化的token信息显示
        console.log("🔍 Token状态:", {
          type: tokenInfo.token_use,
          expDate: new Date(tokenInfo.exp * 1000).toLocaleString(),
          timeUntilExpiry: `${Math.floor(timeUntilExpiry / 60)}分钟`,
          isExpired: timeUntilExpiry <= 0,
        });
      } catch (e) {
        console.error("❌ Token解析失败:", e);
      }

      // 添加Authorization header
      // 格式：Bearer <token>
      headers["Authorization"] = `Bearer ${token}`;
      console.log("🔐 已添加认证Token");

      // ✅ 自动添加用户名字头，用于AI个性化回复
      try {
        const { getCurrentUser } = await import("./authService");
        const user = await getCurrentUser();
        if (user?.name) {
          headers["X-User-Name"] = user.name;
          console.log(`👤 已自动添加用户名字 Header: ${user.name}`);
        }
      } catch (e) {
        // 静默失败，不影响核心请求
      }
    }

    // 第4步：准备请求体（Body）
    // 只有POST、PUT、PATCH需要body
    const body = isFormData
      ? (config.body as any)
      : config.body
      ? JSON.stringify(config.body)
      : undefined;

    try {
      // 第5步：发送HTTP请求
      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      console.log(`✅ 响应状态: ${response.status}`);

      // 第6步：解析响应
      let data;
      const contentType = response.headers.get("content-type");

      // 对于服务器错误（5xx），先读取文本，避免 JSON 解析错误
      if (response.status >= 500) {
        try {
          const textData = await response.text();
          // 尝试解析为 JSON，如果失败则使用文本
          try {
            data = JSON.parse(textData);
          } catch {
            // 不是 JSON，使用文本
            data = textData;
          }
        } catch (textError) {
          // 如果读取文本也失败，设置默认值
          data = { detail: "服务器错误" };
        }
      } else if (contentType && contentType.includes("application/json")) {
        // 正常情况：尝试解析 JSON
        try {
          data = await response.json();
        } catch (jsonError) {
          // JSON 解析失败，可能是响应格式有问题
          console.error("❌ JSON 解析失败:", jsonError);
          const textData = await response.text();
          console.error("📄 原始响应内容:", textData.substring(0, 200));
          // 尝试从文本中提取信息
          data = textData;
        }
      } else {
        // 其他内容类型，作为文本处理
        data = await response.text();
      }

      // 第7步：检查响应状态
      if (!response.ok) {
        // HTTP状态码不是2xx，表示请求失败
        console.log("⚠️ 请求失败 -", response.status);

        // ✅ 特殊处理401错误（token过期）- 静默刷新
        if (response.status === 401) {
          console.log("🔄 检测到401，静默刷新token...");

          try {
            const { refreshAccessToken } = await import("./authService");

            // ✅ 刷新token并直接使用返回的新 Token
            const newToken = await refreshAccessToken();
            console.log("✅ Token刷新成功，自动重试请求");

            // ✅ 验证新 Token
            if (!newToken) {
              console.log("⚠️ 刷新后无法获取token");
              this.triggerAuthExpired();
              throw new Error("AUTH_EXPIRED");
            }

            // 更新headers
            headers["Authorization"] = `Bearer ${newToken}`;

            // 重试请求
            const retryResponse = await fetch(url, { method, headers, body });
            console.log(`🔄 重试响应: ${retryResponse.status}`);

            // 重试成功
            if (retryResponse.ok) {
              let retryData;
              const retryContentType =
                retryResponse.headers.get("content-type");
              if (retryContentType?.includes("application/json")) {
                retryData = await retryResponse.json();
              } else {
                retryData = await retryResponse.text();
              }
              return retryData;
            }

            // 重试仍失败
            console.log("⚠️ 重试后仍失败");
            if (retryResponse.status === 401) {
              this.triggerAuthExpired();
              throw new Error("AUTH_EXPIRED");
            }
            throw new Error("RETRY_FAILED");
          } catch (refreshError: any) {
            // 静默处理刷新错误，不向用户显示技术细节
            console.log("⚠️ 刷新流程失败:", refreshError.message);

            // 只有在明确认证过期时才触发登出
            if (
              refreshError.message === "REFRESH_TOKEN_EXPIRED" ||
              refreshError.message === "AUTH_EXPIRED"
            ) {
              console.log("🔐 认证已过期，自动退出登录");
              this.triggerAuthExpired();
            }

            throw new Error("AUTH_EXPIRED");
          }
        }

        // 其他HTTP错误 - 友好提示
        let errorMessage = "请求失败";

        // 尝试解析错误详情（不暴露给用户）
        try {
          const errorDetail =
            typeof data === "object"
              ? data.error || data.detail || data.message
              : String(data);
          console.log("⚠️ 错误详情:", errorDetail);
        } catch (e) {
          // 忽略解析错误
        }

        // 根据状态码返回用户友好的提示
        if (response.status === 403) {
          errorMessage = "没有权限访问";
        } else if (response.status === 404) {
          errorMessage = "资源不存在";
        } else if (response.status === 502) {
          errorMessage = "服务暂时不可用，请稍后重试";
        } else if (response.status === 503) {
          errorMessage = "服务暂时不可用，请稍后重试";
        } else if (response.status >= 500) {
          errorMessage = "服务暂时不可用，请稍后重试";
        } else if (response.status === 400) {
          // 400通常有具体的业务错误信息，可以显示
          errorMessage =
            typeof data === "object"
              ? data.detail || data.message || errorMessage
              : errorMessage;
        }

        throw new Error(errorMessage);
      }

      // 第8步：返回数据
      // console.log("📦 返回数据:", data);  // 生产环境关闭
      return data;
    } catch (error: any) {
      console.log("⚠️ API请求异常:", error);

      // 统一错误处理
      if (error.message.includes("Network request failed")) {
        throw new Error("网络连接失败，请检查网络");
      }

      throw error;
    }
  }

  /**
   * GET请求
   * 用于获取数据（查询）
   *
   * 例如：获取日记列表
   * apiService.get('/diaries')
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, "GET", config);
  }

  /**
   * POST请求
   * 用于创建新数据
   *
   * 例如：创建新日记
   * apiService.post('/diaries', { body: { title: '...' } })
   */
  async post<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, "POST", config);
  }

  /**
   * PUT请求
   * 用于更新整个资源
   *
   * 例如：更新日记
   * apiService.put('/diaries/123', { body: { title: '...' } })
   */
  async put<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, "PUT", config);
  }

  /**
   * DELETE请求
   * 用于删除资源
   *
   * 例如：删除日记
   * apiService.delete('/diaries/123')
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, "DELETE", config);
  }
}

// 创建并导出单例
// 整个App共用一个APIService实例
export const apiService = new APIService();

export default apiService;
