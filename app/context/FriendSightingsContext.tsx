import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../../config/firebaseConfig';
import { UserProfile, getFollowing } from '../services/userService';
import { FriendSighting } from '../types';

// Still keeping these for initial state/fallback
const initialFriendSightings: FriendSighting[] = [
  {
    id: 'fs-1',
    birdName: 'Northern Cardinal',
    location: 'Central Park, NY',
    date: new Date('2023-06-15'),
    notes: 'Spotted early morning near the lake',
    friendName: 'Emma Wilson',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-15'),
  },
  {
    id: 'fs-2',
    birdName: 'Blue Jay',
    location: 'Prospect Park, Brooklyn',
    date: new Date('2023-06-12'),
    notes: 'Very vocal, making quite a racket!',
    friendName: 'Marcus Johnson',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-12'),
  },
  {
    id: 'fs-3',
    birdName: 'American Robin',
    location: 'Golden Gate Park, SF',
    date: new Date('2023-06-10'),
    friendName: 'Sara Chen',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-10'),
  },
  {
    id: 'fs-4',
    birdName: 'Red-tailed Hawk',
    location: 'Yellowstone National Park',
    date: new Date('2023-06-08'),
    notes: 'Soaring high above the valley',
    friendName: 'James Rodriguez',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-08'),
  },
  {
    id: 'fs-5',
    birdName: 'Great Blue Heron',
    location: 'Everglades, FL',
    date: new Date('2023-06-05'),
    notes: 'Wading in shallow water',
    friendName: 'Emma Wilson',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-05'),
  },
  {
    id: 'fs-6',
    birdName: 'Barn Owl',
    location: 'Yosemite National Park',
    date: new Date('2023-06-03'),
    friendName: 'Alex Taylor',
    syncStatus: 'synced',
    lastModified: new Date('2023-06-03'),
  },
  {
    id: 'fs-7',
    birdName: 'American Goldfinch',
    location: 'Boston Common, MA',
    date: new Date('2023-05-30'),
    notes: 'Bright yellow plumage, feeding on thistle',
    friendName: 'Marcus Johnson',
    syncStatus: 'synced',
    lastModified: new Date('2023-05-30'),
  },
];

interface FriendSightingsContextType {
  friendSightings: FriendSighting[];
  friends: { id: string; name: string }[];
  filterByFriend: (friendName: string) => FriendSighting[];
  isLoadingFriends: boolean;
  refreshFriends: () => Promise<void>;
}

const FriendSightingsContext = createContext<FriendSightingsContextType | undefined>(undefined);

function FriendSightingsProvider({ children }: { children: React.ReactNode }) {
  const [friendSightings, setFriendSightings] = useState<FriendSighting[]>(initialFriendSightings);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  
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
      
      // Set up a real-time listener for sightings
      const unsubscribe = onSnapshot(
        sightingsQuery,
        (snapshot) => {
          const sightings: FriendSighting[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const userId = data.userId;
            
            if (usernameMap[userId]) {
              sightings.push({
                id: doc.id,
                birdName: data.birdName,
                location: data.location,
                date: data.date.toDate(),
                notes: data.notes,
                friendName: usernameMap[userId],
                syncStatus: 'synced' as const,
                lastModified: data.lastModified ? data.lastModified.toDate() : data.date.toDate(),
                // Add other fields as needed
              });
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
          // If there's an error, we'll use mock data for now
          // In production, you should handle this error properly
          setFriendSightings(initialFriendSightings);
        }
      );
      
      // Clean up the listener when the component unmounts
      return () => unsubscribe();
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
        // If not logged in, use mock data
        setFriends([]);
        setFriendSightings([]);
        setIsLoadingFriends(false);
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // Function to manually refresh friends list
  const refreshFriends = async () => {
    await fetchFollowing();
  };

  const filterByFriend = (friendName: string): FriendSighting[] => {
    if (!friendName) return friendSightings;
    const filtered = friendSightings.filter(sighting => 
      sighting.friendName.toLowerCase().includes(friendName.toLowerCase())
    );
    // Sort filtered results by date, newest first
    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  return (
    <FriendSightingsContext.Provider 
      value={{ 
        friendSightings, 
        friends, 
        filterByFriend,
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