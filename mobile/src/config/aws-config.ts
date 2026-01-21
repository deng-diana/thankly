/**
 * AWS Cognito配置
 */

// 📱 生产环境URL
const PRODUCTION_URL = "https://api.thankly.app";

// 🔄 环境切换：true = 本地开发，false = 生产环境
const IS_LOCAL_DEV = false;  // ✅ 改为 false 以连接生产环境

// ✅ 将 127.0.0.1 改为你的电脑局域网 IP (192.168.0.94)
// 这样无论是 iOS 模拟器、Android 模拟器还是真机，都能连上后端
export const API_BASE_URL = IS_LOCAL_DEV ? "http://192.168.0.94:8000" : PRODUCTION_URL;

const awsConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_1DgDNffb0",
  userPoolWebClientId: "6e521vvi1g2a1efbf3l70o83k2",
  oauth: {
    domain: "auth.thankly.app",
    scope: ["email", "openid", "profile"],
    redirectSignIn: "myapp://callback",
    redirectSignOut: "myapp://signout",
    responseType: "code",
  },
};

export default awsConfig;
