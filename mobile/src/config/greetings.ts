/**
 * 首页问候语配置 - 多语言
 */

export const greetings = {
    en: {
      firstTime: "Welcome to thankly — your gentle space for gratitude 🤍",
      returning: [
        "Welcome back 🌸 Ready to reflect on today?",
        "Hi there 👋 What made you smile today?",
        "Welcome back — your grateful heart has a home here",
        "Good to see you again 💭 Let's write your story",
      ]
    },
    zh: {
      firstTime: "欢迎来到感恩日记 — 温暖记录每一份感恩 🤍",
      returning: [
        "欢迎回来 🌸 准备好记录今天了吗?",
        "你好呀 👋 今天有什么让你微笑的事?",
        "欢迎回来 — 这里是你感恩的家",
        "又见面了 💭 一起写下你的故事吧",
      ]
    }
  };
  
  /**
   * 获取随机问候语
   */
  export function getRandomGreeting(locale: "en" | "zh" = "en"): string {
    const { returning } = greetings[locale];
    const randomIndex = Math.floor(Math.random() * returning.length);
    return returning[randomIndex];
  }
  
  /**
   * 获取问候语
   */
  export function getGreeting(isFirstTime: boolean, locale: "en" | "zh" = "en"): string {
    return isFirstTime 
      ? greetings[locale].firstTime 
      : getRandomGreeting(locale);
  }