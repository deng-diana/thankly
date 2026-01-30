/**
 * Create Circle Modal - 创建圈子弹窗
 * 
 * 用户输入圈子名称，创建成功后显示邀请码
 * 支持一键复制邀请码
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
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { t } from '../i18n';
import { getFontFamilyForText } from '../styles/typography';
import { createCircle, handleCircleError } from '../services/circleService';

const { width, height } = Dimensions.get('window');

interface CreateCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'input' | 'success';

export default function CreateCircleModal({
  visible,
  onClose,
  onSuccess,
}: CreateCircleModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setStep('input');
        setCircleName('');
        setInviteCode('');
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  const handleCreate = async () => {
    if (!circleName.trim()) {
      Alert.alert(t('common.error'), t('circle.errors.emptyName'));
      return;
    }

    setLoading(true);

    try {
      const result = await createCircle(circleName.trim());
      setInviteCode(result.inviteCode);
      setStep('success');
    } catch (error: any) {
      const errorMessage = handleCircleError(error);
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    if (Platform.OS === 'android') {
      Alert.alert(t('common.success'), t('circle.codeCopied'));
    } else {
      // iOS uses a simpler feedback
      Alert.alert('', t('circle.codeCopied'), [{ text: t('common.ok') }]);
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
        <Ionicons name="people" size={40} color="#332824" />
      </View>

      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(t('circle.create.title'), 'semibold'),
          },
        ]}
      >
        {t('circle.create.title')}
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(t('circle.create.subtitle'), 'regular'),
          },
        ]}
      >
        {t('circle.create.subtitle')}
      </Text>

      <View style={styles.inputContainer}>
        <Text
          style={[
            styles.inputLabel,
            {
              fontFamily: getFontFamilyForText(t('circle.circleName'), 'medium'),
            },
          ]}
        >
          {t('circle.circleName')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              fontFamily: getFontFamilyForText(circleName || 'placeholder', 'regular'),
            },
          ]}
          value={circleName}
          onChangeText={setCircleName}
          placeholder={t('circle.circleNamePlaceholder')}
          placeholderTextColor="#B8A49A"
          maxLength={20}
          autoFocus={true}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Text
          style={[
            styles.charCount,
            {
              fontFamily: getFontFamilyForText(`${circleName.length}/20`, 'regular'),
            },
          ]}
        >
          {circleName.length}/20
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          (!circleName.trim() || loading) && styles.createButtonDisabled,
        ]}
        onPress={handleCreate}
        disabled={!circleName.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.createButtonText,
              {
                fontFamily: getFontFamilyForText(t('circle.create'), 'medium'),
              },
            ]}
          >
            {t('circle.create')}
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
            fontFamily: getFontFamilyForText(t('circle.createSuccess'), 'semibold'),
          },
        ]}
      >
        {t('circle.createSuccess')}
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(t('circle.shareCodeHint'), 'regular'),
          },
        ]}
      >
        {t('circle.shareCodeHint')}
      </Text>

      <View style={styles.codeContainer}>
        <Text
          style={[
            styles.codeLabel,
            {
              fontFamily: getFontFamilyForText(t('circle.inviteCode'), 'medium'),
            },
          ]}
        >
          {t('circle.inviteCode')}
        </Text>
        <View style={styles.codeBox}>
          <Text
            style={[
              styles.codeText,
              {
                fontFamily: 'Courier',
              },
            ]}
          >
            {inviteCode}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
          <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
          <Text
            style={[
              styles.copyButtonText,
              {
                fontFamily: getFontFamilyForText(t('circle.copyCode'), 'medium'),
              },
            ]}
          >
            {t('circle.copyCode')}
          </Text>
        </TouchableOpacity>
      </View>

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
    fontSize: 16,
    color: '#332824',
    borderWidth: 1.5,
    borderColor: '#E5D9C8',
  },
  charCount: {
    fontSize: 13,
    color: '#B8A49A',
    textAlign: 'right',
    marginTop: 8,
  },
  createButton: {
    height: 56,
    backgroundColor: '#332824',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#B8A49A',
  },
  createButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeContainer: {
    marginBottom: 32,
  },
  codeLabel: {
    fontSize: 16,
    color: '#332824',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: '#FAF6ED',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5D9C8',
  },
  codeText: {
    fontSize: 32,
    color: '#332824',
    letterSpacing: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#332824',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  copyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
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
