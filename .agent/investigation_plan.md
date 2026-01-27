# iOS EAS Update & Android Check Investigation Plan

## 1. Android Test Credentials (App Access)

- **Status:** User noted Google didn't ask for credentials during release creation.
- **Analysis:** Google Play collects this in the "App content" (应用内容) section, separately from the release track.
- **Action:**
  - Verify "App access" setting in Google Play Console.
  - If set to "Functionality is restricted", ensure credentials are provided.
  - If set to "All functionality available without access", this is incorrect for a login-based app and may cause rejection.

## 2. iOS EAS Update Troubleshooting

- **Problem:** User reports iOS update not taking effect; Login issue persists.
- **Root Cause Analysis:**
  - **Runtime Version Mismatch:** The app on the phone is likely strictly listening for updates compatible with `runtimeVersion: "1.2.0"`.
  - **Source of Confusion ("remote" vs "local"):**
    - `appVersionSource: "remote"` (Previous setting): EAS ignores local `app.json`. It pulls the version from the _latest build_ on Expo servers. usage: If last build was 1.2.1, the update is published for 1.2.1.
    - `appVersionSource: "local"` (Current Fix): EAS uses the literal string in your local `app.json`.
  - **Hypothesis:** Previous updates were published targeting `1.2.1` (due to "remote" source or explicit version setting), so `1.2.0` devices ignored them.

## 3. Remediation Steps

- [ ] **Wait for Current Update:** A new update targeting `1.2.0` (with `appVersionSource: "local"`) is currently uploading.
- [ ] **Verify Update Publication:** Confirm the new update appears in EAS Dashboard with Runtime Version `1.2.0`.
- [ ] **Client-Side Verification:**
  - Force close iOS app.
  - Re-open (download happens).
  - Force close again.
  - Re-open (update applied).
- [ ] **Android Config Check:** Guide user to "App content" to double-check login credentials to avoid rejection.

## 4. Long-term Fix

- Revert `app.json` to `1.2.1` and `eas.json` to `remote` only _after_ the hotfix is confirmed working on user's device.
