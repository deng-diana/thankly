/**
 * 🧪 开发测试屏幕
 *
 * 这个屏幕的作用：
 * - 在开发时测试各种功能
 * - 可视化查看API调用结果
 * - 调试问题
 *
 * 专业开发中，这种"开发者工具"屏幕很常见
 * 它不会出现在生产版本中，只在开发时使用
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ← 正确的导入

// 导入我们要测试的服务
import apiService from "../services/apiService";

/**
 * 日志类型
 * 用于区分不同类型的日志消息
 */
type LogType = "info" | "success" | "error";

/**
 * 日志条目接口
 * 定义每条日志的结构
 */
interface LogEntry {
  id: number; // 唯一ID（用于React的key）
  message: string; // 日志内容
  type: LogType; // 日志类型
  timestamp: string; // 时间戳
}

export default function TestScreen() {
  // ==================== 状态管理 ====================

  /**
   * useState Hook - React的状态管理
   *
   * 语法：const [状态变量, 更新函数] = useState(初始值)
   *
   * 每次调用更新函数，组件会重新渲染
   */

  // 日志列表状态
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 测试运行状态
  const [isTesting, setIsTesting] = useState(false);

  // 日志ID计数器（确保每条日志有唯一ID）
  const [logIdCounter, setLogIdCounter] = useState(0);

  // ==================== 辅助函数 ====================

  /**
   * 添加日志
   *
   * @param message - 日志消息
   * @param type - 日志类型（info/success/error）
   */
  const addLog = (message: string, type: LogType = "info") => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now
      .getSeconds()
      .toString()
      .padStart(2, "0")}.${now.getMilliseconds()}`;

    const newLog: LogEntry = {
      id: Date.now() + Math.random(), // ← 确保唯一ID
      message: message || " ", // ← 空字符串改成空格
      type,
      timestamp,
    };

    setLogs((prevLogs) => [newLog, ...prevLogs]);
    setLogIdCounter((prev) => prev + 1);

    console.log(`[${timestamp}] ${message}`);
  };
  /**
   * 清除所有日志f 
   */
  const clearLogs = () => {
    setLogs([]);
    setLogIdCounter(0);
    addLog("日志已清除", "info");
  };

  // ==================== 测试函数 ====================

  /**
   * 测试1：健康检查（不需要认证）
   */
  const testHealthCheck = async () => {
    addLog("开始测试: Health Check", "info");

    try {
      const response = await apiService.get("/health", {
        requireAuth: false, // 不需要登录
      });

      addLog(`Health Check成功: ${JSON.stringify(response)}`, "success");
      return true;
    } catch (error: any) {
      addLog(`Health Check失败: ${error.message}`, "error");
      return false;
    }
  };

  /**
   * 测试2：根路径（不需要认证）
   */
  const testRootEndpoint = async () => {
    addLog("开始测试: Root Endpoint", "info");

    try {
      const response = await apiService.get("/", {
        requireAuth: false,
      });

      addLog(`Root访问成功: ${JSON.stringify(response)}`, "success");
      return true;
    } catch (error: any) {
      addLog(`Root访问失败: ${error.message}`, "error");
      return false;
    }
  };

  /**
   * 测试3：获取日记列表（需要认证）
   */
  const testGetDiaries = async () => {
    addLog("开始测试: Get Diaries (需要登录)", "info");

    try {
      const response = await apiService.get("/diaries");

      addLog(`获取日记成功: ${JSON.stringify(response)}`, "success");
      return true;
    } catch (error: any) {
      addLog(`获取日记失败: ${error.message}`, "error");

      // 如果是认证错误，给出提示
      if (error.message.includes("未登录")) {
        addLog("💡 提示: 请先登录后再测试这个接口", "info");
      }

      return false;
    }
  };

  /**
   * 运行所有测试
   */
  const runAllTests = async () => {
    // 开始测试
    setIsTesting(true);
    clearLogs();

    addLog("🚀 开始运行所有测试...", "info");

    // 测试1：健康检查
    await testHealthCheck();

    // 测试2：根路径
    await testRootEndpoint();

    // 测试3：获取日记（可能失败，如果未登录）
    await testGetDiaries();

    // 测试完成
    addLog("✅ 所有测试完成！", "success");
    setIsTesting(false);
  };

  // ==================== UI渲染 ====================

  /**
   * 根据日志类型返回对应的emoji
   */
  const getLogIcon = (type: LogType): string => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "📝";
      default:
        return "•";
    }
  };

  /**
   * 根据日志类型返回对应的颜色
   */
  const getLogColor = (type: LogType): string => {
    switch (type) {
      case "success":
        return "#10b981"; // 绿色
      case "error":
        return "#ef4444"; // 红色
      case "info":
        return "#3b82f6"; // 蓝色
      default:
        return "#6b7280"; // 灰色
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <Text style={styles.title}>🧪 API测试工具</Text>
        <Text style={styles.subtitle}>开发者调试界面</Text>
      </View>

      {/* 操作按钮区 */}
      <View style={styles.buttonContainer}>
        {/* 运行所有测试按钮 */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            isTesting && styles.disabledButton,
          ]}
          onPress={runAllTests}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🚀 运行所有测试</Text>
          )}
        </TouchableOpacity>

        {/* 单独测试按钮 */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={testHealthCheck}
            disabled={isTesting}
          >
            <Text style={styles.buttonText}>Health Check</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={testGetDiaries}
            disabled={isTesting}
          >
            <Text style={styles.buttonText}>Get Diaries</Text>
          </TouchableOpacity>
        </View>

        {/* 清除日志按钮 */}
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearLogs}
          disabled={isTesting}
        >
          <Text style={styles.buttonText}>🗑️ 清除日志</Text>
        </TouchableOpacity>
      </View>

      {/* 日志显示区 */}
      <View style={styles.logsSection}>
        <Text style={styles.sectionTitle}>📋 测试日志</Text>

        <ScrollView
          style={styles.logsContainer}
          contentContainerStyle={styles.logsContent}
        >
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>暂无日志，点击上方按钮开始测试</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                <Text
                  style={[styles.logIcon, { color: getLogColor(log.type) }]}
                >
                  {getLogIcon(log.type)}
                </Text>
                <Text
                  style={[styles.logMessage, { color: getLogColor(log.type) }]}
                >
                  {log.message}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ==================== 样式定义 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
  },
  secondaryButton: {
    backgroundColor: "#8b5cf6",
    flex: 1,
  },
  dangerButton: {
    backgroundColor: "#ef4444",
  },
  disabledButton: {
    backgroundColor: "#9ca3af",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logsSection: {
    flex: 1,
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  logsContent: {
    padding: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
    padding: 20,
  },
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  logTimestamp: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "monospace",
    minWidth: 60,
  },
  logIcon: {
    fontSize: 14,
  },
  logMessage: {
    flex: 1,
    fontSize: 13,
    fontFamily: "monospace",
  },
});
