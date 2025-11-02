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
  },

  // 登录页面
  login: {
    title: "欢迎",
    subtitle: "登录以继续",
    appleSignIn: "使用 Apple 登录",
    googleSignIn: "使用 Google 登录",
    signingIn: "登录中...",
    termsHint: "登录即表示同意我们的服务条款和隐私政策",
  },

  // 首页/日记列表
  home: {
    welcome: "你好呀",
    subtitle: "在这个温柔角落，用声音或文字留住你在意的一切",
    myDiary: "我留住的时刻",
    noDiaries: "还没有日记呢",
    noDiariesHint: "点击下方按钮\n记录第一个温暖时刻",
    refreshing: "刷新中...",
    signOut: "退出登录",
    copySuccess: "已复制",
    copyFailed: "复制功能暂时不可用",
    copyEntry: "复制内容",
    copyUnavailable: "复制功能正在路上 ✨",
    imageFeatureTitle: "照片上传",
    imageFeatureMessage: "即将上线 📸",
    anonymousUser: "朋友",
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
};
