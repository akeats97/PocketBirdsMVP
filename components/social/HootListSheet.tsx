import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HootEntry, subscribeToHoots } from '../../app/services/hootService';
import { timeAgo } from '../../app/utils/timeAgo';
import { font, palette, space, type } from '../../constants/Colors';
import { Owl } from '../Owl';
import { Avatar } from './Avatar';

interface HootListSheetProps {
  sightingId: string;
  visible: boolean;
  onClose: () => void;
}

// Bottom sheet listing everyone who hooted a sighting, live. Opened by tapping
// the hoot count / face pile on a card.
// Far enough below the screen that the sheet is fully off-frame at rest,
// even on tall phones. Drives both the slide-up entrance and drag-to-dismiss.
const SHEET_OFFSCREEN = 800;
const DISMISS_DISTANCE = 120;

export function HootListSheet({ sightingId, visible, onClose }: HootListSheetProps) {
  const [hoots, setHoots] = useState<HootEntry[]>([]);
  const router = useRouter();

  // Single value drives everything: the sheet's Y offset (slide up on open,
  // follow the finger on drag) AND the backdrop opacity (derived below). The
  // Modal itself uses animationType="none" so the translucent backdrop never
  // sweeps up from the bottom — only the sheet moves; the dark layer fades.
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_OFFSCREEN],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Slide the sheet down and out, then unmount via onClose.
  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: SHEET_OFFSCREEN,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  // Jump to the tapped hooter's profile. Close instantly (no slide-out) so the
  // sheet doesn't animate down over the freshly-pushed profile screen.
  const openProfile = (uid: string) => {
    translateY.setValue(SHEET_OFFSCREEN);
    onClose();
    router.push(`/profile/${uid}`);
  };

  useEffect(() => {
    if (!visible) return;
    // Start off-screen, then spring up.
    translateY.setValue(SHEET_OFFSCREEN);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
    const unsubscribe = subscribeToHoots(
      sightingId,
      setHoots,
      (error) => console.error('Error loading hoots:', error)
    );
    return () => unsubscribe();
  }, [visible, sightingId, translateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.root}>
        {/* Translucent backdrop: fades in place, never slides. */}
        <Animated.View
          style={[styles.backdropFill, { opacity: backdropOpacity }]}
          pointerEvents="none"
        />
        {/* Full-screen tap catcher behind the sheet. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Drag zone: grabber + header. The list below scrolls independently. */}
          <View {...panResponder.panHandlers}>
            <View style={styles.grabberRow}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.header}>
              <Owl size={24} filled disc color={palette.coral} />
              <Text style={styles.headerText}>
                {hoots.length} {hoots.length === 1 ? 'hoot' : 'hoots'}
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.listContent}>
            {hoots.map((h) => (
              <Pressable
                key={h.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => openProfile(h.uid)}
              >
                <Avatar name={h.username} seed={h.uid} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{h.username}</Text>
                  <Text style={styles.handle} numberOfLines={1}>@{h.username}</Text>
                </View>
                <Text style={styles.time}>{timeAgo(h.createdAt?.toDate?.() ?? null, true)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 36, 23, 0.5)',
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
  rowPressed: {
    backgroundColor: palette.rule,
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
