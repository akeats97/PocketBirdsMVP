# PocketBirds4 — Future Features

Backlog of feature ideas. Add context to each as we scope them.

## UX polish

- [x] ~~Save Sighting loading indicator.~~ Resolved differently: the Add Sighting flow is now fully offline-first. Save writes to local state instantly, and the photo upload happens during sync. No spinner needed because there's no wait.

- [x] ~~Bird Dex default filter = seen only.~~ Done.

- [x] ~~App title should reflect current version codename.~~ Done. Constant lives at `constants/release.ts`. Bump it each release.

## Data / Content

- [x] ~~Expand bird list to global (~11,000 species).~~ Done with IOC World Bird List v15.2 (11,227 species). Attribution shown at the bottom of the Bird Dex. Search uses pre-sorted/pre-lowercased arrays + tiered early-exit to stay snappy at 11K entries.

- [x] ~~One-time legacy name migration.~~ Done in May 2026. 60 sightings across alex+victoria+Ray renamed to IOC v15.2 equivalents in Firestore. Splits resolved as American/Northern/Eastern/Myrtle (NA defaults).

## Copy / Content

- [ ] **Tweak milestone taglines to be more teasing/personal.** Lines live in `app/constants/milestones.ts` (`milestoneTagline`). The "150 species? Jeez, what a nerd!" tone is the target. Other milestones (5, 10, 25, 50, 100, 200, 250, 500, 1000, plus the generic fallback for the rest) currently lean straight-celebratory — punch them up later.

## Bugs / cleanup

- [ ] **Firebase data loads multiple times on app start.** Observed in Metro logs during May 20 session: `Loaded 310 sightings from Firebase` printed 4-5 times after a single app open. Likely cause: the `useEffect` in `SightingsContext.tsx` that subscribes to `auth.onAuthStateChanged` has `[isLoading]` as a dependency, so it re-subscribes when isLoading flips, and the auth listener fires its callback again. Wasted Firestore reads — not user-visible but burns reads on each app start. Worth flattening to a single load.

## Offline / sync

- [ ] **Persist picked photos to a stable location.** The local `photoPath` from `expo-image-picker` lives in the OS cache directory, which can be cleared between app launches. If a user picks a photo offline and the OS clears the cache before sync runs, the photo upload will fail. Fix: copy the picked image to a permanent app-data location (e.g. via `expo-file-system`) and store that path on the sighting. Currently the file usually survives long enough, but it's not guaranteed.

- [ ] **Surface pending/error sync state on each sighting card.** Today the `syncStatus` field exists on every sighting but isn't displayed anywhere. A subtle indicator (e.g. small cloud-with-arrow icon for "uploading", warning icon for "error") would help users know which sightings haven't been backed up yet. Especially relevant after a long birding session offline.

## Notifications

- [ ] **Tap-to-navigate on push notifications.** When a user taps a friend-sighting push, the app should open the Friends tab filtered to that friend's activity feed (not just open the app to whatever tab was last active). Requires handling the `data.sightingId` / `data.friendName` payload already sent by the Cloud Function in the notification response handler.

- [ ] **Per-friend notification toggle via bell icon.** The bell icon next to each followed friend on the Friends tab should toggle whether push notifications fire for that specific person.

  **Current state (verified Apr 19 2026):** UI shell exists but feature is not wired up end-to-end.
  - `app/(tabs)/friends.tsx` has a `bellButton` that calls `handleNotificationToggle` → toggles React state only (`notificationPreferences` / `item.notificationsEnabled`). Resets on app reload.
  - Nothing persists to Firestore.
  - `functions/index.js` `onSightingAdded` iterates all followers unconditionally — no read of any per-friend preference.

  **To complete:**
  - Persist the toggle to Firestore. Natural spot: `following/{followerId}/following/{targetUserId}` doc with a `notificationsEnabled` boolean (default true).
  - Load on mount in `friends.tsx` so the UI reflects the real state.
  - In `onSightingAdded`, when building `followerIds`, read each follower's `following/{followerId}/following/{loggerId}` doc and skip if `notificationsEnabled === false`.
