# PocketBirds — Release Notes

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
