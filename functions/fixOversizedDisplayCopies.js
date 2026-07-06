/**
 * Corrective pass for backfillDisplayPhotos: where the display copy came out
 * LARGER than the original (re-encoding an already-small jpeg at q85 inflates
 * it), repoint photoUrl back to the original and delete the display object.
 * photoUrlOriginal stays as the processed-marker so the backfill won't redo
 * them. Idempotent.
 *
 *   node fixOversizedDisplayCopies.js            # dry run
 *   node fixOversizedDisplayCopies.js --commit   # write
 */

const admin = require('firebase-admin');

const COMMIT = process.argv.includes('--commit');
const BUCKET = 'pocketbirds.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'pocketbirds',
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

function storagePathFromUrl(url) {
  const m = url.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

(async () => {
  const snap = await db.collection('sightings').get();
  let reverted = 0, kept = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    // Only docs the backfill repointed (photoUrl on display/, original kept).
    if (!d.photoUrlOriginal || !d.photoUrl?.includes('%2Fdisplay%2F')) continue;
    const displayPath = storagePathFromUrl(d.photoUrl);
    const originalPath = storagePathFromUrl(d.photoUrlOriginal);
    if (!displayPath || !originalPath) continue;
    try {
      const [dm] = await bucket.file(displayPath).getMetadata();
      const [om] = await bucket.file(originalPath).getMetadata();
      const dSize = Number(dm.size), oSize = Number(om.size);
      if (dSize < oSize) { kept++; continue; }
      if (COMMIT) {
        await doc.ref.update({ photoUrl: d.photoUrlOriginal });
        await bucket.file(displayPath).delete();
      }
      reverted++;
      console.log(`${COMMIT ? 'REVERTED' : 'DRY'} ${doc.id} (${d.birdName}): display ${(dSize / 1024).toFixed(0)}KB >= original ${(oSize / 1024).toFixed(0)}KB`);
    } catch (err) {
      console.error(`FAIL ${doc.id}:`, err.message);
    }
  }
  console.log(`\n${COMMIT ? 'COMMITTED' : 'DRY RUN'}: ${reverted} reverted to original, ${kept} kept on display copies.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
