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
  /** Denormalized count carried on the sighting doc (maintained server-side). */
  hootCount: (sighting: { hootCount?: number }) => number;
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

  const hootCount = (sighting: { hootCount?: number }) => sighting.hootCount ?? 0;

  const toggleHoot = async (sightingId: string) => {
    const currentlyHooted = hootedIds.has(sightingId);

    // Optimistic flip — the collectionGroup listener will reconcile.
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
