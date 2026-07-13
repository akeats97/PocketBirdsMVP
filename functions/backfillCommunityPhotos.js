/**
 * One-time backfill: seed the `communityPhotos/{sightingId}` projection (PL-1)
 * from every existing photographed sighting whose owner is PUBLIC (isPublic
 * absent or true). Only public-safe fields are projected — never notes, never
 * GPS coordinates. After this runs once, the onSightingWriteCommunityPhoto /
 * onUserWriteCommunityPhotos triggers keep it current.
 *
 * Idempotent: re-running converges to the same state. Also DELETES projection
 * docs that shouldn't exist (private owner, photo removed, hidden, report
 * entries), so it doubles as a repair tool.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillCommunityPhotos.js          # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillCommunityPhotos.js --commit # write
 */

const admin = require('firebase-admin');

const COMMIT = process.argv.includes('--commit');

// Keep in sync with communityEligible / communityProjection in index.js.
const EXCLUDED_SPECIES = new Set(['Bug Report', 'Feature Request']);

function eligible(data) {
  return !!data.photoUrl
    && !!data.userId
    && !!data.birdName
    && !EXCLUDED_SPECIES.has(data.birdName)
    && data.hidden !== true;
}

function projection(data, username) {
  return {
    species: data.birdName,
    photoUrl: data.photoUrl,
    uid: data.userId,
    username: username || '',
    location: data.location || '',
    date: data.date || null,
    createdAt: data.createdAt || null,
  };
}

(async () => {
  admin.initializeApp();
  const db = admin.firestore();

  console.log(`\n=== communityPhotos backfill (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  // uid -> { username, isPublic }
  const usersSnap = await db.collection('users').get();
  const users = new Map();
  usersSnap.forEach((u) => {
    const d = u.data();
    users.set(u.id, { username: d.username || '', isPublic: d.isPublic !== false });
  });
  console.log(`Read ${users.size} user docs (${[...users.values()].filter(u => !u.isPublic).length} private).`);

  const sightingsSnap = await db.collection('sightings').get();
  console.log(`Read ${sightingsSnap.size} sighting docs.`);

  // What the projection SHOULD contain.
  const wanted = new Map(); // sightingId -> projection
  sightingsSnap.forEach((doc) => {
    const data = doc.data();
    if (!eligible(data)) return;
    const owner = users.get(data.userId);
    if (!owner || !owner.isPublic) return;
    wanted.set(doc.id, projection(data, owner.username));
  });

  // What it currently contains.
  const existingSnap = await db.collection('communityPhotos').get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`Existing projection docs: ${existingIds.size}. Target: ${wanted.size}.\n`);

  const toDelete = [...existingIds].filter((id) => !wanted.has(id));

  // Per-species summary of the target state.
  const perSpecies = new Map();
  for (const [, p] of wanted) perSpecies.set(p.species, (perSpecies.get(p.species) || 0) + 1);
  console.log('Target gallery sizes (top 15):');
  [...perSpecies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([sp, n]) => console.log(`  ${sp}: ${n}`));

  console.log(`\nWill WRITE ${wanted.size} projection doc(s) and DELETE ${toDelete.length} stray(s).`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.\n');
    process.exit(0);
  }

  const ops = [
    ...[...wanted.entries()].map(([id, p]) => ({ id, set: p })),
    ...toDelete.map((id) => ({ id, set: null })),
  ];
  let written = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      const ref = db.collection('communityPhotos').doc(op.id);
      if (op.set) batch.set(ref, op.set);
      else batch.delete(ref);
    }
    await batch.commit();
    written += Math.min(400, ops.length - i);
    console.log(`Committed ${written}/${ops.length}…`);
  }
  console.log(`\nDONE. Wrote ${wanted.size}, deleted ${toDelete.length}.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
