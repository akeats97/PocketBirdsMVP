import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../../config/firebaseConfig';
import {
  ActivityItem,
  markAllActivityRead,
  subscribeToActivity,
} from '../services/activityService';

interface ActivityContextType {
  /** Activity inbox items, newest first. */
  items: ActivityItem[];
  /** Count of unread items — drives the header bell's dot. */
  unreadCount: number;
  /** Mark everything read (call when the Activity screen opens). */
  markAllRead: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let unsubscribeActivity: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
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

  const unreadCount = items.reduce((n, item) => (item.read ? n : n + 1), 0);

  const markAllRead = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // Optimistic: flip local state immediately so the dot clears, then persist.
    setItems((prev) => prev.map((i) => (i.read ? i : { ...i, read: true })));
    await markAllActivityRead(uid);
  };

  return (
    <ActivityContext.Provider value={{ items, unreadCount, markAllRead }}>
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
