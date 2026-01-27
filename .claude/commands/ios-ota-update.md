# iOS OTA Update (Production)

Use this command to publish an iOS-only OTA update that matches the current
`app.json` version and ensures the production branch/channel stay aligned.

## Run

From the repo root:

```
cd mobile
./scripts/publish-update-ios.sh "你的更新说明"
```

## Options

```
./scripts/publish-update-ios.sh -m "你的更新说明"
./scripts/publish-update-ios.sh --yes "你的更新说明"
```

## Notes

- This publishes **iOS only** (Android will not be affected).
- Runtime version is taken from `app.json` to match the App Store version.
- The script checks `eas.json` production channel matches the branch.
- The script validates `updates.url` is set in `app.json`.
