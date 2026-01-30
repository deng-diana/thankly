import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { PermissionStatus } from "expo-modules-core";
import { Platform } from "react-native";
import { getCurrentLocale } from "../i18n";
import { getCurrentUser } from "./authService";
import { apiService } from "./apiService";

const REMINDER_SETTINGS_KEY = "dailyReminderSettings";
const REMINDER_NOTIFICATION_ID_KEY = "dailyReminderNotificationId";
const REMINDER_AUTO_PROMPT_KEY = "dailyReminderAutoPrompted";

export type DailyReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const DEFAULT_SETTINGS: DailyReminderSettings = {
  enabled: false,
  hour: 22,
  minute: 0,
};

export const REMINDER_MESSAGES_ZH = [
  "{name}，今天有没有一个瞬间，值得被记下来？",
  "{name}，今天有没有一件小事，你想说声谢谢？",
  "{name}，今天过得好吗？要不要留下一点感受？",
];

export const REMINDER_MESSAGES_EN = [
  "{name}, any moment today worth keeping?",
  "{name}, was there a small thing you feel grateful for?",
  "{name}, how was your day? Want to leave a note?",
];

const getDisplayName = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    if (!user?.name) return null;
    const firstName = user.name.trim().split(/\s+/)[0];
    if (firstName.length <= 1 || /^[0-9]+$/.test(firstName)) {
      return null;
    }
    return firstName;
  } catch (error) {
    console.warn("Failed to load user name for reminder:", error);
    return null;
  }
};

const pickRandom = (items: string[]) =>
  items[Math.floor(Math.random() * items.length)];

const buildReminderBody = async (): Promise<string> => {
  const locale = getCurrentLocale();
  const isZh = locale === "zh";
  const name = await getDisplayName();
  const messages = isZh ? REMINDER_MESSAGES_ZH : REMINDER_MESSAGES_EN;
  const safeName = name || (isZh ? "你" : "Friend");
  return pickRandom(messages).replace("{name}", safeName);
};

// ✅ 导出函数，允许在 App.tsx 启动时调用
export const ensureNotificationChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("daily-reminder", {
    name: "Daily Reminder",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E56C45",
  });
};

export const getReminderSettings =
  async (): Promise<DailyReminderSettings> => {
    const stored = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    try {
      const parsed = JSON.parse(stored) as DailyReminderSettings;
      const settings = {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : false,
        hour:
          typeof parsed.hour === "number" && parsed.hour >= 0
            ? parsed.hour
            : DEFAULT_SETTINGS.hour,
        minute:
          typeof parsed.minute === "number" && parsed.minute >= 0
            ? parsed.minute
            : DEFAULT_SETTINGS.minute,
      };

      // 💡 自动迁移：如果用户还在使用旧的默认时间 (20:00)，自动升级到新的默认时间 (22:00)
      if (settings.hour === 20 && settings.minute === 0) {
        console.log("🚀 检测到旧版默认提醒时间 (20:00)，正在自动更新为 22:00...");
        settings.hour = 22;
        // 异步保存，不阻塞返回
        saveReminderSettings(settings).catch(err => console.error("Migration failed:", err));
      }

      return settings;
    } catch (error) {
      console.warn("Failed to parse reminder settings:", error);
      return DEFAULT_SETTINGS;
    }
  };

export const saveReminderSettings = async (
  settings: DailyReminderSettings
) => {
  await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
};

const saveScheduledNotificationId = async (id: string | null) => {
  if (!id) {
    await AsyncStorage.removeItem(REMINDER_NOTIFICATION_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(REMINDER_NOTIFICATION_ID_KEY, id);
};

const getScheduledNotificationId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(REMINDER_NOTIFICATION_ID_KEY);
};

const hasGrantedPermission = (
  permissions: Notifications.NotificationPermissionsStatus
) => {
  if (permissions.granted) return true;
  const status = permissions.status;
  // ✅ 处理不同 Expo SDK 版本的兼容性（使用 type assertion 避免 TS 警告）
  if (status === PermissionStatus.GRANTED || (status as any) === "granted") {
    return true;
  }
  if (typeof status === "number" && status === 2) {
    return true;
  }
  const iosStatus = permissions.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL ||
    permissions.ios?.allowsAlert === true ||
    permissions.ios?.allowsDisplayInNotificationCenter === true ||
    permissions.ios?.allowsDisplayOnLockScreen === true ||
    permissions.ios?.allowsSound === true ||
    permissions.ios?.allowsBadge === true
  );
};

export const requestNotificationPermission = async () => {
  const permissions = await Notifications.getPermissionsAsync();
  if (hasGrantedPermission(permissions)) {
    return true;
  }
  const response = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return hasGrantedPermission(response);
};

export const hasNotificationPermission = async () => {
  const permissions = await Notifications.getPermissionsAsync();
  return hasGrantedPermission(permissions);
};

export const markReminderAutoPrompted = async () => {
  await AsyncStorage.setItem(REMINDER_AUTO_PROMPT_KEY, "true");
};

const wasReminderAutoPrompted = async () => {
  const value = await AsyncStorage.getItem(REMINDER_AUTO_PROMPT_KEY);
  return value === "true";
};

export const cancelDailyReminder = async () => {
  const existingId = await getScheduledNotificationId();
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }
  await saveScheduledNotificationId(null);
};

export const scheduleDailyReminder = async (
  settings: DailyReminderSettings
) => {
  await ensureNotificationChannel();

  const content: Notifications.NotificationContentInput = {
    title: "thankly",
    body: await buildReminderBody(),
    data: {
      screen: "DiaryList",
    },
  };

  // ✅ 使用 CalendarTriggerInput 而不是 DailyTriggerInput
  const trigger: Notifications.CalendarTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour: settings.hour,
    minute: settings.minute,
    repeats: true,
  };

  const existingId = await getScheduledNotificationId();
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }

  console.log(`📅 调度每日提醒: ${settings.hour}:${String(settings.minute).padStart(2, '0')}`);
  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger,
  });

  await saveScheduledNotificationId(id);
  console.log(`✅ 每日提醒已调度，通知ID: ${id}`);
};

export const applyReminderSettings = async (
  settings: DailyReminderSettings
) => {
  console.log(`🔔 应用提醒设置: enabled=${settings.enabled}, time=${settings.hour}:${String(settings.minute).padStart(2, '0')}`);
  
  // ✅ 专业方案：在启用通知前验证权限状态
  if (settings.enabled) {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      // ✅ 如果没有权限但尝试启用，自动禁用并保存
      console.warn("⚠️ 尝试启用通知但权限未授予，自动禁用");
      await saveReminderSettings({ ...settings, enabled: false });
      // ✅ 抛出错误，让调用者知道设置失败（用于 UI 状态同步）
      throw new Error("NOTIFICATION_PERMISSION_DENIED");
    }
  }
  
  await saveReminderSettings(settings);
  if (settings.enabled) {
    try {
      await scheduleDailyReminder(settings);
      console.log("✅ 提醒设置应用成功");
    } catch (error) {
      // ✅ 专业错误处理：如果调度失败，自动禁用设置
      console.error("❌ 调度通知失败，自动禁用:", error);
      await saveReminderSettings({ ...settings, enabled: false });
      // ✅ 重新抛出错误，让调用者知道失败
      throw error;
    }
  } else {
    await cancelDailyReminder();
    console.log("✅ 提醒已取消");
  }
};

export const refreshDailyReminderIfEnabled = async () => {
  const settings = await getReminderSettings();
  if (!settings.enabled) return;
  const granted = await hasNotificationPermission();
  if (!granted) return;
  await scheduleDailyReminder(settings);
};

export const maybeAutoEnableReminderOnLaunch = async (
  hasCompletedOnboarding: boolean
) => {
  if (!hasCompletedOnboarding) return;
  const prompted = await wasReminderAutoPrompted();
  const stored = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
  if (prompted || stored) return;
  await markReminderAutoPrompted();
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await applyReminderSettings({ ...DEFAULT_SETTINGS, enabled: true });
};

export const sendTestNotification = async () => {
  await ensureNotificationChannel();
  const granted = await requestNotificationPermission();
  if (!granted) {
    // ✅ 统一错误消息，与其他地方保持一致
    throw new Error("NOTIFICATION_PERMISSION_DENIED");
  }

  const body = await buildReminderBody();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "thankly",
        body,
        data: {
          screen: "DiaryList",
        },
      },
      // ✅ 使用 TimeIntervalTriggerInput
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch (error) {
    console.error("Test notification failed:", error);
    throw error;
  }
};

// ========== Push Token Registration for Circle Notifications ==========

const PUSH_TOKEN_KEY = "circle_push_token";

/**
 * Get Expo push token for circle notifications
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    // Check if device can receive push notifications
    if (!Device.isDevice) {
      console.log("⚠️ Push notifications not supported on simulator");
      return null;
    }

    // Request permission
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.log("⚠️ Push notification permission denied");
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    console.log("✅ Expo push token obtained:", token);
    return token;
  } catch (error) {
    console.error("❌ Failed to get Expo push token:", error);
    return null;
  }
};

/**
 * Register push token with backend for circle notifications
 */
export const registerPushToken = async (): Promise<boolean> => {
  try {
    // Get push token
    const pushToken = await getExpoPushToken();
    if (!pushToken) {
      return false;
    }

    // Check if token already registered
    const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (storedToken === pushToken) {
      console.log("✅ Push token already registered, skipping");
      return true;
    }

    // Get device ID (use expo's unique ID)
    const deviceId = Device.deviceId || Device.osBuildId || 'unknown';

    // Register with backend
    await apiService.post('/notification/register-token', {
      pushToken,
      platform: Platform.OS,
      deviceId,
    });

    // Save token to avoid re-registering
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);

    console.log("✅ Push token registered with backend successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to register push token:", error);
    return false;
  }
};

/**
 * Setup push notification handlers for circle notifications
 */
export const setupCircleNotificationHandlers = () => {
  // Handler when notification is received while app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      
      // Check if it's a circle notification
      if (data?.type === 'diary_shared') {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      }

      // Default behavior for other notifications
      return {
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
};
