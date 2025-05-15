export interface Sighting {
  id: string;
  birdName: string;
  location: string;
  date: Date;
  notes?: string;
}

export interface FriendSighting extends Sighting {
  friendName: string;
  friendAvatar?: string;
}

// Adding a default export to fix the warning
// We're creating an empty object as the default export since types.ts is not a React component
export default {}; 