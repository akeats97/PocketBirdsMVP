import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { auth } from '../../config/firebaseConfig';
import { addSightingToFirebase, deleteSightingFromFirebase, getUserSightingsFromFirebase, newSightingId, setSightingGlobalFirstVerified, updateSightingInFirebase } from '../services/sightingService';
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

// The set of fields an edit may change. Everything else on a sighting
// (ownership, sync bookkeeping, engagement counts) is owned by the system.
export type SightingPatch = Partial<
  Pick<Sighting, 'birdName' | 'location' | 'date' | 'notes' | 'photoUrl' | 'photoPath' | 'coordinates'>
>;

interface SightingsContextType {
  sightings: Sighting[];
  lastLocation: LastLocation;
  addSighting: (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>) => AddSightingResult;
  // Edit an existing sighting. Merges the patch, recomputes new-species /
  // milestone for the (possibly changed) birdName — excluding the sighting
  // being edited from the species math — and returns the result for the NEW
  // birdName so the edit form can celebrate a lifer. A name that didn't change
  // never reads as a new species (and never notifies — see onSightingUpdated).
  updateSighting: (sightingId: string, patch: SightingPatch) => AddSightingResult;
  deleteSighting: (sightingId: string) => Promise<{ success: boolean; wasLastOfSpecies: boolean }>;
  syncSightings: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  isNewSpeciesForUser: (birdName: string, sightingDate: Date) => boolean;
  // Flag the user's just-logged sighting of this species as a global first (no
  // one on PocketBirds had it before). The flag rides the normal sync up to
  // Firestore (the sighting is still 'pending' at this point).
  markGlobalFirst: (birdName: string) => void;
  // Admin-only: confirm/revoke verification on one of your own sightings (then
  // the species' global-first holder is recomputed). Writes through to
  // Firestore; rule-enforced.
  setGlobalFirstVerified: (sightingId: string, birdName: string, verified: boolean) => Promise<void>;
  // Would logging this species right now be a new species for the user, and
  // would it cross a milestone? Pure detection (no write). Shared by the Add
  // flow and the Community ID accept flow so they can't drift.
  evaluateNewSpecies: (birdName: string, excludeId?: string) => AddSightingResult;
  // Resolve a Mystery Bird in local state by rewriting its birdName to the
  // accepted species (the Firestore write is done separately by
  // proposalService.acceptProposal). Makes the species count toward the Dex
  // immediately, and stamps milestoneCrossed if this acceptance crossed one.
  applyCommunityId: (sightingId: string, species: string, milestone: number | null) => void;
}

const SightingsContext = createContext<SightingsContextType | undefined>(undefined);

const STORAGE_KEY = 'birdSightings';
const LOCATION_KEY = 'lastLocation';
const PENDING_DELETIONS_KEY = 'pendingDeletions';
const PENDING_UPDATES_KEY = 'pendingUpdates';

// Combine the authoritative server list with whatever local rows are still
// unsynced. Synced rows in `prev` are discarded — Firebase is source of truth
// for them. A local pending row sharing an id with a server row is the
// lost-ack case: the create landed on the server but the client never saw the
// ack, so the row is still pending locally under that same (client-minted) id.
// We drop the local copy and keep the server one — this is how idempotent ids
// dedupe a write whose response was lost.
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
  // Ids of already-synced rows whose edits couldn't be pushed yet (offline /
  // failed). Analogous to pendingDeletions; drained by syncSightings. Edits to
  // not-yet-synced rows don't need this — their new fields ride the create.
  const [pendingUpdates, setPendingUpdates] = useState<string[]>([]);
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
        const storedPendingUpdates = await AsyncStorage.getItem(PENDING_UPDATES_KEY);

        if (storedSightings !== null) {
          // Need to parse the dates back to Date objects and add sync status if missing
          const parsedSightings = JSON.parse(storedSightings).map((sighting: any) => {
            const result: Sighting = {
              ...sighting,
              date: new Date(sighting.date),
              lastModified: new Date(sighting.lastModified || sighting.date),
              createdAt: new Date(sighting.createdAt || sighting.date),
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

        if (storedPendingUpdates !== null) {
          setPendingUpdates(JSON.parse(storedPendingUpdates));
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

  // Save pending updates to AsyncStorage whenever they change
  useEffect(() => {
    const savePendingUpdates = async () => {
      try {
        await AsyncStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(pendingUpdates));
      } catch (error) {
        console.error('Failed to save pending updates:', error);
      }
    };

    if (!isLoading) {
      savePendingUpdates();
    }
  }, [pendingUpdates, isLoading]);

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
        // Wait for AsyncStorage loading to complete before loading Firebase data
        if (!isLoading) {
          await loadFirebaseData();
        }
      }
      // On logout, data is already cleared by clearLocalData in the logout handler.
    });

    return () => unsubscribe();
  }, [isLoading]); // Add isLoading as dependency so it re-runs when loading completes

  const loadFirebaseData = async () => {
    try {
      // First, process any pending deletions before fetching fresh data
      if (pendingDeletions.length > 0) {
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

      const firebaseSightings = await getUserSightingsFromFirebase();
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
    
    const successfulDeletions: string[] = [];

    for (const sightingId of pendingDeletions) {
      try {
        await deleteSightingFromFirebase(sightingId);
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
      setPendingDeletions(prev => prev.filter(id => !successfulDeletions.includes(id)));
    }
  };

  // Push edits to already-synced rows that couldn't go out at edit time
  // (offline / failed). Uploads a newly-attached local photo first, then
  // updateDoc. A plain updateDoc never triggers onSightingAdded, so silent
  // edits stay silent. Drops ids that no longer exist or aren't synced.
  const processPendingUpdates = async () => {
    if (pendingUpdates.length === 0) return;

    const resolved: string[] = [];
    for (const id of pendingUpdates) {
      const sighting = sightings.find(s => s.id === id);
      if (!sighting) {
        // Row was deleted in the meantime — nothing to update.
        resolved.push(id);
        continue;
      }
      if (sighting.syncStatus !== 'synced') {
        // Never made it to Firebase; the create path will carry its fields.
        resolved.push(id);
        continue;
      }
      try {
        let toSync = sighting;
        if (sighting.photoPath && !sighting.photoUrl) {
          const photoUrl = await uploadPhoto(sighting.photoPath, sighting.id);
          toSync = { ...sighting, photoUrl };
          setSightings(prev =>
            prev.map(s => (s.id === id ? { ...s, photoUrl } : s))
          );
        }
        await updateSightingInFirebase(toSync);
        resolved.push(id);
      } catch (error) {
        console.error(`Failed to push pending update for ${id}; will retry:`, error);
      }
    }

    if (resolved.length > 0) {
      setPendingUpdates(prev => prev.filter(id => !resolved.includes(id)));
    }
  };

  // Pure new-species / milestone detection for a given species name, evaluated
  // against the user's CURRENT sightings (i.e. as if `birdName` were logged
  // right now). No writes. Shared by addSighting and the Community ID accept
  // flow so the two can never drift.
  //
  // Bug Report / Feature Request entries ride this pipeline but aren't real
  // species — they never count as a new species or toward milestones, and
  // they're excluded from the species math so they don't inflate counts for
  // real birds logged afterward. "Mystery Bird" (unidentified) entries count
  // as real sightings but likewise never add a species, so they're excluded
  // from the species math here too. Custom easter-egg species (e.g. Kelsey)
  // DO get the new-species celebration on first log, but are likewise kept
  // out of the species count + milestone math.
  // `excludeId` drops one sighting from the comparison pool — used when editing
  // a sighting so "changed to a species I already have elsewhere" reads as not
  // new, and "changed away from a species this was the only record of" frees
  // that slot. Add / accept flows pass no excludeId.
  const evaluateNewSpecies = (birdName: string, excludeId?: string): AddSightingResult => {
    const isReport = isReportEntry(birdName);
    const isUnknown = isUnknownEntry(birdName);
    const isCustom = isCustomSpecies(birdName);
    const pool = excludeId ? sightings.filter(s => s.id !== excludeId) : sightings;
    const speciesSightings = pool.filter(
      s => !isReportEntry(s.birdName) && !isUnknownEntry(s.birdName) && !isCustomSpecies(s.birdName)
    );

    // Check if this is a new species (case-insensitive match against existing).
    // Custom species celebrate on their first log too, checked against prior
    // sightings of that same custom name (not the real-species base above).
    const isNewSpecies = isCustom
      ? !pool.some(s => s.birdName.toLowerCase() === birdName.toLowerCase())
      : !isReport && !isUnknown && !speciesSightings.some(existingSighting =>
          existingSighting.birdName.toLowerCase() === birdName.toLowerCase()
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

    return { isNewSpecies, milestone };
  };

  const addSighting = (sighting: Omit<Sighting, 'id' | 'syncStatus' | 'lastModified'>): AddSightingResult => {
    const { isNewSpecies, milestone } = evaluateNewSpecies(sighting.birdName);

    const newSighting: Sighting = {
      ...sighting,
      // Firestore-style id minted up front so the create is idempotent (a
      // retried write after a lost ack rewrites the same doc, not a duplicate).
      id: newSightingId(),
      syncStatus: 'pending',
      lastModified: new Date(),
      createdAt: new Date(),
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

  const updateSighting = (sightingId: string, patch: SightingPatch): AddSightingResult => {
    const existing = sightings.find(s => s.id === sightingId);
    if (!existing) {
      console.warn(`updateSighting: no sighting with id ${sightingId}`);
      return { isNewSpecies: false, milestone: null };
    }

    const newName = patch.birdName ?? existing.birdName;
    const nameChanged = newName.toLowerCase() !== existing.birdName.toLowerCase();
    // Only a name change can turn this into a new species. An unchanged name
    // never reads as new (and never notifies — onSightingUpdated only fires on
    // a birdName change). Exclude this sighting from the species math so the
    // comparison is against the user's OTHER records.
    const { isNewSpecies, milestone } = nameChanged
      ? evaluateNewSpecies(newName, sightingId)
      : { isNewSpecies: false, milestone: null };

    const now = new Date();
    const merged: Sighting = {
      ...existing,
      ...patch,
      lastModified: now,
      ...(milestone !== null ? { milestoneCrossed: milestone } : {}),
    };

    setSightings(prev => prev.map(s => (s.id === sightingId ? merged : s)));

    // Note: unlike addSighting, an edit does NOT update lastLocation — editing
    // an old sighting shouldn't change the prefill for the next new sighting.

    // Already-synced rows need a Firestore updateDoc. Try immediately when
    // online; otherwise queue for syncSightings. Pending/error rows are still
    // in the create queue, so their edited fields ride the eventual create —
    // nothing extra to do. We push `merged` (not state) to avoid a stale read.
    if (existing.syncStatus === 'synced') {
      (async () => {
        try {
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) {
            setPendingUpdates(prev => (prev.includes(sightingId) ? prev : [...prev, sightingId]));
            return;
          }
          let toSync = merged;
          if (merged.photoPath && !merged.photoUrl) {
            const photoUrl = await uploadPhoto(merged.photoPath, merged.id);
            toSync = { ...merged, photoUrl };
            setSightings(prev => prev.map(s => (s.id === sightingId ? { ...s, photoUrl } : s)));
          }
          await updateSightingInFirebase(toSync);
        } catch (error) {
          console.error('Failed to update sighting in Firebase; queuing for retry:', error);
          setPendingUpdates(prev => (prev.includes(sightingId) ? prev : [...prev, sightingId]));
        }
      })();
    }

    return { isNewSpecies, milestone };
  };

  const syncSightings = async () => {
    if (isSyncingRef.current) {
      return;
    }
    isSyncingRef.current = true;
    try {
      // Process pending deletions first
      await processPendingDeletions();

      // Then push any edits to already-synced rows that were queued offline.
      await processPendingUpdates();

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
      await AsyncStorage.removeItem(PENDING_UPDATES_KEY);
      allowNextEmptyPersistRef.current = true;
      setSightings([]);
      setLastLocation({ label: '' });
      setPendingDeletions([]);
      setPendingUpdates([]);
    } catch (error) {
      console.error('Failed to clear local data:', error);
    }
  };

  const markGlobalFirst = (birdName: string) => {
    const key = birdName.toLowerCase();
    setSightings(prev => {
      let changed = false;
      const next = prev.map(s => {
        if (s.birdName.toLowerCase() === key && !s.globalFirst) {
          changed = true;
          return { ...s, globalFirst: true };
        }
        return s;
      });
      return changed ? next : prev;
    });
  };

  // Admin-only: confirm/revoke verification on one of YOUR OWN sightings, then
  // reflect the species' recomputed global-first holder locally (Option B). The
  // service returns who now holds the gold for that species; we flip `verified`
  // on the target and set `globalFirst` on your own sightings of that species to
  // match (true only on the holder). Friends' docs update via their live feed
  // snapshot; their profile Dex refreshes on next visit.
  const setGlobalFirstVerified = async (sightingId: string, birdName: string, verified: boolean) => {
    const { holderId } = await setSightingGlobalFirstVerified(sightingId, birdName, verified);
    setSightings(prev => prev.map(s => {
      let next = s;
      if (s.id === sightingId) next = { ...next, verified };
      if (s.birdName === birdName) next = { ...next, globalFirst: next.id === holderId };
      return next;
    }));
  };

  const applyCommunityId = (sightingId: string, species: string, milestone: number | null) => {
    setSightings(prev =>
      prev.map(s =>
        s.id === sightingId
          ? {
              ...s,
              birdName: species,
              lastModified: new Date(),
              identifiedVia: 'community',
              ...(milestone !== null ? { milestoneCrossed: milestone } : {}),
            }
          : s
      )
    );
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
    <SightingsContext.Provider value={{ sightings, lastLocation, addSighting, updateSighting, deleteSighting, syncSightings, clearLocalData, isNewSpeciesForUser, markGlobalFirst, setGlobalFirstVerified, evaluateNewSpecies, applyCommunityId }}>
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