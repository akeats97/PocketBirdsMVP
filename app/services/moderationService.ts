import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from '@react-native-firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { callCloudFunction } from './functionsClient';

// PL-2 moderation primitives: block (server-side callable, since dropping the
// OTHER user's follow edge needs Admin SDK), unblock (your own doc, plain
// delete), the live blocked-uid set for feed filtering, and reports.

export type ReportTargetType = 'user' | 'sighting' | 'comment' | 'proposal';

export async function blockUser(uid: string): Promise<void> {
  await callCloudFunction('blockUser', { uid });
}

// Unblock just removes the block doc. Deliberately does NOT restore follow
// edges; both sides start from scratch.
export async function unblockUser(uid: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('Not signed in');
  await deleteDoc(doc(db, `users/${me}/blocked/${uid}`));
}

// Live set of uids the current user has blocked. Feed/detail layers filter
// against it so blocked content disappears without waiting on the server.
export function subscribeBlockedUids(cb: (uids: Set<string>) => void): Unsubscribe {
  const me = auth.currentUser?.uid;
  if (!me) {
    cb(new Set());
    return () => {};
  }
  return onSnapshot(
    collection(db, `users/${me}/blocked`),
    (snap) => cb(new Set(snap.docs.map((d) => d.id))),
    (err) => {
      console.error('blocked-list listener error:', err);
      cb(new Set());
    }
  );
}

export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('Not signed in');
  await addDoc(collection(db, 'reports'), {
    reporter: me,
    targetType,
    targetId,
    reason: reason.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}
