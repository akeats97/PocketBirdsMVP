/**
 * One-time backfill: reconcile the denormalized social counters against the
 * ground-truth subcollections. Fixes counts that drifted while the triggers
 * used FieldValue.increment (a single missed/pre-deploy event desynced them by
 * one), e.g. a sighting showing "1 hoot" on the card but 3 docs in its hoots
 * subcollection.
 *
 * Per sighting it recomputes:
 *   - hootCount      = number of docs in sightings/{id}/hoots
 *   - recentHooters  = last 3 hooters (newest first)
 *   - commentCount   = number of docs in sightings/{id}/comments
 *   - per comment: hootCount = number of docs in .../comments/{cid}/hoots
 *
 * Only writes docs whose stored value actually differs, so it's idempotent and
 * cheap on a second run. After the trigger fix is deployed this drift can't
 * recur; this just repairs the historical backlog.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillSocialCounts.js          # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node backfillSocialCounts.js --commit # write
 */

const admin = require('firebase-admin');

const COMMIT = process.argv.includes('--commit');

async function recentHootersFor(ref) {
  const snap = await ref.collection('hoots').orderBy('createdAt', 'desc').limit(3).get();
  return snap.docs.map((d) => ({ uid: d.data().uid, username: d.data().username }));
}

// Shallow-equal the recentHooters arrays (order matters, uid identifies entry).
function sameHooters(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x, i) => x.uid === b[i].uid && x.username === b[i].username);
}

(async () => {
  admin.initializeApp();
  const db = admin.firestore();

  console.log(`\n=== Social-count backfill (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  const snap = await db.collection('sightings').get();
  console.log(`Read ${snap.size} sighting docs.\n`);

  const updates = []; // { ref, fields, before, after, label }
  let hootFixes = 0;
  let commentFixes = 0;
  let commentHootFixes = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const ref = doc.ref;

    // --- sighting hootCount + recentHooters ---
    const hootCount = (await ref.collection('hoots').count().get()).data().count;
    const recentHooters = await recentHootersFor(ref);
    const fields = {};
    if ((data.hootCount ?? 0) !== hootCount) {
      fields.hootCount = hootCount;
      hootFixes += 1;
    }
    if (!sameHooters(data.recentHooters ?? [], recentHooters)) {
      fields.recentHooters = recentHooters;
    }

    // --- sighting commentCount ---
    const commentsSnap = await ref.collection('comments').get();
    const commentCount = commentsSnap.size;
    if ((data.commentCount ?? 0) !== commentCount) {
      fields.commentCount = commentCount;
      commentFixes += 1;
    }

    if (Object.keys(fields).length > 0) {
      updates.push({ ref, fields, label: `${data.birdName} (${doc.id})` });
    }

    // --- per-comment hootCount ---
    for (const c of commentsSnap.docs) {
      const cHoots = (await c.ref.collection('hoots').count().get()).data().count;
      if ((c.data().hootCount ?? 0) !== cHoots) {
        updates.push({ ref: c.ref, fields: { hootCount: cHoots }, label: `comment ${c.id} on ${data.birdName}` });
        commentHootFixes += 1;
      }
    }
  }

  console.log(`Drifted sighting hootCounts: ${hootFixes}`);
  console.log(`Drifted sighting commentCounts: ${commentFixes}`);
  console.log(`Drifted comment hootCounts: ${commentHootFixes}`);
  console.log(`Total docs to update (incl. recentHooters refreshes): ${updates.length}\n`);

  updates.slice(0, 25).forEach((u) => {
    const f = Object.entries(u.fields)
      .map(([k, v]) => (k === 'recentHooters' ? `${k}=[${v.length}]` : `${k}=${v}`))
      .join(', ');
    console.log(`  • ${u.label}: ${f}`);
  });
  if (updates.length > 25) console.log(`  …and ${updates.length - 25} more`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.\n');
    process.exit(0);
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + 400)) batch.update(u.ref, u.fields);
    await batch.commit();
    written += Math.min(400, updates.length - i);
    console.log(`Committed ${written}/${updates.length}…`);
  }
  console.log(`\nDONE. Updated ${updates.length} doc(s).\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
