import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { auth } from '../../config/firebaseConfig';
import { removeHoot, setHoot, subscribeToMyHoots } from '../services/hootService';
import { getCurrentUserProfile } from '../services/userService';

interface HootsContextType {
  /** Has the current user hooted this sighting? */
  hasHooted: (sightingId: string) => boolean;
  /** Denormalized count carried on the sighting doc (maintained server-side). */
  hootCount: (sighting: { hootCount?: number }) => number;
  /** Optimistically toggle the current user's hoot on a sighting. */
  toggleHoot: (sightingId: string) => Promise<void>;
}

const HootsContext = createContext<HootsContextType | undefined>(undefined);

function HootsProvider({ children }: { children: React.ReactNode }) {
  // Set of sighting ids the current user has hooted, kept live.
  const [hootedIds, setHootedIds] = useState<Set<string>>(new Set());
  // Cached username for the denormalized hoot doc field.
  const usernameRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeHoots: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Tear down any previous user's listener.
      unsubscribeHoots?.();
      unsubscribeHoots = undefined;
      usernameRef.current = null;

      if (!user) {
        setHootedIds(new Set());
        return;
      }

      // Cache the username up front so toggleHoot doesn't have to fetch.
      const profile = await getCurrentUserProfile();
      usernameRef.current = profile?.username ?? null;

      unsubscribeHoots = subscribeToMyHoots(
        user.uid,
        (ids) => setHootedIds(ids),
        (error) => console.error('Error subscribing to hoots:', error)
      );
    });

    return () => {
      unsubscribeHoots?.();
      unsubscribeAuth();
    };
  }, []);

  const hasHooted = (sightingId: string) => hootedIds.has(sightingId);

  const hootCount = (sighting: { hootCount?: number }) => sighting.hootCount ?? 0;

  const toggleHoot = async (sightingId: string) => {
    const currentlyHooted = hootedIds.has(sightingId);

    // Optimistic flip — the collectionGroup listener will reconcile.
    setHootedIds((prev) => {
      const next = new Set(prev);
      if (currentlyHooted) next.delete(sightingId);
      else next.add(sightingId);
      return next;
    });

    try {
      if (currentlyHooted) {
        await removeHoot(sightingId);
      } else {
        // Resolve username lazily if it wasn't cached at sign-in.
        if (!usernameRef.current) {
          usernameRef.current = (await getCurrentUserProfile())?.username ?? '';
        }
        await setHoot(sightingId, usernameRef.current);
      }
    } catch (error) {
      console.error('Error toggling hoot:', error);
      // Revert on failure.
      setHootedIds((prev) => {
        const next = new Set(prev);
        if (currentlyHooted) next.add(sightingId);
        else next.delete(sightingId);
        return next;
      });
    }
  };

  return (
    <HootsContext.Provider value={{ hasHooted, hootCount, toggleHoot }}>
      {children}
    </HootsContext.Provider>
  );
}

export function useHoots() {
  const context = useContext(HootsContext);
  if (context === undefined) {
    throw new Error('useHoots must be used within a HootsProvider');
  }
  return context;
}

export default HootsProvider;
