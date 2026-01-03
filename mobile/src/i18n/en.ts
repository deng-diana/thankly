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
    saving: "Saving...",
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
      subtitle: "Please enter your first name or nickname.",
      placeholder: "Name or nickname",
    },
    codeSent: "Code Sent",
    codeSentMessage: "Verification code has been sent to your phone",
    emailCodeSentMessage: "Verification code has been sent to your email",
    emailSendFailed: "Failed to send the verification code. Please try again shortly.",
    verificationFailed:
      "Verification failed. Please double-check the code and try again.",
    resendFailed: "Unable to resend the code right now. Please try again soon.",
    networkSuggestion:
      "The network seems unstable. Please try again or switch to a better connection.",
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
    subtitle: "Anything you’d like to appreciate, or gently share today?",
    myDiary: "My precious moments",
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
    actionSheetTitle: "Options",
    addImageButton: "Add photo diary",
    recordVoiceButton: "Record voice diary",
    writeTextButton: "Write text diary",
    supportFeedback: "Support & Feedback",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    deleteAccount: "Delete Account",
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

  // Image diary
  createImageDiary: {
    title: "Capture This Moment",
    textPlaceholder: "Write the story behind these moments...",
    submitButton: "Done",
    confirmMessage: "Add words or voice to capture how you feel in this moment",
    saveAsIs: "Save as is",
    addContent: "Add content",
    textPreview: "Entered Text",
    selectImage: "Select Photo",
    takePhoto: "Take a Picture",
    selectFromAlbum: "Select from Album",
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
      // ✅ Image + Text specific steps (no voice-related steps)
      uploadImages: "Uploading images...",
      polishText: "Polishing your words...",
      generateTitle: "Finding the right title...",
      generateFeedback: "Writing a note back to you...",
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
    supportUnavailableTitle: "Cannot open mail app",
    supportUnavailableMessage:
      "Please email support@thankly.app from your mail app to contact us.",
    privacyUnavailableTitle: "Cannot open privacy policy",
    privacyUnavailableMessage:
      "Please visit thankly.app/privacy in your browser to review the policy.",
    deleteAccountTitle: "Delete Account",
    deleteAccountFailed:
      "Deletion failed. Please try again or email support@thankly.app.",
  },

  // 成功提示
  success: {
    saved: "✅ Saved successfully",
    deleted: "✅ Entry deleted successfully",
    updated: "Updated successfully",
    copied: "✅ Copied",
    diaryCreated: "✅ Gratitude moment saved",
    accountDeleted: "✅ Account deleted",
  },

  // 确认对话框
  confirm: {
    deleteTitle: "Confirm Delete",
    deleteMessage:
      "Are you sure you want to delete this entry? This action cannot be undone.",
    discardUnsavedTitle: "Discard Unsaved Entry?",
    discardUnsavedMessage: "This action cannot be undone.",
    cancelRecordingTitle: "Cancel Recording",
    cancelRecordingMessage:
      "Are you sure you want to cancel? Your recording will be lost.",
    hint: "Hint",
    timeLimit:
      "Recording is nearing the 10-minute limit\n\nPlease finish soon or save now",
    deleteAccountTitle: "Delete Account",
    deleteAccountMessage:
      "This will permanently delete your account and associated data. This action cannot be undone.",
    deleteAccountConfirm: "Delete",
  },

  support: {
    contactTitle: "Contact Support",
    contactCopied:
      "Your device cannot open a mail app.\n\nThe email address ({email}) has been copied to your clipboard.",
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
    invalidCredentials: "Email or password is incorrect.",
    createAccountTitle: "Create Account",
    createAccountMessage:
      "We couldn't find an account for {email}. Would you like to create one?",
    createAccountConfirm: "Create account",
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
      supportHint: "Double tap to email support@thankly.app",
      privacyHint: "Double tap to open the privacy policy",
      deleteAccountHint: "Double tap to permanently delete your account",
      viewDetailHint: "Double tap to view diary details", // ✅ 新增
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

  privacyPolicyPage: {
    title: "Privacy Policy",
    effectiveDateLabel: "Effective Date",
    effectiveDateValue: "November 5, 2025",
    lastUpdatedLabel: "Last Updated",
    lastUpdatedValue: "November 5, 2025",
    intro: [
      'thankly ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the thankly mobile application (the "App") and related services (collectively, the "Services").',
      "Please read this Privacy Policy carefully. By using the App, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, do not download, register with, or use the App.",
    ],
    sections: [
      {
        heading: "1. Information We Collect",
        subsections: [
          {
            title: "1.1 Information You Provide to Us",
            body: [
              "Account Information:",
              "• Email address",
              "• Phone number (optional, only if you register with phone number)",
              "• Name or nickname",
              "• Profile photo (optional)",
              "Content You Create:",
              "• Voice recordings",
              "• Text entries",
              "• Diary notes and journal content",
              "Third-Party Authentication:",
              "When you sign in using Apple ID or Google Account, we receive basic profile information from these services (see Section 1.2).",
            ],
          },
          {
            title: "1.2 Information from Third Parties",
            body: [
              "Apple Sign In:",
              "• Email address (optional, only if you authorize)",
              "• Name (optional, including given name and family name, provided only on first login)",
              "• Apple user ID (used to create your account)",
              "Google Sign In:",
              "• Email address",
              "• Name",
              "• Profile picture URL (used to display your avatar)",
              "• Google user ID (used to create your account)",
              "AWS Cognito (User Authentication Service):",
              "• User unique ID (Cognito User ID)",
              "• Email address",
              "• Name (the name or nickname you set)",
              "• Phone number (only if you register/log in with phone number)",
              "• Authentication tokens (Access Token, ID Token, Refresh Token) to maintain your login session",
              "AWS S3 (Cloud Storage Service):",
              "• Audio files (your voice diary recordings)",
              "• Purpose: Securely store your voice recordings",
              "OpenAI (AI Service Provider):",
              "• Audio content: When you use voice diary features, audio is sent to OpenAI Whisper for speech-to-text transcription",
              "• Text content: When you create diary entries, text is sent to OpenAI for AI polishing and title generation",
              "• Purpose: Provide voice-to-text transcription, text polishing, and title generation features",
              "• Privacy: We comply with OpenAI's privacy policy",
              "AWS Bedrock (AI Service Provider):",
              "• Text content: When you create diary entries, your content is sent to AWS Bedrock (Claude Sonnet) for AI feedback generation",
              "• Purpose: Provide personalized, warm diary feedback",
              "• Privacy: We comply with AWS privacy policy",
            ],
          },
          {
            title: "1.3 Information Automatically Collected",
            body: [
              "Language and Localization Settings:",
              "• System language settings (Language/Locale)",
              "• Collection method: Obtained through expo-localization SDK",
              "• Purpose: Provide multilingual user experience (Chinese/English)",
              "Network and Server Information:",
              "• IP address: Server logs may automatically record your IP address when you use our services",
              "• Collection method: Automatically recorded through HTTP requests",
              "• Purpose: Used for security protection, abuse prevention, and server logging",
              "We Do Not Collect:",
              "• Device model and type",
              "• Operating system version",
              "• App version number",
              "• Device identifiers (IDFA, Advertising ID, etc.)",
              "• Time zone settings",
              "• Usage data (feature usage frequency, session duration, etc.)",
              "• Error logs and crash reports",
              "• Advertising tracking identifiers",
            ],
          },
        ],
      },
      {
        heading: "2. How We Use Your Information",
        description: "We use the information we collect to:",
        subsections: [
          {
            title: "2.1 Provide and Maintain Services",
            body: [
              "• Create and manage your account",
              "• Store and synchronize your diary entries across devices",
              "• Process voice recordings into text (using AI services)",
              "• Enable cloud backup and restore",
              "• Provide customer support",
            ],
          },
          {
            title: "2.2 Improve and Personalize Services",
            body: ["• Develop new features", "• Personalize your experience"],
          },
          {
            title: "2.3 Communicate with You",
            body: [
              "• Send important updates about the Service",
              "• Respond to your inquiries and requests",
              "• Send security alerts and administrative messages",
            ],
          },
          {
            title: "2.4 Ensure Security and Prevent Fraud",
            body: [
              "• Detect and prevent security incidents",
              "• Monitor and verify account activity",
              "• Enforce our Terms of Service",
            ],
          },
          {
            title: "2.5 Comply with Legal Obligations",
            body: [
              "• Respond to legal requests and court orders",
              "• Comply with applicable laws and regulations",
              "• Protect our rights and property",
            ],
          },
        ],
      },
      {
        heading: "3. How We Share Your Information",
        description:
          "We do not sell your personal information. We may share your information in the following circumstances:",
        subsections: [
          {
            title: "3.1 Service Providers",
            body: [
              "Amazon Web Services (AWS):",
              "• Purpose: Cloud storage and data hosting",
              "• Data shared: All user content and account information",
              "• Data stored in: US East (N. Virginia) us-east-1",
              "• Privacy: AWS complies with SOC 2, ISO 27001, and GDPR",
              "OpenAI:",
              "• Purpose: Voice-to-text transcription, text polishing, and title generation",
              "• Data shared: Voice recordings (temporarily processed, not stored permanently by OpenAI) and text content",
              "• Privacy: Subject to OpenAI's API data usage policy",
              "AWS Bedrock:",
              "• Purpose: AI-powered diary feedback generation",
              "• Data shared: Diary text content",
              "• Privacy: Subject to AWS privacy policy",
            ],
          },
          {
            title: "3.2 Legal Requirements",
            body: [
              "We may disclose your information if required to:",
              "• Comply with legal obligations, court orders, or government requests",
              "• Enforce our Terms of Service",
              "• Protect the rights, property, or safety of thankly, our users, or others",
              "• Detect, prevent, or address fraud or security issues",
            ],
          },
          {
            title: "3.3 Business Transfers",
            body: [
              "In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email and/or a prominent notice in the App before your information becomes subject to a different privacy policy.",
            ],
          },
          {
            title: "3.4 With Your Consent",
            body: [
              "We may share your information for other purposes with your explicit consent.",
            ],
          },
        ],
      },
      {
        heading: "4. Data Security",
        subsections: [
          {
            title: "Security Measures Include:",
            body: [
              "• End-to-end encryption for data transmission (TLS/SSL)",
              "• Encryption at rest for stored data (AES-256)",
              "• Secure cloud infrastructure (AWS with SOC 2 Type II compliance)",
              "• Strict access controls and authentication requirements",
              "• Regular backups and disaster recovery procedures",
            ],
          },
          {
            title: "Important Reminder",
            body: [
              "While we use industry-standard safeguards to protect your information, no method of transmission or storage is completely secure.",
            ],
          },
        ],
      },
      {
        heading: "5. Data Retention",
        description:
          "We retain your personal information for as long as necessary to provide our Services and fulfill the purposes described in this Privacy Policy.",
        subsections: [
          {
            title: "Retention Periods",
            body: [
              "• Account Information: Retained until you delete your account, plus 30 days for backup purposes",
              "• Diary Entries: Retained until you delete them or close your account",
              "• Legal Obligations: Some data may be retained longer if required by law",
            ],
          },
          {
            title: "Account Deletion",
            body: [
              "When you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it by law.",
            ],
          },
          {
            title: "Analytics Disclaimer",
            body: [
              "We do not currently perform user behaviour analytics. If we introduce analytics in the future, we will update this policy accordingly.",
            ],
          },
        ],
      },
      {
        heading: "6. Your Rights and Choices",
        description:
          "We respect your privacy and provide ways for you to control your personal information. Depending on your location, you may have certain rights under local laws.",
        subsections: [
          {
            title: "6.1 All Users",
            body: [
              "Access & Export:",
              "• Request a copy of the personal information we hold about you by emailing support@thankly.app (response within 30 days).",
              "Delete:",
              "• Delete your account and data in the App under Account → Delete Account, or email support@thankly.app.",
              "Marketing & Notifications:",
              "• Unsubscribe from promotional emails via the unsubscribe link.",
              "• Disable push notifications in your device settings.",
            ],
          },
          {
            title: "6.2 California Residents (CCPA)",
            body: [
              "Residents of California have additional rights:",
              "• Know what personal information we collect, use, and disclose",
              "• Request deletion of personal information",
              "• Opt out of the sale of personal information (we do not sell personal data)",
              "• Exercise rights without discrimination",
              "Contact support@thankly.app to exercise these rights.",
            ],
          },
          {
            title:
              "6.3 European Union and United Kingdom Residents (GDPR / UK GDPR)",
            body: [
              "You have the following rights:",
              "• Right of access to your personal data",
              "• Right to correct inaccurate or incomplete data",
              '• Right to erasure ("right to be forgotten")',
              "• Right to restrict processing",
              "• Right to data portability",
              "• Right to object to processing",
              "• Right to withdraw consent at any time",
              "• Right to lodge a complaint with your local data protection authority (UK: Information Commissioner's Office – ico.org.uk)",
              "Legal Bases for Processing:",
              "• Contract – to provide the services you requested",
              "• Consent – for optional features and marketing",
              "• Legitimate Interests – to improve our services and ensure security",
            ],
          },
        ],
      },
      {
        heading: "7. International Data Transfers",
        subsections: [
          {
            title: "Transfer Safeguards",
            body: [
              "Your information may be transferred to and processed in countries outside your residence, including the United States.",
              "We ensure compliance through:",
              "• Standard Contractual Clauses approved by the European Commission",
              "• Adequacy decisions",
              "• Other lawful transfer mechanisms",
            ],
          },
        ],
      },
      {
        heading: "8. Children's Privacy",
        subsections: [
          {
            title: "Usage Guidance",
            body: [
              "thankly is suitable for users of all ages, including younger users who wish to record thoughts or emotions.",
              "Users under 13 (or under 16 in the EEA) should only use the App with parental consent and supervision.",
              "We do not knowingly collect personal information from children without parental consent. Parents can contact support@thankly.app to request review and deletion of such data.",
            ],
          },
        ],
      },
      {
        heading: "9. Third-Party Links and Services",
        subsections: [
          {
            title: "Third-Party Practices",
            body: [
              "The App may contain links to third-party websites or services not owned or controlled by thankly. We are not responsible for their privacy practices and encourage you to review their policies.",
              "When you use Apple Sign-In or Google Sign-In, you are subject to Apple's and Google's respective privacy policies.",
            ],
          },
        ],
      },
      {
        heading: "10. Do Not Track Signals",
        subsections: [
          {
            title: "Current Status",
            body: [
              'We do not currently respond to "Do Not Track" signals from web browsers. You can control tracking through your device settings and App preferences.',
            ],
          },
        ],
      },
      {
        heading: "11. Changes to This Privacy Policy",
        description:
          "We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons.",
        subsections: [
          {
            title: "Notice of Changes",
            body: [
              "• We will post the updated Privacy Policy in the App",
              '• The "Last Updated" date at the top will be revised',
              "• For material changes, we will notify you via email or a prominent in-app notice",
              "• Continued use of the App after changes constitutes acceptance of the updated policy",
            ],
          },
          {
            title: "Recommendation",
            body: [
              "We encourage you to review this Privacy Policy periodically.",
            ],
          },
        ],
      },
      {
        heading: "12. Contact Us",
        subsections: [
          {
            title: "How to Reach Us",
            body: [
              "Email: support@thankly.app",
              "Address:",
              "thankly",
              "Shanghai Youzhuoqu Cultural Innovation Co., Ltd.",
              "Building 4, No. 686 Nanfeng Road, Fengcheng Town, Fengxian District, Shanghai, China 201400",
              "Response Time: We will respond within 3 days.",
            ],
          },
        ],
      },
      {
        heading: "13. Additional Information for Specific Jurisdictions",
        subsections: [
          {
            title: "13.1 California Consumer Privacy Act (CCPA)",
            body: [
              "Categories of Personal Information We Collect:",
              "• Identifiers (name, email, phone)",
              "• Internet or network activity (IP address)",
              "• Audio or electronic information (voice recordings)",
              "Business or Commercial Purpose: As described in Section 2.",
              "Categories of Third Parties: Service providers (cloud hosting, AI processing).",
              "Sale of Personal Information: We do not sell personal information.",
            ],
          },
          {
            title: "13.2 Nevada Residents",
            body: [
              "Nevada residents have the right to opt out of the sale of personal information. We do not sell personal information as defined under Nevada law.",
            ],
          },
        ],
      },
      {
        heading: "14. Accessibility",
        subsections: [
          {
            title: "Our Commitment",
            body: [
              "We are committed to making our Privacy Policy accessible to everyone. If you have difficulty accessing this document, contact support@thankly.app for assistance.",
            ],
          },
        ],
      },
    ],
    closing: [
      "This Privacy Policy is effective as of the date stated at the top and governs your use of the thankly App.",
    ],
    importantNotesTitle: "Important Notes",
    importantNotes: [
      "All third-party services comply with their respective Terms of Service and Privacy Policies.",
      "We do not share your personal information with third parties except to provide features you request (such as voice-to-text or AI processing).",
      "You can manage your personal information through account settings or by deleting your account.",
      "We do not use any advertising tracking identifiers (IDFA, Advertising ID, etc.).",
    ],
  },

  termsOfServicePage: {
    title: "Terms of Service",
    effectiveDateLabel: "Effective Date",
    effectiveDateValue: "November 5, 2025",
    lastUpdatedLabel: "Last Updated",
    lastUpdatedValue: "November 5, 2025",
    applicability: "Applicable Worldwide",
    intro: [
      "Welcome to thankly!",
      'These Terms of Service ("Terms") govern your use of the thankly mobile application (the "App") and related services (collectively, the "Services") provided by Shanghai Youzhuoqu Cultural Innovation Co., Ltd. ("thankly", "we", "us", or "our").',
      "By downloading, accessing, or using the App, you agree to be bound by these Terms. If you do not agree, please discontinue use immediately.",
    ],
    sections: [
      {
        heading: "1. Acceptance of Terms",
        subsections: [
          {
            title: "Eligibility",
            body: [
              "• You confirm that you have read and understood these Terms.",
              "• You agree to comply with these Terms at all times.",
              "• You are at least 13 years old (or 16 in the European Economic Area).",
              "• If you are under 18, you have permission from a parent or legal guardian.",
            ],
          },
        ],
      },
      {
        heading: "2. Description of Service",
        subsections: [
          {
            title: "Core Experience",
            body: [
              "• thankly is a voice-first journaling application.",
              "• You can record voice or text diary entries and store personal reflections.",
              "• AI-powered features provide transcription, text polishing, title generation, and personalized feedback.",
              "• Cloud storage keeps your content in sync across devices.",
              '• Services are provided "as is" and features may change or be discontinued at any time.',
            ],
          },
        ],
      },
      {
        heading: "3. Account Registration and Security",
        subsections: [
          {
            title: "Account Creation",
            body: [
              "• Provide accurate and complete information when registering.",
              "• You may sign up using email, phone number, Apple Sign-In, or Google Sign-In.",
              "• Choose a name or nickname for your account.",
            ],
          },
          {
            title: "Account Security",
            body: [
              "• Safeguard your login credentials and device access.",
              "• You are responsible for all activity under your account.",
              "• Notify us immediately of unauthorized access or security issues.",
              "• We are not liable for losses arising from your failure to protect account information.",
            ],
          },
          {
            title: "Account Termination",
            body: [
              "• You may delete your account any time in the App settings.",
              "• We may suspend or terminate access if you violate these Terms, remain inactive for an extended period, are required by law, or pose a risk to other users or the Services.",
            ],
          },
        ],
      },
      {
        heading: "4. User Content",
        subsections: [
          {
            title: "Ownership",
            body: [
              "• You retain ownership of voice recordings, text entries, diary notes, and reflections you create.",
            ],
          },
          {
            title: "License to thankly",
            body: [
              "• You grant us a limited, non-exclusive license to store and process your content to deliver the Services.",
              "• We may use AI services (OpenAI, AWS Bedrock) to transcribe, polish, and generate feedback.",
              "• We back up content for data protection. The license ends when you delete content or your account.",
            ],
          },
          {
            title: "Content Guidelines",
            body: [
              "• Do not create or share content that is illegal, harmful, threatening, abusive, hateful, or infringes intellectual property.",
              "• Do not upload malware, harmful code, or content that violates laws or regulations.",
            ],
          },
          {
            title: "Monitoring",
            body: [
              "• We do not proactively monitor user content, but we may remove content that violates these Terms if notified.",
            ],
          },
        ],
      },
      {
        heading: "5. AI-Powered Features",
        subsections: [
          {
            title: "AI Processing",
            body: [
              "• Voice recordings may be transcribed via OpenAI Whisper.",
              "• Text may be polished and titles generated using OpenAI.",
              "• Personalized feedback may be produced through AWS Bedrock Claude.",
            ],
          },
          {
            title: "AI Limitations",
            body: [
              "• AI-generated content may not always be accurate or contextually appropriate.",
              "• Do not rely on AI output as professional, medical, or psychological advice.",
              "• Review AI-generated content before acting on it.",
            ],
          },
        ],
      },
      {
        heading: "6. Privacy and Data Protection",
        subsections: [
          {
            title: "Your Privacy",
            body: [
              "• Refer to our Privacy Policy (https://thankly.app/privacy) for details on data collection and usage.",
              "• Diary entries are private and encrypted.",
              "• We do not sell your personal information.",
              "• Request data deletion anytime via support@thankly.app.",
              "• We comply with applicable data protection laws such as GDPR, UK GDPR, and CCPA.",
            ],
          },
        ],
      },
      {
        heading: "7. Fees and Payment",
        subsections: [
          {
            title: "Current Pricing",
            body: [
              "• thankly is currently free to download and use; basic features are provided at no cost.",
            ],
          },
          {
            title: "Future Premium Features",
            body: [
              "• We may introduce paid plans. Clear pricing and notifications will be provided before charges apply.",
              "• Payment and refund terms will be updated when applicable.",
            ],
          },
          {
            title: "Refunds",
            body: [
              "• Because the Services are currently free, refunds do not apply at this time.",
            ],
          },
        ],
      },
      {
        heading: "8. Intellectual Property",
        subsections: [
          {
            title: "Our Rights",
            body: [
              "• thankly owns all rights in the App and Services, including brand, design, code, and materials.",
            ],
          },
          {
            title: "Trademarks",
            body: [
              '• "thankly" and the thankly logo are trademarks of Shanghai Youzhuoqu Cultural Innovation Co., Ltd.',
              "• Do not use our marks without prior written permission.",
            ],
          },
          {
            title: "Restrictions",
            body: [
              "• Do not copy, modify, reverse engineer, sell, rent, or sublicense the App.",
              "• Do not remove copyright notices or build competing products using our Services.",
            ],
          },
        ],
      },
      {
        heading: "9. Third-Party Services",
        subsections: [
          {
            title: "Integrations",
            body: [
              "• Authentication: Apple Sign-In and Google Sign-In.",
              "• Infrastructure: AWS for cloud storage and hosting.",
              "• AI processing: OpenAI and AWS Bedrock.",
            ],
          },
          {
            title: "Third-Party Terms",
            body: [
              "• Your use of those services is subject to their respective terms and privacy policies.",
              "• We are not responsible for their practices or performance.",
            ],
          },
        ],
      },
      {
        heading: "10. Disclaimer of Warranties",
        subsections: [
          {
            title: "No Guarantees",
            body: [
              '• Services are provided "as is" and "as available" without warranties of any kind.',
              "• We do not guarantee accuracy of AI content, uninterrupted availability, absolute security, or suitability for your specific needs.",
            ],
          },
        ],
      },
      {
        heading: "11. Limitation of Liability",
        subsections: [
          {
            title: "Liability Limits",
            body: [
              "• We are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, opportunity, or emotional distress.",
              "• Our total liability is limited to the amount you paid us in the previous 12 months (currently zero).",
              "• Some jurisdictions may not allow certain limitations; where required, liability is limited to the maximum extent permitted by law.",
            ],
          },
        ],
      },
      {
        heading: "12. Indemnification",
        subsections: [
          {
            title: "Your Responsibility",
            body: [
              "• You agree to indemnify and hold harmless thankly and its affiliates from claims arising from your use or misuse of the Services, violation of these Terms, infringement of third-party rights, or content you upload.",
            ],
          },
        ],
      },
      {
        heading: "13. Changes to Terms",
        subsections: [
          {
            title: "Updates",
            body: [
              "• We may update these Terms to reflect changes in services, legal requirements, or business practices.",
              '• We will post updates in the App and revise the "Last Updated" date.',
              "• Material changes will be communicated via email or prominent in-app notice.",
              "• Continued use after changes constitutes acceptance.",
              "• If you disagree, stop using the Services and delete your account.",
            ],
          },
        ],
      },
      {
        heading: "14. Termination",
        subsections: [
          {
            title: "Your Rights",
            body: [
              "• You may delete your account and cease using the Services at any time.",
            ],
          },
          {
            title: "Our Rights",
            body: [
              "• We may suspend or terminate access immediately if you violate these Terms, remain inactive for a prolonged period, we are required by law, or we discontinue the Services.",
            ],
          },
          {
            title: "Effect of Termination",
            body: [
              "• Your right to use the Services ends immediately.",
              "• We delete your data within 30 days in accordance with the Privacy Policy.",
              "• Deleted accounts or data cannot be recovered. Please back up important entries before deletion.",
              "• Provisions that by nature should survive termination will remain in effect.",
            ],
          },
        ],
      },
      {
        heading: "15. Dispute Resolution",
        subsections: [
          {
            title: "Governing Law and Jurisdiction",
            body: [
              "• These Terms are governed by the laws of England and Wales.",
              "• Disputes are subject to the exclusive jurisdiction of the courts of England and Wales.",
            ],
          },
          {
            title: "Informal Resolution",
            body: [
              "• Contact support@thankly.app to attempt informal resolution before filing a claim.",
            ],
          },
          {
            title: "Arbitration",
            body: [
              "• For users outside the United Kingdom, disputes may be resolved through binding arbitration by mutual agreement.",
            ],
          },
        ],
      },
      {
        heading: "16. General Provisions",
        subsections: [
          {
            title: "Entire Agreement",
            body: [
              "• These Terms and the Privacy Policy form the entire agreement between you and thankly.",
            ],
          },
          {
            title: "Severability",
            body: [
              "• If any provision is unenforceable, the remaining provisions remain in effect.",
            ],
          },
          {
            title: "No Waiver",
            body: [
              "• Our failure to enforce any provision is not a waiver of our rights.",
            ],
          },
          {
            title: "Assignment",
            body: [
              "• You may not assign these Terms without our prior written consent. We may assign to successors or affiliates.",
            ],
          },
          {
            title: "Force Majeure",
            body: [
              "• We are not responsible for delays or failures caused by events beyond our reasonable control.",
            ],
          },
          {
            title: "Language",
            body: [
              "• These Terms are provided in English and Chinese. In case of conflict, the English version prevails.",
            ],
          },
        ],
      },
      {
        heading: "17. Contact Us",
        subsections: [
          {
            title: "How to Reach thankly",
            body: [
              "Email: support@thankly.app",
              "Address: thankly (Shanghai Youzhuoqu Cultural Innovation Co., Ltd.), Building 4, No. 686 Nanfeng Road, Fengcheng Town, Fengxian District, Shanghai, China 201400",
              "We respond to inquiries within 3 business days.",
            ],
          },
        ],
      },
      {
        heading: "18. Additional Terms for App Stores",
        subsections: [
          {
            title: "Apple App Store",
            body: [
              "• These Terms are between you and thankly, not Apple.",
              "• Apple has no obligation to maintain or support the App.",
              "• Apple is not responsible for claims relating to the App.",
              "• thankly handles intellectual property claims.",
              "• You agree to comply with Apple's App Store Terms of Service.",
            ],
          },
          {
            title: "Google Play Store",
            body: [
              "• These Terms are between you and thankly, not Google.",
              "• Google has no obligation to provide maintenance or support.",
              "• Google is not responsible for claims related to the App.",
              "• You agree to comply with Google's Play Terms of Service.",
            ],
          },
        ],
      },
      {
        heading: "19. Specific Provisions for Minors",
        subsections: [
          {
            title: "Parental Consent",
            body: [
              "• Users under 18 must have parental or guardian permission.",
              "• Parents or guardians must review and agree to these Terms.",
              "• We may require parental verification before account creation.",
              "• Parents and guardians are responsible for monitoring minors' use of the Services.",
            ],
          },
        ],
      },
      {
        heading: "20. Export Compliance",
        subsections: [
          {
            title: "Compliance",
            body: [
              "• You agree to comply with all applicable export and import laws and regulations.",
              "• Do not use or export the App in violation of any laws.",
            ],
          },
        ],
      },
    ],
    closing: [
      "By using thankly, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.",
    ],
  },
};
