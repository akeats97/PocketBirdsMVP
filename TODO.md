# PocketBirds4 — Future Features

Backlog of feature ideas. Add context to each as we scope them.

## UX polish

- [ ] **Save Sighting loading indicator.** Photo upload takes a few seconds — the button should show a spinner / disabled state / progress cue while the upload is in flight so the user knows something is happening and doesn't tap again.

- [ ] **Bird Dex default filter = seen only.** Currently shows all species (seen + unseen). Default filter should be "seen only" so the dex opens as a personal collection. Unseen view still available via toggle.

- [ ] **App title should reflect current version codename.** Today the header/title shows "Pocket Birds v0.5" (hardcoded). Should auto-populate from the version's codename (e.g. v14 = Thorntail → title "Pocket Birds Thorntail"). Needs: a source of truth for codename per versionCode, probably a constant map or read from EAS build metadata.

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
