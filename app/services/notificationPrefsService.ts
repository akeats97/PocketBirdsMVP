import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

export type NotificationMode = 'all' | 'highlights' | 'none';

// Absence of a pref doc resolves to this. Also what relationships that predate
// the preferences feature (no doc) keep getting.
export const DEFAULT_MODE: NotificationMode = 'all';

// Mode written when a brand-new follow is created. Default is "all" (every
// sighting pushes) — louder by default so people don't miss a friend's
// activity; they can dial it down to Highlights / None per-friend via the bell
// if it gets noisy.
export const NEW_FOLLOW_MODE: NotificationMode = 'all';

function prefDoc(followerUid: string, followedUid: string) {
  return doc(db, `users/${followerUid}/notificationPrefs/${followedUid}`);
}

// The follower's mode for a followed user. Missing doc → DEFAULT_MODE; never
// creates a doc as a side effect of reading.
export async function getPref(
  followerUid: string,
  followedUid: string,
): Promise<NotificationMode> {
  try {
    const snap = await getDoc(prefDoc(followerUid, followedUid));
    const mode = snap.exists() ? (snap.data().mode as NotificationMode) : undefined;
    return mode ?? DEFAULT_MODE;
  } catch (error) {
    console.error('Error reading notification pref:', error);
    return DEFAULT_MODE;
  }
}

export async function setPref(
  followerUid: string,
  followedUid: string,
  mode: NotificationMode,
): Promise<void> {
  await setDoc(prefDoc(followerUid, followedUid), {
    mode,
    updatedAt: serverTimestamp(),
  });
}

// Real-time listener over the current user's whole notificationPrefs
// subcollection. Hydrates a { followedUid: mode } map for the UI. Friends with
// no doc simply don't appear in the map; callers treat missing as DEFAULT_MODE.
export function subscribeToPrefs(
  followerUid: string,
  cb: (prefs: Record<string, NotificationMode>) => void,
): () => void {
  const ref = collection(db, `users/${followerUid}/notificationPrefs`);
  return onSnapshot(
    ref,
    (snap) => {
      const map: Record<string, NotificationMode> = {};
      snap.forEach((d) => {
        const mode = d.data().mode as NotificationMode | undefined;
        if (mode) map[d.id] = mode;
      });
      cb(map);
    },
    (error) => {
      console.error('Error subscribing to notification prefs:', error);
    },
  );
}

const notificationPrefsService = { getPref, setPref, subscribeToPrefs, DEFAULT_MODE };
export default notificationPrefsService;
