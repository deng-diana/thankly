# Android OTA Update (Production)

Use this command to publish an Android-only OTA update that matches the current
`app.json` version and ensures the production branch/channel stay aligned.

## Run

From the repo root:

```
cd mobile
./scripts/publish-update-android.sh "你的更新说明"
```

## Options

```
./scripts/publish-update-android.sh -m "你的更新说明"
./scripts/publish-update-android.sh --yes "你的更新说明"
```

## Examples

```bash
# 发布日记卡片样式优化更新
./scripts/publish-update-android.sh "v1.2.1 日记卡片投影和时间样式优化"

# 跳过确认直接发布
./scripts/publish-update-android.sh --yes "紧急修复"

# 使用 -m 参数指定消息
./scripts/publish-update-android.sh -m "修复录音功能"
```

## Pre-flight Checklist

在执行热更新之前，请确认：

1. **版本号匹配**: `app.json` 的 `version` 必须与 Google Play 商店版本一致
   - 当前商店版本: 1.2.1
   - 检查: `cat mobile/app.json | grep version`

2. **本地开发模式已关闭**: 
   - 检查 `mobile/src/config/aws-config.ts` 中 `IS_LOCAL_DEV = false`

3. **代码已测试**: 确保改动在本地测试通过

4. **EAS CLI 已登录**: 
   - 检查: `eas whoami`
   - 登录: `eas login`

## Notes

- This publishes **Android only** (iOS will not be affected).
- Runtime version is taken from `app.json` to match the Google Play version.
- The script checks `eas.json` production channel matches the branch.
- The script validates `updates.url` is set in `app.json`.
- Users will receive the update on next app launch (or foreground).

## Verify Update

发布后，使用以下命令验证：

```bash
# 查看最近的更新
eas update:list --branch production --limit 5

# 查看更新详情
eas update:view <update-id>
```

## Troubleshooting

### 用户没有收到更新？

1. **runtimeVersion 不匹配**: 确保 `app.json` 的 `version` 与商店版本一致
2. **channel 不匹配**: 确保 `eas.json` 的 production channel 是 `production`
3. **网络问题**: 用户需要联网才能检查更新
4. **缓存**: 用户可能需要完全退出应用后重新打开

### 回滚更新

如果需要回滚到上一个版本：

```bash
# 查看历史更新
eas update:list --branch production --limit 10

# 重新发布旧版本（需要 checkout 到对应 commit）
git checkout <commit-hash>
./scripts/publish-update-android.sh "回滚到稳定版本"
```
