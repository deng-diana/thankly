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
    rerecord: "Record Again",
    useTextInput: "Use Text Input",
    show: "Show",
  },

  // Onboarding流程
  onboarding: {
    welcome: {
      title: "Welcome to thankly",
      subtitle: "Your space to pause and capture life's moments",
      privacyNotice:
        "Read our {{privacyPolicy}}. Tap 'Agree & Continue' to accept the {{termsOfService}}.",
      privacyPolicy: "Privacy Policy",
      termsOfService: "Terms of Service",
      agreeButton: "Agree & Continue",
    },
    skip: "Skip",
    guide1: {
      title: "Just speak it out",
      subtitle: "No typing needed — just share what's on your heart",
    },
    guide2: {
      title: "Every moment matters",
      subtitle:
        "Joy, sadness, or ordinary days — they're all part of your story",
    },
    guide3: {
      title: "Start today",
      subtitle: "One minute before bed, capture today's warm moment",
      getStartedButton: "Get Started",
    },
  },

  // 登录页面
  login: {
    title: "Log in or sign up",
    subtitle: "Get started quickly with email",
    emailTab: "Email",
    phoneTab: "Phone",
    emailPlaceholder: "Email address",
    phonePlaceholder: "Phone number",
    passwordPlaceholder: "Password",
    continueButton: "Continue",
    orDivider: "OR",
    appleSignIn: "Sign in with Apple",
    googleSignIn: "Sign in with Google",
    signingIn: "Signing in...",
    termsHint:
      "By signing in, you agree to our Terms of Service and Privacy Policy",
    withOtherAccounts: "With other accounts",
    email: "Email",
    phone: "Phone",
    continue: "Continue",
    continueWithEmail: "Continue with email",
    forgotPassword: "Forgot password?",
    emailLogin: "Email Login",
    phoneLogin: "Phone Login",
    phoneNumber: "Phone Number",
    phoneNumberPlaceholder: "Phone number",
    verificationCode: "Verification Code",
    verificationCodePlaceholder: "Enter verification code",
    sendCode: "Send Code",
    resendCode: "Resend",
    verifyAndLogin: "Verify and Login",
    namePrompt: {
      title: "How would you like to be called?",
      subtitle:
        "Please enter your first name or nickname (we'll use this to greet you on the home page)",
      placeholder: "Name or nickname",
    },
    codeSent: "Code Sent",
    codeSentMessage: "Verification code has been sent to your phone",
    enterPhoneFirst: "Please enter phone number first",
    enterCodeFirst: "Please enter verification code",
    invalidPhoneNumber:
      "Invalid phone number format, please include country code (e.g., +1)",
    codeExpired: "Verification code expired, please request a new one",
    codeMismatch: "Incorrect verification code, please try again",
    switchToEmail: "Switch to Email Login",
    switchToPhone: "Switch to Phone Login",
    countdown: "Resend in {{seconds}}s",
    loginDescription: "Sign in or create a new account",
    selectCountry: "Select Country/Region",
    searchCountry: "Search country or code",
  },

  // 录音相关
  recording: {
    nearLimit: "1 minute left",
    maxReached: "10 minute limit reached",
  },

  // 首页/日记列表
  home: {
    welcome: "Hi {name}",
    subtitle: "This is your gentle space for life's moments",
    myDiary: "Moments I've Kept",
    noDiaries: "Ready to pause and capture your day? Your story begins here",
    refreshing: "Refreshing...",
    signOut: "Sign out",
    copySuccess: "Copied",
    copyFailed: "Copy unavailable right now",
    copyEntry: "Copy Entry",
    copyUnavailable: "Copy feature coming soon ✨",
    imageFeatureTitle: "Photo uploads",
    imageFeatureMessage: "Coming soon 📸",
    anonymousUser: "Friend",
    // Accessibility labels
    profileMenuButton: "Open profile menu",
    diaryOptionsButton: "Diary options",
    addImageButton: "Add photo diary",
    recordVoiceButton: "Record voice diary",
    writeTextButton: "Write text diary",
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
    emptyRecording: {
      title: "No valid content detected",
      message:
        "We didn't hear any speech. Please try speaking your gratitude or use text input instead.",
    },
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

  // 注册页面
  signup: {
    title: "Create Account",
    subtitle: "Sign up to get started",
    email: "Email",
    emailPlaceholder: "Enter email address",
    username: "Username",
    usernamePlaceholder: "Enter username",
    password: "Password",
    passwordPlaceholder: "Enter password (at least 8 characters)",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter password",
    signUp: "Sign Up",
    signingUp: "Signing up...",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign in",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 8 characters",
    invalidEmail: "Invalid email format",
    usernameRequired: "Username is required",
    emailRequired: "Email is required",
    phoneSignUp: "Phone Sign Up",
    phoneSignUpMessage: "Verification code has been sent to your phone",
    phoneAlreadyRegistered:
      "This phone number is already registered, please login directly",
  },

  // 无障碍相关（Accessibility）
  accessibility: {
    // 音频播放器
    audio: {
      playing: "Playing audio, {remaining} remaining of {total}",
      paused: "Audio paused, {total} total duration",
      hint: "Double tap to play or pause audio",
      noAudio: "No audio available",
    },
    // 输入框提示
    input: {
      emailHint: "Enter your email address",
      passwordHint: "Enter your password",
      nameHint: "Enter your name or nickname",
      textHint: "Write your diary entry here",
      codeHint: "Enter the verification code",
    },
    // 按钮提示
    button: {
      recordHint: "Double tap to start recording",
      stopHint: "Double tap to stop recording",
      saveHint: "Double tap to save your diary",
      deleteHint: "Double tap to delete this diary",
      editHint: "Double tap to edit this diary",
      closeHint: "Double tap to close",
      continueHint: "Double tap to continue",
      cancelHint: "Double tap to cancel",
      confirmHint: "Double tap to confirm",
      signOutHint: "Double tap to sign out",
      showPasswordHint: "Double tap to show or hide password",
    },
    // 列表和导航
    list: {
      diaryCard: "Diary entry",
      of: "of",
      cardHint: "Double tap to view diary details",
      emptyList: "No diary entries yet",
    },
    // 状态提示
    status: {
      loading: "Loading",
      processing: "Processing, step {step}",
      saving: "Saving your diary",
      saved: "Diary saved successfully",
      error: "An error occurred",
      recording: "Recording in progress",
      paused: "Recording paused",
    },
    // 错误提示（包含解决方案）
    error: {
      recordingFailed: {
        title: "Recording failed",
        reason: "Microphone permission denied",
        solution: "Please allow microphone access in Settings",
      },
      networkError: {
        title: "Network error",
        reason: "Unable to connect to server",
        solution: "Please check your internet connection and try again",
      },
    },
  },
};
