import { useEffect, useState } from 'react';
import { Proposal } from '../types';
import {
  acceptProposal as acceptProposalService,
  addProposal as addProposalService,
  AcceptResult,
  subscribeToProposals,
} from '../services/proposalService';

// Live, ranked community-ID proposal list for one sighting. Mirrors useComments:
// subscribes while mounted (scoped to the open detail screen — never on the
// feed), and Firestore's local cache surfaces a freshly-posted proposal
// immediately, so `add` needs no manual optimistic bookkeeping.
export function useProposals(sightingId: string) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToProposals(
      sightingId,
      (next) => {
        setProposals(next);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to proposals:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sightingId]);

  const add = (species: string, note?: string) =>
    addProposalService(sightingId, species, note);

  const accept = (proposalId: string): Promise<AcceptResult | null> =>
    acceptProposalService(sightingId, proposalId);

  return { proposals, loading, add, accept };
}
