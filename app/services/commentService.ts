import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
} from '@react-native-firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { getCurrentUserProfile } from './userService';

// The comment this one replies to. Denormalized (uid + username) so the thread
// renders the "↳ replying to @name" line with no extra reads, and the Cloud
// Function can notify the replied-to user without re-fetching the parent.
export interface ReplyTo {
  commentId: string;
  uid: string;
  username: string;
}

// Comments live at sightings/{sightingId}/comments/{autoId}, ordered by
// createdAt. Counters (commentCount, topComment on the sighting; hootCount on
// each comment) are maintained server-side by Cloud Functions — clients only
// append comments and toggle comment-hoots.
export interface Comment {
  id: string;
  uid: string;
  username: string;
  text: string;
  hootCount: number;
  replyTo?: ReplyTo;
  createdAt: Timestamp | null; // null briefly while the serverTimestamp resolves
}

const MAX_COMMENT_LENGTH = 500;

function commentHootRef(sightingId: string, commentId: string, uid: string) {
  return doc(db, `sightings/${sightingId}/comments/${commentId}/hoots/${uid}`);
}

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
            hootCount: data.hootCount ?? 0,
            replyTo: data.replyTo ?? undefined,
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
// Pass `replyTo` to thread the comment under another one (notifies that author).
export async function addComment(
  sightingId: string,
  text: string,
  replyTo?: ReplyTo
): Promise<boolean> {
  const trimmed = text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!trimmed) return false;

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const username = (await getCurrentUserProfile())?.username ?? 'A friend';
  await addDoc(collection(db, `sightings/${sightingId}/comments`), {
    uid,
    username,
    text: trimmed,
    hootCount: 0,
    ...(replyTo ? { replyTo } : {}),
    createdAt: serverTimestamp(),
  });
  return true;
}

// Toggle the current user's hoot on a comment. Doc id == uid, so "one hoot per
// user per comment" is structural (setDoc to hoot, deleteDoc to un-hoot).
// hootCount on the comment is recomputed server-side. These live in the same
// 'hoots' collection group as sighting/proposal hoots, so HootsContext's single
// collectionGroup listener already tracks them by their grandparent (commentId).
export async function setCommentHoot(
  sightingId: string,
  commentId: string,
  username: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await setDoc(commentHootRef(sightingId, commentId, uid), {
    uid,
    username,
    createdAt: serverTimestamp(),
  });
}

export async function removeCommentHoot(
  sightingId: string,
  commentId: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(commentHootRef(sightingId, commentId, uid));
}
