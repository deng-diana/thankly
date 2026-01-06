import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import { getTypography, getFontFamilyForText } from "../styles/typography";
import AvatarDefault from "../assets/icons/avatar-default.svg";
import { getCurrentUser, signOut, type User } from "../services/authService";
import { deleteAccount } from "../services/accountService";

export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const typography = getTypography();
  const [user, setUser] = useState<User | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {});
  }, []);

  const closeDrawer = () => navigation.closeDrawer();

  const handleSupportFeedback = async () => {
    const mailto = "mailto:support@thankly.app";
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert(
          t("error.supportUnavailableTitle"),
          t("error.supportUnavailableMessage")
        );
        return;
      }
      await Linking.openURL(mailto);
    } catch (error) {
      console.error("❌ 打开邮件客户端失败:", error);
      Alert.alert(
        t("error.supportUnavailableTitle"),
        t("error.supportUnavailableMessage")
      );
    }
    closeDrawer();
  };

  const navigateTo = (screen: string) => {
    closeDrawer();
    navigation.navigate("Home", { screen });
  };

  const confirmDeleteAccount = () => {
    if (isDeletingAccount) {
      return;
    }

    Alert.alert(
      t("confirm.deleteAccountTitle"),
      t("confirm.deleteAccountMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("confirm.deleteAccountConfirm"),
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "Welcome" }],
      });
    } catch (error: any) {
      console.error("❌ 删除账号失败:", error);
      Alert.alert(
        t("error.deleteAccountTitle"),
        t("error.deleteAccountFailed")
      );
    } finally {
      setIsDeletingAccount(false);
      closeDrawer();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("登出失败:", error);
    } finally {
      closeDrawer();
    }
  };

  return (
    <DrawerContentScrollView
      {...props} // ✅ 正确传递所有 props (state, descriptors, navigation)
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <AvatarDefault width={34} height={34} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, typography.body]} numberOfLines={1}>
            {user?.name || t("home.anonymousUser")}
          </Text>
          <Text
            style={[styles.userEmail, typography.caption]}
            numberOfLines={1}
          >
            {user?.email || ""}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigateTo("ReminderSettings")}
        accessibilityLabel={t("home.reminderSettings")}
        accessibilityHint={t("accessibility.button.openSettingsHint")}
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.reminderSettings"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.reminderSettings")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={handleSupportFeedback}
        accessibilityLabel={t("home.supportFeedback")}
        accessibilityHint={t("accessibility.button.supportHint")}
        accessibilityRole="button"
      >
        <Ionicons name="mail-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.supportFeedback"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.supportFeedback")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigateTo("PrivacyPolicy")}
        accessibilityLabel={t("home.privacyPolicy")}
        accessibilityHint={t("accessibility.button.privacyHint")}
        accessibilityRole="button"
      >
        <Ionicons name="shield-checkmark-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.privacyPolicy"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.privacyPolicy")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigateTo("TermsOfService")}
        accessibilityLabel={t("home.termsOfService")}
        accessibilityHint={t("accessibility.button.privacyHint")}
        accessibilityRole="button"
      >
        <Ionicons name="document-text-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.termsOfService"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.termsOfService")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.item, isDeletingAccount && styles.itemDisabled]}
        onPress={confirmDeleteAccount}
        disabled={isDeletingAccount}
        accessibilityLabel={t("home.deleteAccount")}
        accessibilityHint={t("accessibility.button.deleteAccountHint")}
        accessibilityRole="button"
        accessibilityState={{ busy: isDeletingAccount }}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        <Text
          style={[
            styles.itemTextDanger,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.deleteAccount"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.deleteAccount")}
        </Text>
        {isDeletingAccount && (
          <ActivityIndicator
            size="small"
            color="#FF3B30"
            style={styles.loading}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={handleSignOut}
        accessibilityLabel={t("home.signOut")}
        accessibilityHint={t("accessibility.button.signOutHint")}
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(t("home.signOut"), "regular"),
            },
          ]}
        >
          {t("home.signOut")}
        </Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80, // ✅ 增加到 84px，确保避开动态岛 // ✅ 调整为20px，与页面其他内容保持一致
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    // marginTop: 40, // 移除额外的 marginTop，因为我们已经用了 padding
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 23,
    backgroundColor: "#F2E9DF",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#1A1A1A",
  },
  userEmail: {
    color: "#8A8077",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#F2E9DF",
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  itemDisabled: {
    opacity: 0.6,
  },
  itemText: {
    color: "#332824",
  },
  itemTextDanger: {
    color: "#FF3B30",
  },
  loading: {
    marginLeft: 8,
  },
});
