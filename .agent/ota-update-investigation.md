# Expo/EAS OTA Update Failure - Root Cause Investigation

## Executive Summary

**Status:** 🔴 CRITICAL - OTA updates published but not reaching devices

**Symptom:** Updates visible on Expo dashboard with 0 downloads/launches, client apps not fetching updates even after reinstall.

---

## Part 1: Understanding Expo OTA Update Mechanism

### How Expo OTA Updates Actually Work

#### 1. **The Three-Layer Architecture**

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Native Binary (iOS/Android)                   │
│ - Built with EAS Build                                  │
│ - Contains: Native code + JS bundle (embedded)          │
│ - Has a "Runtime Version" baked in                      │
│ - Points to an "Update Channel"                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Update Channel (Branch)                        │
│ - Named channel: "production", "preview", etc.         │
│ - Each channel can have multiple updates                │
│ - Updates are filtered by Runtime Version              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: OTA Update (JS Bundle)                         │
│ - Published via `eas update` or `expo publish`         │
│ - Contains: Updated JS/TS code, assets                  │
│ - Tagged with Runtime Version                           │
│ - Deployed to a specific Channel                       │
└─────────────────────────────────────────────────────────┘
```

#### 2. **The Update Fetch Flow**

When your app starts:

1. **App Launch** → Native binary loads
2. **Check Runtime Version** → App reads its embedded runtime version (e.g., "1.2.0")
3. **Check Channel** → App reads its embedded channel (e.g., "production")
4. **Query Expo Servers** → `GET https://u.expo.dev/{projectId}/updates?runtimeVersion=1.2.0&channel=production`
5. **Filter Updates** → Expo returns ONLY updates where:
   - `update.runtimeVersion === app.runtimeVersion` (EXACT match)
   - `update.channel === app.channel` (EXACT match)
6. **Download & Apply** → If update found, download and apply on next launch

#### 3. **Critical Rules (When Updates Are Ignored)**

Updates are **silently ignored** if:

- ❌ **Runtime Version Mismatch**: Update's runtime ≠ App's runtime
- ❌ **Channel Mismatch**: Update's channel ≠ App's channel  
- ❌ **Update Not Published**: Only builds exist, no OTA updates published
- ❌ **Build Points to Wrong Channel**: Native build was built with different channel than updates
- ❌ **Development Build**: Using `developmentClient: true` (updates disabled by design)

#### 4. **The "Looks Published But Not Deployed" Trap**

**Common Mistake:**
- ✅ You run `eas build` → Creates native binary
- ❌ You **forget** to run `eas update` → No OTA update published
- 📊 Expo dashboard shows the **build**, but no **update** for that runtime/channel combo
- 🔍 Result: App queries for updates, finds nothing, uses embedded bundle

**Key Insight:** 
- `eas build` = Creates native app binary (for App Store/Play Store)
- `eas update` = Publishes OTA update (for existing installed apps)
- These are **separate operations**!

---

## Part 2: Diagnostic Checklist

### ✅ Configuration Verification

#### A. Runtime Version Alignment

**Check 1: What runtime version is in your native builds?**

```bash
# Check what runtime version your production builds have
cd mobile
eas build:list --platform ios --profile production --limit 1
eas build:list --platform android --profile production --limit 1
```

**Expected:** Should show runtime version matching `app.json` version (1.2.0)

**Check 2: What runtime version are your updates targeting?**

```bash
# List recent updates
eas update:list --branch production --limit 5
```

**Expected:** Updates should have `runtimeVersion: "1.2.0"` (matching your app version)

**Check 3: Verify app.json runtime version policy**

Current config:
```json
"runtimeVersion": {
  "policy": "appVersion"  // ✅ This means runtime = "1.2.0"
}
```

**Status:** ✅ CORRECT - Uses app version as runtime version

---

#### B. Channel Binding

**Check 4: What channel is your production build pointing to?**

From `eas.json`:
```json
"production": {
  "channel": "production"  // ✅ Builds point to "production" channel
}
```

**Status:** ✅ CORRECT

**Check 5: Are updates published to the same channel?**

From dashboard images:
- Updates show branch: `production` ✅
- But need to verify they're actually on the `production` channel

**Action Required:** Verify with `eas update:list --branch production`

---

#### C. Update Publication Status

**Check 6: Are OTA updates actually published?**

**CRITICAL QUESTION:** When you published updates, did you:
- Run `eas update --branch production`? ✅ (This publishes OTA)
- OR only run `eas build`? ❌ (This only creates native binary)

**From CI/CD Analysis:**
- `.github/workflows/deploy-mobile.yml` only runs `eas build`
- **NO `eas update` command found!**

**🔴 ROOT CAUSE SUSPECTED:** Updates may not be published via CI/CD, only manually.

---

#### D. Build vs Update Mismatch

**Check 7: When was your last production build?**

From dashboard: "4 days ago" for runtime 1.2.0

**Check 8: When were updates published?**

From dashboard: "about 12-13 hours ago"

**Analysis:**
- Builds are older than updates
- If builds were created with runtime "1.2.0" and updates target "1.2.0", they should match
- **BUT:** Need to verify the actual runtime version embedded in the builds

---

### 🔍 Deep Dive: What to Check Next

#### Step 1: Verify Update Publication

Run this command and share the output:

```bash
cd mobile
eas update:list --branch production --limit 10
```

**What to look for:**
- Do updates exist?
- What are their runtime versions?
- What are their channels?
- When were they published?

#### Step 2: Verify Build Runtime Versions

```bash
cd mobile
eas build:list --platform ios --profile production --limit 3
eas build:list --platform android --profile production --limit 3
```

**What to look for:**
- What runtime version is embedded in each build?
- What channel is each build pointing to?
- When were they created?

#### Step 3: Check Client-Side Update Fetch

Add temporary logging to verify the app is checking for updates:

```typescript
// In App.tsx, add this after imports
import * as Updates from 'expo-updates';

// In useEffect, add:
useEffect(() => {
  if (!__DEV__) {
    Updates.checkForUpdateAsync()
      .then(result => {
        console.log('Update check result:', result);
        if (result.isAvailable) {
          console.log('Update available, downloading...');
          return Updates.fetchUpdateAsync();
        }
      })
      .then(result => {
        if (result?.isNew) {
          console.log('New update downloaded, will apply on restart');
          Updates.reloadAsync();
        }
      })
      .catch(err => console.error('Update check failed:', err));
  }
}, []);
```

---

## Part 3: Most Likely Root Causes (Ranked)

### 🥇 **#1: Updates Not Published (Only Builds Exist)**

**Probability:** 80%

**Evidence:**
- CI/CD workflow only has `eas build`, no `eas update`
- Dashboard shows updates, but they might have been published manually with wrong params

**Fix:**
- Ensure `eas update --branch production` is run after code changes
- Add to CI/CD workflow

---

### 🥈 **#2: Runtime Version Mismatch**

**Probability:** 15%

**Evidence:**
- Dashboard shows updates with runtime "1.2.0" and "1.2.1" mixed
- If your installed app has runtime "1.2.0" but latest update targets "1.2.1", it won't fetch

**Fix:**
- Ensure all updates target the same runtime as your production builds
- Use `appVersionSource: "local"` (already set ✅)

---

### 🥉 **#3: Channel Mismatch**

**Probability:** 5%

**Evidence:**
- Builds might point to different channel than updates
- Less likely given your config looks correct

**Fix:**
- Verify build channel matches update channel

---

## Part 4: Immediate Action Plan

### Phase 1: Diagnosis (Do This First)

1. **Run diagnostic commands** (see above)
2. **Share outputs** so we can pinpoint exact issue
3. **Check Expo dashboard** for update details

### Phase 2: Fix

Once root cause identified, we'll:
1. Fix configuration if needed
2. Publish correct update
3. Add update publishing to CI/CD
4. Add monitoring/logging

### Phase 3: Verification

1. Test on device
2. Verify update fetch logs
3. Confirm update applies

---

## Next Steps

**Please run these commands and share the output:**

```bash
cd mobile

# 1. List recent updates
eas update:list --branch production --limit 10

# 2. List recent builds
eas build:list --platform ios --profile production --limit 3
eas build:list --platform android --profile production --limit 3

# 3. Check current app.json version
cat app.json | grep -A 2 '"version"'
```

This will help us identify the exact mismatch.
