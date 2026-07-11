---
name: release-build
description: PocketBirds release naming and the "Start our builds" recipe. Use when Alex says to kick off / start builds, cut a release, or asks about release names, build numbers, EAS build profiles, or release-notes drafting. Covers the full iOS TestFlight + Android APK build sequence and the post-build release-name roll.
---

# Release naming & builds

- In-app title is `Pocket Birds {CURRENT_RELEASE_NAME}` from `constants/release.ts`. Release names come from `release-names.csv`, ordered by **wingspan ascending**. Current building: **Doradito** (Jul 3 2026); next after it is **Jery**. The CSV `Release Date` column = the actual ship date; leave it blank when rolling the name forward, fill it only when a build actually shipped.
- `eas.json`: `appVersionSource: "remote"` + `autoIncrement`, so Android `versionCode` / iOS `buildNumber` bump automatically per build (not stored in `app.json`). Profiles: `production` (AAB + the mandatory `macos-sequoia-15.6-xcode-26.2` image), `production-aab`, and **`apk`** (`autoIncrement`, `buildType: apk` — for **Firebase App Distribution**, NOT the Play Store).

## "Start our builds" — the standard recipe (when Alex says to kick off builds)

This is the full sequence Alex means by "start our builds". Run it in order:

1. **iOS build + auto-submit to TestFlight:** `eas build -p ios --profile production --auto-submit --non-interactive` (`--auto-submit` MUST be at build time; `ascAppId` 6772308812 is already in `eas.json`). Lands in the "Friends" external group.
2. **Android APK** (Firebase App Distribution, NOT Play Store): `eas build -p android --profile apk --non-interactive`. Grab the `.apk` artifact URL from the finished build.
3. **Release notes:** prepend a new dated section to `RELEASE_NOTES.md` covering **everything since the last build** (boundary = the previous "Add {name} release notes" commit; `git log <that-commit>..HEAD`). Match the existing structure (Builds · Headline · Play Store "What's new" · TestFlight "What's new" · What shipped (engineering) · Known issues · Post-ship steps). **The TestFlight notes are a "here's what shipped" announcement in the same style as the Play Store copy (NOT a QA "what to test" checklist)** — mirror the Play Store bullets and add any iOS-only items (e.g. iOS layout fixes). Exclude `WORK_QUEUE.md`-only "spec" commits and pure build-infra. Both builds auto-increment, so the build numbers come from the EAS output (e.g. iOS 9→10, Android vc24→25).
   - **Don't let a "Plus … polish" catch-all swallow real changes.** After drafting, audit EVERY code commit in the range (`git log <boundary>..HEAD` + check files touched) and ask "would a user notice this?" — if yes, it gets an explicit line in the Play Store / TestFlight copy, not just the engineering section. (Tyrannulet shipped with hoot-sheet UX, the Dex Mystery tile, the avatar fix, and the profile bell missing from the user-facing copy at first; this audit step is how that's avoided.)
   - **Play Store copy = Android audience; TestFlight copy = iOS audience.** iOS-only fixes (header/layout) go in TestFlight only, not the Play Store listing, and vice-versa.
4. **AFTER both builds succeed:** roll `constants/release.ts` `CURRENT_RELEASE_NAME` forward to the next CSV name, and stamp the **just-built** name's `release-names.csv` `Release Date` with today (we know it shipped). Do NOT roll before the builds upload — the build bakes in the current name, and a failed build should re-run under the same name. Then commit (release notes + roll + CSV).

- EAS server builds cost ~$1 each (so ~$2 for the pair) and the iOS auto-submit is outward-facing — both are pre-authorized when Alex explicitly says to build.
- **Snowcap (Jun 6 2026):** iOS build 8 / Android vc23. **Antwren (Jun 8 2026):** iOS build 9 / Android vc24. **Tyrannulet (Jun 9 2026):** iOS build 10 / Android vc25. **Tyrant (Jun 10 2026):** iOS build 11 / Android vc26. **Fairywren (Jun 14 2026):** iOS build 13 / Android vc28. **Sunbird (Jun 22 2026):** iOS build 14 / Android vc29. **Scrub-Tyrant (Jul 3 2026):** iOS build 15 / Android vc30.
