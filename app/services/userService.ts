import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { NEW_FOLLOW_MODE, setPref } from './notificationPrefsService';

// Type definitions
export interface UserProfile {
  uid: string;
  username: string;
  email?: string;
}

// Search for users by username
export async function searchUsers(usernameQuery: string, maxResults = 10): Promise<UserProfile[]> {
  if (!usernameQuery || usernameQuery.length < 2) {
    console.log('Search query too short:', usernameQuery);
    return [];
  }

  try {
    const queryLower = usernameQuery.toLowerCase();
    console.log('Searching for usernames starting with (case-insensitive):', queryLower);

    // Firestore document IDs are case-sensitive, so a range query on __name__ misses
    // any username whose case differs from the query. Fetch the collection and filter
    // in JS instead. Fine at our scale (handful of users; revisit past a few thousand).
    const usernameRef = collection(db, 'usernames');
    const usernameSnapshot = await getDocs(usernameRef);

    const matches = usernameSnapshot.docs
      .filter(d => d.id.toLowerCase().startsWith(queryLower))
      .slice(0, maxResults);

    console.log(`Found ${matches.length} username matches for: "${usernameQuery}"`);

    if (matches.length === 0) {
      return [];
    }

    const users = await Promise.all(
      matches.map(async (usernameDoc) => {
        const username = usernameDoc.id;
        const uid = usernameDoc.data().uid;
        const userDoc = await getDoc(doc(db, 'users', uid));

        if (userDoc.exists()) {
          return {
            uid,
            username,
            ...userDoc.data(),
          } as UserProfile;
        }
        return null;
      })
    );

    return users.filter(user => user !== null) as UserProfile[];
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

// Follow a user
export async function followUser(targetUserId: string): Promise<void> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be logged in to follow others');
  }
  
  try {
    // Add to following collection - creates a document with the current user ID
    // and a subcollection of users they follow
    const followingRef = doc(db, `following/${currentUser.uid}/following/${targetUserId}`);
    
    // Set the document with timestamp for when the follow happened
    await setDoc(followingRef, {
      timestamp: new Date(),
    });

    // New relationships default to "highlights" (quieter). Existing follows
    // have no pref doc and resolve to "all", so current users are unaffected.
    // Best-effort: a failure here must not fail the follow itself.
    try {
      await setPref(currentUser.uid, targetUserId, NEW_FOLLOW_MODE);
    } catch (prefError) {
      console.warn('Follow succeeded but failed to set default notification pref:', prefError);
    }

    console.log(`Now following user: ${targetUserId}`);
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
}

// Unfollow a user
export async function unfollowUser(targetUserId: string): Promise<void> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be logged in to unfollow others');
  }
  
  try {
    // Remove from following collection
    const followingRef = doc(db, `following/${currentUser.uid}/following/${targetUserId}`);
    await deleteDoc(followingRef);
    
    console.log(`Unfollowed user: ${targetUserId}`);
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
}

// Check if the current user is following a specific user
export async function isFollowing(targetUserId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return false;
  }
  
  try {
    const followingRef = doc(db, `following/${currentUser.uid}/following/${targetUserId}`);
    const followingDoc = await getDoc(followingRef);
    
    return followingDoc.exists();
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

// Get all users the current user is following
export async function getFollowing(): Promise<UserProfile[]> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return [];
  }
  
  try {
    const followingRef = collection(db, `following/${currentUser.uid}/following`);
    const followingSnapshot = await getDocs(followingRef);
    
    // Get the user details for each followed user
    const followedUsers = await Promise.all(
      followingSnapshot.docs.map(async (followDoc) => {
        const userId = followDoc.id;
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          return {
            uid: userId,
            ...userDoc.data(),
          } as UserProfile;
        }
        return null;
      })
    );
    
    return followedUsers.filter(user => user !== null) as UserProfile[];
  } catch (error) {
    console.error('Error getting following list:', error);
    return [];
  }
}

// Get the current user's profile
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return null;
  }
  
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (userDoc.exists()) {
      return {
        uid: currentUser.uid,
        ...userDoc.data(),
      } as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user profile:', error);
    return null;
  }
}

export interface User {
  uid: string;
  username: string;
  email: string;
}

// Get a user by their username
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const usernameDoc = await getDoc(doc(db, "usernames", username));
    if (!usernameDoc.exists()) {
      return null;
    }
    
    const userDoc = await getDoc(doc(db, "users", usernameDoc.data().uid));
    if (!userDoc.exists()) {
      return null;
    }
    
    const data = userDoc.data();
    return {
      uid: userDoc.id,
      username: data.username,
      email: data.email
    };
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
}

// Add this function to save push token
export async function savePushToken(pushToken: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be logged in to save push token');
  }

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      expoPushToken: pushToken,
      lastTokenUpdate: new Date(),
    }, { merge: true }); // merge: true means update existing document or create if doesn't exist
    console.log('Push token saved to database');
  } catch (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
}

// Add this function to get user's push token
export async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data().expoPushToken || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user push token:', error);
    return null;
  }
}

const userService = {
  getUserByUsername,
  getFollowing,
  savePushToken,
  getUserPushToken
};

export default userService; 