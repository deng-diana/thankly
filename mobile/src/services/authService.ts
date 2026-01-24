/**
 * 认证服务
 *
 * 这个文件负责:
 * - Apple登录
 * - Google登录
 * - 获取用户信息
 * - 退出登录
 */
// @ts-ignore
import { polyfillWebCrypto } from "expo-standard-web-crypto";
polyfillWebCrypto();
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE_URL } from "../config/aws-config";
import awsConfig from "../config/aws-config";

// WebBrowser配置(用于Google登录)
WebBrowser.maybeCompleteAuthSession();

/**
 * 用户信息类型
 */
export interface User {
  id: string; // 用户唯一ID
  email: string; // 邮箱
  name: string; // 姓名
  preferredName?: string; // 用户偏好称呼
  provider: "apple" | "google" | "username"; // 登录方式
  idToken: string; // JWT Token
  accessToken?: string; // Cognito Access Token
  refreshToken?: string; // Cognito Refresh Token
  picture?: string; // ← 新增头像URL
}

/**
 * Apple登录
 *
 * 流程:
 * 1. 调用Apple登录弹窗
 * 2. 用户授权
 * 3. 获取identityToken
 * 4. 用identityToken换取Cognito token
 * 5. 保存token和用户信息
 */
export async function signInWithApple(): Promise<User> {
  try {
    // 第1步: 检查设备是否支持Apple登录
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      throw new Error("Apple登录在此设备上不可用");
    }

    // 第2步: 调用Apple登录
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log("Apple登录凭证:", {
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
    });

    // 第3步: 获取identityToken
    const identityToken = credential.identityToken;

    if (!identityToken) {
      throw new Error("无法获取Apple identityToken");
    }

    console.log("🔍 Apple identityToken:", {
      length: identityToken.length,
      format:
        identityToken.split(".").length === 3
          ? "✅ 有效JWT格式"
          : "❌ 无效JWT格式",
    });

    // ✅ 解析identityToken获取用户信息
    const tokenInfo = parseJWT(identityToken);
    // ✅ 优先使用credential的姓名,如果没有则从token获取邮箱前缀
    let userName = "用户";

    // 1. 尝试从credential获取姓名(首次登录时有)
    if (credential.fullName?.givenName) {
      userName = `${credential.fullName.givenName} ${
        credential.fullName.familyName || ""
      }`.trim();
    }
    // 2. 尝试从credential获取邮箱
    else if (credential.email) {
      // 从邮箱提取用户名: user@example.com → user
      userName = credential.email.split("@")[0];
    }
    // 3. 尝试从token获取邮箱
    else if (tokenInfo.email) {
      userName = tokenInfo.email.split("@")[0];
    }
    // 4. 使用Apple的sub作为备用(去掉前缀)
    else if (tokenInfo.sub) {
      // sub通常是: 001234.abcdef1234567890.1234
      // 我们取中间部分的前8个字符
      const subParts = tokenInfo.sub.split(".");
      if (subParts.length > 1) {
        userName = `用户${subParts[1].substring(0, 6)}`;
      }
    }

    // 第4步: 用identityToken换取Cognito token
    // 调用后端API /auth/apple
    const cognitoTokenData = await exchangeAppleTokenForCognitoToken(
      identityToken
    );

    // ✅ 从 Cognito idToken 获取 preferred_username
    const idTokenInfo = parseJWT(cognitoTokenData.idToken);
    const preferredNameFromCognito =
      idTokenInfo.preferred_username || idTokenInfo.name || "";

    // 第5步: 构造用户信息
    const user: User = {
      id: credential.user,
      email: credential.email || tokenInfo.email || "",
      name: preferredNameFromCognito || userName,
      preferredName: preferredNameFromCognito || undefined,
      provider: "apple",
      idToken: cognitoTokenData.idToken,
      accessToken: cognitoTokenData.accessToken,
      refreshToken: cognitoTokenData.refreshToken,
    };
    console.log("✅ 构造的用户信息（包含Cognito tokens）:", {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      hasAccessToken: !!user.accessToken,
      hasIdToken: !!user.idToken,
      hasRefreshToken: !!user.refreshToken,
    });

    // ✅ 调试：检查token过期时间
    try {
      const accessTokenInfo = parseJWT(cognitoTokenData.accessToken);

      console.log("🔍 Access Token 信息:", {
        exp: accessTokenInfo.exp,
        expDate: new Date(accessTokenInfo.exp * 1000).toLocaleString(),
        token_use: accessTokenInfo.token_use,
        client_id: accessTokenInfo.client_id,
      });

      console.log("🔍 ID Token 信息:", {
        exp: idTokenInfo.exp,
        expDate: new Date(idTokenInfo.exp * 1000).toLocaleString(),
        token_use: idTokenInfo.token_use,
        aud: idTokenInfo.aud,
      });
    } catch (e) {
      console.error("❌ Token解析失败:", e);
    }

    // 第6步: 保存到安全存储
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("Apple登录失败:", error);

    // 用户取消登录
    if (error.code === "ERR_CANCELED") {
      throw new Error("登录已取消");
    }

    throw new Error("Apple登录失败: " + error.message);
  }
}

/**
 * 用Apple identityToken换取Cognito token
 */
async function exchangeAppleTokenForCognitoToken(
  identityToken: string
): Promise<{ idToken: string; accessToken: string; refreshToken: string }> {
  // 调用后端 API 来验证 Apple token
  const response = await fetch(`${API_BASE_URL}/auth/apple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identityToken }),
  });

  if (!response.ok) {
    // 获取详细的错误信息
    let errorMessage = "Apple token 验证失败";
    try {
      const errorData = await response.json();
      errorMessage =
        errorData.detail ||
        errorData.error ||
        errorData.message ||
        errorMessage;
    } catch (e) {
      // 如果无法解析JSON，使用状态码信息
      errorMessage = `Apple token 验证失败 (${response.status})`;
    }
    console.error("❌ Apple token 验证失败:", errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log("✅ Apple后端返回的Cognito tokens:", {
    hasAccessToken: !!data.accessToken,
    hasIdToken: !!data.idToken,
    hasRefreshToken: !!data.refreshToken,
  });

  // 返回完整的Cognito tokens对象
  return {
    idToken: data.idToken,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

/**
 * Google登录
 *
 * 流程:
 * 1. 打开Cognito的Google登录页面
 * 2. 用户授权
 * 3. 获取authorization code
 * 4. 用code换取Cognito token
 * 5. 保存token和用户信息
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    console.log("🚀 开始Google登录流程...");

    // 使用配置文件中的Cognito配置
    const cognitoDomain = awsConfig.oauth.domain;
    const clientId = awsConfig.userPoolWebClientId;
    const redirectUri = awsConfig.oauth.redirectSignIn;

    // 验证配置
    if (!cognitoDomain || !clientId || !redirectUri) {
      throw new Error("Google登录配置不完整");
    }

    console.log("📋 使用配置:", { cognitoDomain, clientId, redirectUri });

    // 生成PKCE参数
    const { codeVerifier, codeChallenge } = await generatePKCE();
    console.log("🔐 PKCE参数生成成功");

    // 构造Cognito Google登录URL
    const authUrl = new URL(`https://${cognitoDomain}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "email openid profile");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("identity_provider", "Google");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    // ✅ 添加 prompt=select_account 参数，强制显示账号选择界面
    // 这样用户每次登录时都可以选择要使用的Google账号
    authUrl.searchParams.set("prompt", "select_account");

    console.log("🌐 打开Google登录页面:", authUrl.toString());

    // 打开浏览器登录
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl.toString(),
      redirectUri
    );

    console.log("📱 Google登录结果:", result.type);

    if (result.type !== "success") {
      if (result.type === "cancel") {
        throw new Error("登录已取消");
      }
      throw new Error(`登录失败: ${result.type}`);
    }

    // 从URL中提取code
    const url = result.url;
    const code = extractCodeFromUrl(url);

    if (!code) {
      console.error("❌ 无法从URL提取authorization code:", url);
      throw new Error("无法获取authorization code");
    }

    console.log("✅ 成功获取authorization code");

    // 用code换取token
    const tokens = await exchangeCodeForTokens(
      code,
      codeVerifier,
      clientId,
      redirectUri
    );

    console.log("🎫 Token交换成功");

    // 解析token获取用户信息
    const userInfo = parseJWT(tokens.idToken);
    console.log("👤 完整用户信息:", userInfo);

    // ✅ 获取Google真实头像
    let pictureUrl = userInfo.picture;
    console.log("🔍 idToken 里的 picture:", pictureUrl);

    // 如果idToken中没有picture，尝试构建Google头像URL
    if (!pictureUrl) {
      console.log("🔄 idToken中没有picture，尝试构建Google头像URL...");

      const googleUserId = userInfo.identities?.[0]?.userId;
      const email = userInfo.email;

      if (googleUserId) {
        console.log("🔍 Google User ID:", googleUserId);

        // 方法1: 使用Google的公开头像URL格式
        // 这个URL通常能获取到用户的真实头像
        pictureUrl = `https://www.googleapis.com/plus/v1/people/${googleUserId}/image`;
        console.log("🖼️ 使用Google公开头像URL:", pictureUrl);

        // 方法2: 如果上面的URL不工作，尝试这个格式
        // pictureUrl = `https://lh3.googleusercontent.com/a/${googleUserId}`;

        // 方法3: 使用Google的默认头像URL（带用户ID）
        // pictureUrl = `https://lh3.googleusercontent.com/a/default-user`;
      }
    }

    // 如果仍然没有头像，使用备用方案
    if (!pictureUrl) {
      pictureUrl = "https://lh3.googleusercontent.com/a/default-user";
      console.log("🖼️ 使用Google默认头像");
    }

    // 验证必要的用户信息
    if (!userInfo.sub) {
      throw new Error("无法获取用户ID");
    }

    console.log("🔍 Google登录tokens:", {
      hasIdToken: !!tokens.idToken,
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
    });

    console.log("🔍 Google用户信息:", {
      hasSub: !!userInfo.sub,
      hasEmail: !!userInfo.email,
      hasName: !!userInfo.name,
    });

    console.log("🔍 pictureUrl:", pictureUrl);

    const preferredNameFromCognito = userInfo.preferred_username || "";
    const resolvedName =
      preferredNameFromCognito ||
      userInfo.name ||
      userInfo.email?.split("@")[0] ||
      "Google用户";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || "",
      name: resolvedName,
      preferredName: preferredNameFromCognito || undefined,
      provider: "google",
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      picture: pictureUrl || undefined, // ← 新增头像
    };

    console.log("✅ Google登录成功，保存所有tokens");

    // 保存用户信息
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ Google登录失败:", error);

    // 提供更友好的错误信息
    let errorMessage = error.message;
    if (error.message.includes("Network request failed")) {
      errorMessage = "网络连接失败，请检查网络设置";
    } else if (error.message.includes("invalid_grant")) {
      errorMessage = "登录已过期，请重新尝试";
    } else if (error.message.includes("登录已取消")) {
      throw error; // 用户取消，不显示错误
    }

    throw new Error(`Google登录失败: ${errorMessage}`);
  }
}

/**
 * 生成PKCE参数
 */
async function generatePKCE() {
  try {
    console.log("🔐 开始生成PKCE参数...");

    // 使用expo-crypto替代Web Crypto API
    const { getRandomBytes } = await import("expo-crypto");

    // 生成随机的code_verifier (43-128个字符)
    const randomBytes = getRandomBytes(32);
    const codeVerifier = base64URLEncode(randomBytes);

    console.log("✅ Code Verifier生成成功");

    // 生成code_challenge (SHA256哈希)
    const Crypto = await import("expo-crypto");
    const hashString = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    // 将BASE64转换为BASE64URL格式
    const codeChallenge = hashString
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    console.log("✅ Code Challenge生成成功");

    // 验证PKCE参数
    if (!codeVerifier || !codeChallenge) {
      throw new Error("PKCE参数生成失败");
    }

    return { codeVerifier, codeChallenge };
  } catch (error: any) {
    console.error("❌ PKCE生成失败:", error);
    throw new Error("PKCE参数生成失败: " + (error?.message || String(error)));
  }
}

/**
 * Base64 URL编码
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * 从URL中提取code
 */
function extractCodeFromUrl(url: string): string | null {
  const match = url.match(/code=([^&#]+)/);
  if (!match) return null;

  // ✅ 获取code并清理可能的特殊字符
  let code = match[1];

  // 移除末尾的 # 或其他特殊字符
  code = code.replace(/[#&].*$/, "");

  console.log("提取到的code:", code);

  return code;
}

/**
 * 用authorization code换取tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
) {
  try {
    console.log("🔄 开始Token交换...");

    const cognitoDomain = awsConfig.oauth.domain;
    const tokenUrl = `https://${cognitoDomain}/oauth2/token`;

    console.log("📋 Token交换参数:", {
      tokenUrl,
      clientId,
      redirectUri,
      codeLength: code.length,
      codeVerifierLength: codeVerifier.length,
    });

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString();

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body,
    });

    const responseText = await response.text();
    console.log("📡 Token交换响应:", {
      status: response.status,
      statusText: response.statusText,
      responseLength: responseText.length,
    });

    if (!response.ok) {
      console.error("❌ Token交换失败");

      // 解析错误信息
      let errorMessage = "无法获取token";
      let errorCode = "unknown_error";

      try {
        const errorData = JSON.parse(responseText);
        errorCode = errorData.error || "unknown_error";
        errorMessage =
          errorData.error_description || errorData.error || errorMessage;

        console.log("🔍 错误详情:", errorData);
      } catch (e) {
        console.log("🔍 原始错误响应:", responseText);
        errorMessage = responseText || `HTTP ${response.status}`;
      }

      // 根据错误类型提供友好的错误信息
      switch (errorCode) {
        case "invalid_grant":
          errorMessage = "登录已过期，请重新登录";
          break;
        case "invalid_client":
          errorMessage = "客户端配置错误";
          break;
        case "invalid_request":
          errorMessage = "请求参数错误";
          break;
        case "unsupported_grant_type":
          errorMessage = "不支持的授权类型";
          break;
        default:
          if (response.status === 400) {
            errorMessage = "请求参数错误，请重试";
          } else if (response.status === 401) {
            errorMessage = "认证失败，请重新登录";
          } else if (response.status >= 500) {
            errorMessage = "服务器错误，请稍后重试";
          }
      }

      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);

    // 验证返回的token
    if (!data.id_token || !data.access_token) {
      throw new Error("服务器返回的token不完整");
    }

    console.log("✅ Token交换成功");

    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error: any) {
    console.error("❌ Token交换异常:", error);
    throw error;
  }
}

/**
 * 解析JWT token
 */
export function parseJWT(token: string): any {
  try {
    if (!token || typeof token !== "string") {
      throw new Error("Token为空或格式错误");
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("JWT格式错误，应该有3个部分");
    }

    const base64Url = parts[1];
    if (!base64Url) {
      throw new Error("JWT payload部分为空");
    }

    // 添加padding如果需要
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const jsonPayload = decodeURIComponent(
      atob(paddedBase64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    const payload = JSON.parse(jsonPayload);

    // 验证必要的字段
    if (!payload.sub) {
      console.warn("⚠️ JWT缺少sub字段");
    }

    return payload;
  } catch (error: any) {
    console.error("❌ JWT解析失败:", error);
    console.error("❌ Token:", token?.substring(0, 50) + "...");
    throw new Error("JWT解析失败: " + (error?.message || String(error)));
  }
}

/**
 * 保存用户信息到安全存储
 */
export async function saveUser(user: User): Promise<void> {
  try {
    // 保留已存在的 preferredName（避免被登录流程覆盖）
    let preferredName = user.preferredName;
    if (!preferredName) {
      const existingUser = await getCurrentUser();
      preferredName = existingUser?.preferredName;
    }

    const userToSave = preferredName
      ? { ...user, preferredName }
      : user;

    // 保存完整用户信息（包括所有tokens）
    await SecureStore.setItemAsync("user", JSON.stringify(userToSave));
    await SecureStore.setItemAsync("idToken", user.idToken);

    // 保存 Cognito tokens（如果存在）
    if (user.accessToken) {
      await SecureStore.setItemAsync("accessToken", user.accessToken);
    }
    if (user.refreshToken) {
      await SecureStore.setItemAsync("refreshToken", user.refreshToken);
    }

    console.log("✅ 用户信息已保存（包含所有tokens）");
  } catch (error) {
    console.error("保存用户信息失败:", error);
  }
}

/**
 * 更新 Cognito 用户的姓名属性
 * @param name 用户姓名
 */
/**
 * 更新用户姓名（同步更新 Cognito name 和 preferred_username）
 * 
 * ✅ 生产级 Token 刷新逻辑：
 * 1. 使用最新的 accessToken 发起请求
 * 2. 如果 401，自动刷新并直接使用返回的新 Token（避免 SecureStore 延迟）
 * 3. 重试请求
 */
export async function updateUserName(name: string): Promise<void> {
  try {
    // ✅ 第一步：获取当前 accessToken
    let accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("用户未登录或缺少访问令牌");
    }

    console.log("🔐 使用 accessToken 更新用户名:", name);

    // ✅ 第二步：第一次尝试
    let response = await fetch(`${API_BASE_URL}/auth/user/name`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name }),
    });

    console.log(`📡 更新响应: ${response.status}`);

    // ✅ 第三步：如果 401（Token 过期），自动刷新后重试
    if (response.status === 401) {
      console.log("🔄 Token 过期，自动刷新后重试...");
      
      try {
        // ✅ 刷新并直接获取新 Token（避免二次读取 SecureStore）
        const newAccessToken = await refreshAccessToken();
        
        if (!newAccessToken) {
          throw new Error("Token 刷新后仍无法获取访问令牌");
        }

        console.log("✅ 使用刷新后的新 Token 重试");

        // ✅ 使用新 Token 重试请求
        response = await fetch(`${API_BASE_URL}/auth/user/name`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newAccessToken}`,
          },
          body: JSON.stringify({ name }),
        });

        console.log(`📡 重试响应: ${response.status}`);
      } catch (refreshError: any) {
        console.error("❌ Token 刷新失败:", refreshError);
        throw new Error("登录已过期，请重新登录");
      }
    }

    // ✅ 第四步：检查响应
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `更新失败: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Cognito 用户姓名更新成功:", data);

    // ✅ 第五步：更新本地存储的用户信息
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, name, preferredName: name };
      await saveUser(updatedUser);
      console.log("✅ 本地用户信息已更新:", name);
    }
  } catch (error: any) {
    console.error("❌ 更新 Cognito 用户姓名失败:", error);
    throw error;
  }
}

/**
 * 获取用户偏好称呼（优先使用 preferredName）
 */
export async function getPreferredName(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const preferred = user.preferredName?.trim();
  if (preferred) return preferred;
  return user.name?.trim() || null;
}

/**
 * 是否已设置偏好称呼
 */
export function hasPreferredName(user: User | null): boolean {
  return !!user?.preferredName?.trim();
}

/**
 * 判断姓名是否有效（不是从邮箱截取的）
 * @param name 用户姓名
 * @param email 用户邮箱（用于判断是否从邮箱截取）
 * @returns true 如果姓名有效，false 如果是从邮箱截取的
 */
export function isValidUserName(name: string | undefined | null, email?: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  const trimmedName = name.trim();

  // 如果姓名等于邮箱前缀，说明是从邮箱截取的，无效
  if (email) {
    const emailPrefix = email.split("@")[0];
    if (trimmedName.toLowerCase() === emailPrefix.toLowerCase()) {
      return false;
    }
  }

  // 如果姓名是默认值（如"用户"、"Google用户"等），无效
  const defaultNames = ["用户", "User", "Google用户", "Google User", "Apple用户", "Apple User"];
  if (defaultNames.includes(trimmedName)) {
    return false;
  }

  // 如果姓名包含"用户"字样的数字后缀（如"用户123456"），无效
  if (/^用户\d+/.test(trimmedName)) {
    return false;
  }

  return true;
}

/**
 * 获取当前登录的用户
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const userJson = await SecureStore.getItemAsync("user");
    if (!userJson) {
      return null;
    }
    return JSON.parse(userJson);
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return null;
  }
}

/**
 * 退出登录
 */
export async function signOut(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync("user");
    await SecureStore.deleteItemAsync("idToken");
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    console.log("✅ 已退出登录，所有tokens已清除");
  } catch (error) {
    console.error("退出登录失败:", error);
  }
}

/**
 * 获取idToken
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync("idToken");

    // ✅ 检查token是否即将过期（提前5分钟刷新）
    if (token) {
      try {
        const tokenInfo = parseJWT(token);
        const expirationTime = tokenInfo.exp * 1000; // 转换为毫秒
        const currentTime = Date.now();
        const timeUntilExpiry = expirationTime - currentTime;

        // 如果token在5分钟内过期，尝试刷新
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log("🔄 Token即将过期，尝试自动刷新...");
          // TODO: 实现token刷新逻辑（需要后端支持）
          // 目前先返回现有token，后续可以添加刷新API
        }
      } catch (e) {
        // 无法解析token，继续使用
      }
    }

    return token;
  } catch (error) {
    console.error("获取token失败:", error);
    return null;
  }
}

/**
 * 获取Cognito Access Token（用于API认证）
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    // 优先使用 accessToken（Cognito）
    const accessToken = await SecureStore.getItemAsync("accessToken");
    if (accessToken) {
      console.log("✅ 使用 Cognito Access Token");
      return accessToken;
    }

    // 如果没有 accessToken，尝试使用 idToken
    const idToken = await SecureStore.getItemAsync("idToken");
    if (idToken) {
      console.log("⚠️ 使用 Id Token（未找到 Access Token）");
      return idToken;
    }

    return null;
  } catch (error) {
    console.error("获取accessToken失败:", error);
    return null;
  }
}

/**
 * 刷新Access Token（增强版 - 带重试和超时控制）
 * 
 * ✅ 返回新的 accessToken，避免二次读取 SecureStore 导致的延迟问题
 */
export async function refreshAccessToken(): Promise<string> {
  const MAX_RETRIES = 3;
  const TIMEOUT = 10000; // 10秒超时

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");

      if (!refreshToken) {
        console.log("⚠️ 没有refresh token，无法刷新");
        throw new Error("NO_REFRESH_TOKEN");
      }

      console.log(`🔄 Token刷新尝试 ${attempt}/${MAX_RETRIES}`);

      // 使用Promise.race实现超时控制
      const fetchPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT)
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      console.log(`📡 刷新响应: ${response.status}`);

      // 502/503 服务器错误，可以重试
      if (response.status === 502 || response.status === 503) {
        console.log(
          `⚠️ 服务器暂时不可用(${response.status})，${
            attempt < MAX_RETRIES ? "重试中..." : "放弃"
          }`
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // 指数退避
          continue;
        }
        throw new Error("SERVER_ERROR");
      }

      // 401 表示refreshToken已过期，不要重试
      if (response.status === 401) {
        console.log("⚠️ Refresh token已过期");
        throw new Error("REFRESH_TOKEN_EXPIRED");
      }

      if (!response.ok) {
        console.log(`⚠️ 刷新失败: ${response.status}`);
        throw new Error("REFRESH_FAILED");
      }

      const tokens = await response.json();

      if (!tokens.accessToken || !tokens.idToken) {
        console.log("⚠️ 返回的tokens不完整");
        throw new Error("INVALID_TOKENS");
      }

      // ✅ 保存新的tokens（并行写入，提高性能）
      await Promise.all([
        SecureStore.setItemAsync("accessToken", tokens.accessToken),
        SecureStore.setItemAsync("idToken", tokens.idToken),
        tokens.refreshToken
          ? SecureStore.setItemAsync("refreshToken", tokens.refreshToken)
          : Promise.resolve(),
      ]);

      console.log("✅ Token刷新成功");
      
      // ✅ 直接返回新的 accessToken，避免二次读取
      return tokens.accessToken;
    } catch (error: any) {
      console.log(`⚠️ 第${attempt}次刷新失败:`, error.message);

      // 特定错误不重试
      if (
        error.message === "NO_REFRESH_TOKEN" ||
        error.message === "REFRESH_TOKEN_EXPIRED"
      ) {
        throw error;
      }

      // 最后一次尝试失败
      if (attempt === MAX_RETRIES) {
        throw new Error("REFRESH_FAILED_MAX_RETRIES");
      }

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  // ✅ 如果所有重试都失败，抛出错误
  throw new Error("REFRESH_FAILED_MAX_RETRIES");
}

/**
 * 定时刷新器
 */
let refreshTimer: NodeJS.Timeout | null = null;

/**
 * 启动自动刷新(每50分钟)
 */
export function startAutoRefresh() {
  stopAutoRefresh(); // 先清除旧的

  refreshTimer = setInterval(async () => {
    try {
      console.log("⏰ 自动刷新token...");
      await refreshAccessToken();
    } catch (error) {
      console.log("⚠️ 自动刷新失败:", error);
    }
  }, 50 * 60 * 1000); // 50分钟

  console.log("⏰ 自动刷新已启动");
}

/**
 * 停止自动刷新
 */
export function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * 邮箱登录或注册（新接口）
 *
 * 流程:
 * 1. 调用后端 /auth/email/login_or_signup
 * 2. 根据返回的状态处理：
 *    - SIGNED_IN: 直接登录成功，保存tokens
 *    - CONFIRMATION_REQUIRED: 需要验证码确认
 *    - WRONG_PASSWORD: 密码错误
 */
export type EmailLoginResult =
  | { status: "SIGNED_IN"; user: User }
  | { status: "CONFIRMATION_REQUIRED"; email: string }
  | { status: "WRONG_PASSWORD" };

export async function emailLoginOrSignUp(
  email: string,
  password: string,
  name?: string
): Promise<EmailLoginResult> {
  try {
    console.log("📧 开始邮箱登录或注册流程...");

    // 调用后端新接口
    const response = await fetch(`${API_BASE_URL}/auth/email/login_or_signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
        ...(name && { name: name.trim() }), // 如果提供了姓名，则包含在请求中
      }),
    });

    if (!response.ok) {
      let errorMessage = "操作失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `操作失败 (${response.status})`;
      }
      console.error("❌ 邮箱登录或注册失败:", {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 邮箱登录或注册响应:", data);

    // 根据状态处理
    if (data.status === "SIGNED_IN") {
      // 登录成功，保存tokens
      const userInfo = parseJWT(data.idToken);
      const preferredNameFromCognito = userInfo.preferred_username || "";

      const user: User = {
        id: userInfo.sub,
        email: userInfo.email || email,
        name:
          preferredNameFromCognito ||
          userInfo.name ||
          userInfo.email?.split("@")[0] ||
          email.split("@")[0],
        preferredName: preferredNameFromCognito || undefined,
        provider: "username",
        idToken: data.idToken,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      console.log("✅ 登录成功，保存tokens");
      await saveUser(user);

      return { status: "SIGNED_IN", user };
    } else if (data.status === "CONFIRMATION_REQUIRED") {
      // 需要验证码确认
      console.log("📧 需要验证码确认");
      return { status: "CONFIRMATION_REQUIRED", email: email.trim() };
    } else if (data.status === "WRONG_PASSWORD") {
      // 密码错误
      console.log("❌ 密码错误");
      return { status: "WRONG_PASSWORD" };
    } else {
      throw new Error(`未知状态: ${data.status}`);
    }
  } catch (error: any) {
    console.error("❌ 邮箱登录或注册失败:", error);
    throw error;
  }
}

/**
 * 邮箱验证码确认并登录
 *
 * 流程:
 * 1. 调用后端 /auth/email/confirm
 * 2. 获取tokens并保存
 */
export async function emailConfirmAndLogin(
  email: string,
  code: string,
  password: string
): Promise<User> {
  try {
    console.log("📧 开始邮箱验证码确认...");

    const response = await fetch(`${API_BASE_URL}/auth/email/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        code: code.trim(),
        password: password,
      }),
    });

    if (!response.ok) {
      let errorMessage = "确认失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `确认失败 (${response.status})`;
      }
      console.error("❌ 邮箱确认失败:", errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 邮箱确认并登录成功");

    // 解析idToken获取用户信息
    const userInfo = parseJWT(data.idToken);
    const preferredNameFromCognito = userInfo.preferred_username || "";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || email,
      name:
        preferredNameFromCognito ||
        userInfo.name ||
        userInfo.email?.split("@")[0] ||
        email.split("@")[0],
      preferredName: preferredNameFromCognito || undefined,
      provider: "username",
      idToken: data.idToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    console.log("✅ 邮箱确认并登录成功，保存tokens");
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ 邮箱确认失败:", error);
    throw error;
  }
}

/**
 * 用户名密码登录（保留旧接口以兼容）
 *
 * 流程:
 * 1. 调用Cognito的SRP认证流程
 * 2. 获取tokens
 * 3. 保存token和用户信息
 */
export async function signInWithUsernamePassword(
  username: string,
  password: string
): Promise<User> {
  try {
    console.log("🚀 开始用户名密码登录流程...");

    const cognitoDomain = awsConfig.oauth.domain;
    const clientId = awsConfig.userPoolWebClientId;
    const redirectUri = awsConfig.oauth.redirectSignIn;

    // 验证配置
    if (!cognitoDomain || !clientId || !redirectUri) {
      throw new Error("登录配置不完整");
    }

    // 调用后端API进行用户名密码登录
    const response = await fetch(`${API_BASE_URL}/auth/username-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    if (!response.ok) {
      let errorMessage = "登录失败";
      let errorData = null;
      try {
        errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        // 如果无法解析JSON，尝试读取文本
        try {
          const text = await response.text();
          errorMessage = text || `登录失败 (${response.status})`;
        } catch (textError) {
          errorMessage = `登录失败 (${response.status})`;
        }
      }
      console.error("❌ 登录失败:", {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        errorData,
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 登录成功，获取到tokens");

    // 解析idToken获取用户信息
    const userInfo = parseJWT(data.idToken);
    const preferredNameFromCognito = userInfo.preferred_username || "";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || "",
      name:
        preferredNameFromCognito ||
        userInfo.name ||
        userInfo.email?.split("@")[0] ||
        username,
      preferredName: preferredNameFromCognito || undefined,
      provider: "username",
      idToken: data.idToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    console.log("✅ 用户名密码登录成功，保存所有tokens");

    // 保存用户信息
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ 用户名密码登录失败:", error);
    throw error;
  }
}

/**
 * 注册新用户
 *
 * 流程:
 * 1. 调用后端API注册
 * 2. 注册成功后自动登录
 */
export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<User> {
  try {
    console.log("🚀 开始注册流程...");

    // 调用后端API进行注册
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password,
      }),
    });

    if (!response.ok) {
      let errorMessage = "注册失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `注册失败 (${response.status})`;
      }
      console.error("❌ 注册失败:", errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 注册成功");

    // 解析idToken获取用户信息
    const userInfo = parseJWT(data.idToken);
    const preferredNameFromCognito = userInfo.preferred_username || "";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || email,
      name: preferredNameFromCognito || userInfo.name || username,
      preferredName: preferredNameFromCognito || undefined,
      provider: "username",
      idToken: data.idToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    console.log("✅ 注册成功，保存所有tokens");

    // 保存用户信息
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ 注册失败:", error);
    throw error;
  }
}

/**
 * 手机号注册（发送验证码）
 *
 * 流程:
 * 1. 调用后端API发送验证码
 * 2. 返回成功状态
 */
export async function signUpWithPhone(
  phoneNumber: string,
  name?: string
): Promise<void> {
  try {
    console.log("🚀 开始手机号注册流程...");

    // 验证手机号格式
    if (!phoneNumber.startsWith("+")) {
      throw new Error("手机号格式错误，请包含国家代码（如+86）");
    }

    // 调用后端API发送验证码
    const response = await fetch(`${API_BASE_URL}/auth/phone/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        ...(name && { name: name.trim() }), // 如果提供了姓名，则包含在请求中
      }),
    });

    if (!response.ok) {
      let errorMessage = "发送验证码失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `发送验证码失败 (${response.status})`;
      }
      console.error("❌ 发送验证码失败:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("✅ 验证码发送成功");
  } catch (error: any) {
    console.error("❌ 手机号注册失败:", error);
    throw error;
  }
}

/**
 * 验证手机验证码并登录（注册流程）
 *
 * 流程:
 * 1. 调用后端API验证验证码
 * 2. 自动登录并获取tokens
 */
export async function verifyPhoneCode(
  phoneNumber: string,
  verificationCode: string
): Promise<User> {
  try {
    console.log("🚀 开始验证手机验证码...");

    // 调用后端API验证验证码
    const response = await fetch(`${API_BASE_URL}/auth/phone/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        verification_code: verificationCode,
      }),
    });

    if (!response.ok) {
      let errorMessage = "验证失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `验证失败 (${response.status})`;
      }
      console.error("❌ 验证失败:", errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 验证成功，获取到tokens");

    // 解析idToken获取用户信息
    const userInfo = parseJWT(data.idToken);
    const preferredNameFromCognito = userInfo.preferred_username || "";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || "",
      name: preferredNameFromCognito || userInfo.name || phoneNumber,
      preferredName: preferredNameFromCognito || undefined,
      provider: "username",
      idToken: data.idToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    console.log("✅ 手机号注册并登录成功，保存所有tokens");

    // 保存用户信息
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ 验证手机验证码失败:", error);
    throw error;
  }
}

/**
 * 手机号登录（发送验证码）
 *
 * 流程:
 * 1. 调用后端API发送验证码
 * 2. 返回成功状态
 */
export async function loginWithPhone(phoneNumber: string): Promise<void> {
  try {
    console.log("🚀 开始手机号登录流程...");

    // 验证手机号格式
    if (!phoneNumber.startsWith("+")) {
      throw new Error("手机号格式错误，请包含国家代码（如+86）");
    }

    // 调用后端API发送验证码
    const response = await fetch(`${API_BASE_URL}/auth/phone/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
      }),
    });

    if (!response.ok) {
      let errorMessage = "发送验证码失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `发送验证码失败 (${response.status})`;
      }
      console.error("❌ 发送验证码失败:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("✅ 验证码发送成功");
  } catch (error: any) {
    console.error("❌ 手机号登录失败:", error);
    throw error;
  }
}

/**
 * 验证手机验证码并登录（登录流程）
 *
 * 流程:
 * 1. 调用后端API验证验证码并设置密码
 * 2. 自动登录并获取tokens
 */
export async function verifyPhoneLoginCode(
  phoneNumber: string,
  verificationCode: string,
  newPassword: string
): Promise<User> {
  try {
    console.log("🚀 开始验证手机登录验证码...");

    // 验证密码强度
    if (newPassword.length < 8) {
      throw new Error("密码至少需要8个字符");
    }

    // 调用后端API验证验证码并登录
    const response = await fetch(`${API_BASE_URL}/auth/phone/login/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        verification_code: verificationCode,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      let errorMessage = "验证失败";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.error ||
          errorData.message ||
          errorMessage;
      } catch (e) {
        errorMessage = `验证失败 (${response.status})`;
      }
      console.error("❌ 验证失败:", errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("✅ 验证成功，获取到tokens");

    // 解析idToken获取用户信息
    const userInfo = parseJWT(data.idToken);
    const preferredNameFromCognito = userInfo.preferred_username || "";

    const user: User = {
      id: userInfo.sub,
      email: userInfo.email || "",
      name: preferredNameFromCognito || userInfo.name || phoneNumber,
      preferredName: preferredNameFromCognito || undefined,
      provider: "username",
      idToken: data.idToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    console.log("✅ 手机号登录成功，保存所有tokens");

    // 保存用户信息
    await saveUser(user);

    return user;
  } catch (error: any) {
    console.error("❌ 验证手机登录验证码失败:", error);
    throw error;
  }
}
