import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAccountVisibility } from '../../app/services/userService';
import { border, palette, radius, space, type } from '../../constants/Colors';
import { BottomSheet } from '../BottomSheet';

// Account visibility (PL-1). Public is the default: any signed-in birder can
// see your sightings and Dex. Private scopes them to your followers. Hosted by
// the self ProfileView; openVisibilitySheet() lets the AppHeader's ⋯ menu
// (which sits above the You tab) trigger it without plumbing props through the
// tab tree — same pattern as openEditProfile.

let openListener: (() => void) | null = null;

export function openVisibilitySheet() {
  if (openListener) openListener();
  else Alert.alert('Hmm', 'Open your profile tab first, then try again.');
}

function OptionRow({ icon, label, sub, selected, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && !disabled && { backgroundColor: palette.card },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={20} color={palette.ink} style={styles.optionIcon} />
      <View style={styles.optionTextWrap}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      {selected && <Ionicons name="checkmark" size={20} color={palette.ink} />}
    </Pressable>
  );
}

export function VisibilitySheet({ isPublic, onSaved }: {
  /** The current saved visibility. */
  isPublic: boolean;
  onSaved: (isPublic: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = openListener;
    openListener = () => setVisible(true);
    return () => {
      openListener = prev;
    };
  }, []);

  const close = () => {
    if (saving) return;
    setVisible(false);
  };

  const pick = async (next: boolean) => {
    if (saving) return;
    if (next === isPublic) {
      setVisible(false);
      return;
    }
    setSaving(true);
    try {
      await setAccountVisibility(next);
      onSaved(next);
      setSaving(false);
      setVisible(false);
    } catch {
      setSaving(false);
      Alert.alert('Error', "Couldn't update your visibility. Please try again.");
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>Who can see your sightings?</Text>

        <OptionRow
          icon="earth-outline"
          label="Public"
          sub="Any birder on PocketBirds can see your sightings and Bird Dex. Your photos join each species' community gallery and help other birders ID what they've spotted."
          selected={isPublic}
          disabled={saving}
          onPress={() => pick(true)}
        />
        <OptionRow
          icon="lock-closed-outline"
          label="Private"
          sub="Only birders who follow you can. Everyone else sees just your name and a Follow button."
          selected={!isPublic}
          disabled={saving}
          onPress={() => pick(false)}
        />
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
    paddingTop: space.lg,
  },
  title: {
    ...type.h3,
    color: palette.ink,
    marginBottom: space.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    marginBottom: space.sm,
  },
  optionSelected: {
    backgroundColor: palette.card,
    ...border.thick,
  },
  optionIcon: {
    width: 24,
    textAlign: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  optionSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
});
