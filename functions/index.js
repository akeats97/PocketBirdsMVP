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
        pushTokens.push(followerData.expoPushToken);
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

  const messages = pushTokens.map(pushToken => {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.log(`Invalid push token: ${pushToken}`);
      return null;
    }

    return {
      to: pushToken,
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
    };
  }).filter(message => message !== null);

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log('Notification tickets:', ticketChunk);
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  console.log(`Successfully sent ${messages.length} notifications for sighting ${sightingId}`);
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
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        console.log('Social push tickets:', tickets);
      } catch (error) {
        console.error('Error sending social push:', error);
      }
    }
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
    await sightingRef.update({ hootCount: FieldValue.increment(1), recentHooters });

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
    await sightingRef.update({ hootCount: FieldValue.increment(-1), recentHooters });
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
    await sightingRef.update({
      commentCount: FieldValue.increment(1),
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
      await commentRef.update({ hootCount: FieldValue.increment(1) });

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
      await commentRef.update({ hootCount: FieldValue.increment(-1) });
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
