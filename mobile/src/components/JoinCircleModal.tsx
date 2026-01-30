/**
 * Join Circle Modal - 加入圈子弹窗
 * 
 * 用户输入邀请码，验证后加入圈子
 * 支持邀请码格式化显示和限流错误提示
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { getFontFamilyForText } from '../styles/typography';
import {
  joinCircle,
  formatInviteCode,
  validateInviteCodeFormat,
  handleCircleError,
} from '../services/circleService';

const { width, height } = Dimensions.get('window');

interface JoinCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'input' | 'success';

export default function JoinCircleModal({
  visible,
  onClose,
  onSuccess,
}: JoinCircleModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [inviteCode, setInviteCode] = useState('');
  const [circleName, setCircleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formatError, setFormatError] = useState('');

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setStep('input');
        setInviteCode('');
        setCircleName('');
        setLoading(false);
        setFormatError('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  const handleInviteCodeChange = (text: string) => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleanCode = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Limit to 6 characters
    const limitedCode = cleanCode.slice(0, 6);
    
    setInviteCode(limitedCode);
    
    // Clear format error when user types
    if (formatError) {
      setFormatError('');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setFormatError(t('circle.errors.emptyInviteCode'));
      return;
    }

    // Validate format
    if (!validateInviteCodeFormat(inviteCode)) {
      setFormatError(t('circle.errors.invalidCodeFormat'));
      return;
    }

    setLoading(true);
    setFormatError('');

    try {
      const result = await joinCircle(inviteCode);
      setCircleName(result.name);
      setStep('success');
    } catch (error: any) {
      const errorMessage = handleCircleError(error);
      
      // Special handling for 429 rate limit error
      if (error.response?.status === 429 || errorMessage.includes('尝试次数')) {
        Alert.alert(
          t('circle.errors.tooManyAttempts'),
          t('circle.errors.rateLimitHint'),
          [{ text: t('common.ok') }]
        );
      } else {
        setFormatError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onSuccess();
    handleClose();
  };

  const renderInputStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#332824" />
        </TouchableOpacity>
      </View>

      <View style={styles.iconContainer}>
        <Ionicons name="key" size={40} color="#332824" />
      </View>

      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(t('circle.join.title'), 'semibold'),
          },
        ]}
      >
        {t('circle.join.title')}
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(t('circle.join.subtitle'), 'regular'),
          },
        ]}
      >
        {t('circle.join.subtitle')}
      </Text>

      <View style={styles.inputContainer}>
        <Text
          style={[
            styles.inputLabel,
            {
              fontFamily: getFontFamilyForText(t('circle.enterInviteCode'), 'medium'),
            },
          ]}
        >
          {t('circle.enterInviteCode')}
        </Text>
        <TextInput
          style={[
            styles.input,
            formatError && styles.inputError,
            {
              fontFamily: 'Courier',
            },
          ]}
          value={formatInviteCode(inviteCode)}
          onChangeText={handleInviteCodeChange}
          placeholder={t('circle.inviteCodePlaceholder')}
          placeholderTextColor="#B8A49A"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={true}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
        />
        {formatError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#E53935" />
            <Text
              style={[
                styles.errorText,
                {
                  fontFamily: getFontFamilyForText(formatError, 'regular'),
                },
              ]}
            >
              {formatError}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.joinButton,
          (!inviteCode.trim() || loading) && styles.joinButtonDisabled,
        ]}
        onPress={handleJoin}
        disabled={!inviteCode.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.joinButtonText,
              {
                fontFamily: getFontFamilyForText(t('circle.join'), 'medium'),
              },
            ]}
          >
            {t('circle.join')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDone} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#332824" />
        </TouchableOpacity>
      </View>

      <View style={styles.successIconContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
      </View>

      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(t('circle.joinSuccess'), 'semibold'),
          },
        ]}
      >
        {t('circle.joinSuccess')}
      </Text>

      <View style={styles.circleInfoBox}>
        <Ionicons name="people" size={32} color="#332824" />
        <Text
          style={[
            styles.circleNameText,
            {
              fontFamily: getFontFamilyForText(circleName, 'semibold'),
            },
          ]}
        >
          {circleName}
        </Text>
      </View>

      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(t('circle.join.successHint'), 'regular'),
          },
        ]}
      >
        {t('circle.join.successHint')}
      </Text>

      <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
        <Text
          style={[
            styles.doneButtonText,
            {
              fontFamily: getFontFamilyForText(t('common.done'), 'medium'),
            },
          ]}
        >
          {t('common.done')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'input' && renderInputStep()}
            {step === 'success' && renderSuccessStep()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE699',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    color: '#332824',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#80645A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    color: '#332824',
    marginBottom: 8,
  },
  input: {
    height: 56,
    backgroundColor: '#FAF6ED',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    color: '#332824',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1.5,
    borderColor: '#E5D9C8',
  },
  inputError: {
    borderColor: '#E53935',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
  },
  joinButton: {
    height: 56,
    backgroundColor: '#332824',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#B8A49A',
  },
  joinButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  circleInfoBox: {
    backgroundColor: '#FAF6ED',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#E5D9C8',
    gap: 12,
  },
  circleNameText: {
    fontSize: 22,
    color: '#332824',
  },
  doneButton: {
    height: 56,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
