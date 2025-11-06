/**
 * 国家区号选择器组件
 *
 * 这个组件用于：
 * - 手机号注册/登录时选择国家区号
 * - 显示常用国家/地区的区号列表
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTypography } from "../styles/typography";
import { t, getCurrentLocale } from "../i18n";

/**
 * 国家/地区数据
 */
const COUNTRIES = [
  { code: "+86", name: "中国", nameEn: "China", flag: "🇨🇳" },
  { code: "+1", name: "美国", nameEn: "United States", flag: "🇺🇸" },
  { code: "+44", name: "英国", nameEn: "United Kingdom", flag: "🇬🇧" },
  { code: "+81", name: "日本", nameEn: "Japan", flag: "🇯🇵" },
  { code: "+82", name: "韩国", nameEn: "South Korea", flag: "🇰🇷" },
  { code: "+65", name: "新加坡", nameEn: "Singapore", flag: "🇸🇬" },
  { code: "+852", name: "香港", nameEn: "Hong Kong", flag: "🇭🇰" },
  { code: "+853", name: "澳门", nameEn: "Macau", flag: "🇲🇴" },
  { code: "+886", name: "台湾", nameEn: "Taiwan", flag: "🇹🇼" },
  { code: "+61", name: "澳大利亚", nameEn: "Australia", flag: "🇦🇺" },
  { code: "+64", name: "新西兰", nameEn: "New Zealand", flag: "🇳🇿" },
  { code: "+33", name: "法国", nameEn: "France", flag: "🇫🇷" },
  { code: "+49", name: "德国", nameEn: "Germany", flag: "🇩🇪" },
  { code: "+39", name: "意大利", nameEn: "Italy", flag: "🇮🇹" },
  { code: "+34", name: "西班牙", nameEn: "Spain", flag: "🇪🇸" },
  { code: "+7", name: "俄罗斯", nameEn: "Russia", flag: "🇷🇺" },
  { code: "+91", name: "印度", nameEn: "India", flag: "🇮🇳" },
  { code: "+55", name: "巴西", nameEn: "Brazil", flag: "🇧🇷" },
];

interface CountryCodePickerProps {
  value: string; // 当前选中的区号，如 "+86"
  onSelect: (code: string) => void;
  disabled?: boolean;
}

export default function CountryCodePicker({
  value,
  onSelect,
  disabled = false,
}: CountryCodePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 动画值（底部滑入）
  const slideAnim = useRef(new Animated.Value(300)).current;

  // 获取 Typography 样式
  const typography = getTypography();

  // 获取当前语言
  const currentLocale = getCurrentLocale();
  const isChinese = currentLocale === "zh";

  // 找到当前选中的国家
  const selectedCountry =
    COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];

  // 过滤国家列表（支持搜索）
  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.name.includes(searchText) ||
      country.nameEn.toLowerCase().includes(searchText.toLowerCase()) ||
      country.code.includes(searchText)
  );

  // Modal 进入/退出动画（从底部滑入）
  useEffect(() => {
    if (modalVisible) {
      // 从底部滑入
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // 滑出到底部
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible]);

  const handleSelect = (code: string) => {
    onSelect(code);
    setModalVisible(false);
    setSearchText("");
  };

  const handleClose = () => {
    setModalVisible(false);
    setSearchText("");
  };

  // 获取国家显示名称（根据系统语言）
  const getCountryName = (country: (typeof COUNTRIES)[0]) => {
    return isChinese ? country.name : country.nameEn;
  };

  return (
    <>
      {/* 选择器按钮 */}
      <TouchableOpacity
        style={[styles.picker, disabled && styles.pickerDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text style={[styles.flag, typography.body]}>
          {selectedCountry.flag}
        </Text>
        <Text style={[styles.code, typography.body]}>
          {selectedCountry.code}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      {/* 选择模态框 - 底部滑入样式 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          {/* 蒙版层 - 无动画，立即显示 */}
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleClose}
          />

          {/* 内容 - 从底部滑入 */}
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* 标题 */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, typography.sectionTitle]}>
                {t("login.selectCountry")}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close-outline" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {/* 搜索框 */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={20}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, typography.body]}
                placeholder={t("login.searchCountry")}
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* 国家列表 */}
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    item.code === value && styles.countryItemSelected,
                  ]}
                  onPress={() => handleSelect(item.code)}
                >
                  <Text style={[styles.countryFlag, typography.body]}>
                    {item.flag}
                  </Text>
                  <Text style={[styles.countryName, typography.body]}>
                    {getCountryName(item)} {item.code}
                  </Text>
                  {item.code === value && (
                    <Ionicons name="checkmark" size={20} color="#E56C45" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.countryList}
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FCF0D6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 90,
    gap: 6,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  flag: {
    fontSize: 18,
  },
  code: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingTop: 20,
    paddingBottom: 34, // Safe area bottom
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FCF0D6",
  },
  modalTitle: {
    fontSize: 18,
    color: "#1a1a1a",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
  },
  countryList: {
    maxHeight: 480,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FCF0D6",
  },
  countryItemSelected: {
    backgroundColor: "#FAF6ED",
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 10,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: "#332824",
  },
});
