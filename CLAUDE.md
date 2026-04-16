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

## Push Notification Status (as of Apr 16 2026)
Notifications are partially working. Full history in project memory.

- **Cloud Function (`onSightingAdded`):** Deployed and triggering correctly on new sightings
- **Token registration:** Fixed in v14 (Thorntail) — both Alex and Victoria now save tokens on app open
- **Delivery:** Still broken as of end of Apr 16 session. Expo push service returns `InvalidCredentials` when trying to forward to FCM. FCM V1 service account key uploaded to expo.dev at ~3:17 PM — not yet confirmed working due to likely propagation delay. **Next session: log a sighting and check Cloud Function logs to see if delivery succeeds.**

To query Firestore with admin access:
```bash
cd /Users/alexkeats/Desktop/PocketBirds4/functions
GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node -e "..."
```
Service account key: `~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json`

---

## Notable Details
- Login screen tagline: "please don't put birds in your pockets"
- Error messages have personality ("nice try guy, go again")
- New species detection triggers haptic buzz-buzz-BUZZ pattern
- Long press on a sighting card → delete with confirmation
- `lastLocation` is remembered and pre-filled on the Add Sighting screen
- Push notifications send when a friend logs a sighting (via Cloud Functions)
