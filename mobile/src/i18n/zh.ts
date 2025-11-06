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
    useTextInput: "改用文字输入",
    show: "显示",
  },

  // Onboarding流程
  onboarding: {
    welcome: {
      title: "欢迎来到感记",
      subtitle: "在这里，按下暂停键，记录生活的每个瞬间",
      privacyNotice:
        "阅读我们的{{privacyPolicy}}，点击「同意并继续」即表示接受{{termsOfService}}",
      privacyPolicy: "隐私政策",
      termsOfService: "服务条款",
      agreeButton: "同意并继续",
    },
    skip: "跳过",
    guide1: {
      title: "说出来就好",
      subtitle: "不用打字，只需轻声说出此刻的感受",
    },
    guide2: {
      title: "每一刻都值得留住",
      subtitle: "开心的、难过的、平淡的，都是你真实的样子, 都值得被记录",
    },
    guide3: {
      title: "从今天开始",
      subtitle: "睡前一分钟，记下今天的温暖时刻, 让生活慢慢变得温",
      getStartedButton: "开始记录",
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
    verificationCode: "验证码",
    verificationCodePlaceholder: "请输入验证码",
    sendCode: "发送验证码",
    resendCode: "重新发送",
    verifyAndLogin: "验证并登录",
    namePrompt: {
      title: "你希望我们怎么称呼你？",
      subtitle: "请输入你的名字或昵称（我们会用这个名字在首页和你打招呼）",
      placeholder: "名字或昵称",
    },
    codeSent: "验证码已发送",
    codeSentMessage: "验证码已发送到您的手机，请查收",
    enterPhoneFirst: "请先输入手机号",
    enterCodeFirst: "请输入验证码",
    invalidPhoneNumber: "手机号格式错误，请包含国家代码（如+86）",
    codeExpired: "验证码已过期，请重新获取",
    codeMismatch: "验证码错误，请重试",
    switchToEmail: "切换到邮箱登录",
    switchToPhone: "切换到手机号登录",
    countdown: "{{seconds}}秒后重新发送",
    loginDescription: "登录或注册新账号",
    selectCountry: "选择国家/地区",
    searchCountry: "搜索国家或区号",
  },

  // 录音相关
  recording: {
    nearLimit: "还剩 1 分钟",
    maxReached: "已达到 10 分钟上限",
  },

  // 首页/日记列表
  home: {
    welcome: "Hi {name}",
    subtitle: "这是属于你的温柔角落，记录生活的每一个瞬间",
    myDiary: "我留住的时刻",
    noDiaries: "要不要暂停一下，记录今天？开启属于你的故事",
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
    addImageButton: "添加照片日记",
    recordVoiceButton: "录制语音日记",
    writeTextButton: "撰写文字日记",
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
    recordingTooShortMessage: "请至少录制2秒以上的内容",
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
    title: "记录此刻",
    promptTitle: "此刻，你想记住什么？",
    textPlaceholder: "在这里写下来，让这一刻停留...",
    characterCount: "{{count}}/500",
    minCharacters: "再写",
    charactersRequired: "个字就可以啦",
    polishing: "AI 正在帮你润色...",
    emptyContent: "还没写呢",
    emptyContentMessage: "先写下几个字吧，哪怕只是一句话 💭",
    emptyContentToast: "还没写呢，先写下几个字吧 💭",
    needMoreChars: "至少再写",
    moreChars: "个字",
  },

  // 日记通用（创建后的结果页面）
  diary: {
    voiceEntry: "语音记录",
    yourEntry: "你的记录",
    pauseRecording: "已暂停",
    resumeRecording: "继续录音",
    startRecording: "重新录音",
    shortRecordingHint: "请说一些完整的句子，至少录制3秒",
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
      feedback: "写下我的回复...",
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
  },

  // 错误提示
  error: {
    networkError: "网络连接失败",
    serverError: "服务暂时不可用，请稍后重试",
    authExpired: "登录已过期，请重新登录",
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
    emptyRecording: {
      title: "未检测到有效内容",
      message: "似乎没有听到你的语音。请尝试说出你的感谢，或改用文字输入。",
    },
  },

  // 成功提示
  success: {
    saved: "✅ 保存成功",
    deleted: "✅ 日记删除成功",
    updated: "更新成功",
    diaryCreated: "✅ 感恩时刻已保存",
  },

  // 确认对话框
  confirm: {
    deleteTitle: "确认删除",
    deleteMessage: "您确定要删除这篇日记吗？删除后将无法恢复。",
    cancelRecordingTitle: "取消录音",
    cancelRecordingMessage: "确定要取消吗？录音内容将丢失。",
    hint: "提示",
    timeLimit: "录音即将到达10分钟上限\n\n建议尽快结束，或现在保存",
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
};
