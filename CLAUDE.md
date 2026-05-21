# PocketBirds4 — Claude Context

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

## 🚨 Active Blocker: Play Store Keystore Mismatch (as of Apr 19 2026, end of session)

**Status:** Build v15 "Sheartail" succeeded but `eas submit` **failed** with a signing key mismatch. We cannot ship to Play Store until this is resolved.

**Root cause (likely):** During the FCM V1 debugging session, when credentials were cleared from the Expo dashboard, the original upload keystore was unlinked/deleted along with the FCM key. EAS then auto-generated a new keystore for the v15 build, which Play Store rejects because it doesn't match the upload key Google Play has on file.

**The keys:**
- **AAB was signed with (new, auto-generated):** SHA-1 `9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85` (EAS "Build Credentials Mwm5hIy734", created ~10:37 PM Apr 19)
- **Play Store expects:** SHA-1 `F4:D0:DD:2D:6D:C6:CE:5C:CB:FE:B2:C4:FD:EA:0D:63:7D:90:61:8F`
- **Previously-seen EAS keystore (in screenshot before the reset):** SHA-1 started `F2:C9...` ending `B4:30`. Does NOT match Play Store's expected either. May have been a secondary/intermediate keystore.

**What's no longer on EAS:** The old "Build Credentials VxuWsd7D-O" entry (alias `cc0ef95ade44f9166a80a815bb07e0a7`) — the CLI now shows only the new `Mwm5hIy734` entry.

**What's NOT locally available:** No `.jks`, `.keystore`, or `credentials.json` found anywhere in the project or `~/Downloads/` (besides the throwaway `android/app/debug.keystore`).

### Next session: start here

1. **Check Google Play Console app signing state.** Go to <https://play.google.com/console> → select PocketBirds → left nav → **Setup** → **App integrity** → **App signing**. Report back:
   - Is Play App Signing enabled?
   - What's the **app signing key certificate** SHA-1?
   - What's the **upload key certificate** SHA-1? (should be `F4:D0...61:8F`)
   - Is there a **"Request upload key reset"** button?

2. **Check release history.** Play Console → **Testing** → **Internal testing** → **Releases** tab. What's the highest versionCode that was actually *accepted* (not rejected)? User thinks the Play Store listing was never fully set up — if NO build has ever been accepted, Google may not have locked in an upload key yet and we'd have more flexibility.

### Likely recovery paths (pick based on Play Console findings)

- **Path A — Upload key never locked in:** If no build has been accepted into Play Console and the upload key isn't set, we can just rebuild with the current (new) keystore and submit; Play will accept it as the first upload key.
- **Path B — Upload key reset via Play Console:** If there's a "Request upload key reset" option, submit a PEM-encoded certificate from the new keystore. ~48 hour turnaround, but doable without Google Support.
- **Path C — Recover the original keystore:** Unlikely — it's not on EAS and not locally. Worth one more check of old Expo dashboard history before giving up.
- **Path D — Google Play Support ticket:** Last resort. Slow (~days) but they can reset the upload key.

### Uncommitted at end of session
- `release-names.csv` has dates added for Thorntail (Apr 16) and Sheartail (Apr 19). Committable but not blocking.
- Untracked: `.claude/`, `functions/app.json` — leave alone (local tooling / unknown origin).

### What IS working end of session
- Push notifications fully functional (both warm + cold-start nav to Friends tab, priority:high delivery, FCM V1 credentials).
- Build succeeded — the AAB `v9xEA9PRMaBm8S1vVxpwYX.aab` exists on EAS servers, just can't be uploaded to Play Store with the current keystore.
- master branch is at `3632a12`, push_notifs fully merged.

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

## Notable Details
- Login screen tagline: "please don't put birds in your pockets"
- Error messages have personality ("nice try guy, go again")
- New species detection triggers haptic buzz-buzz-BUZZ pattern
- Long press on a sighting card → delete with confirmation
- `lastLocation` is remembered and pre-filled on the Add Sighting screen
- Push notifications send when a friend logs a sighting (via Cloud Functions)
