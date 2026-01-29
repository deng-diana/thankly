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
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import { getTypography, getFontFamilyForText } from "../styles/typography";
import AvatarDefault from "../assets/icons/avatar-default.svg";
import { getCurrentUser, signOut, type User, hasPreferredName, getPreferredName, updateUserName } from "../services/authService";
import { deleteAccount } from "../services/accountService";
import { navigationRef } from "../navigation/navigationRef";
import NameInputModal from "./NameInputModal"; // ✅ 新增：用户偏好称呼输入
import pkg from "../../package.json";

const VERSION = pkg.version;

export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const typography = getTypography();
  const [user, setUser] = useState<User | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showNameEditModal, setShowNameEditModal] = useState(false); // ✅ 新增：偏好称呼编辑弹窗

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
    closeDrawer(); // 先关闭 drawer
    
    try {
      console.log("🗑️ 开始删除账号...");
      await deleteAccount();
      await signOut();
      console.log("✅ 账号删除成功，导航到 Welcome 页面");
      
      // ✅ 使用 navigationRef 可靠地重置到根导航器的 Welcome 屏幕
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "Welcome" as never }],
        });
      } else {
        // 如果 navigationRef 还没准备好，使用备用方法
        const root = navigation.getParent?.();
        if (root) {
          root.reset({
            index: 0,
            routes: [{ name: "Welcome" as never }],
          });
        } else {
          console.error("❌ 无法找到根导航器，删除账号后导航失败");
        }
      }
    } catch (error: any) {
      console.error("❌ 删除账号失败:", error);
      Alert.alert(
        t("error.deleteAccountTitle"),
        t("error.deleteAccountFailed")
      );
      setIsDeletingAccount(false); // 只有失败时才重置状态
    }
  };

  const handleSignOut = async () => {
    try {
      closeDrawer(); // 先关闭 drawer
      
      console.log("🔄 开始退出登录流程...");
      
      // ✅ 先清除 tokens
      await signOut();
      console.log("✅ Tokens已清除");
      
      // ✅ 使用 CommonActions.reset 确保导航重置正确执行
      console.log("🔄 开始导航重置...");
      
      // 优先使用 navigationRef（最可靠的方法）
      if (navigationRef.isReady()) {
        console.log("✅ 使用 navigationRef.dispatch(CommonActions.reset())");
        try {
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Login" }],
            })
          );
          console.log("✅ navigationRef 导航重置执行成功");
          return; // 成功就返回
        } catch (error) {
          console.error("❌ navigationRef.reset() 失败:", error);
        }
      }
      
      // 备用方法：使用 navigation.getParent() 找到根导航器
      console.log("⚠️ 使用备用方法：navigation.getParent()");
      try {
        // AppDrawerContent 在 Drawer 中，Drawer 的父级是 Root Stack Navigator
        const root = navigation.getParent?.();
        if (root) {
          console.log("✅ 找到根导航器，使用 CommonActions.reset()");
          if (typeof root.dispatch === "function") {
            root.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Login" }],
              })
            );
            console.log("✅ 根导航器 reset() 执行成功");
          } else if (typeof root.reset === "function") {
            // 兼容旧版本 API
            root.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
            console.log("✅ 根导航器 reset() (旧API) 执行成功");
          } else {
            console.error("❌ 根导航器没有 reset 或 dispatch 方法");
          }
        } else {
          console.error("❌ 无法找到根导航器");
        }
      } catch (error) {
        console.error("❌ 备用方法也失败:", error);
      }
      
      console.log("✅ 退出登录流程完成");
    } catch (error) {
      console.error("❌ 登出失败:", error);
      // 即使出错也尝试清除 tokens
      try {
        await signOut();
      } catch (signOutError) {
        console.error("❌ 清除 tokens 失败:", signOutError);
      }
      closeDrawer(); // 确保 drawer 被关闭
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
          <Image 
            source={{ uri: user.picture }} 
            style={styles.avatar}
            onError={(error) => {
              // ✅ 如果头像加载失败，fallback到默认头像
              console.log("⚠️ 头像加载失败，使用默认头像:", error.nativeEvent.error);
              // 通过设置user.picture为undefined来触发重新渲染显示默认头像
              if (user) {
                setUser({ ...user, picture: undefined });
              }
            }}
          />
        ) : (
          <View style={styles.avatar}>
            <AvatarDefault width={40} height={40} />
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

      {/* ✅ 称呼偏好 */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => {
          closeDrawer();
          setShowNameEditModal(true);
        }}
        accessibilityLabel={t("home.namePreference")}
        accessibilityHint={t("accessibility.button.openSettingsHint")}
        accessibilityRole="button"
      >
        <Ionicons name="person-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("home.namePreference"),
                "regular"
              ),
            },
          ]}
        >
          {t("home.namePreference")}
        </Text>
      </TouchableOpacity>

      {/* 亲密圈 */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => {
          closeDrawer();
          // TODO: Navigate to CircleListScreen when created
          // navigation.navigate("Home", { screen: "CircleList" });
          Alert.alert(
            t("circle.myCircles"),
            t("circle.entryHint"),
            [{ text: t("common.ok") }]
          );
        }}
        accessibilityLabel={t("circle.myCircles")}
        accessibilityHint={t("circle.entryHint")}
        accessibilityRole="button"
      >
        <Ionicons name="people-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("circle.myCircles"),
                "regular"
              ),
            },
          ]}
        >
          {t("circle.myCircles")}
        </Text>
      </TouchableOpacity>

      {/* 情绪日历 */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigateTo("MoodCalendar")}
        accessibilityLabel={t("moodCalendar.navTitle")}
        accessibilityHint={t("moodCalendar.emptyPickDate")}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(
                t("moodCalendar.navTitle"),
                "regular"
              ),
            },
          ]}
        >
          {t("moodCalendar.navTitle")}
        </Text>
      </TouchableOpacity>

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

      <View style={styles.item}>
        <Ionicons name="information-circle-outline" size={20} color="#332824" />
        <Text
          style={[
            styles.itemText,
            typography.body,
            {
              fontFamily: getFontFamilyForText(t("home.version"), "regular"),
            },
          ]}
        >
          {t("home.version").replace("{version}", VERSION)}
        </Text>
      </View>

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

      {/* ✅ 偏好称呼编辑Modal（可取消） */}
      <NameInputModal
        visible={showNameEditModal}
        onConfirm={async (name) => {
          try {
            // ✅ 1. 立即关闭弹窗（避免多个弹窗叠加）
            setShowNameEditModal(false);
            
            // ✅ 2. 更新用户偏好称呼
            await updateUserName(name);
            
            // ✅ 3. 刷新用户显示
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            
            // ✅ 4. 关闭 Drawer
            closeDrawer();
            
            // ✅ 5. 使用导航参数触发首页刷新并显示 Toast
            navigation.navigate("Home", {
              screen: "DiaryList",
              params: { 
                refreshGreeting: Date.now(), // 使用时间戳确保每次都触发
                showSuccessToast: t("success.nameUpdated"), // ✅ 传递 Toast 消息
              },
            });
            
            console.log("✅ 用户偏好称呼已更新:", name);
          } catch (error: any) {
            console.error("❌ 更新偏好称呼失败:", error);
            Alert.alert(
              t("error.updateFailed"),
              error.message || t("error.retryMessage")
            );
          }
        }}
        onCancel={() => setShowNameEditModal(false)}
        dismissible={true} // ✅ 从菜单进入，可以取消
      />

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
    width: 40,
    height: 40,
    borderRadius: 20, // 确保是圆的 (40/2)
    backgroundColor: "#F2E9DF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
  versionContainer: {
    marginTop: 'auto', // 推到底部
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  versionText: {
    color: '#8A8077',
    fontSize: 12,
  },
});
