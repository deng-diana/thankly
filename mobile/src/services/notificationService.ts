import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { PermissionStatus } from "expo-modules-core";
import { Platform } from "react-native";
import { getCurrentLocale } from "../i18n";
import { getCurrentUser } from "./authService";

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
  hour: 20,
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

const ensureNotificationChannel = async () => {
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
      return {
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
  if (status === PermissionStatus.GRANTED || status === "granted") {
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

  const content = {
    title: "thankly",
    body: await buildReminderBody(),
    channelId: "daily-reminder",
    data: {
      screen: "DiaryList",
    },
  };

  const trigger: Notifications.DailyTriggerInput = {
    hour: settings.hour,
    minute: settings.minute,
    repeats: true,
  };

  const existingId = await getScheduledNotificationId();
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger,
  });

  await saveScheduledNotificationId(id);
};

export const applyReminderSettings = async (
  settings: DailyReminderSettings
) => {
  await saveReminderSettings(settings);
  if (settings.enabled) {
    await scheduleDailyReminder(settings);
  } else {
    await cancelDailyReminder();
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
    throw new Error("permission_denied");
  }

  const body = await buildReminderBody();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "thankly",
        body,
        channelId: "daily-reminder",
        data: {
          screen: "DiaryList",
        },
      },
      trigger: { seconds: 1, channelId: "daily-reminder" },
    });
  } catch (error) {
    console.error("Test notification failed:", error);
    throw error;
  }
};
