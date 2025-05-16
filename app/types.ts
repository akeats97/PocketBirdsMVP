export interface Sighting {
  id: string;
  birdName: string;
  location: string;
  date: Date;
  notes?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  lastModified: Date;
  photoUrl?: string;  // URL to the photo in Firebase Storage
  photoPath?: string; // Local path to the photo before upload
}

export interface FriendSighting extends Sighting {
  friendName: string;
  friendAvatar?: string;
}

// Adding a default export to fix the warning
// We're creating an empty object as the default export since types.ts is not a React component
export default {}; 