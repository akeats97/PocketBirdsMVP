import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotificationMode } from '../../app/services/notificationPrefsService';
import { font, palette, radius, space } from '../../constants/Colors';
import { Avatar } from './Avatar';
import { BellGlyph, bellColor } from './NotifBell';

const OPTIONS: { mode: NotificationMode; title: string; sub: string }[] = [
  { mode: 'all', title: 'All sightings', sub: 'Push every time.' },
  { mode: 'highlights', title: 'Highlights only', sub: 'New species and milestones.' },
  { mode: 'none', title: 'Nothing', sub: 'Silent, but still in your feed.' },
];

interface Props {
  visible: boolean;
  person: { uid: string; username: string } | null;
  mode: NotificationMode;
  onPick: (mode: NotificationMode) => void;
  onClose: () => void;
}

// Bottom-sheet picker for the three notification levels for one followed user.
// Tapping a row commits that mode and dismisses; tapping the scrim dismisses
// without change. Writes go through notificationPrefsService (caller's onPick).
export function NotifPrefSheet({ visible, person, mode, onPick, onClose }: Props) {
  return (
    <Modal
      visible={visible && !!person}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header — who this is about */}
          <View style={styles.header}>
            {person && <Avatar name={person.username} seed={person.uid} size={34} />}
            <View style={{ minWidth: 0 }}>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.sub} numberOfLines={1}>about {person?.username}</Text>
            </View>
          </View>

          {OPTIONS.map((opt) => {
            const on = mode === opt.mode;
            return (
              <Pressable
                key={opt.mode}
                style={[styles.option, on ? styles.optionOn : styles.optionOff]}
                onPress={() => onPick(opt.mode)}
              >
                <BellGlyph mode={opt.mode} size={17} color={bellColor(opt.mode)} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <Text style={styles.optionSub}>{opt.sub}</Text>
                </View>
                {on && <Ionicons name="checkmark" size={16} color={palette.leaf} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(26,36,23,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.md,
  },
  title: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.4,
  },
  sub: {
    fontFamily: font.mono,
    fontSize: 11,
    color: palette.inkSoft,
    marginTop: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    borderWidth: 2,
    marginBottom: space.sm,
  },
  optionOn: {
    borderColor: palette.ink,
    backgroundColor: palette.card,
    boxShadow: `2px 2px 0 ${palette.ink}`,
  },
  optionOff: {
    borderColor: palette.rule,
    backgroundColor: 'transparent',
  },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontFamily: font.display,
    fontSize: 14.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  optionSub: {
    fontFamily: font.body,
    fontSize: 11.5,
    color: palette.inkSoft,
    marginTop: 1,
  },
});
