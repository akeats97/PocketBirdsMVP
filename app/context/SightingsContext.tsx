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
}

const SightingsContext = createContext<SightingsContextType | undefined>(undefined);

const STORAGE_KEY = 'birdSightings';
const LOCATION_KEY = 'lastLocation';

export function SightingsProvider({ children }: { children: React.ReactNode }) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [lastLocation, setLastLocation] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load sightings data from AsyncStorage on startup
  useEffect(() => {
    const loadSightings = async () => {
      try {
        const storedSightings = await AsyncStorage.getItem(STORAGE_KEY);
        const storedLocation = await AsyncStorage.getItem(LOCATION_KEY);
        
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
        console.log('User logged in, loading Firebase data...');
        await loadFirebaseData();
      } else {
        console.log('User logged out');
        // Data is already cleared by clearLocalData in logout handler
      }
    });

    return () => unsubscribe();
  }, []);

  const loadFirebaseData = async () => {
    try {
      console.log('Fetching sightings from Firebase...');
      const firebaseSightings = await getUserSightingsFromFirebase();
      console.log(`Loaded ${firebaseSightings.length} sightings from Firebase`);
      setSightings(firebaseSightings);
    } catch (error) {
      console.error('Error loading Firebase data:', error);
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

      // Remove from local state
      setSightings(prev => prev.filter(s => s.id !== sightingId));

      // Try to delete from Firebase if it's synced
      if (sightingToDelete.syncStatus === 'synced') {
        try {
          await deleteSightingFromFirebase(sightingId);
        } catch (error) {
          console.error('Failed to delete from Firebase:', error);
          // Don't fail the whole operation if Firebase delete fails
        }
      }

      return { success: true, wasLastOfSpecies };
    } catch (error) {
      console.error('Error deleting sighting:', error);
      return { success: false, wasLastOfSpecies: false };
    }
  };

  const syncSightings = async () => {
    try {
      // Get all pending sightings
      const pendingSightings = sightings.filter(s => s.syncStatus === 'pending');
      
      if (pendingSightings.length === 0) {
        return;
      }

      // Try to sync each pending sighting
      for (const sighting of pendingSightings) {
        try {
          await addSightingToFirebase(sighting);
          
          // Update local state to mark as synced
          setSightings(prev => 
            prev.map(s => 
              s.id === sighting.id 
                ? { ...s, syncStatus: 'synced' }
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
      setSightings([]);
      setLastLocation('');
    } catch (error) {
      console.error('Failed to clear local data:', error);
    }
  };

  return (
    <SightingsContext.Provider value={{ sightings, lastLocation, addSighting, deleteSighting, syncSightings, clearLocalData }}>
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