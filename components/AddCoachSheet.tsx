import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, palette, radius, recipes, space, type } from '../constants/Colors';
import { BottomSheet } from './BottomSheet';
import { HardShadow } from './SightingCard';

// One-time first-run primer for the Add flow. New users assume the photo will
// auto-identify the bird (every other nature app works that way) and stall
// when they can't name the species. This sheet sets the real mental model
// once, before they hit that wall: log anything, tap ? when unsure, friends
// propose the ID. Shown on the first visit to the Add tab only; the seen flag
// is written on dismiss so an interrupted first run replays it.
const SEEN_KEY = 'add.coachSeen.v1';

export default function AddCoachSheet() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (!seen && !cancelled) setVisible(true);
      } catch {
        // Can't read the flag: skip the primer rather than risk nagging.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.kicker}>How logging works</Text>
        <Text style={styles.title}>Log any bird, even ones you can&apos;t name.</Text>

        <View style={styles.row}>
          <View style={[styles.tile, { backgroundColor: palette.skySoft }]}>
            <Ionicons name="camera" size={17} color={palette.sky} />
          </View>
          <Text style={styles.rowText}>Snap a photo &amp; jot down what you saw.</Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.tile, { backgroundColor: palette.sunSoft }]}>
            <Text style={styles.tileGlyph}>?</Text>
          </View>
          <Text style={styles.rowText}>
            Not sure what it is? Tap the <Text style={styles.rowBold}>?</Text> to log a Mystery
            Bird.
          </Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.tile, { backgroundColor: palette.coralSoft }]}>
            <Ionicons name="people" size={16} color={palette.coral} />
          </View>
          <Text style={styles.rowText}>
            Friends propose an ID. Accept one and it lands in your Dex.
          </Text>
        </View>

        <View style={styles.buttonWrap}>
          <HardShadow offset={4} borderRadius={radius.input}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && { backgroundColor: palette.ink }]}
              onPress={dismiss}
            >
              <Text style={styles.buttonText}>Got it, start logging</Text>
            </Pressable>
          </HardShadow>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: palette.cream,
    borderTopWidth: 2,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
  kicker: {
    ...type.monoTag,
    color: palette.leaf,
    marginBottom: space.xs + 2,
  },
  title: {
    ...type.h2,
    color: palette.ink,
    marginBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  tile: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGlyph: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
  },
  rowText: {
    ...type.body,
    color: palette.ink,
    flex: 1,
    lineHeight: 18,
  },
  rowBold: {
    fontFamily: font.bodyBold,
  },
  buttonWrap: {
    marginTop: space.sm,
  },
  button: {
    ...recipes.buttonPrimary,
  },
  buttonText: {
    ...recipes.buttonPrimaryText,
  },
});
