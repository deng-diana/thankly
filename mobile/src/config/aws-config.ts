/**
 * AWS Cognito配置
 *
 * 这个文件告诉App:
 * - Cognito在哪里(region和userPoolId)
 * - 用哪个客户端(userPoolWebClientId)
 * - 登录后跳转到哪里(redirectSignIn)
 * - 后端API在哪里(API_BASE_URL)  ← 新增注释
 *
 */

export const API_BASE_URL =
  "https://ae6kqvtgdq5lvbughd4qweo7uq0fgxvf.lambda-url.us-east-1.on.aws/";
const awsConfig = {
  // AWS区域
  region: "us-east-1",

  // Cognito User Pool ID (从后端复制)
  userPoolId: "us-east-1_1DgDNffb0",

  // App Client ID (从后端复制 - 用Public Client的ID)
  userPoolWebClientId: "6e521vvi1g2a1efbf3l70o83k2",

  // Cognito域名
  oauth: {
    domain: "us-east-11dgdnffb0.auth.us-east-1.amazoncognito.com",

    // 登录权限范围
    scope: ["email", "openid", "profile"],

    // 登录成功后跳转的地址
    // 开发时用exp://('exp://127.0.0.1:19000/--/callback'),生产环境用myapp://
    redirectSignIn: "myapp://callback",

    // 登出后跳转的地址
    redirectSignOut: "myapp://signout",

    // 使用Authorization Code + PKCE (最安全)
    responseType: "code",
  },
};

export default awsConfig;
