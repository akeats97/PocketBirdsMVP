import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { auth, db } from '../../config/firebaseConfig';

// The Goodreads-style annual species goal (PRD §7). Stored on the user's own
// Firestore doc (survives reinstalls, follows the account) and mirrored to
// AsyncStorage so the Dex hero renders instantly offline. A goal is only
// "active" for its own calendar year — Jan 1 the ring resets naturally and
// the hero invites a fresh goal instead of silently carrying the old target.

export interface DexGoal {
  year: number;
  target: number;
}

const STORAGE_KEY = 'dex.goal.v1';

export function isActiveGoal(goal: DexGoal | null): goal is DexGoal {
  return !!goal && goal.year === new Date().getFullYear() && goal.target > 0;
}

export function useDexGoal() {
  const [goal, setGoal] = useState<DexGoal | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cache first for an instant (and offline-safe) render…
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.year && parsed?.target) setGoal(parsed);
        }
      } catch {}
      // …then refresh from the user doc (it wins if they differ).
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, 'users', uid));
        const remote = snap.data()?.dexGoal;
        if (!cancelled && remote?.year && remote?.target) {
          setGoal(remote);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)).catch(() => {});
        }
      } catch {
        /* offline — the cached goal stands */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Always saves against the CURRENT year (you set goals for the year you're
  // in). Optimistic local update; the Firestore write is merge-only.
  const saveGoal = useCallback(async (target: number) => {
    const next: DexGoal = { year: new Date().getFullYear(), target };
    setGoal(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    try {
      const uid = auth.currentUser?.uid;
      if (uid) await setDoc(doc(db, 'users', uid), { dexGoal: next }, { merge: true });
    } catch (error) {
      console.error('Failed to save dex goal:', error);
      // Local copy already updated — the next launch's refresh will reconcile.
    }
  }, []);

  return { goal, saveGoal };
}

// Non-route file under app/ — default export silences the expo-router warning.
export default useDexGoal;
