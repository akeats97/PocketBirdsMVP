import React, { createContext, useContext, useState } from 'react';
import { FriendSighting } from '../types';

// Mock friend sightings for demonstration
const initialFriendSightings: FriendSighting[] = [
  {
    id: 'fs-1',
    birdName: 'Northern Cardinal',
    location: 'Central Park, NY',
    date: new Date('2023-06-15'),
    notes: 'Spotted early morning near the lake',
    friendName: 'Emma Wilson',
  },
  {
    id: 'fs-2',
    birdName: 'Blue Jay',
    location: 'Prospect Park, Brooklyn',
    date: new Date('2023-06-12'),
    notes: 'Very vocal, making quite a racket!',
    friendName: 'Marcus Johnson',
  },
  {
    id: 'fs-3',
    birdName: 'American Robin',
    location: 'Golden Gate Park, SF',
    date: new Date('2023-06-10'),
    friendName: 'Sara Chen',
  },
  {
    id: 'fs-4',
    birdName: 'Red-tailed Hawk',
    location: 'Yellowstone National Park',
    date: new Date('2023-06-08'),
    notes: 'Soaring high above the valley',
    friendName: 'James Rodriguez',
  },
  {
    id: 'fs-5',
    birdName: 'Great Blue Heron',
    location: 'Everglades, FL',
    date: new Date('2023-06-05'),
    notes: 'Wading in shallow water',
    friendName: 'Emma Wilson',
  },
  {
    id: 'fs-6',
    birdName: 'Barn Owl',
    location: 'Yosemite National Park',
    date: new Date('2023-06-03'),
    friendName: 'Alex Taylor',
  },
  {
    id: 'fs-7',
    birdName: 'American Goldfinch',
    location: 'Boston Common, MA',
    date: new Date('2023-05-30'),
    notes: 'Bright yellow plumage, feeding on thistle',
    friendName: 'Marcus Johnson',
  },
];

// Mock friends list
export const mockFriends = [
  { id: 'f-1', name: 'Emma Wilson' },
  { id: 'f-2', name: 'Marcus Johnson' },
  { id: 'f-3', name: 'Sara Chen' },
  { id: 'f-4', name: 'James Rodriguez' },
  { id: 'f-5', name: 'Alex Taylor' },
];

interface FriendSightingsContextType {
  friendSightings: FriendSighting[];
  friends: { id: string; name: string }[];
  filterByFriend: (friendName: string) => FriendSighting[];
}

const FriendSightingsContext = createContext<FriendSightingsContextType | undefined>(undefined);

function FriendSightingsProvider({ children }: { children: React.ReactNode }) {
  const [friendSightings] = useState<FriendSighting[]>(initialFriendSightings);
  const [friends] = useState(mockFriends);

  const filterByFriend = (friendName: string): FriendSighting[] => {
    if (!friendName) return friendSightings;
    return friendSightings.filter(sighting => 
      sighting.friendName.toLowerCase().includes(friendName.toLowerCase())
    );
  };

  return (
    <FriendSightingsContext.Provider value={{ friendSightings, friends, filterByFriend }}>
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