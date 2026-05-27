# PocketBirds — Product Requirements & North Star

> A living document that defines what PocketBirds is, who it's for, and how it should feel. When a feature spec is ambiguous, re-derive the answer from this doc rather than guessing.

**Last revised:** May 23 2026
**Owner:** Alex
**Audience:** Alex (north star), AI coding agents building features (guidance)

---

## 1. Vision

PocketBirds turns paying attention to birds into something you do with your friends. It's the social layer over the outdoor moments you already have — the walk, the hike, the backyard coffee — and it makes those moments stickier because a friend will see what you saw. It's built for people who don't think of themselves as birders yet, but who are starting to notice. The goal isn't to make them better at identification (Merlin already does that beautifully); it's to make noticing feel rewarding, shareable, and a little bit addictive in the way that Strava and Pokemon Go are addictive — without the toxic edges of either.

If we do this right, a non-birder uses PocketBirds for a month and tells a friend: *"I see birds differently now."*

---

## 2. Bullseye User

**The Curious Non-Birder, Nudged In By A Friend.**

They are someone who has started noticing birds — usually because a friend or partner started pointing them out. They're not buying field guides yet. They probably can't tell a Song Sparrow from a House Sparrow. They've heard of eBird but never opened it. They might have downloaded Merlin once and forgotten about it.

What they want:
- To remember the bird they saw on Saturday and where they saw it.
- To know what their friend just spotted, because it makes them feel like they're in on something.
- To feel a small thrill when they see something new — without having to study for it.

What they don't want:
- A checklist tool. A research interface. A leaderboard. An app that judges them for not knowing what a "passerine" is.

**Secondary users** (must work for them, not optimized for them):
- Birders' partners pulled into the hobby (Victoria is the canonical example).
- Outdoor-active people (hikers, runners, dog-walkers) who want an ambient nature layer.
- Lapsed casual birders who bounced off eBird's UX.

**Explicitly not the target right now:** serious listers, eBird power users, ornithology researchers. These users may find PocketBirds charming, but their needs do not shape the roadmap.

---

## 3. The Magic Moment

> **A push notification from a friend's sighting.**

The single hook we optimize for is the moment a brand-new user — a day or two after a friend invited them in — gets a push that says *"Alex just saw a Belted Kingfisher at Wissahickon."* They tap it. They see a photo, a location, maybe a note. They feel: *oh, this is alive. My friends are out there. I want to be part of this.*

Everything in the product should be in service of making that moment land — and making it land again, regularly.

Secondary magic moments we want to deliver:
- **First sighting logged** → species marked in the Dex with celebratory haptics. The "I caught one" feeling.
- **Milestone crossed** → "your first hawk!" / "10 species this year!" — small bursts of progress.
- **Friend reaction landed** → Victoria hearted your Robin. Quiet acknowledgment that someone saw what you saw.

---

## 4. Core Principles

These are the load-bearing beliefs. When in doubt, defer to these.

1. **Social is the engine, not a feature.** PocketBirds is a friend graph that happens to be about birds. Every feature is evaluated by whether it makes the friend-to-friend loop tighter or weaker. A solo-only feature is suspicious.

2. **Logging is journaling, not data submission.** A sighting is a small joyful artifact, not a research record. We do not ask for exact counts, protocol type, observer comments, or anything that smells like paperwork. Species + location + (optional) photo + (optional) note. That's it.

3. **The bullseye user has never seen a Yellow-rumped Warbler.** Every default, every onboarding step, every empty state is designed for someone who can't yet ID 20 birds. Power-user features may exist, but they hide behind progressive disclosure.

4. **Rank within friends, never beyond.** Leaderboards are fine — fun, even — *as long as they're scoped to your friend graph and never global.* You should be able to see how you stack up against the 5–20 people you've invited; you should never see how you stack up against a stranger. Time-bounded surfaces (yearly, weekly, monthly) sit alongside all-time so a friend joining mid-year always has a race they can be part of. The product never shames a low position and never sends notifications about rank changes.

5. **Birds are not loot.** The voice is playful and a little cheeky about itself, but it treats the birds — and birding ethics — with respect. No "gotta catch em all" framing. No mechanics that reward seeing a bird in a way that would encourage chasing or harassment.

6. **Photos are celebrated, never required.** A sighting without a photo is a first-class sighting. Photo flows should make logged photos look beautiful and slightly more present in the feed — but the app never demands one and never gates features behind one.

7. **The product is sustainable on side-project bandwidth.** Features that require constant maintenance (live competitive events, complex moderation, real-time anything beyond push notifications) are deferred until the project has more shoulders. If a feature would require Alex to be on-call to keep it working, it doesn't ship.

---

## 5. Anti-Goals

PocketBirds explicitly is **not**:

- **A research / data-collection tool.** We will not become an eBird competitor. We will not ask users to submit careful checklists. If a user wants to contribute sightings to eBird, that's their business — we are not building integrations or making it the product's reason for being.

- **A bird-ID AI tool.** Merlin is excellent at this and we are not trying to compete. Future: it would be lovely to have lightweight ID assist (e.g., "what bird am I looking at?" from a photo), but it is **out of scope until the core social product is loved by a small group**. Until then, we assume users can identify (or guess, or ask a friend).

- **A global leaderboard or public scoreboard.** Friend-scoped leaderboards are in scope (see §7), but there is no "top spotters" board that compares users to strangers, no city-wide ranking, no public scoreboards. The friend graph is the boundary of competition just like it's the boundary of visibility.

- **A public broadcaster.** Sightings are never publicly visible by default. The friend graph is the boundary of who sees what. (See §8.)

- **Monetized.** PocketBirds is a side project. There are no ads, no paywalls, no premium tiers, no growth-team metrics. If this ever changes, it is a separate, deliberate decision — not an accidental drift.

- **A daily-streak guilt trap.** Streaks exist (weekly, not daily — see §7) but the product never punishes a user for breaking one. No red exclamation marks. No emails saying "your streak is at risk." Streaks should feel like a personal record, not a leash.

---

## 6. Engagement Model

### Cadence

PocketBirds is **trip-driven**. The expected pattern is: user goes for a walk → opens app to log a sighting → maybe checks the feed → closes it. Dormant between trips, lit up during them. Push notifications from friends keep the app warm during the dormant stretches and are the primary mechanism that re-engages a passive user.

We are **not** designing for daily-open behavior. If a user goes a week without opening the app and then has a great Saturday morning walk, the product should feel just as alive as if they'd opened it every day.

### Social model

- **Light reactions now.** A friend's sighting in the feed can be reacted to with a small set of taps (heart, star — exact shape TBD). One reaction per user per sighting, toggle. Reaction count is visible.
- **Comments later.** Not in the first iteration. When we ship them: simple, no threading, no notifications on every comment.
- **No DMs.** Ever. If a user wants to message a friend about a bird, they have iMessage and Signal.
- **No public profiles.** A user's sightings are only visible to mutual friends. Discovery happens via deep-link invite, not search.

### Photo role

Photos are **optional but visually celebrated**. Sightings without photos render as compact cards. Sightings with photos render bigger, with the photo as the hero. The yellow camera icon on Dex tiles signals which species the user has photographed and is part of this same visual language — a low-stakes "subcollection" of birds you've not just seen but caught on camera.

### Onboarding / virality

The primary path is **deep-link friend invite**:

1. Existing user (e.g., Alex) generates an invite link from inside the app.
2. Sends it to a friend (iMessage / WhatsApp / etc.).
3. Friend taps the link → app store install → first launch already knows who invited them.
4. After account creation, they are auto-friended with the inviter and their first feed item is one of the inviter's sightings.

Secondary paths (e.g., a shareable public link to a single beautiful sighting) are interesting but not in the first PRD scope.

---

## 7. Core Mechanics

### Dex (the collection meta-game)

The current global Dex (11,227 species) is mathematically demotivating — even regional Dexes are too large to feel completable. **The framing we'll adopt is Goodreads-style: the user picks their own annual target.**

- User sets a goal at start of year (or anytime): "I want to see 50 species this year." / "I want to see 200." / "I want to see 1000."
- Progress UI is anchored on **their goal**, not on a fixed universal denominator. *47 / 50 — you're almost there.*
- Goal can be edited at any time. No shame in raising or lowering it.
- Year resets every Jan 1, creating a natural fresh-start moment and a "year in review" content beat.
- The big global Dex view still exists for users who want to browse the universe of birds, but it's no longer the headline progress metric.

This sidesteps the "11k is unreachable" problem while preserving the Goodreads-y feeling of *I set a target, I am moving toward it.*

### Milestones & badges

Surface celebratory moments as they happen:
- First sighting ever.
- First sighting of a new bird family ("you've seen your first owl").
- Round-number species counts (10, 25, 50, 100, ...).
- Hitting your annual goal.

Each milestone fires the existing haptic + a small in-app celebration. Lightweight, joyful, never punishing. Badges are visible on your own profile; whether friends see them is TBD (default: yes, in a low-key way).

### Streaks

**Weekly, not daily.** A streak is *N weeks in a row in which you logged at least one sighting.* This matches the trip-driven cadence (most users won't see a bird every day) and avoids the daily-streak guilt trap.

- Default off. Behind a Settings → "show streaks" toggle.
- Never sends a "your streak is in danger" notification.
- Surfaces in the Field Journal header when on.

### Challenges

Opt-in, scoped, friend-vs-friend. Example: "May Big Month — first to 30 new species wins." Both users opt in explicitly. No global / public challenges. No automatic enrollment. Challenges sit alongside leaderboards as the second competitive surface — but they're explicit, time-boxed events rather than persistent standings.

### Leaderboards

Friend-scoped, no global ever. They live on a **dedicated screen inside the Friends tab** — not as a persistent ribbon on the feed. Users go look at them when they want to; the product doesn't push the standings into every screen.

Two views ship in the first iteration:
- **Species this year** — resets Jan 1. Newcomers can join the race anytime.
- **All-time species** — the long arc. Slower-moving, more about the journey than the race.

A few rules the design must honor:
- Always friend-scoped — never global, never city-wide, never "people near you."
- No notifications about rank changes. ("Victoria just passed you" — no.) Users see standings when they open the screen, not before.
- No shame for low positions. Last place looks the same as third place — a name, a number, no "loser" framing.
- Visible to all friends of a user. There's no opting out of being on your own friends' leaderboard (you can't be in the friend graph and invisible from it), but a user can always remove a friend.

Other metrics to consider for future iterations (not in v1): photos this month, longest streak, most new-to-you species this week. Spreading wins across multiple small leaderboards is a known way to make rankings feel less zero-sum.

**My sightings + my friends' sightings, layered.** A map view shows where I've logged things and where my friends have logged things, scoped to the friend graph. Privacy rules in §8 apply (sensitive species are fuzzed).

This serves the trip-driven use case: *"where have my friends been seeing things lately?"* turns into a tangible "go check out that park" suggestion.

### Bird detail view (from a Dex tile)

Tapping a tile in the Dex opens a view that lists all the user's previous sightings for that species — date, location, photo, note. (This is in the backlog already; surfacing here as core to the Dex experience, not optional polish.)

---

## 8. Ethics & Privacy

PocketBirds is friends-only. Always.

- **A sighting is visible only to confirmed mutual friends.** It is never public, never indexed, never broadcast.
- **Sensitive species coordinates are fuzzed.** For species flagged on the IUCN Red List as threatened, endangered, or critically endangered (and any others we manually flag for ethical reasons — e.g., owl roost locations), the exact coordinates are visible only to the user who logged the sighting. Friends see the species and an approximate location (e.g., truncated to nearest few km, or just a region name). This protects birds from being chased.
- **No rare-bird broadcast.** PocketBirds does not have a "rare alert" feature. If a user sees something remarkable, it sits in their feed like any other sighting.
- **User-deletable.** Users can delete any of their own sightings. (Long-press already supports this.)

The IUCN data ingest is in the Pending Design Work (see CLAUDE.md). When it lands, the privacy fuzzing logic must be wired up at the same time.

---

## 9. Identity Model

- Users sign up with **email + password** (already in place via Firebase Auth).
- Identity in the app is **a username (handle)**. Real name is **not required**.
- Optional **profile photo** (a small circular avatar shown next to the user's name on sightings and in the friends list). User can upload one or leave it blank — blank renders as a colored circle with initials.
- Display name (optional, separate from username) for the case where a user wants to be "Vic" in the app but their handle is `victoria_k`.

Friends are added by invite link or by searching for a friend's username. There is no public profile page indexable by search engines or visible to non-friends.

---

## 10. Brand & Voice

PocketBirds is **playful and slightly cheeky**, in the spirit of the existing copy ("please don't put birds in your pockets" / "nice try guy, go again"). It makes jokes about itself and gently teases the user, but never punches down and never makes fun of the birds.

Tone rules:
- About the app: cheeky, self-aware, slightly absurd.
- About the user: warm, encouraging, willing to make small jokes.
- About the birds: respectful. No "gotta catch em all" framing, no diminishing language. A Robin is a Robin, not a "common starter bird."
- About birding the activity: low-stakes, accessible, never gatekeeping.

Visual identity:
- The cream + gold palette established in the Pocket Dex refactor is the brand. Cream backgrounds, gold celebratory accents, bold sans-serif type. (See `design_handoff_pocket_dex/` for tokens.)
- Dark mode deferred until light mode settles (see CLAUDE.md).

---

## 11. Success Criteria

We will know PocketBirds is working when, in 6–12 months, **all four of the following are true**:

1. **Alex and Victoria use it every walk, naturally.** Sustained personal use without reminders. It's part of how we go outside.
2. **5–20 real friends are actively using it.** Each is logging sightings, reacting to friends' posts, and — critically — at least a few have invited their own friends in (organic spread).
3. **At least one non-birder friend has said "I see birds differently now."** Qualitative evidence that the product changed someone's relationship to the outdoors.
4. **The project is sustainable on side-project bandwidth.** Push notifications stay reliable, builds keep shipping (Android Play Store + iOS TestFlight), the codebase doesn't rot, and Alex is not burnt out.

We are **not** measuring DAU, retention curves, viral coefficients, or session length. Those metrics belong to a different product.

---

## 12. Guidance for AI Coding Agents

If you are an AI coding agent reading this to scope or implement a feature, here are the load-bearing instructions:

1. **When in doubt, defer to the principles in §4.** If a feature spec is ambiguous or under-specified, re-derive the answer from the principles rather than guessing or adding features. If the principles don't resolve it, ask Alex.

2. **CLAUDE.md is the operational truth.** This PRD is the *why*; CLAUDE.md is the *what's currently true* (file layout, push notification setup, build commands, current backlog, in-flight design work). Always cross-reference both. If they disagree, CLAUDE.md is more up to date for tactical facts; this doc wins on questions of product direction.

3. **Leaderboards are friend-scoped only.** Friend-scoped rankings are in scope (see §7). Do not build global, city-wide, or "people near you" rankings. Do not surface rank changes as push notifications. When in doubt, default to less prominent placement, not more.

4. **Don't gate features behind a photo.** Sightings without photos are first-class. Build flows that work cleanly photo-less unless the entire feature is about photos.

5. **Push notifications are the magic moment.** Anything that touches the push pipeline needs care. Follow the layer-by-layer debugging methodology in CLAUDE.md before changing any code in that path.

6. **Friends-only is non-negotiable.** Do not build flows that make sightings visible beyond mutual friends. Do not build "share publicly" affordances unless explicitly scoped with Alex first.

7. **Performance: bird-name search is on a hot path.** Use `birdNamesAlpha` / `birdNamesAlphaLower` from `constants/`, follow the tiered early-exit pattern in `add.tsx`. Do not iterate the full 11k list per keystroke.

8. **Brand voice when writing UI copy.** Cheeky about the app, warm about the user, respectful about the birds. When in doubt, read existing copy and match the register.

---

## 13. Open Questions

Captured uncertainty — to resolve in future sessions, not blocking.

- **Avatar UI specifics.** Confirmed: optional profile photo with initials fallback. Visual design of the avatar component (size, border treatment, where it appears in cards) is TBD.
- **Future bird ID assist.** Out of scope now. When/if added, design must not undercut the "we are not Merlin" positioning — it should feel like a small helper, not a primary feature.
- **eBird interoperability.** Not planned, but worth a deliberate decision later. Could be: "export my sightings to eBird as a CSV" — one-way, user-initiated, never automatic.
- **Family-level achievements vs. species-level.** The Goodreads goal handles top-line motivation. Whether we *also* add family-level badges ("seen your first owl") as a parallel surface is open — likely yes, but design TBD.
- **What gets shared when a friend joins.** When User B accepts User A's invite, does B see *all* of A's history, just recent, or just future? Default leaning: just future + the most recent few, to avoid an overwhelming first-feed experience.

---

*This is a living document. Update it deliberately. If a decision here turns out to be wrong, change it — but record the reasoning in a commit message so future-Claude and future-Alex can trace the why.*
