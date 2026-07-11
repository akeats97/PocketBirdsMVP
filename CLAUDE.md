# PocketBirds4 — Claude Context

## Product North Star

`PRD.md` (project root) is the product requirements / north-star doc: vision, bullseye user, core principles, anti-goals, mechanics, ethics, brand voice. **Read it before scoping a new feature, making a product or UX judgment call, or writing user-facing copy.** This file is the operational truth (what's currently true); PRD.md wins on questions of product direction. The always-true headlines: leaderboards are friend-scoped never global, photos are celebrated (now **strongly encouraged**, see below), and the voice is cheeky about the app but respectful about the birds. **Photo stance changed Jul 1 2026: the old "photos celebrated never required" headline was softened — with the user base growing, photoless sightings feel thin, so the Add flow now leads photo-first with the skip de-emphasized. Photos are strongly encouraged but still NOT hard-required (Mystery Bird / heard-only / backlog logging need the escape hatch), and features are never gated behind having one. See PRD §6 (revised).** **Visibility changed Jun 23 2026: the old "friends-only is non-negotiable" headline was overturned — PocketBirds is moving to public-by-default (visible to any signed-in user) with a per-account private opt-out, to support opening signup to strangers. See PRD §8 (revised) and WORK_QUEUE PL-1. Sensitive-species coordinate fuzzing is NOT overturned and gets more important under a public default.**

## Pending Design Work (Pocket Dex refactor, started May 21 2026)

Visual-language refactor in progress. Handoff lives at `/Users/alexkeats/Downloads/design_handoff_pocket_dex/` (tokens, migration doc, prompts, reference HTML).

**Status:** tokens + fonts landed. Screen-by-screen restyle pending.

**Deferred to follow-up sessions:**
- **Dex hero: life-list layout (Jun 11 2026).** The hero is a big gold lifetime-species number labeled LIFE LIST ("species all time"), with THIS YEAR (distinct species this calendar year) / SIGHTINGS / PHOTOGRAPHED as quiet rows beside it. **The PRD §7 Goodreads annual-goal mechanic (ring + goal sheet) was built and then REMOVED the same day** when Alex stepped back on Dex design: he was unsure goal-setting matters, and his real goal is a lifetime number ("get my life list to 150"), not a calendar-year count. If goals return, the leading idea is a life-list target (ring fill measured from the Jan 1 baseline), not a Goodreads reset-to-zero year counter. The deleted code (`components/dex/ProgressRing.tsx`, `app/services/goalService.ts`, the goal sheet in dex.tsx) is recoverable at commit `cd26e0a`. Stray `dexGoal` fields may linger on user docs (Alex's has `{ year: 2026, target: 100 }`); harmless, nothing reads them.
- **Wishlist cross-off celebration: DONE Jun 11 2026.** First sighting of a wishlisted species turns the Add-screen success banner gold ("One off the wishlist!", sun bg + ink text, in `app/(tabs)/add.tsx`). The star deliberately stays (Alex's call, do NOT auto-unstar). Global-first and milestone takeovers outrank it (their early returns skip the banner). Repeat sightings of a still-starred species do not re-fire (gated on newSpeciesDetected).
- **IUCN conservation status strip** on every sighting card. **Data + helper now SHIPPED (Jun 26 2026):** `constants/iucnStatus.ts` + `statusFor(birdName)` exist (Wikidata P141 dump, ~92% coverage) and already drive the conservation strip on the new Species Guide tab. Note: Wikidata's status entities no longer carry the P528 codes the old `wikidata-dump.md` recipe expected — the build (`scripts/build-species-data.py`) maps the status Q-ids instead. **Still to do:** render the strip on the *sighting card* itself, and the small color dot on threatened-species Dex tiles. Status types + `STATUS_VISUAL` map live in `constants/Colors.ts`.
- **Species Guide tab — SHIPPED Jun 26 2026.** Tapping a Dex species opens `app/species/[name].tsx` on a new **Guide** tab (default, left of Community/Yours): Description (bundled Wikipedia, `constants/wikiBlurbs.ts`, offline) → Measurements (AVONET, `constants/avonet.ts`) → Conservation (IUCN) → Where it lives (realm map `assets/images/world-equirect.png` + `regionsFor()` + migration). Component: `components/species/SpeciesGuide.tsx`. All data bundled/offline; see WORK_QUEUE Q-14 for the full data-sourcing write-up and refresh scripts.
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

Moved to the **`release-build`** skill (`.claude/skills/release-build/SKILL.md`) — release names, EAS build profiles, and the full "Start our builds" recipe (iOS TestFlight + Android APK + release notes + post-build name roll). Invoke it when Alex says to start/kick off builds or asks about release names or build numbers.

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
- **EAS** — builds (iOS TestFlight + Android APK via Firebase App Distribution)

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
**Android updates ship as APKs via Firebase App Distribution — the Play Store is no longer used for updates (Alex, Jul 11 2026).** iOS ships via TestFlight. The full recipe (both platforms, release notes, name roll) lives in the `release-build` skill.

```bash
# Android APK (Firebase App Distribution)
eas build --platform android --profile apk --non-interactive
```

Run from `/Users/alexkeats/Desktop/PocketBirds4/`. The Play Store listing/keystore facts below are kept for history and in case the Play channel is ever revived.

---

## Workflow
- Commit after every meaningful change
- Kick off builds (see `release-build` skill) once a batch of changes is ready
- Current git branch: `master` (push_notifs merged Apr 19 2026)

---

## Dev Loop (testing on phone / iOS Simulator)

Moved to the **`dev-loop`** skill (`.claude/skills/dev-loop/SKILL.md`) — the Android Expo dev-client loop (`npx expo start --dev-client`, side-by-side `.dev` package, prod-Firebase caveat) and the iOS Simulator loop (`npx expo run:ios`, the fmt/Xcode 26 fix, sim screenshots/deep-links). Invoke it when running or hot-reloading the app locally.

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

## Photo location + realm-ranked bird search (Jul 1 2026)

Add mode leads with the photo; adding one reads the photo's GPS, ranks the bird-name suggestions by zoogeographic realm ("Most likely near you" / "Everywhere else", `realmForCoordinates` in `constants/birdNames.ts`), and reverse-geocodes to autofill the LOCATION label. Ranking fallback chain: photo coords -> sighting coords -> silent current position -> plain alphabetical.

**How the photo GPS read actually works (`photoService.readPhotoCoordinates`), verified on-device Jul 1 2026.** The governing fact on Android: **the system Photo Picker REDACTS location from the file it serves, by zero-filling the GPS EXIF values while leaving the tags in place** (OS privacy design; `ACCESS_MEDIA_LOCATION` does not apply to picker URIs). So nothing that reads the *picked file* can ever get real coordinates; the only legal source is the ORIGINAL library asset via `expo-media-library getAssetInfoAsync().location` (MediaStore + `setRequireOriginal`, which DOES honor `ACCESS_MEDIA_LOCATION`). The whole chain is therefore "identify the original asset", in fallback order:

1. `asset.exif` parse (`coordsFromExif`, handles numbers / decimal strings / DMS rational strings). On Android this is usually zeroed junk, but it's free and is the iOS `{GPS}` path.
2. Byte-level JPEG EXIF parse of the picked file (`app/utils/exifGps.ts`, dependency-free, reason-coded). On picker files this reports `zeroed-coords` (the redaction signature); kept because it's the definitive diagnostic and catches any non-redacting source.
3. `asset.assetId` -> `getAssetInfoAsync`. **`patches/expo-image-picker+16.1.4.patch` is LOAD-BEARING here:** upstream returns `assetId: null` for Photo Picker URIs (expo/expo#17399); the patch maps local-provider picker URIs (`content://media/picker/...`) back to their MediaStore id. Applied by `patch-package` via `postinstall`; NATIVE change, needs a rebuild to take effect; re-check upstream before dropping on any expo-image-picker upgrade.
4. **Numeric-filename probe** (the path that actually fires on Alex's Pixel): items served via the Google Photos *cloud provider* have no picker MediaStore id and a generated display name like `1000026869.jpg`, but that number IS the local MediaStore id when the photo exists on-device. Probe it with `getAssetInfoAsync`, trusting the result only if capture time or pixel dimensions corroborate.
5. Library scan matching capture time (EXIF `DateTimeOriginal`) + dimensions in a +-26h window, for renamed items the probe misses.

Genuinely cloud-only photos (backed up + freed up, or taken on another device) are unreachable by design: Google strips GPS from every third-party interface. The form then falls back to phone location, which is the intended graceful degradation.

- The media-library lookup needs `ACCESS_MEDIA_LOCATION` (in `AndroidManifest.xml`) + the photos runtime permission; `photoService.requestPhotoPermission()` wraps that (granular `['photo']`). Android 14 partial photo access ("Select photos") can also yield null; callers fall back gracefully.
- **Permissions are requested proactively on Add-screen mount** (add mode only, `SightingForm.tsx`): location first, then photos, sequentially. Picking itself never requires the photos permission (system pickers), so denial only disables the GPS read; `pickImage` deliberately does NOT gate on it.
- Cropping (`allowsEditing`) was removed from `pickImage` because the crop re-encode strips EXIF; under the final architecture location comes from the library asset anyway, so Q-15's crop-after-read plan is safe.
- Debugging: every branch logs `[photoService] ...` to Metro (parse reason codes, probe corroboration, matched asset). Deliberately kept; this area is a maze of OS privacy behaviors and these logs are how the Jul 1 bug was cracked.
- The photo's location only ever overwrites the remembered prefill or an empty field, never a user-typed/picked label.

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
