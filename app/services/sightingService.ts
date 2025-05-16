import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { Sighting } from '../types';

// Add a new sighting to Firestore
export async function addSightingToFirebase(sighting: Sighting): Promise<void> {
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
      lastModified: Timestamp.fromDate(sighting.lastModified),
      createdAt: Timestamp.now()
    };
    
    await addDoc(sightingsRef, firestoreSighting);
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
      lastModified: Timestamp.fromDate(sighting.lastModified)
    });
  } catch (error) {
    console.error('Error updating sighting in Firebase:', error);
    throw error;
  }
} 