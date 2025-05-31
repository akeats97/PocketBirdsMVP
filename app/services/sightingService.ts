import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
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
    const firestoreSighting = {
      userId: currentUser.uid,
      birdName: sighting.birdName,
      location: sighting.location,
      date: Timestamp.fromDate(sighting.date),
      notes: sighting.notes || '',
      photoUrl: sighting.photoUrl || null,
      lastModified: Timestamp.fromDate(sighting.lastModified),
      createdAt: Timestamp.now()
    };
    
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
      return {
        id: doc.id,
        birdName: data.birdName,
        location: data.location,
        date: data.date.toDate(),
        notes: data.notes,
        photoUrl: data.photoUrl || undefined,
        lastModified: data.lastModified.toDate(),
        syncStatus: 'synced' // All sightings from Firebase are synced
      };
    });
  } catch (error) {
    console.error('Error getting user sightings from Firebase:', error);
    return [];
  }
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
    
    await updateDoc(sightingRef, {
      birdName: sighting.birdName,
      location: sighting.location,
      date: Timestamp.fromDate(sighting.date),
      notes: sighting.notes || '',
      photoUrl: sighting.photoUrl || null,
      lastModified: Timestamp.fromDate(sighting.lastModified)
    });
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
  updateSightingInFirebase,
  deleteSightingFromFirebase
};

export default sightingService; 