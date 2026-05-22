# PocketBirds4 — Claude Context

## Pending Design Work (Pocket Dex refactor, started May 21 2026)

Visual-language refactor in progress. Handoff lives at `/Users/alexkeats/Downloads/design_handoff_pocket_dex/` (tokens, migration doc, prompts, reference HTML).

**Status:** tokens + fonts landed. Screen-by-screen restyle pending.

**Deferred to follow-up sessions:**
- **Dex hero stats card design iteration.** Three stats now live (species / sightings / photographed) and the milestone subtitle was removed. Current rendering uses three equal gold circles side by side with cream labels below; Alex is not happy with the result — feels too busy / repetitive / loses hierarchy. Next iteration should explore alternatives that preserve the original "celebratory gold circle" feel while still surfacing all three numbers. Options to try: keep one prominent species circle with sightings + photographed as smaller side-stats; use a single card with a primary number and two secondary; or three stat blocks but with different visual weight per stat. The "photographed" stat is intentionally tied to the small yellow camera icon now showing on Dex tiles (committed) — keep that visual link intact.
- **IUCN conservation status strip** on every sighting card. Needs a one-time Wikidata dump per `design_handoff_pocket_dex/wikidata-dump.md` → ship `constants/iucnStatus.ts` + `statusFor(birdName)` helper. Status types + `STATUS_VISUAL` map already live in `constants/Colors.ts`. Also drives a small color dot on threatened-species Dex tiles.
- **Streak banner** on Field Journal. Alex flagged Victoria may dislike it; build behind a `Settings → show streaks` toggle, default off.
- **Leaderboard ribbon** on Friends. Alex said "no competition" — skip until requested, then gate behind a Settings flag default off.
- **Latin names in feed cards.** Mockups show them, but `Sighting` has no Latin field. Look up at render time from `constants/birdNames.ts` (same name key as IUCN lookup).
- **Dark mode.** Deferred until light-mode redesign settles. `theme` export in tokens already structured to swap palette values without touching consumers.

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
| `app/index.tsx` | Redirects to `/(tabs)` — do not put login logic here |
| `components/LoginScreen.tsx` | Login/signup form, rendered directly by `_layout.tsx` |
| `app/_layout.tsx` | Root layout — handles auth state, shows LoginScreen or AuthenticatedApp |
| `app/(tabs)/_layout.tsx` | Tab bar config |
| `app/(tabs)/index.tsx` | Field Journal — personal sightings list |
| `app/(tabs)/add.tsx` | Add Sighting form |
| `app/(tabs)/dex.tsx` | Bird Dex — all species, seen/unseen status |
| `app/(tabs)/friends.tsx` | Friends tab — search, follow, activity feed |
| `app/context/SightingsContext.tsx` | Sightings state — syncs Firestore + AsyncStorage |
| `app/context/FriendSightingsContext.tsx` | Friends' sightings state |
| `app/services/sightingService.ts` | Firestore read/write for sightings |
| `app/services/userService.ts` | Firestore user/friend management |
| `app/services/notificationService.ts` | Push notification registration + sending |
| `app/services/photoService.ts` | Photo upload to Firebase Storage |
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

### One-time setup (already done as of May 20 2026)
- `expo-dev-client` is installed (in `package.json` deps).
- The dev-client APK has been built via EAS and installed on Alex's phone. It appears as a separate app icon alongside the normal Play Store version of PocketBirds.

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

## iOS / TestFlight Setup — in Apple Beta App Review (May 22 2026)

Goal: ship PocketBirds to friends' iPhones via TestFlight. Bundle ID `com.akeats97.pocketbirds` (same as Android). App Store Connect app ID `6772308812`. Plan file: `~/.claude/plans/i-want-my-friends-humming-lighthouse.md`.

### Current state (May 22 2026, ~5:00 PM EDT)

**Waiting on:** Apple Beta App Review of the first external-tester build. Expected 24–48h. Until approved, external testers (Victoria + any other friends added to the "Friends" External Group) will see "no builds available" in TestFlight. Subsequent builds to the same group usually skip review unless a major capability changes.

**Where the build is:** App Store Connect → PocketBirds → TestFlight → External Testing → Friends group. Build 1.0.0 (3) is in review. Direct link: <https://appstoreconnect.apple.com/apps/6772308812/testflight/ios>.

### Done so far

**Apple Developer + Firebase:**
- Apple Developer Program enrolled and approved May 22 2026.
- App ID `com.akeats97.pocketbirds` registered with Push Notifications capability.
- App Store Connect app PocketBirds (SKU `pocketbirds-ios`, ID `6772308812`).
- Free Apps Agreement accepted in Agreements, Tax, and Banking.
- Firebase iOS app added at <https://console.firebase.google.com/project/pocketbirds>, bundle `com.akeats97.pocketbirds`. `GoogleService-Info.plist` committed to `ios/PocketBirds4/`.

**Credentials (all stored in Alex's 1Password, originals still in `~/Downloads/` for next session convenience — delete after final keystore migration):**
- **APNs Auth Key** (Firebase → APNs relay): Key ID `6TBT96JT76`, Team ID `WB8PNB2CCR`. .p8 uploaded to BOTH the development and production slots in Firebase Cloud Messaging.
- **App Store Connect API Key** (for `eas submit -p ios`): Key ID `GFYGV5D864`, Issuer ID `877b4389-81c0-4cd8-8f5e-7e7a7f506e19`, role App Manager. EAS has stored these and will reuse on future submits.
- **EAS-managed**: Apple Distribution Certificate (serial `192C24093D549D4CDA4BCF6FCDF0F32F`, expires 2027-05-22), Provisioning Profile (`V4H2K892QC`, expires 2027-05-22). EAS also created a second APNs key (uses team's second slot) — independent from Firebase one and unused for our flow.

**App config landed (committed):**
- `app.json` ios block: bundleIdentifier, googleServicesFile path, infoPlist.UIBackgroundModes=`["remote-notification"]`, NSPhotoLibraryUsageDescription.
- `eas.json`: `submit.production.ios` configured; **`build.production.ios.image` pinned to `macos-sequoia-15.6-xcode-26.2`** — Apple now requires apps to be built with Xcode 26 / iOS 26 SDK (rejection code 90725). Default EAS image is still Xcode 16.4, so this pin is mandatory for any future iOS build.
- `ios/PocketBirds4/GoogleService-Info.plist` committed. Not wired into the Xcode project (no PBXFileReference); push works without it since Expo → FCM → APNs doesn't need native Firebase iOS SDK.
- App icon + splash redone in cream `#fdf6e5` with bold black "PB" wordmark.

**Privacy / Deletion URLs (live, GitHub Pages on `akeats97/PocketBirdsMVP`):**
- <https://akeats97.github.io/PocketBirdsMVP/PRIVACY>
- <https://akeats97.github.io/PocketBirdsMVP/DELETION>

**Build + submit history (May 22 2026):**
- Build 2 (Xcode 16.4): rejected at submission with error 90725 (SDK too old). EAS image pin added.
- Build 3 (Xcode 26.2): built clean, submitted to App Store Connect via `eas submit`, accepted by Apple, finished processing, added to "Friends" External Group, submitted for Beta App Review.

### Next steps (in order)

1. **Wait for Beta App Review email from Apple.** 24–48h typical for first review.
2. **When approved:** Victoria + any other invited friends get a TestFlight invite email. They install TestFlight from the App Store, accept invite, install PocketBirds.
3. **Verify push notifications work end-to-end on iOS** (the EAS-generated provisioning profile should include the push entitlement, but it's untested). Test flow: log in on iOS device → check `users/{uid}.expoPushToken` is populated in Firestore → have an Android user (Victoria's existing account) log a sighting → push should land on the iOS device within ~10s. Use the layer-by-layer pipeline in the "Push Notifications — Working Setup" section of this file if it doesn't.
4. **Add more friends to the Friends External Group** as needed. They'll get builds immediately (no re-review).
5. **Re-build + re-submit** whenever shipping new features. Build cadence ~quarterly minimum since TestFlight builds expire 90 days after upload.

### Architecture refresher (so future-Claude doesn't re-derive)

- We use Firebase JS SDK only (not @react-native-firebase). The iOS plist is committed for forward compatibility, not active runtime use.
- Push notifications path is Expo Push Service → FCM → APNs. The APNs auth key in Firebase is what relays FCM → APNs. EAS's own APNs key is unused for our flow.
- iOS builds MUST use the Xcode 26+ EAS image (pinned in eas.json). Apple rejects Xcode 16 builds since May 2026.
- Builds expire 90 days after upload in TestFlight. Plan on a refresh build at least quarterly to keep external testers running.
- Two .p8 secrets in 1Password: APNs (`AuthKey_6TBT96JT76.p8`) and ASC API (`AuthKey_GFYGV5D864.p8`). Restore from 1Password if EAS ever loses credentials.

---

## Play Store Keystore — Recovery in progress (resolves May 23 2026)

Path A (upload key reset via Play Console) was submitted and approved May 21 2026. The new upload key (the EAS keystore "Build Credentials Mwm5hIy734", SHA-1 `9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85`) becomes valid in Play Console on **May 23 2026 at 10:47 AM UTC (~6:47 AM EDT)**.

**After that timestamp:** uploads work normally. The AAB from build `bcl6tdi7c` is already signed with the right keystore — just upload it to Play Console internal testing. No rebuild needed.

**Original keystore status:** the original upload key (SHA-1 `F4:D0:DD:2D:6D:C6:CE:5C:CB:FE:B2:C4:FD:EA:0D:63:7D:90:61:8F`) is permanently lost. Was confirmed missing from EAS, local disk, iCloud, Time Machine, and Desktop Junk in the May 21 session. After the reset takes effect, Play Store no longer expects it.

**Keystore backup:** Alex saved the .jks file + all three passwords (keystore password, key alias, key password) to his 1Password as of May 21. If EAS ever loses credentials again, restore from 1Password before letting EAS auto-generate yet another keystore — that avoids the whole reset cycle.

The leftover `release-names.csv` dates for Thorntail (Apr 16) and Sheartail (Apr 19) were committed during the May 20 session.

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

### Debugging methodology

Push delivery is a 4-layer pipeline. Isolate the broken layer by testing each one in order — don't guess, probe.

```
[1] App registers token → [2] Cloud Function fires → [3] Expo push API → [4] FCM → device
```

**Layer 1 — Token registration:** Check Firestore `users/{uid}` for a non-null `expoPushToken` and recent `lastTokenUpdate`. If missing: native FCM isn't initializing on device (check google-services.json placement + Gradle plugin) or permissions were denied.

**Layer 2 — Cloud Function:** `firebase functions:log --only onSightingAdded -n 50`. Look for "Found push token for follower" lines. If function isn't firing or not finding tokens, problem is in `functions/index.js` or the follows query.

**Layer 3 — Expo push API:** Skip the function entirely and send a push manually via curl. This is the critical diagnostic trick — it isolates the Expo↔FCM layer from your own code.
```bash
curl -s -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/send \
  -d '{"to":"ExponentPushToken[...]","title":"test","body":"hi","channelId":"default"}'
```
Expected: `{"data":{"status":"ok","id":"<ticket>"}}`. If `status: error` with `InvalidCredentials`, the problem is your FCM V1 credential setup at Expo (IAM role or upload path — see above).

**Layer 4 — FCM delivery:** Push tickets (from send) only confirm Expo accepted the payload. Push **receipts** confirm FCM actually delivered it. Wait 5+ seconds after send, then:
```bash
curl -s -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/getReceipts \
  -d '{"ids":["<ticket-id-from-send>"]}'
```
Expected: `{"data":{"<ticket>":{"status":"ok"}}}`. If receipt has an error (e.g. `DeviceNotRegistered`), the user's token is stale — they need to reopen the app to re-register.

### Other commands

Query Firestore with admin:
```bash
cd /Users/alexkeats/Desktop/PocketBirds4/functions
GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node -e "..."
```
Test that the service account key itself works against FCM V1 directly (rules out IAM issues independent of Expo):
```bash
cd /Users/alexkeats/Desktop/PocketBirds4/functions
GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node -e "
const {GoogleAuth} = require('google-auth-library');
(async () => {
  const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/firebase.messaging']});
  const token = await (await auth.getClient()).getAccessToken();
  const res = await fetch('https://fcm.googleapis.com/v1/projects/pocketbirds/messages:send', {
    method: 'POST', headers: {'Authorization': 'Bearer ' + token.token, 'Content-Type': 'application/json'},
    body: JSON.stringify({validate_only: true, message: {token: 'bogus', notification: {title: 't', body: 'b'}}})
  });
  console.log(res.status, await res.text());
})();
"
```
Expected: `400 ... INVALID_ARGUMENT` (the bogus token is rejected, but auth succeeded). If you see `403 PERMISSION_DENIED`, the service account lacks the Firebase Messaging API Admin role.

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
- GCP project is `pocketbirds` (same as Firebase). Key restricted by Android package `com.akeats97.pocketbirds` + SHA-1 of the EAS keystore.
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

## Notable Details
- Login screen tagline: "please don't put birds in your pockets"
- Error messages have personality ("nice try guy, go again")
- New species detection triggers haptic buzz-buzz-BUZZ pattern
- Long press on a sighting card → delete with confirmation
- `lastLocation` is remembered and pre-filled on the Add Sighting screen
- Push notifications send when a friend logs a sighting (via Cloud Functions)
