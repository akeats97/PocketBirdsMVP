# PocketBirds — Release Notes

## Tyrannulet - June 9 2026
**Builds:** iOS 1.0.0 (10) · Android 1.0.0 (versionCode 25, **APK** for Firebase App Distribution)
**Headline:** Edit any past sighting, much smoother scrolling & tab-switching, and your own Field Journal cards now surface hoots, comments & IDs.

### Play Store - "What's new" (plain text, copy below this line)

✏️ Edit a sighting
• Long-press any card in your Field Journal (or tap the ⋯ on a sighting) to Edit
• Change the species, date, location, notes, or photo of anything you've logged
• Edits are silent: fixing a typo or swapping to a bird you've already seen pings no one. Only changing it to a brand-new species adds it to your Dex and notifies followers, like a fresh log
💬 Social
• Your own Journal cards show hoot and comment counts, and a dot when there's something new to see
• Tap the hooters on any sighting to see everyone who gave it a hoot
• Manage a person's notifications right from their profile
⚡ Smoother and faster
• Noticeably smoother scrolling and tab-switching
🔍 Dex and fixes
• Mystery Birds now appear in your Dex (under "Other") with a count, and their photos count toward your photographed total
• Fixed avatars sometimes showing "?" instead of your initial
Plus more polish.

### TestFlight - "What's new" (plain text, copy below this line)

✏️ Edit a sighting
• Long-press any card in your Field Journal (or tap the ⋯ on a sighting) to Edit
• Change the species, date, location, notes, or photo of anything you've logged
• Edits are silent: fixing a typo or swapping to a bird you've already seen pings no one. Only changing it to a brand-new species adds it to your Dex and notifies followers, like a fresh log
💬 Social
• Your own Journal cards show hoot and comment counts, and a dot when there's something new to see
• Tap the hooters on any sighting to see everyone who gave it a hoot
• Manage a person's notifications right from their profile
⚡ Smoother and faster
• Noticeably smoother scrolling and tab-switching
🔍 Dex and fixes
• Mystery Birds now appear in your Dex (under "Other") with a count, and their photos count toward your photographed total
• Fixed avatars sometimes showing "?" instead of your initial
• Fixed the top app bar layout on iOS (title, bell, and avatar no longer clipped)
Plus more polish.

### What shipped (engineering)
- **Edit a sighting** (commit `feat: edit a sighting`): the Add form body was extracted into a shared `components/SightingForm` (`mode: add | edit`); a pushed route `app/sighting/[id]/edit.tsx`; `SightingsContext.updateSighting` (merge patch, recompute new-species/milestone excluding the edited row, offline `pendingUpdates` queue drained by `syncSightings`); the long-press **action sheet** (Edit/Delete/Cancel) replacing the delete-only modal, and an owner-only **⋯ overflow menu** on the detail screen; a shared `confirmDeleteSighting`. Server: `onSightingUpdated` fans out to followers ONLY when an edit becomes a new species (guarded by `notifiedSpecies` to prevent double-notify); every other edit stays silent.
- **Field Journal engagement** (`0d6ddc0`): read-only hoot/comment/proposal footer + unread dot / "N new" cue on your own cards, tap-through to the detail thread; `ActivityContext.unreadBySighting` selector over the existing activity stream.
- **Performance pass** (`perf: memoize feed cards`): `React.memo` on `SightingCard` + `FriendSightingCard`, per-card "1ST" flags precomputed once as memoized Sets (killing an O(n²) filter+sort per card), `useCallback`'d list `renderItem`s, and a memoized `ActivityContext` value. Fixes the choppiness that appeared once the Journal was wired to the activity stream.
- **BottomSheet primitive + rule** (`feat: BottomSheet`): canonical sheet motion (content slides up, scrim fades) in `components/BottomSheet.tsx`; documented in `CLAUDE.md` as the required pattern for all sheets.
- **Profile** (`66e0457`): Following pill (renamed from Friends) + per-person notification bell.
- **Dex** (`c4863ad`, `dfd72f6`): Mystery Bird tile under "Other" with a logged count; Mystery photos count toward the photographed stat.
- **Hoot sheet** (`e611459`, `4a6b57b`): tappable hooters, slide-up animation, working drag-to-dismiss.
- **iOS layout** (`3193085`, `39a0bff`, `a1f428c`, `21374bc`): custom app bar fixing the clipped header controls + double top-inset; tab-bar chin tuned per platform.
- **Avatar "?" fix** (`097a1d7`, `72a3168`): header + profile avatars refetch/retry and fall back to the email initial instead of sticking on "?".
- **Release title** rolled Antwren → Tyrannulet.

### Known issues
- Scrolling is improved but not perfectly buttery on the largest lists (secondary cleanups deferred: per-card `toLocaleDateString`, and the 4 redundant header profile fetches).
- "First on Pocket Birds" still has no dedicated sighting-card pill (`WORK_QUEUE.md` Q-3).
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).

### Post-ship steps
- **iOS:** build 1.0.0 (10) auto-submitted; processing at Apple → "Friends" external group. No new capability this build, so it should skip Beta App Review.
- **Android:** this is an **APK** (not the Play Store AAB): distribute via **Firebase App Distribution**. Artifact: <https://expo.dev/artifacts/eas/bwx3Nfm6DB3cDT9XBebXYC.apk>
- **iOS:** IPA <https://expo.dev/artifacts/eas/g2UxefyYnGUBR9qE42qXrX.ipa>; submitted to App Store Connect (build 10), processing for the "Friends" group.
- Fill the `release-names.csv` Tyrannulet date only once actually shipped to production. Next release name after Tyrannulet is **Tyrant**.

---

## Antwren - June 8 2026
**Builds:** iOS 1.0.0 (9) · Android 1.0.0 (versionCode 24, **APK** for Firebase App Distribution)
**Headline:** Followers & Following lists, per-person notification controls, and a header-avatar gateway to your own profile.

### Play Store - "What's new"
> 👥 Followers & Following
> • Tap the Followers / Following count on any profile to see who's connected
> • Every name opens that birder's profile, so browsing a friend's followers is how you find new people to follow
> • Follow or unfollow right from the list
> • 🔔 On your Following list, tap a person's bell to choose what they push you: All, Highlights only, or Nothing
> • Your avatar now sits top-right: tap it to open your own profile (Log out moved there)
> Plus polish and fixes.

### TestFlight - "What to Test"
> New: Followers/Following lists, per-person notification controls, and the header avatar.
>
> Please check:
> • Tap your avatar (top-right of the header). Your profile opens, and Log out now lives there (top-right of the profile).
> • On any profile, tap the Followers or Following count: the list opens on that tab. Switch tabs with the segmented control; each count matches the list length.
> • Tap a person in the list to open their profile. Follow / unfollow from the list and confirm it sticks after leaving and returning.
> • On YOUR Following list, tap someone's bell, then pick All / Highlights only / Nothing. The bell icon changes (ringing / plain / slashed) and the choice persists.
> • Confirm the choice actually gates pushes: set a friend to Nothing, have them log a sighting, and you should get no push.

### What shipped (engineering)
- **Followers/Following screen:** `app/profile/[uid]/connections.tsx`, a pushed screen with a segmented Followers · Following switch (`?tab=` param), optimistic follow pills, and per-row lazy species counts (`getSightingsByUid` + `speciesSet`).
- **Components** under `components/social/`: `SocialCounts` (tappable counts on the profile), `FollowRow` (person row), `NotifBell` (the ringing / plain / bell-off glyph), and `NotifPrefSheet` (the 3-mode picker, reusing the existing `notificationPrefsService`).
- **Follow graph reverse lookup:** `userService.getConnections` / `getFollowCounts` derive a user's followers from a `collectionGroup('following')` scan (the graph stored only one direction). `firestore.rules` gained the matching recursive-wildcard read, deployed to prod Jun 8.
- **Header avatar** replaces the old logout icon and opens your own profile; **Log out moved** to the self-profile nav.
- **New native dependency: `react-native-svg`** (drives the bell icons). First build to carry it, so the dev client and both store builds were rebuilt.
- **Release title** rolled Snowcap → Antwren.

### Known issues
- Follower/following counts read the whole follow graph per profile open: fine at current scale, flagged to revisit with a denormalized followers index later (same posture as `searchUsers`).
- "First on Pocket Birds" detection caveats carry over (best-effort; no sighting-card pill yet, `WORK_QUEUE.md` Q-3).
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).

### Post-ship steps
- **iOS:** build 1.0.0 (9) is processing at Apple, then lands in the "Friends" external group. No new *capability* this build (`react-native-svg` is not an entitlement), so it should skip Beta App Review.
- **Android:** this is an **APK** (not the Play Store AAB): distribute via **Firebase App Distribution**. Artifact: <https://expo.dev/artifacts/eas/fmEG7AYa5tAAXd3QYuzqmS.apk>
- Fill the `release-names.csv` Antwren date only when actually shipped to production. Next release name after Antwren is **Tyrannulet**.

---

## Snowcap — June 6 2026
**Builds:** iOS 1.0.0 (8) · Android 1.0.0 (versionCode 23, **APK** for Firebase App Distribution)
**Headline:** Birder profiles, the "You & {friend}" overlap compare, full-page friend search, and gold "first on Pocket Birds" trophies.

### Play Store - "What's new"
> 👤 Profiles + compare
> • Tap a birder in search — or your own name — to open a profile: stats, Field Journal, and Bird Dex
> • Search the Friends tab to find and visit anyone, friends and strangers alike
> • "You & {friend}": see how much your life lists overlap, and exactly which birds they have that you don't
> • 🏆 Log a species before anyone else on Pocket Birds and earn a gold trophy on it
> • Tap a friend's name on any sighting to jump straight to their profile
> Plus polish and fixes.

### TestFlight - "What to Test"
> New: Profiles, the You-&-friend compare, and full-page friend search.
>
> Please check:
> • Friends tab: type a name in the search bar → tap a birder → their profile opens (stats, Field Journal, Bird Dex). Back returns to your search.
> • On a friend's profile, open "You & {name}" → the compare screen. Tap section headers to expand/collapse; add one of their birds to your Wishlist.
> • Tap the username pill on any sighting in the feed → it should open that person's profile.
> • Follow / unfollow from a profile and confirm it sticks after leaving and returning.
> • Bird Dex: species you were first on the whole app to log show a gold 🏆 next to the name (tile stays green).
> • Push (still validating): have an Android friend log a sighting → confirm the iOS push lands. This is the first build with the entitlement fix actually live.

### What shipped (engineering)
- **Profile pages:** `app/profile/[uid].tsx` (friend / public / self) + `app/profile/[uid]/compare.tsx` (Venn). Pushed screens, no tab bar. Data via `getSightingsByUid` + `getPublicProfile`; no `firestore.rules` change needed (signed-in reads of `sightings`/`users` were already allowed). Self profile reuses live contexts.
- **Venn compare:** `compareLists.ts` (Jaccard overlap), `CompareCard` module on the profile, and the full compare screen with collapsible Only-them / Only-you / Both buckets + Wishlist/LOGGED affordances.
- **Friends tab rewrite:** the friend-filter dropdown is replaced by a **full-page birder search** (`searchUsers`, includes strangers, lazy species counts); search moved beside the title, "Add" button removed; the feed no longer filters by friend; feed card username pill links to the poster's profile.
- **Global-first:** `sighting.globalFirst` flag — first-ever logger of a species across the app gets a gold trophy on the green Dex tile + profile Dex chip, plus a `GlobalFirstCelebration` gold takeover. Detected via `isGlobalFirstSpecies` at log time ("first" = input-into-app time, not observation date). Seeded existing data with `functions/backfillGlobalFirst.js` (applied Jun 6: alex 97, victoria 70, Ray 3, ooplena 1, penguin 1).
- **Milestones** now fire at **1, 5, 10, 25, then every 50** (reworded 1/5/10 taglines).
- **Release title** rolled Gnatcatcher → Snowcap.

### Known issues
- "First on Pocket Birds" detection is best-effort: needs connectivity, matches on exact name, and two simultaneous loggers could both be flagged. No card **pill** yet (gold trophy only) — pill design pending (`WORK_QUEUE.md` Q-3).
- Offline sighting data-loss hardening still unconfirmed (`WORK_QUEUE.md` Bug 3).
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).

### Post-ship steps
- **iOS:** add build 1.0.0 (8) to the "Friends" external group. No new capability this build, so it should skip Beta App Review.
- **Android:** this is an **APK** (not the Play Store AAB) — distribute via **Firebase App Distribution** (new channel this release; see `WORK_QUEUE.md` Q-2). Play Store internal track is unchanged.
- Fill the `release-names.csv` Snowcap date only when actually shipped to production. Next release name after Snowcap is **Antwren**.

---

## Gnatcatcher - June 5 2026
**Builds:** iOS 1.0.0 (7) · Android 1.0.0 (versionCode 22)
**Headline:** Activity feed + bell, day-grouped friends feed, keyboard fixes across the app, and a custom species.

### Play Store - "What's new"
> 🔔 Activity feed
> • New bell up top: see who hooted, commented, or followed you (with an unread dot)
> • Friends feed is now grouped by day, just like your Field Journal
> • New Sightings / Hep toggle: all sightings, or all the bug reports & feature requests (including ones you sent)
> • The keyboard no longer covers what you're typing, including the sign-up screen
> • Say hi to Kelsey 🐦
> Plus polish and fixes.

### TestFlight - "What to Test"
> New: Activity feed + bell, and keyboard fixes everywhere.
>
> Please check:
> • Sign up for a brand-new account. The keyboard should NOT cover the Create Account button (this was broken before). Tapping Return/Go on the password field should submit.
> • Add Sighting: tap into each field. The keyboard should never cover the active box.
> • Tap a friend's sighting, give it a Hoot or a comment. The bell (top-right) should get a red dot; open it, then tap an item to jump to that sighting.
> • Friends tab: the feed is grouped by day; toggle between Sightings and Hep.
> • Push: have an Android friend log / hoot / comment, confirm the iOS push lands (we're still validating the entitlement fix).

### What shipped (engineering)
- **Activity inbox (Phase 2.5):** header bell + unread dot + Activity screen (`app/activity.tsx`); Cloud Functions write activity docs on hoot/comment plus a new `onFollowCreated`. Deployed to prod Jun 4.
- **Friends feed grouped by day** via a generic `groupSightingsByDay`; **Sightings / Hep pill toggle** (Hep includes the user's own report entries, which stay hidden from the Field Journal).
- **Keyboard overhaul:** migrated Add Sighting, the comment composer, and `LoginScreen` to `react-native-keyboard-controller` (`KeyboardAwareScrollView` / `KeyboardAvoidingView`) + a root `KeyboardProvider`; added `babel.config.js` (reanimated plugin). Fixes the keyboard covering inputs on Android edge-to-edge and iOS, including the sign-up Create Account button. **Native dependency, this is the first build to carry it.**
- **Kelsey:** custom easter-egg species (`constants/customSpecies.ts`): loggable, full new-species celebration on first log, Dex tile under "Other", but excluded from species counts and milestones.
- **New follows default to "all" notifications** (was "highlights"); the per-friend bell reflects it.
- **Friends polish:** tappable "Close" header to dismiss the filter dropdown; Add Friends modal given fixed pixel width/height (no resize while typing, hard-shadow aligned).
- **"1ST" badge** no longer shows on Bug Report / Feature Request / Mystery Bird entries.
- **Release title** rolled Emerald to Gnatcatcher.

### Known issues
- iOS push entitlement (`aps-environment`) still under validation (carried from Emerald). Android to iOS push may still be affected. See `WORK_QUEUE.md` Bug 6.
- Android notification small icon renders inconsistently across OEMs (cosmetic). See `WORK_QUEUE.md` Bug 2.

### Post-ship steps
- **iOS:** add build 1.0.0 (7) to the "Friends" external group. It may need Apple Beta App Review since a native module was added (24 to 48h).
- **Android:** build auto-submitted to internal/draft. Promote in Play Console when ready. Fill the `release-names.csv` Gnatcatcher date only when promoted to production.

---

## Emerald — June 4 2026
**Builds:** iOS 1.0.0 (6) · Android 1.0.0 (versionCode 21)
**Headline:** Hoot & Comments social layer + first-time iOS push/location fixes.

### Play Store — "What's new"
> 🦉 Hoots & Comments
> • Give a friend's sighting a Hoot — one tap, very satisfying
> • Leave comments on sightings and talk about who saw what
> • Tap any friend's sighting to open it full-screen with its hoots & comments
> • Get notified when someone hoots or comments on your bird (tap it to jump right there)
> • Log an "Unknown" bird when you're not sure what you spotted
> Plus behind-the-scenes fixes.

### TestFlight — "What to Test"
> New: Hoots & Comments on friends' sightings.
>
> Please check:
> • Tap a friend's sighting → it opens a detail screen. Give it a Hoot, leave a comment.
> • Notifications: have an Android friend log/hoot/comment on a bird → you should get a push on iPhone, and tapping it should open that sighting. (Push to iOS was broken before — we're confirming it's fixed.)
> • Add Sighting → tap the location crosshair icon. It should NOT crash. (Also previously broken on iOS.)
> • General sanity: log a sighting, browse the Bird Dex.

### What shipped (engineering)
- **Hoot reaction** (Phase 1): one-tap owl reaction on friend sightings, optimistic toggle, live count + face pile, hoot-list sheet, push to the owner.
- **Comments** (Phase 2): threaded comments, sighting detail screen (`app/sighting/[id].tsx`) with composer, top-comment preview on cards, push to the owner. (Activity feed/bell intentionally deferred.)
- **Push deep-links**: hoot/comment notifications open the relevant sighting.
- **Firestore security**: replaced wide-open test-mode rules with a least-privilege, emulator-validated ruleset (now version-controlled in `firestore.rules`). Fixed a friend-sightings listener leak surfaced by the strict rules.
- **iOS fixes (first build to carry them):** `aps-environment` entitlement (push) and `NSLocationWhenInUseUsageDescription` (location-crash) — needs validation on this build.
- **"Unknown" bird entries**: excluded from Dex / Field Journal / new-species math.

### Known issues
- Comment composer leaves a slightly-thick resting margin after keyboard dismiss on Android (cosmetic). See `WORK_QUEUE.md` → composer keyboard margin.

### Post-ship steps
- **iOS:** in App Store Connect, add build 1.0.0 (6) to the "Friends" external group → first build to that group needs Apple Beta App Review (24–48h).
- **Android:** build submitted to the internal/draft track → promote in Play Console when ready. (`release-names.csv` date for Emerald gets filled in only when promoted to production.)
