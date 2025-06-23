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
const {onDocumentCreated} = require("firebase-functions/v2/firestore");

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
    
    // Get push tokens for all followers
    const pushTokens = [];
    for (const followerId of followerIds) {
      const followerDoc = await admin.firestore()
        .collection('users')
        .doc(followerId)
        .get();
      
      if (followerDoc.exists) {
        const followerData = followerDoc.data();
        if (followerData.expoPushToken) {
          pushTokens.push(followerData.expoPushToken);
          console.log(`Found push token for follower: ${followerId}`);
        } else {
          console.log(`No push token for follower: ${followerId}`);
        }
      }
    }
    
    if (pushTokens.length === 0) {
      console.log('No push tokens found for followers');
      return;
    }
    
    console.log(`Sending notifications to ${pushTokens.length} followers`);
    
    // Create notification messages
    const messages = pushTokens.map(pushToken => {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.log(`Invalid push token: ${pushToken}`);
        return null;
      }
      
      return {
        to: pushToken,
        sound: 'default',
        title: `🐦 ${username} spotted a bird!`,
        body: `${sighting.birdName} at ${sighting.location}`,
        data: {
          type: 'friend_sighting',
          sightingId: sightingId,
          friendName: username,
          birdName: sighting.birdName,
          location: sighting.location,
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
