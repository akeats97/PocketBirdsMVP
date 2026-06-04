import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { getCurrentUserProfile } from './userService';

// Comments live at sightings/{sightingId}/comments/{autoId}, ordered by
// createdAt. Counters (commentCount, topComment) are maintained server-side by
// a Cloud Function — clients only append.
export interface Comment {
  id: string;
  uid: string;
  username: string;
  text: string;
  createdAt: Timestamp | null; // null briefly while the serverTimestamp resolves
}

const MAX_COMMENT_LENGTH = 500;

export function subscribeToComments(
  sightingId: string,
  onChange: (comments: Comment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, `sightings/${sightingId}/comments`),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            username: data.username,
            text: data.text,
            createdAt: data.createdAt ?? null,
          };
        })
      );
    },
    onError
  );
}

// Append a comment. Firestore's local cache makes the new doc show up in the
// onSnapshot listener immediately (optimistic), so callers don't need to
// hand-roll optimistic state. Returns false if the trimmed text is empty.
export async function addComment(sightingId: string, text: string): Promise<boolean> {
  const trimmed = text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!trimmed) return false;

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const username = (await getCurrentUserProfile())?.username ?? 'A friend';
  await addDoc(collection(db, `sightings/${sightingId}/comments`), {
    uid,
    username,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  return true;
}
