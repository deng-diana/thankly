import React from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { t } from "../i18n";
import { getFontFamilyForText, Typography } from "../styles/typography";
import MicIconOrange from "../assets/icons/micIconOrange.svg";
import PauseIconOrange from "../assets/icons/pauseIconOrange.svg";
import PauseIconWhite from "../assets/icons/pauseIconWhite.svg";
import PlayIconWhite from "../assets/icons/playIconWhite.svg";

type VoiceRecordingPanelProps = {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  nearLimit: boolean;
  waveAnim1: Animated.Value;
  waveAnim2: Animated.Value;
  waveAnim3: Animated.Value;
  pulseAnim: Animated.Value;
  onCancel: () => void;
  onTogglePause: () => void;
  onFinish: () => void;
  showControls?: boolean;
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function VoiceRecordingPanel({
  isRecording,
  isPaused,
  duration,
  nearLimit,
  waveAnim1,
  waveAnim2,
  waveAnim3,
  pulseAnim,
  onCancel,
  onTogglePause,
  onFinish,
  showControls = true,
}: VoiceRecordingPanelProps) {
  return (
    <>
      <View style={styles.recordingAnimationArea}>
        <>
          {isRecording && !isPaused && (
            <>
              <Animated.View
                style={[
                  styles.wave,
                  {
                    transform: [{ scale: waveAnim1 }],
                    opacity: waveAnim1.interpolate({
                      inputRange: [0, 3],
                      outputRange: [0.7, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.wave,
                  {
                    transform: [{ scale: waveAnim2 }],
                    opacity: waveAnim2.interpolate({
                      inputRange: [0, 3],
                      outputRange: [0.7, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.wave,
                  {
                    transform: [{ scale: waveAnim3 }],
                    opacity: waveAnim3.interpolate({
                      inputRange: [0, 3],
                      outputRange: [0.7, 0],
                    }),
                  },
                ]}
              />
            </>
          )}

          <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
            {isPaused ? (
              <PauseIconOrange width={44} height={44} />
            ) : (
              <MicIconOrange width={44} height={44} />
            )}
          </Animated.View>

          <Text
            style={[
              styles.statusText,
              {
                fontFamily: getFontFamilyForText(
                  isPaused ? t("diary.pauseRecording") : nearLimit ? t("recording.nearLimit") : "",
                  "regular"
                ),
              },
            ]}
          >
            {isPaused ? t("diary.pauseRecording") : nearLimit ? t("recording.nearLimit") : ""}
          </Text>

          <View style={styles.timeRow}>
            <Text
              style={[
                styles.durationText,
                { fontFamily: getFontFamilyForText(formatTime(duration), "regular") },
              ]}
            >
              {formatTime(duration)}
            </Text>
            <Text
              style={[
                styles.maxDuration,
                { fontFamily: getFontFamilyForText(" / 10:00", "regular") },
              ]}
            >
              {" / 10:00"}
            </Text>
          </View>
        </>
      </View>

      {showControls ? (
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            accessibilityLabel={t("common.cancel")}
            accessibilityHint={t("accessibility.button.cancelHint")}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.cancelText,
                { fontFamily: getFontFamilyForText(t("common.cancel"), "regular") },
              ]}
            >
              {t("common.cancel")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pauseButton}
            onPress={onTogglePause}
            accessibilityLabel={
              isPaused ? t("createVoiceDiary.resumeRecording") : t("createVoiceDiary.pauseRecording")
            }
            accessibilityHint={
              isPaused ? t("accessibility.button.recordHint") : t("accessibility.button.stopHint")
            }
            accessibilityRole="button"
            accessibilityState={{ selected: !isPaused }}
          >
            {isPaused ? <PlayIconWhite width={32} height={32} /> : <PauseIconWhite width={32} height={32} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.finishButton}
            onPress={onFinish}
            accessibilityLabel={t("common.done")}
            accessibilityHint={t("accessibility.button.continueHint")}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.finishText,
                { fontFamily: getFontFamilyForText(t("common.done"), "semibold") },
              ]}
            >
              {t("common.done")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controlsSpacer} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  recordingAnimationArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    width: "100%",
  },
  wave: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFE8E0",
  },
  iconContainer: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    ...Typography.body,
    color: "#666",
    marginBottom: 8,
    marginTop: 140,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  durationText: {
    ...Typography.sectionTitle,
    color: "#E56C45",
    fontVariant: ["tabular-nums"],
  },
  maxDuration: {
    ...Typography.sectionTitle,
    color: "#999",
    marginTop: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingTop: 20,
    width: "100%",
  },
  controlsSpacer: {
    height: 72,
  },
  cancelButton: {
    padding: 20,
  },
  cancelText: {
    ...Typography.body,
    color: "#E56C45",
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E56C45",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E56C45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButton: {
    padding: 20,
  },
  finishText: {
    ...Typography.body,
    color: "#E56C45",
  },
});
