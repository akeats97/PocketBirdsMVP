/**
 * One-time backfill: for every species, the EARLIEST sighting across all
 * PocketBirds users gets `globalFirst: true` (so the Dex / profile gold color
 * applies retroactively). No notifications are sent — this only flips a flag.
 *
 * Excludes Bug Report / Feature Request / Mystery Bird / custom species (Kelsey),
 * mirroring the app's species rules. Idempotent: re-running converges to the
 * same state. Also CLEARS any stray globalFirst flags on non-earliest docs.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillGlobalFirst.js          # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillGlobalFirst.js --commit # write
 */

const admin = require('firebase-admin');

const COMMIT = process.argv.includes('--commit');

const REPORT_TYPES = new Set(['Bug Report', 'Feature Request']);
const UNKNOWN_BIRD = 'mystery bird';
const CUSTOM_SPECIES = new Set(['kelsey']);

function isCountable(name) {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  if (REPORT_TYPES.has(name)) return false;
  if (lower === UNKNOWN_BIRD) return false;
  if (CUSTOM_SPECIES.has(lower)) return false;
  return true;
}

// "First in the app" = when the log was INPUT into PocketBirds (doc creation),
// not the observation date. Prefer createdAt; fall back to lastModified (also
// stamped at creation) then date for older docs that predate createdAt.
function ts(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}
function inputMillis(data) {
  return ts(data.createdAt) ?? ts(data.lastModified) ?? ts(data.date) ?? Infinity;
}

(async () => {
  admin.initializeApp();
  const db = admin.firestore();

  console.log(`\n=== Global-first backfill (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  // uid -> username, for readable output.
  const usersSnap = await db.collection('users').get();
  const usernameOf = new Map();
  usersSnap.forEach((u) => usernameOf.set(u.id, u.data().username || u.id));
  const nameOfUser = (uid) => usernameOf.get(uid) || uid || '(unknown)';

  const snap = await db.collection('sightings').get();
  let missingCreatedAt = 0;
  console.log(`Read ${snap.size} sighting docs.\n`);

  // species key -> { winnerId, winnerMillis, winnerName, winnerUser, flaggedIds:[] }
  const species = new Map();

  snap.forEach((doc) => {
    const data = doc.data();
    if (!isCountable(data.birdName)) return;
    if (ts(data.createdAt) === null) missingCreatedAt += 1;
    const key = data.birdName.trim().toLowerCase();
    const ms = inputMillis(data);
    let rec = species.get(key);
    if (!rec) {
      rec = { winnerId: null, winnerMillis: Infinity, winnerName: data.birdName, winnerUser: null, flaggedIds: [] };
      species.set(key, rec);
    }
    if (data.globalFirst === true) rec.flaggedIds.push(doc.id);
    if (ms < rec.winnerMillis) {
      rec.winnerMillis = ms;
      rec.winnerId = doc.id;
      rec.winnerName = data.birdName;
      rec.winnerUser = data.userId;
    }
  });

  const toSet = []; // docs that should become globalFirst=true
  const toClear = []; // docs that currently have globalFirst=true but shouldn't

  for (const [, rec] of species) {
    if (rec.winnerId) {
      const winnerAlready = rec.flaggedIds.includes(rec.winnerId);
      if (!winnerAlready) toSet.push({ id: rec.winnerId, name: rec.winnerName, user: rec.winnerUser });
    }
    for (const id of rec.flaggedIds) {
      if (id !== rec.winnerId) toClear.push({ id, name: rec.winnerName });
    }
  }

  console.log(`Distinct countable species: ${species.size}`);
  console.log(`Docs missing createdAt (used lastModified/date fallback): ${missingCreatedAt}\n`);

  // Winners per account (every species' first-in-app logger).
  const perUser = new Map();
  for (const [, rec] of species) {
    if (!rec.winnerId) continue;
    const u = nameOfUser(rec.winnerUser);
    perUser.set(u, (perUser.get(u) || 0) + 1);
  }
  console.log('Global-first winners per account:');
  [...perUser.entries()].sort((a, b) => b[1] - a[1]).forEach(([u, n]) => console.log(`  ${u}: ${n}`));

  // Spot-check Hooded Oriole.
  const ho = species.get('hooded oriole');
  if (ho) console.log(`\nHooded Oriole first-in-app: ${nameOfUser(ho.winnerUser)} (doc ${ho.winnerId})`);
  else console.log('\nHooded Oriole: not found among countable species.');

  console.log(`\nWill SET globalFirst on ${toSet.length} doc(s) (sample):`);
  toSet.slice(0, 20).forEach((d) => console.log(`  + ${d.name}  →  ${nameOfUser(d.user)}`));
  if (toSet.length > 20) console.log(`  …and ${toSet.length - 20} more`);
  console.log(`Will CLEAR stray globalFirst on ${toClear.length} doc(s).`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.\n');
    process.exit(0);
  }

  // Commit in batches of 400 (Firestore limit is 500 ops/batch).
  const ops = [
    ...toSet.map((d) => ({ id: d.id, value: true })),
    ...toClear.map((d) => ({ id: d.id, value: admin.firestore.FieldValue.delete() })),
  ];
  let written = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      batch.update(db.collection('sightings').doc(op.id), { globalFirst: op.value });
    }
    await batch.commit();
    written += Math.min(400, ops.length - i);
    console.log(`Committed ${written}/${ops.length}…`);
  }
  console.log(`\nDONE. Set ${toSet.length}, cleared ${toClear.length}.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
