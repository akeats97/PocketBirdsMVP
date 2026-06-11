# PocketBirds4 — Claude Context

## Product North Star

`PRD.md` (project root) is the product requirements / north-star doc: vision, bullseye user, core principles, anti-goals, mechanics, ethics, brand voice. **Read it before scoping a new feature, making a product or UX judgment call, or writing user-facing copy.** This file is the operational truth (what's currently true); PRD.md wins on questions of product direction. The always-true headlines: friends-only visibility is non-negotiable, leaderboards are friend-scoped never global, photos are celebrated never required, and the voice is cheeky about the app but respectful about the birds.

## Pending Design Work (Pocket Dex refactor, started May 21 2026)

Visual-language refactor in progress. Handoff lives at `/Users/alexkeats/Downloads/design_handoff_pocket_dex/` (tokens, migration doc, prompts, reference HTML).

**Status:** tokens + fonts landed. Screen-by-screen restyle pending.

**Deferred to follow-up sessions:**
- **Dex hero: DONE Jun 11 2026 (goal-ring redesign).** The three-equal-gold-circles hero was replaced by the PRD §7 Goodreads mechanic: a gold ProgressRing (`components/dex/ProgressRing.tsx`) filling toward an annual species goal (center = species this calendar year), with the three all-time stats (species emphasized in gold, sightings, photographed + camera icon) as quiet rows beside it. Tap the hero → goal sheet (presets 25/50/100/200 + custom). Goal stored as `dexGoal: { year, target }` on the user doc, mirrored to AsyncStorage (`dex.goal.v1`), via `app/services/goalService.ts` (`useDexGoal`). Stale-year goals deactivate; the hero invites a fresh goal each Jan 1. **Not built yet: a celebration when the goal is hit** (should reuse the milestone-takeover pattern).
- **IUCN conservation status strip** on every sighting card. Needs a one-time Wikidata dump per `design_handoff_pocket_dex/wikidata-dump.md` → ship `constants/iucnStatus.ts` + `statusFor(birdName)` helper. Status types + `STATUS_VISUAL` map already live in `constants/Colors.ts`. Also drives a small color dot on threatened-species Dex tiles.
- **Streak banner** on Field Journal. Alex flagged Victoria may dislike it; build behind a `Settings → show streaks` toggle, default off.
- **Leaderboard ribbon** on Friends. Alex said "no competition" — skip until requested, then gate behind a Settings flag default off.
- **Latin names in feed cards.** Mockups show them, but `Sighting` has no Latin field. Look up at render time from `constants/birdNames.ts` (same name key as IUCN lookup).
- **Dark mode.** Deferred until light-mode redesign settles. `theme` export in tokens already structured to swap palette values without touching consumers.

---

## Navigation restructure (Jun 11 2026)

Strava-style nav shipped; supersedes the "two feeds" layout (personal Log tab + Friends feed):

- **Tab order: Journal · Dex · Log (center) · Friends · You.** Landing page is the Journal (was the Add form).
- **Journal (`app/(tabs)/index.tsx`)** is the merged home feed: your sightings (SightingCard) + friends' (FriendSightingCard) in one day-grouped list. Friendless empty state has a Find Friends CTA (cold-start fix; real fix is the PRD's deep-link invite, still unbuilt).
- **Log** is the Add Sighting form behind the raised gold center circle (`logButton` style in `app/(tabs)/_layout.tsx`).
- **Friends (`app/(tabs)/friends.tsx`)** lost its feed and is now the flock hub: every friend plus a "You" row with species / sightings / photos counts, an **All time / This year** toggle (in the list-meta row, not the header), birder search, and per-friend notification bells. Sorted by species count, no rank styling (PRD: no shame). Future leaderboards/challenges/map land here.
- **You (`app/(tabs)/you.tsx`)** renders your own profile. The implementation moved from `app/profile/[uid].tsx` to **`components/profile/ProfileView.tsx`** (`uid` + `embedded` props); the stack route is now a thin wrapper. The AppHeader (no avatar anymore — the You tab replaced it) grows a **⋯ menu on the You tab only** (`youActions` prop): Edit profile / Hep / Log out, via the canonical BottomSheet.
- **Hep (`app/hep.tsx`)** is its own stack screen (the feedback feed: bug reports + feature requests, friends' and your own). Reached only from the You tab's ⋯ menu.
- `friend_sighting` push taps land on the Journal (`/(tabs)`), not the Friends tab (`app/_layout.tsx`).
- `FriendSightingsContext` now starts **empty** (the legacy mock sightings were removed; they'd flash in the merged feed) and dropped `filterByFriend` / `isFirstSightingForFriend`.

## Profiles, Venn Compare & Global-First (shipped Jun 6 2026)

- **Profile pages.** `app/profile/[uid].tsx` (friend / public / self) and `app/profile/[uid]/compare.tsx` (the Venn screen; math in `app/utils/compareLists.ts`, Jaccard overlap, same report/mystery/custom exclusions as the journal). Reached from Friends search results and the username pill on feed cards.
- **Friends tab.** Search is a full-page birder list (`searchUsers`, includes public strangers) that pushes profiles; the feed always shows everyone (the old friend-filter dropdown and Add button are gone, following happens via search → profile → Follow). Usernames are the sole identity.
- **Global-first.** The first sighting of a species app-wide gets `sighting.globalFirst = true`. **"First" = when the log was INPUT (`createdAt`), NOT the observation `date`.** Detection runs at Add-time (`sightingService.isGlobalFirstSpecies`, exact-name `limit 1` query); needs connectivity and is racy. Visual: a small gold trophy on the seen Dex tile and profile Dex chips. We deliberately did NOT recolor the whole tile (red read as "missing", gold hid the camera icon). Celebration: `GlobalFirstCelebration.tsx`. Backfill: `functions/backfillGlobalFirst.js`, idempotent, run once Jun 6 2026.
- **Milestones.** `constants/milestones.ts` fires at **1, 5, 10, 25, then every 50**. Reports / Mystery Bird / Kelsey are excluded from both milestone and global-first.
- Open follow-ups tracked in WORK_QUEUE.md: Q-3 (global-first pill on sighting cards) and Q-4 (verified sightings; consider gating global-first on verified once it exists).

---

## Release naming & builds

- In-app title is `Pocket Birds {CURRENT_RELEASE_NAME}` from `constants/release.ts`. Release names come from `release-names.csv`, ordered by **wingspan ascending**. Current building: **Tyrannulet** (Jun 9 2026); next after it is **Tyrant**. The CSV `Release Date` column = the actual ship date; leave it blank when rolling the name forward, fill it only when a build actually shipped.
- `eas.json`: `appVersionSource: "remote"` + `autoIncrement`, so Android `versionCode` / iOS `buildNumber` bump automatically per build (not stored in `app.json`). Profiles: `production` (AAB + the mandatory `macos-sequoia-15.6-xcode-26.2` image), `production-aab`, and **`apk`** (`autoIncrement`, `buildType: apk` — for **Firebase App Distribution**, NOT the Play Store).

### "Start our builds" — the standard recipe (when Alex says to kick off builds)

This is the full sequence Alex means by "start our builds". Run it in order:

1. **iOS build + auto-submit to TestFlight:** `eas build -p ios --profile production --auto-submit --non-interactive` (`--auto-submit` MUST be at build time; `ascAppId` 6772308812 is already in `eas.json`). Lands in the "Friends" external group.
2. **Android APK** (Firebase App Distribution, NOT Play Store): `eas build -p android --profile apk --non-interactive`. Grab the `.apk` artifact URL from the finished build.
3. **Release notes:** prepend a new dated section to `RELEASE_NOTES.md` covering **everything since the last build** (boundary = the previous "Add {name} release notes" commit; `git log <that-commit>..HEAD`). Match the existing structure (Builds · Headline · Play Store "What's new" · TestFlight "What's new" · What shipped (engineering) · Known issues · Post-ship steps). **The TestFlight notes are a "here's what shipped" announcement in the same style as the Play Store copy (NOT a QA "what to test" checklist)** — mirror the Play Store bullets and add any iOS-only items (e.g. iOS layout fixes). Exclude `WORK_QUEUE.md`-only "spec" commits and pure build-infra. Both builds auto-increment, so the build numbers come from the EAS output (e.g. iOS 9→10, Android vc24→25).
   - **Don't let a "Plus … polish" catch-all swallow real changes.** After drafting, audit EVERY code commit in the range (`git log <boundary>..HEAD` + check files touched) and ask "would a user notice this?" — if yes, it gets an explicit line in the Play Store / TestFlight copy, not just the engineering section. (Tyrannulet shipped with hoot-sheet UX, the Dex Mystery tile, the avatar fix, and the profile bell missing from the user-facing copy at first; this audit step is how that's avoided.)
   - **Play Store copy = Android audience; TestFlight copy = iOS audience.** iOS-only fixes (header/layout) go in TestFlight only, not the Play Store listing, and vice-versa.
4. **AFTER both builds succeed:** roll `constants/release.ts` `CURRENT_RELEASE_NAME` forward to the next CSV name, and stamp the **just-built** name's `release-names.csv` `Release Date` with today (we know it shipped). Do NOT roll before the builds upload — the build bakes in the current name, and a failed build should re-run under the same name. Then commit (release notes + roll + CSV).

- EAS server builds cost ~$1 each (so ~$2 for the pair) and the iOS auto-submit is outward-facing — both are pre-authorized when Alex explicitly says to build.
- **Snowcap (Jun 6 2026):** iOS build 8 / Android vc23. **Antwren (Jun 8 2026):** iOS build 9 / Android vc24. **Tyrannulet (Jun 9 2026):** iOS build 10 / Android vc25.

---

## Project Location
**This folder** (`/Users/alexkeats/Desktop/PocketBirds4/`) is the real, active project.

There is an old, incomplete copy at `/Users/alexkeats/Documents/Projects/PocketBirdsMVP/` — ignore it, it has no Firebase and is out of date.

---

## What This App Is
A React Native bird sighting logger for Alex and his wife. Users log bird sightings, see a Bird Dex of species they've spotted, and follow friends to see their sightings. Push notifications fire when a friend logs a sighting.

---

## Tech Stack
- **Expo ~53** with expo-router (file-based routing)
- **React Native 0.79.2**, React 19, TypeScript
- **Firebase** (project: `pocketbirds`)
  - Firebase Auth — email/password login
  - Firestore — sightings, users, friends data
  - Firebase Storage — sighting photos
  - Cloud Functions (`functions/index.js`) — push notifications on friend sightings
- **expo-notifications** — push notification registration and handling
- **expo-image-picker** — photo support on sightings
- **AsyncStorage** — offline cache for sightings
- **EAS** — builds and Play Store submissions

---

## Key Files
| File | Purpose |
|------|---------|
| `config/firebaseConfig.js` | Firebase init — exports `app`, `auth`, `db` |
| `app/index.tsx` | Redirects to `/(tabs)` (Journal) — do not put login logic here |
| `components/LoginScreen.tsx` | Login/signup form, rendered directly by `_layout.tsx` |
| `app/_layout.tsx` | Root layout — handles auth state, shows LoginScreen or AuthenticatedApp |
| `app/(tabs)/_layout.tsx` | Tab bar config |
| `app/(tabs)/index.tsx` | Journal — merged home feed (your + friends' sightings) |
| `app/(tabs)/add.tsx` | Add Sighting form (gold center Log button) |
| `app/(tabs)/dex.tsx` | Bird Dex — all species, seen/unseen status |
| `app/(tabs)/friends.tsx` | Friends hub — flock list w/ stats, search, Hep feedback view |
| `app/(tabs)/you.tsx` | You tab — own profile (thin wrapper over ProfileView) |
| `components/profile/ProfileView.tsx` | The profile screen implementation (self / friend / public) |
| `app/context/SightingsContext.tsx` | Sightings state — syncs Firestore + AsyncStorage |
| `app/context/FriendSightingsContext.tsx` | Friends' sightings state |
| `app/services/sightingService.ts` | Firestore read/write for sightings |
| `app/services/userService.ts` | Firestore user/friend management |
| `app/services/notificationService.ts` | Push notification registration + sending |
| `app/services/photoService.ts` | Photo upload to Firebase Storage |
| `app/profile/[uid].tsx` | Stack-pushed profile route — thin wrapper over ProfileView |
| `app/profile/[uid]/compare.tsx` | Venn "You & {name}" compare screen |
| `components/compare/CompareCard.tsx` | Overlap module shown on a profile |
| `app/utils/compareLists.ts` | Overlap math (Jaccard) + `speciesSet`/`sightingCount` |
| `app/utils/userDex.ts` | Per-user family-grouped Dex view (`buildUserDex`) |
| `app/components/GlobalFirstCelebration.tsx` | Gold takeover for app-first species |
| `functions/backfillGlobalFirst.js` | One-time global-first backfill (Admin SDK) |
| `functions/index.js` | Cloud Functions — triggers push notif on new friend sighting |

---

## Auth Flow
`_layout.tsx` listens to Firebase auth state. If logged out → renders `<LoginScreen />` directly (not via routing). If logged in → renders `<AuthenticatedApp />` which contains the expo-router Stack with `(tabs)`.

`app/index.tsx` is a redirect to `/(tabs)` — this prevents expo-router from showing the login screen to logged-in users when Android ignores `unstable_settings.initialRouteName`.

---

## Build & Deploy
Builds go to the **Google Play internal testing track**.

```bash
# Build AAB
eas build --platform android --profile production --non-interactive

# Submit to Play Store
eas submit --platform android --latest
```

Run these from `/Users/alexkeats/Desktop/PocketBirds4/`.

---

## Workflow
- Commit after every meaningful change
- Build + submit to Play Store once a batch of changes is ready
- Current git branch: `master` (push_notifs merged Apr 19 2026)

---

## Dev Loop (testing changes on Alex's phone)

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
- Same prod-Firebase caveat as Android. **Push/camera/real-GPS don't work on a simulator** (Apple limitation) — those need a real device / TestFlight.

The pod-install artifacts (`ios/PocketBirds4.xcodeproj/project.pbxproj`, `.xcworkspace/`, `Podfile.lock`, `PrivacyInfo.xcprivacy`) are machine-specific and regenerated by EAS — leave them uncommitted. Only the `Podfile` change (the fmt hook) is committed.

---

## Avatar "?" race (fixed Jun 8 2026)

Avatars could stick on "?" for accounts with a valid username: the launch-time `savePushToken` `setDoc(..., {merge:true})` can seed a token-only user doc into Firestore's offline cache, so a one-shot profile read resolved an empty `username`. Fixed in `AppHeader.tsx` + `profile/[uid].tsx` (refetch when auth resolves, retry with backoff, email-initial fallback for the avatar letter only). Friends on older shipped builds keep seeing "?" until they update.

---

## iOS / TestFlight

Live on TestFlight since May 2026, external "Friends" group. Bundle ID `com.akeats97.pocketbirds` (same as Android), App Store Connect app ID `6772308812`, direct link: <https://appstoreconnect.apple.com/apps/6772308812/testflight/ios>. New builds to the existing group usually skip Beta App Review unless a major capability changes. TestFlight builds expire 90 days after upload, so ship a refresh build at least quarterly.

### Architecture / config facts

- We use the Firebase JS SDK only (not @react-native-firebase). The committed `ios/PocketBirds4/GoogleService-Info.plist` is for forward compatibility, not active runtime use.
- Push path is Expo Push Service → FCM → APNs. The APNs auth key uploaded to Firebase (both dev and prod FCM slots) relays FCM → APNs; the second APNs key EAS created is unused for our flow.
- **iOS builds MUST use the Xcode 26+ EAS image**: `build.production.ios.image` is pinned to `macos-sequoia-15.6-xcode-26.2` in `eas.json`. Apple rejects older-SDK builds (error 90725) and the EAS default image is still too old, so this pin is mandatory.
- **Credentials (all in Alex's 1Password; restore from there if EAS ever loses them):** APNs Auth Key `6TBT96JT76` (Team `WB8PNB2CCR`); ASC API Key `GFYGV5D864` (Issuer `877b4389-81c0-4cd8-8f5e-7e7a7f506e19`, stored on EAS servers, used automatically on submit); EAS-managed distribution cert + provisioning profile (expire 2027-05-22).
- Privacy / deletion URLs (live, GitHub Pages on `akeats97/PocketBirdsMVP`): `/PRIVACY` and `/DELETION`.

### Known iOS bugs (found June 3 2026, fix paths in WORK_QUEUE.md)

- **Bug 6:** Android → iOS push is broken. iOS throws `no valid "aps-environment" entitlement string found for application`; the EAS provisioning profile is not embedding the push entitlement. (iOS → Android works, the sender needs no entitlement.)
- **Bug 7:** the location feature crashes the app on iOS (likely missing `NSLocationWhenInUseUsageDescription`).

### Editing native iOS config (gotchas learned Jun 3 2026)

- **NEVER validate a plist with `plutil -extract <key> <fmt> <file>`.** Without `-o -`, `-extract` REWRITES the file in place with just the extracted value, silently destroying it. On Jun 3 2026 this collapsed `ios/PocketBirds4/Info.plist` to a single `["remote-notification"]` line, which got committed and broke the iOS build (`Failed to parse Info.plist`). For read-only checks use ONLY `plutil -lint <file>` or `plutil -p <file>`. To extract to stdout, you must pass `-o -`.
- **Adding an iOS entitlement requires regenerating the provisioning profile.** When `aps-environment` was added to `PocketBirds4.entitlements`, the first build failed at codesign: the existing profile `V4H2K892QC` (generated May 22) didn't grant Push Notifications. A profile is a frozen snapshot; Xcode requires every declared entitlement to be granted by the profile. Fix: run an **interactive** `eas build -p ios --profile production` (or `eas credentials -p ios`) so EAS authenticates to Apple (Apple ID + 2FA), enables the capability on the App ID, and re-issues the profile. Non-interactive builds skip Apple auth and can't do this. One-time per new capability; EAS reuses the fixed profile afterward.
- **`eas submit -p ios` needs `ascAppId` in `eas.json`** (`submit.production.ios.ascAppId = "6772308812"`). Without it the submit aborts asking for the ASC app id. The ASC API key itself is stored on EAS servers and used automatically.
- Bare-workflow reminder: `app.json` `ios.infoPlist` and config-plugin permission strings are NOT applied unless `expo prebuild` runs (which we never do). The committed `ios/PocketBirds4/Info.plist` + `.entitlements` are the source of truth — edit them directly when adding native permissions/capabilities.

---

## Play Store Keystore

The original upload key was permanently lost; a Play Console upload-key reset took effect May 23 2026. The current upload key is the EAS keystore (SHA-1 `9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85`). **The .jks file plus all three passwords are backed up in Alex's 1Password.** If EAS ever loses credentials, restore from 1Password instead of letting EAS auto-generate a new keystore (avoids another reset cycle).

---

## Android / Native Build Notes
- This is a **bare workflow** Expo app — there is a real `android/` directory. Expo's managed workflow assumptions do NOT apply.
- `google-services.json` must live at `android/app/google-services.json` (not project root). The `app.json` `googleServicesFile` field is ignored when an `android/` directory is present.
- The `com.google.gms.google-services` Gradle plugin must be applied explicitly: classpath in `android/build.gradle`, plugin in `android/app/build.gradle`.
- The app uses the **Firebase JS SDK** (not `@react-native-firebase`) for Firestore and Auth. `google-services.json` is only needed for the native FCM layer used by `expo-notifications`.

---

## Push Notifications — Working Setup (as of Apr 19 2026)
End-to-end confirmed: Alex → Victoria and Victoria → Alex both deliver.

Three things must all be in place. If push breaks, check in this order:

1. **`google-services.json` at `android/app/google-services.json`** (bare workflow — project-root path is ignored). Gradle plugin applied: classpath in `android/build.gradle`, `apply plugin: "com.google.gms.google-services"` in `android/app/build.gradle`.

2. **Firebase service account IAM role: "Firebase Messaging API Admin"** must be granted to `firebase-adminsdk-fbsvc@pocketbirds.iam.gserviceaccount.com`. The default Firebase Admin SDK roles are NOT sufficient for Expo's FCM V1 path. Add at <https://console.cloud.google.com/iam-admin/iam?project=pocketbirds>.

3. **FCM V1 service account key uploaded to Expo via the CLI** (not the dashboard — dashboard upload got stuck in a broken state for 3 days):
   ```
   eas credentials -p android
   → production → Google Service Account
   → Manage your Google Service Account Key for Push Notifications (FCM V1)
   → Set up a Google Service Account Key for Push Notifications (FCM V1)
   → Upload a new service account key
   ```
   Key file: `~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json`. **Do NOT use "Push Notifications (Legacy)"** — that's the deprecated FCM Legacy API.

Symptom when broken: Expo push API returns `InvalidCredentials` with wording "Unable to retrieve the FCM server key". Despite "server key" wording, this is an FCM V1 IAM/upload issue, not legacy.

**Architecture note:** We send via Expo's push service (not direct FCM/`admin.messaging()`). Considered migrating to direct FCM but kept Expo because iOS is planned — Expo's unified abstraction saves us from setting up APNs separately.

### Debugging

Push delivery is a 4-layer pipeline (app registers token → Cloud Function → Expo push API → FCM → device). The layer-by-layer diagnostic playbook, including the manual curl send, push receipts, admin Firestore queries, and the direct FCM V1 auth test, lives in **`docs/push-debugging.md`**. Read it before guessing at a push failure.

---

## Location / Places (added May 20 2026)

Sightings can now carry optional GPS coordinates alongside the freeform location label.

**Data shape:**
- `Sighting.coordinates?: { latitude, longitude, accuracy?, capturedAt? }` (see `app/types.ts`)
- `SightingsContext.lastLocation` is now `{ label: string, coordinates? }` (used to be a bare string — there's an AsyncStorage migration for the legacy shape).

**Services:**
- `app/services/locationService.ts` — wraps `expo-location` for current GPS fix + reverse-geocode. Reverse-geocode is FREE (uses native OS geocoders). Returns null on any failure so callers don't need error handling.
- `app/services/placesService.ts` — wraps Google Places Autocomplete + Place Details. **Costs money** (within the $200/mo Google Maps free tier at our scale). API key in `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` env var.

**Google Places API setup:**
- Key lives in `.env` (gitignored) as `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`. Loaded by Expo at build time.
- GCP project is `pocketbirds` (same as Firebase). **The key is currently UNRESTRICTED in GCP** (confirmed May 24 2026). Open TODO in `WORK_QUEUE.md` to lock it down. When restricted, both `com.akeats97.pocketbirds` (production) and `com.akeats97.pocketbirds.dev` (dev client) need allowlist entries, both signed with EAS keystore SHA-1 `9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85`.
- Only the **classic** "Places API" is enabled (NOT "Places API (New)" — the placesService code uses the classic endpoints).
- For EAS production/dev builds, also need: `eas env:create --scope project --visibility plaintext --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value '<key>'`. Local `.env` only covers `npx expo start`.

**Add Sighting UX:**
- Location field has a crosshair "locate" icon (Ionicons `locate`) inside the input on the right. Tap → permission prompt JIT → GPS fix → reverse-geocode → fills label + attaches coords.
- Typing into the field triggers debounced (300ms) Google Places autocomplete biased to `lastLocation.coordinates` (if available). Suggestion tap fetches Place Details for coords.
- Coords are explicitly user-initiated. No silent GPS capture on save.
- Free-typed labels with no suggestion/locate tap save with no coords (label only).

**SightingCard:** the location pin icon tints green when `coordinates` are attached, default gray otherwise. Subtle visual cue for verification.

---

## Bird Taxonomy / Search Perf

- Bird list is **IOC World Bird List v15.2**, 11,227 species, stored in `constants/birdNames.ts` (taxonomic order).
- Attribution is mandatory under IOC's license — shown as a small footer on the Bird Dex tab. Don't remove it.
- For hot-path search (Add Sighting suggestions), use `constants/birdNamesLower.ts`. It exports:
  - `birdNamesLower` — lowercase copy of `birdNames`, parallel array
  - `birdNamesAlpha` — alphabetically-sorted copy of `birdNames` (taxonomic order is lost — this is purely a search index)
  - `birdNamesAlphaLower` — lowercase of `birdNamesAlpha`
- The search pattern in `add.tsx` iterates `birdNamesAlpha` with tiered early-exit (prefix > word-start > substring, cap 20). No per-keystroke sort. Re-use this pattern for any other "filter the bird list" feature.
- Legacy name handling: existing sightings logged under old AOS-style names (e.g. "Bank Swallow") were migrated in Firestore to IOC equivalents (e.g. "Sand Martin") in the May 20 session. Dex code is also resilient: any species the user has logged appears even if its name isn't in the canonical list.

---

## UI Conventions — Hard shadow rule (added Jun 11 2026)

**The ink offset shadow (`HardShadow` in `components/SightingCard.tsx`) marks raised surfaces sitting directly on the cream page: cards, inputs, primary/peer action buttons (Save Sighting, Follow pill, search bar, stat strip). Inline elements living inside another surface (Dex chips, feed-card tags, 1ST badge, list-row controls like the connections-row bell) stay flat: border only, no shadow.** When two same-rank controls sit side by side on the page, they must match (both raised or both flat) — a flat control next to a raised peer reads as a mistake.

## UI Conventions — Modal animation rule (added Jun 9 2026)

**Every bottom sheet / action sheet must use the app's standard sheet motion: the content slides UP from the bottom while the translucent backdrop just FADES in. The scrim never slides.** On dismiss, the backdrop blinks out fast while the content slides back down.

- **Canonical implementation: `components/BottomSheet.tsx`.** Use it for any new sheet — it owns the scrim + slide mechanics (RN `Modal animationType="none"` + a reanimated `translateY` spring on the content, with `backdropOpacity` faded separately via `withTiming`, and a `rendered` flag that keeps the Modal mounted through the exit). Children own their own look + layout (including bottom safe-area padding).
- **Do NOT use `Modal animationType="slide"`** (it slides the scrim along with the content) **or `animationType="fade"`** for sheets (it pops the content with no upward motion). These are the exact wrong behaviors this rule exists to prevent.
- `components/community/ProposeSheet.tsx` is the reference for a richer sheet: it mirrors this same motion and adds gesture-handler drag-to-dismiss on a grabber. Match it when a sheet needs to be draggable.
- **Exceptions:** centered confirmation dialogs (Alert-style, e.g. the Dex region picker) may fade in place — they aren't bottom sheets. Anchored popovers (e.g. the sighting-detail ⋯ menu) aren't RN Modals and are out of scope.

## Notable Details
- Login screen tagline: "please don't put birds in your pockets"
- Error messages have personality ("nice try guy, go again")
- New species detection triggers haptic buzz-buzz-BUZZ pattern
- Long press on a sighting card → delete with confirmation
- `lastLocation` is remembered and pre-filled on the Add Sighting screen
- Push notifications send when a friend logs a sighting (via Cloud Functions)

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
