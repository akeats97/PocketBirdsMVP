import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../../config/firebaseConfig';
import { UserProfile, getFollowing } from '../services/userService';
import { FriendSighting } from '../types';

interface FriendSightingsContextType {
  friendSightings: FriendSighting[];
  friends: { id: string; name: string }[];
  isLoadingFriends: boolean;
  refreshFriends: () => Promise<void>;
}

const FriendSightingsContext = createContext<FriendSightingsContextType | undefined>(undefined);

function FriendSightingsProvider({ children }: { children: React.ReactNode }) {
  // Starts empty — the merged home feed renders this directly, so it must
  // never contain placeholder data.
  const [friendSightings, setFriendSightings] = useState<FriendSighting[]>([]);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  // Holds the active sightings onSnapshot unsubscribe so we can tear it down on
  // logout / re-fetch. Without this the listener leaks and, under the strict
  // Firestore rules, fires a permission error the moment auth drops at logout.
  const sightingsUnsubRef = useRef<(() => void) | null>(null);

  // Fetch following users and their sightings
  const fetchFollowing = async () => {
    if (!auth.currentUser) {
      setIsLoadingFriends(false);
      return;
    }
    
    setIsLoadingFriends(true);
    try {
      // Get list of users the current user is following
      const followingUsers = await getFollowing();
      
      // Convert to the format expected by the UI
      const friendsList = followingUsers.map(user => ({
        id: user.uid,
        name: user.username
      }));
      
      setFriends(friendsList);
      
      // If we have friends, fetch their sightings
      if (followingUsers.length > 0) {
        fetchFriendSightings(followingUsers);
      } else {
        setFriendSightings([]);
      }
    } catch (error) {
      console.error('Error fetching following:', error);
      Alert.alert(
        'Error', 
        'Failed to load friends. Please check your connection and try again.'
      );
    } finally {
      setIsLoadingFriends(false);
    }
  };
  
  // Fetch sightings from friends
  const fetchFriendSightings = async (followingUsers: UserProfile[]) => {
    try {
      // Get all user IDs we're following
      const userIds = followingUsers.map(user => user.uid);
      
      // Create a username lookup map for later use
      const usernameMap = followingUsers.reduce((map, user) => {
        map[user.uid] = user.username;
        return map;
      }, {} as Record<string, string>);
      
      // Query sightings where the user is one of the people we follow
      const sightingsQuery = query(
        collection(db, 'sightings'),
        where('userId', 'in', userIds)
      );
      
      // Tear down any previous sightings listener before creating a new one.
      sightingsUnsubRef.current?.();

      // Set up a real-time listener for sightings
      const unsubscribe = onSnapshot(
        sightingsQuery,
        (snapshot) => {
          const sightings: FriendSighting[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const userId = data.userId;
            
            if (usernameMap[userId]) {
              const friendSighting: FriendSighting = {
                id: doc.id,
                birdName: data.birdName,
                location: data.location,
                date: data.date.toDate(),
                notes: data.notes,
                friendName: usernameMap[userId],
                friendId: userId,
                syncStatus: 'synced' as const,
                lastModified: data.lastModified ? data.lastModified.toDate() : data.date.toDate(),
                photoUrl: data.photoUrl || undefined,
                hootCount: data.hootCount ?? 0,
                commentCount: data.commentCount ?? 0,
                recentHooters: data.recentHooters ?? [],
                topComment: data.topComment ?? undefined,
                globalFirst: data.globalFirst ?? false,
                verified: data.verified ?? false,
              };
              if (data.coordinates) {
                friendSighting.coordinates = {
                  latitude: data.coordinates.latitude,
                  longitude: data.coordinates.longitude,
                  accuracy: data.coordinates.accuracy ?? undefined,
                  capturedAt: data.coordinates.capturedAt?.toDate?.() ?? undefined,
                };
              }
              sightings.push(friendSighting);
            }
          });
          
          // Sort sightings by date, newest first
          sightings.sort((a, b) => b.date.getTime() - a.date.getTime());
          
          // If no friend sightings found yet but we have friends, use empty array
          // instead of mock data
          if (sightings.length === 0 && followingUsers.length > 0) {
            setFriendSightings([]);
          } else {
            setFriendSightings(sightings);
          }
        },
        (error) => {
          console.error('Error fetching sightings:', error);
          // Keep whatever was last loaded; never inject placeholder data.
        }
      );
      
      // Remember it so logout / re-fetch / unmount can tear it down.
      sightingsUnsubRef.current = unsubscribe;
    } catch (error) {
      console.error('Error setting up sightings listener:', error);
    }
  };
  
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchFollowing();
      } else {
        // Logged out: tear down the live sightings listener so it doesn't fire
        // a permission error once auth drops, then clear state.
        sightingsUnsubRef.current?.();
        sightingsUnsubRef.current = null;
        setFriends([]);
        setFriendSightings([]);
        setIsLoadingFriends(false);
      }
    });

    return () => {
      unsubscribe();
      sightingsUnsubRef.current?.();
      sightingsUnsubRef.current = null;
    };
  }, []);
  
  // Function to manually refresh friends list
  const refreshFriends = async () => {
    await fetchFollowing();
  };

  return (
    <FriendSightingsContext.Provider
      value={{
        friendSightings,
        friends,
        isLoadingFriends,
        refreshFriends
      }}
    >
      {children}
    </FriendSightingsContext.Provider>
  );
}

export function useFriendSightings() {
  const context = useContext(FriendSightingsContext);
  if (context === undefined) {
    throw new Error('useFriendSightings must be used within a FriendSightingsProvider');
  }
  return context;
}

export default FriendSightingsProvider; 