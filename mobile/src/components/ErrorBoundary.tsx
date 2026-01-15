/**
 * Error Boundary组件
 * 
 * 功能: 捕获React组件错误,防止整个App崩溃
 * 优势: 
 * - 显示友好的错误页面
 * - 自动上报错误到Sentry
 * - 用户可以重新加载
 */
import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state,下次渲染时显示错误UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // ✅ 上报到Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });
    
    console.error('❌ Error Boundary捕获错误:', error);
    console.error('错误堆栈:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😢</Text>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.message}>
            很抱歉,应用遇到了一个问题。
          </Text>
          <Text style={styles.detail}>
            您的内容已自动保存,请放心。
          </Text>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={this.handleReset}
          >
            <Text style={styles.buttonText}>重新加载</Text>
          </TouchableOpacity>
          
          {__DEV__ && this.state.error && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>调试信息:</Text>
              <Text style={styles.debugText}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6ED',
    padding: 20,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  detail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#E56C45',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#E56C45',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    width: '100%',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
