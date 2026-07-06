/**
 * One-time backfill for the two-copy photo scheme (Jul 2026).
 *
 * For every sighting doc whose photoUrl still points at an original under
 * sightings/{file}: create a compressed display copy (2048px longest edge,
 * JPEG q85, EXIF orientation baked in) at sightings/display/{docId}.jpg, then
 * repoint the doc: photoUrl -> display copy, photoUrlOriginal -> the original.
 *
 * ORIGINALS ARE NEVER MODIFIED OR DELETED. Fully reversible: repoint photoUrl
 * back to photoUrlOriginal and delete the display folder. Idempotent: docs
 * whose photoUrl already targets display/ (or that carry photoUrlOriginal)
 * are skipped, so re-running converges.
 *
 * Usage (from functions/, needs `npm i -D sharp` and gcloud ADC or
 * GOOGLE_APPLICATION_CREDENTIALS):
 *   node backfillDisplayPhotos.js            # dry run: reports what it would do
 *   node backfillDisplayPhotos.js --commit   # actually writes
 */

const crypto = require('crypto');
const admin = require('firebase-admin');
const sharp = require('sharp');

const COMMIT = process.argv.includes('--commit');
const BUCKET = 'pocketbirds.firebasestorage.app';
const MAX_EDGE = 2048;
const JPEG_QUALITY = 85;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'pocketbirds',
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Storage object path from a tokenized download URL:
// .../o/sightings%2Fabc.jpg?alt=media&token=... -> sightings/abc.jpg
function storagePathFromUrl(url) {
  const m = url.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function displayUrl(docId, token) {
  const path = encodeURIComponent(`sightings/display/${docId}.jpg`);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${path}?alt=media&token=${token}`;
}

(async () => {
  const snap = await db.collection('sightings').get();
  const candidates = [];
  let alreadyDone = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.photoUrl) continue;
    if (d.photoUrlOriginal || d.photoUrl.includes('%2Fdisplay%2F')) { alreadyDone++; continue; }
    const path = storagePathFromUrl(d.photoUrl);
    if (!path) { console.warn(`SKIP ${doc.id}: unparseable photoUrl`); continue; }
    candidates.push({ id: doc.id, ref: doc.ref, bird: d.birdName, photoUrl: d.photoUrl, path });
  }

  console.log(`${snap.size} sightings; ${candidates.length} to backfill; ${alreadyDone} already on display copies.`);

  let totalOrig = 0, totalNew = 0, failed = 0;
  for (const c of candidates) {
    const file = bucket.file(c.path);
    try {
      const [exists] = await file.exists();
      if (!exists) { console.warn(`MISSING ${c.id} (${c.bird}): ${c.path}`); failed++; continue; }
      const [meta] = await file.getMetadata();
      const origBytes = Number(meta.size);
      totalOrig += origBytes;

      if (!COMMIT) {
        console.log(`DRY ${c.id} (${c.bird}): ${(origBytes / 1048576).toFixed(2)}MB original -> would create display copy`);
        continue;
      }

      const [buf] = await file.download();
      // .rotate() bakes EXIF orientation into the pixels — the re-encode drops
      // the orientation tag, so without this, phone photos render sideways.
      const out = await sharp(buf)
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
      totalNew += out.length;

      const token = crypto.randomUUID();
      await bucket.file(`sightings/display/${c.id}.jpg`).save(out, {
        contentType: 'image/jpeg',
        metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      });
      await c.ref.update({
        photoUrl: displayUrl(c.id, token),
        photoUrlOriginal: c.photoUrl,
      });
      console.log(`OK ${c.id} (${c.bird}): ${(origBytes / 1048576).toFixed(2)}MB -> ${(out.length / 1024).toFixed(0)}KB`);
    } catch (err) {
      console.error(`FAIL ${c.id} (${c.bird}):`, err.message);
      failed++;
    }
  }

  console.log(`\n${COMMIT ? 'COMMITTED' : 'DRY RUN'}: ${candidates.length - failed}/${candidates.length} photos, ` +
    `${(totalOrig / 1048576).toFixed(1)}MB originals${COMMIT ? ` -> ${(totalNew / 1048576).toFixed(1)}MB display copies` : ''}, ${failed} failed/missing.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
