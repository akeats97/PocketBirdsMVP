import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { Sighting } from '../types';

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

    const docRef = await addDoc(sightingsRef, firestoreSighting);

    return docRef.id; // Return the Firebase-generated ID
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
        syncStatus: 'synced',
        hootCount: data.hootCount ?? 0,
        commentCount: data.commentCount ?? 0,
        recentHooters: data.recentHooters ?? [],
        topComment: data.topComment ?? undefined,
        globalFirst: data.globalFirst ?? false,
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
// when you navigate into their profile. Firestore rules allow any signed-in
// user to read the `sightings` collection.
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
        syncStatus: 'synced',
        hootCount: data.hootCount ?? 0,
        commentCount: data.commentCount ?? 0,
        recentHooters: data.recentHooters ?? [],
        topComment: data.topComment ?? undefined,
        globalFirst: data.globalFirst ?? false,
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

// Photos of `birdName` taken by OTHER birders (excludes `excludeUid`, normally
// the signed-in user). Uses a single equality filter (no composite index
// needed — there is no birdName+date index) and sorts client-side. Capped at
// `max` newest. Best effort: throws on failure so the caller can show an error.
export async function getCommunityPhotosForSpecies(
  birdName: string,
  excludeUid?: string,
  max = 30,
): Promise<CommunityPhoto[]> {
  const sightingsRef = collection(db, 'sightings');
  const snap = await getDocs(query(sightingsRef, where('birdName', '==', birdName)));

  const rows = snap.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => data.photoUrl && data.userId && data.userId !== excludeUid)
    .map(({ id, data }) => ({
      id,
      uid: data.userId as string,
      photoUrl: data.photoUrl as string,
      location: (data.location as string) ?? '',
      date: data.date?.toDate?.() ?? new Date(data.date),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, max);

  // Resolve each distinct contributor's username once.
  const uids = [...new Set(rows.map(r => r.uid))];
  const names = new Map<string, string>();
  await Promise.all(
    uids.map(async uid => {
      try {
        const u = await getDoc(doc(db, 'users', uid));
        names.set(uid, u.exists() ? (u.data().username ?? '') : '');
      } catch {
        names.set(uid, '');
      }
    }),
  );

  return rows.map(r => ({ ...r, username: names.get(r.uid) ?? '' }));
}

// Has ANY PocketBirds user ever logged this species? Returns true if no
// matching sighting exists yet — i.e. the caller would be the global first.
// Matches on exact birdName (canonical names come from the IOC picker, so
// casing is consistent). Best effort: requires connectivity; throws on failure
// so callers can default to "not first".
export async function isGlobalFirstSpecies(birdName: string): Promise<boolean> {
  const sightingsRef = collection(db, 'sightings');
  const q = query(sightingsRef, where('birdName', '==', birdName), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
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
    if (sighting.globalFirst) {
      updatePayload.globalFirst = true;
    }
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