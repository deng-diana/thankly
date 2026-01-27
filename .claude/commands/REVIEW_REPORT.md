# Code Review Report

**Date**: 2026-01-25  
**Scope**: thankly mobile (recording safety, DiaryList, hooks, modals)  
**Review type**: Logging, Error Handling, TypeScript, Production Readiness, React/Hooks, Performance, Security, Architecture  

---

## ✅ Looks Good

- **Error boundaries**: `ErrorBoundary` used; async flows generally wrapped in try/catch
- **React Hooks**: `useEffect` cleanups (timers, subscriptions, `stopAllAudio`) and dependency arrays are in place
- **Auth**: Token refresh, `getAccessToken`, `handleAuthErrorOnly` used for API calls
- **Architecture**: Screens, hooks, services, components follow existing structure
- **i18n**: `t()`, `getFontFamilyForText` used; no hardcoded UI strings in reviewed code
- **No @ts-ignore**: None found in reviewed files

---

## ⚠️ Issues Found

### **[CRITICAL]** [useVoiceRecording.ts] – **FIXED** ✅  
**Issue**: `Audio.addAudioInterruptionListener` does not exist in expo-av. Calling it caused `TypeError: undefined is not a function` during `commitHookEffectListMount`, leading to empty diary list on app open + Sentry errors after OTA.

- **Fix**: Removed the `addAudioInterruptionListener` useEffect. Rely on `AppState` (background/inactive) to save draft on call/app switch; added a short comment explaining why the listener is not used.

---

### **[MEDIUM]** [useVoiceRecording.ts:50, 278, 318, etc.] – `any` in catch

**Issue**: Multiple `catch (error: any)` reduce type safety.

- **Fix**: Prefer `catch (error: unknown)` and narrow:
  ```ts
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`...`, msg);
  }
  ```

---

### **[MEDIUM]** [RecordingModal.tsx:966, 1033, etc.] – `any` in catch

**Issue**: Same use of `error: any` in catch blocks.

- **Fix**: Same as above; use `unknown` and narrow before using `error.message` or `error.code`.

---

### **[MEDIUM]** [DiaryListScreen.tsx:325–331] – `loadData` missing from deps

**Issue**: `useEffect` calls `loadData()` but dependency array is `[stopAllAudio]` only. `loadData` can be stale.

- **Fix**: Add `loadData` to deps:
  ```ts
  useEffect(() => {
    loadData();
    return () => { stopAllAudio(); };
  }, [loadData, stopAllAudio]);
  ```
  Ensure `loadData` is stable (e.g. `useCallback` with correct deps).

---

### **[LOW]** [mobile/src] – `console.log` / `console.warn` / `console.error` throughout

**Issue**: 600+ `console.*` usages. No shared logger or env-based filtering.

- **Fix**: Introduce a small logger (e.g. `__DEV__`-gated) and replace `console.*` in production paths. Lower priority than runtime bugs.

---

### **[LOW]** [authService.ts:868] – `// TODO: 实现token刷新逻辑`

**Issue**: TODO left in code.

- **Fix**: Either implement refresh or track in an issue and remove the TODO.

---

### **[LOW]** [DiaryListScreen.tsx:1421] – `{/* DEBUG: ... */}`

**Issue**: Debug comment in JSX.

- **Fix**: Remove or replace with a proper debug flag if needed.

---

## 📊 Summary

- **Files reviewed**: useVoiceRecording, RecordingModal, DiaryListScreen, useDiaryAudio, authService, diaryService, plus related components
- **Critical issues**: 1 (addAudioInterruptionListener) – **fixed**
- **High issues**: 0
- **Medium issues**: 3 (`any` in catch, `loadData` deps)
- **Low issues**: 3 (logging, TODO, DEBUG comment)

---

## Severity Levels

- **CRITICAL**: Security, data loss, crashes → addAudioInterruptionListener **fixed**
- **HIGH**: Bugs, performance, bad UX → none
- **MEDIUM**: Code quality, maintainability → `any`, deps
- **LOW**: Style, minor improvements → logging, TODO, DEBUG

---

**Recommendation**: Ship the fix for `addAudioInterruptionListener` and roll out a new OTA. Address MEDIUM items in a follow-up PR; LOW items as tech-debt.
