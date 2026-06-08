import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../../config/firebaseConfig';
import { FollowRow } from '../../../components/social/FollowRow';
import { NotifPrefSheet } from '../../../components/social/NotifPrefSheet';
import type { ConnectionTab } from '../../../components/social/SocialCounts';
import { font, palette, radius, space } from '../../../constants/Colors';
import {
  DEFAULT_MODE,
  NotificationMode,
  setPref,
  subscribeToPrefs,
} from '../../services/notificationPrefsService';
import { getConnections, getPublicProfile, Person } from '../../services/userService';

export default function ConnectionsScreen() {
  const { uid, tab } = useLocalSearchParams<{ uid: string; tab?: string }>();
  const router = useRouter();
  const targetUid = String(uid);
  const myUid = auth.currentUser?.uid ?? '';

  const insets = useSafeAreaInsets();
  // Header-less screen: own the top inset on both platforms (the root
  // SafeAreaView only insets the horizontal edges now).
  const topInset = insets.top;

  const [active, setActive] = useState<ConnectionTab>(
    tab === 'following' ? 'following' : 'followers',
  );
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [followers, setFollowers] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<Record<string, NotificationMode>>({});
  const [prefFor, setPrefFor] = useState<Person | null>(null);

  // Load the graph for this user + their display name.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getConnections(targetUid, myUid), getPublicProfile(targetUid)])
      .then(([graph, profile]) => {
        if (cancelled) return;
        setFollowers(graph.followers);
        setFollowing(graph.following);
        setMyFollowing(graph.myFollowing);
        setName(profile?.username ?? '');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUid, myUid]);

  // Live per-friend notification levels (my prefs about the people I follow).
  useEffect(() => {
    if (!myUid) return;
    return subscribeToPrefs(myUid, setPrefs);
  }, [myUid]);

  const modeFor = (personUid: string): NotificationMode => prefs[personUid] ?? DEFAULT_MODE;

  const onSelectMode = async (personUid: string, mode: NotificationMode) => {
    setPrefs((prev) => ({ ...prev, [personUid]: mode })); // optimistic
    setPrefFor(null);
    try {
      await setPref(myUid, personUid, mode);
    } catch (e) {
      console.error('Failed to set notification pref:', e);
    }
  };

  const list = active === 'followers' ? followers : following;
  const tabs: { key: ConnectionTab; label: string; n: number }[] = useMemo(
    () => [
      { key: 'followers', label: 'Followers', n: followers.length },
      { key: 'following', label: 'Following', n: following.length },
    ],
    [followers.length, following.length],
  );

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
        </Pressable>
        <Text style={styles.navName} numberOfLines={1}>{name || ' '}</Text>
      </View>

      {/* Segmented switch */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {tabs.map((t) => {
            const on = active === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setActive(t.key)}
                style={[styles.segmentCell, on && styles.segmentCellOn]}
              >
                <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                  {t.label} <Text style={[styles.segmentCount, on && styles.segmentLabelOn]}>{t.n}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: space.xxl }} color={palette.inkSoft} />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {active === 'followers'
              ? 'No followers yet.'
              : "Not following anyone yet — search to find birders."}
          </Text>
        </View>
      ) : (
        <ScrollView>
          {list.map((person) => {
            const isMe = person.uid === myUid;
            return (
              <FollowRow
                key={person.uid}
                person={person}
                isMe={isMe}
                showBell={active === 'following' && !isMe}
                mode={modeFor(person.uid)}
                onBell={() => setPrefFor(person)}
                initialFollowing={myFollowing.has(person.uid)}
                onOpenProfile={() => router.push(`/profile/${person.uid}`)}
              />
            );
          })}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}

      <NotifPrefSheet
        visible={prefFor !== null}
        person={prefFor}
        mode={prefFor ? modeFor(prefFor.uid) : DEFAULT_MODE}
        onPick={(mode) => prefFor && onSelectMode(prefFor.uid, mode)}
        onClose={() => setPrefFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  backBtn: { padding: 2 },
  navName: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  segmentWrap: { paddingHorizontal: space.xl, paddingBottom: space.sm },
  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  segmentCellOn: { backgroundColor: palette.ink },
  segmentLabel: {
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '700',
    color: palette.inkSoft,
    letterSpacing: -0.2,
  },
  segmentLabelOn: { color: palette.cream },
  segmentCount: { fontFamily: font.mono, fontWeight: '500', fontSize: 11, opacity: 0.85 },
  empty: { padding: space.xxl, alignItems: 'center' },
  emptyText: {
    fontFamily: font.body,
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
  },
});
