import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { isMysteryBird } from '../../constants/unknownBird';
import { Proposal } from '../types';
import { getCurrentUserProfile } from './userService';
import { isGlobalFirstSpecies } from './sightingService';

// Community ID proposals live at sightings/{sightingId}/proposals/{autoId}.
// Counters (hootCount on each proposal, proposalCount + leadingProposal on the
// parent sighting) are maintained server-side by Cloud Functions — clients only
// append proposals, toggle hoots, and (owner) flip `accepted`.

const MAX_NOTE_LENGTH = 280;

function proposalsCol(sightingId: string) {
  return collection(db, `sightings/${sightingId}/proposals`);
}

function proposalHootRef(sightingId: string, proposalId: string, uid: string) {
  return doc(db, `sightings/${sightingId}/proposals/${proposalId}/hoots/${uid}`);
}

// Live, ranked proposal list for a sighting: highest hoots first, ties broken
// by oldest-first (the earliest plausible call wins a tie). Subscribe only
// while the detail screen is mounted.
export function subscribeToProposals(
  sightingId: string,
  onChange: (proposals: Proposal[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    proposalsCol(sightingId),
    orderBy('hootCount', 'desc'),
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
            species: data.species,
            speciesLower: data.speciesLower,
            note: data.note ?? undefined,
            hootCount: data.hootCount ?? 0,
            createdAt: data.createdAt?.toDate?.() ?? null,
            accepted: data.accepted ?? false,
          };
        })
      );
    },
    onError
  );
}

// Post a proposal. Optimistic in the UI via Firestore's local cache, so callers
// don't hand-roll optimistic state. Dupe-guards on speciesLower so a user can't
// propose the same species twice. Returns false if the species is empty or a
// duplicate from this user. Species is the COMMON NAME ONLY.
export async function addProposal(
  sightingId: string,
  species: string,
  note?: string
): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const trimmedSpecies = species.trim();
  if (!trimmedSpecies) return false;
  const speciesLower = trimmedSpecies.toLowerCase();

  // Dupe-guard: refuse if this user already proposed this species here.
  const dupeSnap = await getDocs(
    query(
      proposalsCol(sightingId),
      where('uid', '==', uid),
      where('speciesLower', '==', speciesLower),
      limit(1)
    )
  );
  if (!dupeSnap.empty) return false;

  const username = (await getCurrentUserProfile())?.username ?? 'A friend';
  const trimmedNote = note?.trim().slice(0, MAX_NOTE_LENGTH) || null;

  await addDoc(proposalsCol(sightingId), {
    uid,
    username,
    species: trimmedSpecies,
    speciesLower,
    note: trimmedNote,
    hootCount: 0,
    createdAt: serverTimestamp(),
  });
  return true;
}

// Toggle the current user's agreement hoot on a proposal. Doc id == uid, so
// "one hoot per user per proposal" is structural (setDoc to hoot, deleteDoc to
// un-hoot). hootCount is recomputed server-side.
export async function setProposalHoot(
  sightingId: string,
  proposalId: string,
  username: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await setDoc(proposalHootRef(sightingId, proposalId, uid), {
    uid,
    username,
    createdAt: serverTimestamp(),
  });
}

export async function removeProposalHoot(
  sightingId: string,
  proposalId: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(proposalHootRef(sightingId, proposalId, uid));
}

// Result of accepting a proposal — enough for the caller to run the
// post-identification celebration pipeline (Dex / milestone / global-first).
export interface AcceptResult {
  species: string;
  proposerUid: string;
  proposerUsername: string;
  proposalHootCount: number;
  globalFirst: boolean;
}

// Owner-only: accept a proposal as the species for a Mystery Bird. Writes the
// species onto the sighting, clears Mystery status (birdName is the sentinel,
// so setting it to the species is what clears it), and marks the proposal
// accepted — all in one batch.
//
// Global-first is checked BEFORE the birdName write (while the sighting still
// reads "Mystery Bird") so the existence query can't match this very sighting.
// This keeps the existing "first to log" semantics (see CLAUDE.md — racy, exact
// name, best effort). The owner runs the Dex/milestone effects after this.
export async function acceptProposal(
  sightingId: string,
  proposalId: string
): Promise<AcceptResult | null> {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  const sightingRef = doc(db, 'sightings', sightingId);
  const proposalRef = doc(db, `sightings/${sightingId}/proposals/${proposalId}`);

  const [sSnap, pSnap] = await Promise.all([getDoc(sightingRef), getDoc(proposalRef)]);
  if (!sSnap.exists() || !pSnap.exists()) return null;

  const sighting = sSnap.data();
  if (sighting.userId !== me.uid) throw new Error('Only the owner can accept');
  // Idempotency: already resolved (or the proposal was already accepted) → no-op.
  if (!isMysteryBird({ birdName: sighting.birdName })) return null;

  const proposal = pSnap.data();
  const species: string = proposal.species;

  // Global-first existence check while birdName is still the sentinel.
  let globalFirst = false;
  try {
    globalFirst = await isGlobalFirstSpecies(species);
  } catch {
    // offline / query failed — treat as not first, matching add-time behavior.
    globalFirst = false;
  }

  const batch = writeBatch(db);
  batch.update(sightingRef, {
    birdName: species,
    identifiedVia: 'community',
    identifiedBy: proposal.uid,
    identifiedAt: serverTimestamp(),
    ...(globalFirst ? { globalFirst: true } : {}),
  });
  batch.update(proposalRef, { accepted: true });
  await batch.commit();

  return {
    species,
    proposerUid: proposal.uid,
    proposerUsername: proposal.username,
    proposalHootCount: proposal.hootCount ?? 0,
    globalFirst,
  };
}

const proposalService = {
  subscribeToProposals,
  addProposal,
  setProposalHoot,
  removeProposalHoot,
  acceptProposal,
};

export default proposalService;
