/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const {onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const { FieldValue } = require('firebase-admin/firestore');

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();

const expo = new Expo();

// ---------------------------------------------------------------------------
// PL-7 push reliability. Expo acks a send with TICKETS ("accepted for
// processing"); real delivery failures (dead token, FCM rejection) only
// surface later in RECEIPTS. We previously never read receipts, so a dead
// token failed invisibly forever (the Q-6 silent drops). Every send now goes
// through sendExpoPush, which (a) acts on send-time ticket errors, and
// (b) persists ticket ids to `pushTickets` for the scheduled receipt check.
// `pushTickets` is server-only: no client code or rules path touches it.
// ---------------------------------------------------------------------------

// Remove a user's push token once Expo says the device is gone, so we stop
// sending into the void and the log noise points at real problems. Guarded:
// only clears if the stored token is still the dead one, so a fresh token from
// a reinstall is never collateral damage.
async function clearDeadPushToken(uid, token, source) {
  if (!uid || !token) return;
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    const snap = await userRef.get();
    if (snap.exists && snap.data().expoPushToken === token) {
      await userRef.update({ expoPushToken: FieldValue.delete() });
      console.log(`Cleared dead push token for ${uid} (${source})`);
    }
  } catch (error) {
    console.error(`Failed clearing dead token for ${uid}:`, error);
  }
}

// Send push messages and persist the resulting ticket ids for receipt
// checking. `targets` is parallel to `messages`: [{ token, uid }]; the uid is
// what lets a DeviceNotRegistered verdict clear the right user's token.
async function sendExpoPush(messages, targets, context) {
  const ticketRecords = [];
  let cursor = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log(`Push tickets (${context}):`, JSON.stringify(tickets));
      tickets.forEach((ticket, i) => {
        const target = targets[cursor + i] || {};
        if (ticket.status === 'error') {
          console.error(
            `Push send REJECTED (${context}) uid=${target.uid}:`,
            ticket.message, ticket.details && ticket.details.error
          );
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            clearDeadPushToken(target.uid, target.token, `send ticket, ${context}`);
          }
        } else if (ticket.id) {
          ticketRecords.push({ id: ticket.id, uid: target.uid || null, token: target.token || null });
        }
      });
    } catch (error) {
      console.error(`Error sending push chunk (${context}):`, error);
    }
    cursor += chunk.length;
  }
  if (ticketRecords.length === 0) return;
  try {
    await admin.firestore().collection('pushTickets').add({
      context,
      tickets: ticketRecords,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to persist push tickets (receipts will go unchecked):', error);
  }
}

// Poll Expo for receipts on recent tickets. Receipts appear within ~15 minutes
// and are retained about a day, so: skip docs younger than 10 minutes, retry
// docs whose receipts haven't all arrived, and give up (loudly) at 26 hours:
// a ticket that never got a receipt is itself the smoking gun for a drop.
exports.checkPushReceipts = onSchedule('every 15 minutes', async () => {
  const snap = await admin.firestore()
    .collection('pushTickets')
    .orderBy('createdAt', 'asc')
    .limit(50)
    .get();
  if (snap.empty) return;

  for (const doc of snap.docs) {
    const data = doc.data();
    const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().getTime() : 0;
    const ageMs = Date.now() - createdAt;
    if (ageMs < 10 * 60 * 1000) continue;

    const byId = new Map((data.tickets || []).map(t => [t.id, t]));
    let received = 0;
    try {
      for (const chunk of expo.chunkPushNotificationReceiptIds([...byId.keys()])) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [id, receipt] of Object.entries(receipts)) {
          received++;
          if (receipt.status === 'ok') continue;
          const target = byId.get(id) || {};
          console.error(
            `Push receipt ERROR (${data.context}) uid=${target.uid}:`,
            receipt.message, receipt.details && receipt.details.error
          );
          if (receipt.details && receipt.details.error === 'DeviceNotRegistered') {
            await clearDeadPushToken(target.uid, target.token, `receipt, ${data.context}`);
          }
        }
      }
    } catch (error) {
      console.error('Receipt fetch failed for', doc.id, error);
      continue; // transient; retry on the next run until the 26h cutoff below
    }

    if (received >= byId.size) {
      await doc.ref.delete();
    } else if (ageMs > 26 * 60 * 60 * 1000) {
      console.error(
        `Push receipts NEVER ARRIVED (${data.context}): ${byId.size - received} of ${byId.size} ` +
        `tickets unresolved after 26h; these sends were silently dropped.`
      );
      await doc.ref.delete();
    }
    // else: some receipts still pending; keep the doc for the next run.
  }
});

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Fan a sighting out to the poster's followers as a push notification,
// respecting each follower's per-friend notificationPrefs (all / highlights /
// none). A "highlight" is a new species for the poster or a milestone save.
// Shared by onSightingAdded (on create) and onSightingUpdated (when an edit
// turns a sighting into a new species). `isNewSpecies` / `milestone` are passed
// in by the caller, which knows how to compute them for its trigger.
async function notifyFollowersOfSighting(sightingId, sighting, isNewSpecies, milestone) {
  // Get the user who owns the sighting
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(sighting.userId)
    .get();

  if (!userDoc.exists) {
    console.log('User not found:', sighting.userId);
    return;
  }

  const userData = userDoc.data();
  const username = userData.username || 'A friend';

  console.log(`Looking for followers of: ${username} (${sighting.userId})`);

  // Get all users who follow this person.
  // Structure: following/{followerId}/following/{targetUserId}
  const followingQuery = await admin.firestore()
    .collectionGroup('following')
    .get();

  const followerIds = [];
  for (const doc of followingQuery.docs) {
    if (doc.id === sighting.userId) {
      const pathParts = doc.ref.path.split('/');
      if (pathParts.length >= 2) {
        followerIds.push(pathParts[1]); // the follower's id
      }
    }
  }

  console.log(`Found ${followerIds.length} followers`);

  if (followerIds.length === 0) {
    console.log('No followers found for user:', sighting.userId);
    return;
  }

  const isHighlight = isNewSpecies || milestone !== null;

  // Collect push tokens for followers whose per-friend preference allows this
  // sighting. Absence of a pref doc resolves to "all".
  const pushTokens = [];
  for (const followerId of followerIds) {
    let mode = 'all';
    try {
      const prefSnap = await admin.firestore()
        .doc(`users/${followerId}/notificationPrefs/${sighting.userId}`)
        .get();
      if (prefSnap.exists && prefSnap.data().mode) {
        mode = prefSnap.data().mode;
      }
    } catch (error) {
      console.error(`Pref read failed for follower ${followerId}; defaulting to "all":`, error);
    }

    if (mode === 'none') {
      console.log(`Follower ${followerId} muted this friend; skipping.`);
      continue;
    }
    if (mode === 'highlights' && !isHighlight) {
      console.log(`Follower ${followerId} on highlights; sighting is not a highlight; skipping.`);
      continue;
    }

    const followerDoc = await admin.firestore()
      .collection('users')
      .doc(followerId)
      .get();

    if (followerDoc.exists) {
      const followerData = followerDoc.data();
      if (followerData.expoPushToken) {
        // Token + uid together, so a dead-token verdict knows whose to clear.
        pushTokens.push({ token: followerData.expoPushToken, uid: followerId });
        console.log(`Eligible follower ${followerId} (mode: ${mode})`);
      } else {
        console.log(`No push token for follower: ${followerId}`);
      }
    }
  }

  if (pushTokens.length === 0) {
    console.log('No eligible followers with push tokens');
    return;
  }

  console.log(`Sending notifications to ${pushTokens.length} followers`);

  const baseTitle = `🐦 ${username} spotted a bird!`;
  const baseBody = `${sighting.birdName} at ${sighting.location}`;
  const milestoneTitle = milestone
    ? `🎉 ${username} hit ${milestone} species!`
    : null;
  const milestoneBody = milestone
    ? `Just logged their ${milestone}${ordinalSuffix(milestone)} species: ${sighting.birdName}`
    : null;

  const targets = pushTokens.filter(({ token, uid }) => {
    if (!Expo.isExpoPushToken(token)) {
      console.log(`Invalid push token for ${uid}: ${token}`);
      return false;
    }
    return true;
  });

  const messages = targets.map(({ token }) => ({
    to: token,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    title: milestoneTitle || baseTitle,
    body: milestoneBody || baseBody,
    data: {
      type: milestone ? 'friend_milestone' : 'friend_sighting',
      sightingId: sightingId,
      friendName: username,
      birdName: sighting.birdName,
      location: sighting.location,
      ...(milestone ? { milestone } : {}),
    },
  }));

  await sendExpoPush(messages, targets, milestone ? 'friend_milestone' : 'friend_sighting');

  console.log(`Sent ${messages.length} notifications for sighting ${sightingId} (receipts pending)`);
}

// Is `birdName` now this user's only record of that species? (size === 1 means
// the triggering doc is the sole sighting → a new species for them.)
async function isNewSpeciesForUser(userId, birdName) {
  try {
    const speciesSnap = await admin.firestore()
      .collection('sightings')
      .where('userId', '==', userId)
      .where('birdName', '==', birdName)
      .get();
    return speciesSnap.size === 1;
  } catch (error) {
    console.error('New-species check failed; treating as not new:', error);
    return false;
  }
}

exports.onSightingAdded = onDocumentCreated('sightings/{sightingId}', async (event) => {
  const sighting = event.data.data();
  const sightingId = event.params.sightingId;

  console.log(`New sighting added: ${sightingId} by user: ${sighting.userId}`);

  try {
    const isNewSpecies = await isNewSpeciesForUser(sighting.userId, sighting.birdName);
    // milestoneCrossed is stamped on the doc by the client when this save
    // crossed a species-count threshold, so reuse it instead of recomputing.
    const milestone = typeof sighting.milestoneCrossed === 'number'
      ? sighting.milestoneCrossed
      : null;

    await notifyFollowersOfSighting(sightingId, sighting, isNewSpecies, milestone);

    // Record this species on the doc so a later edit away and back to it won't
    // re-notify followers for the same species (see onSightingUpdated guard).
    try {
      await event.data.ref.update({ notifiedSpecies: FieldValue.arrayUnion(sighting.birdName) });
    } catch (error) {
      console.error('Failed to stamp notifiedSpecies on create:', error);
    }
  } catch (error) {
    console.error('Error in onSightingAdded function:', error);
  }
});

// An edit that turns a sighting into a NEW species for the user notifies
// followers exactly like a fresh log. Every other edit (location / date / notes
// / photo, or a species swap to a bird already in the dex) stays silent — a
// plain updateDoc never triggers onSightingAdded, and this function returns
// early unless the birdName actually changed to a brand-new species.
exports.onSightingUpdated = onDocumentUpdated('sightings/{sightingId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const sightingId = event.params.sightingId;

  if (!before || !after) return;

  // Only a species change can create a follower-worthy new species. This guard
  // also stops recursion: our own notifiedSpecies stamp below leaves birdName
  // unchanged, so the resulting update re-enters here and returns immediately.
  if (before.birdName === after.birdName) return;

  try {
    const isNewSpecies = await isNewSpeciesForUser(after.userId, after.birdName);
    if (!isNewSpecies) return;

    // Don't double-notify if followers were already pinged for this species on
    // this doc (e.g. the user edited away and back).
    const alreadyNotified =
      Array.isArray(before.notifiedSpecies) && before.notifiedSpecies.includes(after.birdName);
    if (alreadyNotified) return;

    // Milestone copy is intentionally omitted on edits: milestoneCrossed isn't
    // rewritten by the edit path, so trusting it here could surface a stale
    // milestone. The new species still pushes (a new species is always a
    // highlight) — just with the standard "spotted a bird" copy.
    await notifyFollowersOfSighting(sightingId, after, isNewSpecies, null);

    try {
      await event.data.after.ref.update({ notifiedSpecies: FieldValue.arrayUnion(after.birdName) });
    } catch (error) {
      console.error('Failed to stamp notifiedSpecies on update:', error);
    }
  } catch (error) {
    console.error('Error in onSightingUpdated function:', error);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Global-first attribution (server-side authority)
// ─────────────────────────────────────────────────────────────────────────

// Recompute which sighting holds the "first on Pocket Birds" gold for a species:
// the EARLIEST-LOGGED sighting (createdAt, fallback observation date) among the
// VERIFIED ones. Sets globalFirst=true on that holder and false on every other
// sighting of the species, so the gold reassigns quietly when an earlier poster
// is verified later, and clears/reassigns when the holder is unverified or
// deleted. Idempotent: only the docs whose flag actually flips get written.
async function recomputeSpeciesGlobalFirst(birdName) {
  if (!birdName) return;
  const snap = await admin.firestore()
    .collection('sightings')
    .where('birdName', '==', birdName)
    .get();
  const docs = snap.docs.map((d) => {
    const data = d.data();
    const rank = data.createdAt && data.createdAt.toMillis
      ? data.createdAt.toMillis()
      : (data.date && data.date.toMillis ? data.date.toMillis() : Number.MAX_SAFE_INTEGER);
    return { ref: d.ref, id: d.id, verified: data.verified === true, globalFirst: data.globalFirst === true, rank };
  });
  const verified = docs.filter((d) => d.verified).sort((a, b) => a.rank - b.rank);
  const holderId = verified.length ? verified[0].id : null;
  await Promise.all(
    docs
      .filter((d) => (d.id === holderId) !== d.globalFirst)
      .map((d) => d.ref.update({ globalFirst: d.id === holderId }))
  );
}

// The server-side authority for global-first. Runs on every sighting write so
// the holder stays correct no matter who triggered the change — including the
// cases the client can't handle (a non-admin deleting the holder, or editing a
// verified sighting's species), where reassignment must write to OTHER users'
// docs. The client still recomputes optimistically on its own verify action for
// instant feedback; this reconciles everything else.
exports.onSightingWriteGlobalFirst = onDocumentWritten('sightings/{sightingId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;

  // Loop guard: on a plain update, only react when `verified` or the species
  // changed. Our own recompute writes touch ONLY globalFirst, so the resulting
  // update re-enters here, hits this guard, and stops — no recursion.
  if (before && after) {
    const verifiedChanged = (before.verified === true) !== (after.verified === true);
    const speciesChanged = before.birdName !== after.birdName;
    if (!verifiedChanged && !speciesChanged) return;
  }

  // Recompute every species this write could have affected: the new species and
  // (on a species edit or delete) the old one too.
  const species = new Set();
  if (before && before.birdName) species.add(before.birdName);
  if (after && after.birdName) species.add(after.birdName);
  for (const name of species) {
    try {
      await recomputeSpeciesGlobalFirst(name);
    } catch (error) {
      console.error('recomputeSpeciesGlobalFirst failed for', name, error);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PL-1: public-by-default visibility
// ─────────────────────────────────────────────────────────────────────────

// The tightened sightings read rule can't prove an app-wide "has anyone ever
// logged this species" query for non-admins, so the Add-time global-first
// check calls this instead (see sightingService.isGlobalFirstSpecies). Same
// semantics as the old client query: exact-name match, empty = caller would
// be the app first. Still best-effort and racy — onSightingWriteGlobalFirst
// stays the authority.
exports.checkGlobalFirst = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first.');
  }
  const birdName = request.data && request.data.birdName;
  if (typeof birdName !== 'string' || !birdName.trim()) {
    throw new HttpsError('invalid-argument', 'birdName is required.');
  }
  const snap = await admin.firestore()
    .collection('sightings')
    .where('birdName', '==', birdName)
    .limit(1)
    .get();
  return { isFirst: snap.empty };
});

// communityPhotos/{sightingId}: the public projection behind the Dex Community
// tab. Holds only public-safe fields (never notes, never GPS coordinates) and
// only for PUBLIC accounts — the projection, not the rules, is what keeps a
// private user's photos out of the app-wide gallery query. Maintained here on
// every sighting write and rebuilt on visibility/username changes below;
// functions/backfillCommunityPhotos.js seeds it once.
const COMMUNITY_EXCLUDED_SPECIES = new Set(['Bug Report', 'Feature Request']);

function communityEligible(sighting) {
  return !!sighting
    && !!sighting.photoUrl
    && !!sighting.userId
    && !!sighting.birdName
    && !COMMUNITY_EXCLUDED_SPECIES.has(sighting.birdName)
    && sighting.hidden !== true; // PL-2 soft-hide pulls the photo too
}

function communityProjection(sighting, username) {
  return {
    species: sighting.birdName,
    photoUrl: sighting.photoUrl,
    uid: sighting.userId,
    username: username || '',
    location: sighting.location || '', // freeform label only — no coordinates
    date: sighting.date || null,
    createdAt: sighting.createdAt || null,
  };
}

async function deleteCommunityPhotosForUser(db, uid) {
  const snap = await db.collection('communityPhotos').where('uid', '==', uid).get();
  if (snap.empty) return 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

exports.onSightingWriteCommunityPhoto = onDocumentWritten('sightings/{sightingId}', async (event) => {
  const after = event.data.after.exists ? event.data.after.data() : null;
  const db = admin.firestore();
  const ref = db.collection('communityPhotos').doc(event.params.sightingId);
  try {
    if (!communityEligible(after)) {
      await ref.delete(); // no-op when absent
      return;
    }
    const ownerSnap = await db.collection('users').doc(after.userId).get();
    const ownerPublic = ownerSnap.exists && ownerSnap.data().isPublic !== false;
    if (!ownerPublic) {
      await ref.delete();
      return;
    }
    await ref.set(communityProjection(after, ownerSnap.data().username));
  } catch (error) {
    console.error('onSightingWriteCommunityPhoto failed for', event.params.sightingId, error);
  }
});

// Visibility / username changes re-shape the whole projection for that user:
// private (or account deleted) drops every doc; public (re)builds them, which
// also refreshes the denormalized username. Guarded to those two fields —
// user docs are written constantly (push tokens, prefs) and must not trigger
// a rebuild each time.
exports.onUserWriteCommunityPhotos = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const beforePublic = before ? before.isPublic !== false : null;
  const afterPublic = after ? after.isPublic !== false : null;
  if (before && after
      && beforePublic === afterPublic
      && before.username === after.username) {
    return;
  }
  const uid = event.params.uid;
  const db = admin.firestore();
  try {
    if (!after || afterPublic === false) {
      const removed = await deleteCommunityPhotosForUser(db, uid);
      if (removed) console.log(`communityPhotos: removed ${removed} for ${uid} (private/deleted)`);
      return;
    }
    // Public (newly public, new account, or renamed): rebuild from their
    // sightings. Set is idempotent; ineligible strays are handled by the
    // sighting-level trigger above.
    const snap = await db.collection('sightings').where('userId', '==', uid).get();
    const eligible = snap.docs.filter((d) => communityEligible(d.data()));
    for (let i = 0; i < eligible.length; i += 400) {
      const batch = db.batch();
      eligible.slice(i, i + 400).forEach((d) => {
        batch.set(
          db.collection('communityPhotos').doc(d.id),
          communityProjection(d.data(), after.username)
        );
      });
      await batch.commit();
    }
    if (eligible.length) console.log(`communityPhotos: (re)built ${eligible.length} for ${uid}`);
  } catch (error) {
    console.error('onUserWriteCommunityPhotos failed for', uid, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Hoot & Comments — social engagement
// ─────────────────────────────────────────────────────────────────────────

/**
 * Send a single push to the owner of a sighting for a social event (hoot /
 * comment). Unlike sighting pushes, social pushes are NOT gated by the
 * per-friend notificationPrefs: there is intentionally no way to mute them.
 * Callers must skip the self-action case before calling.
 */
// Write an item into a user's in-app activity inbox
// (users/{ownerUid}/activity). Read by the Activity screen + header bell.
// Rules allow creates from the Admin SDK only. Best-effort: never throw.
async function writeActivity(ownerUid, activity) {
  try {
    await admin.firestore()
      .collection('users').doc(ownerUid)
      .collection('activity')
      .add({
        ...activity,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error('Error writing activity for', ownerUid, error);
  }
}

async function pushSocial(ownerUid, msg) {
  try {
    const ownerDoc = await admin.firestore().collection('users').doc(ownerUid).get();
    if (!ownerDoc.exists) {
      console.log('Owner not found for social push:', ownerUid);
      return;
    }
    const token = ownerDoc.data().expoPushToken;
    if (!token || !Expo.isExpoPushToken(token)) {
      console.log('No valid push token for owner:', ownerUid);
      return;
    }
    const messages = [{
      to: token,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      title: msg.title,
      body: msg.body,
      data: msg.data,
    }];
    await sendExpoPush(
      messages,
      [{ token, uid: ownerUid }],
      (msg.data && msg.data.type) || 'social'
    );
  } catch (error) {
    console.error('Error in pushSocial:', error);
  }
}

// Recompute the last-3 face pile for a sighting from its hoots subcollection.
async function recentHootersFor(sightingRef) {
  const hootsSnap = await sightingRef
    .collection('hoots')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();
  return hootsSnap.docs.map(d => ({ uid: d.data().uid, username: d.data().username }));
}

// Authoritative count of a subcollection. Recomputing the true size (instead of
// incrementing) makes the denormalized counter self-healing: a single missed
// trigger can't permanently desync it, since the next add/remove rewrites the
// real value. Same pattern as refreshProposalSummary's proposalCount.
async function subcollectionCount(parentRef, name) {
  return (await parentRef.collection(name).count().get()).data().count;
}

exports.onHootAdded = onDocumentCreated('sightings/{sightingId}/hoots/{hooterUid}', async (event) => {
  const { sightingId, hooterUid } = event.params;
  const hoot = event.data.data();
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);

  try {
    const sightingSnap = await sightingRef.get();
    if (!sightingSnap.exists) {
      console.log('Sighting not found for hoot:', sightingId);
      return;
    }
    const sighting = sightingSnap.data();

    // 1) maintain denormalized summary on the sighting doc
    const recentHooters = await recentHootersFor(sightingRef);
    const hootCount = await subcollectionCount(sightingRef, 'hoots');
    await sightingRef.update({ hootCount, recentHooters });

    // 2) record activity + push the sighting owner (never notify yourself)
    if (sighting.userId === hooterUid) return;
    await writeActivity(sighting.userId, {
      type: 'hoot',
      actorUid: hooterUid,
      actorUsername: hoot.username,
      sightingId,
      birdName: sighting.birdName,
    });
    await pushSocial(sighting.userId, {
      title: `${hoot.username} gave you a hoot 🦉`,
      body: `For your ${sighting.birdName} at ${sighting.location}`,
      data: { type: 'hoot', sightingId, birdName: sighting.birdName },
    });
  } catch (error) {
    console.error('Error in onHootAdded:', error);
  }
});

exports.onHootRemoved = onDocumentDeleted('sightings/{sightingId}/hoots/{hooterUid}', async (event) => {
  const { sightingId } = event.params;
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);

  try {
    const sightingSnap = await sightingRef.get();
    // If the sighting itself was deleted, there's no counter to maintain.
    if (!sightingSnap.exists) return;

    const recentHooters = await recentHootersFor(sightingRef);
    const hootCount = await subcollectionCount(sightingRef, 'hoots');
    await sightingRef.update({ hootCount, recentHooters });
  } catch (error) {
    console.error('Error in onHootRemoved:', error);
  }
});

exports.onCommentAdded = onDocumentCreated('sightings/{sightingId}/comments/{commentId}', async (event) => {
  const { sightingId } = event.params;
  const comment = event.data.data();
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);

  try {
    const sightingSnap = await sightingRef.get();
    if (!sightingSnap.exists) {
      console.log('Sighting not found for comment:', sightingId);
      return;
    }
    const sighting = sightingSnap.data();

    // 1) maintain count + newest-comment preview on the sighting doc
    const commentCount = await subcollectionCount(sightingRef, 'comments');
    await sightingRef.update({
      commentCount,
      topComment: { uid: comment.uid, username: comment.username, text: comment.text },
    });

    // 2) if this is a reply, notify the person being replied to — UNLESS that's
    // the commenter themselves (reply-to-self) or the sighting owner (who's
    // already pinged by the comment notification below, so no double).
    const replyTo = comment.replyTo;
    if (
      replyTo &&
      replyTo.uid &&
      replyTo.uid !== comment.uid &&
      replyTo.uid !== sighting.userId
    ) {
      await writeActivity(replyTo.uid, {
        type: 'reply',
        actorUid: comment.uid,
        actorUsername: comment.username,
        sightingId,
        birdName: sighting.birdName,
        commentText: comment.text.slice(0, 140),
      });
      await pushSocial(replyTo.uid, {
        title: `${comment.username} replied to you 💬`,
        body: comment.text.slice(0, 120),
        data: { type: 'reply', sightingId, birdName: sighting.birdName },
      });
    }

    // 3) record activity + push the sighting owner (never notify yourself)
    if (sighting.userId === comment.uid) return;
    await writeActivity(sighting.userId, {
      type: 'comment',
      actorUid: comment.uid,
      actorUsername: comment.username,
      sightingId,
      birdName: sighting.birdName,
      commentText: comment.text.slice(0, 140),
    });
    await pushSocial(sighting.userId, {
      title: `${comment.username} commented 🐦`,
      body: comment.text.slice(0, 120),
      data: { type: 'comment', sightingId, birdName: sighting.birdName },
    });
  } catch (error) {
    console.error('Error in onCommentAdded:', error);
  }
});

// Comment hoots: sightings/{id}/comments/{cid}/hoots/{uid}. Maintain hootCount
// on the comment doc and (on add) notify the comment's author — same policy as
// sighting hoots: a social event, never gated by notificationPrefs, never self.
exports.onCommentHootAdded = onDocumentCreated(
  'sightings/{sightingId}/comments/{commentId}/hoots/{hooterUid}',
  async (event) => {
    const { sightingId, commentId, hooterUid } = event.params;
    const hoot = event.data.data();
    const commentRef = admin.firestore().doc(`sightings/${sightingId}/comments/${commentId}`);

    try {
      const commentSnap = await commentRef.get();
      if (!commentSnap.exists) {
        console.log('Comment not found for hoot:', commentId);
        return;
      }
      const comment = commentSnap.data();

      // 1) maintain the denormalized count on the comment doc
      await commentRef.update({ hootCount: await subcollectionCount(commentRef, 'hoots') });

      // 2) notify the comment author (never notify yourself)
      if (comment.uid === hooterUid) return;
      const sightingSnap = await admin.firestore().doc(`sightings/${sightingId}`).get();
      const birdName = sightingSnap.exists ? sightingSnap.data().birdName : undefined;
      await writeActivity(comment.uid, {
        type: 'comment_hoot',
        actorUid: hooterUid,
        actorUsername: hoot.username,
        sightingId,
        birdName,
        commentText: (comment.text || '').slice(0, 140),
      });
      await pushSocial(comment.uid, {
        title: `${hoot.username} hooted your comment 🦉`,
        body: (comment.text || '').slice(0, 120),
        data: { type: 'comment_hoot', sightingId, birdName },
      });
    } catch (error) {
      console.error('Error in onCommentHootAdded:', error);
    }
  }
);

exports.onCommentHootRemoved = onDocumentDeleted(
  'sightings/{sightingId}/comments/{commentId}/hoots/{hooterUid}',
  async (event) => {
    const { sightingId, commentId } = event.params;
    const commentRef = admin.firestore().doc(`sightings/${sightingId}/comments/${commentId}`);
    try {
      const commentSnap = await commentRef.get();
      // If the comment itself was deleted, there's no counter to maintain.
      if (!commentSnap.exists) return;
      await commentRef.update({ hootCount: await subcollectionCount(commentRef, 'hoots') });
    } catch (error) {
      console.error('Error in onCommentHootRemoved:', error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// Community ID — proposals on Mystery Birds
// ─────────────────────────────────────────────────────────────────────────

// Recompute the denormalized proposal summary on the parent sighting doc:
// the total proposal count and the current front-runner (highest hoots, ties
// broken by oldest-first). Keeps the feed "needs ID · N proposals" cue and the
// leading-proposal cue correct without any client write access to these fields.
async function refreshProposalSummary(sightingRef) {
  const propsSnap = await sightingRef.collection('proposals')
    .orderBy('hootCount', 'desc').orderBy('createdAt', 'asc').limit(1).get();
  const countSnap = await sightingRef.collection('proposals').count().get();
  const lead = propsSnap.docs[0];
  await sightingRef.update({
    proposalCount: countSnap.data().count,
    leadingProposal: lead ? {
      proposalId: lead.id,
      species: lead.data().species,
      uid: lead.data().uid,
      username: lead.data().username,
      hootCount: lead.data().hootCount || 0,
    } : FieldValue.delete(),
  });
}

exports.onProposalAdded = onDocumentCreated('sightings/{sightingId}/proposals/{proposalId}', async (event) => {
  const { sightingId } = event.params;
  const proposal = event.data.data();
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);

  try {
    const sightingSnap = await sightingRef.get();
    if (!sightingSnap.exists) {
      console.log('Sighting not found for proposal:', sightingId);
      return;
    }
    const sighting = sightingSnap.data();

    // 1) maintain count + leading-proposal summary on the sighting doc
    await refreshProposalSummary(sightingRef);

    // 2) record activity + push the owner (never notify yourself). Social
    // pushes are not gated by notificationPrefs — same policy as hoots/comments.
    if (sighting.userId === proposal.uid) return;
    await writeActivity(sighting.userId, {
      type: 'proposal',
      actorUid: proposal.uid,
      actorUsername: proposal.username,
      sightingId,
      species: proposal.species,
    });
    await pushSocial(sighting.userId, {
      title: `${proposal.username} proposed an ID 🦉`,
      body: `${proposal.species} — for your Mystery Bird`,
      data: { type: 'proposal', sightingId, species: proposal.species },
    });
  } catch (error) {
    console.error('Error in onProposalAdded:', error);
  }
});

exports.onProposalRemoved = onDocumentDeleted('sightings/{sightingId}/proposals/{proposalId}', async (event) => {
  const { sightingId } = event.params;
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);
  try {
    const sightingSnap = await sightingRef.get();
    if (!sightingSnap.exists) return; // sighting itself gone — nothing to maintain
    await refreshProposalSummary(sightingRef);
  } catch (error) {
    console.error('Error in onProposalRemoved:', error);
  }
});

// A proposal's agreement hoots changed → recount that proposal's hootCount and
// refresh the leader (a hoot can change the ranking).
async function recountProposalHoots(sightingId, proposalId) {
  const sightingRef = admin.firestore().doc(`sightings/${sightingId}`);
  const propRef = sightingRef.collection('proposals').doc(proposalId);
  try {
    const propSnap = await propRef.get();
    // If the proposal was deleted, there's no counter to maintain; still refresh
    // the parent summary so the leader stays correct.
    if (propSnap.exists) {
      const c = await propRef.collection('hoots').count().get();
      await propRef.update({ hootCount: c.data().count });
    }
    const sightingSnap = await sightingRef.get();
    if (sightingSnap.exists) await refreshProposalSummary(sightingRef);
  } catch (error) {
    console.error('Error recounting proposal hoots:', error);
  }
}

exports.onProposalHootAdded = onDocumentCreated(
  'sightings/{sightingId}/proposals/{proposalId}/hoots/{hooterUid}',
  (event) => recountProposalHoots(event.params.sightingId, event.params.proposalId)
);

exports.onProposalHootRemoved = onDocumentDeleted(
  'sightings/{sightingId}/proposals/{proposalId}/hoots/{hooterUid}',
  (event) => recountProposalHoots(event.params.sightingId, event.params.proposalId)
);

// Owner accepted a proposal (the accept itself runs client-side in a batch,
// since it mutates the owner's own sighting + Dex). Fire on the false→true edge
// of `accepted` and push the PROPOSER that their ID was accepted.
exports.onProposalAccepted = onDocumentUpdated('sightings/{sightingId}/proposals/{proposalId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.accepted || !after.accepted) return; // only the false→true edge

  const { sightingId } = event.params;
  try {
    const sightingSnap = await admin.firestore().doc(`sightings/${sightingId}`).get();
    if (!sightingSnap.exists) return;
    const sighting = sightingSnap.data();
    if (sighting.userId === after.uid) return; // owner accepted their own — no push

    // Resolve the owner's username (not denormalized on the sighting doc).
    let ownerUsername = 'They';
    try {
      const ownerSnap = await admin.firestore().collection('users').doc(sighting.userId).get();
      if (ownerSnap.exists && ownerSnap.data().username) {
        ownerUsername = ownerSnap.data().username;
      }
    } catch (error) {
      console.error('Owner username lookup failed for proposal accept:', error);
    }

    await writeActivity(after.uid, {
      type: 'proposal_accepted',
      actorUid: sighting.userId,
      actorUsername: ownerUsername,
      sightingId,
      species: after.species,
    });
    await pushSocial(after.uid, {
      title: `${ownerUsername} accepted your ID 🦉`,
      body: `It's a ${after.species} — added to their Dex.`,
      data: { type: 'proposal_accepted', sightingId, species: after.species },
    });
  } catch (error) {
    console.error('Error in onProposalAccepted:', error);
  }
});

// New follower → write an activity item for the followed user AND push them.
// Like hoots/comments, the follow push is a social event and is NOT gated by
// the per-friend notificationPrefs (those only apply to sighting pushes).
exports.onFollowCreated = onDocumentCreated('following/{followerUid}/following/{followedUid}', async (event) => {
  const { followerUid, followedUid } = event.params;
  if (followerUid === followedUid) return;

  try {
    const followerSnap = await admin.firestore().collection('users').doc(followerUid).get();
    const actorUsername = followerSnap.exists ? (followerSnap.data().username || 'Someone') : 'Someone';
    await writeActivity(followedUid, {
      type: 'follow',
      actorUid: followerUid,
      actorUsername,
    });
    await pushSocial(followedUid, {
      title: `${actorUsername} followed you 🐦`,
      body: `${actorUsername} is now watching your sightings`,
      data: { type: 'follow', actorUid: followerUid, actorUsername },
    });
  } catch (error) {
    console.error('Error in onFollowCreated:', error);
  }
});

// Cold-start helper: when a brand-new account is created, Alex's account
// auto-follows them. The follow edge below trips onFollowCreated above, which
// writes the "Alex followed you" activity item (and pushes if they have a token
// yet — on a fresh signup they usually don't, but the durable activity is the
// point). Gives a new user a non-empty inbox and a reason to follow back, which
// is the lightest possible dent in the empty-feed cold start (WORK_QUEUE Q-7).
// Flip ENABLE_AUTO_FOLLOW to false to turn it off once real cold-start fixes
// (suggested friends / public posts) land.
const ENABLE_AUTO_FOLLOW = true;
const ALEX_UID = 'ZerkNpeAERSwmptlrPeboR5TASs2'; // akeats97@gmail.com — see constants/admin.ts

exports.onUserCreatedAutoFollow = onDocumentCreated('users/{uid}', async (event) => {
  if (!ENABLE_AUTO_FOLLOW) return;
  const { uid } = event.params;
  if (uid === ALEX_UID) return; // never self-follow

  try {
    // Write the same edge shape the client writes (following/{follower}/following/{followed}).
    // This is a CREATE under following/{ALEX_UID}, so it triggers onFollowCreated,
    // not this function — no loop.
    await admin.firestore()
      .doc(`following/${ALEX_UID}/following/${uid}`)
      .set({ timestamp: FieldValue.serverTimestamp() });
  } catch (error) {
    console.error('Error in onUserCreatedAutoFollow:', error);
  }
});

// ---------------------------------------------------------------------------
// N-1: in-app account deletion (Apple Guideline 5.1.1(v) requires it).
// Deletes everything the account owns: sightings (subcollections + Storage
// photos), engagement left on other people's content (hoots, comments,
// proposals), follow edges in both directions, notification prefs others hold
// about them, the username claim, the user doc tree, and finally the Auth
// user. Firestore first, Auth last, so a mid-way failure leaves an account
// that can sign in and retry. Deliberately NOT scrubbed: activity items in
// other users' inboxes that mention this account (historical records, same
// posture as a deleted comment's denormalized username elsewhere).
//
// Client calls this via the callable HTTPS protocol with a fresh password
// re-auth first (components/DeleteAccountSheet.tsx). Admin SDK deletes fire
// the normal triggers, so denormalized counters (hootCount, proposalCount,
// global-first holders) self-heal.
// ---------------------------------------------------------------------------

exports.deleteAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
  }
  const uid = request.auth.uid;
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const summary = { sightings: 0, hoots: 0, comments: 0, proposals: 0, followEdges: 0 };

  try {
    // 1. Own sightings: recursive delete (hoots/comments/proposals subtrees)
    //    plus both Storage copies (display + original archive).
    const sightings = await db.collection('sightings').where('userId', '==', uid).get();
    for (const doc of sightings.docs) {
      await db.recursiveDelete(doc.ref);
      summary.sightings++;
      for (const prefix of [`sightings/${doc.id}.`, `sightings/display/${doc.id}.`]) {
        try {
          await bucket.deleteFiles({ prefix });
        } catch (error) {
          console.error(`Storage cleanup failed for ${prefix}:`, error);
        }
      }
    }

    // 2. Engagement left on other people's content. All hoot docs (sighting,
    //    proposal, and comment hoots share one collection group) carry a uid
    //    field, as do comments and proposals.
    const hoots = await db.collectionGroup('hoots').where('uid', '==', uid).get();
    for (const doc of hoots.docs) {
      await doc.ref.delete();
      summary.hoots++;
    }
    const comments = await db.collectionGroup('comments').where('uid', '==', uid).get();
    for (const doc of comments.docs) {
      await db.recursiveDelete(doc.ref); // comments own a hoots subcollection
      summary.comments++;
    }
    const proposals = await db.collectionGroup('proposals').where('uid', '==', uid).get();
    for (const doc of proposals.docs) {
      await db.recursiveDelete(doc.ref);
      summary.proposals++;
    }

    // 3. Follow edges, both directions. Who-I-follow lives under
    //    following/{uid}; who-follows-me is any following doc whose id is this
    //    uid (same full-scan-then-filter the follower fanout uses; fine at our
    //    scale). Deletes trip onFollowDeleted so counts stay right.
    const followEdges = await db.collectionGroup('following').get();
    for (const doc of followEdges.docs) {
      if (doc.id === uid) {
        await doc.ref.delete();
        summary.followEdges++;
      }
    }
    await db.recursiveDelete(db.doc(`following/${uid}`));

    // 4. Notification prefs OTHER users keep about this account (doc id == the
    //    muted/followed user's uid).
    const prefs = await db.collectionGroup('notificationPrefs').get();
    for (const doc of prefs.docs) {
      if (doc.id === uid) await doc.ref.delete();
    }

    // 5. The username claim (docs are keyed by username, carry a uid field).
    const usernames = await db.collection('usernames').where('uid', '==', uid).get();
    for (const doc of usernames.docs) {
      await doc.ref.delete();
    }

    // 6. The user doc tree (activity + own notificationPrefs subcollections).
    await db.recursiveDelete(db.doc(`users/${uid}`));

    // 7. The Auth user, last.
    await admin.auth().deleteUser(uid);

    console.log(`Account deleted: ${uid}`, JSON.stringify(summary));
    return { ok: true, ...summary };
  } catch (error) {
    console.error(`Account deletion failed for ${uid}:`, error);
    throw new HttpsError('internal', 'Deletion failed partway. Sign in and try again.');
  }
});

// ---------------------------------------------------------------------------
// PL-2: moderation. blockUser tears down the relationship server-side (you
// can only delete YOUR OWN follow edge under the rules, so the reverse edge
// needs Admin SDK); onReportCreated pushes the admins so reports get acted on
// without anyone watching a console (store policy expects action on reports).
// ---------------------------------------------------------------------------

// Keep in sync with constants/admin.ts and the isAdmin() allowlist in
// firestore.rules. [0] Alex, [1] Victoria.
const ADMIN_UIDS = [
  'ZerkNpeAERSwmptlrPeboR5TASs2',
  'bvorXp0fC1QmhiUQM4ssoQcsodr1',
];

exports.blockUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to block someone.');
  }
  const me = request.auth.uid;
  const target = request.data && request.data.uid;
  if (typeof target !== 'string' || target.length === 0) {
    throw new HttpsError('invalid-argument', 'Pass the uid to block.');
  }
  if (target === me) {
    throw new HttpsError('invalid-argument', "You can't block yourself.");
  }

  const db = admin.firestore();
  try {
    // Order matters for safety, not correctness: the block doc lands first so
    // engagement is barred even if an edge delete fails and retries.
    await db.doc(`users/${me}/blocked/${target}`).set({
      createdAt: FieldValue.serverTimestamp(),
    });
    // Drop the follow edges BOTH directions (deletes are no-ops if absent;
    // they trip onFollowDeleted so denormalized counts stay right).
    await db.doc(`following/${me}/following/${target}`).delete();
    await db.doc(`following/${target}/following/${me}`).delete();
    console.log(`User ${me} blocked ${target}`);
    return { ok: true };
  } catch (error) {
    console.error(`blockUser failed (${me} -> ${target}):`, error);
    throw new HttpsError('internal', 'Block failed. Please try again.');
  }
});

exports.onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const report = event.data.data();
  try {
    const reporterDoc = await admin.firestore().doc(`users/${report.reporter}`).get();
    const reporterName = (reporterDoc.exists && reporterDoc.data().username) || report.reporter;
    for (const adminUid of ADMIN_UIDS) {
      if (adminUid === report.reporter) continue; // admins don't need their own report pushed back
      await pushSocial(adminUid, {
        title: '🚩 New report',
        body: `@${reporterName} reported a ${report.targetType}: ${String(report.reason).slice(0, 120)}`,
        data: {
          type: 'report',
          reportId: event.params.reportId,
          targetType: report.targetType,
          targetId: report.targetId,
        },
      });
    }
  } catch (error) {
    console.error('Error in onReportCreated:', error);
  }
});
