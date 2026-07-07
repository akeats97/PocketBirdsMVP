# PocketBirds: Master Plans (written Jul 6 2026)

Every outstanding work item, with its **current state verified against the code**
(branch `rnfirebase-migration` @ 98e5cbb, typecheck clean), a detailed plan, risks,
and effort. Cross-references use WORK_QUEUE.md ids where they exist. Section 10 is
net-new: things not in any backlog that I recommend after reviewing the app.

Effort key: **S** = under half a day, **M** = half a day to a day, **L** = multi-day.
Deploy rule (standing): no Firestore/Storage rules deploy, no Cloud Function deploy,
and no backfill without Alex's explicit go. Build + emulator-validate freely.

**Suggested attack order is at the very end.**

---

## 1. Ship-critical: finish the RNFirebase migration (Doradito)

### M-1: Remaining Phase 3 verification + Phase 4 staged ship

**Current state.** Phases 0-2 done and committed. Alex is soaking vc31 on his Pixel;
vc32 (expo-image + display-copy photos) is built and awaiting install. The bounded
bootstrap listener landed after vc32, so the NEXT apk build picks it up. Unchecked
Phase 3 boxes: signup/logout teardown, add/edit/delete online + offline, photo upload,
hoots/comments/proposals live snapshots, profiles/compare/guide, push both directions,
new-species/milestone/global-first detection, coexistence with Victoria's Scrub-Tyrant.

**Plan.**
1. Build vc33 (apk profile) so the soak build includes the bootstrap listener; install
   over vc32. One build, ~$1, pre-authorized only when Alex says go.
2. Work the Phase 3 checklist in docs/rnfirebase-migration.md top to bottom on the
   Pixel (most items are 2-minute checks). The two that need a second account:
   push both directions (use Victoria's phone or the iOS sim + a junk account for the
   token-write half) and coexistence (Victoria simply keeps using Scrub-Tyrant).
3. Watch specifically for: own-only feed flashes on cold start (the caveat logged
   Jul 5), duplicate sightings after an offline add (idempotent-id path now runs
   through the native SDK), and permission errors in logcat at logout.
4. iOS: EAS production build from this branch (first CI build with static frameworks;
   verifies the fmt patch on the pinned Xcode 26.2 image), auto-submit, hold as
   internal-tester only. Alex soaks TestFlight a few days.
5. Ship Doradito per the staged plan: Friends group + Play internal, release notes
   lead with the one-time re-login. Then roll the release name + CSV date.

**Risks.** The native SDK swap may re-trigger Beta App Review (plan for a day or two
of buffer). Static frameworks on EAS CI is the one untested compile path.
**Effort.** M for the verification pass (mostly Alex-on-device), S of agent time.
**Order.** This gates everything that ships; do the verification checklist before
starting any large new code on the branch.

### M-2: Remove the `firebase` JS SDK package (final cutover commit)

**Current state.** `firebase@^11.7.1` is still in package.json (kept deliberately so
rollback stays one revert away). No app code imports it anymore.

**Plan.** After Doradito ships cleanly and soaks ~a week: `npm uninstall firebase`,
confirm no import survives (`grep -rn "from 'firebase/" app components config`),
typecheck, fresh native builds on both platforms (it's a JS-only dep, but verify),
single dedicated commit so it reverts cleanly.
**Effort.** S. **Order.** Strictly post-ship.

### M-3: Post-ship migration follow-ups (bundle, do not slip into Doradito)

- **SightingsContext offline-machinery simplification.** The hand-rolled pending
  creates/updates/deletions + AsyncStorage cache predate native disk persistence.
  Plan: once Doradito has soaked with zero sync complaints, write a small design doc
  first (what each pending queue protects against, which of those the native SDK now
  covers, what the AsyncStorage cache still buys on first-launch-offline), then strip
  in stages: (1) stop merging Firestore reads through the cache and trust
  `onSnapshot` + `fromCache` metadata, (2) drop pendingUpdates/pendingDeletions in
  favor of native offline writes, (3) keep only the client-minted idempotent ids
  (still valuable) and the lastLocation persistence. Each stage its own build + soak.
  Risk: this file is the app's spine; never combine with another risky change. **L.**
- **"View full resolution" in the photo viewer.** `photoUrlOriginal` already exists on
  new + backfilled sightings. Plan: in `app/photo.tsx`, accept an optional
  `originalUri` param; render the display copy immediately, show a small "Load full
  res" affordance when `photoUrlOriginal` exists, swap the expo-image source on tap
  (cache policy disk). Callers pass both URLs. **S.**
- **iOS API key restriction hardening.** The GoogleService-Info.plist key was
  unblocked (not restricted) to fix `[auth/internal-error]`. Plan: in GCP credentials,
  restrict the iOS key to app bundle id `com.akeats97.pocketbirds` and allowlist
  exactly: Identity Toolkit API, Token Service API, Firebase Installations API,
  Cloud Firestore API, Cloud Storage for Firebase API (list already proven in the
  migration doc). Verify login + a 1h-token refresh + a photo load afterward on
  TestFlight before calling it done. **S**, console-only, do after Doradito ships.

---

## 2. Pre-public-launch blockers (PL series)

### PL-1: Public-by-default visibility, server-enforced (P0)

**Current state (verified).** firestore.rules still gates `sightings`, `users`, and
`following` reads on `isSignedIn()` only; friend-scoping is client-side. No `isPublic`
field, no `communityPhotos` collection, no emulator test harness in the repo
(`@firebase/rules-unit-testing` not installed). The design is fully decided in
WORK_QUEUE (public-by-default, per-account private opt-out, read-inventory table done,
wrinkles resolved). `recomputeSpeciesGlobalFirst` already moved server-side
(`onSightingWriteGlobalFirst`, functions/index.js:314).

**Plan (build order, all local until the deploy gate).**
1. **Emulator harness first.** `npm i -D @firebase/rules-unit-testing` in the repo,
   stand up a test suite against the CURRENT rules re-encoding the 18 existing
   assertions (login-less username get, owner writes, canEngage, admin verify), so
   the refactor has a green baseline before anything changes.
2. **Data model.** `isPublic?: boolean` on `UserProfile` + user doc (absent = public).
   A minimal Settings surface: the You-tab ⋯ menu (components/AppHeader.tsx
   `youActions`) gains "Settings", pushing a small stack screen with the single
   "Private account" toggle (copy explains: posts visible only to followers;
   profile stub stays searchable). Owner-write is already allowed by rules.
3. **Rules rewrite** (one pass, includes PL-2's rules, see below):
   - `sightings` read: `isOwner() || ownerIsPublic() || followsOwner()` where
     `ownerIsPublic()` does a `get()` on the owner's user doc. Note the read rule
     runs per query, so the existing single-owner queries
     (`where userId == uid`) and the `userId in [...]` feed query must satisfy the
     rule for every returned doc; with everyone public by default this is a no-op
     migration. Keep the recursive-wildcard hoots/following reads.
   - Add `communityPhotos/{sightingId}`: read `isSignedIn()`, write `false`
     (CF-only via Admin SDK).
   - New tests: private user's sighting denied to a non-follower, allowed to a
     follower and the owner; feed query with a mixed public/private `in` list
     (this is the subtle one: a single private non-followed member fails the WHOLE
     query, see Risks); communityPhotos client-write denied.
4. **Cloud Function.** `onSightingWriteCommunityPhoto`: on create/update/delete of a
   photographed sighting, upsert/remove `communityPhotos/{sightingId}` with only
   public-safe fields (species, photoURL, username, uid, createdAt; no notes, no
   coordinates), skipping non-public owners. Plus `onUserPrivacyChanged`: when
   `isPublic` flips false, batch-delete that user's projection docs; when it flips
   back, re-project (query their photographed sightings). One-time backfill script in
   functions/ (Admin SDK, same pattern as backfillDisplayPhotos.js), dry-run mode
   first per the standing Firebase-writes rule.
5. **Client changes.**
   - `getCommunityPhotosForSpecies` repointed at `communityPhotos` (same shape, one
     call site in app/species/[name].tsx).
   - **The feed query must pre-filter private non-followed users.** Following someone
     always grants read, so the existing followed-ids feed is safe as-is. But
     `getSightingsByUid` on a profile can hit permission-denied for a private
     non-followed user: catch it and render the profile stub (username + avatar +
     Follow button) instead of stats/feed/Dex/compare.
   - `isGlobalFirstSpecies` (Add-time optimistic check) stays best-effort: under the
     new rules its app-wide `limit 1` query fails once any private user exists.
     Change it to fail-safe (treat permission-denied like the existing timeout path:
     no celebration claim; the server-side recompute remains authoritative).
6. **Regression pass** on the dev client: Journal, Friends stats, Venn compare, Dex
   Community tab, Add flow, profiles public/private/self.
7. **Deploy gate.** Present the emulator results + backfill dry-run to Alex; deploy
   rules + functions + run backfill only on his go. Rules are backward-compatible
   while everyone is public, so rules can go first, client build second.

**Risks / gotchas.**
- Firestore rules evaluate `in` queries per-document, but a listener errors as a
  whole if ANY doc fails the rule. Today every followed user grants read via the
  follow edge, so the feed listener survives; the danger case is only future
  non-follow-scoped queries. Encode this in a comment next to the feed query.
- `get()` calls in rules cost a read per evaluated doc; at current scale irrelevant,
  but the communityPhotos projection exists precisely so the one genuinely app-wide
  query never pays it.
- The **ethics gap** stands: public-by-default exposes exact GPS of threatened
  species until coordinate fuzzing lands. See item 6-C; my recommendation is to ship
  PL-1 and 6-C in the same release so the public default never exists without it.

**Effort.** L (the largest single item; 1-2 focused days including tests).
**Order.** First among PL items; PL-2 rides its rules pass.

### PL-2: Block / report / guidelines (P0, store-required for strangers)

**Current state (verified).** Zero moderation primitives in code or rules. Admin
allowlist exists in rules (isAdmin, two uids). GitHub Pages already hosts PRIVACY +
DELETION pages (pattern to copy for Guidelines/EULA).

**Plan.**
1. **Data + rules (inside the PL-1 rules pass).**
   - `users/{me}/blocked/{uid}`: owner read/write only.
   - Extend `canEngage()` to also require
     `!exists(/users/$(sightingOwner())/blocked/$(myUid()))` so a blocked user
     cannot hoot/comment/propose on the blocker's sightings. Note each extra
     `exists()` is a rules read; fine at scale.
   - `reports/{id}`: create-only for the signed-in reporter
     (`request.resource.data.reporter == myUid()`, targetType in
     ['user','sighting','comment','proposal']), read/delete admin-only.
2. **Block semantics client-side.** Blocking: drops follow edges both directions
   (two deletes, the reverse edge needs a Cloud Function or a rules carve-out since
   you can only write your own edge; simplest is a small callable
   `blockUser(uid)` doing both edge-deletes + the blocked-doc write server-side,
   atomic and rule-proof). Feed/context layers filter blocked uids from
   FriendSightingsContext results and hide their comments/proposals locally.
   Recommended (matches WORK_QUEUE): block also hides you from them, which the
   dropped follow edges mostly achieve under PL-1 rules once you are private;
   for public accounts it is soft-hiding only, document that honestly.
3. **Report UI.** A "Report" row in the existing ⋯ affordances: sighting detail
   overflow, profile screen, comment long-press. One shared bottom sheet
   (components/BottomSheet.tsx per the modal rule) with 4 canned reasons + free text.
4. **Admin action.** Cloud Function `onReportCreated` emails Alex (use the Trigger
   Email extension or a plain nodemailer + app password; simplest sustainable thing).
   Manual action via existing admin powers; add an admin-only soft-hide field
   (`hidden: true` on a sighting, admin-writable like the verification fields, all
   feed queries filter it) so a bad post can be pulled without deleting user data.
5. **Guidelines + EULA.** One markdown page on the existing GitHub Pages repo;
   linked from signup ("By creating an account you agree...") and the You ⋯ menu.
6. Emulator tests: blocked user cannot comment/hoot/propose; reporter can create but
   not read reports; non-admin cannot read reports; admin soft-hide write allowed,
   owner cannot unhide.

**Risks.** The both-direction edge-drop needs the callable (client alone cannot
delete the other user's edge under current rules). Keep v1 report-driven; no
profanity filter beyond a tiny username denylist at signup.
**Effort.** L (a solid day). **Order.** Immediately after PL-1; same rules deploy.

### PL-3 residual: Owner-scoped Storage upload paths

**Current state (verified).** storage.rules exists, is wired into firebase.json, and
was deployed Jul 6 with the display-copy path. Remaining hole (documented in the file
itself): uploads go to `sightings/{sightingId}.jpg` with no uid segment, so any
signed-in user can overwrite any photo by guessing its id.

**Plan.** In photoService, write new uploads to `sightings/{uid}/{sightingId}.jpg`
and `sightings/display/{uid}/{sightingId}.jpg`; add matching rules
(`allow write: if request.auth.uid == uid`, same size/content-type caps); keep the
legacy paths read-only (existing photos keep tokenized URLs; delete the legacy WRITE
rule so old paths become immutable). Update the Cloud-side display-copy pipeline
(backfillDisplayPhotos assumptions) and the two-copy upload in photoService together.
Verify: new sighting photo uploads + renders on both a new and an old build (old
builds render via photoUrl, which carries the full path, so no compat break).
**Effort.** S-M. **Order.** Bundle with the PL-1/PL-2 rules deploy.

### PL-4: Lock down the Google Places API key (ops)

**Current state.** Key confirmed unrestricted (May 24 2026). Console-only task.
**Plan.** GCP credentials: Android app restriction with both package ids
(`com.akeats97.pocketbirds`, `.dev`) + EAS keystore SHA-1
`9F:80:48:66:0E:82:8F:1B:85:6D:1D:9B:3A:C5:0F:55:2A:CA:6C:85`; API restriction to
classic Places API only. Wait ~5 min, then verify autocomplete in the dev client AND
a production build. Gotcha: the key is also consumed on iOS builds now; if iOS
autocomplete breaks after Android-restricting, split into two keys (one per platform
restriction type) rather than un-restricting. **Effort.** S. **Order.** Any time;
requires Alex in the console (his GCP auth).

### PL-5: Deep-link friend invite (the growth engine)

**Current state (verified).** Does not exist. Only `Share.share` of a sighting
(app/sighting/[id].tsx:186). Deep-link schemes registered: `pocketbirds4://` (Android)
and `com.akeats97.pocketbirds://` (iOS, per the migration doc sim commands). Q-7
auto-follow-Alex is the stopgap.

**Plan.**
1. **Link format.** Custom schemes cannot survive install (a not-yet-installed app
   cannot open them), so use a web URL that carries attribution:
   `https://akeats97.github.io/PocketBirdsMVP/invite?ref={inviterUid}` landing page
   with store badges (GitHub Pages, matching the PRIVACY/DELETION pattern). True
   deferred deep-linking (attribution survives the store install) needs a service
   (Branch) or platform plumbing (Play Install Referrer + Apple App Clip/clipboard
   heuristics). **Recommended v1: clipboard fallback.** The landing page copies
   `pb-invite:{inviterUid}` to the clipboard on the Install tap; on first launch
   after signup the app checks the clipboard for that token (one read, then clear),
   attributes, and wipes it. Play Install Referrer can be added for Android later;
   it is the reliable path and free (expo module exists: `react-native-device-info`
   exposes it, or the dedicated installreferrer lib).
2. **In-app generate.** "Invite a friend" row on the Friends tab header + You ⋯ menu:
   `Share.share` the URL with warm copy ("Come bird with me on Pocket Birds").
3. **On redeem** (first launch, post-signup): write the follow edges BOTH directions
   (inviter follows invitee via a callable, since the client can only write its own
   edge; invitee follows inviter client-side), fire the existing follow
   notifications, and land the new user on the Journal where the inviter's latest
   sighting is already visible. Store `invitedBy: uid` on the user doc for later.
4. **Cold-start bonus.** When `invitedBy` exists, skip/augment the Q-7 auto-follow
   (they already have a real friend; keep Alex's auto-follow too at current scale).

**Risks.** Clipboard heuristics are imperfect (user may copy something else first);
acceptable for v1 with the Play referrer as the Android upgrade path. Do NOT change
the app schemes (breaks existing push deep-linking).
**Effort.** M-L (landing page + client + callable + tests).
**Order.** Highest-leverage non-blocker; build right after PL-1/PL-2.

### PL-6: Open-signup hardening

**Current state (verified).** No `sendEmailVerification` anywhere. `searchUsers`
downloads the usernames collection and filters client-side (userService.ts:13-28).

**Plan.**
1. **Email verification, capture-not-gate:** call `sendEmailVerification` after
   signup (RNFirebase: `user.sendEmailVerification()`), show a dismissible banner on
   the You tab until `user.emailVerified` (reload on app focus). Gate nothing in v1;
   the signal exists for future abuse response. Rules cannot see emailVerified
   without custom claims, so skip rules-level gating for now.
2. **Discoverability decision for Alex** (product call, listed here so it is not
   lost): keep everyone findable by handle (current behavior, matches
   public-by-default) or invite-only discovery. Recommendation: keep search, it is
   consistent with PL-1's public default; private accounts already reduce to a stub.
3. **searchUsers scale fix** (do when strangers exist): replace the
   download-and-filter with a server-side prefix range query
   (`where(documentId(), '>=', q).where(documentId(), '<', q + '') limit 15`)
   on the usernames collection; ids are already lowercase.
4. **Username denylist** at signup (tiny local list: slurs, "admin", "pocketbirds").

**Effort.** S-M. **Order.** Before opening signup; after PL-1/2.

### PL-7 / Q-6: Push reliability: silent drops + receipts (P0 bug)

**Current state (verified).** functions/index.js sends via expo-server-sdk and logs
ticket chunks (line ~177) but **never polls receipts**; delivery failures
(DeviceNotRegistered, MessageRateExceeded) are invisible, and dead tokens are never
cleared. The two missed pushes (Vic's Chimney Swift / Red-bellied Woodpecker,
Jun 12) were never root-caused. docs/push-debugging.md has the 4-layer playbook.

**Plan.**
1. **Diagnose first (read-only).** Pull Cloud Function logs around the two known-miss
   sightings (`gcloud logging read` or the Firebase console; sighting ids findable by
   birdName+date via an Admin query). Determine: function invoked? ticket ok? That
   tells us token-side vs send-side. Also check Alex's user doc token freshness.
2. **Receipt polling (the durable fix).** After each `sendPushNotificationsAsync`,
   collect ticket ids; schedule a receipt check ~15 min later. Cleanest shape in
   v2 functions: write tickets to a `pushTickets/{id}` doc (token, ticketId,
   recipientUid, createdAt) and add a scheduled function (every 15 min,
   `onSchedule`) that drains unchecked tickets via `getPushNotificationReceiptsAsync`,
   logs errors, and on `DeviceNotRegistered` **deletes the recipient's
   expoPushToken field** so future sends skip a corpse token. Delete processed
   ticket docs (TTL-style).
3. **Token hygiene client-side.** savePushToken already runs at launch; add a
   re-save on `expo-notifications` token-rotation listener
   (`addPushTokenListener`) so a rotated FCM token is never stale. Verify the
   migration did not change the token write path (it now writes through RNFirebase).
4. **Verification.** Manual curl send per the playbook to a known-bad token to watch
   the receipt path fire; then a real send both directions (folds into M-1's
   Phase 3 push check).

**Risks.** The scheduled function is a new billing surface (negligible: 96 runs/day,
mostly no-ops). Keep Expo transport (decided; do not migrate to raw FCM).
**Effort.** M. **Order.** P0; also unblocks the migration's push verification.

### PL-8: Outstanding on-device verifications (fold into M-1)

**Current state.** Three "done in code, never verified on a shipped build" items:
UR-1 keyboard-controller Add-screen behavior, the rebuilt pinch-zoom
(app/photo.tsx + zoom-toolkit), and Q-5 Option A offline hardening on a real flaky
network. All three are IN the vc31/vc32 builds Alex is already soaking (native deps
included since Fairywren; the migration builds are fresh natives).

**Plan.** Add to the M-1 soak checklist: (a) Add Sighting, focus Notes, keyboard
lifts + swipe-down dismisses; (b) open a photo, pinch/pan/double-tap; (c) at the next
bad-network opportunity, log a bird and confirm single doc + no false global-first.
Mark each in WORK_QUEUE when observed. **Effort.** S (checklist only).

### PL-9: Branding & store assets (Alex's item)

**Current state.** app.json still points at placeholder icon/splash assets.
**Plan (agent-assistable parts).** Inventory exact required sizes (adaptive icon
foreground/background layers, iOS 1024 marketing icon, splash, feature graphic,
6.7"/6.1" + tablet screenshots), generate the resized set from Alex's master art
with ImageMagick once he supplies it, wire into app.json + native dirs (bare
workflow: android res mipmaps + iOS AppIcon.appiconset by hand, NO prebuild), and
draft store listing copy in the PRD voice for Alex's review. Screenshots via the
iOS sim + Android emulator with a seeded demo account.
**Effort.** M once art exists. **Order.** Before public listing; not before.

---

## 3. Scale plumbing: counters, pagination, the 30-friend cap

These three share one data model; plan them together, build in stages.

### SC-1: Denormalized per-user stat counters (Cloud Function + backfill)

**Current state (verified).** Friends-tab per-friend stats, profile stat strips, and
compare all derive species/sightings/photos counts by reading FULL sighting history
client-side. The bootstrap listener paints fast, but the full `userId in` listener
still scales with total history (393 docs and growing). Follower counts are worse:
`getConnections`/`getFollowCounts` read the ENTIRE `following` collection group
(userService.ts:189) on every profile view.

**Plan.**
1. New `users/{uid}.stats` map: `{ sightings, species, photos, helpedId }`,
   maintained by a Cloud Function on sighting create/delete/update (species count
   needs a distinct-species check: on create of a new birdName for the user
   increment, on delete of the last one decrement; reuse isNewSpeciesForUser logic).
   Client-writable: no (rules deny; CF-only). Also `followers`/`followingCount`
   counters maintained by onFollowCreated/onFollowDeleted (delete trigger is new).
2. One-time backfill (Admin script, dry-run first): compute all users' stats.
3. Repoint consumers: friends.tsx flock rows, ProfileView stat strip,
   getFollowCounts (drop the collection-group scan). Keep the All time / This year
   toggle working: year-scoped counts stay client-side from the feed for now
   (or add `statsThisYear` maintained the same way; decide at build time, start
   without it and keep the toggle deriving from loaded data).
4. First-of-species persistence for the friend "1ST" badge: stamp
   `firstOfSpeciesForUser: true` on the sighting doc at create-time in the same CF
   (earliest-of-species math currently forces full history reads in the Journal).
   Backfill alongside.

**Effort.** L. **Order.** Post-Doradito, before SC-2 (pagination depends on it).

### SC-2: Real friend-feed pagination

**Current state.** Bounded bootstrap listener (limit 50) + unbounded authoritative
listener. Blocked on SC-1 because Friends stats, 1ST badges, and Hep need full
history today.

**Plan.** Once SC-1 lands: cap the authoritative listener at ~200 recent docs with
`startAfter` pagination on scroll (query by `userId in` + `orderBy date desc`), keep
the bootstrap listener as-is, move Hep to its own query (report entries by type,
paginated separately), and delete the full-history requirement note in
FriendSightingsContext. **Effort.** M. **Order.** After SC-1.

### SC-3: Wrinkle A: the 30-value `in` cap

**Current state (verified).** Both feed listeners use a single
`where('userId','in', userIds)`; user 31+ silently vanishes from the feed.

**Plan.** Chunk `userIds` into groups of 30, run parallel listeners, merge + resort
snapshots in the context (the merge layer already exists for bootstrap/full). Apply
the same chunking to the bootstrap listener (limit 50 per chunk, then trim merged to
50). Composite index already exists. Test with a seeded 35-follow account on the
emulator or a junk account. **Effort.** S-M. **Order.** Before any stranger can
follow >30 people; cheap enough to do with SC-1.

---

## 4. Community ID loop (Q-8, Q-10, Q-11)

### Q-8: Comments on Mystery Bird proposals (P1)

**Current state.** Proposals + proposal hoots shipped; no comment thread on a
proposal. Sighting-level comments exist with composer + rules + CF push patterns to
mirror. Rules note: the recursive-wildcard `{path=**}/hoots` read exists; comments
under proposals will need their own read path or reuse of an equivalent pattern.

**Plan.** Data: `sightings/{id}/proposals/{pid}/comments/{cid}` with the same shape
as sighting comments (uid, authorName, text, createdAt). Rules: copy the sighting
comments block under the proposals match (canEngage gate, 500-char cap, author or
sighting-owner delete). Denormalize `commentCount` on the proposal doc (CF, same as
onCommentAdded). UI: a small "N comments" toggle row on each proposal card in
components/community/, expanding an inline thread + composer (reuse the sighting
thread markup from app/sighting/[id].tsx, extracted into a shared component if the
lift is small). Push: `onProposalCommentAdded` CF notifying the PROPOSER (and the
sighting owner if distinct from commenter), pushSocial pattern. Emulator tests for
the new rules. **Effort.** M. **Order.** Anytime post-Doradito; pairs with Q-11.

### Q-10: "Helped ID" profile stat

**Current state.** `identifiedBy`/`identifiedByUsername` stamped at accept (Q-9
done); no durable counter, nothing on the profile.

**Plan.** Ride SC-1: `stats.helpedId` incremented in `onProposalAccepted`
(functions/index.js:706 already fires there; add the increment on the proposer's
user doc). Backfill: count accepted proposals by proposer (tiny). UI: fourth stat in
the ProfileView strip ("Helped ID · N"), hidden when 0. **Effort.** S given SC-1.

### Q-11: The ID queue (browse open Mystery Birds)

**Current state.** Not built; blocked on an IA decision (where does it live).

**Plan.** Decision for Alex first, with a recommendation: a card at the top of the
**Friends tab** ("3 mysteries need an ID") opening a pushed stack screen. Rationale:
Friends is the flock hub, the queue is a social act, and the Journal stays clean.
Query: sightings where `isMysteryBird == true` and no accepted ID; needs a queryable
flag since "no accepted proposal" is not queryable directly. Add `identified: false`
at Mystery create (or reuse `identifiedVia == null` with an `isMysteryBird` +
`orderBy createdAt` query filtered client-side at our scale). Scope: own + followed
users (visibility falls out of PL-1 rules; a private non-followed user's mysteries
simply do not appear). Sort: newest first, "fewest proposals" as a secondary chip.
Screen lists FriendSightingCards tapping through to the detail where the propose
flow already lives. **Effort.** M. **Order.** After Q-8 so threads exist when the
queue drives people to proposals.

---

## 5. UX / product polish

### UX-1: Q-12 part 2: Mystery Bird reassurance copy

**Current state (verified).** Photo-first ordering shipped Jul 1 (part 1 done). No
reassurance copy exists when Mystery Bird is selected.

**Plan.** In components/SightingForm.tsx, when the selected species is the Mystery
Bird: one quiet line under the species field ("Your friends will help ID this one")
in the leaf-tinted secondary style, and the submit button label stays (do not fight
the banner/takeover chain). Copy per PRD voice. **Effort.** S.

### UX-2: Q-15: bring back photo cropping

**Current state.** `allowsEditing` removed (crop re-encode strips EXIF; location now
comes from the library asset on both platforms anyway).

**Plan.** Crop AFTER the location read: pick (no editing) -> `readPhotoCoordinates`
resolves from the original asset -> then `expo-image-manipulator` crop step on the
picked file (square-ish freeform UI is not built into image-manipulator, so v1 is a
fixed-ratio "crop to square / 4:5" action sheet rather than a drag UI; if Alex wants
drag-crop, `react-native-image-crop-picker` is the native-dep alternative and needs
dev-client rebuilds). Keep the two-copy upload consuming the CROPPED file as the new
"original". Re-verify the patched assetId flow is untouched (we never re-enable
allowsEditing). **Effort.** M (S for fixed-ratio v1). **Order.** With the next photo
batch, after Doradito.

### UX-3: Propose composer: full-screen route rework (UR-4b polish)

**Current state.** ProposeSheet is the gesture-handler-in-Modal sheet Alex dislikes.

**Plan.** New pushed route `app/sighting/[id]/propose.tsx` (card presentation slide
from bottom for continuity), reusing the sheet's internals (species search with the
normalized index, field-marks note, submit). The Modal/GHRootView/grabber dance gets
deleted. Keep BottomSheet for the small pickers app-wide (the modal rule stands;
this one becomes a screen, which the rule exempts). **Effort.** S-M.

### UX-4: Global-first celebration endgame (Bug 8 / Q-4 residual)

**Current state.** Interim fix shipped Jul 6: with the takeover flag off, global-first
submits fall through to the normal celebration chain. The decided endgame (Jun 12):
the gold takeover fires at VERIFY-time, not log-time.

**Plan.** When an admin verifies a sighting whose `globalFirst` is true, the OWNER
gets: a push ("Confirmed: first on Pocket Birds to log {species}!") from the existing
verify write path (new CF branch in onSightingWriteGlobalFirst or a dedicated
onDocumentUpdated watching `verified` flip), plus a durable activity-inbox item, and
the in-app gold takeover fires on next open via a pending-celebrations check (a
`celebrations/{uid}` doc or a field on the sighting the client watches; simplest: the
activity item carries `type: 'global_first_verified'` and the Journal fires the
takeover once when it sees an unread one, then marks it read). Re-enable
GLOBAL_FIRST_CELEBRATION_ENABLED wired to this path; the log-time early return stays
dead. **Effort.** M. **Order.** Post-Doradito; delightful, not urgent.

### UX-5: Comment composer resting margin + remaining keyboard verifications

**Current state.** Real fix (keyboard-controller KAV on the sighting detail) landed
Jun 4; needs on-device confirmation on a gesture-nav Android. Folded into PL-8/M-1
checklist. No further code planned unless the soak shows residue.

---

## 6. Reference-data & Dex surfaces

### RD-1: IUCN strip on sighting cards + threatened dot on Dex tiles (Q-14 residual)

**Current state (verified).** `statusFor()` + STATUS_VISUAL power the Species Guide
only; SightingCard/FriendSightingCard/Dex tiles show nothing.

**Plan.** SightingCard + FriendSightingCard: a slim status chip (STATUS_VISUAL bg/fg,
code + "IUCN") in the meta row, rendered only for threatened tiers (VU/EN/CR, plus
NT if Alex wants) so LC does not spam every card; flat per the hard-shadow rule.
Dex tiles: a 6px color dot top-corner on seen tiles for threatened species (do not
recolor the tile; the gold/holo lessons apply). `statusFor` is an O(1) map lookup,
safe in lists; memoize per card anyway. **Effort.** S-M. **Order.** Anytime; nice
Doradito-follow-up visual.

### RD-2: Latin names in feed cards (CLAUDE.md deferred)

**Current state.** Not rendered; no Latin field on Sighting (by design, look up at
render from constants/birdLatin.ts which Q-16 confirmed exists).

**Plan.** One italic secondary line under the species name on SightingCard/
FriendSightingCard via `latinFor(birdName)` (verify export name in birdLatin.ts);
skip Mystery/custom/report entries. Gate behind the same render helper so the detail
screen gets it too. **Effort.** S.

### RD-3: Q-16 follow-up: neighboring-province "likely" ranking

**Current state.** Admin-1 ranking shipped; brittle at borders. Needs an adjacency
table; the geometry source is shared with RD-4.

**Plan.** Source Natural Earth admin-1 (public domain, commercially clean, ~4MB
shapefile) once: `scripts/build-admin1-geo.py` computes (a) adjacency pairs (shared
border test via shapely touches/intersects on simplified geometry) keyed by the SAME
`"US|california"` keys birdRanges uses (mapping NE name fields to GBIF admin-1 names
is the real work; expect a manual alias table for mismatches), (b) optionally
centroids for RD-4. Output `constants/admin1Neighbors.ts` (index-based, small).
rangeStatusFor: "expected" if expected in user's region OR any neighbor. Cap
over-widening: neighbors only, never neighbors-of-neighbors; Europe density is fine
at one hop. Validate with the magpie cases + a border case (e.g. Ottawa/Gatineau).
**Effort.** M-L (the name-crosswalk is the grind). **Order.** With RD-4, one
sourcing pass.

### RD-4: Q-17: admin-1 range map in the Species Guide

**Current state.** Guide map shades whole realms; birdRanges has region keys but no
geometry.

**Plan.** Same Natural Earth pass emits simplified admin-1 polygons. Bundle-size
strategy: ONE shared basemap asset, not per-species geometry. Recommended: a
prerendered equirect basemap PNG (already have world-equirect.png) + a compact
`constants/admin1Paths.ts` of heavily simplified polygons (topojson-style quantized
deltas, target under ~1.5MB) rendered via react-native-svg overlay tinting expected
regions; realm fallback for the ~12% unknown. Skip density/heat in v1 (counts were
dropped from the build; re-running build-bird-ranges.py with counts is a v2 flag).
**Effort.** L. **Order.** After RD-3 sourcing; a showpiece feature, not urgent.

---

## 7. Backlog features (WORK_QUEUE Features section)

### F-1: GitHub-style activity grid

**Current state.** Not built. Spec in WORK_QUEUE is complete and current (52-week
row, 4 green tiers, gold new-species dot, tap for week detail; header card on the
Journal). One update: the Journal is now the merged home feed, so the grid should
compute from OWN sightings only (SightingsContext), not friends'.
**Plan.** As specced: components/ActivityGrid.tsx + app/utils/activityGrid.ts,
mounted as SectionList header in app/(tabs)/index.tsx above the day groups; greens
derived from palette (propose a leaf ramp to Alex before committing); memoize on the
sightings array. Week detail opens the canonical BottomSheet, not a Modal (modal
rule). Empty state renders all-gray. **Effort.** M.

### F-2: Levels (species-count tiers)

**Current state.** Not built. Strawman table in WORK_QUEUE. Now cheaper than when
specced: SC-1's denormalized `stats.species` gives friend levels for free (the spec's
open question about denormalizing is answered by SC-1).
**Plan.** constants/levels.ts + app/utils/level.ts + components/LevelBadge.tsx per
spec; placements: Journal header (large), friends flock rows (small chip), feed cards
(micro pill). Ladder detail in a BottomSheet. Names/thresholds need an Alex pass
first (PRD voice). Watch PRD "no shame" framing: show progress, never rank rows by
level. **Effort.** M-L. **Order.** After SC-1.

### F-5: Account creation audit (PRD §9 alignment)

**Current state.** Largely converged already: username-claim at signup with
uniqueness via the usernames collection + immutable rules; email+password auth;
avatar with initial fallback. Gaps to audit-confirm: optional display name (nothing
renders one today; usernames are the sole identity per CLAUDE.md, which may be a
deliberate PRD deviation worth recording rather than building), and profile photo
upload (ProfileView has Edit profile; verify what it edits).
**Plan.** Run the Phase-1 audit from the WORK_QUEUE prompt (2 hours), produce the
gap table, and let Alex decide whether display names are wanted at all before any
build. Fold PL-6's email verification in. **Effort.** S (audit) + TBD.

### F-6: "I was there!" tag-along

**Current state.** Not built; no coObserver fields anywhere. Spec (Model A+:
copy-with-backref) still sound. Two spec updates for today's codebase: the button
belongs on FriendSightingCard (the card split happened after the spec), and the
copy must respect PL-1 (the copy is a normal owned sighting, fine) plus 6-C fuzzing
(never copy exact coords of a sensitive species; with 6-C built, copy the fuzzed
public coords only).
**Plan.** Schema: `coObserverOf?: string` + `coObserverIds?: string[]` (arrayUnion
by tappers requires a rules carve-out on the original sighting: allow update where
diff hasOnly(['coObserverIds']) and the union only adds your own uid, enforceable
via `request.resource.data.coObserverIds.hasAll(resource...coObserverIds)` +
size == +1 + your uid is the addition; or route through a small callable to keep
rules simple, which I recommend). Copy carries species/date/location label, no
photo/notes. Confirm + duplicate-day prompt per spec. "with {name}" footer both
directions. Milestone/celebration pipeline runs on the copy (it is a real sighting).
**Effort.** M-L. **Order.** Fun social win post-Doradito; after PL-1 rules settle so
the carve-out lands in one rules pass.

### F-idea: Non-bird `*` sightings

**Current state.** Unscoped idea. **Plan.** Needs Alex answers first (display
treatment of the `*`, count-toward-species confirmed yes, abuse stance). Cheap
predicate `isNonBirdEntry` + Dex "Other" path once decided. Park until asked.
**Effort.** S-M when scoped.

---

## 8. Design-refactor deferred list (CLAUDE.md)

- **Dex hero life-list layout: ALREADY BUILT** (verified today: big lifetime number
  + THIS YEAR / SIGHTINGS / PHOTOGRAPHED rows in dex.tsx). Only delta vs. the spec:
  label reads "LIFETIME SPECIES" not "LIFE LIST". Optional S tweak; update CLAUDE.md
  either way (stale as written).
- **Streak banner (behind Settings toggle, default off).** Blocked on a Settings
  surface, which PL-1 step 2 creates. Plan: `app/utils/streaks.ts` (consecutive
  weeks-with-a-sighting; weeks not days, kinder), a quiet Journal header line, only
  when toggle on. **S-M**, only after Settings exists.
- **Leaderboard ribbon.** Explicitly skip until Alex asks (his "no competition"
  call). Recorded so it is not re-proposed.
- **Dark mode.** Do color-token consolidation first (below), then a palette swap in
  the tokens `theme` export + a `useColorScheme` hook wiring pass. **L.** Last of
  the design items per Alex's "after light-mode settles".

---

## 9. Code health & small verifications

- **Color token consolidation (pre-dark-mode).** 18 `'#fff'` literals remain (was
  25), plus one-off grays and per-file scrim rgba values. Plan: add
  `palette.white`/`palette.scrim`(+`scrimHeavy`) tokens, mechanical sweep, visual
  spot-check on the main screens. **S-M.**
- **Split oversized files (opportunistic only).** Now: dex.tsx 1340,
  SightingForm.tsx 1026, sighting/[id].tsx 784, friends.tsx 751. Rule stands:
  extract sections only when touching them (e.g. Q-8 work should extract the
  comment thread component out of sighting/[id].tsx as its vehicle).
- **Profile-link gaps.** Feed-card commenter avatar -> sighting detail (not
  profile); "replying to @name" and "Called by {name}" not links. Keep deferred;
  bundle with the next feed-card touch. **S.**
- **Bug 2 (OEM notification icon).** Deferred by Alex. When picked up: regenerate
  crisper low-density silhouettes (fewer feathered pixels), test on Vic's device.
  **S** + a build.
- **Bug 3 cold-start repro on a production build.** Superseded in practice by the
  migration (native persistence covers the cold-offline path); fold the original
  airplane-mode repro into the M-1/PL-8 soak checklist and close Bug 3 if it passes.

---

## 10. Net-new recommendations (not in any backlog)

Found while reviewing the app with fresh eyes. Ordered by how strongly I'd push.

### N-1: In-app account deletion (STORE BLOCKER, belongs in the PL series)

Apple Guideline 5.1.1(v) REQUIRES apps that offer account creation to offer in-app
account DELETION. We have a deletion web page (GitHub Pages) but no in-app path;
that fails review on the next close look, and certainly at public-launch review.
Plan: "Delete account" in the You ⋯ menu -> confirm sheet -> a callable
`deleteAccount` (Admin SDK: delete auth user, user doc, username doc, follow edges
both directions, sightings + subcollections + photos, projections) with re-auth
(password prompt) first per Firebase requirements. This is PL-2-grade priority and
should be treated as **PL-10**. **Effort.** M.

### N-2: Crash reporting + basic analytics before strangers

No crash/error reporting exists (verified: no sentry/crashlytics). With two users,
bugs report themselves at dinner; with strangers, silent crashes are invisible
churn. Plan: `@sentry/react-native` via sentry-expo (JS + native crash capture,
free tier is plenty), wrapped so PII stays out (no notes/coords in breadcrumbs).
Add at the same time: a JS ErrorBoundary screen with the brand voice ("well, that
bird flew into a window") instead of a white screen. Native dep: needs dev-client
rebuilds; land it in the FIRST post-Doradito build so it soaks before launch.
**Effort.** S-M. **Push hard.**

### N-3: Sensitive-species coordinate fuzzing (6-C, the PL-1 ethics gap)

The data dependency (IUCN status, Q-14) SHIPPED, so this is now buildable and I
recommend gating the public default on it (PRD §8 promise). Plan: at save time, if
`statusFor(birdName)` is VU/EN/CR, store exact coords in a new owner-only field
(`coordinatesExact`, stripped by rules from non-owner reads... Firestore rules
cannot strip fields, so instead: store exact in a subdoc
`sightings/{id}/private/coords` readable by owner only, and put a ~10km-jittered
point + `coordsFuzzed: true` in the public doc) and render the fuzzed pin with a
small "location generalized to protect this species" note. Feed/detail/compare all
read the public doc unchanged. Backfill existing threatened-species sightings the
same way (few docs). Fold the rules into the PL-1 pass. **Effort.** M.

### N-4: Push deep-linking to the sighting

`friend_sighting` taps land on the Journal generically; the payload already carries
`sightingId` (verified in functions/index.js). Plan: in the notification-response
handler (app/_layout.tsx), route `friend_sighting`/social types to
`/sighting/{id}`. Small, high-delight ("Vic saw a WHAT" -> straight to the photo).
Test cold-start and warm-start tap paths. **Effort.** S.

### N-5: Journal feed thumbnails (photo cost/perf follow-up)

Display copies are 2048px (~200-500KB), rendered into ~360px-wide feed cells. The
grey-photo pain is fixed, but feed scroll still downloads ~10x the pixels it needs,
which matters on cell data and at stranger scale (Storage egress). Plan: extend the
two-copy scheme to three (a ~480px `thumb/` copy written by the same upload path +
CF backfill), feed cards render thumb, detail/viewer renders display, "full res"
renders original (M-3). Do it AFTER Doradito soaks; reuse the backfill machinery
from July. **Effort.** M.

### N-6: eBird/CSV export ("your data is yours")

Birders keep life lists for decades and will not trust a side-project app as the
sole holder. An export builds exactly the trust the PRD's ethics section trades on.
Plan: You ⋯ menu -> "Export my sightings" -> generate CSV (species, date, location
label, coords if present, notes) via expo-sharing. eBird Record Format is a
documented CSV layout; offer both plain CSV and eBird-importable. Pure client code.
**Effort.** S-M. Cheap, differentiating, very on-brand.

### N-7: Year in review ("Pocket Birds Wrapped")

Data is all local already (species/year, big day, most-seen bird, first lifers,
photos). A December share-card moment drives the invite loop (PL-5's link belongs
on the share card). Plan: a generated card stack (react-native-view-shot to export
an image) behind a You-tab entry that appears in December. Park until fall; noting
now so the PL-5 share plumbing anticipates it. **Effort.** M-L, seasonal.

### N-8: Firebase App Check (with PL hardening)

Rules gate WHO, App Check gates WHAT app: it blocks the lifted-token/REST-abuse
vector PL-1 worries about, cheaply (Play Integrity + App Attest, both free).
Bare-workflow RNFirebase supports it (`@react-native-firebase/app-check`). Plan:
enable in monitor-only mode first, watch metrics a week, then enforce on Firestore +
Storage. Needs dev-client rebuilds; debug tokens for sim/emulator workflows.
**Effort.** M. Do alongside PL-1/PL-2 deploys.

### N-9: CI safety net (typecheck on push)

There are no tests/CI at all; the emulator rules suite (PL-1 step 1) plus
`tsc --noEmit` are about to exist/already pass. A 15-line GitHub Actions workflow
(typecheck + rules tests on push) catches the classic solo-dev regression. No
device builds in CI (EAS costs money); just the cheap static gates. **Effort.** S.

---

## 11. Hep feedback triage (added Jul 7 2026)

All 43 Bug Report / Feature Request sightings pulled from Firestore (with comment
threads) and reconciled against the code. Two-thirds are DONE. The open ones get
HEP-series plans below. Reports are cited by requester + first words.

### Done (verified in code or confirmed in-thread)

Shipped and already acknowledged in the thread: edit sightings, mystery birds,
notes on the detail screen, ✕ clear buttons, grey/gray + dash/space search,
following lists + bells, "following" label, photo zoom, clickable hooters (both
asks), recent locations, mystery-bird stats, follow-notification deep link,
keyboard-blocking comment composer (anastasia confirmed), reply context on
comments.

Shipped but **never announced on the post** - worth a comment from Alex to close
the loop:

- **alex "submit an unknown bird and have friends verify"** - Mystery Bird +
  community proposals shipped the whole ask.
- **victoria "react to friends sightings"** - hoots.
- **victoria "group friends log by date"** - the merged day-grouped Journal.
- **victoria "filter friends page for sightings vs bugs/features"** - superseded:
  reports no longer appear in the Journal at all; Hep is the dedicated view.
- **evaloon "swipe down to close keyboard / field moves up"** - Alex's last comment
  says "didn't add this yet", but it landed since: SightingForm uses
  KeyboardAwareScrollView + `keyboardDismissMode="interactive"`.
- **anastasia "stars and confetti for each new bird"** - confetti rain on every new
  species shipped in add.tsx.
- **anastasia "pic not appearing on dex card"** - Dex tiles render the photo now.
- **anastasia "nav panel not snapped to bottom"** - tab-bar chin fixed Jun 8
  (39a0bff + a1f428c); Alex asked "is it better now?" and got no reply - worth a
  re-ping.
- **brad "date picker colour hard to see iOS"** - fixed same day (ab89cd6,
  `themeVariant="light"`), never announced.
- **alex's two Lions Head reports (false global-first + nothing loading /
  duplicate post)** - root-caused and fixed Jun 22 (2148e20: long-polling
  autodetect, idempotent client-minted ids, `getDocsFromServer` global-first
  check), and structurally fixed by the RNFirebase migration. Final confirmation
  rides the M-1 soak checklist.

No action: victoria "please come home I miss you" (10 hoots was the correct
resolution).

### HEP-1: Suggest-an-ID from the photo (anastasia; the Merlin ask)

**Current state.** Not built. Community ID (proposals) is the shipped "intermediary
feature" Alex promised on the post.
**Plan.** v1 is a **"Suggest an ID" button on a photographed Mystery Bird** (detail
screen, owner + friends), calling a new callable CF that sends the display-copy
photo to a multimodal model (Claude Haiku class is plenty; key stays server-side)
with the sighting's coords/region as context, returning top-3 species + confidence.
Render the suggestions as prefills for the EXISTING propose flow - the human still
proposes, the owner still accepts, so verification ethics hold and a wrong model
answer is just an unaccepted proposal. Never auto-accept, never auto-fill the Add
form in v1. Rate-limit per user/day in the CF. On-device TFLite (iNat birds
classifier, Apache-2.0, ~1k species) is the offline v2 if call costs annoy;
**sound ID is out for now** (BirdNET models are CC BY-NC-SA - non-commercial, fails
the licensing constraint).
**Effort.** M (callable + button + prefill). **Order.** Post-Doradito; pairs
naturally with Q-11's ID queue.

### HEP-2: Silkie Chicken (anastasia) - DROPPED (Jul 7 2026)

Alex's call: not doing it. Silkie isn't a species (all domestic chickens are one
species, descended from Red Junglefowl, which IS in the IOC list). If it ever
returns it's one line in `constants/customSpecies.ts`; recorded so it is not
re-proposed. Worth a comment on anastasia's post explaining the taxonomy.

### HEP-3: Usernames clickable everywhere (victoria)

**Current state.** Mostly done piecemeal (feed-card pill, hooters, flock rows,
"ID'd by"). Known residue is already listed in §9 profile-link gaps: commenter
avatar/name on the detail thread, "replying to @name", "Called by {name}".
**Plan.** Absorb §9's item and finish it as one sweep: grep every `username`
render, wrap the stragglers in a shared `UserLink` (Pressable -> `/profile/{uid}`;
needs the uid alongside the name, which comment docs and proposals already carry).
Comment on victoria's post when the sweep lands. **Effort.** S.

### HEP-4: Bird call playback in the Species Guide (ooplena)

**Current state.** Not built; Alex pointed at the Guide tab as the future home.
**Plan.** Stream, don't bundle: query the **xeno-canto API** by Latin name
(`constants/birdLatin.ts` has the lookup) for quality-A recordings **filtered to
commercial-safe licenses only** (CC BY / BY-SA; exclude the large NC pool - this is
the licensing gotcha), pick the top hit, play via expo-audio with a play/stop row
in SpeciesGuide (between Description and Measurements). Mandatory attribution line:
recordist + license, per xeno-canto terms. Cache the resolved URL per species in
memory; hide the row entirely when offline or no licensed recording exists (honest
degradation, same pattern as the realm map's unknowns). No native dep (expo-audio
is already Expo-ecosystem). **Effort.** M. **Order.** Anytime post-Doradito; a
lovely Guide upgrade.

### HEP-5: Streaks (ooplena) - cross-ref §8

Covered by the §8 streak-banner plan (weekly, not daily - Alex argued weekly in
the thread and ooplena's Duolingo ask stays overruled; behind a Settings toggle,
default off, blocked on the PL-1 Settings surface). Only addition: comment on
ooplena's post when it ships.

### HEP-6: Flock map - friends' sightings on a map (ooplena + victoria, loudest ask)

**Current state.** Not built. Three users chanting "map" on one post; CLAUDE.md
already earmarks the Friends hub for a future map.
**Plan.** Native dep `react-native-maps` (dev-client + production rebuilds; land it
in a build Alex is already making). Entry: a "Flock map" card on the **Friends
tab** pushing a full-screen stack route `app/flock-map.tsx`. Data v1: the sightings
already in memory (SightingsContext + FriendSightingsContext) filtered to
`coordinates != null` - no new queries at current scale; revisit with SC-2
pagination. Pins colored you-vs-friends, `react-native-maps` built-in clustering is
weak so use a tiny grid-cluster util or render capped (<500 pins is fine). Callout:
species + @username + date -> taps through to the sighting detail. Filters v1: All /
Mine / a species search chip reusing the normalized index. **Ethics gate: ship
with or after N-3** - sensitive-species pins must use the fuzzed public coords, and
the "location generalized" note carries over. GPS-less sightings simply don't
appear (the green-pin cue already trains this). **Effort.** L. **Order.**
post-Doradito headline feature; sequence the rebuild with N-2's Sentry so one
dev-client rebuild covers both.

### HEP-7: Show the message you're replying to (skeats00)

**Current state.** Composer banner + thread line show only `@username`
(`replyTo: { commentId, uid, username }` is already on the comment doc).
**Plan.** Denormalize `textSnippet` (first ~80 chars of the parent comment) into
`replyTo` at send time in commentService; render it as a one-line quoted snippet
(muted, truncated) in the composer banner and above the reply in the thread. Old
comments lack the field -> fall back to today's @name-only rendering. No rules
change (same doc, additive field); no CF change. Optional polish: tap the quote to
scroll to the parent. **Effort.** S.

### HEP-8: Pull the sighting date from the photo (alex)

**Current state.** photoService already parses EXIF `DateTimeOriginal` (used to
corroborate the library-asset probe) but nothing reaches the form's DATE field.
**Plan.** Return `capturedAt` (parsed EXIF date, falling back to the matched
library asset's creationTime) alongside coords from `readPhotoCoordinates` (or a
renamed `readPhotoMetadata`). In SightingForm add mode: when a photo lands and the
user hasn't touched DATE (same only-overwrite-defaults rule as the location
autofill), set the date + show the quiet "from photo" hint style. Verify on-device
that the picker's GPS redaction doesn't also strip DateTimeOriginal (it shouldn't -
only location is privacy-scrubbed - but this area has burned us; the [photoService]
logs make it a 5-minute check). **Effort.** S-M. **Order.** Natural companion to
the existing photo-first flow; any photo batch.

### HEP-9: Explain the badges (alex)

**Current state.** 1ST lifer badge, global-first holo 1ST pill, verified state,
Mystery Bird tag, "ID'd by", green location pin - none explained anywhere.
**Plan.** One `components/BadgeGuideSheet.tsx` (canonical BottomSheet): a short
scrollable legend, each row = the actual badge component + one PRD-voice sentence.
Entry points: tapping any badge/pill on a sighting card opens the sheet (cheap,
discoverable exactly when curious), plus a "What do the badges mean?" row in the
You ⋯ menu. Keep copy cheeky about the app, respectful about the birds.
**Effort.** S.

### HEP-10: Shareable posts (alex)

**Current state.** Plain-text `Share.share` exists on the sighting detail; no
visual share card.
**Plan.** `react-native-view-shot` renders an off-screen branded card (photo,
species, Latin name, date, @username, wordmark; location label optional-off by
default, never coords) -> `expo-sharing` share sheet, from a Share action on the
sighting detail (own sightings first; friends' shares need a privacy think).
Deliberately build as the reusable card renderer N-7 (Wrapped) wants, and leave a
slot for the PL-5 invite link - this is the organic-growth surface. view-shot is a
native dep: ride the same rebuild as HEP-6/N-2. **Effort.** M. **Order.** after
PL-5 exists the card gets its link; building card-first is fine.

### HEP-11: Profile bio (alex, ~50 chars)

**Current state.** No bio field anywhere (user doc, ProfileView, edit sheet).
**Plan.** `bio?: string` on the user doc, hard cap 80 chars client + rules
(`request.resource.data.bio.size() <= 80` in the users write block - rides the
next rules deploy, which is gated on Alex's go). Edit-profile sheet gains a
ClearableInput with a live char count; ProfileView renders it under the username
(one muted line, both self and public). Placeholder in PRD voice ("say something
about your flock"). **Effort.** S.

### HEP-12: Date wheel exits after every column pick - iOS (gary, bug)

**Current state (root cause found).** SightingForm's DateTimePicker `onChange`
calls `setShowDatePicker(false)` unconditionally. Correct on Android (the dialog
fires once, on OK/cancel) but wrong for the iOS spinner, which fires per wheel
settle - so picking just the month dismisses the whole picker. Exactly gary's
report.
**Plan.** Platform-split: Android keeps close-on-change; iOS keeps the inline
spinner open, updates `date` live on change, and dismisses via an explicit small
"Done" row under the spinner (matches the flat-control conventions) or tap-outside.
**Effort.** S. **Order.** With HEP-13, one date-picker pass; TestFlight-visible
fix, good Doradito-follow-up.

### HEP-13: Can't scroll to future months mid-entry (gary, product call)

**Current state.** `maximumDate={new Date()}` clamps the wheel the moment any
column would exceed today - so month-first entry (Dec, intending an earlier year)
snap-backs annoyingly. Future sightings should stay impossible (you have not seen
the bird yet), but the clamp punishes a legitimate entry order.
**Recommendation.** Drop `maximumDate` and validate at save instead: a future date
blocks save with PRD-voice copy ("unless you're a time traveler, pick a past
date"). Keeps the constraint honest without fighting the wheel. Alternative (keep
the clamp, live with it) costs nothing but leaves gary's papercut. Decide with
Alex, then it's **S** either way, same pass as HEP-12.

### HEP-14: Follow-back button inside the push (evaloon's bonus, parked)

The core ask (notification -> their profile) shipped. The bonus - a "Follow back"
action button on the new-follower push - needs expo-notifications categories plus
a headless background handler doing an authed follow write; fiddly on Android for
small payoff while the deep link works. **Park until asked**; recorded so it is
not lost. **Effort.** S-M when picked up.

---

## Alex's priority ratings (Jul 7 2026)

Collected item by item. Anything not listed here is unrated so far (the PL/M
ship-critical ordering still governs regardless of rating).

- **HIGH:** HEP-12 + HEP-13 (date-picker pass), HEP-9 (badge explainer),
  HEP-8 (photo date), HEP-10 (shareable posts, complex), HEP-6 (flock map,
  complex), N-1 (account deletion), N-2 (Sentry), PL-7 (push reliability),
  PL-2 (block/report).
- **MED:** HEP-11 (bio), HEP-3 (username sweep).
- **LOW:** HEP-7 (reply snippet), HEP-4 (bird calls), HEP-1 (suggest-an-ID).
- **DROPPED:** HEP-2 (Silkie Chicken - not a species).

## Suggested attack order

**Now (while soaking vc32/33, nothing risky on the branch):**
1. PL-7/Q-6 push receipts + diagnosis (M) - also unblocks migration push verification
2. M-1 finish Phase 3 checklist + PL-8 verifications (Alex-on-device, agent assists)
3. N-4 push deep-link (S) and UX-1 Mystery copy (S) - safe, small, ride Doradito
4. Ship Doradito (M-1 steps 4-5)

**Public-launch block (order matters, one rules deploy):**
5. PL-1 (L) with N-3 fuzzing (M) and PL-3 residual (S-M) in the same rules pass
6. PL-2 block/report (L) + N-1 account deletion (M) + PL-6 hardening (S-M)
7. N-8 App Check monitor-mode + PL-4 key lockdown + N-2 Sentry + N-9 CI
8. PL-5 invite links (M-L) - the growth engine, last blocker-adjacent build
9. PL-9 branding when Alex has art

**Post-launch platform (enables the fun stuff):**
10. SC-1 counters (L) -> SC-3 chunking (S-M) -> SC-2 pagination (M)
11. M-2 remove firebase pkg; M-3 follow-ups; N-5 thumbnails

**Product loop, opportunistic:**
12. Q-8 -> Q-11 -> Q-10 (community ID loop), UX-4 verify-time celebration
13. RD-1 IUCN chips, RD-2 Latin names, F-1 activity grid, N-6 export
14. F-2 levels (after SC-1), F-6 tag-along, RD-3/RD-4 (one sourcing pass)
15. Color tokens -> dark mode; F-5 audit; UX-2 cropping; UX-3 propose route

**Hep quick wins (all S, user-visible, safe anytime):**
16. HEP-12/13 date picker pass, HEP-2 Silkie, HEP-7 reply snippet, HEP-9 badge
    guide, HEP-11 bio, HEP-3 username sweep; plus the "never announced" comment
    pass on done posts (free goodwill)
17. Headliners when their build windows open: HEP-6 flock map (+N-2/HEP-10 in one
    rebuild), HEP-4 bird calls, HEP-1 suggest-an-ID, HEP-8 photo date
