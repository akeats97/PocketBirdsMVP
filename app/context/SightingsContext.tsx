import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../../config/firebaseConfig';
import { addSightingToFirebase, deleteSightingFromFirebase, getUserSightingsFromFirebase } from '../services/sightingService';
import { Sighting } from '../types';

interface SightingsContextType {
  sightings: Sighting[];
  lastLocation: string;
  addSighting: (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>) => boolean;
  deleteSighting: (sightingId: string) => Promise<{ success: boolean; wasLastOfSpecies: boolean }>;
  syncSightings: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  isNewSpeciesForUser: (birdName: string, sightingDate: Date) => boolean;
}

const SightingsContext = createContext<SightingsContextType | undefined>(undefined);

const STORAGE_KEY = 'birdSightings';
const LOCATION_KEY = 'lastLocation';
const PENDING_DELETIONS_KEY = 'pendingDeletions';

export function SightingsProvider({ children }: { children: React.ReactNode }) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [lastLocation, setLastLocation] = useState('');
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load sightings data from AsyncStorage on startup
  useEffect(() => {
    const loadSightings = async () => {
      try {
        const storedSightings = await AsyncStorage.getItem(STORAGE_KEY);
        const storedLocation = await AsyncStorage.getItem(LOCATION_KEY);
        const storedPendingDeletions = await AsyncStorage.getItem(PENDING_DELETIONS_KEY);
        
        if (storedSightings !== null) {
          // Need to parse the dates back to Date objects and add sync status if missing
          const parsedSightings = JSON.parse(storedSightings).map((sighting: any) => ({
            ...sighting,
            date: new Date(sighting.date),
            lastModified: new Date(sighting.lastModified || sighting.date),
            syncStatus: sighting.syncStatus || 'pending'
          }));
          setSightings(parsedSightings);
        }
        
        if (storedLocation !== null) {
          setLastLocation(storedLocation);
        }

        if (storedPendingDeletions !== null) {
          setPendingDeletions(JSON.parse(storedPendingDeletions));
        }
      } catch (error) {
        console.error('Failed to load sightings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSightings();
  }, []);

  // Save sightings to AsyncStorage whenever sightings change
  useEffect(() => {
    const saveSightings = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sightings));
      } catch (error) {
        console.error('Failed to save sightings:', error);
      }
    };

    if (!isLoading) {
      saveSightings();
    }
  }, [sightings, isLoading]);

  // Save lastLocation to AsyncStorage whenever it changes
  useEffect(() => {
    const saveLocation = async () => {
      try {
        await AsyncStorage.setItem(LOCATION_KEY, lastLocation);
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    };

    if (!isLoading && lastLocation) {
      saveLocation();
    }
  }, [lastLocation, isLoading]);

  // Save pending deletions to AsyncStorage whenever they change
  useEffect(() => {
    const savePendingDeletions = async () => {
      try {
        await AsyncStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(pendingDeletions));
      } catch (error) {
        console.error('Failed to save pending deletions:', error);
      }
    };

    if (!isLoading) {
      savePendingDeletions();
    }
  }, [pendingDeletions, isLoading]);

  // Monitor network status and sync when online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected) {
        syncSightings();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sightings]);

  // Listen for auth state changes and load Firebase data on login
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        console.log('User logged in, waiting for local data to load...');
        // Wait for AsyncStorage loading to complete before loading Firebase data
        if (!isLoading) {
          console.log('Local data loaded, now loading Firebase data...');
          await loadFirebaseData();
        }
      } else {
        console.log('User logged out');
        // Data is already cleared by clearLocalData in logout handler
      }
    });

    return () => unsubscribe();
  }, [isLoading]); // Add isLoading as dependency so it re-runs when loading completes

  const loadFirebaseData = async () => {
    try {
      // First, process any pending deletions before fetching fresh data
      if (pendingDeletions.length > 0) {
        console.log('Processing pending deletions before loading Firebase data...');
        await processPendingDeletions();
      }
      
      console.log('Fetching sightings from Firebase...');
      const firebaseSightings = await getUserSightingsFromFirebase();
      console.log(`Loaded ${firebaseSightings.length} sightings from Firebase`);
      setSightings(firebaseSightings);
    } catch (error) {
      console.error('Error loading Firebase data:', error);
    }
  };

  // Extract pending deletions processing into a separate function
  const processPendingDeletions = async () => {
    if (pendingDeletions.length === 0) return;
    
    console.log(`Processing ${pendingDeletions.length} pending deletions:`, pendingDeletions);
    const successfulDeletions: string[] = [];
    
    for (const sightingId of pendingDeletions) {
      try {
        console.log(`Attempting to delete sighting ${sightingId} from Firebase...`);
        await deleteSightingFromFirebase(sightingId);
        console.log(`Successfully deleted sighting ${sightingId} from Firebase`);
        successfulDeletions.push(sightingId);
      } catch (error: any) {
        if (error.message?.includes('Not authorized')) {
          console.error(`Authorization error deleting sighting ${sightingId}:`, error);
        } else {
          console.warn(`Non-critical error deleting sighting ${sightingId}, marking as resolved:`, error);
          successfulDeletions.push(sightingId);
        }
      }
    }
    
    // Remove successfully deleted items from pending deletions
    if (successfulDeletions.length > 0) {
      console.log(`Removing ${successfulDeletions.length} successfully deleted sightings from pending queue:`, successfulDeletions);
      setPendingDeletions(prev => prev.filter(id => !successfulDeletions.includes(id)));
    }
    
    const remainingDeletions = pendingDeletions.filter(id => !successfulDeletions.includes(id));
    if (remainingDeletions.length > 0) {
      console.log(`${remainingDeletions.length} deletions remain pending:`, remainingDeletions);
    } else {
      console.log('All pending deletions processed successfully');
    }
  };

  const addSighting = (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>): boolean => {
    // Check if this is a new species
    const isNewSpecies = !sightings.some(existingSighting => 
      existingSighting.birdName.toLowerCase() === sighting.birdName.toLowerCase()
    );

    const newSighting: Sighting = {
      ...sighting,
      id: Date.now().toString(),
      syncStatus: 'pending',
      lastModified: new Date()
    };
    setSightings(prev => [newSighting, ...prev]);
    setLastLocation(sighting.location);
    
    return isNewSpecies;
  };

  const deleteSighting = async (sightingId: string): Promise<{ success: boolean; wasLastOfSpecies: boolean }> => {
    try {
      // Find the sighting to delete
      const sightingToDelete = sightings.find(s => s.id === sightingId);
      if (!sightingToDelete) {
        return { success: false, wasLastOfSpecies: false };
      }

      // Check if this is the last sighting of this species
      const sightingsOfSameSpecies = sightings.filter(s => 
        s.birdName.toLowerCase() === sightingToDelete.birdName.toLowerCase()
      );
      const wasLastOfSpecies = sightingsOfSameSpecies.length === 1;

      // Remove from local state immediately
      setSightings(prev => prev.filter(s => s.id !== sightingId));

      // Handle Firebase deletion based on sync status and network connectivity
      if (sightingToDelete.syncStatus === 'synced') {
        try {
          // Check if we're online
          const netInfo = await NetInfo.fetch();
          if (netInfo.isConnected) {
            // Online: try to delete immediately
            await deleteSightingFromFirebase(sightingId);
          } else {
            // Offline: queue for deletion when back online
            setPendingDeletions(prev => [...prev, sightingId]);
          }
        } catch (error) {
          console.error('Failed to delete from Firebase:', error);
          // If immediate deletion fails, queue it for later (but only if it was actually synced)
          if (sightingToDelete.syncStatus === 'synced') {
            setPendingDeletions(prev => [...prev, sightingId]);
          }
        }
      }
      // If syncStatus is 'pending' or 'error', no need to delete from Firebase since it was never successfully uploaded

      return { success: true, wasLastOfSpecies };
    } catch (error) {
      console.error('Error deleting sighting:', error);
      return { success: false, wasLastOfSpecies: false };
    }
  };

  const syncSightings = async () => {
    try {
      // Process pending deletions first
      await processPendingDeletions();

      // Get all pending sightings (additions)
      const pendingSightings = sightings.filter(s => s.syncStatus === 'pending');
      
      if (pendingSightings.length === 0) {
        return;
      }

      // Try to sync each pending sighting
      for (const sighting of pendingSightings) {
        try {
          const firebaseId = await addSightingToFirebase(sighting);
          
          // Update local state with Firebase ID and mark as synced
          setSightings(prev => 
            prev.map(s => 
              s.id === sighting.id 
                ? { ...s, id: firebaseId, syncStatus: 'synced' }
                : s
            )
          );
        } catch (error) {
          console.error(`Failed to sync sighting ${sighting.id}:`, error);
          
          // Mark as error in local state
          setSightings(prev => 
            prev.map(s => 
              s.id === sighting.id 
                ? { ...s, syncStatus: 'error' }
                : s
            )
          );
        }
      }

      // After syncing pending sightings, fetch latest from Firebase
      const firebaseSightings = await getUserSightingsFromFirebase();
      
      // Merge Firebase sightings with local sightings
      // Keep local pending/error sightings, but update synced ones
      setSightings(prev => {
        const localPending = prev.filter(s => s.syncStatus !== 'synced');
        const merged = [...localPending];
        
        // Add Firebase sightings, avoiding duplicates
        firebaseSightings.forEach(fbSighting => {
          const existingIndex = merged.findIndex(s => s.id === fbSighting.id);
          if (existingIndex === -1) {
            merged.push(fbSighting);
          }
        });
        
        return merged;
      });
    } catch (error) {
      console.error('Error during sync:', error);
    }
  };

  const clearLocalData = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(LOCATION_KEY);
      await AsyncStorage.removeItem(PENDING_DELETIONS_KEY);
      setSightings([]);
      setLastLocation('');
      setPendingDeletions([]);
    } catch (error) {
      console.error('Failed to clear local data:', error);
    }
  };

  const isNewSpeciesForUser = (birdName: string, sightingDate: Date): boolean => {
    // Find all sightings of this species
    const speciesSightings = sightings.filter(s => 
      s.birdName.toLowerCase() === birdName.toLowerCase()
    );
    
    // If no sightings of this species, it's definitely new
    if (speciesSightings.length === 0) {
      return true;
    }
    
    // Sort sightings by date to find the earliest one
    const sortedSightings = speciesSightings.sort((a, b) => a.date.getTime() - b.date.getTime());
    const earliestSighting = sortedSightings[0];
    
    // Check if the given sighting date matches the earliest sighting date
    // (within the same day to account for time differences)
    const sightingDateOnly = new Date(sightingDate.getFullYear(), sightingDate.getMonth(), sightingDate.getDate());
    const earliestDateOnly = new Date(earliestSighting.date.getFullYear(), earliestSighting.date.getMonth(), earliestSighting.date.getDate());
    
    return sightingDateOnly.getTime() === earliestDateOnly.getTime();
  };

  return (
    <SightingsContext.Provider value={{ sightings, lastLocation, addSighting, deleteSighting, syncSightings, clearLocalData, isNewSpeciesForUser }}>
      {children}
    </SightingsContext.Provider>
  );
}

export function useSightings() {
  const context = useContext(SightingsContext);
  if (context === undefined) {
    throw new Error('useSightings must be used within a SightingsProvider');
  }
  return context;
}

export default SightingsProvider; 