import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { auth } from '../../config/firebaseConfig';
import {
  ActivityItem,
  markAllActivityRead,
  markSightingActivityRead,
  subscribeToActivity,
} from '../services/activityService';

interface ActivityContextType {
  /** Activity inbox items, newest first. */
  items: ActivityItem[];
  /** Count of unread items — drives the header bell's dot. */
  unreadCount: number;
  /**
   * Per-sighting unread tally, derived from the activity stream. Drives the
   * Field Journal card unread cue. A selector over the already-subscribed
   * collection — no extra reads. Recency-bound by the 50-item subscription cap.
   */
  unreadBySighting: Record<string, number>;
  /** Mark everything read (call when the Activity screen opens). */
  markAllRead: () => Promise<void>;
  /** Mark one sighting's activity read (call when its detail opens). */
  markSightingRead: (sightingId: string) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let unsubscribeActivity: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeActivity?.();
      unsubscribeActivity = undefined;

      if (!user) {
        setItems([]);
        return;
      }

      unsubscribeActivity = subscribeToActivity(user.uid, setItems);
    });

    return () => {
      unsubscribeActivity?.();
      unsubscribeAuth();
    };
  }, []);

  const unreadCount = useMemo(
    () => items.reduce((n, item) => (item.read ? n : n + 1), 0),
    [items]
  );

  const unreadBySighting = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) {
      if (!i.read && i.sightingId) m[i.sightingId] = (m[i.sightingId] ?? 0) + 1;
    }
    return m;
  }, [items]);

  const markAllRead = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // Optimistic: flip local state immediately so the dot clears, then persist.
    setItems((prev) => prev.map((i) => (i.read ? i : { ...i, read: true })));
    await markAllActivityRead(uid);
  }, []);

  const markSightingRead = useCallback(async (sightingId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // Optimistic: clear this sighting's unread items locally, then persist.
    setItems((prev) =>
      prev.map((i) =>
        i.read || i.sightingId !== sightingId ? i : { ...i, read: true }
      )
    );
    await markSightingActivityRead(uid, sightingId);
  }, []);

  // Stable value object so consumers only re-render when a field they read
  // actually changes (the items/derived values), not on every provider render.
  const value = useMemo(
    () => ({ items, unreadCount, unreadBySighting, markAllRead, markSightingRead }),
    [items, unreadCount, unreadBySighting, markAllRead, markSightingRead]
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export default ActivityProvider;
