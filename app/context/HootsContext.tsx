import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { removeHoot, setHoot, subscribeToMyHoots } from '../services/hootService';
import { removeProposalHoot, setProposalHoot } from '../services/proposalService';
import { removeCommentHoot, setCommentHoot } from '../services/commentService';
import { getCurrentUserProfile } from '../services/userService';

interface HootsContextType {
  /** Has the current user hooted this sighting? */
  hasHooted: (sightingId: string) => boolean;
  /** Optimistic hoot count for a sighting (server count + local toggles). */
  hootCount: (sighting: { id: string; hootCount?: number }) => number;
  /**
   * Optimistic hoot count for anything hootable (comment, proposal): the
   * server-denormalized count with the user's own un-synced toggles applied.
   */
  displayHootCount: (id: string, serverCount: number) => number;
  /** Optimistically toggle the current user's hoot on a sighting. */
  toggleHoot: (sightingId: string) => Promise<void>;
  /** Has the current user hooted this community-ID proposal? */
  hasHootedProposal: (proposalId: string) => boolean;
  /** Optimistically toggle the current user's hoot on a proposal. */
  toggleProposalHoot: (sightingId: string, proposalId: string) => Promise<void>;
  /** Has the current user hooted this comment? */
  hasHootedComment: (commentId: string) => boolean;
  /** Optimistically toggle the current user's hoot on a comment. */
  toggleCommentHoot: (sightingId: string, commentId: string) => Promise<void>;
}

const HootsContext = createContext<HootsContextType | undefined>(undefined);

function HootsProvider({ children }: { children: React.ReactNode }) {
  // Set of sighting ids the current user has hooted, kept live.
  const [hootedIds, setHootedIds] = useState<Set<string>>(new Set());
  // Cached username for the denormalized hoot doc field.
  const usernameRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeHoots: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Tear down any previous user's listener.
      unsubscribeHoots?.();
      unsubscribeHoots = undefined;
      usernameRef.current = null;

      if (!user) {
        setHootedIds(new Set());
        return;
      }

      // Cache the username up front so toggleHoot doesn't have to fetch.
      const profile = await getCurrentUserProfile();
      usernameRef.current = profile?.username ?? null;

      unsubscribeHoots = subscribeToMyHoots(
        user.uid,
        (ids) => setHootedIds(ids),
        (error) => console.error('Error subscribing to hoots:', error)
      );
    });

    return () => {
      unsubscribeHoots?.();
      unsubscribeAuth();
    };
  }, []);

  const hasHooted = (sightingId: string) => hootedIds.has(sightingId);

  // The hootCount fields on sighting/comment/proposal docs are denormalized by
  // Cloud Functions, so after a tap the number doesn't move until the function
  // runs and the doc round-trips (seconds). These refs overlay the user's own
  // toggles on top: `countAdjustments` holds the pending delta keyed by the
  // hooted thing's id, anchored to the server count it was applied against
  // (`base`); once the server count moves off that base the function has
  // caught up (or someone else hooted) and the overlay is dropped.
  // `lastSeenCounts` records the server count each id last rendered with, so a
  // toggle knows its base without callers having to pass the count in.
  const lastSeenCountsRef = useRef<Map<string, number>>(new Map());
  const countAdjustmentsRef = useRef<Map<string, { base: number; delta: number }>>(new Map());

  // Refs, not state: every adjustment is immediately followed by a hootedIds
  // flip, which re-renders the provider and its consumers anyway.
  const adjustCount = (id: string, change: 1 | -1) => {
    const existing = countAdjustmentsRef.current.get(id);
    const base = existing?.base ?? lastSeenCountsRef.current.get(id) ?? 0;
    const delta = (existing?.delta ?? 0) + change;
    if (delta === 0) countAdjustmentsRef.current.delete(id);
    else countAdjustmentsRef.current.set(id, { base, delta });
  };

  const displayHootCount = (id: string, serverCount: number) => {
    lastSeenCountsRef.current.set(id, serverCount);
    const adj = countAdjustmentsRef.current.get(id);
    if (!adj) return serverCount;
    if (serverCount !== adj.base) {
      // Server caught up: the denormalized count absorbed the toggle.
      countAdjustmentsRef.current.delete(id);
      return serverCount;
    }
    return Math.max(0, adj.base + adj.delta);
  };

  const hootCount = (sighting: { id: string; hootCount?: number }) =>
    displayHootCount(sighting.id, sighting.hootCount ?? 0);

  const toggleHoot = async (sightingId: string) => {
    const currentlyHooted = hootedIds.has(sightingId);

    // Optimistic flip — the collectionGroup listener will reconcile.
    adjustCount(sightingId, currentlyHooted ? -1 : 1);
    setHootedIds((prev) => {
      const next = new Set(prev);
      if (currentlyHooted) next.delete(sightingId);
      else next.add(sightingId);
      return next;
    });

    try {
      if (currentlyHooted) {
        await removeHoot(sightingId);
      } else {
        // Resolve username lazily if it wasn't cached at sign-in.
        if (!usernameRef.current) {
          usernameRef.current = (await getCurrentUserProfile())?.username ?? '';
        }
        await setHoot(sightingId, usernameRef.current);
      }
    } catch (error) {
      console.error('Error toggling hoot:', error);
      // Revert on failure.
      adjustCount(sightingId, currentlyHooted ? 1 : -1);
      setHootedIds((prev) => {
        const next = new Set(prev);
        if (currentlyHooted) next.add(sightingId);
        else next.delete(sightingId);
        return next;
      });
    }
  };

  // Proposal hoots live at sightings/{id}/proposals/{pid}/hoots/{uid} — the SAME
  // 'hoots' collection group the subscribeToMyHoots listener already watches.
  // Each proposal-hoot doc's parent is the proposal, so its grandparent id is
  // the proposalId. Since proposalIds are Firestore auto-ids (a different id
  // space than sightingIds), reusing the one global hootedIds set is safe and
  // needs no extra listener — exactly what the Community ID data model suggests.
  const hasHootedProposal = (proposalId: string) => hootedIds.has(proposalId);

  const toggleProposalHoot = async (sightingId: string, proposalId: string) => {
    const currentlyHooted = hootedIds.has(proposalId);

    adjustCount(proposalId, currentlyHooted ? -1 : 1);
    setHootedIds((prev) => {
      const next = new Set(prev);
      if (currentlyHooted) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });

    try {
      if (currentlyHooted) {
        await removeProposalHoot(sightingId, proposalId);
      } else {
        if (!usernameRef.current) {
          usernameRef.current = (await getCurrentUserProfile())?.username ?? '';
        }
        await setProposalHoot(sightingId, proposalId, usernameRef.current);
      }
    } catch (error) {
      console.error('Error toggling proposal hoot:', error);
      adjustCount(proposalId, currentlyHooted ? 1 : -1);
      setHootedIds((prev) => {
        const next = new Set(prev);
        if (currentlyHooted) next.add(proposalId);
        else next.delete(proposalId);
        return next;
      });
    }
  };

  // Comment hoots live at sightings/{id}/comments/{cid}/hoots/{uid} — again the
  // SAME 'hoots' collection group the subscribeToMyHoots listener watches, with
  // the commentId as grandparent. commentIds are auto-ids (distinct from
  // sighting/proposal ids), so reusing the one global hootedIds set is safe and
  // needs no extra listener.
  const hasHootedComment = (commentId: string) => hootedIds.has(commentId);

  const toggleCommentHoot = async (sightingId: string, commentId: string) => {
    const currentlyHooted = hootedIds.has(commentId);

    adjustCount(commentId, currentlyHooted ? -1 : 1);
    setHootedIds((prev) => {
      const next = new Set(prev);
      if (currentlyHooted) next.delete(commentId);
      else next.add(commentId);
      return next;
    });

    try {
      if (currentlyHooted) {
        await removeCommentHoot(sightingId, commentId);
      } else {
        if (!usernameRef.current) {
          usernameRef.current = (await getCurrentUserProfile())?.username ?? '';
        }
        await setCommentHoot(sightingId, commentId, usernameRef.current);
      }
    } catch (error) {
      console.error('Error toggling comment hoot:', error);
      adjustCount(commentId, currentlyHooted ? 1 : -1);
      setHootedIds((prev) => {
        const next = new Set(prev);
        if (currentlyHooted) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
    }
  };

  return (
    <HootsContext.Provider
      value={{
        hasHooted,
        hootCount,
        displayHootCount,
        toggleHoot,
        hasHootedProposal,
        toggleProposalHoot,
        hasHootedComment,
        toggleCommentHoot,
      }}
    >
      {children}
    </HootsContext.Provider>
  );
}

export function useHoots() {
  const context = useContext(HootsContext);
  if (context === undefined) {
    throw new Error('useHoots must be used within a HootsProvider');
  }
  return context;
}

export default HootsProvider;
