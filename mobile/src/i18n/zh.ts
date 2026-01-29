/** zh.ts
 * 中文翻译
 *
 * 翻译原则：
 * 1. 保持与英文key完全一致（结构要一模一样）
 * 2. 译文要自然、符合中文习惯
 * 3. 专业术语保持一致性
 */

export default {
  // 通用文本
  common: {
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    confirm: "确认",
    loading: "加载中...",
    retry: "重试",
    close: "关闭",
    done: "完成",
    rerecord: "重录",
    notice: "提示",
    ok: "好的",
    saving: "保存中...",
    useTextInput: "改用文字输入",
    show: "显示",
  },

  // Onboarding流程
  onboarding: {
    welcome: {
      title: "这里是「感记」",
      subtitle: "为忙碌的生活，轻轻按下暂停键，用声音让珍贵的瞬间留下",
      privacyNotice:
        "阅读我们的{{privacyPolicy}}，点击「同意并继续」即表示接受{{termsOfService}}",
      privacyPolicy: "隐私政策",
      termsOfService: "服务条款",
      agreeButton: "同意并继续",
    },
    skip: "跳过",
    guide1: {
      title: "在这里，记录像说话一样轻松",
      subtitle: "你只要说出来，我们会为你整理成清晰的记录，并配上温柔的标题与回应",
    },
    guide2: {
      title: "图片、语音、文字——随你选",
      subtitle: "拍张照片、留段语音，或写下来。无论哪种方式，都欢迎",
    },
    guide3: {
      title: "你的温柔 AI 小伙伴",
      subtitle: "它能读懂你的情绪，倾听你的感受，并用心回应",
    },
    guide4: {
      title: "每一种情绪，都值得有一个家",
      subtitle: "这里是你的小小港湾——安静、私密，只属于你",
      getStartedButton: "开始我的旅程",
    },
  },

  // 登录页面
  login: {
    title: "登录或注册",
    subtitle: "使用邮箱快速开始",
    emailTab: "邮箱",
    phoneTab: "手机",
    emailPlaceholder: "邮箱地址",
    phonePlaceholder: "手机号",
    passwordPlaceholder: "密码",
    continueButton: "继续",
    orDivider: "或",
    appleSignIn: "使用 Apple 登录",
    googleSignIn: "使用 Google 登录",
    signingIn: "登录中...",
    termsHint: "登录即表示同意我们的服务条款和隐私政策",
    withOtherAccounts: "使用其他账号",
    email: "邮箱",
    phone: "手机号",
    continue: "继续",
    continueWithEmail: "使用邮箱继续",
    forgotPassword: "忘记密码？",
    emailLogin: "邮箱登录",
    phoneLogin: "手机号登录",
    phoneNumber: "手机号",
    phoneNumberPlaceholder: "手机号",
    verificationCode: "查收邮件",
    verificationCodePlaceholder: "请输入验证码",
    sendCode: "发送验证码",
    resendCode: "重新发送",
    verifyAndLogin: "验证",
    namePrompt: {
      title: "我们该怎么称呼你？", // ✅ 更轻松、更自然的表达
      placeholder: "你的名字或昵称",
      helper: "这个名字会用于问候和 AI 回复，你可以随时修改。",
      continue: "确认",
    },
    codeSent: "验证码已发送",
    codeSentMessage: "验证码已发送到您的手机，请查收",
    emailCodeSentMessage: "验证码已发送至",
    emailSendFailed: "验证码发送失败，请稍后重试。",
    verificationFailed: "验证码验证失败，请重新输入。",
    resendFailed: "验证码重新发送失败，请稍后重试。",
    networkSuggestion: "网络似乎不稳定，请稍后再试或切换网络。",
    enterPhoneFirst: "请先输入手机号",
    enterCodeFirst: "请输入验证码",
    invalidPhoneNumber: "手机号格式错误，请包含国家代码（如+86）",
    codeExpired: "验证码已过期，请重新获取",
    codeMismatch: "验证码错误，请重试",
    switchToEmail: "切换到邮箱登录",
    switchToPhone: "切换到手机号登录",
    countdown: "重新发送 ({{seconds}}s)",
    loginDescription: "登录或注册新账号",
    selectCountry: "选择国家/地区",
    searchCountry: "搜索国家或区号",
    invalidCredentials: "邮箱或密码不正确。",
    createAccountTitle: "创建账号",
    createAccountMessage: "未找到 {email} 对应的账号。需要创建新账号吗？",
    createAccountConfirm: "创建账号",
    passwordRequirements: "至少8位，需包含：\n大写字母 · 小写字母 · 数字 · 特殊字符",
    forgotPasswordTitle: "重置密码",
    forgotPasswordSubtitle: "输入邮箱以接收验证码",
    forgotPasswordEmailPlaceholder: "邮箱地址",
    forgotPasswordNewPassword: "新密码",
    forgotPasswordNewPasswordPlaceholder: "输入新密码",
    forgotPasswordCodePlaceholder: "输入验证码",
    forgotPasswordSendCode: "发送验证码",
    forgotPasswordResetButton: "重置密码",
    forgotPasswordCodeSent: "验证码已发送到您的邮箱",
    forgotPasswordSuccess: "密码重置成功",
    forgotPasswordFailed: "密码重置失败",
  },

  // 录音相关
  recording: {
    nearLimit: "还剩 1 分钟",
    maxReached: "已达到 10 分钟上限",
  },

  // 首页/日记列表
  home: {
    welcome: "Hi {name}",
    subtitle: "此刻，有什么想感恩，或想轻轻记下的吗？",
    myDiary: "我的珍贵片刻",
    myDiaryPrefix: "我的",
    myDiarySuffix: "个珍贵片刻",
    noDiaries: "准备好按下暂停键，记录今天了吗？",
    emptySubtitle: "点击下方，留住你的第一个珍贵瞬间",
    refreshing: "刷新中...",
    signOut: "退出登录",
    copySuccess: "已复制",
    copyFailed: "复制功能暂时不可用",
    copyEntry: "复制内容",
    copyUnavailable: "复制功能正在路上 ✨",
    imageFeatureTitle: "照片上传",
    imageFeatureMessage: "即将上线 📸",
    anonymousUser: "朋友",
    // 无障碍标签
    profileMenuButton: "打开个人资料菜单",
    diaryOptionsButton: "日记选项",
    actionSheetTitle: "选项",
    addImageButton: "添加照片日记",
    recordVoiceButton: "录制语音日记",
    writeTextButton: "撰写文字日记",
    supportFeedback: "支持与反馈",
    privacyPolicy: "隐私政策",
    termsOfService: "服务条款",
    reminderSettings: "提醒设置",
    namePreference: "称呼偏好",
    deleteAccount: "删除账号",
    version: "版本 {version}",
    // 吸顶年月 + 月份选择
    stickyYearMonthFormat: "{{year}} 年 · {{month}} 月",
    monthPickerTitle: "选择月份",
    monthPickerEmpty: "暂无日记",
  },

  // 幸福罐
  happinessJar: {
    bannerTitle: "打开你的幸福罐",
    bannerTitleHighlight: "幸福",
    bannerSubtitle: "{{count}} 个瞬间，点亮今天",
    pageTitle: "幸福时刻",
    pageSubtitle: "收集了 {{count}} 个快乐时刻",
    emptyMessage: "还没有幸福时刻",
    headerTitle: "那些让你微笑的瞬间",
    headerDescription: "当你需要一点温暖时，随时回来看看。",
  },

  // 情绪日历
  moodCalendar: {
    navTitle: "情绪日历",
    title: "情绪日历", // ✅ UX优化：更直观的标题
    // ✅ UX优化：删除副标题 "情绪，记录着你的时间"（冗余信息）
    summaryFormat: "{{days}} 天 • {{entries}} 个瞬间", // ✅ UX优化：使用 • 替代 |，使用"瞬间"替代"笔记"
    emptyPickDate: "选择一个日期，查看你的瞬间", // ✅ UX优化：更友好的空状态文案
    prevMonth: "上一月",
    nextMonth: "下一月",
    entriesLabel: "条",
    weekdayMon: "一",
    weekdayTue: "二",
    weekdayWed: "三",
    weekdayThu: "四",
    weekdayFri: "五",
    weekdaySat: "六",
    weekdaySun: "日",
  },

  // 搜索功能
  search: {
    placeholder: "搜索往事",
    searching: "搜索中...",
    noResults: "未找到匹配的日记",
    noResultsTitle: "暂无匹配的日记",
    matchingEntriesPrefix: "",
    matchingEntriesSuffix: " 条相关记录",
    cancel: "取消",
    found: "找到",
    results: "条日记",
  },

  // 语音日记创建
  createVoiceDiary: {
    title: "语音记录",
    startRecording: "开始录音",
    stopRecording: "停止录音",
    pauseRecording: "暂停",
    resumeRecording: "继续",
    recording: "录音中",
    recordingInProgress: "正在录音...",
    paused: "已暂停",
    recognizingVoice: "正在识别你的语音...",
    processing: "处理中...",
    processingAudio: "正在处理你的语音...",
    cancelRecording: "取消录音",
    playRecording: "播放录音",
    stopPlayback: "停止",
    audioPreview: "音频预览",
    needMicPermission: "需要麦克风权限",
    micPermissionMessage: "请在设置中允许访问麦克风",
    recordingTooShort: "录音时间太短",
    recordingTooShortMessage: "请至少录制5秒以上的内容",
    recordingTooLong: "录音时间过长",
    recordingTooLongMessage: "请将录音控制在10分钟以内",
    emptyVoiceTitle: "空内容, 请记录有效的信息",
    emptyVoiceMessage:
      "未能识别到有效的语音内容。\n\n请确保：\n• 说话声音足够大\n• 距离麦克风适中（10-20cm）\n• 避免背景噪音\n• 说一些有意义的内容",
    suggestion1: "说一个完整的句子，描述今天发生的事情",
    suggestion2: "分享你的想法、感受或感恩的事情",
    suggestion3: "确保说话声音清晰，距离麦克风适中",
    retryRecording: "重新录音",
    switchToText: "切换到文字",
  },

  // 文字日记创建
  createTextDiary: {
    title: "文字记录",
    textPlaceholder: "有什么想感激的，或想温柔分享的吗？",
    characterCount: "{{count}}/500",
    minCharacters: "再写",
    charactersRequired: "个字就可以啦",
    polishing: "AI 正在帮你润色...",
    emptyContent: "还没写呢",
    emptyContentMessage: "先写下几个字吧，哪怕只是一句话 💭",
    emptyContentToast: "还没写呢，先写下几个字吧 💭",
    needMoreChars: "至少再写",
    moreChars: "个字",
    maxCharactersHint: "最多可输入 2000 字", // ✅ 新增：最大字数提示
  },

  // 图片日记
  createImageDiary: {
    title: "图片记录",
    textPlaceholder: "为这些瞬间写下你的故事...",
    submitButton: "完成",
    confirmMessage: "要不要用文字或语音，把这一刻的感受说下来？",
    saveAsIs: "直接保存",
    addContent: "添加内容",
    textPreview: "已输入文字",
    selectImage: "添加照片",
    takePhoto: "拍照",
    selectFromAlbum: "从相册选择",
    maxCharactersHint: "最多可输入 2000 字", // ✅ 新增：最大字数提示
  },

  // 日记通用（创建后的结果页面）
  diary: {
    voiceEntry: "语音记录",
    yourEntry: "你的记录",
    pauseRecording: "已暂停",
    resumeRecording: "继续录音",
    startRecording: "重新录音",
    shortRecordingTitle: "内容太短",
    shortRecordingMessage: "请至少录入5秒以上完整的内容，记录更完整的瞬间。",
    noVoiceDetected:
      "没有听到你的声音，或内容过于简单\n\n请确保:\n• 声音清晰\n• 靠近麦克风\n• 说一些完整的句子",
    placeholderTitle: "起个标题...",
    placeholderContent: "写下你的想法...",
    aiFeedbackTitle: "我想对你说:",
    youWrote: "你写的",
    polishedVersion: "润色后",
    saveAndReturn: "保存到日记本",
    saveToJournal: "保存到我的日记",
    unsavedChanges: "未保存的修改",
    unsavedChangesMessage: "您有未保存的修改，是否保存？",
    dontSave: "不保存",
    processingFailed: "处理失败，请重试",
    saveSuccess: "保存成功",
    modificationSaved: "修改已保存！",
    saveFailed: "保存失败",
    checkNetworkRetry: "请检查网络连接后重试",
    savingDiary: "正在保存你的感恩时刻...",
    transcriptionFailed: "音频转文字失败",
    cancelRecordingConfirm: "确定要取消当前录音内容吗？",
    processingSteps: {
      upload: "上传你的声音...",
      listen: "倾听你的话语...",
      polish: "让文字更优美...",
      title: "为你提炼标题...",
      emotion: "读懂你的心情...", // ✅ 新增
      feedback: "写下我的回复...",
      // ✅ 图片+文字场景专用步骤（不包含语音相关）
      uploadImages: "上传图片...",
      polishText: "让文字更优美...",
      generateTitle: "为你提炼标题...",
      generateFeedback: "写下我的回复...",
    },
  },

  // 日记详情
  detail: {
    title: "日记详情",
    originalContent: "原文",
    polishedContent: "润色版",
    aiFeedback: "AI 反馈",
    createdAt: "创建时间",
    playAudio: "播放音频",
    deleteImageConfirm: "要删除这张图片吗?",
    deleteImageTitle: "", // ✅ 空标题，只显示一行确认文案
    imageDeleted: "图片已删除",
  },

  // 错误提示
  error: {
    networkError: "网络连接失败",
    serverError: "服务暂时不可用，请稍后重试",
    authExpired: "登录已过期，请重新登录",
    validationError: "请求参数有误，请重试",
    unknownError: "操作失败，请重试",
    AUDIO_READ_FAILED: "无法读取音频文件",
    forbidden: "没有权限访问",
    notFound: "资源不存在",
    saveFailed: "保存失败",
    deleteFailed: "删除失败",
    loadFailed: "加载失败",
    recordingFailed: "录音失败",
    playbackFailed: "播放失败",
    permissionDenied: "权限被拒绝",
    audioPermissionDenied: "麦克风权限被拒绝",
    audioPermissionMessage: "请在系统设置中允许访问麦克风以录制音频。",
    genericError: "发生错误",
    retryMessage: "请重试",
    // 后端 error code 翻译
    TRANSCRIPTION_SERVICE_UNAVAILABLE: "语音服务暂时不可用，请稍后重试",
    TRANSCRIPTION_NO_RESPONSE: "语音服务未响应，请重试",
    TRANSCRIPTION_UNSUPPORTED_LANGUAGE: "请用中文或英文说话",
    TRANSCRIPTION_CONTENT_TOO_SHORT: "未识别到有效内容，请说清楚一些",
    TRANSCRIPTION_REPETITIVE_CONTENT: "未识别到有效内容，请说清楚一些",
    TRANSCRIPTION_INVALID_FORMAT: "音频格式不支持",
    TRANSCRIPTION_FILE_TOO_LARGE: "音频文件太大，请控制在2分钟内",
    TRANSCRIPTION_FAILED: "语音识别失败，请重试",
    // 分块上传 error codes
    AUTH_REQUIRED: "请先登录",
    CHUNK_SESSION_FAILED: "创建上传会话失败，请重试",
    CHUNK_PRESIGNED_URL_FAILED: "获取上传地址失败，请重试",
    CHUNK_NETWORK_ERROR: "上传过程中网络错误，请检查网络后重试",
    CHUNK_UPLOAD_TIMEOUT: "上传超时，请检查网络后重试",
    CHUNK_UPLOAD_PARTIAL_FAILED: "部分内容上传失败，请重试",
    CHUNK_COMPLETE_FAILED: "上传完成处理失败，请重试",
    CHUNK_MERGE_FAILED: "音频合并失败，请重试",
    CHUNK_UPLOAD_HTTP_ERROR: "上传请求失败，请重试",
    TRANSCRIPTION_SERVICE_UNAVAILABLE: "语音识别服务暂时不可用，请稍后重试",
    TRANSCRIPTION_INVALID_FORMAT: "音频格式无效，请重新录制",
    TRANSCRIPTION_AUDIO_TOO_SHORT: "录音时间过短，请至少录制几秒钟",
    TRANSCRIPTION_FAILED: "语音识别失败，请重试",
    emptyRecording: {
      title: "未检测到有效内容",
      message: "似乎没有听到你的语音。请尝试说出你的感谢，或改用文字输入。",
    },
    supportUnavailableTitle: "无法打开邮件应用",
    supportUnavailableMessage:
      "请使用邮箱手动发送邮件至 support@thankly.app 与我们联系。",
    privacyUnavailableTitle: "无法打开隐私政策",
    privacyUnavailableMessage:
      "请在浏览器访问 thankly.app/privacy 查看隐私政策。",
    deleteAccountTitle: "删除账号",
    deleteAccountFailed: "删除失败，请重试或发送邮件至 support@thankly.app。",
  },

  // 成功提示
  success: {
    saved: "✅ 保存成功",
    deleted: "✅ 日记删除成功",
    updated: "更新成功",
    copied: "✅ 已复制",
    diaryCreated: "✅ 感恩时刻已保存",
    accountDeleted: "✅ 账号已删除",
    nameUpdated: "✅ 名字设定成功", // ✅ 新增：名字更新成功
  },

  // 确认对话框
  confirm: {
    deleteTitle: "确认删除",
    deleteMessage: "您确定要删除这篇日记吗？删除后将无法恢复。",
    discardUnsavedTitle: "放弃未保存的日记？",
    discardUnsavedMessage: "此操作无法撤销。",
    cancelRecordingTitle: "取消录音",
    cancelRecordingMessage: "确定要取消吗？录音内容将丢失。",
    hint: "提示",
    timeLimit: "录音即将到达10分钟上限\n\n建议尽快结束，或现在保存",
    deleteAccountTitle: "删除账号",
    deleteAccountMessage:
      "删除后你的账号及所有数据将被永久移除，此操作无法撤销。",
    deleteAccountConfirm: "删除",
  },

  // 草稿相关
  draft: {
    restoreTitle: "发现未保存的内容",
    restoreMessage: "是否恢复上次未保存的内容？",
    restoreImagesHint: "({{count}}张图片)",
    restoreTextHint: "({{preview}}...)",
    restore: "恢复",
    discard: "放弃",
    unsavedTitle: "尚未保存的内容",
    unsavedMessage: "离开前，是否要将内容保存为草稿？",
    saveDraft: "保存草稿",
    dontSave: "不保存",
    lastSaved: "已自动保存",
    // Recording draft restore
    recordingRestoreTitle: "发现之前的录音",
    recordingRestoreMessage: "你之前的录音已被保存。是否要继续之前的录音？",
    continueRecording: "继续录音",
    startNew: "重新开始",
  },

  support: {
    contactTitle: "联系支持",
    contactCopied:
      "当前设备无法打开邮件应用。\n\n邮箱地址（{email}）已复制到剪贴板。",
  },

  // 日期格式
  dateFormat: {
    month: "月",
    day: "日",
  },

  // 注册页面
  signup: {
    title: "创建账号",
    subtitle: "注册以开始使用",
    email: "邮箱",
    emailPlaceholder: "请输入邮箱地址",
    username: "用户名",
    usernamePlaceholder: "请输入用户名",
    password: "密码",
    passwordPlaceholder: "请输入密码（至少8位）",
    confirmPassword: "确认密码",
    confirmPasswordPlaceholder: "请再次输入密码",
    signUp: "注册",
    signingUp: "注册中...",
    alreadyHaveAccount: "已有账号？",
    signIn: "登录",
    passwordMismatch: "两次输入的密码不一致",
    passwordTooShort: "密码至少需要8个字符",
    invalidEmail: "邮箱格式不正确",
    usernameRequired: "请输入用户名",
    emailRequired: "请输入邮箱",
    phoneSignUp: "手机号注册",
    phoneSignUpMessage: "验证码已发送到您的手机，请查收",
    phoneAlreadyRegistered: "该手机号已注册，请直接登录",
  },

  // 无障碍相关（Accessibility）
  accessibility: {
    // 音频播放器
    audio: {
      playing: "正在播放音频，剩余 {remaining}，总时长 {total}",
      paused: "音频已暂停，总时长 {total}",
      hint: "双击播放或暂停音频",
      noAudio: "无音频可用",
    },
    // 输入框提示
    input: {
      emailHint: "请输入您的邮箱地址",
      passwordHint: "请输入您的密码",
      nameHint: "请输入您的名字或昵称",
      textHint: "在这里写下您的日记内容",
      codeHint: "请输入验证码",
    },
    // 按钮提示
    button: {
      recordHint: "双击开始录音",
      stopHint: "双击停止录音",
      saveHint: "双击保存您的日记",
      deleteHint: "双击删除这篇日记",
      editHint: "双击编辑这篇日记",
      closeHint: "双击关闭",
      continueHint: "双击继续",
      cancelHint: "双击取消",
      confirmHint: "双击确认",
      signOutHint: "双击退出登录",
      showPasswordHint: "双击显示或隐藏密码",
      supportHint: "双击发送邮件至 support@thankly.app",
      privacyHint: "双击打开隐私政策页面",
      openSettingsHint: "双击打开提醒设置页面",
      deleteAccountHint: "双击永久删除账号",
      viewDetailHint: "双击查看日记详情", // ✅ 新增
    },
    // 列表和导航
    list: {
      diaryCard: "日记条目",
      of: "共",
      cardHint: "双击查看日记详情",
      emptyList: "还没有日记",
    },
    // 状态提示
    status: {
      loading: "加载中",
      processing: "处理中，步骤 {step}",
      saving: "正在保存您的日记",
      saved: "日记保存成功",
      error: "发生错误",
      recording: "正在录音",
      paused: "录音已暂停",
    },
    // 错误提示（包含解决方案）
    error: {
      recordingFailed: {
        title: "录音失败",
        reason: "麦克风权限被拒绝",
        solution: "请在设置中允许访问麦克风",
      },
      networkError: {
        title: "网络错误",
        reason: "无法连接到服务器",
        solution: "请检查网络连接后重试",
      },
    },
  },

  reminder: {
    title: "每日提醒",
    enable: "开启提醒",
    time: "提醒时间",
    note: "开启提醒，帮你养成温柔的记录习惯",
    permissionTitle: "需要通知权限",
    permissionMessage: "请在系统设置中允许通知，以开启每日提醒。",
    openSettings: "去设置",
    onboardingTitle: "开启每日提醒吗？",
    onboardingMessage: "每天一个小提醒，帮你把美好记下来。",
    onboardingAllow: "开启提醒",
    onboardingSkip: "稍后再说",
    testFailedTitle: "测试提醒未发送",
    testFailedMessage: "请稍后重试或用正式包测试通知效果。",
  },

  privacyPolicyPage: {
    title: "隐私政策",
    effectiveDateLabel: "生效日期",
    effectiveDateValue: "2025年11月5日",
    lastUpdatedLabel: "最后更新",
    lastUpdatedValue: "2026年1月11日",
    intro: [
      'thankly（"我们"、"我们的"）致力于保护您的隐私。本隐私政策说明了当您使用 thankly 移动应用程序（"应用"）及相关服务（统称"服务"）时，我们如何收集、使用、披露和保护您的信息。',
      "请仔细阅读本隐私政策。使用本应用即表示您同意按照本政策收集和使用信息。如果您不同意我们的政策和做法，请不要下载、注册或使用本应用。",
    ],
    sections: [
      {
        heading: "1. 我们收集的信息",
        subsections: [
          {
            title: "1.1 您提供给我们的信息",
            body: [
              "账户信息：",
              "• 电子邮箱地址",
              "• 手机号码（可选，仅当您使用手机号注册时）",
              "• 姓名或昵称",
              "• 头像照片（可选）",
              "您创建的内容：",
              "• 语音录音",
              "• 文字条目",
              "• 日记笔记和日志内容",
              "• 照片和图像（从您的照片库或相机上传）",
              "第三方身份验证：",
              "当您使用 Apple ID 或 Google 账户登录时，我们会从这些服务获取基本个人资料信息（详见第 1.2 节）。",
            ],
          },
          {
            title: "1.2 来自第三方的信息",
            body: [
              "Apple 登录：",
              "• 电子邮箱地址（可选，仅在您授权时提供）",
              "• 姓名（可选，包括名字和姓氏，仅在首次登录时提供）",
              "• Apple 用户 ID（用于创建您的账户）",
              "Google 登录：",
              "• 电子邮箱地址",
              "• 姓名",
              "• 头像照片 URL（用于显示您的头像）",
              "• Google 用户 ID（用于创建您的账户）",
              "AWS Cognito（用户认证服务）：",
              "• 用户唯一 ID（Cognito 用户 ID）",
              "• 电子邮箱地址",
              "• 姓名（您设置的姓名或昵称）",
              "• 手机号码（仅当您使用手机号注册/登录时）",
              "• 认证令牌（访问令牌、ID 令牌、刷新令牌），用于维持您的登录状态",
              "AWS S3（云存储服务）：",
              "• 音频文件（您的语音日记录音）",
              "• 图像文件（您添加到日记条目的照片）",
              "• 用途：安全存储您的录音和照片",
              "OpenAI（AI 服务提供商）：",
              "• 音频内容：当您使用语音日记功能时，音频会被发送至 OpenAI Whisper 进行语音转文字",
              "• 文本内容：当您创建日记条目时，文本会被发送至 OpenAI 进行 AI 润色和标题生成",
              "• 用途：提供语音转文字、文本润色和标题生成功能",
              "• 隐私：我们遵守 OpenAI 的隐私政策",
            ],
          },
          {
            title: "1.3 自动收集的信息",
            body: [
              "语言与本地化设置：",
              "• 系统语言设置（语言/区域）",
              "• 收集方式：通过 expo-localization SDK 获取",
              "• 用途：提供中英文多语言体验",
              "网络与服务器信息：",
              "• IP 地址：当您使用我们的服务时，服务器日志可能会自动记录您的 IP 地址",
              "• 收集方式：通过 HTTP 请求自动记录",
              "• 用途：用于安全防护、防止滥用和服务器日志记录",
              "我们不收集：",
              "• 设备型号和类型",
              "• 操作系统版本",
              "• 应用版本号",
              "• 设备标识符（IDFA、Advertising ID 等）",
              "• 时区设置",
              "• 使用数据（功能使用频率、会话时长等）",
              "• 错误日志和崩溃报告",
              "• 广告跟踪标识符",
            ],
          },
          {
            title: "1.4 我们请求的权限",
            body: [
              "为了提供服务，我们可能会请求以下权限：",
              "相机权限：",
              "• 用途：允许您直接为日记拍摄照片",
              "• 可选：您可以拒绝并继续使用语音/文字功能",
              "相册权限：",
              "• 用途：允许您为日记选择现有的照片",
              "• 可选：您可以拒绝并继续使用语音/文字功能",
              "通知权限：",
              "• 用途：向您发送每日提醒，记录您的片刻",
              "• 可选：您可以随时在设置中关闭通知",
            ],
          },
        ],
      },
      {
        heading: "2. 我们如何使用您的信息",
        description: "我们使用收集的信息用于：",
        subsections: [
          {
            title: "2.1 提供和维护服务",
            body: [
              "• 创建和管理您的账户",
              "• 在设备间存储和同步您的日记条目（文字、语音和照片）",
              "• 使用 AI 处理语音录音以生成标题和内容",
              "• 启用云备份和恢复功能",
              "• 提供客户支持",
            ],
          },
          {
            title: "2.2 改进和个性化服务",
            body: ["• 开发新功能", "• 个性化您的体验"],
          },
          {
            title: "2.3 与您沟通",
            body: [
              "• 发送有关服务的重要更新",
              "• 回复您的询问和请求",
              "• 发送安全警报和管理消息",
            ],
          },
          {
            title: "2.4 确保安全与防止欺诈",
            body: [
              "• 检测和防止安全事件",
              "• 监控和验证账户活动",
              "• 执行我们的服务条款",
            ],
          },
          {
            title: "2.5 遵守法律义务",
            body: [
              "• 响应法律请求和法院命令",
              "• 遵守适用的法律法规",
              "• 保护我们的权利和财产",
            ],
          },
        ],
      },
      {
        heading: "3. 我们如何共享您的信息",
        description:
          "我们不会出售您的个人信息。我们可能在以下情况下共享您的信息：",
        subsections: [
          {
            title: "3.1 服务提供商",
            body: [
              "Amazon Web Services (AWS)：",
              "• 用途：云存储和数据托管",
              "• 共享数据：所有用户内容和账户信息",
              "• 数据存储位置：美国东部（弗吉尼亚北部）us-east-1",
              "• 隐私：AWS 符合 SOC 2、ISO 27001、GDPR",
              "OpenAI：",
              "• 用途：语音转文字、文本润色和标题生成",
              "• 共享数据：语音录音（临时处理，不长期存储）和文本内容",
              "• 隐私：遵循 OpenAI 的 API 数据使用政策",
              "AWS Bedrock：",
              "• 用途：AI 驱动的日记反馈生成",
              "• 共享数据：日记文本内容",
              "• 隐私：遵循 AWS 隐私政策",
            ],
          },
          {
            title: "3.2 法律要求",
            body: [
              "如有需要，我们可能会披露您的信息以：",
              "• 遵守法律义务、法院命令或政府要求",
              "• 执行我们的服务条款",
              "• 保护 thankly、用户或他人的权利、财产或安全",
              "• 检测、防止或处理欺诈或安全问题",
            ],
          },
          {
            title: "3.3 业务转让",
            body: [
              "在合并、收购、重组或资产出售等情况下，您的信息可能会作为交易的一部分被转移。在您的信息受不同隐私政策约束之前，我们会通过电子邮件和/或应用内显著通知告知您。",
            ],
          },
          {
            title: "3.4 经您同意",
            body: [
              "在获得您明确同意的情况下，我们可能出于其他目的共享您的信息。",
            ],
          },
        ],
      },
      {
        heading: "4. 数据安全",
        subsections: [
          {
            title: "安全措施包括：",
            body: [
              "• 数据传输端到端加密（TLS/SSL）",
              "• 存储数据静态加密（AES-256）",
              "• 安全的云基础设施（AWS 通过 SOC 2 Type II 认证）",
              "• 严格的访问控制和身份验证要求",
              "• 定期备份和灾难恢复程序",
            ],
          },
          {
            title: "重要提示",
            body: [
              "尽管我们采取行业标准的安全措施，但任何传输或存储方式都无法保证绝对安全。",
            ],
          },
        ],
      },
      {
        heading: "5. 数据保留",
        description:
          "我们会在提供服务及实现本政策所述目的所必需的时间内保留您的个人信息。",
        subsections: [
          {
            title: "保留期限",
            body: [
              "• 账户信息：在您删除账户后保留 30 天（用于备份）",
              "• 日记条目：保留至您删除或关闭账户",
              "• 法律义务：法律要求的数据可能会保留更长时间",
            ],
          },
          {
            title: "账户删除",
            body: [
              "当您删除账户时，我们会在 30 天内删除或匿名化您的个人信息，除非法律要求继续保留。",
            ],
          },
          {
            title: "分析声明",
            body: [
              "我们目前不执行用户行为分析。如未来引入分析功能，我们会更新本政策。",
            ],
          },
        ],
      },
      {
        heading: "6. 您的权利与选择",
        description:
          "我们尊重您的隐私，并为您提供控制个人信息的方式。根据您的所在地区，您可能享有额外权利。",
        subsections: [
          {
            title: "6.1 所有用户",
            body: [
              "访问与导出：",
              "• 发送邮件至 support@thankly.app 请求我们持有的个人信息副本（通常在 30 天内回复）",
              "删除：",
              "• 在应用内通过 “账户 → 删除账户” 删除数据，或邮件联系 support@thankly.app",
              "营销与通知：",
              "• 点击邮件中的“取消订阅”链接退订营销信息",
              "• 在设备设置中关闭推送通知",
            ],
          },
          {
            title: "6.2 加州居民（CCPA）",
            body: [
              "加州居民享有以下权利：",
              "• 了解我们收集、使用和披露的个人信息",
              "• 请求删除个人信息",
              "• 选择退出个人信息的出售（我们不会出售个人数据）",
              "• 行使权利不会受到歧视",
              "如需行使权利，请联系 support@thankly.app。",
            ],
          },
          {
            title: "6.3 欧盟与英国居民（GDPR / UK GDPR）",
            body: [
              "您享有以下权利：",
              "• 访问您的个人数据",
              "• 更正不准确或不完整的数据",
              "• 删除权（“被遗忘权”）",
              "• 限制处理权",
              "• 数据可携权",
              "• 反对处理权",
              "• 随时撤回同意的权利",
              "• 向当地数据保护机构投诉的权利（英国：ico.org.uk）",
              "处理个人数据的法律依据：",
              "• 合同：提供您请求的服务",
              "• 同意：用于可选功能和营销",
              "• 合法利益：改进服务并确保安全",
            ],
          },
        ],
      },
      {
        heading: "7. 跨境数据传输",
        subsections: [
          {
            title: "传输保障",
            body: [
              "您的信息可能会被传输至您所在国家以外的地区（包括美国）。",
              "我们通过以下方式确保合规：",
              "• 欧盟标准合同条款",
              "• 充分性决定",
              "• 其他合法的传输机制",
            ],
          },
        ],
      },
      {
        heading: "8. 儿童隐私",
        subsections: [
          {
            title: "使用说明",
            body: [
              "thankly 适合所有年龄段的用户，包括希望记录想法的青少年。",
              "如果您未满 13 周岁（欧盟/英国未满 16 周岁），请在父母或监护人同意与监督下使用本应用。",
              "我们不会在未经父母同意的情况下主动收集儿童个人信息。如需协助，请联系 support@thankly.app。",
            ],
          },
        ],
      },
      {
        heading: "9. 第三方链接与服务",
        subsections: [
          {
            title: "第三方隐私实践",
            body: [
              "应用内可能包含第三方网站或服务的链接，这些第三方与 thankly 无关。请务必查看其隐私政策。",
              "当您使用 Apple 登录或 Google 登录时，需遵守相应的隐私政策。",
            ],
          },
        ],
      },
      {
        heading: "10. 请勿跟踪信号",
        subsections: [
          {
            title: "当前状态",
            body: [
              '我们目前不会响应浏览器的 "Do Not Track" 信号。您可以通过设备设置或应用中的选项控制跟踪。',
            ],
          },
        ],
      },
      {
        heading: "11. 本隐私政策的变更",
        description:
          "我们可能会不时更新本政策，以反映业务、法律或监管方面的变化。",
        subsections: [
          {
            title: "变更通知",
            body: [
              "• 我们会在应用中发布更新后的隐私政策",
              "• 顶部的“最后更新”日期将同步修改",
              "• 对于重大变更，我们会通过电子邮件或应用内显著通知告知您",
              "• 在政策更新后继续使用应用即表示接受新的隐私政策",
            ],
          },
          {
            title: "温馨提示",
            body: ["建议您定期查看本隐私政策。"],
          },
        ],
      },
      {
        heading: "12. 联系我们",
        subsections: [
          {
            title: "联系方式",
            body: [
              "电子邮箱：support@thankly.app",
              "通信地址：",
              "thankly",
              "上海有卓趣文化创新有限公司",
              "中国上海市奉贤区奉城镇南奉公路686号4幢 201400",
              "回复时间：我们会在 3 天内回复您的询问。",
            ],
          },
        ],
      },
      {
        heading: "13. 特定司法管辖区补充信息",
        subsections: [
          {
            title: "13.1 加州消费者隐私法（CCPA）",
            body: [
              "我们收集的个人信息类别：",
              "• 标识符（姓名、邮箱、电话）",
              "• 互联网或网络活动信息（IP 地址）",
              "• 音频或电子信息（语音录音）",
              "业务或商业目的：如第 2 节所述",
              "第三方类别：服务提供商（云托管、AI 处理）",
              "个人信息的出售：我们不出售个人信息",
            ],
          },
          {
            title: "13.2 内华达州居民",
            body: [
              "内华达州居民有权选择退出个人信息的出售。我们不会出售内华达州法律定义的个人信息。",
            ],
          },
        ],
      },
      {
        heading: "14. 无障碍访问",
        subsections: [
          {
            title: "我们的承诺",
            body: [
              "我们致力于确保每个人都能访问本隐私政策。如需帮助，请联系 support@thankly.app。",
            ],
          },
        ],
      },
    ],
    closing: ["本隐私政策自上述日期起生效，并适用于您对 thankly 应用的使用。"],
    importantNotesTitle: "重要说明",
    importantNotes: [
      "所有第三方服务均遵守各自的服务条款和隐私政策。",
      "除非用于提供您请求的功能（如语音转文字、AI 处理等），我们不会与第三方共享您的个人信息。",
      "您可以通过账户设置或删除账户来管理个人信息。",
      "我们不使用任何广告跟踪标识符（IDFA、Advertising ID 等）。",
    ],
  },

  termsOfServicePage: {
    title: "服务条款",
    effectiveDateLabel: "生效日期",
    effectiveDateValue: "2025年11月5日",
    lastUpdatedLabel: "最后更新",
    lastUpdatedValue: "2026年1月11日",
    applicability: "全球适用",
    intro: [
      "欢迎使用 thankly！",
      '本服务条款（"条款"）规定了您使用由上海有拙趣文化创新有限公司（"thankly"、"我们"）提供的 thankly 移动应用程序（"应用"）及相关服务（统称"服务"）的条件。',
      "下载、访问或使用本应用即表示您同意受本条款约束。如果您不同意，请立即停止使用。",
    ],
    sections: [
      {
        heading: "1. 接受条款",
        subsections: [
          {
            title: "适用对象",
            body: [
              "• 您已阅读并理解本条款。",
              "• 您同意始终遵守本条款。",
              "• 您至少年满 13 周岁（欧洲经济区为 16 周岁）。",
              "• 如未满 18 周岁，您已获得父母或法定监护人的许可。",
            ],
          },
        ],
      },
      {
        heading: "2. 服务说明",
        subsections: [
          {
            title: "核心体验",
            body: [
              "• thankly 是一款语音和图像优先的日记应用。",
              "• 您可以录制语音、文字或上传照片日记，保存个人时刻与感悟。",
              "• AI 功能用于语音转文字、文本润色、标题生成、图像理解和个性化反馈。",
              "• 通过云端存储实现在多设备间同步。",
              '• 服务按 "原样" 提供，功能可能随时更新、修改或停止。',
            ],
          },
        ],
      },
      {
        heading: "3. 账户注册与安全",
        subsections: [
          {
            title: "账户创建",
            body: [
              "• 注册时需提供准确完整的信息。",
              "• 可通过邮箱、手机号、Apple 登录或 Google 登录注册。",
              "• 为账户选择一个姓名或昵称。",
            ],
          },
          {
            title: "账户安全",
            body: [
              "• 妥善保管登录凭证和设备访问权限。",
              "• 您需对账户下的所有活动负责。",
              "• 若出现未经授权的访问，请立即通知我们。",
              "• 因未能保护账户信息造成的损失，我们概不负责。",
            ],
          },
          {
            title: "账户终止",
            body: [
              "• 您可随时在应用设置中删除账户。",
              "• 如违反条款、长期未活跃、法律要求或对他人及服务构成风险，我们可能暂停或终止账户。",
            ],
          },
        ],
      },
      {
        heading: "4. 用户内容",
        subsections: [
          {
            title: "所有权",
            body: [
              "• 您保留在应用中创建的语音录音、文字条目、照片、日记笔记与感悟等内容的所有权。",
            ],
          },
          {
            title: "授予 thankly 的许可",
            body: [
              "• 您授予我们有限的非独占许可，以存储和处理您的内容以提供服务。",
              "• 我们可能使用 AI 服务（OpenAI、AWS Bedrock）进行转录、润色、图像分析与反馈生成。",
              "• 我们会为了数据保护目的备份内容；当您删除内容或账户时该许可终止。",
            ],
          },
          {
            title: "内容规范",
            body: [
              "• 请勿创建或分享违法、有害、辱骂、仇恨或侵权内容。",
              "• 请勿上传恶意软件、病毒或任何违反法律法规的内容。",
            ],
          },
          {
            title: "内容监控",
            body: [
              "• 我们不会主动监控用户内容，如接到举报发现违反条款的内容，保留删除权利。",
            ],
          },
        ],
      },
      {
        heading: "5. AI 驱动功能",
        subsections: [
          {
            title: "AI 处理",
            body: [
              "• 语音录音可能通过 OpenAI Whisper 转写为文字。",
              "• 文本可能通过 OpenAI 进行润色并生成标题。",
              "• 个性化反馈可能由 AWS Bedrock Claude 生成。",
            ],
          },
          {
            title: "AI 局限",
            body: [
              "• AI 生成内容可能存在不准确或上下文不符的情况。",
              "• 请勿将 AI 输出作为专业、医疗或心理建议。",
              "• 在依赖 AI 内容前请自行审阅确认。",
            ],
          },
        ],
      },
      {
        heading: "6. 隐私与数据保护",
        subsections: [
          {
            title: "您的隐私",
            body: [
              "• 请阅读我们的隐私政策（https://thankly.app/zh/privacy），了解数据收集与使用方式。",
              "• 日记内容保持私密并加密存储。",
              "• 我们不会出售您的个人信息。",
              "• 可随时通过 support@thankly.app 请求删除数据。",
              "• 我们遵守 GDPR、UK GDPR、CCPA 等适用的数据保护法律。",
            ],
          },
        ],
      },
      {
        heading: "7. 费用与付款",
        subsections: [
          {
            title: "当前费用",
            body: ["• thankly 目前可免费下载使用，基础功能免费提供。"],
          },
          {
            title: "未来高级功能",
            body: [
              "• 我们可能推出付费功能或订阅计划，届时会提前告知并提供明确的定价信息。",
              "• 与支付和退款相关的条款将同步更新。",
            ],
          },
          {
            title: "退款政策",
            body: ["• 由于目前服务免费，因此暂无退款适用。"],
          },
        ],
      },
      {
        heading: "8. 知识产权",
        subsections: [
          {
            title: "我们的权利",
            body: [
              "• thankly 拥有应用及服务的所有权利，包括品牌、设计、代码与素材。",
            ],
          },
          {
            title: "商标",
            body: [
              "• “thankly”及暂停符号徽标为上海有拙趣文化创新有限公司的商标。",
              "• 未经书面许可不得使用我们的商标。",
            ],
          },
          {
            title: "限制",
            body: [
              "• 请勿复制、修改、反向工程、销售、出租或再许可本应用。",
              "• 请勿移除版权声明或基于本服务创建竞争产品。",
            ],
          },
        ],
      },
      {
        heading: "9. 第三方服务",
        subsections: [
          {
            title: "集成服务",
            body: [
              "• 身份验证：Apple 登录与 Google 登录。",
              "• 基础设施：AWS 云存储与托管。",
              "• AI 处理：OpenAI 与 AWS Bedrock。",
            ],
          },
          {
            title: "第三方条款",
            body: [
              "• 您需遵守第三方服务的使用条款和隐私政策。",
              "• 我们不对第三方的做法或性能负责。",
            ],
          },
        ],
      },
      {
        heading: "10. 免责声明",
        subsections: [
          {
            title: "无保证",
            body: [
              '• 服务按 "现状" 和 "可用" 提供，不提供任何明示或暗示的保证。',
              "• 我们不保证 AI 内容的准确性、服务不间断、绝对安全或完全满足您的特定需求。",
            ],
          },
        ],
      },
      {
        heading: "11. 责任限制",
        subsections: [
          {
            title: "责任范围",
            body: [
              "• 对间接、附带、特殊、后果性或惩罚性损害（包括数据、利润、机会或精神损害的损失），我们概不负责。",
              "• 我们承担的总责任不超过您在过去 12 个月向我们支付的金额（目前为零）。",
              "• 在法律不允许的范围内，我们的责任将限制在法律允许的最大范围内。",
            ],
          },
        ],
      },
      {
        heading: "12. 赔偿",
        subsections: [
          {
            title: "您的承诺",
            body: [
              "• 因您使用或滥用服务、违反条款、侵犯第三方权利或上传内容导致的任何索赔、损失或费用，您需赔偿并使 thankly 及其关联方免受损害。",
            ],
          },
        ],
      },
      {
        heading: "13. 条款变更",
        subsections: [
          {
            title: "更新",
            body: [
              "• 我们可能因服务调整、法规变化或业务实践而更新条款。",
              "• 更新后的条款会在应用中发布，并修改“最后更新”日期。",
              "• 对于重大变更，我们会通过电子邮件或应用内显著通知告知您。",
              "• 继续使用服务即表示接受更新条款。",
              "• 如不同意，请停止使用并删除账户。",
            ],
          },
        ],
      },
      {
        heading: "14. 终止",
        subsections: [
          {
            title: "您的权利",
            body: ["• 您可随时停止使用并删除账户。"],
          },
          {
            title: "我们的权利",
            body: [
              "• 如您违反条款、长期未活跃、法律要求或服务终止，我们可立即暂停或终止访问。",
            ],
          },
          {
            title: "终止影响",
            body: [
              "• 您使用服务的权利立即终止。",
              "• 我们将在 30 天内按隐私政策删除您的数据。",
              "• 账户或数据一旦删除不可恢复，请提前备份重要内容。",
              "• 按其性质应继续有效的条款将继续生效。",
            ],
          },
        ],
      },
      {
        heading: "15. 争议解决",
        subsections: [
          {
            title: "适用法律与管辖",
            body: [
              "• 本条款受英格兰和威尔士法律管辖。",
              "• 因本条款或服务引起的争议由英格兰和威尔士法院专属管辖。",
            ],
          },
          {
            title: "非正式解决",
            body: [
              "• 在提起诉讼前，请先通过 support@thankly.app 尝试非正式解决。",
            ],
          },
          {
            title: "仲裁",
            body: [
              "• 对于英国以外的用户，双方可协商通过具有约束力的仲裁解决争议。",
            ],
          },
        ],
      },
      {
        heading: "16. 一般条款",
        subsections: [
          {
            title: "完整协议",
            body: ["• 本条款及隐私政策构成您与 thankly 就服务达成的完整协议。"],
          },
          {
            title: "可分割性",
            body: ["• 若任何条款被视为无效或不可执行，其余条款仍完全有效。"],
          },
          {
            title: "不放弃权利",
            body: ["• 我们未行使本条款的任何权利不构成对该权利的放弃。"],
          },
          {
            title: "转让",
            body: [
              "• 未经书面同意，您不得转让本条款或账户；我们可转让给继承人或关联公司。",
            ],
          },
          {
            title: "不可抗力",
            body: [
              "• 因超出合理控制范围的事件导致的延迟或失败，我们不承担责任。",
            ],
          },
          {
            title: "语言",
            body: ["• 本条款提供英文和中文版本，如有不一致，以英文版本为准。"],
          },
        ],
      },
      {
        heading: "17. 联系我们",
        subsections: [
          {
            title: "联系渠道",
            body: [
              "电子邮箱：support@thankly.app",
              "通信地址：thankly（上海有拙趣文化创新有限公司），中国上海市奉贤区奉城镇南奉公路686号4幢 201400",
              "我们将在 3 个工作日内回复您的询问。",
            ],
          },
        ],
      },
      {
        heading: "18. 应用商店附加条款",
        subsections: [
          {
            title: "Apple App Store",
            body: [
              "• 本条款为您与 thankly 之间的协议，非与 Apple。",
              "• Apple 无义务提供维护或支持。",
              "• Apple 不对与应用相关的索赔负责。",
              "• 如涉及知识产权争议，由 thankly 负责处理。",
              "• 您需遵守 Apple 的 App Store 服务条款。",
            ],
          },
          {
            title: "Google Play Store",
            body: [
              "• 本条款为您与 thankly 之间的协议，非与 Google。",
              "• Google 无义务提供维护或支持。",
              "• Google 不对与应用相关的索赔负责。",
              "• 您需遵守 Google Play 服务条款。",
            ],
          },
        ],
      },
      {
        heading: "19. 未成年人条款",
        subsections: [
          {
            title: "监护要求",
            body: [
              "• 未满 18 周岁的用户必须获得父母或监护人许可。",
              "• 父母或监护人需审阅并同意本条款。",
              "• 我们可能在允许创建账户前要求家长验证。",
              "• 父母或监护人负责监督未成年人对服务的使用。",
            ],
          },
        ],
      },
      {
        heading: "20. 出口合规",
        subsections: [
          {
            title: "合规要求",
            body: [
              "• 您需遵守所有适用的进出口法律法规。",
              "• 请勿以违反法律的方式使用或出口本应用。",
            ],
          },
        ],
      },
    ],
    closing: ["使用 thankly 即表示您已阅读、理解并同意遵守本服务条款。"],
  },

  // 亲密圈功能
  circle: {
    // 通用
    myCircles: "我的圈子",
    circleMembers: "圈子成员",
    memberCount: "{{count}} 位成员",
    owner: "圈主",
    member: "成员",
    
    // 创建圈子
    createCircle: "创建圈子",
    circleName: "圈子名称",
    circleNamePlaceholder: "例如：我的家人",
    create: "创建",
    creating: "创建中...",
    createSuccess: "创建成功！",
    inviteCode: "邀请码",
    copyCode: "复制邀请码",
    codeCopied: "邀请码已复制",
    shareCodeHint: "将邀请码分享给朋友，让他们加入你的圈子",
    
    // 加入圈子
    joinCircle: "加入圈子",
    enterInviteCode: "输入邀请码",
    inviteCodePlaceholder: "6位字母或数字",
    join: "加入",
    joining: "加入中...",
    joinSuccess: "成功加入圈子！",
    
    // 圈子列表
    noCircles: "还没有圈子",
    noCirclesHint: "创建或加入一个圈子，开始分享你的生活点滴",
    createFirst: "创建我的第一个圈子",
    joinFirst: "加入一个圈子",
    pullToRefresh: "下拉刷新",
    
    // 圈子动态流
    circleFeed: "圈子动态",
    noFeed: "还没有动态",
    noFeedHint: "分享日记到圈子，让朋友们看到你的近况",
    loadingFeed: "加载中...",
    loadMore: "加载更多",
    noMoreFeed: "没有更多了",
    sharedBy: "{{userName}} 分享了",
    sharedAt: "分享于 {{time}}",
    
    // 日记分享
    shareToCircle: "分享到圈子",
    selectCircle: "选择圈子",
    shareSuccess: "分享成功",
    unshare: "取消分享",
    unshareSuccess: "已取消分享",
    sharedToCircles: "已分享到 {{count}} 个圈子",
    notShared: "未分享",
    
    // 圈子管理
    leaveCircle: "退出圈子",
    leaveConfirm: "确定要退出「{{name}}」吗？",
    leaveHint: "退出后，你分享的日记会从圈子中移除",
    leaveSuccess: "已退出圈子",
    
    // 首次引导
    onboarding: {
      welcome: {
        title: "欢迎来到亲密圈",
        subtitle: "和最亲近的人，分享生活中的温暖时刻",
        features: [
          "创建私密圈子",
          "分享你的日记",
          "看见朋友的近况",
        ],
        continue: "开始使用",
      },
      createOrJoin: {
        title: "开始你的第一个圈子",
        subtitle: "选择一个方式开始",
        createOption: "创建圈子",
        createHint: "邀请家人和朋友加入",
        joinOption: "加入圈子",
        joinHint: "输入朋友分享的邀请码",
      },
      complete: {
        title: "一切就绪！",
        subtitle: "现在你可以开始分享日记啦",
        start: "进入圈子",
      },
    },
    
    // 错误提示
    errors: {
      limitExceeded: "免费用户最多创建3个圈子",
      tooManyAttempts: "尝试次数过多，请稍后再试",
      invalidCodeFormat: "邀请码格式不正确",
      codeNotFound: "邀请码不存在",
      alreadyMember: "你已经是圈子成员了",
      ownerCannotLeave: "圈主不能退出圈子",
      notMember: "你不是圈子成员",
      alreadyShared: "已经分享到这个圈子了",
      forbidden: "没有权限",
      notFound: "圈子不存在",
    },
    
    // 入口提示
    entryHint: "点击右上角，进入亲密圈",
  },
};
