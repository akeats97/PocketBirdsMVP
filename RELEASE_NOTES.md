# PocketBirds — Release Notes

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
