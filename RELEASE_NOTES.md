# PocketBirds — Release Notes

## Scrub-Tyrant - July 3 2026
**Builds:** iOS 1.0.0 (15) · Android 1.0.0 (versionCode 30, **APK** for Firebase App Distribution)
**Headline:** A new Species Guide for every bird, photo-first logging that fills in where you were, bird search that ranks by what's actually near you, a playful new loading screen, and Dex filtering by photo.

### Play Store - "What's new" (plain text, copy below this line)

📖 A field guide for every bird
• Tap any bird in your Dex to open its Guide: what it looks like, how big it is, its conservation status, and where in the world it lives
• Bird names now show on sighting cards, tap one to jump straight to its guide

📷 Photo-first logging
• Adding a sighting now leads with the photo. Add one and PocketBirds reads where it was taken to fill in your location for you

🔍 Smarter bird search
• Type a name and the birds that actually occur near you rise to the top, now down to your state or province, not just the continent

🗂️ Filter your Dex by photos
• New camera filter: show only species you've photographed, or only the ones you've seen but still owe a photo

✨ Nicer to open
• A playful new loading screen when you open your Field Journal
• Your Journal now loads your sightings and your friends' together in one pass, instead of popping in
• Tap anywhere to dismiss the location list while adding a sighting

### TestFlight - "What's new" (plain text, copy below this line)

📖 A field guide for every bird
• Tap any bird in your Dex to open its Guide: what it looks like, how big it is, its conservation status, and where in the world it lives
• Bird names now show on sighting cards, tap one to jump straight to its guide

📷 Photo-first logging
• Adding a sighting now leads with the photo. Add one and PocketBirds reads where it was taken to fill in your location for you

🔍 Smarter bird search
• Type a name and the birds that actually occur near you rise to the top, now down to your state or province, not just the continent

🗂️ Filter your Dex by photos
• New camera filter: show only species you've photographed, or only the ones you've seen but still owe a photo

✨ Nicer to open
• A playful new loading screen when you open your Field Journal
• Your Journal now loads your sightings and your friends' together in one pass, instead of popping in
• Tap anywhere to dismiss the location list while adding a sighting

### What shipped (engineering)
- **Species Guide tab** (`4abbf5c`, `95b677d`): tapping a Dex species opens `app/species/[name].tsx` on a new Guide tab, Description (bundled Wikipedia) → Measurements (AVONET) → Conservation (IUCN) → Where it lives (realm map + migration). All data bundled and offline; `scripts/build-species-data.py` (AVONET + IUCN via Wikidata P141) and `scripts/build-wiki-blurbs.py`.
- **Species data recovery** (`68848d6`, `2af1a43`): genus-synonym/split recovery for the AVONET/IUCN joins against IOC v15.2, plus an audit CSV listing every recovered and still-missing species.
- **Bird names on sighting cards** (`94580c4`): name shown on each card, tapping links through to the species guide.
- **Photo-first Add flow + photo-location autofill** (`7a978ca`, `ab0f2f0`, `a2f74f8`): the Add screen leads with the photo; adding one reads its GPS to reverse-geocode the location label and rank the bird-name suggestions by likelihood. Android needed an original-asset lookup (`expo-media-library` + `patches/expo-image-picker+16.1.4.patch`) because the system photo picker zero-fills GPS EXIF; DMS-rational EXIF parsing added.
- **State/province range ranking** (`b59d87f`): `constants/birdRanges.ts` (GBIF admin-1 occurrence, CC0/CC-BY, 9,931 species, DOI 10.15468/dl.5kx2c9) refines the "most likely near you" bucket below realm level; `locationService.reverseGeocodeRegion` + `rangeStatusFor`, with realm fallback where there's no range data.
- **Add-screen polish** (`b59d87f`): tap-away dismisses the location dropdown and blurs the field (cancelling the in-flight autocomplete); removed the photo helper subtext; bird placeholder "Who'd you see?".
- **Field Journal loading splash + single-shot feed** (`962176c`): `friendsReady` gate holds a loading splash until the friend snapshot delivers, so the feed renders in one pass instead of reflowing; reveals immediately when offline/friendless, 3s ceiling for dead-but-connected networks. `LoadingSplash.tsx` is a Reanimated "looking for birds" splash (respects reduced-motion).
- **Dex photo filter** (`0768326`): Region-style picker, Any / With a photo / Without a photo (seen-but-unphotographed), additive to the existing filters.

### Known issues
- About 12% of species have no fine (state/province) range data; their search ranking and Guide "where it lives" fall back to the coarser zoogeographic realm.
- A bird common one state over but with no records in your exact state can rank lower than ideal (province-border case, `WORK_QUEUE.md` Q-16 follow-up).
- Genuinely cloud-only photos (backed up then freed from the device, or taken elsewhere) can't yield GPS; the Add form falls back to phone location.
- On a very slow connection the loading splash's 3s ceiling can reveal the feed just before friends load.
- iOS push entitlement (`aps-environment`) still missing from the provisioning profile, so Android→iOS push remains broken (`WORK_QUEUE.md` Bug 6).

### Post-ship steps
- **iOS:** build 1.0.0 (15) built successfully (IPA ready), but the auto-submit to TestFlight FAILED: Apple reported "a required agreement is missing or has expired." Sign the pending agreement in App Store Connect (Business → Agreements, Tax, and Banking, or a Terms of Service prompt), then re-submit the existing build with `eas submit -p ios --latest` (no rebuild needed). Lands in the "Friends" external group; no new native capability, should skip Beta App Review.
- **Android:** APK (not Play Store AAB). Distribute via Firebase App Distribution. Artifact: <https://expo.dev/artifacts/eas/wG1KADTIXJjS_UMiTGpYlp5oa5EHwTy3RtW4SLnUZwQ.apk>
- Rolled `constants/release.ts` `CURRENT_RELEASE_NAME` Scrub-Tyrant → **Doradito**, and stamped the `release-names.csv` Scrub-Tyrant date (July 3, 2026). Next name after Doradito is by wingspan ascending.

---

## Sunbird - June 22 2026
**Builds:** iOS 1.0.0 (14) · Android 1.0.0 (versionCode 29, **APK** for Firebase App Distribution)
**Headline:** A proper PocketBirds splash screen, live hoot & comment counts on your own sightings, and steadier syncing on weak connections.

### Play Store - "What's new" (plain text, copy below this line)

🎨 A proper welcome
• New splash screen with the PocketBirds wordmark, replacing the old placeholder

🦉 Live hoots & comments
• Your own sightings now update their hoot and comment counts in real time, so a card never sits on "1 hoot" while three friends have actually hooted it

📶 Steadier on weak signal
• Hardened syncing so your sightings load and save reliably on flaky or slow connections

### TestFlight - "What's new" (plain text, copy below this line)

🎨 A proper welcome
• New splash screen with the PocketBirds wordmark, replacing the old Expo placeholder
• The app icon is now the PB logo (was a generic placeholder)

🦉 Live hoots & comments
• Your own sightings now update their hoot and comment counts in real time, so a card never sits on "1 hoot" while three friends have actually hooted it

📶 Steadier on weak signal
• Hardened syncing so your sightings load and save reliably on flaky or slow connections

🌙 Fixes
• Date picker text stays readable in dark mode (was dark-on-dark)

### What shipped (engineering)
- **PocketBirds splash wordmark** (`f4c9145`): replaced the default Expo grid/circles splash with a single-line "PocketBirds" wordmark (Bricolage Grotesque 700 Bold, ink on cream `#fdf6e6`) on both platforms. Sized by its bounding-box diagonal to fit inside the Android 12 splash safe-circle (the system masks `windowSplashScreenAnimatedIcon` to the center ~2/3). Bare workflow, so native assets edited directly (5 Android densities, iOS imageset + storyboard + colorset); `scripts/gen_splash_wordmark.py` is the reproducible generator.
- **Live engagement counts on your own sightings** (`cb48b8b`): `SightingsContext` gained a live `onSnapshot` overlay that patches the server-maintained summary fields (`hootCount` / `commentCount` / `recentHooters` / `topComment` / `proposalCount` / `leadingProposal`) onto your own sightings — friends' were already live, own ones came from a one-shot fetch and went stale. Cloud Function hoot/comment counters made authoritative (recount via `.count()` instead of `FieldValue.increment`, so they're self-healing); one-time `backfillSocialCounts.js` reconciled 2 historically-drifted comment-hoot counts (sighting-level counts were already correct).
- **Offline reliability hardening** (`2148e20`): `initializeFirestore` with `experimentalAutoDetectLongPolling` so reads/`onSnapshot` fall back to long-polling instead of hanging on connected-but-lossy links (Starlink). Client-minted doc ids + `setDoc(merge)` make retried creates idempotent (no duplicate sighting after a lost ack); global-first detection uses `getDocsFromServer` + a 5s timeout so a flaky-network cache read can't fabricate a lifer.
- **iOS date picker readable in dark mode** (`ab89cd6`): forced the date picker to a light theme so its text stays black instead of dark-on-dark (`SightingForm.tsx`).
- **iOS app icon** (`f7adc2b`): replaced the generic Expo placeholder app icon with the PB logo.

### Known issues
- iOS push entitlement (`aps-environment`) still missing from the provisioning profile, so Android→iOS push remains broken (`WORK_QUEUE.md` Bug 6). Requires an interactive EAS re-credential.
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).
- Native persistent Firestore cache is still deferred (JS-SDK `persistentLocalCache` is unavailable on RN); the offline hardening above mitigates but doesn't replace it (`WORK_QUEUE.md` Q-5).

### Post-ship steps
- **iOS:** build 1.0.0 (14) auto-submitted to TestFlight → "Friends" external group. No new capability; should skip Beta App Review.
- **Android:** APK (not Play Store AAB). Distribute via Firebase App Distribution. Artifact: <https://expo.dev/artifacts/eas/aw1ypa0qzSlqVtsb8vJef0znpQdaiZPM5WjQqKRC6wM.apk>
- Stamp the `release-names.csv` Sunbird date (today). Next release name after Sunbird is **Scrub-Tyrant** (wingspan ascending).

---

## Fairywren - June 14 2026
**Builds:** iOS 1.0.0 (13) · Android 1.0.0 (versionCode 28, **APK** for Firebase App Distribution)
**Headline:** The Bird Dex redrawn as collectible Atlas cards (with a new grid/compact toggle), a holographic "First on Pocket Birds" badge on both your Dex and the feed, and community photo galleries with ID credits.

### Play Store - "What's new" (plain text, copy below this line)

🃏 The Bird Dex, redrawn
• Species are now collectible Atlas cards, two to a row, with their real scientific names
• Birds you haven't seen show as dashed "ghost" slots
• New grid / compact toggle up top: switch between the cards and a tighter checklist

🔍 Community on every bird
• Tap any Dex bird for a community photo gallery, now including your own shots
• When someone IDs your Mystery Bird, they get an "ID'd by @name" credit on the card, tappable to their profile

Plus:
• Each day in your Journal now orders sightings by time when they were logged
• Smoother holographic rendering and a flock list that refreshes right after you follow someone

### TestFlight - "What's new" (plain text, copy below this line)

🃏 The Bird Dex, redrawn
• Species are now collectible Atlas cards, two to a row, with their real scientific names
• Birds you haven't seen show as dashed "ghost" slots
• New grid / compact toggle up top: switch between the cards and a tighter checklist

🔍 Community on every bird
• Tap any Dex bird for a community photo gallery, now including your own shots
• When someone IDs your Mystery Bird, they get an "ID'd by @name" credit on the card, tappable to their profile

Plus:
• Each day in your Journal now orders sightings by when they were logged
• A flock list that refreshes right after you follow someone

### What shipped (engineering)
- **Atlas Cards Dex + admin-verified global-first** (`ef58390`): Bird Dex redrawn as collapsible family region cards holding 2-up portrait trading cards (dashed ghost slots for unseen, gold first-edition for verified global-firsts), a hero milestone track, and real IOC Latin names (`constants/birdLatin.ts`). Global-first decoration now requires admin (Alex/Victoria) long-press verification of a photographed sighting; nothing grandfathered. `onSightingWriteGlobalFirst` Cloud Function is the server authority (recomputes holder on delete / species-edit / mystery-resolve); Firestore rules restrict verify + `globalFirst` writes to admins.
- **Holographic Global First treatment** (`e0b225b`, `df48f64`): flat-gold "1ST EDITION" replaced by a reserved holographic finish (new token in `constants/Colors.ts`, reusable `components/Holo.tsx` `HoloFill`/`HoloRing` on the already-present `react-native-svg`, so no new native module). Globe "1ST" pill on the Dex art and, via the shared `GlobalFirstBadge`, on `SightingCard` + `FriendSightingCard` (shown when `globalFirst && verified`).
- **Dex grid/compact view toggle** (`2b81958`): grid/compact toggle on the Dex tab (AsyncStorage-persisted), backed by a shared `components/dex/DexCompactFamily` that the profile Bird Dex tab also adopts.
- **Community ID credit** (`bfc6d62`, backfill `860d351`): accepting a Mystery Bird proposal stamps `identifiedByUsername`; a tappable "ID'd by @name" line renders on `SightingCard`, `FriendSightingCard`, and the detail.
- **Full community gallery** (`df48f64`): species Community tab now includes your own photos (dropped the self-exclusion in `getCommunityPhotosForSpecies`).
- **Journal ordered by post time within each day** (`66f0a71`).
- **Auto-follow new accounts** (`3450143`, `72e272b`): `onUserCreatedAutoFollow` Cloud Function makes brand-new accounts follow Alex (cold-start), landing a non-empty inbox; flock/feed refresh after follow.
- **Fix:** HoloFill unpainted bottom sliver on Android (`5aee9e7`).

### Known issues
- The Global First log-time gold takeover is deactivated until it can fire at verify-time (by design).
- iOS push entitlement (`aps-environment`) still missing from the provisioning profile, so Android→iOS push remains broken (`WORK_QUEUE.md` Bug 6). Requires an interactive EAS re-credential.
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).

### Post-ship steps
- **iOS:** build 1.0.0 (13) auto-submitted to TestFlight → "Friends" external group. No new capability; should skip Beta App Review.
- **Android:** APK (not Play Store AAB). Distribute via Firebase App Distribution. Artifact: <https://expo.dev/artifacts/eas/g7I_6Z7cU02xyA4sZqHYwEJK8azotMVNAPs2TLaocR0.apk>
- Stamp the `release-names.csv` Fairywren date (today). Next release name after Fairywren is **Sunbird** (wingspan ascending).

---

## Tyrant - June 10 2026
**Builds:** iOS 1.0.0 (11) · Android 1.0.0 (versionCode 26, **APK** for Firebase App Distribution)
**Headline:** Tap any Dex bird to see community photos and your sightings, comment reactions and replies, smarter location entry, and more forgiving search.

### Play Store - "What's new" (plain text, copy below this line)

🔍 Tap any bird in your Dex
• Tap any species tile to open its detail page
• Community tab: photos from other birders who've spotted it — tap any photo to visit their profile
• Yours tab: all your logged sightings for that species, with dates, locations, and photos

💬 Comment reactions and replies
• Hoot on a comment (owl icon) to react to it — the author gets notified in their Activity inbox
• Tap "reply" under any comment to thread your response directly beneath it

📍 Smarter location entry
• Tap the location field to see your 6 most recent logged spots — no typing for familiar places
• Autocomplete now biases toward your current position for better local suggestions
• New ✕ clear button on the location, bird search, notes, and Dex search fields

🔎 More forgiving bird search
• "gray plover" finds Grey Plover, "red breasted" finds Red-breasted Nuthatch, "redeyed vireo" finds Red-eyed Vireo. Spelling variants and missing spaces no longer matter.

Plus:
• Family progress bars now on your personal Bird Dex, not just profile views
• One-tap "?" button on Add Sighting to log a Mystery Bird
• Domesticated Chicken is now a loggable species
• Sighting dates now always include the year; "today"/"yesterday" now based on calendar day

### TestFlight - "What's new" (plain text, copy below this line)

🔍 Tap any bird in your Dex
• Tap any species tile to open its detail page
• Community tab: photos from other birders who've spotted it; tap any photo to visit their profile
• Yours tab: all your logged sightings for that species, with dates, locations, and photos

💬 Comment reactions and replies
• Hoot on a comment (owl icon) to react to it; the author gets notified in their Activity inbox
• Tap "reply" under any comment to thread your response directly beneath it

📍 Smarter location entry
• Tap the location field to see your 6 most recent logged spots
• Autocomplete now biases toward your current position for better local suggestions
• New clear (x) button on the location, bird search, notes, and Dex search fields

🔎 More forgiving bird search
• "gray plover" finds Grey Plover, "red breasted" finds Red-breasted Nuthatch, "redeyed vireo" finds Red-eyed Vireo. Spelling variants and missing spaces no longer matter.

Plus:
• Family progress bars now on your personal Bird Dex, not just profile views
• One-tap "?" button on Add Sighting to log a Mystery Bird
• Domesticated Chicken is now a loggable species
• Sighting dates now always include the year; "today"/"yesterday" now based on calendar day

### What shipped (engineering)
- **Species Detail screen** (`742eab4`): `app/species/[name].tsx` — tapping any Dex tile (seen or unseen) navigates here. Community tab fetches other birders' photos via `sightingService.getCommunityPhotosForSpecies` (single-equality query, no composite index); Yours tab renders the existing `SightingCard` scoped to that species. Photo mosaic opens a lightbox with credit + profile tap-through. Mystery Bird and custom species tiles have no route. Route registered in `_layout.tsx`. Also includes `familyForBird` helper and a shared `app/utils/formatSightingDate.ts` fixing two date bugs: year always shown on absolute dates, and "today"/"yesterday" now compare local calendar days.
- **Hoot and reply to comments** (`e7dff35`, `96d433d`, `4cae242`): hoot toggle on each comment stored at `comments/{id}/hoots/{uid}`, riding the existing `collectionGroup('hoots')` listener. `onCommentAdded` Cloud Function now also notifies replied-to users (deduped vs owner). `replyTo {commentId, uid, username}` field on comment docs; rendered inline with "↳ replying to @name." New activity types `comment_hoot` and `reply`. Comment hoot icon pinned right-side with count to its left, vertically centered.
- **Recent locations dropdown + current-position bias + clear buttons** (`2b3f3a8`): `app/utils/recentLocations.ts` derives last 6 locations from sightings (Mystery included, reports excluded). `components/ClearableInput.tsx` wraps any TextInput with an inline ✕. `locationService.getCurrentPosition` (silent, never prompts) used to bias Places autocomplete. All wired into `SightingForm` so edit mode also gets recents and clear.
- **Forgiving bird search** (`674abcf`): `normalizeSearch` maps grey→gray and strips/normalizes dashes and spaces. Precomputed `birdNamesAlphaNorm` + `birdNamesAlphaCompact` arrays (module load, hot-path safe). Closes WORK_QUEUE UR-6.
- **Family progress bars on personal Dex** (`45c4679`): the leaf progress bar (already on profile Dex) added under each family header in `dex.tsx`, driven by existing `familySeen`/`familyTotal` counts. Region-aware.
- **Mystery Bird "?" button** (`267814d`): icon-only toggle beside the BIRD field in `SightingForm`; fills/clears the `UNKNOWN_BIRD` sentinel. State derived from `selectedBird`, so it reflects correctly in edit mode.
- **Domesticated Chicken** (`8377120`): `Gallus gallus domesticus` added to `constants/birdNames.ts` in the Pheasants/Fowl family, next to Red Junglefowl. Empty regions array → cosmopolitan (visible under all region filters). Derived search arrays pick it up automatically.

### Known issues
- "First on Pocket Birds" still has no dedicated sighting-card pill (`WORK_QUEUE.md` Q-3).
- Android notification small icon renders inconsistently across OEMs (cosmetic; Bug 2).
- iOS push entitlement (`aps-environment`) missing from provisioning profile — Android→iOS push still broken (`WORK_QUEUE.md` Bug 6). Requires interactive EAS re-credential.

### Post-ship steps
- **iOS:** build 1.0.0 (11) auto-submitted to TestFlight → "Friends" external group. No new capability; should skip Beta App Review.
- **Android:** APK (not Play Store AAB). Distribute via Firebase App Distribution. Artifact: <https://expo.dev/artifacts/eas/OrvDSgzFMwUpG013GhPdu2nBUCpZLOwg_5MG4eEz1Pg.apk>
- Fill the `release-names.csv` Tyrant date once shipped. Next release name after Tyrant: check `release-names.csv` (wingspan ascending).

---

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
