import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/social/Avatar';
import { FacePile } from '../../components/social/FacePile';
import { HootButton } from '../../components/social/HootButton';
import { Owl } from '../../components/Owl';
import { border, font, palette, radius, space, type } from '../../constants/Colors';
import { auth } from '../../config/firebaseConfig';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { useHoots } from '../context/HootsContext';
import { useSightings } from '../context/SightingsContext';
import { useComments } from '../hooks/useComments';
import { getCurrentUserProfile } from '../services/userService';
import { FriendSighting } from '../types';

function timeAgo(date: Date | null): string {
  if (!date) return 'now';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function metaDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SightingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sightingId = String(id);

  // The root layout wraps screens in react-native's SafeAreaView, which only
  // insets on iOS. On Android it's a no-op (edge-to-edge), so apply the device
  // insets ourselves there to clear the status bar (top) and nav bar (bottom).
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? insets.top : 0;
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;

  const { friendSightings } = useFriendSightings();
  const { sightings } = useSightings();
  const { hasHooted, hootCount, toggleHoot } = useHoots();
  const { comments, loading, post } = useComments(sightingId);

  const sighting = useMemo(
    () => friendSightings.find((s) => s.id === sightingId) ?? sightings.find((s) => s.id === sightingId),
    [sightingId, friendSightings, sightings]
  );

  const [me, setMe] = useState<{ uid: string; username: string } | null>(null);
  useEffect(() => {
    getCurrentUserProfile().then((p) => {
      if (p) setMe({ uid: p.uid, username: p.username });
    });
  }, []);

  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onSend = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const body = text;
    setText('');
    try {
      await post(body);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      console.error('Error posting comment:', e);
      setText(body); // restore so the user doesn't lose their text
    } finally {
      setPosting(false);
    }
  };

  const NavBar = (
    <View style={[styles.navBar, { paddingTop: topInset + space.sm }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={palette.ink} />
      </Pressable>
      <Text style={styles.navTitle}>Sighting</Text>
    </View>
  );

  if (!sighting) {
    return (
      <View style={styles.screen}>
        {NavBar}
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Couldn't load this sighting.</Text>
        </View>
      </View>
    );
  }

  const friendName = (sighting as FriendSighting).friendName ?? 'You';
  const hooters = sighting.recentHooters ?? [];
  const count = hootCount(sighting);
  const hooted = hasHooted(sightingId);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
    >
      {NavBar}

      <ScrollView ref={scrollRef} style={styles.body} keyboardShouldPersistTaps="handled">
        {sighting.photoUrl && (
          <Image source={{ uri: sighting.photoUrl }} style={styles.photo} resizeMode="cover" />
        )}

        {/* Meta */}
        <View style={styles.meta}>
          <View style={styles.friendTagRow}>
            <View style={styles.friendTag}>
              <Ionicons name="person" size={10} color={palette.ink} />
              <Text style={styles.friendTagText} numberOfLines={1}>{friendName.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.birdName}>{sighting.birdName}</Text>

          <View style={styles.metaRow}>
            {sighting.location ? (
              <>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={12} color={palette.muted} />
                  <Text style={styles.metaText} numberOfLines={1}>{sighting.location}</Text>
                </View>
                <Text style={styles.metaDivider}>·</Text>
              </>
            ) : null}
            <Text style={styles.metaText}>{metaDate(sighting.date)}</Text>
          </View>

          {/* Hoot summary + toggle */}
          <View style={styles.hootSummary}>
            <View style={styles.hootSummaryLeft}>
              {count > 0 && hooters.length > 0 && (
                <FacePile people={hooters.map((h) => ({ name: h.username, seed: h.uid }))} max={3} size={26} />
              )}
              <Text style={styles.hootCountText}>
                <Text style={styles.hootCountNum}>{count}</Text> {count === 1 ? 'hoot' : 'hoots'}
              </Text>
            </View>
            <HootButton hooted={hooted} count={count} onPress={() => toggleHoot(sightingId)} />
          </View>
        </View>

        {/* Comments header */}
        <View style={styles.commentsHeader}>
          <Ionicons name="chatbubble-outline" size={17} color={palette.ink} />
          <Text style={styles.commentsHeaderText}>
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
        </View>

        {/* Comment list */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: space.lg }} color={palette.inkSoft} />
        ) : comments.length === 0 ? (
          <Text style={styles.emptyComments}>No comments yet — be the first.</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Avatar name={c.username} seed={c.uid} size={34} />
              <View style={styles.commentBody}>
                <View style={styles.commentMetaRow}>
                  <Text style={styles.commentName}>{c.username}</Text>
                  <Text style={styles.commentTime}>{timeAgo(c.createdAt?.toDate?.() ?? null)}</Text>
                </View>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: space.md }} />
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: bottomInset + space.sm }]}>
        {me && <Avatar name={me.username} seed={me.uid} size={32} />}
        <TextInput
          style={styles.input}
          placeholder="Add a comment…"
          placeholderTextColor={palette.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim() || posting}
          style={[styles.sendBtn, (!text.trim() || posting) && styles.sendBtnDisabled]}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  backBtn: { padding: 2 },
  navTitle: { ...type.h3, color: palette.ink },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.body, color: palette.inkSoft },

  body: { flex: 1 },
  photo: { width: '100%', height: 180, backgroundColor: palette.skySoft },

  meta: { padding: space.lg, borderBottomWidth: 1.5, borderBottomColor: palette.rule },
  friendTagRow: { flexDirection: 'row', marginBottom: space.sm },
  friendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.skySoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    maxWidth: '100%',
  },
  friendTagText: { fontFamily: font.mono, fontSize: 10, color: palette.ink, letterSpacing: 1.2, fontWeight: '700' },
  birdName: { ...type.h2, color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaText: { ...type.bodyS, color: palette.inkSoft, fontWeight: '500' },
  metaDivider: { color: palette.muted },

  hootSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  hootSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  hootCountText: { ...type.bodyS, color: palette.inkSoft },
  hootCountNum: { color: palette.ink, fontFamily: font.bodyBold },

  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 6,
  },
  commentsHeaderText: { ...type.h3, color: palette.ink },
  emptyComments: { ...type.body, color: palette.muted, paddingHorizontal: space.lg, paddingVertical: space.md },

  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingVertical: 8, alignItems: 'flex-start' },
  commentBody: { flex: 1, minWidth: 0 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  commentName: { fontFamily: font.bodyBold, fontSize: 14, color: palette.ink },
  commentTime: { fontFamily: font.mono, fontSize: 10, color: palette.muted },
  commentText: { ...type.body, color: palette.ink, marginTop: 2, lineHeight: 20 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
    backgroundColor: palette.cream,
  },
  input: {
    flex: 1,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 5,
    fontFamily: font.body,
    fontSize: 14,
    color: palette.ink,
    maxHeight: 110,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.leaf,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
