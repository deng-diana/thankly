import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  Linking,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { t } from "../i18n";
import { getTypography, getFontFamilyForText } from "../styles/typography";
import type { RootStackParamList } from "../navigation/AppNavigator";
import PreciousMomentsIcon from "../assets/icons/preciousMomentsIcon.svg";
import {
  applyReminderSettings,
  getReminderSettings,
  requestNotificationPermission,
  type DailyReminderSettings,
} from "../services/notificationService";

const buildDateFromTime = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour);
  date.setMinutes(minute);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

const formatTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export default function ReminderSettingsScreen() {
  const typography = getTypography();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<DailyReminderSettings | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState<Date | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await getReminderSettings();
      setSettings(stored);
    };
    loadSettings();
  }, []);

  const updateSettings = async (next: DailyReminderSettings) => {
    setSettings(next);
    await applyReminderSettings(next);
  };

  const handleToggle = async (value: boolean) => {
    if (!settings) return;
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          t("reminder.permissionTitle"),
          t("reminder.permissionMessage"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("reminder.openSettings"),
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ]
        );
        return;
      }
    }
    await updateSettings({ ...settings, enabled: value });
  };

  const openTimePicker = () => {
    if (!settings) return;
    setTempTime(buildDateFromTime(settings.hour, settings.minute));
    setShowTimePicker(true);
  };

  const applyTime = async (date: Date) => {
    if (!settings) return;
    await updateSettings({
      ...settings,
      hour: date.getHours(),
      minute: date.getMinutes(),
    });
  };

  const handleTimeChange = (_event: any, date?: Date) => {
    if (!date) {
      if (Platform.OS === "android") {
        setShowTimePicker(false);
      }
      return;
    }
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      applyTime(date);
    } else {
      setTempTime(date);
    }
  };

  const handleTimeConfirm = () => {
    if (tempTime) {
      applyTime(tempTime);
    }
    setShowTimePicker(false);
  };

  if (!settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={[styles.labelText, typography.body]}>
            {t("common.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t("common.close")}
          accessibilityHint={t("accessibility.button.closeHint")}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={[styles.title, typography.diaryTitle]}>
          {t("reminder.title")}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="notifications-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.labelText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("reminder.enable"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("reminder.enable")}
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: "#E8E0D8", true: "#E56C45" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={[styles.row, !settings.enabled && styles.rowDisabled]}
          onPress={openTimePicker}
          disabled={!settings.enabled}
        >
          <View style={styles.rowLabel}>
            <Ionicons name="time-outline" size={20} color="#332824" />
            <Text
              style={[
                styles.labelText,
                typography.body,
                {
                  fontFamily: getFontFamilyForText(
                    t("reminder.time"),
                    "regular"
                  ),
                },
              ]}
            >
              {t("reminder.time")}
            </Text>
          </View>
          <View style={styles.timeValue}>
            <Text style={[styles.valueText, typography.body]}>
              {formatTime(settings.hour, settings.minute)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color="#1A1A1A"
              style={styles.timeChevron}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.noteRow}>
          <PreciousMomentsIcon width={14} height={14} />
          <Text style={[styles.noteText, typography.caption]}>
            {t("reminder.note")}
          </Text>
        </View>

      </View>

      {showTimePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={buildDateFromTime(settings.hour, settings.minute)}
          mode="time"
          is24Hour
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <Modal visible={showTimePicker && Platform.OS === "ios"} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleTimeConfirm}
              >
                <Text style={[styles.modalButtonText, typography.body]}>
                  {t("common.done")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={
                  tempTime || buildDateFromTime(settings.hour, settings.minute)
                }
                mode="time"
                display="spinner"
                themeVariant="light"
                onChange={handleTimeChange}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6ED",
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#1A1A1A",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#E9E0D6",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  labelText: {
    color: "#1A1A1A",
  },
  valueText: {
    color: "#1A1A1A",
  },
  timeValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeChevron: {
    marginTop: 2,
  },
  noteText: {
    color: "#8A8077",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  modalButtonText: {
    color: "#E56C45",
  },
  pickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    marginHorizontal: 16,
  },
});
