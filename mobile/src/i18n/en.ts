/**en.ts
 * English translations
 *
 * 组织原则（Google最佳实践）：
 * 1. 按功能模块分组（login, home, diary等）
 * 2. common存放通用文本（按钮、状态等）
 * 3. 使用驼峰命名（camelCase）
 * 4. 保持层级简单（最多3层）
 */

export default {
  // 通用文本（按钮、操作等）
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    confirm: "Confirm",
    loading: "Loading...",
    retry: "Retry",
    close: "Close",
    done: "Done",
  },

  // 登录页面
  login: {
    title: "Welcome",
    subtitle: "Sign in to continue",
    appleSignIn: "Sign in with Apple",
    googleSignIn: "Sign in with Google",
    signingIn: "Signing in...",
    termsHint:
      "By signing in, you agree to our Terms of Service and Privacy Policy",
  },

  // 首页/日记列表
  home: {
    welcome: "Hello there",
    subtitle:
      "In this gentle space, voice or text preserving what matters to you",
    myDiary: "Moments I've Kept",
    noDiaries: "Nothing here yet",
    noDiariesHint: "Tap below to capture\nyour first warm moment",
    refreshing: "Refreshing...",
    signOut: "Sign out",
    copySuccess: "Copied",
    copyFailed: "Copy unavailable right now",
    copyEntry: "Copy Entry",
    copyUnavailable: "Copy feature coming soon ✨",
    imageFeatureTitle: "Photo uploads",
    imageFeatureMessage: "Coming soon 📸",
    anonymousUser: "Friend",
  },

  // 语音日记创建
  createVoiceDiary: {
    title: "Voice Entry",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    pauseRecording: "Pause",
    resumeRecording: "Resume",
    recording: "Recording",
    recordingInProgress: "Recording...",
    paused: "Paused",
    recognizingVoice: "Recognizing your voice...",
    processing: "Processing...",
    processingAudio: "Processing your voice...",
    cancelRecording: "Cancel Recording",
    playRecording: "Play Recording",
    stopPlayback: "Stop",
    audioPreview: "Audio Preview",
    needMicPermission: "Microphone permission required",
    micPermissionMessage: "Please allow microphone access in Settings",
    recordingTooShort: "Recording too short",
    recordingTooShortMessage: "Please record at least 2 seconds",
    recordingTooLong: "Recording too long",
    recordingTooLongMessage: "Please keep recording under 10 minutes",
    emptyVoiceTitle: "Empty content, please record valid information",
    emptyVoiceMessage:
      "Could not recognize valid voice content.\n\nPlease ensure:\n• Speak loud enough\n• Distance from microphone is appropriate (10-20cm)\n• Avoid background noise\n• Say something meaningful",
    suggestion1: "Speak in complete sentences describing what happened today",
    suggestion2: "Share your thoughts, feelings, or what you're grateful for",
    suggestion3: "Make sure your voice is clear and close to the microphone",
    retryRecording: "Record Again",
    switchToText: "Switch to Text",
  },

  // 文字日记创建
  createTextDiary: {
    title: "Capture This Moment",
    promptTitle: "What would you like to remember?",
    textPlaceholder: "Write it down, let this moment stay...",
    characterCount: "{{count}}/500",
    minCharacters: "Just",
    charactersRequired: "more characters to go",
    polishing: "AI is polishing your words...",
    emptyContent: "Nothing yet",
    emptyContentMessage: "Write a few words first, even just a sentence 💭",
    emptyContentToast: "Nothing yet, write a few words first 💭",
    needMoreChars: "Need at least ",
    moreChars: " more characters",
  },

  // 日记通用（创建后的结果页面）
  diary: {
    voiceEntry: "Voice Entry",
    yourEntry: "Your Entry",
    pauseRecording: "Paused",
    resumeRecording: "Resume Recording",
    startRecording: "Record Again",
    shortRecordingHint:
      "Please share a complete thought and record at least 3 seconds.",
    noVoiceDetected:
      "We couldn't hear anything.\n\nPlease make sure you speak clearly, stay close to the microphone, and share a full sentence.",
    placeholderTitle: "Add a title...",
    placeholderContent: "Write your thoughts...",
    aiFeedbackTitle: "A message for you:",
    youWrote: "What you wrote",
    polishedVersion: "Polished",
    saveAndReturn: "Save to journal",
    saveToJournal: "Save to my journal",
    unsavedChanges: "Unsaved changes",
    unsavedChangesMessage:
      "You have unsaved changes, do you want to save them?",
    dontSave: "Don't Save",
    processingFailed: "Processing failed, please try again",
    saveSuccess: "Saved successfully",
    modificationSaved: "Modifications saved!",
    saveFailed: "Save failed",
    checkNetworkRetry: "Please check network connection and retry",
    savingDiary: "Saving your gratitude...",
    transcriptionFailed: "Failed to transcribe audio",
    cancelRecordingConfirm:
      "Are you sure you want to cancel the current recording?",
    processingSteps: {
      upload: "Uploading your voice...",
      listen: "Listening closely...",
      polish: "Polishing your words...",
      title: "Finding the right title...",
      feedback: "Writing a note back to you...",
    },
  },

  // 日记详情
  detail: {
    title: "Entry Details",
    originalContent: "Original",
    polishedContent: "Polished",
    aiFeedback: "Reflection",
    createdAt: "Created",
    playAudio: "Play Audio",
  },

  // 错误提示
  error: {
    networkError: "Network connection failed",
    serverError: "Server unavailable, please try again later",
    authExpired: "Session expired, please sign in again",
    saveFailed: "Save failed",
    deleteFailed: "Delete failed",
    loadFailed: "Load failed",
    recordingFailed: "Recording failed",
    playbackFailed: "Playback failed",
    permissionDenied: "Permission denied",
    audioPermissionDenied: "Microphone permission denied",
    audioPermissionMessage:
      "Please enable microphone access in Settings to record audio.",
    genericError: "An error occurred",
    retryMessage: "Please try again",
  },

  // 成功提示
  success: {
    saved: "✅ Saved successfully",
    deleted: "✅ Entry deleted successfully",
    updated: "Updated successfully",
    diaryCreated: "✅ Gratitude moment saved",
  },

  // 确认对话框
  confirm: {
    deleteTitle: "Confirm Delete",
    deleteMessage:
      "Are you sure you want to delete this entry? This action cannot be undone.",
    cancelRecordingTitle: "Cancel Recording",
    cancelRecordingMessage:
      "Are you sure you want to cancel? Your recording will be lost.",
    hint: "Hint",
    timeLimit:
      "Recording is nearing the 10-minute limit\n\nPlease finish soon or save now",
  },

  // 日期格式
  dateFormat: {
    month: "", // 英文不需要"月"字
    day: "", // 英文不需要"日"字
  },
};
