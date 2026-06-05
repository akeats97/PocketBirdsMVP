import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

export type ActivityType = 'hoot' | 'comment' | 'follow';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorUid: string;
  actorUsername: string;
  sightingId?: string;   // hoot / comment
  birdName?: string;     // hoot / comment
  commentText?: string;  // comment only
  read: boolean;
  createdAt: Date | null; // null briefly while serverTimestamp resolves
}

// Live subscription to the current user's activity inbox, newest first.
// Capped at 50 — the inbox is a recency feed, not an archive.
export function subscribeToActivity(
  uid: string,
  onItems: (items: ActivityItem[]) => void,
  onError?: (e: unknown) => void
): () => void {
  const q = query(
    collection(db, `users/${uid}/activity`),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ActivityItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          type: data.type,
          actorUid: data.actorUid,
          actorUsername: data.actorUsername ?? 'Someone',
          sightingId: data.sightingId,
          birdName: data.birdName,
          commentText: data.commentText,
          read: !!data.read,
          createdAt: data.createdAt?.toDate?.() ?? null,
        };
      });
      onItems(items);
    },
    (error) => {
      console.error('Error subscribing to activity:', error);
      onError?.(error);
    }
  );
}

// Mark every unread activity item read (called when the Activity screen opens).
export async function markAllActivityRead(uid: string): Promise<void> {
  try {
    const q = query(
      collection(db, `users/${uid}/activity`),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (error) {
    console.error('Error marking activity read:', error);
  }
}
