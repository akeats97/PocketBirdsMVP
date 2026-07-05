import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
} from '@react-native-firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

// A hoot lives at sightings/{sightingId}/hoots/{hooterUid}. The doc id IS the
// hooter's uid, which makes "one hoot per user per sighting" a structural
// guarantee and toggling trivial (setDoc to hoot, deleteDoc to un-hoot).
export interface Hoot {
  uid: string;
  username: string; // denormalized so lists/feeds need no extra reads
  createdAt: Timestamp;
}

function hootRef(sightingId: string, uid: string) {
  return doc(db, `sightings/${sightingId}/hoots/${uid}`);
}

/**
 * Live set of every sighting the given user has hooted, hydrated via a single
 * collectionGroup query (one listener instead of one-per-card). The sighting id
 * is the grandparent of each hoot doc.
 */
export function subscribeToMyHoots(
  uid: string,
  onChange: (sightingIds: Set<string>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collectionGroup(db, 'hoots'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((d) => {
        const sightingId = d.ref.parent.parent?.id;
        if (sightingId) ids.add(sightingId);
      });
      onChange(ids);
    },
    onError
  );
}

/** A hoot with its doc id, for list rendering. */
export interface HootEntry extends Hoot {
  id: string;
}

/**
 * Live list of everyone who hooted a sighting, newest first. Used by the hoot
 * list sheet while it's open.
 */
export function subscribeToHoots(
  sightingId: string,
  onChange: (hoots: HootEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, `sightings/${sightingId}/hoots`),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Hoot) })));
    },
    onError
  );
}

export async function setHoot(sightingId: string, username: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await setDoc(hootRef(sightingId, uid), {
    uid,
    username,
    createdAt: serverTimestamp(),
  });
}

export async function removeHoot(sightingId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(hootRef(sightingId, uid));
}
