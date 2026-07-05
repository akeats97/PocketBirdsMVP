# RNFirebase Migration (Firebase JS SDK -> @react-native-firebase)

Branch: `rnfirebase-migration`. Started Jul 5 2026.

## Why

The Firebase JS SDK has no disk persistence on React Native (its persistent
cache needs IndexedDB, which is web-only). Every cold start re-downloads all
Firestore data over the network, which is why the Field Journal loads in
chunks: own sightings hydrate instantly from AsyncStorage while friends'
sightings arrive seconds later. The native SDK (@react-native-firebase) has
disk persistence on by default: every query paints from disk immediately and
reconciles with the server in the background. It also queues offline writes
natively and uses gRPC instead of the WebChannel transport (whose half-open
hangs forced `experimentalAutoDetectLongPolling`).

## Agreed decisions (Alex, Jul 5 2026)

- One-time re-login after updating is acceptable (sessions do not transfer
  between the JS SDK and the native SDK). Call it out in release notes.
- **Doradito is the migration build.** Scrub-Tyrant (iOS 15 / Android vc30) is
  the known-good fallback release.
- Scope is behavior-preserving: the hand-rolled offline machinery in
  `SightingsContext` (pending creates / updates / deletions, AsyncStorage
  cache, merge logic) is NOT touched. Simplifying it to lean on native
  offline writes is a separate future project, only after this has soaked.

## Safety properties

**Live users are never impacted before install.** The migration is 100%
client-side: no Firestore schema changes, no security-rules changes, no Cloud
Function changes, no change to the Expo push pipeline. Old builds and the
migrated build run against the same backend simultaneously.

**Rollback at any stage = ship from master.** Master stays shippable
throughout. Because the backend never changes, aborting means shipping the
next regular release from master. After the migration build has shipped,
"rollback" means building master with a bumped version (stores cannot
downgrade, but old-SDK builds still work against the untouched backend).
The only per-user cost of a roll-forward-then-back is signing in again.

## Phases

### Phase 0: native scaffolding, zero behavior change  [IN PROGRESS]

Native SDK installed and initialized but unused; JS SDK still drives
everything. This front-loads the riskiest part (iOS static frameworks) at
near-zero sunk cost.

- [x] Branch `rnfirebase-migration`
- [x] `npm install @react-native-firebase/{app,auth,firestore,storage}` (v25.1.0)
- [x] iOS: `ios.useFrameworks: static` in `Podfile.properties.json`,
      `$RNFirebaseAsStaticFramework = true` in Podfile
- [x] iOS: `FirebaseApp.configure()` + `import FirebaseCore` in AppDelegate.swift
- [x] iOS: `GoogleService-Info.plist` added to the app target's Copy Bundle
      Resources (was committed but NOT referenced by the Xcode project; without
      this `FirebaseApp.configure()` fails at launch). Added via the xcodeproj
      gem against the clean committed pbxproj so the commit carries only the
      plist change, not pod-install noise.
- [x] `pod install` passes with static frameworks; fmt/Xcode 26 patch survived
- [x] iOS simulator build (`npx expo run:ios`) compiles and the app runs
      (Jul 5: booted on iPhone 17 Pro sim, session persisted, Journal feed
      loading live Firestore data; FirebaseApp.configure() clean)
- [x] Android debug build compiles and runs (google-services.json + gradle
      plugin were already in place for both package ids; first attempt hit a
      corrupt empty NDK stub at ~/Library/Android/sdk/ndk/27.1.12297006 from
      May 2025, deleted, gradle re-provisioned the NDK)
- [x] App smoke-tested on Android (Jul 5, Medium_Phone_API_36.0 emulator:
      logcat shows "FirebaseInitProvider: FirebaseApp initialization
      successful" + "ReactNativeFirebaseApp: received application context";
      login screen renders; JS SDK still active). Android deep-link scheme is
      `pocketbirds4://` (not the bundle id). NOTE: this emulator image's Play
      services is outdated (needs 261200000, has 251833035) — update or use a
      newer image before Phase 2/3 native-Firestore testing; real devices fine.

**Phase 0 gate: PASSED (Jul 5 2026). Both platforms compile and run with the
native SDK initialized and idle. Go for Phase 1.**

Go/no-go gate: if static frameworks breaks the iOS build irrecoverably, delete
the branch and reconsider.

### Phase 1: auth cutover

Swap `config/firebaseConfig.js` and the ~6 auth call sites (`LoginScreen`,
`_layout`, services using `auth.currentUser`) to `@react-native-firebase/auth`.
RNFirebase's modular API mirrors `firebase/auth`. Everyone signs in once after
updating. `getReactNativePersistence`/AsyncStorage auth plumbing goes away
(native SDK persists sessions itself).

### Phase 2: Firestore + Storage call sites

- 11 files import `firebase/firestore`; the modular API mirrors the JS SDK, so
  this is largely import/handle swaps. Keep all app logic identical.
- `photoService`: JS `uploadBytes(blob)` becomes native `putFile(localPath)`.
- Drop `experimentalAutoDetectLongPolling` (JS-SDK-specific; native uses gRPC).
- Keep the `firebase` npm package installed until the very end, then remove it
  in its own commit (easy to revert).

### Phase 3: verification (dev clients, both platforms)

- [ ] Login / signup / logout (incl. listener teardown: no permission errors
      at logout under the strict rules)
- [ ] Journal feed: own + friends, day grouping, pull-to-refresh
- [ ] NEW WIN: cold start in airplane mode paints the full merged feed from
      the native disk cache
- [ ] Add sighting online; add offline then reconnect and sync (idempotent-id
      path); edit; delete; offline edit/delete queues
- [ ] Photo attach + upload; photo GPS read flow (unrelated code, but rebuilt
      native app must retain the expo-image-picker patch behavior)
- [ ] Hoots, comments, Mystery Bird proposals (live snapshots)
- [ ] Profiles, compare screen, Dex, Species Guide
- [ ] Push end-to-end BOTH directions (Android <-> iOS); token registration
      writes to Firestore via the new SDK
- [ ] New-species haptic + milestone + global-first detection
- [ ] Coexistence: migrated build (Alex) + shipped Scrub-Tyrant build
      (Victoria) against the same backend at the same time

### Phase 4: staged ship (Doradito)

1. Firebase App Distribution APK to Alex's phone; daily-drive it several days.
2. iOS build uploaded to TestFlight but NOT released to the "Friends" external
   group; Alex soaks it as internal tester first. (Note: a major native SDK
   swap may re-trigger Beta App Review.)
3. Release to Friends group + Play internal track as its own release with
   nothing else in it. Release notes mention the one-time sign-in.
4. Only after Doradito ships cleanly: roll release name forward per the
   standard recipe.

## Call-site audit (Jul 5 2026, against installed v25.1.0)

Every Firebase symbol the app imports was checked against the RNFirebase
modular API actually installed in node_modules. **All of them exist** except
the init/persistence plumbing (no longer needed) and one storage function:

| JS SDK | RNFirebase v25 | Notes |
|---|---|---|
| `initializeApp` / `initializeAuth` / `initializeFirestore` / `getReactNativePersistence` | (delete) | Native SDK auto-initializes from GoogleService-Info.plist / google-services.json. `firebaseConfig.js` shrinks to `getAuth()` + `getFirestore()`, still exporting `auth` and `db` so call sites keep their shape. The web config block and `experimentalAutoDetectLongPolling` go away. |
| `uploadBytes(ref, blob)` | `putFile(ref, localPath)` | photoService.ts:282-287 currently does fetch(uri) -> blob -> uploadBytes; putFile takes the file URI directly, simpler. |
| `import { User } from 'firebase/auth'` | `FirebaseAuthTypes.User` | Type-only change in `_layout.tsx` + `SightingsContext.tsx`. |
| everything else (`collection`, `collectionGroup`, `query`, `where`, `orderBy`, `limit`, `startAfter`, `onSnapshot`, `getDoc(s)`, `getDocsFromServer`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `serverTimestamp`, `Timestamp`, `Unsubscribe`, auth + storage functions) | same name | Import path changes from `firebase/x` to `@react-native-firebase/x`. |

Per-file worklist:

- Phase 1 (auth): `config/firebaseConfig.js`, `components/LoginScreen.tsx`,
  `components/AppHeader.tsx`, `components/profile/ProfileView.tsx`,
  `app/_layout.tsx` (User type), plus `auth.currentUser` consumers compile
  unchanged once `auth` is the native instance.
- Phase 2 (firestore): `SightingsContext.tsx`, `FriendSightingsContext.tsx`,
  `sightingService.ts`, `userService.ts`, `commentService.ts`,
  `hootService.ts`, `proposalService.ts`, `activityService.ts`,
  `notificationPrefsService.ts`, `LoginScreen.tsx` (username doc).
- Phase 2 (storage): `photoService.ts` only.

Semantics to watch after the swap:

- **`getDocsFromServer` stays `getDocsFromServer`** in `sightingService`
  (global-first detection). This matters MORE under the native SDK: with disk
  persistence on, plain `getDocs` can satisfy from cache and would make
  global-first detection go stale.
- **`onSnapshot` now fires cache-first on cold start.** For
  `FriendSightingsContext.friendsReady` this is the whole point (instant paint
  from disk), but it means the first snapshot can be stale by minutes; the
  server reconcile follows automatically.
- Firestore `Timestamp.toDate()` and `where('userId','in',[...])` (30-value
  cap) behave the same.

## Gotchas / notes discovered along the way

- **The iOS API key (GoogleService-Info.plist, ...lspDg) was blocked from the
  Identity Toolkit API** (`API_KEY_SERVICE_BLOCKED`), so the FIRST native-SDK
  login attempt failed with the misleading `[auth/internal-error]` even with a
  correct password. The JS SDK never tripped this because it used the WEB key.
  The Android key (google-services.json) was fine. Fix: GCP console →
  credentials → iOS key → API restrictions. If restricting rather than
  unrestricting, the allowlist needs at least: Identity Toolkit API, Token
  Service API (else sessions die at the 1h token refresh), Firebase
  Installations API, Cloud Firestore API, Cloud Storage for Firebase API.

- The xcodeproj gem lives in brew CocoaPods' vendored gems; run scripts with
  `GEM_HOME=/opt/homebrew/Cellar/cocoapods/<ver>/libexec ruby script.rb`.
- pod install warns `Can't merge pod_target_xcconfig ... DEFINES_MODULE` for
  expo-dev-menu targets under static frameworks; benign.
- FirebaseCore CocoaPods distribution is deprecated: no new versions published
  after Oct 2026. RNFirebase is expected to move to SPM upstream; track when
  bumping @react-native-firebase later.
- EAS iOS build must keep the pinned Xcode 26.2 image; first EAS build on this
  branch verifies the fmt patch + static frameworks behave the same on CI.
- Dev clients: package.json changed, so BOTH platforms need fresh dev-client
  builds before JS hot-reload iteration works on this branch.
