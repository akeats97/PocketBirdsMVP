import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotificationMode } from '../../app/services/notificationPrefsService';
import { followUser, Person, unfollowUser } from '../../app/services/userService';
import { getSightingsByUid } from '../../app/services/sightingService';
import { speciesSet } from '../../app/utils/compareLists';
import { font, palette, radius, space } from '../../constants/Colors';
import { Avatar } from './Avatar';
import { NotifBell } from './NotifBell';

// Distinct-species count per uid, fetched lazily and cached so switching tabs /
// re-rendering doesn't refetch. Same exclusions as the rest of the app (handled
// by speciesSet: reports / Mystery Bird / custom species don't count).
const speciesCountCache = new Map<string, number>();

interface Props {
  person: Person;
  /** This row is the current user → show the YOU tag, no bell, no Follow pill. */
  isMe: boolean;
  /** Following tab and not you → show the notification bell. */
  showBell: boolean;
  mode: NotificationMode;
  onBell: () => void;
  /** Whether the current user already follows this person (seeds the pill). */
  initialFollowing: boolean;
  /** Tap the row body (outside the bell / pill) → open this person's profile. */
  onOpenProfile: () => void;
}

export function FollowRow({
  person,
  isMe,
  showBell,
  mode,
  onBell,
  initialFollowing,
  onOpenProfile,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [species, setSpecies] = useState<number | null>(
    speciesCountCache.get(person.uid) ?? null,
  );

  useEffect(() => {
    if (speciesCountCache.has(person.uid)) return;
    let cancelled = false;
    getSightingsByUid(person.uid)
      .then((sightings) => {
        const count = speciesSet(sightings).size;
        speciesCountCache.set(person.uid, count);
        if (!cancelled) setSpecies(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [person.uid]);

  const handle = person.username.toLowerCase();

  const onToggle = async () => {
    if (busy) return;
    const next = !following;
    setFollowing(next); // optimistic
    setBusy(true);
    try {
      if (next) await followUser(person.uid);
      else await unfollowUser(person.uid);
    } catch (e) {
      console.error('Follow toggle failed:', e);
      setFollowing(!next); // revert
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable style={styles.row} onPress={onOpenProfile}>
      <Avatar name={person.username} seed={person.uid} size={44} />

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{person.username}</Text>
          {isMe && (
            <View style={styles.youTag}>
              <Text style={styles.youTagText}>YOU</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.handle}>@{handle}</Text>
          {species !== null && (
            <>
              <Text style={styles.middot}>·</Text>
              <Text style={styles.species}>{species}</Text>
            </>
          )}
        </View>
      </View>

      {showBell && <NotifBell mode={mode} onPress={onBell} />}

      {!isMe && (
        <Pressable
          onPress={onToggle}
          style={[styles.pill, following ? styles.pillFollowing : styles.pillFollow]}
        >
          <Ionicons
            name={following ? 'checkmark' : 'add'}
            size={12}
            color={following ? palette.ink : '#fff'}
          />
          <Text style={[styles.pillText, following ? styles.pillTextFollowing : styles.pillTextFollow]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  identity: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    fontFamily: font.display,
    fontSize: 15.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  youTag: {
    marginLeft: 6,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.pill,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  youTagText: {
    fontFamily: font.mono,
    fontSize: 9,
    fontWeight: '600',
    color: palette.inkSoft,
    letterSpacing: 0.5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  handle: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft },
  middot: { color: palette.muted },
  species: { fontFamily: font.body, fontSize: 11.5, fontWeight: '700', color: palette.leaf },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    boxShadow: `2px 2px 0 ${palette.ink}`,
    flexShrink: 0,
  },
  pillFollow: { backgroundColor: palette.leaf },
  pillFollowing: { backgroundColor: palette.card },
  pillText: { fontFamily: font.display, fontSize: 12.5, fontWeight: '700' },
  pillTextFollow: { color: '#fff' },
  pillTextFollowing: { color: palette.ink },
});
