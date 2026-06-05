# PocketBirds — Work Queue

Bugs and feature requests captured from a real-world testing day (May 23 2026). Each item has a write-up of what's going on and a self-contained prompt you can paste into Claude Code.

The prompts are written to be standalone — Claude Code can act on them without reading this doc, but they all assume the agent has read `CLAUDE.md` (file layout, push setup, conventions).

---

## User-reported (in-app Bug Report / Feature Request submissions, June 3–4 2026)

Pulled from the `sightings` collection (entries with `birdName` = "Bug Report" / "Feature Request"). Submitters: alex, victoria, evaloon. Triaged below. Dupes of existing backlog items are cross-referenced rather than re-specced; jokes are recorded but parked.

### UR-1 — Add Sighting keyboard covers the text field (evaloon) — BUG

Two submissions, same root cause: a bug ("when keyboard pops up, the keyboard blocks the field where I am typing") and a feature ask ("swiping down on keyboard to close it, and text field moving up when keyboard pops up"). On Add Sighting, the on-screen keyboard overlaps the active input, and there's no swipe-to-dismiss.

**Both platforms: migrated to `react-native-keyboard-controller` Jun 4 2026 (NATIVE DEP — needs a dev-client rebuild before it can be tested).** Superseded the earlier iOS-only `automaticallyAdjustKeyboardInsets` attempt. The Add screen's whole bespoke keyboard apparatus (inert KAV, manual `keyboardWillShow` measure+`scrollTo`, `keyboardHeight` state, paddingBottom math) was deleted and replaced with `<KeyboardAwareScrollView>` from `react-native-keyboard-controller` (edge-to-edge aware on Android, handles iOS too) with `keyboardDismissMode="interactive"` + `bottomOffset={20}`. App root wrapped in `<KeyboardProvider>` (`app/_layout.tsx`).

**Infra note:** the repo had NO `babel.config.js`, and reanimated worklets had never actually run (only unimported template files used them). keyboard-controller is reanimated-worklet based, so a canonical `babel.config.js` (`presets: ['babel-preset-expo']`, which auto-includes the reanimated plugin) was added. Validated by force-compiling the Android bundle (HTTP 200, 13.2 MB, clean).

**Verification (after a dev-client rebuild — `eas build --profile development --platform android`, then reinstall):** focus each field on Add Sighting (esp. Notes, lowest) and confirm it lifts clear of the keyboard on Android; confirm swipe-down dismiss. iOS path also now flows through the library — re-verify on the next TestFlight build for evaloon.

### UR-2 — Can't see your own Bug Report / Feature Request submissions (evaloon) — BUG / UX ✅ DONE Jun 4 2026

"I can't see my feature requests HEP." Addressed by the new **Hep** tab on the Friends screen (see UR-3): the feedback view includes the user's OWN reports (mapped to a friend-card shape with the tag "You"), so there's now a place to see what you submitted. They remain hidden from the Field Journal as designed. A post-submit confirmation banner ("thank you for your hep ❤️") already existed.

### UR-3 — Filter the friends feed by type: sightings vs bugs/feature requests (victoria) — FEATURE ✅ DONE Jun 4 2026

Shipped as two pill buttons on the Friends tab: **Sightings** (friends' real bird sightings, day-grouped) and **Hep** (all Bug Report / Feature Request entries — friends' + own, newest first). Reports no longer clutter the Sightings feed. `feedMode` state in `app/(tabs)/friends.tsx`; the species/sightings stats panel is gated to Sightings mode.

### UR-4 — Friends help verify an unknown bird (alex + victoria) — FEATURE (part a done)

Alex: "submit an unknown bird and have my friends help verify it." Victoria: "let me submit unknown birds" — already possible by typing "?" (Mystery Bird), so Victoria's ask is really a **discoverability** gap.

- **(a) Mystery Bird discoverability — WON'T DO (Alex's call, Jun 4 2026).** A tappable "Couldn't ID it?" hint was tried and reverted. Alex wants the `?`-typed entry to remain the ONLY way to log a Mystery Bird — intentionally low-profile, not surfaced as an affordance. Leave it undiscoverable by design.
- **(b) Friend verification — still open, needs design.** Let friends suggest/confirm an ID on a Mystery Bird sighting (lightweight comment-or-vote on the species). Real feature, scope with Alex. Ties into the Hoot/Comment data model already in place.

### Already tracked (now also user-requested, no new entry needed)

- **React / kudos on a friend's sighting** (victoria, "please let me react to friends sightings") → already in `CLAUDE.md` Feature Backlog ("Kudos on a friend's sighting").
- **Edit a past sighting** (alex, "ability to edit sightings") → already in `CLAUDE.md` Feature Backlog ("Edit a past sighting").

### Done

- **Group friends log by date like the Dex** (victoria) → shipped Jun 4 2026; Friends feed now uses a `SectionList` grouped by day via `groupSightingsByDay`.
- **Make Kelsey a species pls** (evaloon) → shipped Jun 4 2026. Added `constants/customSpecies.ts` (`CUSTOM_SPECIES = ['Kelsey']`, `isCustomSpecies`). Kelsey is selectable in Add Sighting (typing "ke…" surfaces her like the Mystery Bird / report specials), fires the full new-species celebration (haptic + popup) on first log, and gets a Dex tile under "Other" (orphan path). Per Alex she does NOT increment the unique-species count or trigger milestones — excluded from the species math in `SightingsContext.addSighting`, `dex.tsx` stats, Field Journal `index.tsx`, `groupSightingsByDay`, and `friends.tsx` friendStats.

### Parked (not actionable)

- "Please come home I miss you" (victoria) — not a product request.

### Idea — log non-bird animals with a `*` prefix (noted Jun 4 2026, not scoped)

Alex's idea, related to the Kelsey/custom-species mechanism: let users log real-but-not-bird sightings (e.g. a Leopard Frog) without encouraging it. Proposed UX: type `*Leopard Frog` in the Add Sighting search — the leading `*` flags "this isn't a bird." It shows in the Dex under "Other" and, unlike Kelsey, it DOES count toward the species total (it's a real animal, just not a bird).

Open questions to work through before building:
- Parsing/UX: strip the `*` for display, or keep a small "not a bird" marker on the tile/card? Where does the asterisk live on the stored `birdName`?
- Counts: confirmed it counts in species totals (Alex). So it behaves like a normal species except it's user-authored and non-canonical (lands in the orphan "Other" path already used by the Dex).
- Distinction from Kelsey: Kelsey = `isCustomSpecies` (curated easter egg, NOT counted). The `*` path = user-authored real non-bird (counted). These are two different categories; the new `constants/customSpecies.ts` is a reasonable home/pattern to extend, but the `*` items are open-ended (any string) rather than a fixed list, so they likely need their own predicate (e.g. `isNonBirdEntry(name) = name.startsWith('*')`) rather than a hardcoded set.
- Validation/abuse: free-text `*anything` means users can log arbitrary strings as counted species. Decide whether that's fine (it's their personal Dex) or needs light guardrails.
- Friends feed + verification: how do non-bird entries read on a friend's card? Ties into UR-4 (Mystery Bird verification).

---

## SECURITY — Firestore rules hardened ✅ (DONE Jun 4 2026, commit 5ed3a6e)

**Was:** production Firestore used the default test-mode catch-all `allow read, write: if true` — entire DB publicly readable/writable. Discovered Jun 3 2026 during the Hoot & Comments build; rules were not in the repo.

**Now:** locked down and version-controlled at `firestore.rules` (wired into `firebase.json`). Least-privilege: signed-in reads, owner-only writes, hoot/comment engagement limited to own/followed sightings, immutable usernames (public single-doc get for the pre-auth signup check), counters/activity Cloud-Function-only. Validated against the Firestore emulator with `@firebase/rules-unit-testing` (18/18, including all security-boundary denials). Also fixed a pre-existing `FriendSightingsContext` listener leak that fired a permission error at logout under the strict rules.

**Note for future rules changes:** collection-group queries (e.g. `collectionGroup('hoots')`) require a recursive-wildcard rule (`/{path=**}/hoots/...`); re-validate any rule change in the emulator before deploying.

---

## Cosmetic — comment composer resting margin (low priority)

**Where:** sighting detail screen, `app/sighting/[id].tsx` (the comment composer pinned at the bottom).

**Symptom:** Composer lifts correctly with the keyboard and the text field is fully visible while typing. But after the keyboard is dismissed, the composer sits with a slightly-thicker-than-resting bottom margin (~one nav-bar inset of extra space). Only appears *after* the first keyboard open; hides nothing. Verified on Alex's Android device (dev client), Jun 4 2026.

**Environment that makes this finicky:**
- Expo SDK 53 → Android runs **edge-to-edge**. The window does NOT resize for the keyboard even though `android:windowSoftInputMode="adjustResize"` is set in `AndroidManifest.xml` — so relying on `adjustResize` alone leaves the keyboard covering the composer.
- The root layout (`app/_layout.tsx`) wraps screens in **`SafeAreaView` from `react-native`**, which only insets on iOS and is a **no-op on Android**. That's why this screen has to apply `useSafeAreaInsets()` manually on Android (top for the nav bar, bottom for the composer). iOS gets insets from the root SafeAreaView, so the manual insets are gated to `Platform.OS === 'android'` to avoid double-padding.

**Current (shipped, commit ac6e508):** `KeyboardAvoidingView behavior="padding"` (no offset) + composer `paddingBottom = bottomInset(android) + space.sm`. This is the best state found: correct lift, fully-usable input, only the cosmetic resting margin.

**Approaches tried and what each did:**
1. `behavior={Platform.OS==='ios' ? 'padding' : undefined}` (original) → Android keyboard **covered** the composer (adjustResize not firing under edge-to-edge).
2. `behavior="padding"` both platforms, no offset, composer has own `insets.bottom` → **lift correct** ("fine and good"), but on dismiss KAV's hidden-keyboard frame settles at ~nav-bar inset and stacks on the composer's inset → **doubled resting margin**. ← current shipped behavior.
3. `behavior="padding"` + `keyboardVerticalOffset={insets.bottom}` (android) → pushed the field **down into the keyboard** (only ~half the field visible). Offset subtracts from the lift always, so it hurt the up-state. Reverted.
4. Manual `Keyboard` show/hide listener (no KAV), set composer `paddingBottom = kbHeight` when open / `insets.bottom` when closed → **under-lifted** (~half the field behind the keyboard). Couldn't model why from inspection; suspected misreported `endCoordinates.height` and/or partial adjustResize interaction under edge-to-edge. Reverted.

**Real fix — DONE Jun 4 2026 (pending dev-client rebuild to verify):** swapped this screen's RN `KeyboardAvoidingView` for the one from **`react-native-keyboard-controller`** (built for edge-to-edge, resets cleanly). Done together with the Add Sighting migration to `KeyboardAwareScrollView` and the root `KeyboardProvider` (see UR-1). It's a **native dependency**, so it needs a dev-client rebuild (`eas build --profile development --platform android`, then reinstall the dev APK). Validate the open→type→dismiss cycle on a gesture-nav Android device specifically (that's where the residual margin showed) and confirm the resting margin is gone.

---

## Next Play Store build — verifications outstanding

- **Bug 3 cold-start repro** (offline data loss, fixed May 26 2026, commits `0d9653a` / `13b759a` / `1d803ea`). The dev client can't verify the literal cold-start-while-offline path because it needs Metro to launch. Online regression, offline write + online sync, and logout/login were all verified on the dev client. **Next production build:** install it, run the original repro — airplane mode → log 3 sightings → force-quit the app → reopen while still in airplane mode → confirm all 3 sightings are still there → turn airplane mode off → confirm they sync to Firestore.

---

## Bugs

Listed in rough priority order. Bug 3 (offline data loss) is the only one that should be treated as drop-everything urgent — the others can ship in a batch.

---

### Bug 1 — Friend search is case-sensitive

**What's happening:** In the Friends tab, typing `vic` does not match a user named `Victoria`. Search only matches when the case matches exactly. Users expect search to be case-insensitive.

**Likely root cause:** Either a Firestore `where(..., '==', ...)` query against the username field (Firestore is case-sensitive by design), or a client-side `.includes()` / `===` filter that compares raw strings.

**Two implementation paths:**
- **(a) Lowercase-at-write.** Store a `usernameLower` field on each user doc, query against it. Most scalable, but requires a one-time migration for existing users.
- **(b) Client-side filter.** Fetch the candidate user list (already loaded for the friends-already-following display), filter in JS with `.toLowerCase()` on both sides. Simpler, no migration, fine at PocketBirds' scale.

**Recommendation:** Go with (b) for now. Revisit if the user base ever exceeds a few thousand and the load becomes meaningful.

**Open questions:** None.

**Prompt for Claude Code:**

```
Make friend search case-insensitive in the Friends tab.

Currently typing 'vic' doesn't match a user named 'Victoria' — search requires exact case. Fix this with a client-side filter, no Firestore schema or migration changes.

Files to investigate:
- app/(tabs)/friends.tsx (the search UI and probably the filter)
- app/services/userService.ts (Firestore user/friend management)

Approach:
- If the comparison is happening client-side, lowercase both sides before comparing.
- If the comparison is happening in a Firestore query, switch to fetching the candidate list and filtering in JS using .toLowerCase() on both the input and the candidate field.
- Keep the existing match behavior otherwise (substring vs prefix — whatever it does today, keep it).

Acceptance criteria:
- Typing 'vic' matches a user named 'Victoria'
- Typing 'VIC' matches 'Victoria'
- Typing 'Victoria' still matches 'victoria'
- Typing the empty string returns the same default list as before
- No Firestore writes; this is a read-side fix only

Verify in the dev client by searching with mixed case and confirming matches. Report which file and line you changed.
```

---

### Bug 2 — Android push notification icon renders inconsistently across OEMs (UPDATED Jun 4 2026, deferred)

**UPDATE Jun 4 2026 — the original "not wired up" diagnosis is STALE; the icon is now fully wired and the real issue is different.** Confirmed in the native project:
- `AndroidManifest.xml` HAS both meta-data tags (`default_notification_icon` → `@drawable/notification_icon`, `default_notification_color` → `@color/notification_icon_color`).
- `notification_icon.png` exists in all 5 density buckets (dated May 26 2026).
- `colors.xml` has `notification_icon_color = #f5b800` (gold).
- The drawables ARE correct white-silhouette-on-transparent format (RGB ~100% white, alpha = bird shape, ~60% transparent).

**Actual symptom (reported by Alex Jun 4 2026):** with BOTH Alex and Vic on the same release (Emerald), Alex's device shows the gold bird correctly, but Vic's shows a generic circle, and sometimes "stacked rectangles." Version skew is ruled out (same build), so this is **device/OEM-specific small-icon rendering**, not a wiring bug.

**Likely root cause:** the small drawables are heavily anti-aliased — the 24×24 `mdpi` is ~25% semi-transparent (feathered) pixels. Aggressive OEM skins (Samsung One UI, Xiaomi MIUI) render feathered/detailed monochrome icons inconsistently: some mask to a circle, some show a blob/rectangle, and stacked notifications amplify it. Android's guidance is a bold, simple, crisp silhouette.

**Fix when picked up:** regenerate the density drawables from a cleaner, higher-contrast silhouette with minimal edge feathering (especially mdpi/hdpi) — fewer semi-transparent pixels, sharper alpha edges. Test specifically on Vic's device model (a Samsung/Xiaomi if that's what she has). The manifest/colors wiring below is already correct and does NOT need redoing.

**Status:** DEFERRED (Alex's call Jun 4 2026 — cosmetic, not a regression).

---

**[Original write-up below — note the "not wired" parts are now DONE; kept for the icon-format + density-bucket detail.]**

**What's happening:** When a friend logs a sighting and the recipient gets a push notification on Android, the small icon in the system tray (top status bar) is a blank/generic circle — not a PocketBirds icon. The user can't tell at a glance which app the notification is from. iOS uses the app icon for notification badges so iOS is unaffected; this is Android-only.

**Root cause (confirmed by inspecting the repo):** The eagle silhouette PNG already exists at `assets/images/notification-icon.png` and `app.json` already references it via the `expo-notifications` plugin:

```json
["expo-notifications", { "icon": "./assets/images/notification-icon.png", "color": "#4A90E2" }]
```

But because this is a **bare workflow** Expo app (per CLAUDE.md), the `app.json` plugin config does **not** propagate to native code automatically. Native is the source of truth. And native isn't wired up:

- `android/app/src/main/AndroidManifest.xml` has **no** `<meta-data android:name="com.google.firebase.messaging.default_notification_icon" .../>` tag. Without that meta-data, FCM (and therefore Expo Push) doesn't know which drawable to use, so Android falls back to its default circle.
- `android/app/src/main/res/drawable-*/` has no `notification_icon.png`. The PNG is sitting in JS-land assets, not as a native Android drawable resource.

Two additional cosmetic notes worth fixing in the same change:
- The configured tint color in `app.json` is `#4A90E2` (a generic Expo blue), not the brand palette. Should be brand gold to match PRD §10.
- The icon PNG itself appears to be white-on-transparent (correct for Android), but worth double-checking once the wiring is done — if the tray icon shows up as a solid white blob instead of the eagle shape, the PNG has non-transparent pixels and needs to be re-exported.

**Important constraints:**
- This is a **native change.** The current dev client APK won't pick up the new drawable until it's rebuilt (`eas build --profile development --platform android --non-interactive`). Alex needs to rebuild the dev client to test, OR jump straight to a production build.
- Do **not** run `expo prebuild` — that would regenerate the entire android/ directory and overwrite the manual customizations already in place (push setup, Gradle plugin, etc., per CLAUDE.md).

**Open questions:** None — the silhouette already exists, just needs to be wired into the native build.

**Prompt for Claude Code:**

```
Fix the Android push notification icon. Currently it renders as a generic circle in the status bar because the existing eagle silhouette is sitting in JS assets but isn't wired into the native Android build.

Repo state (already confirmed):
- assets/images/notification-icon.png exists (eagle silhouette, looks like white-on-transparent).
- app.json has the expo-notifications plugin config pointing at it with color #4A90E2.
- AndroidManifest.xml has NO default_notification_icon meta-data.
- android/app/src/main/res/drawable-*/ has no notification_icon.png.

This is a bare workflow Expo app, so app.json plugin config does NOT propagate to native — we wire it manually.

DO NOT run `expo prebuild` or `expo prebuild --clean`. That would blow away the customizations in android/ (Firebase google-services plugin, push setup, etc.). Treat android/ as hand-maintained source code.

Work to do:

1. RESIZE and place the notification icon as a native drawable resource. Take assets/images/notification-icon.png and produce these density-bucketed copies, written to android/app/src/main/res/:
   - drawable-mdpi/notification_icon.png — 24x24
   - drawable-hdpi/notification_icon.png — 36x36
   - drawable-xhdpi/notification_icon.png — 48x48
   - drawable-xxhdpi/notification_icon.png — 72x72
   - drawable-xxxhdpi/notification_icon.png — 96x96

   Use ImageMagick (`magick` or `convert`) or sharp via Node to resize. Preserve transparency. The PNG must remain white-on-transparent — do NOT bake in a background color, and do NOT add color to the silhouette itself.

   If you cannot run image-processing tooling, stop here and ask me to drop in the resized files manually. Do not skip ahead with placeholders.

2. EDIT android/app/src/main/AndroidManifest.xml. Inside the <application> tag (after the existing expo.modules.updates meta-data lines, before the <activity>), add:

     <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/notification_icon" />
     <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color" />

3. CREATE android/app/src/main/res/values/colors.xml (or edit if it exists) and add:

     <color name="notification_icon_color">#C89A2B</color>

   Check constants/Colors.ts and design_handoff_pocket_dex/ for the exact brand gold hex first — use that value if different. The point is to match the cream-and-gold brand palette (PRD §10), not the generic Expo blue currently in app.json.

4. UPDATE app.json's expo-notifications plugin entry to match the same brand gold color (so the managed-workflow config doesn't drift from the manifest). Change "color": "#4A90E2" to the brand gold hex. Leave the icon path as-is — it's still useful for any future prebuild/managed-workflow tooling.

5. DO NOT change anything else:
   - app/services/notificationService.ts — leave it
   - functions/index.js (the Cloud Function) — leave it
   - The Expo Push send payload — leave it
   - app/_layout.tsx — leave it

   The manifest default is the right layer. We do NOT need per-notification _icon overrides.

6. Verification. The dev client APK won't pick up native drawable changes without a rebuild, so the verification flow is:

   a. Rebuild the dev client: `eas build --profile development --platform android --non-interactive`
   b. Install the new APK on Alex's phone (uninstall the old dev client first).
   c. Have Victoria's account log a sighting (or trigger a push manually via the curl recipe in CLAUDE.md → "Layer 3 — Expo push API").
   d. Pull down the notification shade on Alex's phone. The small icon next to the title should be the eagle silhouette, tinted gold.

   If the eagle is invisible (white-on-white in light mode), the source PNG has non-transparent pixels and needs to be re-exported as a true silhouette.

Acceptance criteria:
- Drawables exist in all 5 density folders.
- AndroidManifest.xml has both meta-data tags.
- colors.xml has notification_icon_color.
- app.json color matches the manifest color.
- Existing push pipeline is untouched (verifiable: send a push BEFORE the rebuild and confirm it still arrives normally).
- After dev client rebuild and a test push, the eagle silhouette appears in the status bar tinted in brand gold.

Commit each step as a separate commit (drawables, manifest, colors.xml + app.json) so any one step can be reverted in isolation.
```

---

### Bug 3 — Offline mode drops sightings (DATA LOSS, priority)

**What's happening:** Reproducible flow that Vic hit today:
1. Open the app online. Sightings load.
2. Turn on airplane mode.
3. Close the app.
4. Reopen the app while still in airplane mode → **feed is empty.**
5. Log several sightings while still offline.
6. Close the app again.
7. Reopen → those sightings are not visible.
8. Turn off airplane mode and the sightings logged in step 5 never sync to Firestore — they're permanently lost.

**Why this is the top-priority bug:** Data loss is the only class of bug that erodes trust irrecoverably. A user who has watched their bird logs disappear once stops trusting the app, and going forward they won't log offline at all — which kills the trip-driven cadence the product depends on (§6 of `PRD.md`).

**Likely root causes (need to confirm with instrumentation before fixing):**
1. **Cold-start ordering.** On startup, `SightingsContext` may be awaiting a Firestore fetch that hangs/fails silently when offline, leaving the in-memory list empty instead of falling back to the AsyncStorage cache.
2. **Write path doesn't tolerate offline.** When a sighting is logged, `sightingService` may attempt the Firestore write first and only persist to AsyncStorage on success — meaning offline writes are dropped entirely.
3. **No pending-sync queue.** There may be no concept of "this sighting was created offline and needs to be flushed when we have a connection." If so, offline-created sightings live nowhere durable.
4. **Migration brittleness.** Per CLAUDE.md there's an AsyncStorage migration for the old `lastLocation` shape. If a similar legacy shape is encountered and the migration throws, the cache read may bail and return empty.
5. **ID reconciliation.** Offline sightings probably need a local UUID at creation, then reconcile with Firestore's generated ID on sync. If the reconciliation logic is missing, you get duplicates or drops.

**Open questions:**
- None at the requirements level. The fix needs investigation before code changes — Claude Code should report what it found before patching.

**Prompt for Claude Code:**

```
HIGH PRIORITY BUG — Data loss in offline mode. Treat this as a careful patch, not a rewrite.

Repro (confirmed by a real user today):
1. Open app online — sightings load.
2. Turn on airplane mode.
3. Close the app.
4. Reopen the app while still offline → feed is empty (BUG).
5. Log 3 sightings while offline.
6. Close app, reopen → those sightings are gone (BUG).
7. Turn off airplane mode → the sightings logged in step 5 never sync. They are permanently lost (BUG).

Files involved:
- app/context/SightingsContext.tsx (sightings state — syncs Firestore + AsyncStorage)
- app/services/sightingService.ts (Firestore read/write)
- Possibly app/_layout.tsx (auth/init ordering)

PHASE 1 — Investigate and report BEFORE changing logic.
Add temporary console.log instrumentation to:
- SightingsContext on mount: what does it read from AsyncStorage? What does it read from Firestore? In what order? Does it block on Firestore?
- sightingService write path: does an offline write hit AsyncStorage? Does it queue anywhere? Does the Firestore promise reject silently?
- Any sync/flush routine that runs on connectivity-restore: does one exist? What does it do?

Reproduce the bug manually (or by simulating offline in a test) and report what you find. List which of these is true:
- (a) Cold start awaits Firestore and never falls back to cache.
- (b) Offline writes don't persist to AsyncStorage.
- (c) There's no pending-sync queue, so offline writes are not flushed on reconnect.
- (d) A migration / parse error is throwing on cache read.
- (e) Something else.

Show me your findings before writing the fix.

PHASE 2 — Fix design (propose, then implement after I confirm).
Target behavior:
1. Cold start: ALWAYS hydrate UI from AsyncStorage immediately. Then, if online, refresh from Firestore and reconcile. If offline, stay on the cache and listen for connectivity.
2. Offline write: persist to AsyncStorage with a pending-sync flag (e.g., { ...sighting, _pendingSync: true, _localId: uuid }) and show it in the UI immediately.
3. Connectivity restored: flush pending-sync items to Firestore in chronological order. On success, replace the local record's _localId with the Firestore-assigned id and clear _pendingSync. On failure, KEEP the pending flag — do not drop.
4. Never delete a sighting from AsyncStorage as a side effect of a Firestore read returning fewer items. The Firestore list is a source of truth for synced sightings only.

PHASE 3 — Acceptance criteria.
- Repro the bug WITHOUT the fix first and confirm you can reproduce it. (Use NetInfo / airplane mode / a mocked offline state — whichever is fastest.)
- After the fix: airplane mode → log 3 sightings → close & reopen app → all 3 appear. Turn airplane mode off → wait → all 3 appear in Firestore with their original timestamps.
- Online-only behavior is unchanged. Existing online users see no regression.
- No data is silently overwritten. If a Firestore document with the same Firestore id already exists, prefer the server copy and log a warning.

DO NOT delete or refactor SightingsContext or sightingService as a whole. Treat any change as a localized patch. Commit phase-by-phase so a single bad commit is easy to revert.
```

---

### Bug 4 — Friend search dropdown doesn't reappear after type+delete

**What's happening:**
1. Tap the friend search input → dropdown of all friends appears. Good.
2. Type a friend's name → dropdown filters down. Good.
3. Delete the typed text (input back to empty) → dropdown disappears. Bad.
4. Tap the input again to refocus → dropdown does not reappear. Bad.

**Likely root cause:** The dropdown's visibility predicate is probably `searchText.length > 0` (or similar) when it should be `(isFocused || searchText.length > 0)`. After typing-then-deleting, the input may still be focused, but the predicate is false; and on subsequent re-focus, the focus state may not be updating because React Native's `TextInput` focus handlers are subtle.

**Where:** `app/(tabs)/friends.tsx`, probably a `showDropdown` boolean or a JSX conditional render.

**Watch out for:** The classic React Native gotcha where `onBlur` fires before `onPress` on a dropdown item, dismissing the dropdown before the tap registers. The fix needs to preserve whatever debounce/delay handles that case today.

**Open questions:** None.

**Prompt for Claude Code:**

```
Fix the friend search dropdown visibility bug.

Repro:
1. Tap the friends search input → dropdown shows all friends. GOOD.
2. Type → dropdown filters. GOOD.
3. Delete the typed text → dropdown disappears. BUG.
4. Tap the input again → dropdown does not reappear. BUG.

File: app/(tabs)/friends.tsx (or wherever the friend search UI lives — check there first).

Likely cause: the dropdown's visibility predicate is gated on `searchText.length > 0` instead of `(isFocused || searchText.length > 0)`. Fix it to show whenever the input is focused, regardless of text content.

Watch out for the React Native onBlur-before-onPress gotcha: if the dropdown hides on blur, tapping a friend in the dropdown may register a blur before the press, dismissing the dropdown without selecting. If there's existing logic that handles this (a setTimeout on blur, or onPressIn instead of onPress), preserve it.

Acceptance criteria:
- Focus input (no text) → dropdown shows full friend list
- Type → dropdown filters
- Delete text → dropdown still shows full list (still focused)
- Blur input (tap outside) → dropdown hides
- Tap a friend in the dropdown → selection still works, no race condition

Show me the diff. This should be a small change.
```

---

### Bug 5 — App display name is "PocketBirds4" instead of "PocketBirds"

**What's happening:** On Alex's phone home screen, the app label under the icon reads "PocketBirds4" — the scaffolding name from `expo init` that never got cleaned up. It should just be "PocketBirds."

**Where the wrong name lives (confirmed by inspecting the repo):**
- `app.json` → `expo.name`: `"PocketBirds4"` (line 3)
- `android/app/src/main/res/values/strings.xml` → `<string name="app_name">PocketBirds4</string>` (line 2) — this is what Android actually reads for the home-screen label
- `ios/PocketBirds4/Info.plist` → `CFBundleDisplayName`: `PocketBirds4` (line 10) — this is what iOS reads

**What NOT to change (intentionally leave alone):**
- `expo.slug` (`"PocketBirds4"` in app.json) — this is tied to the EAS project. Changing it can disconnect the project from EAS credentials and the existing build pipeline. Slug is internal; not user-visible. Leave it.
- `expo.scheme` (`"pocketbirds4"` in app.json) and the matching `<data android:scheme="pocketbirds4"/>` in `AndroidManifest.xml` and `CFBundleURLSchemes` in `Info.plist`. Changing the deep-link scheme would break any in-flight invite links and break push-notification deep linking (which is a planned feature per CLAUDE.md backlog). Defer this decision — it's a separate change with its own coordination cost.
- Directory names (`ios/PocketBirds4/`, `ios/PocketBirds4.xcodeproj/`, etc.) — renaming Xcode project source dirs is fiddly and not worth doing just for cosmetics. The user never sees these.

**Important constraints:**
- This is a **native change** for both platforms (strings.xml on Android, Info.plist on iOS). Requires rebuilds — the home-screen label only updates after the app is reinstalled from a new build.
- After the rebuild, Alex should uninstall the old "PocketBirds4" app from his phone before installing the new one, otherwise both icons may briefly coexist.

**Open questions:** None.

**Prompt for Claude Code:**

```
The app's display name on the phone home screen is "PocketBirds4" — the scaffolding name from `expo init`. It should be "PocketBirds". Fix all three places:

1. app.json:
   - "expo.name": "PocketBirds4" → "PocketBirds"
   - Leave "expo.slug" alone — it's tied to the EAS project and must stay "PocketBirds4".
   - Leave "expo.scheme" alone — changing the deep-link scheme would break invite links and push deep links (planned feature). That's a separate decision.

2. android/app/src/main/res/values/strings.xml:
   - <string name="app_name">PocketBirds4</string> → <string name="app_name">PocketBirds</string>

3. ios/PocketBirds4/Info.plist:
   - <key>CFBundleDisplayName</key><string>PocketBirds4</string> → <string>PocketBirds</string>
   - Leave CFBundleURLSchemes alone — same reasoning as expo.scheme above.

DO NOT:
- Rename any directories (ios/PocketBirds4/, ios/PocketBirds4.xcodeproj/, android source paths, etc.). The user never sees these.
- Run `expo prebuild` — it would regenerate android/ and lose customizations (Firebase google-services plugin, push setup, etc., per CLAUDE.md).
- Touch CLAUDE.md path references — they refer to the on-disk project location which we're not changing.

Acceptance criteria:
- All three files changed as above and nothing else.
- A grep for "PocketBirds4" in the repo (excluding node_modules, build artifacts, ios/PocketBirds4* directory names, EAS slug references, and CLAUDE.md) returns only legitimate path/slug/scheme references.
- After Alex rebuilds (`eas build --profile development --platform android --non-interactive` and `eas build --profile development --platform ios --non-interactive`), reinstalls the apps, and looks at his home screen, the label reads "PocketBirds".

Commit as a single small commit since the three changes are atomically one logical fix.
```

---

### Bug 6 — iOS push notifications broken: missing `aps-environment` entitlement (priority)

**Found:** June 3 2026, testing the Sheartail TestFlight build on a real iPhone.

**What's happening:** On app open, iOS shows a popup notification error: `no valid "aps-environment" entitlement string found for application` (this fires when the app registers for push at startup — it is NOT triggered by the location button; the location crash is a separate bug, see Bug 7). Concrete user-visible symptom: cross-platform push is one-directional. When the iOS friend (username `evaloon`) logged a bird, the Android users got the push (iOS → Android works). But when an Android user logged a bird, `evaloon` on iOS got **nothing** (Android → iOS is dead).

**Root cause:** The iOS build is missing the `aps-environment` entitlement. Without it, iOS refuses to register the app with APNs, so the device never obtains a valid push token. The Expo → FCM → APNs delivery path has nothing to deliver to. This directly contradicts the optimistic note in CLAUDE.md ("the EAS-generated provisioning profile should include the push entitlement, but it's untested") — it's now tested, and it's broken.

**Why it's only one-directional:** Sending works fine from iOS because the *sender* doesn't need push entitlements; the Cloud Function runs server-side and pushes to the *recipient's* token. Android recipients have valid tokens, so iOS → Android lands. iOS recipients have no valid token (or a stale/invalid one), so Android → iOS fails.

**Where to look:**
- `app.json` ios block — needs `ios.entitlements` with `"aps-environment": "production"` (or rely on the Push Notifications capability being baked into the provisioning profile). Currently `infoPlist.UIBackgroundModes=["remote-notification"]` is set but that is NOT the same as the `aps-environment` entitlement.
- EAS credentials / provisioning profile (`V4H2K892QC`) — confirm it was generated against an App ID that has the Push Notifications capability enabled. The App ID `com.akeats97.pocketbirds` was registered WITH Push Notifications (per CLAUDE.md), so the profile may just need regenerating so the entitlement is actually embedded in the build.
- After fixing, re-verify with Firestore: log in on the iOS device → confirm `users/{uid}.expoPushToken` is populated and fresh → have an Android user log a sighting → push should land on iOS within ~10s. Use the layer-by-layer pipeline in CLAUDE.md's "Push Notifications — Working Setup" if it still fails.

**Open questions:** Whether to set `aps-environment` explicitly in `app.json` `ios.entitlements` vs. fixing it at the provisioning-profile layer in EAS. Decide before next iOS build.

---

### Bug 7 — Location feature crashes the app on iOS

**Found:** June 3 2026, same Sheartail TestFlight build on iPhone.

**What's happening:** Tapping the **location button** (the crosshair "locate" icon in the Add Sighting location field) on iOS crashed the app. After force-relaunch, the app also showed the `aps-environment` notification popup from Bug 6 — but that popup is the startup push-registration error, unrelated to the location tap. The location crash itself is this bug.

**Likely root cause:** Missing iOS location usage-description strings in `Info.plist` / `app.json`. iOS hard-crashes an app that calls `expo-location` without the required `NSLocationWhenInUseUsageDescription` (and/or `NSLocationAlwaysAndWhenInUseUsageDescription`) key present. CLAUDE.md records that `NSPhotoLibraryUsageDescription` was added for photos, but there is no mention of a location usage-description string being added — that omission lines up exactly with a crash-on-location.

**Where to look:**
- `app.json` ios `infoPlist` block — add `NSLocationWhenInUseUsageDescription` (a human-readable reason string). Compare against the existing `NSPhotoLibraryUsageDescription`.
- `app/services/locationService.ts` — confirm permission request flow; on iOS the OS prompt only appears if the usage-description key exists, otherwise the call faults.
- Reproduce on iOS: Add Sighting → tap the crosshair locate icon → should prompt for permission, not crash.

**Open questions:** Confirm whether the crash is purely the missing usage-description string or also involves the Google Places autocomplete path (which is network/key-based, not OS-permission-based). The crosshair "locate" tap (GPS + reverse-geocode) is the most likely crash trigger.

---

## Operations / Security

### Lock down the Google Places API key (HIGH PRIORITY)

**What's happening:** The `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` used for the Add Sighting location autocomplete has **no application restrictions** in GCP. It's `EXPO_PUBLIC_*`, which means it ships embedded in the JS bundle of every released APK / AAB. Anyone who pulls the APK off the Play Store can extract the key and use it against the `pocketbirds` GCP project.

**Why this matters:** The Maps Platform free tier is $200/month. A motivated attacker (or an indexed-online key) can burn through that in hours and start billing real money. CLAUDE.md's claim that the key is restricted is currently wrong, which is how it slipped past for so long.

**Fix:** Add Android app restrictions in <https://console.cloud.google.com/apis/credentials?project=pocketbirds>. Add TWO allowed entries (one per package id, both signed with the same EAS keystore SHA-1):

```
Package: com.akeats97.pocketbirds       SHA-1: 9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85
Package: com.akeats97.pocketbirds.dev   SHA-1: 9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85
```

Restrictions take ~5 min to propagate. Once applied: only APKs signed by the EAS keystore (i.e., our own production + dev client builds) can use the key.

**API restriction (separate):** Also worth tightening the *API* restriction to only "Places API" (classic) so a leaked key can't be used against other Maps endpoints. Already may be set this way; verify in the same console.

**Verify after applying:** Open Add Sighting in the dev client, type into the location field. If autocomplete returns suggestions, restrictions are correctly configured. If suggestions stop coming, double-check the SHA-1 and package strings are exactly right (no trailing spaces, hex separated by `:`).

**Open questions:** None.

---

### Lock down Firestore security rules (CRITICAL)

**What's happening:** The project's Firestore security rules are wide open. The active ruleset (fetched May 26 2026 via the Rules API) is:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

`if true` means anyone, signed in or not, can read, modify, or delete every document: all `users` (including each user's `expoPushToken`), all `sightings`, `following`, `usernames`, and the new `notificationPrefs`.

**Why this matters:** A Firebase web config is not a secret. It ships in every APK (in the JS bundle and `android/app/google-services.json`), so anyone who pulls the app off the Play Store can extract `projectId` + `apiKey` and call Firestore directly. The only thing protecting the data is security rules, which are currently off. Someone could wipe every sighting or harvest push tokens.

**Fix (its own careful task, not a quick toggle):** Write per-collection rules and test them so the app keeps working. Sketch:
- `users/{uid}`: readable by any signed-in user (friend search and profiles need it); writable only by the owner (`request.auth.uid == uid`). Same for `users/{uid}/notificationPrefs/{any}`.
- `usernames/{name}`: readable by signed-in users; writes constrained to claiming an unused handle for yourself.
- `sightings/{id}`: writable only by the owner; readable by the owner and followers (see open question).
- `following/{follower}/following/{followed}`: writable only by `follower`.
- Default-deny everything else.

**Before deploying:** a rules deploy replaces the live ruleset wholesale, so develop against the Firestore emulator or a throwaway project first, exercise login / add-sighting / friends feed / follow / notification bell, THEN deploy. Keep the file in the repo (`firestore.rules` wired into `firebase.json`) so it's version-controlled from then on.

**Open questions:** Should sightings be readable by any signed-in user, or restricted to followers only? The friends-feed query uses `where('userId','in', followedIds)`, so a followers-only read rule needs to stay compatible with that query shape.

---

## Features

Same format as bugs above. Each feature has a description, design considerations, open questions where I've made calls worth re-examining, and a self-contained Claude Code prompt.

A suggested build order is at the end of this section.

---

### Feature 1 — GitHub-style activity grid

**What we want:** A grid of colored squares, one per week, showing your birding activity over time. Gray for inactive weeks, shades of green for weeks with sightings, with some visual mark on weeks where you logged a new species. Visually similar to the GitHub contribution graph but week-granularity instead of day.

**Design considerations:**
- **Granularity:** Weeks, not days (per Alex's note). One row of ~52 weeks for a rolling 1-year view fits nicely on a phone screen.
- **Color scheme:** 4 tiers of green based on sightings-in-week count, plus a "new species" overlay (a thin gold border or dot in the corner). Suggested: 0 sightings = gray, 1–2 = light green, 3–5 = medium green, 6+ = dark green. Brand palette will tune the specific hues.
- **Where it lives:** Best placement is a header card on the Field Journal screen. Field Journal is already "your birding life" — adding a heat-map header makes it feel like a meaningful personal page. Alternative is a new "You" / Profile screen, but that's a bigger lift.
- **Interaction:** Tap a square → small modal/tooltip showing that week's sightings (count + species list). Pure read-only.
- **Data:** Fully derived from existing `sightings` collection client-side. No Firestore schema changes.
- **Friend view:** Not in v1. This is personal-only for now. (Mirrors PRD §4 #4 — soft visibility of progress, not rank.)

**Open questions / calls I made:**
- I put this on the Field Journal as a header card. If you'd rather it live on a separate profile screen, easy to change.
- I picked 52 weeks rolling (always shows the last year). Alternative: calendar year (Jan–Dec) which resets cleanly Jan 1 and pairs nicely with the Goodreads-style annual species goal from PRD §7.

**Prompt for Claude Code:**

```
Build a GitHub-style activity grid for the Field Journal.

What it is:
- A horizontal row of ~52 squares above the existing sightings list on the Field Journal screen.
- Each square represents one calendar week.
- Color tiers:
  - Gray (no sightings that week)
  - Light green (1–2 sightings)
  - Medium green (3–5 sightings)
  - Dark green (6+ sightings)
- A small gold dot/badge in the corner of any week where the user logged a species they hadn't seen before.
- Tap a square → modal showing that week's date range, sighting count, species count, and a list of the sightings.

Files involved:
- New component: components/ActivityGrid.tsx
- Mount it as a header in app/(tabs)/index.tsx (the Field Journal screen)
- Helpers: app/utils/activityGrid.ts for the week-bucketing + color-tier logic

Data:
- Read from the existing SightingsContext. No Firestore schema changes.
- "Week" = ISO week (Monday-to-Sunday) for consistency. Use date-fns helpers if available, or hand-roll if not.
- To detect "new species that week," sort all sightings by date and walk through them, tracking species seen so far. A week is a "new species" week if any sighting in it introduced a never-before-logged species. Compute this once and cache.

Color values: use the brand palette from constants/Colors.ts. If there's no existing green ramp, propose 4 hexes that work with the cream + gold theme and ask me before committing — don't just pick green from thin air.

Acceptance criteria:
- Field Journal shows the activity row at the top, above the sightings list.
- Squares display correct colors based on the rules above.
- New-species weeks have the gold dot.
- Tapping a square opens a modal with the week's date range and sighting list.
- Empty state (new user with no sightings) shows the grid with all gray squares — does not crash.
- Performance: must not re-compute the grid on every render. Memoize.

Out of scope:
- Showing this grid on a friend's profile (personal-only for now).
- A separate profile/me screen (Field Journal is the host for now).
- Year-based view; we're doing 52-weeks-rolling for v1.

Keep the existing Field Journal sightings list and behavior unchanged. The grid is purely additive.
```

---

### Feature 2 — Levels based on sightings

**What we want:** Progressive tiers a user climbs as they see more species. Similar to Google Maps Local Guide or Duolingo XP levels — each level harder than the last, with named tiers that feel rewarding.

**Design considerations:**
- **Metric:** Unique species (lifetime) is the right metric, not raw sighting count. Aligns with the "noticing" principle (PRD §4 #5) better than rewarding volume of taps.
- **Curve:** Should be roughly exponential — easy to hit Level 2, very hard to hit Level 10. Curve below is a starting point.
- **Naming:** This is the fun part. Names should match the brand voice (playful + slightly cheeky, respectful of the birds — PRD §10). Proposed names below.
- **Display:** A small badge next to your name on the Field Journal header, on friends' feed cards next to your name, and as a prominent stat on your profile.
- **Progression UI:** Tap your level badge → modal showing current level, species count, what level you'd reach at X species (motivational).
- **Naming + thresholds are the most opinionated thing here.** Below is a strawman.

**Proposed strawman — 10 levels, species-based:**

| Level | Name | Species threshold |
|---|---|---|
| 1 | Curious | 1 |
| 2 | Backyard Watcher | 5 |
| 3 | Park Strider | 15 |
| 4 | Trail Spotter | 30 |
| 5 | Field Birder | 50 |
| 6 | Habitat Hopper | 100 |
| 7 | Migration Tracker | 200 |
| 8 | Lifer Hunter | 400 |
| 9 | Pelagic Wanderer | 700 |
| 10 | Lifelong Birder | 1000 |

**Open questions / calls I made:**
- **Metric:** unique species, not sighting count. Push back if you want both (e.g., level requires species count AND total sightings).
- **Names + thresholds above are my strawman.** Iterate freely. "Pelagic Wanderer" is cheeky bird-nerd vocabulary — feels on-brand but worth confirming.
- **Should level be visible to friends?** I'd say yes, small badge on profile + next to name in feed. Soft visibility, not rank. Push back if you want it private.
- **Capped at 10?** Above 1000 species is rare-air birding. Could be uncapped with a final "you are unhinged" level, but 10 is a clean ceiling.

**Prompt for Claude Code:**

```
Add a leveling system based on unique species count.

Spec:
- Metric: number of unique species the user has logged (lifetime), not total sightings.
- 10 levels with the names and thresholds in the table below.
- Display: a small level badge (number + name) shown in three places:
  1. Field Journal header — large, prominent.
  2. Profile / friends list rows — small chip.
  3. Friend feed cards — micro pill next to the friend's name on each SightingCard.
- Tap any level badge → modal showing current level, species count toward next level, and a list of all 10 levels with check marks for completed ones.

Levels (start with these — Alex may iterate the names later):
  1: Curious — 1 species
  2: Backyard Watcher — 5 species
  3: Park Strider — 15 species
  4: Trail Spotter — 30 species
  5: Field Birder — 50 species
  6: Habitat Hopper — 100 species
  7: Migration Tracker — 200 species
  8: Lifer Hunter — 400 species
  9: Pelagic Wanderer — 700 species
  10: Lifelong Birder — 1000 species

Files:
- constants/levels.ts — the level table (array of {level, name, threshold}).
- app/utils/level.ts — getLevel(speciesCount) → {level, name, nextThreshold, progressToNext}.
- New component: components/LevelBadge.tsx — renders the chip/pill/large badge based on a size prop.
- Mount in:
  - app/(tabs)/index.tsx (Field Journal header, size="large")
  - components/SightingCard.tsx (next to user name, size="micro")
  - app/(tabs)/friends.tsx in the friends list rows (size="small")

For other users' levels (friends), use their species count from whatever already-loaded source the friends list uses. If friend species count isn't currently denormalized, you'll need to either fetch it lazily or denormalize it onto the user doc — propose an approach and ask me before adding a Cloud Function or migration.

Brand voice:
- The level names are playful and slightly cheeky. Keep the modal copy in the same register — short, warm, never patronizing. "You're 12 species away from Habitat Hopper" — not "Just 12 more to unlock!"
- See PRD §10 for voice rules.

Acceptance criteria:
- All three placements render the correct badge for the current user.
- Friend-feed cards show the friend's level badge correctly.
- Tap → modal with full ladder + progress works.
- Level 1 user (just signed up with 0 species) shows "Get your first sighting to reach Curious" or similar empty-state copy in the badge.
- No regressions on existing Field Journal, Friends, or SightingCard layouts.

Out of scope (don't build these yet):
- Sorting Friends list by level.
- Push notification when a level is reached (that's a separate milestone-push feature).
- Different metrics (sighting count, photo count, etc.).
```

---

### Feature 3 — Push notification when someone follows you

**What we want:** When User B follows User A, A gets a push notification: "Victoria started following you on PocketBirds." Simple, single-event, no rate limiting needed for v1.

**Design considerations:**
- Cloud Function trigger on creation of a follow doc.
- Push payload should ideally deep-link to the new follower's profile, but per CLAUDE.md backlog, push deep-linking isn't implemented yet for sighting pushes either. Ship without deep link for now — tap just opens the app.
- Copy: keep short and warm. "Victoria started following you" is plenty.

**Open questions / calls I made:**
- **No rate-limiting.** If someone unfollows and refollows, they'll get another push. Edge case unlikely to matter for a friend-graph app of 5–20 people. Re-evaluate if it becomes a problem.
- **No deep-linking yet.** Coordinate with the planned push-deep-link feature in CLAUDE.md backlog — when that lands, retrofit this notification to deep-link to the follower's profile.

**Prompt for Claude Code:**

```
Add a push notification fired when a user gets a new follower.

Trigger:
- Fires when a new follow document is created (whatever shape userService.ts uses today — investigate first).
- The recipient is the user being followed.
- The actor is the user who initiated the follow.

Copy:
- Title: "PocketBirds"
- Body: "{actor.username} started following you"
  (Use display name if set, otherwise username. If neither is available, use "Someone".)

Implementation:
- Add a new Cloud Function in functions/index.js, following the pattern of the existing onSightingAdded function (see CLAUDE.md "Push Notifications — Working Setup" for the working architecture).
- Use the same Expo Push send path as the existing sighting-push code — do not introduce a new transport.
- Read the recipient's expoPushToken from their user doc.
- If the recipient has no token, skip silently (log a warning).
- If the Expo Push call fails, log the error — don't retry for v1.

DO NOT:
- Add a per-friend notification preference check here. (That's Feature 4 and will gate this call later.)
- Add deep-linking on tap. (Out of scope until the general push deep-link feature lands.)
- Send the actor any "follow successful" confirmation push (the UI already shows it).

Acceptance criteria:
- Create a test follow → recipient device receives the push within ~10s.
- Push title is "PocketBirds", body is "{name} started following you".
- Existing sighting-add push still works (regression check).
- Follow with no recipient token does not error in logs.

Verification: deploy the function (`firebase deploy --only functions:onFollowAdded`), then have a test account follow Alex's account and confirm the push lands on his phone.
```

---

### Feature 4 — Per-friend notification preferences (YouTube bell)

**What we want:** Next to each friend in your friends list, a bell icon that opens a picker with three modes — exactly like YouTube's subscribe-bell:
- **All** — push for every sighting the friend logs.
- **Highlights** — push only when the sighting is a new species for the friend (a species they've never logged before) OR when it triggers an existing species-count milestone (5, 10, 25, 50, 100, 150, 200, ... — same thresholds as the in-app milestone celebration popup).
- **None** — silent. Sightings still appear in your feed; you just don't get pushed.

**Default:** "Highlights" for new friend relationships. Existing follows that have no pref doc also resolve to "Highlights." (Loud-but-not-too-loud — users still get the moments worth interrupting them for, without buzz fatigue.)

**Design considerations:**
- **Where preference lives:** Firestore subcollection on the *follower's* user doc — `users/{followerUid}/notificationPrefs/{followedUid}: { mode: "all" | "highlights" | "none", updatedAt }`. Absence of the doc resolves to "highlights" (the new default).
- **Existing milestone logic to re-use:** `app/constants/milestones.ts` already has `isMilestone(count)` — true for 5, 10, 25, then every 50 from 50 onward. The Cloud Function should use the same thresholds so the push aligns with the in-app celebration popup the user is seeing.
- **What counts as "highlights" in this v1:** Just two things — (a) new species for the poster, (b) species-count milestone for the poster (per `isMilestone`). Nothing else for now. See "v2 deferred" below.
- **UI:** Bell icon in each friends-list row. Three icon states (filled = all, outline = highlights, slashed = none). Tap → small action sheet / bottom modal with the three options and a one-line description. Don't cycle on plain tap — too easy to mis-set and not realize.

**v2 deferred (intentionally out of scope for the first version):**
- Push when the friend levels up (depends on Feature 2 / leveling system).
- Push when the friend hits their annual species goal (depends on the Goodreads-style annual goal data model from PRD §7, which isn't built yet).
- Both of these belong in the "highlights" bucket logically and should be added once those upstream features exist.

**Open questions / calls I made:**
- **Default changed to "Highlights"** (per Alex's call). This is silently quieter than today's behavior for users who have existing follows — they'll suddenly receive fewer pushes. That's intentional and aligned with PRD §5's "no daily-streak guilt trap" thinking, but worth flagging as a behavior change for current users.
- **No code-sharing with the client.** `functions/` has its own `node_modules` and package.json, so reaching into `app/constants/milestones.ts` from the Cloud Function isn't free. The prompt below tells Claude Code to copy the small `isMilestone` helper into `functions/` with a sync comment, rather than building infrastructure to share it.
- **Bell lives in the friends list, not on individual sighting cards.** Subscription-level setting, not per-sighting. YouTube model.

**Prompt for Claude Code:**

```
Add per-friend notification preferences with a YouTube-style bell UI.

Three modes, set per-friend by the follower:
- "all": push for every sighting the followed friend logs.
- "highlights": push only when the sighting is a new species for that friend (a species they've never logged before) OR when it triggers a species-count milestone (5, 10, 25, then every 50 from 50 onward — same thresholds as the existing in-app celebration popup).
- "none": no push. Sighting still appears in the follower's feed.

Default mode for any friend with no pref doc: "highlights". This is a behavior change from today (today = effectively "all" for everyone). That is intentional. Do not migrate existing users to explicit "all" docs — just let absence-of-doc resolve to "highlights".

Data model:
- Firestore subcollection: users/{followerUid}/notificationPrefs/{followedUid} with shape:
    { mode: "all" | "highlights" | "none", updatedAt: Timestamp }
- Absence resolves to "highlights".
- Do NOT eagerly create docs for every existing friend pair on first read.

Client UI:

1. Add a bell icon to each friend row in app/(tabs)/friends.tsx.

2. Icon states (use @expo/vector-icons Ionicons):
   - "all" → "notifications" (filled bell)
   - "highlights" → "notifications-outline" (outline bell)
   - "none" → "notifications-off" (slashed bell)

3. Tap the bell → open a small action sheet / bottom modal with three options and one-line descriptions:
   - "All sightings — push every time"
   - "Highlights only — push for new species and milestones" (this is the default)
   - "Nothing — silent, but still in your feed"

4. After selection, optimistic write to the subcollection; revert on error.

New service:
- app/services/notificationPrefsService.ts with:
  - getPref(followerUid, followedUid) → Promise<Mode>  (returns "highlights" if no doc)
  - setPref(followerUid, followedUid, mode) → Promise<void>
  - subscribeToPrefs(followerUid) → unsub  (real-time listener that hydrates a local map for UI)

Cloud Function (functions/index.js):

1. Locate the existing function that fires push when a sighting is added (per CLAUDE.md it's onSightingAdded). For each follower it currently pushes to:

   a. Look up users/{followerUid}/notificationPrefs/{posterUid}.
   b. Resolve mode: if doc missing → "highlights". Else use doc.mode.
   c. If mode === "none": skip.
   d. If mode === "all": send (existing behavior).
   e. If mode === "highlights":
      - Determine if this sighting is a NEW SPECIES for the poster. Query sightings where userId == posterUid AND species == sighting.species. If the result count is 1 (just this one), it's a new species → send.
      - If not new species, check if the sighting triggered a MILESTONE. Compute the poster's distinct species count AFTER this sighting (query distinct species for posterUid). If isMilestone(count) returns true, send.
      - Otherwise, skip.

2. The milestone helper — DO NOT try to import from app/constants/milestones.ts. functions/ has its own node_modules. Copy the helper into functions/lib/milestones.js (or inline at the top of index.js) with this comment:

     // KEEP IN SYNC with app/constants/milestones.ts.
     // Milestones: 5, 10, 25, then every 50 from 50 onward.

   Copy the isMilestone function verbatim — it's tiny.

3. For the new-species and milestone checks: be efficient about reads. One Firestore query per check is fine at our scale. Do not iterate every sighting.

DO NOT:
- Send more than one push per sighting per follower.
- Apply this pref to the follow-event push from Feature 3 (different event type).
- Cache pref docs across function invocations.
- Add a level-up check or annual-goal check. Those are v2 and depend on features that don't exist yet.

Acceptance criteria:
- A new follow defaults to "highlights" with no pref doc created.
- Existing follows (no pref doc today) resolve to "highlights" — verify by logging a non-milestone repeat species from a friend and confirming the follower gets no push.
- Tapping the bell on a friend row opens the picker. Selecting a mode persists across app restarts.
- "all" mode: every sighting pushes.
- "highlights" mode: new-to-friend species pushes; repeat species does not push; sighting that brings the friend to 5 / 10 / 25 / 50 / 100 etc. species pushes even if the species itself isn't new.
- "none" mode: no push for any sighting from that friend; sightings still appear in the follower's feed.
- The follow-event push (Feature 3) is unaffected.

Manual test plan:
1. Two test accounts, A follows B.
2. Without changing any prefs (so A is at default "highlights"), have B log a NEW species — A receives push. Good.
3. Have B log the SAME species again — A does NOT receive push.
4. Get B to 4 distinct species (no pushes since they're repeats or already-seen). Have B log species #5 — A receives push (milestone) AND it's a new species. Single push, not two.
5. Set A's pref for B to "all". Repeat steps 2–4. Every sighting pushes.
6. Set A's pref for B to "none". Log anything from B. A receives no push.
```

---

### Feature 5 — Account creation rethink (design discussion first)

**What we want:** Alex flagged this as a question, not a spec: *"Should we be using user names? handles? full name? do we need an email involved?"*

The PRD already takes a position on this in §9. Quoting:

> Users sign up with email + password. Identity in the app is a username (handle). Real name is not required. Optional profile photo. Optional display name.

So the work isn't to *decide* the model — that's settled. The work is to (a) audit what the app does today and (b) build whatever's missing to match §9.

**Why this model:**
- **Keep email** for password reset and account recovery. The cost of losing your account permanently is unacceptable, and password reset requires a verified channel. Email is the dull, durable answer.
- **Username (handle)** as the unique public identifier. Familiar from Twitter/Instagram. Enables friend search and @-mentions later if we add comments.
- **Display name** (optional, separate from handle) so a user can be "Vic" in the UI while their handle is `victoria_k`. Cheap to add, big UX win.
- **No required real name.** A friend-graph product doesn't need real names — the social proof comes from friend invites, not from "this user is verifiably Alex Keats." Keeps onboarding friction low and preserves privacy.

**Design considerations:**
- The first task is an audit: does the app today have usernames? Display names? Where is identity stored?
- After the audit, the gap-closing work is probably a mix of (a) add username field to signup, (b) make username unique-enforced, (c) add display name optional field, (d) show username everywhere the user is currently identified by email.
- Migration concern: existing users (Alex, Victoria, any test accounts) need usernames assigned. Probably a one-time client-side prompt: "pick a username" on first launch after the update.

**Open questions / calls I made:**
- I'm assuming the PRD §9 model is the destination. If you've changed your mind on real-names-required, say so.
- The migration path for existing users (the "pick a username on next launch" prompt) is a design point I'm making for you — yell if you'd rather assign auto-generated handles or something else.

**Prompt for Claude Code:**

```
This is a two-phase task. Phase 1 is investigation + proposal — DO NOT write code until I've approved the proposal.

PHASE 1 — Audit and propose.

The target identity model is documented in PRD.md §9. Summary:
- Sign in: email + password (Firebase Auth). No change here.
- Public identity: unique username (handle). Required.
- Display name: optional, separate from username, can be edited.
- Profile photo: optional. Initials fallback if missing.
- Real name: NOT collected, NOT stored.

Audit:
1. Read app/services/userService.ts, components/LoginScreen.tsx, the Firestore user document shape, and any place a user's identity is rendered in the app.
2. For each of the four PRD §9 fields (username, display name, profile photo, real name), report:
   - Is it currently collected at signup?
   - Is it stored on the user doc?
   - Is it displayed anywhere in the app?
   - Is uniqueness enforced (for username)?
3. List existing users (the 2–10 who have accounts). What identity data does each have today?
4. Identify the gap between current state and PRD §9. Be specific — file paths, field names, missing UI, missing validation.

Proposal:
Based on the audit, propose the change plan as a short list of work items:
- Schema changes (Firestore user doc fields to add).
- Signup flow changes (LoginScreen, userService).
- Migration for existing users (probably a "pick a username" prompt on first launch after the update — propose the exact UX).
- Display changes (replace email-based identifiers with username-based ones across the app — list each touchpoint).
- Validation rules (username format: lowercase + digits + underscore, 3–20 chars, unique).

STOP after the proposal. Show it to me and wait for approval.

PHASE 2 — Implement (only after I approve Phase 1).

Once I've signed off on the proposal, implement it in this order, committing after each:
1. Schema + validation.
2. Signup flow.
3. Migration prompt for existing users.
4. Display updates.

DO NOT:
- Touch Firebase Auth itself (we're keeping email+password as the sign-in method).
- Add OAuth providers, social login, magic links, or any other auth method.
- Add real-name collection. PRD §9 explicitly excludes it.
```

---

### Feature 6 — "I was there!" tag-along

**What we want:** When two people go birding together, only one needs to log the sightings. The other taps "I was there!" on each of their friend's sightings to have them counted in their own journal.

**Design considerations:**
- **Two implementation models:**
  - *Model A — Pure copy:* Tap creates a fresh sighting in your account with copied data. No link back to the original. Simple, durable.
  - *Model B — Reference only:* Tap creates a "co-observer" relationship; your Dex sees it but you don't own a copy.
  - *Model A+ (recommended):* Pure copy, but with a `coObserverOf` field pointing back to the original. Both cards can show "with [other person]" for the shared moment, and if the original is deleted your copy persists with a "(original deleted)" indicator.
- **UI:** A binoculars-icon button on the friend's SightingCard. Label: "I was there." Tap → confirmation dialog ("Add this Belted Kingfisher to your journal?") → optimistic insert into your own sightings. Button state changes to "✓ In your journal."
- **Notification back to the original poster:** "Victoria says she saw your Belted Kingfisher too." Nice touch but optional for v1.
- **Privacy/coordinate fuzzing:** If the original sighting has fuzzed coords (sensitive species per PRD §8), the copy should NOT inherit the exact coords — the fuzzing rule must apply to the copy too.
- **Edge case — duplicate detection:** If the user already has a sighting of that species on that day, prompt: "You already have this species today. Add anyway?"

**Open questions / calls I made:**
- **Model A+ (copy with backref).** Push back if you want pure copy or reference-only.
- **Notification back is opt-in nice-to-have for v1.** I left it out of the prompt to keep scope tight.
- **Co-observers visible on the original card:** I had this say "yes — both cards show 'with [other person]'." That's a small but meaningful social moment. Push back if you want it invisible.

**Prompt for Claude Code:**

```
Add an "I was there" tag-along on friends' sightings.

Use case: Alex and Victoria go birding together. Alex logs 15 sightings. Victoria taps "I was there" on each — those 15 birds should count toward her Dex, year goal, and Field Journal too.

Model: copy-with-backref. Tapping creates a brand-new sighting in the tapper's account with copied data, plus a coObserverOf field pointing to the original sighting ID. Pure ownership, but a thin link for display.

Schema (app/types.ts):
- Add optional field to Sighting: coObserverOf?: string (the original sighting's ID).
- Add optional field: coObserverIds?: string[] (on the original — list of users who've tagged along). Maintained as a Firestore arrayUnion when someone taps the button.

UI:
- In components/SightingCard.tsx, when the card is rendered in the friends feed (not the user's own Field Journal), add a small "I was there" button below the existing info.
- Use a binoculars Ionicon (or eye icon — pick one and use it consistently).
- States:
  - Default: "I was there"
  - After tap: "✓ In your journal" (disabled / different style)
- If the current user is already a co-observer (their uid is in coObserverIds), render the button in the "already tagged" state.

Behavior on tap:
1. Show a confirmation dialog: "Add this {species} to your journal?"
2. On confirm:
   a. Check if the user already has a sighting of the same species on the same calendar day. If yes, second confirm: "You already have a {species} logged for {date}. Add anyway?"
   b. Create a new sighting in the user's account with:
      - species, date, location label copied from the original
      - coordinates copied ONLY IF the original isn't a fuzzed sensitive-species sighting (see PRD §8 — when the IUCN status work lands, coordinate fuzzing rules apply to copies too)
      - coObserverOf: original sighting ID
      - photo: NOT copied — Victoria didn't take Alex's photo. (She can add her own later.)
      - notes: NOT copied.
   c. Add the current user's uid to the original's coObserverIds via arrayUnion.

Display:
- On any sighting card (in any context), if coObserverIds.length > 0, show a small footer line: "with {name1}" or "with {name1} and {name2}" or "with {name1} and 3 others".
- On the tagger's own copy (where coObserverOf is set), show "tagged along on {original poster}'s sighting" — small text, low emphasis.

DO NOT:
- Fire a push notification back to the original poster (separate v2 feature).
- Copy the photo from the original (Victoria can take her own).
- Allow tagging along on your own sighting (no-op + hidden button).
- Allow tagging along on a sighting older than 30 days (sanity guardrail; configurable later).

Acceptance criteria:
- "I was there" button visible on friend feed cards only.
- Tap → confirmation → sighting appears in tapper's Field Journal with copied species/date/location.
- Tapper's Dex updates (species counts toward their total).
- Original card now shows "with {tapper}".
- Tapping again is idempotent (button is disabled in already-tagged state).
- Duplicate-day species prompt works.
- The coObserverOf backref is queryable for later features (e.g., "show me trips with Victoria").

Out of scope:
- Co-observer push notifications back to original poster.
- Bulk tag-along ("add all of Alex's sightings from today").
- Editing a co-observed sighting separately from the original.
```

---

### Feature 7 — Field Journal grouped by day with daily counts (big day support)

**What we want:** Restructure the Field Journal screen so sightings are grouped under date headers. Each header shows the date, total sightings that day, and total unique species that day. This is the "big day" use case birders care about — *how many species did I see on Saturday?*

**Design considerations:**
- **Header format:** `Saturday, May 23 — 8 sightings · 6 species`. Compact, scannable. For days with 1 sighting: `Friday, May 22 — 1 sighting · 1 species` (no special casing, consistency wins).
- **Ordering:** Days reverse-chronological (most recent at top). Within a day, sightings also reverse-chronological.
- **Sticky headers:** Optional nice-to-have. Probably not for v1 — adds complexity, marginal value on a phone-sized screen.
- **Empty state:** No change. If user has zero sightings, the empty state stays as-is.
- **Interaction with Feature 1:** Activity grid lives above the day-grouped list. No interaction between them.
- **Performance:** Compute groupings client-side, memoize. Existing list is already in memory.

**Open questions / calls I made:**
- **Sticky headers off for v1.** Easy to add later if the day list gets long.
- **No filter / search inside Field Journal yet** (e.g., "show me only days with new species"). That's a separate feature.

**Prompt for Claude Code:**

```
Restructure the Field Journal screen to group sightings by day, with a per-day header that shows daily totals.

Goal: surface the "big day" pattern — birders go out for a day and want to see how many species they saw that day.

Spec:
- Header format: "{Weekday}, {Month} {Day} — {N} sightings · {M} species"
  - e.g., "Saturday, May 23 — 8 sightings · 6 species"
  - For 1 sighting: "Friday, May 22 — 1 sighting · 1 species" (singular form is correct; don't special-case beyond that)
- Days ordered reverse-chronological (most recent on top).
- Within a day, sightings ordered reverse-chronological (most recent on top).
- Day boundary: calendar day in the user's local timezone.

Files:
- app/(tabs)/index.tsx (the Field Journal screen).
- Helper: app/utils/groupSightingsByDay.ts — pure function from Sighting[] → [{ date, sightings[], sightingCount, speciesCount }, ...].

Approach:
- Replace the existing flat FlatList with SectionList (built-in React Native), or compute grouped data and feed a FlatList of mixed item types (header | sighting). SectionList is cleaner — use it unless there's a strong reason not to.
- Memoize the grouping with useMemo keyed on the sightings array reference.

DO NOT:
- Add sticky headers (out of scope for v1).
- Add a search/filter UI.
- Change the SightingCard component itself.
- Change the empty state.

Acceptance criteria:
- Field Journal renders date headers above each day's sightings.
- Each header shows correct sighting and species counts.
- Headers are correct around timezone edges (a sighting at 11:55 PM local time and one at 12:05 AM local time fall on different days).
- Scrolling performance is unchanged or better (memoization in place).
- All existing interactions (long-press to delete, tap to view, etc.) still work on each sighting.

Compatibility: this PR coexists with Feature 1 (activity grid). If Feature 1 has already shipped, the activity grid stays as the header above the SectionList. If not, no change.
```

---

### Feature 8 - Hoots and comments on friend sightings

**What we want:** Social engagement on a friend's sighting, in two layers:

1. **Hoot** : the signature one-tap reaction, PocketBirds' version of Strava Kudos. "Give a hoot" doubles as the idiom for caring and the owl sound, and in Canadian slang chirping/hooting is also good-natured ribbing, so it fits the playful brand voice perfectly. One hoot per user per sighting, toggle on/off. The card shows a hoot count and who hooted.
2. **Comments** : flat (non-threaded) text replies under a sighting, so a friend can say more than one tap's worth. Author, text, timestamp. The card shows a comment count; tapping opens the thread.

Both fire a quiet push back to the original sighter.

**Design considerations:**

- *Storage (call I made):* use subcollections, not array fields on the sighting doc.
  - `sightings/{sightingId}/hoots/{uid}` : `{ createdAt }`. One doc per reacting user, doc id IS the uid. Makes the security rule trivial (a user can only touch a doc whose id equals their own uid) and gives the Cloud Function a clean `onCreate` trigger to push from.
  - `sightings/{sightingId}/comments/{commentId}` : `{ authorUid, authorName, text, createdAt }`. Flat list, ordered by createdAt ascending.
  - This diverges from Feature 6's array-field approach (`coObserverIds`) on purpose: hoots and comments both need per-user security and a clean push trigger, which arrays make awkward.
- *Denormalized counts:* keep `hootCount` and `commentCount` integers on the sighting doc, maintained ONLY by the Cloud Function (increment on create, decrement on delete). The feed reads these directly so it never fans out a subcollection read per card.
- *Own vs friend cards:* `SightingCard` is shared. On your own Field Journal cards, hide the Hoot button (no self-hoot, mirrors Strava) but still show hoots/comments you received and let you reply. On friend feed cards, Hoot and the comment input are fully interactive. This is the same own-vs-friend distinction Feature 6 needs, so build them back to back.
- *Push back to the sighter:* Hoot fires "{name} gave a hoot for your {species}"; comment fires "{name} commented on your {species}: {preview}". These go to the sighting's OWNER, a different direction from Feature 4's bell (which controls a follower's inbound feed pushes). So they are a NEW notification type, default on, NOT gated by the bell. A future settings toggle can mute them. Never push a user about action on their own sighting.
- *Voice:* lean into the friendly-heckle double meaning. First-time tooltip: "A hoot is half cheer, half heckle. Use responsibly." Keep copy short and warm.

**Open questions / calls I made:**
- Subcollections over arrays (above). Push back if you'd rather keep parity with Feature 6's arrays at the cost of messier security and triggers.
- Comments are flat for v1. Threading is a v2 concern that will almost certainly never matter at 5 to 20 friends.
- Hoot/comment pushes are their own notification type, default on, NOT folded into the Feature 4 bell. Flag if you'd rather the bell control them.
- No comment editing in v1 (delete + re-add). Author can delete their own comment; the sighting owner can delete any comment on their sighting (light moderation).
- Hoots and comments can ship as separate commits. If you want Hoots alone for v1 and comments as a fast-follow, say so and I'll split the prompt.

**Prompt for Claude Code:**

```
Add "Hoots" (a one-tap reaction) and comments to friend sightings.

CONTEXT (read CLAUDE.md first for file layout + push setup). A "Hoot" is PocketBirds' version of Strava Kudos: a single signature reaction, one per user per sighting, toggle on/off. Comments are flat text replies under a sighting. Both notify the original sighter.

PHASE 0 - investigate and report BEFORE coding:
- How are sightings stored in Firestore? One shared collection or per-user? Can a follower currently read AND write to another user's sighting doc / its subcollections? Check app/services/sightingService.ts and the Firestore security rules (firestore.rules, or export from the Firebase console).
- How is SightingCard rendered in (a) the friends feed and (b) the user's own Field Journal? Is there a prop/context telling it which mode it's in? (Feature 6 needs the same distinction - reuse it or add a minimal `context` prop.)
- How does onSightingAdded look up a user's expoPushToken and send via Expo Push? Reuse that exact send path.
Report findings before writing code.

DATA MODEL:
- sightings/{sightingId}/hoots/{uid}  ->  { createdAt: Timestamp }   (doc id IS the reacting user's uid)
- sightings/{sightingId}/comments/{commentId}  ->  { authorUid, authorName, text, createdAt: Timestamp }
- Denormalized counters on the sighting doc: hootCount: number, commentCount: number.
  Maintained ONLY by the Cloud Function (increment on create, decrement on delete). Clients never write these.

SECURITY RULES (add/adjust firestore.rules):
- A signed-in user may create/delete sightings/{id}/hoots/{uid} only when uid == request.auth.uid.
- Any signed-in user who can read the sighting may create a comment. A comment may be deleted by its author OR by the sighting owner.
- Clients may NOT write hootCount / commentCount (function-owned).

CLIENT SERVICE - new file app/services/engagementService.ts:
- toggleHoot(sightingId, uid): create or delete the hoot doc; return new local state.
- subscribeHoots(sightingId, cb): realtime listener -> array of uids.
- addComment(sightingId, { authorUid, authorName, text }): create a comment doc.
- deleteComment(sightingId, commentId): delete it.
- subscribeComments(sightingId, cb): realtime listener -> ordered comment array.
Keep reads cheap: the collapsed feed card uses the denormalized hootCount/commentCount on the sighting doc; only subscribe to the subcollections when a card's thread / hooter list is expanded.

UI - components/SightingCard.tsx:
- Footer row: a Hoot control (owl glyph + count) and a comment control (comment glyph + count).
- Hoot button: tappable on FRIEND cards only. Default label "Hoot"; active/filled state once the current user has hooted. Optimistic toggle, revert on error. Buzz haptic on a fresh hoot.
- On the user's OWN cards: hide the Hoot button, but still show "{n} hoots" and the comment control so they see and can reply to engagement.
- Hooters line when count > 0: "Alex", "Alex and Sam", "Alex, Sam and 3 others". Resolve uids -> display names from whatever user source is already loaded; fall back to "Someone".
- Comment control tap: expand an inline thread (or a light modal/sheet) showing comments (author name, text, relative time) plus a text input + send. New comment appears optimistically.
- First time the hoot affordance is seen, show a one-time tooltip: "A hoot is half cheer, half heckle. Use responsibly." Keep all copy short and warm (PRD voice rules).

CLOUD FUNCTIONS (functions/index.js) - follow the onSightingAdded pattern and Expo Push send path:
- onHootCreated (trigger: create of sightings/{sightingId}/hoots/{uid}):
    increment parent sighting's hootCount; if hooter != owner, push to owner: title "PocketBirds", body "{hooterName} gave a hoot for your {species}".
- onHootDeleted: decrement hootCount. No push.
- onCommentCreated (trigger: create of sightings/{sightingId}/comments/{commentId}):
    increment commentCount; if commenter != owner, push to owner: body "{authorName} commented on your {species}: {first ~60 chars}".
- onCommentDeleted: decrement commentCount. No push.
- These are a NEW notification type. Do NOT gate them on the Feature 4 per-friend bell (that controls inbound feed pushes; this is engagement on the user's OWN sighting). Default on. Never push a user about their own action.
- Resolve the owner's expoPushToken from their user doc; skip silently if absent.

DO NOT:
- Use array fields on the sighting doc for hooters/comments - use the subcollections above.
- Let the client write hootCount / commentCount.
- Add comment threading/replies, comment editing, or reactions-on-comments (all v2).
- Push to yourself for action on your own sighting.
- Touch the Feature 4 bell logic.

ACCEPTANCE CRITERIA:
- Friend feed card shows a Hoot button + count and a comment count.
- Tapping Hoot toggles it, updates the count optimistically, and the owner gets a push within ~10s.
- Tapping Hoot again un-hoots (count decrements, no second push).
- Your own Field Journal cards show received hoots/comments but no Hoot button on yourself.
- Adding a comment shows it immediately and pushes the owner.
- hootCount / commentCount stay correct across add/remove (function-maintained).
- Security: a user cannot create a hoot doc under someone else's uid, and cannot delete a comment that isn't theirs unless they own the sighting.
- Existing sighting-add push and the rest of the feed are unaffected.

Commit in revertible steps: (1) security rules + data model, (2) engagementService, (3) SightingCard UI, (4) Cloud Functions. Verify on the dev client with two accounts; deploy functions with `firebase deploy --only functions`.
```

---

## Suggested build order

Updated after the Feature 4 rewrite — Feature 4 no longer depends on Feature 2 (levels) or the annual goal model, so it's free to ship first.

1. **Feature 4 (per-friend notification prefs)** — Alex wants this first. No dependencies after the rewrite. Touches Cloud Function + Friends UI.
2. **Feature 7 (group Field Journal by day)** — small, contained, satisfying. Good follow-up.
3. **Feature 3 (follow push notification)** — small Cloud Function change. Tests the deploy pipeline.
4. **Feature 1 (activity grid)** — pure UI, no data model changes. Visible win.
5. **Feature 6 ("I was there")** — small schema change, meaningful UX win. Get the social mechanic in early to start collecting feedback.
6. **Feature 8 (Hoots + comments)** - social engagement on sightings. Pairs with Feature 6: both touch SightingCard and need the same own-vs-friend card distinction, so build them back to back.
7. **Feature 2 (levels)** — bigger UI lift but no risky data work. Once it lands, retrofit Feature 4's "highlights" mode to also push on level-ups (the v2 deferred item).
8. **Feature 5 (account creation rethink)** — two-phase (audit + build). Save for when you have a clean stretch since the migration touches existing users.
