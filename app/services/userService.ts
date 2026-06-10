import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
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
    return [];
  }

  try {
    const queryLower = usernameQuery.toLowerCase();

    // Firestore document IDs are case-sensitive, so a range query on __name__ misses
    // any username whose case differs from the query. Fetch the collection and filter
    // in JS instead. Fine at our scale (handful of users; revisit past a few thousand).
    const usernameRef = collection(db, 'usernames');
    const usernameSnapshot = await getDocs(usernameRef);

    const matches = usernameSnapshot.docs
      .filter(d => d.id.toLowerCase().startsWith(queryLower))
      .slice(0, maxResults);

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

// ─── Follow graph (followers + following for any user) ──────────────────────
//
// The graph is stored one-directional: each edge is a doc at
// following/{followerUid}/following/{followedUid}. There is no reverse index,
// so to find a user's FOLLOWERS we scan the whole `following` collection group
// (the follower is the edge's grandparent doc id, the followed is its doc id).
// This reads every edge in the app per call — fine at our scale (a handful of
// users); revisit with a denormalized followers mirror past a few thousand
// follows (same posture as searchUsers scanning the whole usernames collection).

// A person as shown in a follow list / counts row.
export interface Person {
  uid: string;
  username: string;
}

interface FollowEdge {
  follower: string;
  followed: string;
}

// One collection-group read of every follow edge in the app.
async function getAllFollowEdges(): Promise<FollowEdge[]> {
  const snap = await getDocs(collectionGroup(db, 'following'));
  const edges: FollowEdge[] = [];
  snap.forEach((d) => {
    // following/{followerUid}/following/{followedUid}: the follower is the
    // grandparent doc. Skip any stray top-level following/{uid} docs (no parent).
    const followerDoc = d.ref.parent.parent;
    if (!followerDoc) return;
    edges.push({ follower: followerDoc.id, followed: d.id });
  });
  return edges;
}

// Resolve uid → username (from users/{uid}) for a batch of uids.
async function resolveUsernames(uids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (uid) => {
      const userDoc = await getDoc(doc(db, 'users', uid));
      map.set(uid, userDoc.exists() ? (userDoc.data().username ?? '') : '');
    }),
  );
  return map;
}

// Follower / following counts for any user — the numbers the profile shows.
// Equals the length of the lists getConnections returns, so they always match.
export async function getFollowCounts(
  uid: string,
): Promise<{ followers: number; following: number }> {
  try {
    const edges = await getAllFollowEdges();
    let followers = 0;
    let following = 0;
    for (const e of edges) {
      if (e.followed === uid) followers++;
      if (e.follower === uid) following++;
    }
    return { followers, following };
  } catch (error) {
    console.error('Error getting follow counts:', error);
    return { followers: 0, following: 0 };
  }
}

// Full followers + following lists for `targetUid`, plus the set of uids that
// `myUid` follows (used to seed each row's Follow / Following pill). One graph
// scan + a username resolve.
export async function getConnections(
  targetUid: string,
  myUid: string,
): Promise<{ followers: Person[]; following: Person[]; myFollowing: Set<string> }> {
  try {
    const edges = await getAllFollowEdges();
    const followerUids: string[] = [];
    const followingUids: string[] = [];
    const myFollowing = new Set<string>();
    for (const e of edges) {
      if (e.followed === targetUid) followerUids.push(e.follower);
      if (e.follower === targetUid) followingUids.push(e.followed);
      if (e.follower === myUid) myFollowing.add(e.followed);
    }
    const names = await resolveUsernames([...followerUids, ...followingUids]);
    const toPerson = (uid: string): Person => ({ uid, username: names.get(uid) ?? '' });
    return {
      followers: followerUids.map(toPerson),
      following: followingUids.map(toPerson),
      myFollowing,
    };
  } catch (error) {
    console.error('Error getting connections:', error);
    return { followers: [], following: [], myFollowing: new Set<string>() };
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

// Public profile for any user (friend, stranger, or self). Reads users/{uid}
// (allowed for any signed-in user by the Firestore rules) and resolves a join
// date from `createdAt`. If that field is missing (older accounts), the caller
// can fall back to the earliest sighting date via `fallbackJoinDate`.
export interface PublicProfile {
  uid: string;
  username: string;
  // Used only as an avatar-initial fallback when username is briefly empty (the
  // same partial-cache race the header guards against). Never shown as text.
  email?: string;
  joinDate: Date | null;
}

export async function getPublicProfile(
  uid: string,
  fallbackJoinDate?: Date | null,
): Promise<PublicProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return null;
    }
    const data = userDoc.data();
    // createdAt is a Firestore Timestamp on accounts created after the field
    // was added (May 2026); older accounts have no createdAt at all.
    const createdAt: Date | null =
      data.createdAt?.toDate?.() ??
      (data.createdAt ? new Date(data.createdAt) : null);
    return {
      uid,
      username: data.username,
      email: data.email,
      joinDate: createdAt ?? fallbackJoinDate ?? null,
    };
  } catch (error) {
    console.error(`Error getting public profile for ${uid}:`, error);
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