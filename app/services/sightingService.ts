import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where } from '@react-native-firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { Sighting } from '../types';
import { callCloudFunction } from './functionsClient';

// True when a Firestore error is the rules saying "no" — the expected outcome
// when reading a PRIVATE, non-followed user's sightings (PL-1). Callers use it
// to render the private-profile stub instead of an error state.
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return code === 'firestore/permission-denied' || code === 'permission-denied';
}

// Mint a stable Firestore document id up front, so a sighting carries the SAME
// id locally and in Firestore from the moment it's created. This is what makes
// the create idempotent: if a write's ack is lost on a flaky connection (the
// doc lands on the server but the client sees a failure and retries), the retry
// re-writes the same id instead of creating a duplicate. Generated client-side
// with no network call.
export function newSightingId(): string {
  return doc(collection(db, 'sightings')).id;
}

// Add a new sighting to Firestore
export async function addSightingToFirebase(sighting: Sighting): Promise<string> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be logged in to add a sighting');
  }
  
  try {
    const sightingsRef = collection(db, 'sightings');
    
    // Convert Date objects to Firestore Timestamps
    const firestoreSighting: any = {
      userId: currentUser.uid,
      birdName: sighting.birdName,
      location: sighting.location,
      date: Timestamp.fromDate(sighting.date),
      notes: sighting.notes || '',
      photoUrl: sighting.photoUrl || null,
      lastModified: Timestamp.fromDate(sighting.lastModified),
      createdAt: Timestamp.now()
    };

    if (sighting.coordinates) {
      firestoreSighting.coordinates = {
        latitude: sighting.coordinates.latitude,
        longitude: sighting.coordinates.longitude,
        accuracy: sighting.coordinates.accuracy ?? null,
        capturedAt: sighting.coordinates.capturedAt
          ? Timestamp.fromDate(sighting.coordinates.capturedAt)
          : null,
      };
    }

    if (typeof sighting.milestoneCrossed === 'number') {
      firestoreSighting.milestoneCrossed = sighting.milestoneCrossed;
    }

    if (sighting.globalFirst) {
      firestoreSighting.globalFirst = true;
    }

    // setDoc to the sighting's own id (client-minted at creation) instead of
    // addDoc's random id, so a retried write after a lost ack is idempotent
    // rather than a duplicate. merge:true guards against clobbering any field a
    // concurrent writer (e.g. an early hoot) added between the two attempts.
    const sightingRef = doc(sightingsRef, sighting.id);
    await setDoc(sightingRef, firestoreSighting, { merge: true });

    return sighting.id;
  } catch (error) {
    console.error('Error adding sighting to Firebase:', error);
    throw error;
  }
}

// Get all sightings for the current user from Firebase
export async function getUserSightingsFromFirebase(): Promise<Sighting[]> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return [];
  }
  
  try {
    const sightingsRef = collection(db, 'sightings');
    const q = query(
      sightingsRef,
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const sighting: Sighting = {
        id: doc.id,
        birdName: data.birdName,
        location: data.location,
        date: data.date.toDate(),
        notes: data.notes,
        photoUrl: data.photoUrl || undefined,
        lastModified: data.lastModified.toDate(),
        createdAt: data.createdAt?.toDate?.() ?? data.date.toDate(),
        syncStatus: 'synced',
        hootCount: data.hootCount ?? 0,
        commentCount: data.commentCount ?? 0,
        recentHooters: data.recentHooters ?? [],
        topComment: data.topComment ?? undefined,
        globalFirst: data.globalFirst ?? false,
        verified: data.verified ?? false,
        identifiedVia: data.identifiedVia ?? undefined,
        identifiedBy: data.identifiedBy ?? undefined,
        identifiedByUsername: data.identifiedByUsername ?? undefined,
      };
      if (data.coordinates) {
        sighting.coordinates = {
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
          accuracy: data.coordinates.accuracy ?? undefined,
          capturedAt: data.coordinates.capturedAt?.toDate?.() ?? undefined,
        };
      }
      return sighting;
    });
  } catch (error) {
    // Re-throw so callers can distinguish "offline / network error" from
    // "user has no sightings". Swallowing this caused offline cold-start to
    // overwrite the local cache with [].
    console.error('Error getting user sightings from Firebase:', error);
    throw error;
  }
}

// Get any user's sightings by uid (for public profiles). Unlike
// getUserSightingsFromFirebase (which is scoped to the signed-in user via a
// live cache path), this is a one-shot read of another person's list — used
// when you navigate into their profile. Under the PL-1 rules this succeeds for
// public owners (the default) and owners you follow; for a PRIVATE non-followed
// owner it throws permission-denied — check with isPermissionDenied and render
// the private stub, not an error.
export async function getSightingsByUid(uid: string): Promise<Sighting[]> {
  try {
    const sightingsRef = collection(db, 'sightings');
    const q = query(
      sightingsRef,
      where('userId', '==', uid),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const sighting: Sighting = {
        id: doc.id,
        birdName: data.birdName,
        location: data.location,
        date: data.date?.toDate?.() ?? new Date(data.date),
        notes: data.notes,
        photoUrl: data.photoUrl || undefined,
        lastModified: data.lastModified?.toDate?.() ?? new Date(),
        createdAt: data.createdAt?.toDate?.() ?? data.date?.toDate?.() ?? new Date(data.date),
        syncStatus: 'synced',
        hootCount: data.hootCount ?? 0,
        commentCount: data.commentCount ?? 0,
        recentHooters: data.recentHooters ?? [],
        topComment: data.topComment ?? undefined,
        globalFirst: data.globalFirst ?? false,
        verified: data.verified ?? false,
        identifiedVia: data.identifiedVia ?? undefined,
        identifiedBy: data.identifiedBy ?? undefined,
        identifiedByUsername: data.identifiedByUsername ?? undefined,
      };
      if (data.coordinates) {
        sighting.coordinates = {
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
          accuracy: data.coordinates.accuracy ?? undefined,
          capturedAt: data.coordinates.capturedAt?.toDate?.() ?? undefined,
        };
      }
      return sighting;
    });
  } catch (error) {
    console.error(`Error getting sightings for uid ${uid}:`, error);
    throw error;
  }
}

// A community photo of a species, by another birder — feeds the Species Detail
// screen's Community gallery + lightbox. `username` is resolved from the
// contributor's user doc so the gallery needs no extra reads at render time.
export interface CommunityPhoto {
  id: string;        // sighting id
  uid: string;       // contributor's uid (resolves to their profile)
  username: string;  // resolved display name (may be '' mid-sync)
  photoUrl: string;
  location: string;
  date: Date;
}

// Photos of `birdName` from every PUBLIC birder. Pass `excludeUid` to drop one
// contributor (e.g. the signed-in user) — omit it for a full gallery that
// includes your own photos (WORK_QUEUE Q-13). Reads the Cloud-Function-
// maintained `communityPhotos` projection (PL-1), NOT the sightings collection:
// the tightened rules can't prove an app-wide sightings query, and the
// projection is what keeps private users' photos out. Username comes
// denormalized on the projection doc, so no per-contributor reads. Sorts
// client-side (single equality filter, no composite index). Capped at `max`
// newest. Best effort: throws on failure so the caller can show an error.
export async function getCommunityPhotosForSpecies(
  birdName: string,
  excludeUid?: string,
  max = 30,
): Promise<CommunityPhoto[]> {
  const photosRef = collection(db, 'communityPhotos');
  const snap = await getDocs(query(photosRef, where('species', '==', birdName)));

  return snap.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => data.photoUrl && data.uid && data.uid !== excludeUid)
    .map(({ id, data }) => ({
      id,
      uid: data.uid as string,
      username: (data.username as string) ?? '',
      photoUrl: data.photoUrl as string,
      location: (data.location as string) ?? '',
      date: data.date?.toDate?.() ?? new Date(),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, max);
}

// Reject a promise if it doesn't settle within `ms`. Used to cap the
// global-first server read so a wedged connection degrades to "not first"
// (the normal celebration) instead of leaving the Save flow waiting forever.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('global-first check timed out')), ms)
    ),
  ]);
}

// Has ANY PocketBirds user ever logged this species? Returns true if no
// matching sighting exists yet — i.e. the caller would be the global first.
// Matches on exact birdName (canonical names come from the IOC picker, so
// casing is consistent). Best effort: requires connectivity; throws on failure
// so callers can default to "not first".
//
// Runs through the checkGlobalFirst callable (PL-1): the app-wide sightings
// query it needs is no longer provable under the tightened read rules, so the
// scan happens server-side with Admin privileges. A callable is also
// inherently a server read — the old getDocsFromServer "never claim a first
// from an empty local cache" property comes for free.
export async function isGlobalFirstSpecies(birdName: string): Promise<boolean> {
  const res = await withTimeout(
    callCloudFunction<{ isFirst: boolean }>('checkGlobalFirst', { birdName }),
    5000
  );
  return res.isFirst;
}

// Update a sighting in Firebase
export async function updateSightingInFirebase(sighting: Sighting): Promise<void> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be logged in to update a sighting');
  }
  
  try {
    const sightingRef = doc(db, 'sightings', sighting.id);
    const sightingDoc = await getDoc(sightingRef);
    
    if (!sightingDoc.exists()) {
      throw new Error('Sighting not found in Firebase');
    }
    
    const data = sightingDoc.data();
    if (data.userId !== currentUser.uid) {
      throw new Error('Not authorized to update this sighting');
    }
    
    const updatePayload: any = {
      birdName: sighting.birdName,
      location: sighting.location,
      date: Timestamp.fromDate(sighting.date),
      notes: sighting.notes || '',
      photoUrl: sighting.photoUrl || null,
      lastModified: Timestamp.fromDate(sighting.lastModified)
    };
    // globalFirst is managed entirely by the verify-time recompute now (Option
    // B). An owner edit must NOT re-assert it, or a stale local flag could
    // resurrect a global-first that recompute moved to an earlier poster.
    if (sighting.coordinates) {
      updatePayload.coordinates = {
        latitude: sighting.coordinates.latitude,
        longitude: sighting.coordinates.longitude,
        accuracy: sighting.coordinates.accuracy ?? null,
        capturedAt: sighting.coordinates.capturedAt
          ? Timestamp.fromDate(sighting.coordinates.capturedAt)
          : null,
      };
    }
    await updateDoc(sightingRef, updatePayload);
  } catch (error) {
    console.error('Error updating sighting in Firebase:', error);
    throw error;
  }
}

// Log-input time used to rank global-first (createdAt, falling back to the
// observation date for older docs that predate createdAt). Mirrors the
// "first = when it was logged, not observed" rule.
function globalFirstRank(data: any): number {
  const c = data.createdAt;
  if (c?.toMillis) return c.toMillis();
  const d = data.date;
  if (d?.toMillis) return d.toMillis();
  return Number.MAX_SAFE_INTEGER;
}

// Recompute which sighting holds the global-first for a species: the
// EARLIEST-LOGGED sighting among the VERIFIED ones. Sets globalFirst=true on
// that holder and false on every other sighting of the species (so the gold
// reassigns quietly when an earlier poster is verified later, and clears when
// the holder is unverified). `override` lets the caller fold in a verify it just
// wrote, dodging a read-after-write race. Returns the new holder id (or null).
async function recomputeSpeciesGlobalFirst(
  birdName: string,
  override?: { id: string; verified: boolean }
): Promise<{ holderId: string | null }> {
  const snap = await getDocs(query(collection(db, 'sightings'), where('birdName', '==', birdName)));
  const docs = snap.docs.map(d => {
    const data = d.data();
    const verified = override && d.id === override.id ? override.verified : data.verified === true;
    return { id: d.id, verified, globalFirst: data.globalFirst === true, rank: globalFirstRank(data) };
  });
  const holderId =
    docs.filter(d => d.verified).sort((a, b) => a.rank - b.rank)[0]?.id ?? null;
  // Only write the docs whose flag actually flips.
  await Promise.all(
    docs
      .filter(d => (d.id === holderId) !== d.globalFirst)
      .map(d => updateDoc(doc(db, 'sightings', d.id), { globalFirst: d.id === holderId }))
  );
  return { holderId };
}

// Admin-only: confirm (or revoke) a sighting's verification, then recompute the
// species' global-first holder (Option B: earliest-logged among verified). The
// gold reassigns quietly — no notification to anyone who loses it. Unlike the
// owner-scoped update above, this writes to ANY user's sighting doc; the
// Firestore rule restricts it to admins and to the verification + globalFirst
// fields. Returns the species' new global-first holder so callers can reflect
// it in local state (friends' docs also propagate via the live feed snapshot).
export async function setSightingGlobalFirstVerified(
  sightingId: string,
  birdName: string,
  verified: boolean
): Promise<{ holderId: string | null }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be logged in to verify a sighting');
  }
  const sightingRef = doc(db, 'sightings', sightingId);
  await updateDoc(sightingRef, verified
    ? { verified: true, verifiedBy: currentUser.uid, verifiedAt: Timestamp.now() }
    : { verified: false, verifiedBy: null, verifiedAt: null });
  return recomputeSpeciesGlobalFirst(birdName, { id: sightingId, verified });
}

// Delete a sighting from Firebase
export async function deleteSightingFromFirebase(sightingId: string): Promise<void> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be logged in to delete a sighting');
  }
  
  try {
    const sightingRef = doc(db, 'sightings', sightingId);
    const sightingDoc = await getDoc(sightingRef);
    
    if (!sightingDoc.exists()) {
      // Sighting doesn't exist - this is actually success from our perspective
      // No need to throw an error or log anything
      return;
    }
    
    const data = sightingDoc.data();
    if (data.userId !== currentUser.uid) {
      throw new Error('Not authorized to delete this sighting');
    }
    
    await deleteDoc(sightingRef);
  } catch (error: any) {
    // Only log and throw errors that aren't "not found" related
    if (error.message?.includes('Not authorized')) {
      console.error('Authorization error deleting sighting from Firebase:', error);
      throw error;
    } else {
      // For other errors (network issues, etc.), log but don't throw
      // This allows the sync process to continue and mark the deletion as successful
      console.warn('Non-critical error during sighting deletion:', error);
    }
  }
}

const sightingService = {
  addSightingToFirebase,
  getUserSightingsFromFirebase,
  getSightingsByUid,
  updateSightingInFirebase,
  deleteSightingFromFirebase
};

export default sightingService; 