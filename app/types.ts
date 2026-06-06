export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;   // meters
  capturedAt?: Date;
}

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
  coordinates?: Coordinates;
  // Set to the user's unique-species count if THIS sighting crossed a
  // milestone (e.g. 5, 10, 25, 50, 100, then every 50). Cloud Function
  // reads this to send a richer push notification to followers.
  milestoneCrossed?: number;

  // True if, at log time, NO other PocketBirds user had ever logged this
  // species — i.e. the logger was the first birder on the whole app to record
  // it. Determined by a one-shot query when the sighting is created (best
  // effort; a tie between two simultaneous loggers can flag both). Drives the
  // special Dex tile color + the "first on Pocket Birds" celebration.
  globalFirst?: boolean;

  // Social engagement, denormalized onto the sighting doc and maintained
  // server-side by Cloud Functions (see Hoot & Comments data model). Missing
  // is treated as zero/empty on older sightings.
  hootCount?: number;
  commentCount?: number;
  recentHooters?: { uid: string; username: string }[];
  topComment?: { uid: string; username: string; text: string };
}

export interface FriendSighting extends Sighting {
  friendName: string;
  friendAvatar?: string;
  friendId?: string; // poster's uid — lets the feed tag link to their profile
}

// Adding a default export to fix the warning
// We're creating an empty object as the default export since types.ts is not a React component
export default {}; 