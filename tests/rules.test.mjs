// Firestore rules tests (run against the emulator):
//   firebase emulators:exec --only firestore "node tests/rules.test.mjs"
//
// Covers the PL-2 moderation additions (blocked lists, canEngage block check,
// reports, admin soft-hide) plus the pre-existing assertions those changes
// could have regressed (owner writes, engagement gating, admin verify).
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const ALEX = 'ZerkNpeAERSwmptlrPeboR5TASs2'; // admin allowlist [0]
const OWNER = 'owner-uid';
const FRIEND = 'friend-uid'; // follows OWNER
const STRANGER = 'stranger-uid';

let passed = 0;
const check = async (label, promise) => {
  await promise.then(
    () => {
      passed++;
      console.log(`  ok - ${label}`);
    },
    (err) => {
      console.error(`FAIL - ${label}: ${err?.message ?? err}`);
      process.exitCode = 1;
    }
  );
};

const env = await initializeTestEnvironment({
  projectId: 'pocketbirds-rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});

// Seed: OWNER has a sighting; FRIEND follows OWNER.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'sightings/s1'), { userId: OWNER, birdName: 'Sand Martin' });
  await setDoc(doc(db, `following/${FRIEND}/following/${OWNER}`), { timestamp: 1 });
});

const asOwner = env.authenticatedContext(OWNER).firestore();
const asFriend = env.authenticatedContext(FRIEND).firestore();
const asStranger = env.authenticatedContext(STRANGER).firestore();
const asAdmin = env.authenticatedContext(ALEX).firestore();

console.log('blocked lists:');
await check('owner writes own blocked doc',
  assertSucceeds(setDoc(doc(asOwner, `users/${OWNER}/blocked/${FRIEND}`), { createdAt: 1 })));
await check('other user cannot read your blocked list',
  assertFails(getDoc(doc(asFriend, `users/${OWNER}/blocked/${FRIEND}`))));
await check('other user cannot write your blocked list',
  assertFails(setDoc(doc(asFriend, `users/${OWNER}/blocked/${STRANGER}`), { createdAt: 1 })));
await check('owner unblocks (deletes own blocked doc)',
  assertSucceeds(deleteDoc(doc(asOwner, `users/${OWNER}/blocked/${FRIEND}`))));

console.log('canEngage with blocks:');
await check('follower hoots when not blocked',
  assertSucceeds(setDoc(doc(asFriend, `sightings/s1/hoots/${FRIEND}`), { uid: FRIEND })));
await env.withSecurityRulesDisabled(async (ctx) => {
  await deleteDoc(doc(ctx.firestore(), `sightings/s1/hoots/${FRIEND}`));
  await setDoc(doc(ctx.firestore(), `users/${OWNER}/blocked/${FRIEND}`), { createdAt: 1 });
});
await check('BLOCKED follower cannot hoot',
  assertFails(setDoc(doc(asFriend, `sightings/s1/hoots/${FRIEND}`), { uid: FRIEND })));
await check('BLOCKED follower cannot comment',
  assertFails(setDoc(doc(asFriend, 'sightings/s1/comments/c1'), { uid: FRIEND, text: 'nice' })));
await check('BLOCKED follower cannot propose',
  assertFails(setDoc(doc(asFriend, 'sightings/s1/proposals/p1'), { uid: FRIEND, species: 'Rock Dove', hootCount: 0 })));
await check('owner still engages on own sighting while blocking others',
  assertSucceeds(setDoc(doc(asOwner, 'sightings/s1/comments/c2'), { uid: OWNER, text: 'mine' })));
await check('non-following stranger still cannot hoot',
  assertFails(setDoc(doc(asStranger, `sightings/s1/hoots/${STRANGER}`), { uid: STRANGER })));

console.log('reports:');
await check('signed-in user files a report about a user',
  assertSucceeds(setDoc(doc(asFriend, 'reports/r1'), {
    reporter: FRIEND, targetType: 'user', targetId: OWNER, reason: 'Spam', createdAt: 1,
  })));
await check('report with forged reporter denied',
  assertFails(setDoc(doc(asFriend, 'reports/r2'), {
    reporter: OWNER, targetType: 'user', targetId: OWNER, reason: 'Spam', createdAt: 1,
  })));
await check('report with bogus targetType denied',
  assertFails(setDoc(doc(asFriend, 'reports/r3'), {
    reporter: FRIEND, targetType: 'vibes', targetId: OWNER, reason: 'Spam', createdAt: 1,
  })));
await check('reporter cannot read reports',
  assertFails(getDoc(doc(asFriend, 'reports/r1'))));
await check('admin reads reports',
  assertSucceeds(getDoc(doc(asAdmin, 'reports/r1'))));
await check('admin deletes reports',
  assertSucceeds(deleteDoc(doc(asAdmin, 'reports/r1'))));

console.log('soft-hide + verify fields:');
await check('admin sets hidden on any sighting',
  assertSucceeds(updateDoc(doc(asAdmin, 'sightings/s1'), { hidden: true })));
await check('owner cannot unhide own sighting',
  assertFails(updateDoc(doc(asOwner, 'sightings/s1'), { hidden: false })));
await check('owner still edits own sighting fields',
  assertSucceeds(updateDoc(doc(asOwner, 'sightings/s1'), { notes: 'updated' })));
await check('owner still cannot self-verify',
  assertFails(updateDoc(doc(asOwner, 'sightings/s1'), { verified: true })));
await check('admin verify still works',
  assertSucceeds(updateDoc(doc(asAdmin, 'sightings/s1'), { verified: true, verifiedBy: ALEX, verifiedAt: 1 })));
await check('admin cannot edit species',
  assertFails(updateDoc(doc(asAdmin, 'sightings/s1'), { birdName: 'Kelsey' })));

await env.cleanup();
console.log(`\n${passed} assertions passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
