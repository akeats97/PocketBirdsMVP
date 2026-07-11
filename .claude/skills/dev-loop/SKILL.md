---
name: dev-loop
description: How to test PocketBirds code changes live on Alex's phone (Android Expo dev client) and on the iOS Simulator. Use when running, hot-reloading, or debugging the app in a dev loop (npx expo start --dev-client, expo run:ios, sim screenshots/deep-links), NOT for Play Store / TestFlight release builds.
---

# Dev Loop (testing changes on Alex's phone)

For iterating on code changes, use the **Expo dev client on Alex's phone**, NOT the Play Store flow. The Play Store flow is for shipping releases to Alex and Victoria; the dev client is "save code on laptop, see it on phone in 2 seconds."

### One-time setup (updated May 24 2026)
- `expo-dev-client` is installed (in `package.json` deps).
- **The dev client and the Play Store build install side-by-side as two separate apps** on Android. Setup: `android/app/build.gradle` sets `applicationIdSuffix '.dev'` on the `debug` buildType, so the dev client uses `com.akeats97.pocketbirds.dev` and the Play Store build uses `com.akeats97.pocketbirds`. Android treats them as distinct apps so neither overwrites the other. The dev client is labeled `PocketBirds (dev)` via `android/app/src/debug/res/values/strings.xml`.
- `android/app/google-services.json` contains BOTH client entries (production package and `.dev` package), so FCM push works on both builds. If you regenerate `google-services.json`, make sure the new file still has both clients before committing.
- Earliest side-by-side build: pending (see below). Prior dev-client builds shared the production package id and overwrote the Play Store install. Anyone reproducing the previous behavior is on an outdated dev client APK.

### Daily loop
1. Phone and laptop must be on the **same wifi**.
2. From `/Users/alexkeats/Desktop/PocketBirds4/`, run:
   ```bash
   npx expo start --dev-client
   ```
3. Open the dev-client PocketBirds app on Alex's phone. It should auto-discover the running Metro server under "Development servers." Tap the project to connect.
4. If auto-discovery fails, tap "Enter URL manually" and type `http://<Mac LAN IP>:8081` (get the IP with `ipconfig getifaddr en0`).
5. JS bundle loads (10-20s first time, faster after). Edit code on laptop, hit save, phone hot-reloads in a second or two. If hot reload misses a change, shake the phone (or pull the notification shade) and tap **Reload**.

### Important caveats
- **Dev hits PRODUCTION Firebase.** There is no separate dev environment. Any sighting saved in the dev app writes to the real `pocketbirds` Firestore and fires real push notifications to Victoria. Be intentional about Save taps when testing. For pure UI testing, tap up to but not past Save, or use a junk test account.
- **Airplane mode is fine AFTER the bundle loads.** Once JS is running on the phone, you can toggle airplane mode to test offline behavior. But you need wifi back on to load any new code changes from Metro.
- **If you change `package.json` (add a new native module), you must rebuild the dev-client APK:**
  ```bash
  eas build --profile development --platform android --non-interactive
  ```
  Then uninstall the previous dev app on the phone and install the new one from the EAS install link.

### Why this exists
PocketBirds is a bare workflow app, so Expo Go cannot run it (native Firebase + FCM). Before this dev loop existed, the only way to test on phone was to do a full `eas build --profile production` + `eas submit` round trip, which took 15-30 min per iteration. The dev client gets that down to seconds.

---

## iOS Simulator Dev Loop (added Jun 8 2026)

Running the app on the iOS Simulator on Alex's Mac (alongside the Android dev client). First build is a full native compile (~10-15 min); after that, `npx expo start --dev-client` + hot reload, same as Android.

### First build
```bash
# One-time: CocoaPods (not preinstalled)
brew install cocoapods
# Build + install + launch on a booted iPhone sim
npx expo run:ios --device "iPhone 17 Pro"
```

### Gotchas (each cost real time on Jun 8 2026)
- **fmt / Xcode 26 build failure.** `fmt` 11.0.2 (bundled by RN 0.79) fails to compile under Xcode 26's Clang: `call to consteval function ... is not a constant expression` in `format-inl.h`. **Already fixed** by a Podfile `post_install` hook that patches `Pods/fmt/include/fmt/base.h` to force `FMT_USE_CONSTEVAL 0` (the header redefines that macro unconditionally, so a `-D` compiler flag does NOT work — the header must be patched). Idempotent, re-applied on every `pod install` (local and EAS). If iOS builds ever break on `fmt` again, check that hook survived.
- **Booted ≠ visible.** `npx expo run:ios` can boot the sim *device* headlessly (via `simctl`) without opening the **Simulator app window**, so nothing appears on screen. Fix: `open -a Simulator`. The avatar/app is running; the GUI just wasn't launched.
- **`expo run:ios` exits 1 at the very end with an `osascript ... "System Events"` error.** This is a macOS Automation-permission denial on the final window-focus AppleScript. It is **cosmetic** — the build/install/launch already succeeded. (Grant the terminal Automation access in System Settings → Privacy & Security → Automation to silence it.)
- **Loading the JS bundle into the dev client:** after launch you get the Expo dev-client launcher. Tap the `localhost:8081` row, or `xcrun simctl openurl <UDID> "com.akeats97.pocketbirds://expo-development-client/?url=http://<LAN-IP>:8081"` (an "Open in PocketBirds?" confirm dialog needs a manual tap — simctl can't tap).
- **Screenshot the sim** for verification: `xcrun simctl io <UDID> screenshot <path>`. Deep-link to a route with `xcrun simctl openurl <UDID> "com.akeats97.pocketbirds://<route>"` (e.g. `profile/<uid>`, `(tabs)/dex`).
- **No programmatic taps/typing on the sim (confirmed Jul 11 2026).** `simctl` has no touch injection, and both AppleScript System Events and `cliclick` are blocked because the terminal host lacks Accessibility permission ("osascript is not allowed assistive access"); idb/maestro/applesimutils are not installed. Verification can cover launch, deep-linked routes, and anything that renders without interaction (auto-firing sheets, initial states); interactive flows need Alex at the sim window or on his phone. If tap automation is ever wanted, Alex must grant Accessibility to the terminal app in System Settings.
- Same prod-Firebase caveat as Android. **Push/camera/real-GPS don't work on a simulator** (Apple limitation) — those need a real device / TestFlight.

The pod-install artifacts (`ios/PocketBirds4.xcodeproj/project.pbxproj`, `.xcworkspace/`, `Podfile.lock`, `PrivacyInfo.xcprivacy`) are machine-specific and regenerated by EAS — leave them uncommitted. Only the `Podfile` change (the fmt hook) is committed.
