import { useEffect, useState } from 'react';
import { addComment as addCommentService, Comment, subscribeToComments } from '../services/commentService';

// Live comment thread for a sighting. Subscribes while mounted; Firestore's
// local cache surfaces a freshly-posted comment immediately, so `post` needs no
// manual optimistic bookkeeping.
export function useComments(sightingId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToComments(
      sightingId,
      (next) => {
        setComments(next);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to comments:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [sightingId]);

  const post = (text: string) => addCommentService(sightingId, text);

  return { comments, loading, post };
}
