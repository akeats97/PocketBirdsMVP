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
  // When the log was INPUT (post time), distinct from the observation `date`
  // the user picks. Drives within-day feed ordering (most recently posted on
  // top). Falls back to `date` for older docs that predate the field.
  createdAt?: Date;
  photoUrl?: string;  // URL to the photo in Firebase Storage (compressed display copy)
  photoUrlOriginal?: string;  // URL of the untouched original (archived; absent on legacy/failed uploads)
  photoPath?: string; // Local path to the photo before upload
  coordinates?: Coordinates;
  // Set to the user's unique-species count if THIS sighting crossed a
  // milestone (e.g. 5, 10, 25, 50, 100, then every 50). Cloud Function
  // reads this to send a richer push notification to followers.
  milestoneCrossed?: number;

  // True if, at log time, NO other PocketBirds user had ever logged this
  // species — i.e. the logger was the first birder on the whole app to record
  // it. Determined by a one-shot query when the sighting is created (best
  // effort; a tie between two simultaneous loggers can flag both). This is the
  // raw CLAIM — the gold "first on Pocket Birds" decoration only renders once
  // it's also `verified` (see below).
  globalFirst?: boolean;

  // A global-first claim only earns its gold decoration when an admin confirms
  // it's a real, photographed sighting (guards against joke logs claiming a
  // species). `verified` gates every global-first render; verifiedBy/At are the
  // audit trail. Set via the admin-only verify action; rule-enforced.
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;

  // Social engagement, denormalized onto the sighting doc and maintained
  // server-side by Cloud Functions (see Hoot & Comments data model). Missing
  // is treated as zero/empty on older sightings.
  hootCount?: number;
  commentCount?: number;
  recentHooters?: { uid: string; username: string }[];
  topComment?: { uid: string; username: string; text: string };

  // Community ID (Mystery Bird only), denormalized + server-maintained.
  // proposalCount drives the "needs ID · N proposals" feed cue without a
  // per-card listener; leadingProposal is the current front-runner.
  proposalCount?: number;
  leadingProposal?: {
    proposalId: string;
    species: string;
    uid: string;
    username: string;
    hootCount: number;
  };
  // Set when a Mystery Bird was resolved by accepting a community proposal.
  identifiedVia?: 'community';
  identifiedBy?: string;          // uid of the proposer whose ID was accepted
  identifiedByUsername?: string;  // denormalized at accept time, for the card credit (Q-9)
  identifiedAt?: Date;
}

// A community-ID proposal on a Mystery Bird, stored at
// sightings/{sightingId}/proposals/{proposalId}. Species is the COMMON NAME
// ONLY — no Latin/scientific name is stored or surfaced anywhere.
export interface Proposal {
  id: string;            // auto doc id
  uid: string;           // proposer
  username: string;      // denormalized so the list needs no extra reads
  species: string;       // common name only
  speciesLower: string;  // lowercased, for the dupe-guard + matching
  note?: string;         // optional reasoning, trimmed, max ~280
  hootCount: number;     // maintained by a Cloud Function
  createdAt: Date | null; // null briefly while serverTimestamp resolves
  accepted?: boolean;    // set true by the accept transaction
}

// One agreement vote on a proposal, at .../proposals/{id}/hoots/{hooterUid}.
// Doc id IS the hooter's uid (one hoot per user per proposal, structurally).
export interface ProposalHoot {
  uid: string;
  username: string;
  createdAt: Date | null;
}

export interface FriendSighting extends Sighting {
  friendName: string;
  friendAvatar?: string;
  friendId?: string; // poster's uid — lets the feed tag link to their profile
}

// Adding a default export to fix the warning
// We're creating an empty object as the default export since types.ts is not a React component
export default {}; 