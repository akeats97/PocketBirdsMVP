import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

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
    console.log('Searching for usernames starting with:', usernameQuery);
    
    // Get usernames that match the query
    const usernameRef = collection(db, 'usernames');
    
    // Since usernames are document IDs in Firestore, we query by document ID
    // using the special field '__name__'
    const q = query(
      usernameRef,
      where('__name__', '>=', usernameQuery),
      where('__name__', '<=', usernameQuery + '\uf8ff'),
      limit(maxResults)
    );
    
    console.log('Query parameters:', {
      collection: 'usernames',
      start: usernameQuery,
      end: usernameQuery + '\uf8ff',
      limit: maxResults
    });
    
    const usernameSnapshot = await getDocs(q);
    
    console.log(`Found ${usernameSnapshot.size} username matches for: "${usernameQuery}"`);
    
    if (usernameSnapshot.empty) {
      console.log('No usernames found matching the query');
      return [];
    }
    
    // Map to get full user details
    const users = await Promise.all(
      usernameSnapshot.docs.map(async (usernameDoc) => {
        // Username is the document ID
        const username = usernameDoc.id;
        const uid = usernameDoc.data().uid;
        
        console.log(`Processing username: "${username}" with uid: ${uid}`);
        
        const userDoc = await getDoc(doc(db, 'users', uid));
        
        if (userDoc.exists()) {
          console.log(`User data found for ${username}`);
          return {
            uid,
            username, // Ensure username is included
            ...userDoc.data(),
          } as UserProfile;
        }
        
        console.log(`No user data found for ${username}`);
        return null;
      })
    );

    const filteredUsers = users.filter(user => user !== null) as UserProfile[];
    console.log(`Returning ${filteredUsers.length} valid user results`);
    
    return filteredUsers;
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