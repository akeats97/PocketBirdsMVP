import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../components/social/Avatar';
import { font, palette, radius, space, type } from '../constants/Colors';
import { useActivity } from './context/ActivityContext';
import { ActivityItem } from './services/activityService';

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

// Icon + tint per activity type, shown as a small badge on the avatar.
function typeBadge(t: ActivityItem['type']): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (t) {
    case 'hoot':
      return { name: 'leaf', color: palette.leaf };
    case 'comment_hoot':
      return { name: 'leaf', color: palette.coral };
    case 'reply':
    case 'comment':
      return { name: 'chatbubble', color: palette.sky ?? palette.ink };
    case 'proposal':
      return { name: 'help', color: palette.sun };
    case 'proposal_accepted':
      return { name: 'checkmark-circle', color: palette.leaf };
    case 'follow':
    default:
      return { name: 'person-add', color: palette.sun };
  }
}

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Header-less screen: own the top inset on both platforms (the root
  // SafeAreaView only insets the horizontal edges now).
  const topInset = insets.top;
  const { items, markAllRead } = useActivity();

  // Opening the screen clears the unread dot.
  useEffect(() => {
    markAllRead();
    // markAllRead is stable enough for a one-shot on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItem = (item: ActivityItem) => {
    if (
      (item.type === 'hoot' ||
        item.type === 'comment' ||
        item.type === 'comment_hoot' ||
        item.type === 'reply' ||
        item.type === 'proposal' ||
        item.type === 'proposal_accepted') &&
      item.sightingId
    ) {
      router.push(`/sighting/${item.sightingId}`);
    } else if (item.type === 'follow' && item.actorUid) {
      router.push(`/profile/${item.actorUid}`);
    }
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const badge = typeBadge(item.type);
    return (
      <Pressable
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => openItem(item)}
      >
        {/* Avatar links to the actor's profile; the rest of the row opens the content. */}
        <Pressable
          style={styles.avatarWrap}
          onPress={() => item.actorUid && router.push(`/profile/${item.actorUid}`)}
          disabled={!item.actorUid}
          hitSlop={4}
        >
          <Avatar name={item.actorUsername} seed={item.actorUid} size={42} />
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Ionicons name={badge.name} size={11} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.body}>
          <Text style={styles.text} numberOfLines={2}>
            <Text style={styles.actor}>{item.actorUsername}</Text>
            {item.type === 'hoot' && (
              <Text> hooted your {item.birdName ?? 'sighting'} 🦉</Text>
            )}
            {item.type === 'comment' && (
              <Text> commented on your {item.birdName ?? 'sighting'}</Text>
            )}
            {item.type === 'comment_hoot' && (
              <Text> hooted your comment 🦉</Text>
            )}
            {item.type === 'reply' && (
              <Text> replied to your comment 💬</Text>
            )}
            {item.type === 'follow' && <Text> started following you</Text>}
            {item.type === 'proposal' && (
              <Text> proposed {item.species ?? 'an ID'} for your Mystery Bird 🦉</Text>
            )}
            {item.type === 'proposal_accepted' && (
              <Text> accepted your ID{item.species ? ` — it's a ${item.species}` : ''} 🦉</Text>
            )}
          </Text>
          {(item.type === 'comment' || item.type === 'comment_hoot' || item.type === 'reply') &&
          item.commentText ? (
            <Text style={styles.preview} numberOfLines={2}>“{item.commentText}”</Text>
          ) : null}
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.navBar, { paddingTop: topInset + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={styles.navTitle}>Activity</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-outline" size={40} color={palette.muted} />
            <Text style={styles.emptyTitle}>No activity yet.</Text>
            <Text style={styles.emptySub}>
              Hoots, comments, and new followers will show up here.
            </Text>
          </View>
        }
      />
    </View>
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

  listContent: { paddingVertical: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  rowUnread: { backgroundColor: palette.card },
  avatarWrap: { width: 42, height: 42 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.cream,
  },
  body: { flex: 1, minWidth: 0 },
  text: { ...type.body, color: palette.ink, lineHeight: 20 },
  actor: { fontFamily: font.display, color: palette.ink },
  preview: { ...type.bodyS, color: palette.inkSoft, marginTop: 2, fontStyle: 'italic' },
  time: { ...type.bodyS, color: palette.muted, marginTop: 3 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: palette.coral,
  },

  emptyContent: { flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.xs,
  },
  emptyTitle: { ...type.h3, color: palette.ink, marginTop: space.sm },
  emptySub: { ...type.body, color: palette.inkSoft, textAlign: 'center' },
});
