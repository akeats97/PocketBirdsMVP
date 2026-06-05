import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { auth } from '../../config/firebaseConfig';
import { addSightingToFirebase, deleteSightingFromFirebase, getUserSightingsFromFirebase } from '../services/sightingService';
import { uploadPhoto } from '../services/photoService';
import { isMilestone } from '../constants/milestones';
import { isReportEntry } from '../../constants/reportTypes';
import { isUnknownEntry } from '../../constants/unknownBird';
import { isCustomSpecies } from '../../constants/customSpecies';
import { Coordinates, Sighting } from '../types';

export interface AddSightingResult {
  isNewSpecies: boolean;
  milestone: number | null; // unique-species count if THIS save crossed a milestone
}

export interface LastLocation {
  label: string;
  coordinates?: Coordinates;
}

interface SightingsContextType {
  sightings: Sighting[];
  lastLocation: LastLocation;
  addSighting: (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>) => AddSightingResult;
  deleteSighting: (sightingId: string) => Promise<{ success: boolean; wasLastOfSpecies: boolean }>;
  syncSightings: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  isNewSpeciesForUser: (birdName: string, sightingDate: Date) => boolean;
}

const SightingsContext = createContext<SightingsContextType | undefined>(undefined);

const STORAGE_KEY = 'birdSightings';
const LOCATION_KEY = 'lastLocation';
const PENDING_DELETIONS_KEY = 'pendingDeletions';

// Combine the authoritative server list with whatever local rows are still
// unsynced. Synced rows in `prev` are discarded — Firebase is source of truth
// for them. If a local pending row shares an id with a server row (shouldn't
// happen since pending ids are local timestamps, but defensive), the server
// copy wins.
function mergeFirebaseSightings(
  prev: Sighting[],
  firebaseSightings: Sighting[],
): Sighting[] {
  const firebaseIds = new Set(firebaseSightings.map(s => s.id));
  const keptLocal: Sighting[] = [];
  for (const s of prev) {
    if (s.syncStatus === 'synced') continue;
    if (firebaseIds.has(s.id)) {
      console.warn(`Sighting id collision for ${s.id}; preferring server copy.`);
      continue;
    }
    keptLocal.push(s);
  }
  return [...keptLocal, ...firebaseSightings];
}

export function SightingsProvider({ children }: { children: React.ReactNode }) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [lastLocation, setLastLocation] = useState<LastLocation>({ label: '' });
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // NetInfo can fire multiple "online" events in quick succession when wifi
  // toggles on (isConnected, isInternetReachable, type all change). Without
  // this guard, syncSightings runs in parallel and creates duplicate docs.
  const isSyncingRef = useRef(false);
  // Defense in depth against the offline data-loss bug: the autosave effect
  // refuses to write [] to AsyncStorage unless something explicitly opted in
  // by setting this flag. Set before any setSightings call that's expected
  // to legitimately result in empty (delete, clear, successful Firebase
  // fetch). Reset after each successful persist.
  const allowNextEmptyPersistRef = useRef(false);

  // Load sightings data from AsyncStorage on startup
  useEffect(() => {
    const loadSightings = async () => {
      try {
        const storedSightings = await AsyncStorage.getItem(STORAGE_KEY);
        const storedLocation = await AsyncStorage.getItem(LOCATION_KEY);
        const storedPendingDeletions = await AsyncStorage.getItem(PENDING_DELETIONS_KEY);
        
        if (storedSightings !== null) {
          // Need to parse the dates back to Date objects and add sync status if missing
          const parsedSightings = JSON.parse(storedSightings).map((sighting: any) => {
            const result: Sighting = {
              ...sighting,
              date: new Date(sighting.date),
              lastModified: new Date(sighting.lastModified || sighting.date),
              syncStatus: sighting.syncStatus || 'pending'
            };
            if (sighting.coordinates) {
              result.coordinates = {
                ...sighting.coordinates,
                capturedAt: sighting.coordinates.capturedAt
                  ? new Date(sighting.coordinates.capturedAt)
                  : undefined,
              };
            }
            return result;
          });
          setSightings(parsedSightings);
        }

        if (storedLocation !== null) {
          // Legacy shape was a plain string; new shape is JSON {label, coordinates?}.
          // Migrate transparently.
          let parsed: LastLocation;
          try {
            const maybeObj = JSON.parse(storedLocation);
            if (maybeObj && typeof maybeObj === 'object' && typeof maybeObj.label === 'string') {
              parsed = {
                label: maybeObj.label,
                coordinates: maybeObj.coordinates
                  ? {
                      ...maybeObj.coordinates,
                      capturedAt: maybeObj.coordinates.capturedAt
                        ? new Date(maybeObj.coordinates.capturedAt)
                        : undefined,
                    }
                  : undefined,
              };
            } else {
              parsed = { label: storedLocation };
            }
          } catch {
            // Not valid JSON — assume legacy bare string.
            parsed = { label: storedLocation };
          }
          setLastLocation(parsed);
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

    if (isLoading) return;

    if (sightings.length === 0 && !allowNextEmptyPersistRef.current) {
      console.warn(
        'SightingsContext: refusing to persist empty sightings — no explicit clear/fetch was performed. ' +
        'Possible regression in fetch/load code paths.'
      );
      return;
    }

    saveSightings();
    allowNextEmptyPersistRef.current = false;
  }, [sightings, isLoading]);

  // Save lastLocation to AsyncStorage whenever it changes
  useEffect(() => {
    const saveLocation = async () => {
      try {
        await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(lastLocation));
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    };

    if (!isLoading && lastLocation.label) {
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

      // Don't even try the fetch if we're offline — the throw would just be
      // caught and logged, but it's cleaner to short-circuit. The connectivity
      // listener will re-run sync on reconnect.
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('Offline on startup — keeping cached sightings, skipping Firebase fetch.');
        return;
      }

      console.log('Fetching sightings from Firebase...');
      const firebaseSightings = await getUserSightingsFromFirebase();
      console.log(`Loaded ${firebaseSightings.length} sightings from Firebase`);
      allowNextEmptyPersistRef.current = true;
      setSightings(prev => mergeFirebaseSightings(prev, firebaseSightings));
    } catch (error) {
      // getUserSightingsFromFirebase now throws on network/auth errors; catching
      // here means the local cache is left intact when the fetch fails.
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

  const addSighting = (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>): AddSightingResult => {
    // Bug Report / Feature Request entries ride this pipeline but aren't real
    // species — they never count as a new species or toward milestones, and
    // they're excluded from the species math so they don't inflate counts for
    // real birds logged afterward. "Mystery Bird" (unidentified) entries count
    // as real sightings but likewise never add a species, so they're excluded
    // from the species math here too. Custom easter-egg species (e.g. Kelsey)
    // DO get the new-species celebration on first log, but are likewise kept
    // out of the species count + milestone math.
    const isReport = isReportEntry(sighting.birdName);
    const isUnknown = isUnknownEntry(sighting.birdName);
    const isCustom = isCustomSpecies(sighting.birdName);
    const speciesSightings = sightings.filter(
      s => !isReportEntry(s.birdName) && !isUnknownEntry(s.birdName) && !isCustomSpecies(s.birdName)
    );

    // Check if this is a new species (case-insensitive match against existing).
    // Custom species celebrate on their first log too, checked against prior
    // sightings of that same custom name (not the real-species base above).
    const isNewSpecies = isCustom
      ? !sightings.some(s => s.birdName.toLowerCase() === sighting.birdName.toLowerCase())
      : !isReport && !isUnknown && !speciesSightings.some(existingSighting =>
          existingSighting.birdName.toLowerCase() === sighting.birdName.toLowerCase()
        );

    // Compute the user's unique-species count AFTER this save and decide
    // whether it crossed a milestone (5, 10, 25, 50, 100, then every 50).
    // Custom species never increment the count, so they never trigger one.
    let milestone: number | null = null;
    if (isNewSpecies && !isCustom) {
      const uniqueBefore = new Set(
        speciesSightings.map(s => s.birdName.toLowerCase())
      ).size;
      const uniqueAfter = uniqueBefore + 1;
      if (isMilestone(uniqueAfter)) {
        milestone = uniqueAfter;
      }
    }

    const newSighting: Sighting = {
      ...sighting,
      id: Date.now().toString(),
      syncStatus: 'pending',
      lastModified: new Date(),
      ...(milestone !== null ? { milestoneCrossed: milestone } : {}),
    };
    setSightings(prev => [newSighting, ...prev]);
    // Don't remember an empty location (e.g. a report logged with no place),
    // which would otherwise wipe the prefill for the next real sighting.
    if (sighting.location) {
      setLastLocation({
        label: sighting.location,
        coordinates: sighting.coordinates,
      });
    }

    return { isNewSpecies, milestone };
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
      allowNextEmptyPersistRef.current = true;
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
    if (isSyncingRef.current) {
      return;
    }
    isSyncingRef.current = true;
    try {
      // Process pending deletions first
      await processPendingDeletions();

      // Get all sightings that need to be synced (pending OR previously errored)
      const pendingSightings = sightings.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'error');
      
      if (pendingSightings.length === 0) {
        return;
      }

      // Try to sync each pending sighting
      for (const sighting of pendingSightings) {
        try {
          // If a local photo was attached but never uploaded, upload it now
          // and stamp the resulting URL onto the sighting before creating the
          // Firestore doc.
          let toSync = sighting;
          if (sighting.photoPath && !sighting.photoUrl) {
            const photoUrl = await uploadPhoto(sighting.photoPath, sighting.id);
            toSync = { ...sighting, photoUrl };
          }

          const firebaseId = await addSightingToFirebase(toSync);

          // Update local state with Firebase ID, photoUrl (if uploaded), and
          // mark as synced.
          setSightings(prev =>
            prev.map(s =>
              s.id === sighting.id
                ? { ...s, id: firebaseId, photoUrl: toSync.photoUrl, syncStatus: 'synced' }
                : s
            )
          );
        } catch (error) {
          console.error(`Failed to sync sighting ${sighting.id}:`, error);

          // Mark as error in local state. Will be retried on next sync.
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
      allowNextEmptyPersistRef.current = true;
      setSightings(prev => mergeFirebaseSightings(prev, firebaseSightings));
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  const clearLocalData = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(LOCATION_KEY);
      await AsyncStorage.removeItem(PENDING_DELETIONS_KEY);
      allowNextEmptyPersistRef.current = true;
      setSightings([]);
      setLastLocation({ label: '' });
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