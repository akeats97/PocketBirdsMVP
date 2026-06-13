/**
 * One-time backfill: stamp `identifiedByUsername` onto sightings that were
 * resolved by a community proposal BEFORE that field was denormalized at accept
 * time (WORK_QUEUE Q-9). Without it the "ID'd by @username" credit line can't
 * render for those older sightings.
 *
 * For each sighting with identifiedVia == 'community' and no identifiedByUsername,
 * the username is resolved from the ACCEPTED proposal (sightings/{id}/proposals
 * where accepted == true) — the same source the live accept code stamps — and
 * falls back to the current users/{identifiedBy}.username if no accepted proposal
 * is found. Idempotent: skips docs that already carry the field; re-running
 * converges. Only writes the one field; touches nothing else.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillIdentifiedByUsername.js          # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillIdentifiedByUsername.js --commit # write
 */

const admin = require('firebase-admin');

const COMMIT = process.argv.includes('--commit');

(async () => {
  admin.initializeApp();
  const db = admin.firestore();

  console.log(`\n=== identifiedByUsername backfill (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  // uid -> current username, for the fallback + readable output.
  const usersSnap = await db.collection('users').get();
  const usernameOf = new Map();
  usersSnap.forEach((u) => usernameOf.set(u.id, u.data().username || ''));

  const snap = await db.collection('sightings').get();
  console.log(`Read ${snap.size} sighting docs.\n`);

  const candidates = snap.docs.filter((d) => {
    const data = d.data();
    return data.identifiedVia === 'community' && !data.identifiedByUsername;
  });
  console.log(`Community-identified sightings missing identifiedByUsername: ${candidates.length}\n`);

  const toWrite = []; // { id, birdName, username, source }
  const skipped = []; // { id, birdName, reason }

  for (const d of candidates) {
    const data = d.data();
    const uid = data.identifiedBy;

    // Preferred: the accepted proposal's denormalized username (accept-time truth).
    let username = '';
    let source = '';
    const accepted = await d.ref
      .collection('proposals')
      .where('accepted', '==', true)
      .limit(1)
      .get();
    if (!accepted.empty) {
      username = accepted.docs[0].data().username || '';
      source = 'accepted-proposal';
    }
    // Fallback: the identifier's current username.
    if (!username && uid && usernameOf.has(uid)) {
      username = usernameOf.get(uid);
      source = 'user-doc';
    }

    if (username) {
      toWrite.push({ id: d.id, birdName: data.birdName, username, source });
    } else {
      skipped.push({ id: d.id, birdName: data.birdName, reason: uid ? 'no username found' : 'no identifiedBy' });
    }
  }

  console.log(`Will SET identifiedByUsername on ${toWrite.length} doc(s):`);
  toWrite.forEach((w) => console.log(`  + ${w.birdName}  →  @${w.username}  (${w.source})`));
  if (skipped.length) {
    console.log(`\nSKIPPED ${skipped.length} doc(s) (no resolvable username):`);
    skipped.forEach((s) => console.log(`  - ${s.birdName} [${s.id}]: ${s.reason}`));
  }

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.\n');
    process.exit(0);
  }

  let written = 0;
  for (let i = 0; i < toWrite.length; i += 400) {
    const batch = db.batch();
    for (const w of toWrite.slice(i, i + 400)) {
      batch.update(db.collection('sightings').doc(w.id), { identifiedByUsername: w.username });
    }
    await batch.commit();
    written += Math.min(400, toWrite.length - i);
    console.log(`Committed ${written}/${toWrite.length}…`);
  }
  console.log(`\nDONE. Set identifiedByUsername on ${toWrite.length} doc(s).\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
