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
const {onDocumentCreated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
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

exports.onSightingAdded = onDocumentCreated('sightings/{sightingId}', async (event) => {
  const sighting = event.data.data();
  const sightingId = event.params.sightingId;
  
  console.log(`New sighting added: ${sightingId} by user: ${sighting.userId}`);
  
  try {
    // Get the user who added the sighting
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
    
    // Get all users who follow this person
    // We need to find all users who have this person in their following list
    // The structure is: following/{followerId}/following/{targetUserId}
    const followingQuery = await admin.firestore()
      .collectionGroup('following')
      .get();
    
    const followerIds = [];
    for (const doc of followingQuery.docs) {
      // Check if this document is for the user who added the sighting
      if (doc.id === sighting.userId) {
        // Extract the follower ID from the document path
        // Path format: following/{followerId}/following/{targetUserId}
        const pathParts = doc.ref.path.split('/');
        if (pathParts.length >= 2) {
          const followerId = pathParts[1]; // This is the follower's ID
          followerIds.push(followerId);
        }
      }
    }
    
    console.log(`Found ${followerIds.length} followers`);

    if (followerIds.length === 0) {
      console.log('No followers found for user:', sighting.userId);
      return;
    }

    // Compute once whether this sighting is a "highlight" for the poster: a
    // brand-new species for them, or a save that crossed a species-count
    // milestone. Followers on "highlights" only get pushed for these.
    let isNewSpecies = false;
    try {
      const speciesSnap = await admin.firestore()
        .collection('sightings')
        .where('userId', '==', sighting.userId)
        .where('birdName', '==', sighting.birdName)
        .get();
      // The triggering sighting is already written, so size === 1 means this
      // is the only sighting of the species for this user (i.e. new species).
      isNewSpecies = speciesSnap.size === 1;
    } catch (error) {
      console.error('New-species check failed; treating as not new:', error);
    }

    // milestoneCrossed is stamped on the doc by the client when this save
    // crossed a species-count threshold, so reuse it instead of recomputing.
    const milestone = typeof sighting.milestoneCrossed === 'number'
      ? sighting.milestoneCrossed
      : null;
    const isHighlight = isNewSpecies || milestone !== null;

    // Collect push tokens for followers whose per-friend preference allows
    // this sighting. Absence of a pref doc resolves to "all": relationships
    // that predate this feature keep getting every sighting. New follows are
    // created with an explicit "highlights" doc by the client.
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
        console.error(`Pref read failed for follower ${followerId}; defaulting to highlights:`, error);
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

    // Create notification messages
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
    
    // Send notifications in chunks (Expo has limits)
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
    
  } catch (error) {
    console.error('Error in onSightingAdded function:', error);
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

    // 2) push the sighting owner (never notify yourself)
    if (sighting.userId === hooterUid) return;
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
