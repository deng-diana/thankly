/**
 * Circle Onboarding - 亲密圈首次引导
 * 
 * 在用户第一次进入亲密圈功能时显示的引导Modal
 * 包含3个步骤：欢迎 → 创建或加入 → 完成
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { t } from '../i18n';
import { getFontFamilyForText } from '../styles/typography';

const { width, height } = Dimensions.get('window');

interface CircleOnboardingProps {
  visible: boolean;
  onComplete: () => void;
  onCreateCircle: () => void;
  onJoinCircle: () => void;
}

type OnboardingStep = 'welcome' | 'createOrJoin' | 'complete';

export default function CircleOnboarding({
  visible,
  onComplete,
  onCreateCircle,
  onJoinCircle,
}: CircleOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');

  const handleCreateCircle = () => {
    onCreateCircle();
    onComplete();
  };

  const handleJoinCircle = () => {
    onJoinCircle();
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderWelcome = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>👥</Text>
      </View>
      
      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(
              t('circle.onboarding.welcome.title'),
              'medium'
            ),
          },
        ]}
      >
        {t('circle.onboarding.welcome.title')}
      </Text>
      
      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(
              t('circle.onboarding.welcome.subtitle'),
              'regular'
            ),
          },
        ]}
      >
        {t('circle.onboarding.welcome.subtitle')}
      </Text>

      <View style={styles.featuresList}>
        {t('circle.onboarding.welcome.features').map((feature: string, index: number) => (
          <View key={index} style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text
              style={[
                styles.featureText,
                {
                  fontFamily: getFontFamilyForText(feature, 'regular'),
                },
              ]}
            >
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setStep('createOrJoin')}
      >
        <Text
          style={[
            styles.primaryButtonText,
            {
              fontFamily: getFontFamilyForText(
                t('circle.onboarding.welcome.continue'),
                'medium'
              ),
            },
          ]}
        >
          {t('circle.onboarding.welcome.continue')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text
          style={[
            styles.skipButtonText,
            {
              fontFamily: getFontFamilyForText(
                t('common.skip'),
                'regular'
              ),
            },
          ]}
        >
          {t('common.skip')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCreateOrJoin = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🎯</Text>
      </View>
      
      <Text
        style={[
          styles.title,
          {
            fontFamily: getFontFamilyForText(
              t('circle.onboarding.createOrJoin.title'),
              'medium'
            ),
          },
        ]}
      >
        {t('circle.onboarding.createOrJoin.title')}
      </Text>
      
      <Text
        style={[
          styles.subtitle,
          {
            fontFamily: getFontFamilyForText(
              t('circle.onboarding.createOrJoin.subtitle'),
              'regular'
            ),
          },
        ]}
      >
        {t('circle.onboarding.createOrJoin.subtitle')}
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleCreateCircle}
        >
          <View style={styles.optionIconContainer}>
            <Text style={styles.optionIcon}>✨</Text>
          </View>
          <Text
            style={[
              styles.optionTitle,
              {
                fontFamily: getFontFamilyForText(
                  t('circle.onboarding.createOrJoin.createOption'),
                  'medium'
                ),
              },
            ]}
          >
            {t('circle.onboarding.createOrJoin.createOption')}
          </Text>
          <Text
            style={[
              styles.optionHint,
              {
                fontFamily: getFontFamilyForText(
                  t('circle.onboarding.createOrJoin.createHint'),
                  'regular'
                ),
              },
            ]}
          >
            {t('circle.onboarding.createOrJoin.createHint')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleJoinCircle}
        >
          <View style={styles.optionIconContainer}>
            <Text style={styles.optionIcon}>🔑</Text>
          </View>
          <Text
            style={[
              styles.optionTitle,
              {
                fontFamily: getFontFamilyForText(
                  t('circle.onboarding.createOrJoin.joinOption'),
                  'medium'
                ),
              },
            ]}
          >
            {t('circle.onboarding.createOrJoin.joinOption')}
          </Text>
          <Text
            style={[
              styles.optionHint,
              {
                fontFamily: getFontFamilyForText(
                  t('circle.onboarding.createOrJoin.joinHint'),
                  'regular'
                ),
              },
            ]}
          >
            {t('circle.onboarding.createOrJoin.joinHint')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text
          style={[
            styles.skipButtonText,
            {
              fontFamily: getFontFamilyForText(
                t('common.skip'),
                'regular'
              ),
            },
          ]}
        >
          {t('common.skip')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 'welcome' && renderWelcome()}
            {step === 'createOrJoin' && renderCreateOrJoin()}
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
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE699',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    color: '#332824',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#80645A',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresList: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 16,
    color: '#332824',
    marginRight: 12,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: '#332824',
    lineHeight: 24,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#332824',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#80645A',
  },
  optionsContainer: {
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#FAF6ED',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE699',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionIcon: {
    fontSize: 32,
  },
  optionTitle: {
    fontSize: 20,
    color: '#332824',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionHint: {
    fontSize: 14,
    color: '#80645A',
    textAlign: 'center',
    lineHeight: 20,
  },
});
