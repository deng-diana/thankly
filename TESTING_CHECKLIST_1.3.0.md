# Thankly v1.3.0 Testing Checklist - Intimate Circles Feature

## 📋 **Pre-Testing Setup**

- [ ] Build iOS app with Expo: `eas build --platform ios --profile production`
- [ ] Build Android app with Expo: `eas build --platform android --profile production`
- [ ] Install on physical devices (Push notifications require real devices)
- [ ] Prepare 2-3 test accounts for multi-user testing
- [ ] Ensure backend tables are created (run `create_notification_tables.py`)
- [ ] Verify `IS_LOCAL_DEV = false` in production config

---

## 🧪 **Week 1: Core Circle Features**

### ✅ **Day 1: Circle Creation**

**Test Case 1.1: Create Circle - Happy Path**
- [ ] Open app → Navigate to "亲密圈"
- [ ] Tap "Create Circle" button
- [ ] Enter circle name: "我的家人"
- [ ] Tap "Create"
- [ ] Verify: Success message displayed
- [ ] Verify: 6-character invite code shown (uppercase alphanumeric)
- [ ] Verify: Can copy invite code to clipboard
- [ ] Verify: Circle appears in list with "圈主" badge

**Test Case 1.2: Create Circle - Validation**
- [ ] Try to create circle with empty name → Should show error
- [ ] Try to create circle with only spaces → Should show error
- [ ] Try to create circle with 21+ characters → Character counter stops at 20
- [ ] Create circle with Chinese characters → Should work
- [ ] Create circle with emoji → Should work
- [ ] Create circle with English name → Should work

**Test Case 1.3: Create Circle - Edge Cases**
- [ ] Create 5 circles in a row → All should succeed
- [ ] Check if invite codes are unique
- [ ] Try to create circle while offline → Should show network error

---

### ✅ **Day 2: Join Circle**

**Test Case 2.1: Join Circle - Happy Path**
- [ ] User A creates circle → Get invite code
- [ ] User B opens "Join Circle" modal
- [ ] User B enters invite code (lowercase) → Should auto-convert to uppercase
- [ ] Tap "Join"
- [ ] Verify: Success message displayed
- [ ] Verify: Circle appears in User B's list (no "圈主" badge)
- [ ] Verify: User A's member count increased to 2

**Test Case 2.2: Join Circle - Validation**
- [ ] Try to join with empty code → Should show error
- [ ] Try to join with invalid code "ABC12" (5 chars) → Format error
- [ ] Try to join with invalid code "ABC12!" (special char) → Format error
- [ ] Try to join with non-existent code "ZZZZZZ" → "圈子不存在"
- [ ] Try to join same circle twice → "您已经是圈子成员"

**Test Case 2.3: Join Circle - Rate Limiting**
- [ ] Try to join 10 circles in quick succession
- [ ] After 5 attempts in 1 minute, should see rate limit error
- [ ] Wait 1 minute → Should be able to join again

---

### ✅ **Day 3: Circle List**

**Test Case 3.1: Circle List Display**
- [ ] Verify all circles show correct name
- [ ] Verify member count is accurate
- [ ] Verify creation time is displayed correctly
- [ ] Verify "圈主" badge only shows for owned circles
- [ ] Verify circles sorted by creation time (newest first)

**Test Case 3.2: Circle List - Empty State**
- [ ] New user with no circles → Should see empty state
- [ ] Empty state should show:
  - [ ] Friendly icon
  - [ ] "还没有圈子" message
  - [ ] "Create" and "Join" buttons

**Test Case 3.3: Circle List - Refresh**
- [ ] Pull down to refresh → Should reload circles
- [ ] User B joins a circle → User A pulls to refresh → Member count updates
- [ ] Create circle on Device A → Pull refresh on Device B → New circle appears

---

## 📰 **Week 2: Circle Feed**

### ✅ **Day 1: View Feed**

**Test Case 4.1: Feed Display - Empty State**
- [ ] Tap on circle with no shares → Should see empty state
- [ ] Empty state shows: Icon + "还没有动态" + hint

**Test Case 4.2: Feed Display - With Content**
- [ ] User A shares diary to circle
- [ ] User B opens circle feed
- [ ] Verify: Shared diary appears
- [ ] Verify: Shows "User A 分享了" header
- [ ] Verify: Shows relative time ("刚刚", "5分钟前", etc.)
- [ ] Verify: Shows diary title, date, emotion, content
- [ ] Verify: Emotion glow effect displays correctly

**Test Case 4.3: Feed - Pagination**
- [ ] Share 25+ diaries to a circle
- [ ] Open feed → Should show 20 items initially
- [ ] Scroll to bottom → Should load more automatically
- [ ] Verify: "加载更多..." indicator shows while loading
- [ ] Verify: All 25+ items eventually load
- [ ] Verify: No duplicate items

**Test Case 4.4: Feed - Pull to Refresh**
- [ ] Open feed
- [ ] User A shares new diary
- [ ] User B pulls down to refresh
- [ ] Verify: New diary appears at top
- [ ] Verify: Feed reloads correctly

---

### ✅ **Day 2: Feed Content**

**Test Case 5.1: Feed Card - Text Diary**
- [ ] Share text-only diary
- [ ] Verify: Title displays correctly (max 2 lines, ellipsis)
- [ ] Verify: Content displays correctly
- [ ] Verify: Date formatted correctly
- [ ] Verify: Emotion capsule shows

**Test Case 5.2: Feed Card - Voice Diary**
- [ ] Share voice diary with audio
- [ ] Verify: Audio player shows
- [ ] ⚠️ **Known Limitation**: Playback not yet implemented (see TODO comment)
- [ ] Verify: All other fields display correctly

**Test Case 5.3: Feed Card - Image Diary**
- [ ] Share diary with 1 image
- [ ] Verify: Image displays in correct aspect ratio
- [ ] Share diary with 4 images
- [ ] Verify: Images display in 2x2 grid
- [ ] ⚠️ **Known Limitation**: Image preview not yet implemented (see TODO comment)

**Test Case 5.4: Feed Card - Multi-language**
- [ ] Share Chinese diary → Should use NotoSerifSC font
- [ ] Share English diary → Should use Lora font
- [ ] Switch system language → Verify relative time updates

---

## 📤 **Week 3: Sharing**

### ✅ **Day 1: Share from Action Sheet**

**Test Case 6.1: Share Single Circle**
- [ ] User A creates diary
- [ ] Tap three-dot menu on diary card
- [ ] Tap "分享到圈子"
- [ ] CircleShareSelector modal opens
- [ ] Select 1 circle
- [ ] Tap "确认"
- [ ] Verify: Success toast shows
- [ ] Verify: User B sees diary in circle feed

**Test Case 6.2: Share Multiple Circles**
- [ ] User A is member of 3 circles
- [ ] Open share selector for a diary
- [ ] Select all 3 circles (checkmarks appear)
- [ ] Verify: "已选择 3 个圈子" hint shows
- [ ] Tap "确认"
- [ ] Verify: Diary appears in all 3 circle feeds

**Test Case 6.3: Unshare**
- [ ] Share diary to 2 circles
- [ ] Reopen share selector for same diary
- [ ] Verify: 2 circles are pre-selected (checkmarks)
- [ ] Deselect 1 circle
- [ ] Tap "确认"
- [ ] Verify: Diary removed from deselected circle's feed
- [ ] Verify: Still appears in the other circle's feed

**Test Case 6.4: Share - No Circles**
- [ ] User with no circles
- [ ] Try to share diary
- [ ] Verify: Shows empty state in selector
- [ ] Verify: "还没有圈子" + guidance to create/join

---

### ✅ **Day 2: Share Validation**

**Test Case 7.1: Share Permissions**
- [ ] User A shares diary to Circle X
- [ ] User B (not in Circle X) tries to open feed → Should see error or be prevented
- [ ] User C (in Circle X) opens feed → Should see diary

**Test Case 7.2: Share Already Shared**
- [ ] Share diary to Circle A
- [ ] Try to share same diary to Circle A again via selector
- [ ] Selector should show Circle A as already selected
- [ ] Confirm → Should not create duplicate

**Test Case 7.3: Offline Sharing**
- [ ] Turn off network
- [ ] Try to share diary
- [ ] Verify: Network error shown
- [ ] Turn on network → Retry → Should succeed

---

## 🔔 **Week 3: Push Notifications**

### ✅ **Day 1: Token Registration**

**Test Case 8.1: Auto Token Registration**
- [ ] Install app on physical device
- [ ] Login
- [ ] Check backend logs → Token should be registered
- [ ] Verify: Token cached locally (no redundant registrations)

**Test Case 8.2: Token Update**
- [ ] Reinstall app
- [ ] Login with same account
- [ ] New token should replace old token

---

### ✅ **Day 2: Notification Sending**

**Test Case 9.1: Receive Notification - Happy Path**
- [ ] User B's app in background or closed
- [ ] User A shares diary to circle
- [ ] Verify: User B receives push notification
- [ ] Verify: Notification shows: "User A 分享了新日记"
- [ ] Verify: Body shows diary title

**Test Case 9.2: Notification - Tap to Open**
- [ ] Receive notification
- [ ] Tap notification
- [ ] Verify: App opens to CircleFeed screen
- [ ] Verify: Shows the correct circle's feed

**Test Case 9.3: Rate Limiting**
- [ ] User A shares diary 1 → User B gets notification
- [ ] User A shares diary 2 → User B gets notification
- [ ] User A shares diary 3 → User B gets notification
- [ ] User A shares diary 4 → **User B should NOT get notification** (daily limit: 3)
- [ ] Check backend logs → "Rate limit exceeded" message

**Test Case 9.4: Quiet Hours**
- [ ] Set device time to 22:05 (UTC) or 23:00 local
- [ ] User A shares diary
- [ ] Verify: **User B should NOT receive notification**
- [ ] Check backend logs → "Quiet hours active" message
- [ ] Set device time to 08:05 (UTC) or 09:00 local
- [ ] User A shares diary
- [ ] Verify: User B receives notification

**Test Case 9.5: No Self-Notification**
- [ ] User A shares diary
- [ ] Verify: User A does NOT receive notification about their own share

---

## 🎨 **Week 3: UI/UX**

### ✅ **Day 1: Loading States**

**Test Case 10.1: Loading Indicators**
- [ ] CircleListScreen: First load shows ActivityIndicator
- [ ] CircleFeedScreen: First load shows ActivityIndicator
- [ ] CircleShareSelector: First load shows ActivityIndicator
- [ ] Create/Join modals: Submit buttons show loading during API call
- [ ] Verify: No double-tap issues (buttons disabled during submit)

**Test Case 10.2: Toast Messages**
- [ ] Share diary → "分享成功" toast (iOS custom, Android native)
- [ ] Join circle → "加入成功" toast
- [ ] Create circle → Modal shows invite code (not toast)

---

### ✅ **Day 2: Empty States**

**Test Case 11.1: Empty State Design**
- [ ] CircleListScreen empty → Icon + message + buttons
- [ ] CircleFeedScreen empty → Icon + message + hint
- [ ] CircleShareSelector empty → Icon + message + hint
- [ ] Verify: All empty states are centered and friendly

---

### ✅ **Day 3: Onboarding**

**Test Case 12.1: First-Time Onboarding**
- [ ] New user opens CircleList for first time
- [ ] Verify: Onboarding modal appears
- [ ] Step 1: Welcome message
- [ ] Step 2: Create or Join buttons
- [ ] Step 3: Complete
- [ ] Verify: Onboarding only shows once (stored in AsyncStorage)

**Test Case 12.2: Onboarding - Skip**
- [ ] Open onboarding
- [ ] Tap outside modal or close button
- [ ] Verify: Modal closes
- [ ] Verify: Onboarding won't show again

---

## 🚀 **Week 4: Performance & Edge Cases**

### ✅ **Day 1: Performance Testing**

**Test Case 13.1: Feed Scroll Performance**
- [ ] Load feed with 50+ items
- [ ] Scroll rapidly up and down
- [ ] Verify: Smooth scrolling (60fps target)
- [ ] Verify: No lag or jank
- [ ] Verify: Memory usage stays reasonable

**Test Case 13.2: Large Circle**
- [ ] Create circle with 10+ members
- [ ] All members share diaries (100+ total)
- [ ] Open feed
- [ ] Verify: Feed loads in <2 seconds
- [ ] Verify: Pagination works smoothly

---

### ✅ **Day 2: Edge Cases**

**Test Case 14.1: Network Errors**
- [ ] Turn off WiFi mid-load → Should show error
- [ ] Turn off WiFi during share → Should show error
- [ ] Intermittent network → Should retry gracefully

**Test Case 14.2: Concurrent Actions**
- [ ] User A and User B share to same circle simultaneously
- [ ] Verify: Both shares succeed
- [ ] Verify: Feed shows correct order (by sharedAt timestamp)

**Test Case 14.3: Data Deletion**
- [ ] Share diary to circle
- [ ] Delete the diary from diary list
- [ ] Verify: Diary still appears in circle feed (denormalized data)
- [ ] ⚠️ **Design Decision**: Feed is snapshot at share time

**Test Case 14.4: Circle Deletion**
- [ ] User A creates circle
- [ ] User B joins
- [ ] User A leaves circle → Circle still exists (User B is still member)
- [ ] Both User A and User B leave → Circle remains in DB but inaccessible
- [ ] ⚠️ **Future Feature**: Circle cleanup/deletion

---

## 🌍 **Multi-language Testing**

### ✅ **Day 1: i18n Verification**

**Test Case 15.1: Switch Language**
- [ ] Set device to Chinese → All circle UI in Chinese
- [ ] Set device to English → All circle UI in English
- [ ] Verify: All 120+ translation keys work
- [ ] Verify: No "circle.xxx" keys displayed (missing translations)

**Test Case 15.2: Mixed Content**
- [ ] Chinese diary in English app → Should display correctly
- [ ] English diary in Chinese app → Should display correctly
- [ ] Verify: Font rendering correct (Lora for EN, NotoSerifSC for ZH)

---

## 📱 **Cross-Platform Testing**

### ✅ **iOS Specific**

**Test Case 16.1: iOS UI**
- [ ] Verify: Custom toast animation smooth
- [ ] Verify: Modal slide-in animation smooth
- [ ] Verify: Safe area insets respected (iPhone notch)
- [ ] Verify: Keyboard avoidance works in modals

**Test Case 16.2: iOS Permissions**
- [ ] First time: Push permission prompt appears
- [ ] Grant permission → Token registered
- [ ] Deny permission → No token, no notifications

---

### ✅ **Android Specific**

**Test Case 17.1: Android UI**
- [ ] Verify: Native toast appears correctly
- [ ] Verify: Material design ripple effects work
- [ ] Verify: Back button closes modals

**Test Case 17.2: Android Permissions**
- [ ] Android 13+: Push permission prompt appears
- [ ] Grant permission → Token registered
- [ ] Verify: Notification channel created

---

## 🔐 **Security Testing**

### ✅ **Authentication & Authorization**

**Test Case 18.1: JWT Token**
- [ ] Expired token → Should trigger refresh
- [ ] Invalid token → Should redirect to login
- [ ] No token → API calls should fail with 401

**Test Case 18.2: Circle Access Control**
- [ ] Non-member tries to access feed → Should fail
- [ ] Non-owner tries to get invite code → Should fail
- [ ] Member leaves circle → Can no longer access feed

---

## 📊 **Acceptance Criteria Summary**

| Feature | Status | Notes |
|---------|--------|-------|
| Create Circle | ⬜ | |
| Join Circle | ⬜ | |
| View Circle List | ⬜ | |
| View Circle Feed | ⬜ | |
| Share Diary | ⬜ | |
| Push Notifications | ⬜ | Physical device required |
| Rate Limiting | ⬜ | |
| Quiet Hours | ⬜ | |
| Multi-language | ⬜ | |
| Performance | ⬜ | 50+ items, smooth scroll |

---

## 🐛 **Bug Tracking**

Use this section to document any bugs found during testing:

| ID | Description | Severity | Status | Fix Commit |
|----|-------------|----------|--------|------------|
| | | | | |

---

## 📝 **Testing Sign-Off**

- [ ] All HIGH priority tests passed
- [ ] All MEDIUM priority tests passed
- [ ] All critical bugs fixed
- [ ] Performance meets targets
- [ ] Ready for production release

**Tester Name**: _________________

**Date**: _________________

**Signature**: _________________

---

## 🚨 **Rollback Plan**

If critical issues found after release:

1. Revert `feature/intimate-circle` branch merge
2. Rollback to v1.2.1 via OTA update
3. Disable Circle API endpoints
4. Notify users via in-app message

**Rollback Contact**: CTO @dengdan
