import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HootEntry, subscribeToHoots } from '../../app/services/hootService';
import { font, palette, space, type } from '../../constants/Colors';
import { Owl } from '../Owl';
import { Avatar } from './Avatar';

interface HootListSheetProps {
  sightingId: string;
  visible: boolean;
  onClose: () => void;
}

function relativeTime(date: Date | null): string {
  if (!date) return 'now';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Bottom sheet listing everyone who hooted a sighting, live. Opened by tapping
// the hoot count / face pile on a card.
export function HootListSheet({ sightingId, visible, onClose }: HootListSheetProps) {
  const [hoots, setHoots] = useState<HootEntry[]>([]);

  useEffect(() => {
    if (!visible) return;
    const unsubscribe = subscribeToHoots(
      sightingId,
      setHoots,
      (error) => console.error('Error loading hoots:', error)
    );
    return () => unsubscribe();
  }, [visible, sightingId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop taps inside the sheet from closing it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.header}>
            <Owl size={24} filled disc color={palette.coral} />
            <Text style={styles.headerText}>
              {hoots.length} {hoots.length === 1 ? 'hoot' : 'hoots'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.listContent}>
            {hoots.map((h) => (
              <View key={h.id} style={styles.row}>
                <Avatar name={h.username} seed={h.uid} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{h.username}</Text>
                  <Text style={styles.handle} numberOfLines={1}>@{h.username}</Text>
                </View>
                <Text style={styles.time}>{relativeTime(h.createdAt?.toDate?.() ?? null)}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
    borderColor: palette.ink,
    maxHeight: '78%',
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1.5,
    borderBottomColor: palette.rule,
  },
  headerText: {
    ...type.h2,
    color: palette.ink,
  },
  listContent: {
    paddingVertical: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.xl,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...type.h3,
    color: palette.ink,
  },
  handle: {
    fontFamily: font.mono,
    fontSize: 11,
    color: palette.inkSoft,
  },
  time: {
    fontFamily: font.mono,
    fontSize: 10,
    color: palette.muted,
  },
});
