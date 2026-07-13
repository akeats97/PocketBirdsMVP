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
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

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

console.log('profile bio:');
await check('owner sets a short bio',
  assertSucceeds(setDoc(doc(asOwner, `users/${OWNER}`), { username: 'owner', bio: 'chasing a life list of 150' }, { merge: true })));
await check('bio over 80 chars denied',
  assertFails(setDoc(doc(asOwner, `users/${OWNER}`), { bio: 'x'.repeat(81) }, { merge: true })));
await check('non-string bio denied',
  assertFails(setDoc(doc(asOwner, `users/${OWNER}`), { bio: 42 }, { merge: true })));
await check('cannot write someone else\'s bio',
  assertFails(setDoc(doc(asFriend, `users/${OWNER}`), { bio: 'gotcha' }, { merge: true })));

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

// ── PL-1: public-by-default visibility ──────────────────────────────────────
// Fresh uids so the seeds don't interact with the assertions above.
const PUB = 'pub-owner-uid'; // users doc, no isPublic field (the default)
const PRIV = 'priv-owner-uid'; // users doc with isPublic: false
const GHOST = 'ghost-owner-uid'; // sighting but NO users doc (half-deleted account)

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `users/${PUB}`), { username: 'pub' });
  await setDoc(doc(db, `users/${PRIV}`), { username: 'priv', isPublic: false });
  await setDoc(doc(db, 'sightings/pub1'), { userId: PUB, birdName: 'Rock Dove' });
  await setDoc(doc(db, 'sightings/priv1'), { userId: PRIV, birdName: 'Sand Martin' });
  await setDoc(doc(db, 'sightings/ghost1'), { userId: GHOST, birdName: 'Rock Dove' });
  // FRIEND follows PRIV and GHOST (but not PUB — public needs no follow).
  await setDoc(doc(db, `following/${FRIEND}/following/${PRIV}`), { timestamp: 1 });
  await setDoc(doc(db, `following/${FRIEND}/following/${GHOST}`), { timestamp: 1 });
});

console.log('PL-1 sighting visibility (get):');
await check('stranger reads a PUBLIC owner\'s sighting (isPublic absent)',
  assertSucceeds(getDoc(doc(asStranger, 'sightings/pub1'))));
await check('stranger CANNOT read a PRIVATE owner\'s sighting',
  assertFails(getDoc(doc(asStranger, 'sightings/priv1'))));
await check('follower reads a PRIVATE owner\'s sighting',
  assertSucceeds(getDoc(doc(asFriend, 'sightings/priv1'))));
await check('private owner reads their own sighting',
  assertSucceeds(getDoc(doc(env.authenticatedContext(PRIV).firestore(), 'sightings/priv1'))));
await check('admin reads a PRIVATE owner\'s sighting',
  assertSucceeds(getDoc(doc(asAdmin, 'sightings/priv1'))));
await check('stranger CANNOT read a sighting whose owner doc is missing',
  assertFails(getDoc(doc(asStranger, 'sightings/ghost1'))));
await check('follower reads a sighting whose owner doc is missing',
  assertSucceeds(getDoc(doc(asFriend, 'sightings/ghost1'))));

console.log('PL-1 sighting visibility (queries):');
await check('stranger queries a PUBLIC owner\'s sightings (profile view)',
  assertSucceeds(getDocs(query(collection(asStranger, 'sightings'), where('userId', '==', PUB)))));
await check('stranger CANNOT query a PRIVATE owner\'s sightings',
  assertFails(getDocs(query(collection(asStranger, 'sightings'), where('userId', '==', PRIV)))));
await check('follower queries a PRIVATE owner\'s sightings',
  assertSucceeds(getDocs(query(collection(asFriend, 'sightings'), where('userId', '==', PRIV)))));
await check('stranger CANNOT run an app-wide species query (old global-first path)',
  assertFails(getDocs(query(collection(asStranger, 'sightings'), where('birdName', '==', 'Rock Dove')))));
await check('admin still runs an app-wide species query (verify recompute)',
  assertSucceeds(getDocs(query(collection(asAdmin, 'sightings'), where('birdName', '==', 'Rock Dove')))));

// The friend feed is one `in` query over every followed uid (up to Firestore's
// cap of 30). Rules get()/exists() budgets are per-request, so a wide `in`
// against the per-owner lookups above is the riskiest read in the app — probe
// it at full width before trusting it in production.
console.log('PL-1 friend feed (in queries):');
await check('follower feed: in [public, private-followed]',
  assertSucceeds(getDocs(query(collection(asFriend, 'sightings'), where('userId', 'in', [PUB, PRIV])))));
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (let i = 0; i < 28; i++) {
    await setDoc(doc(db, `users/wide-${i}`), { username: `wide${i}`, isPublic: i % 2 === 1 ? false : true });
    await setDoc(doc(db, `sightings/wide-s-${i}`), { userId: `wide-${i}`, birdName: 'Rock Dove' });
    await setDoc(doc(db, `following/${FRIEND}/following/wide-${i}`), { timestamp: 1 });
  }
});
// Rules allow ~20 get/exists lookups per query and an `in` is evaluated per
// uid, so a full-width 30-uid feed query blows the budget (probed Jul 12 2026:
// max 20 all-followed, max 10 when disjuncts fall through to the isPublic
// get). The feed therefore chunks at 10 (FEED_RULES_CHUNK) — safe even if
// every uid in a chunk needed both lookups. These two assertions pin the
// constraint so a rules change that shifts the budget fails loudly here.
const wideUids = [PUB, PRIV, ...Array.from({ length: 28 }, (_, i) => `wide-${i}`)];
await check('follower feed: 30-uid in query still exceeds the rules lookup budget',
  assertFails(getDocs(query(collection(asFriend, 'sightings'), where('userId', 'in', wideUids)))));
await check('follower feed: 10-uid in query (FEED_RULES_CHUNK) passes',
  assertSucceeds(getDocs(query(collection(asFriend, 'sightings'), where('userId', 'in', wideUids.slice(0, 10))))));

console.log('PL-1 isPublic flag writes:');
await check('owner flips their own account private',
  assertSucceeds(setDoc(doc(env.authenticatedContext(PUB).firestore(), `users/${PUB}`), { isPublic: false }, { merge: true })));
await check('non-boolean isPublic denied',
  assertFails(setDoc(doc(env.authenticatedContext(PUB).firestore(), `users/${PUB}`), { isPublic: 'yes' }, { merge: true })));
await check('cannot flip someone else\'s visibility',
  assertFails(setDoc(doc(asStranger, `users/${PUB}`), { isPublic: true }, { merge: true })));
// PUB is private now — re-check the read flips with it.
await check('stranger loses read access after the owner goes private',
  assertFails(getDoc(doc(asStranger, 'sightings/pub1'))));

console.log('PL-1 communityPhotos projection:');
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'communityPhotos/pub1'), {
    species: 'Rock Dove', photoUrl: 'https://x/y.jpg', uid: PUB, username: 'pub',
  });
});
await check('signed-in user reads the community gallery',
  assertSucceeds(getDocs(query(collection(asStranger, 'communityPhotos'), where('species', '==', 'Rock Dove')))));
await check('client cannot write a communityPhotos doc',
  assertFails(setDoc(doc(asStranger, 'communityPhotos/forged'), { species: 'Kelsey', photoUrl: 'https://x/z.jpg', uid: STRANGER })));
await check('client cannot delete a communityPhotos doc',
  assertFails(deleteDoc(doc(asStranger, 'communityPhotos/pub1'))));

await env.cleanup();
console.log(`\n${passed} assertions passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
