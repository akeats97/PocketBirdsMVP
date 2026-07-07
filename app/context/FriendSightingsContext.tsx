import NetInfo from '@react-native-community/netinfo';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { auth, db } from '../../config/firebaseConfig';
import { subscribeBlockedUids } from '../services/moderationService';
import { UserProfile, getFollowing } from '../services/userService';
import { FriendSighting } from '../types';

interface FriendSightingsContextType {
  friendSightings: FriendSighting[];
  // Uids the current user has blocked (live). Exposed so detail screens can
  // filter comments/proposals the same way the feed is filtered here.
  blockedUids: Set<string>;
  friends: { id: string; name: string }[];
  isLoadingFriends: boolean;
  // True once the initial friend load has settled: the first sightings snapshot
  // delivered, or we have no friends, or we're offline / errored. Unlike
  // isLoadingFriends (which flips as soon as the *following list* is fetched,
  // before the sightings arrive), this waits for the actual feed data so the
  // Journal can hold a loader until there's nothing left to pop in. Only ever
  // false -> true, so pull-to-refresh never re-triggers the full-screen loader.
  friendsReady: boolean;
  refreshFriends: () => Promise<void>;
}

const FriendSightingsContext = createContext<FriendSightingsContextType | undefined>(undefined);

function FriendSightingsProvider({ children }: { children: React.ReactNode }) {
  // Starts empty — the merged home feed renders this directly, so it must
  // never contain placeholder data.
  const [friendSightings, setFriendSightings] = useState<FriendSighting[]>([]);
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [friendsReady, setFriendsReady] = useState(false);
  // Holds the active sightings onSnapshot unsubscribe so we can tear it down on
  // logout / re-fetch. Without this the listener leaks and, under the strict
  // Firestore rules, fires a permission error the moment auth drops at logout.
  const sightingsUnsubRef = useRef<(() => void) | null>(null);

  // Fetch following users and their sightings
  const fetchFollowing = async () => {
    if (!auth.currentUser) {
      setIsLoadingFriends(false);
      setFriendsReady(true);
      return;
    }

    setIsLoadingFriends(true);
    // Offline: reveal the feed right away (local/own sightings only) rather than
    // holding the loader on a network round-trip that won't complete. Any cached
    // friend data still fills in later if Firestore's cache resolves. Check for
    // an explicit `false` only — on cold start NetInfo often reports `null`
    // (not-yet-determined), and treating that as offline would reveal the feed
    // before friends load and make them pop in as a second chunk. `null` waits
    // for the snapshot (fast when online) or the 3s ceiling (if truly dead).
    NetInfo.fetch().then(state => {
      if (state.isConnected === false) setFriendsReady(true);
    });
    // Hard ceiling: NetInfo.isConnected only means "an interface is up", not
    // "the internet is reachable" — so a connected-but-dead network (e.g. a
    // dropped Starlink link) wouldn't hit the offline branch above and could
    // hang on getFollowing. Guarantee the Journal loader clears within 3s no
    // matter the failure mode. Idempotent with the other friendsReady triggers.
    setTimeout(() => setFriendsReady(true), 3000);
    try {
      // Get list of users the current user is following
      const followingUsers = await getFollowing();

      // Convert to the format expected by the UI
      const friendsList = followingUsers.map(user => ({
        id: user.uid,
        name: user.username
      }));

      setFriends(friendsList);
      console.log(`[friends] resolved ${friendsList.length} followed users`);

      // If we have friends, fetch their sightings (friendsReady flips when the
      // first snapshot delivers). No friends -> nothing to wait for, ready now.
      if (followingUsers.length > 0) {
        fetchFriendSightings(followingUsers);
      } else {
        setFriendSightings([]);
        setFriendsReady(true);
      }
    } catch (error) {
      console.error('Error fetching following:', error);
      setFriendsReady(true);
      Alert.alert(
        'Error',
        'Failed to load friends. Please check your connection and try again.'
      );
    } finally {
      setIsLoadingFriends(false);
    }
  };
  
  // Fetch sightings from friends
  const fetchFriendSightings = async (followingUsers: UserProfile[]) => {
    try {
      // Get all user IDs we're following
      const userIds = followingUsers.map(user => user.uid);
      
      // Create a username lookup map for later use
      const usernameMap = followingUsers.reduce((map, user) => {
        map[user.uid] = user.username;
        return map;
      }, {} as Record<string, string>);
      
      // Query sightings where the user is one of the people we follow
      const sightingsQuery = query(
        collection(db, 'sightings'),
        where('userId', 'in', userIds)
      );
      // Bootstrap query: newest 50 only. On a cold cache (first-ever launch /
      // reinstall) the full query above must download every friend sighting
      // before its first snapshot delivers, which is the "chunky first open"
      // from the vc31 soak. This bounded query returns fast and paints the top
      // of the feed; the full snapshot replaces it when it lands. The full
      // list stays authoritative because the Friends-tab stats, the 1ST
      // badges, and Hep all need complete history. Uses the existing
      // (userId ASC, date DESC) composite index.
      const bootstrapQuery = query(
        collection(db, 'sightings'),
        where('userId', 'in', userIds),
        orderBy('date', 'desc'),
        limit(50)
      );

      // Tear down any previous sightings listeners before creating new ones.
      sightingsUnsubRef.current?.();

      const buildSightings = (snapshot: { forEach: (cb: (doc: any) => void) => void }) => {
        const sightings: FriendSighting[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const userId = data.userId;

            if (usernameMap[userId]) {
              const friendSighting: FriendSighting = {
                id: doc.id,
                birdName: data.birdName,
                location: data.location,
                date: data.date.toDate(),
                notes: data.notes,
                friendName: usernameMap[userId],
                friendId: userId,
                syncStatus: 'synced' as const,
                lastModified: data.lastModified ? data.lastModified.toDate() : data.date.toDate(),
                createdAt: data.createdAt?.toDate?.() ?? data.date.toDate(),
                photoUrl: data.photoUrl || undefined,
                hootCount: data.hootCount ?? 0,
                commentCount: data.commentCount ?? 0,
                recentHooters: data.recentHooters ?? [],
                topComment: data.topComment ?? undefined,
                globalFirst: data.globalFirst ?? false,
                verified: data.verified ?? false,
                identifiedVia: data.identifiedVia ?? undefined,
                identifiedBy: data.identifiedBy ?? undefined,
                identifiedByUsername: data.identifiedByUsername ?? undefined,
                hidden: data.hidden ?? false,
              };
              if (data.coordinates) {
                friendSighting.coordinates = {
                  latitude: data.coordinates.latitude,
                  longitude: data.coordinates.longitude,
                  accuracy: data.coordinates.accuracy ?? undefined,
                  capturedAt: data.coordinates.capturedAt?.toDate?.() ?? undefined,
                };
              }
              sightings.push(friendSighting);
            }
        });

        // Sort sightings by date, newest first
        sightings.sort((a, b) => b.date.getTime() - a.date.getTime());
        return sightings;
      };

      // Once the full snapshot has delivered, the bootstrap listener is
      // redundant (and must never overwrite the full list with 50 docs).
      let fullDelivered = false;

      const bootstrapUnsubscribe = onSnapshot(
        bootstrapQuery,
        (snapshot) => {
          if (fullDelivered) return;
          console.log(`[friendSightings] bootstrap snapshot size=${snapshot.size} fromCache=${snapshot.metadata.fromCache}`);
          setFriendSightings(buildSightings(snapshot));
          // First feed data is in: the Journal can drop its loader now.
          setFriendsReady(true);
        },
        (error) => {
          // Non-fatal: the full listener below still covers the feed.
          console.error('Error fetching bootstrap sightings:', error);
        }
      );

      // Set up the real-time listener for the full history
      const unsubscribe = onSnapshot(
        sightingsQuery,
        (snapshot) => {
          console.log(`[friendSightings] snapshot size=${snapshot.size} fromCache=${snapshot.metadata.fromCache}`);
          fullDelivered = true;
          bootstrapUnsubscribe();
          setFriendSightings(buildSightings(snapshot));
          // First feed data is in: the Journal can drop its loader now.
          setFriendsReady(true);
        },
        (error) => {
          console.error('Error fetching sightings:', error);
          // Keep whatever was last loaded; never inject placeholder data.
          setFriendsReady(true);
        }
      );

      // Remember both so logout / re-fetch / unmount can tear them down.
      sightingsUnsubRef.current = () => {
        bootstrapUnsubscribe();
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up sightings listener:', error);
      // Listener never got established — don't leave the Journal loader hanging.
      setFriendsReady(true);
    }
  };
  
  // Listen for auth state changes
  useEffect(() => {
    let blockedUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, user => {
      blockedUnsub?.();
      blockedUnsub = null;
      if (user) {
        blockedUnsub = subscribeBlockedUids(setBlockedUids);
        fetchFollowing();
      } else {
        // Logged out: tear down the live sightings listener so it doesn't fire
        // a permission error once auth drops, then clear state.
        sightingsUnsubRef.current?.();
        sightingsUnsubRef.current = null;
        setFriends([]);
        setFriendSightings([]);
        setBlockedUids(new Set());
        setIsLoadingFriends(false);
        setFriendsReady(true);
      }
    });

    return () => {
      unsubscribe();
      blockedUnsub?.();
      sightingsUnsubRef.current?.();
      sightingsUnsubRef.current = null;
    };
  }, []);
  
  // Function to manually refresh friends list
  const refreshFriends = async () => {
    await fetchFollowing();
  };

  // What consumers see: the raw snapshots minus admin-hidden posts and anyone
  // this user has blocked. Blocking also drops the follow edges server-side,
  // so the block filter mostly covers the window until the next friends
  // refresh; hidden covers moderation pulls that must vanish for everyone.
  const visibleSightings = useMemo(
    () => friendSightings.filter(s => !s.hidden && !blockedUids.has(s.friendId ?? '')),
    [friendSightings, blockedUids]
  );

  return (
    <FriendSightingsContext.Provider
      value={{
        friendSightings: visibleSightings,
        blockedUids,
        friends,
        isLoadingFriends,
        friendsReady,
        refreshFriends
      }}
    >
      {children}
    </FriendSightingsContext.Provider>
  );
}

export function useFriendSightings() {
  const context = useContext(FriendSightingsContext);
  if (context === undefined) {
    throw new Error('useFriendSightings must be used within a FriendSightingsProvider');
  }
  return context;
}

export default FriendSightingsProvider; 