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
- Current git branch: `push_notifs`

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
