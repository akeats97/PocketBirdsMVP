import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, palette, radius, space } from '../../constants/Colors';
import { HardShadow } from '../SightingCard';

interface AcceptBarProps {
  /** The species the owner hooted, or null if they haven't picked one yet. */
  species: string | null;
  busy?: boolean;
  onAccept: () => void;
}

// Owner-only bar pinned above the comment composer on a Mystery Bird with
// proposals. The owner hoots the proposal they agree with; this bar then
// targets that one. Accepting sets the species and drops it into their Dex.
export function AcceptBar({ species, busy, onAccept }: AcceptBarProps) {
  const ready = !!species;
  return (
    <View style={styles.wrap}>
      <HardShadow offset={4} borderRadius={radius.input}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            !ready && styles.btnDisabled,
            ready && (pressed || busy) && { opacity: 0.85 },
          ]}
          onPress={onAccept}
          disabled={!ready || busy}
        >
          <Ionicons
            name={ready ? 'checkmark' : 'arrow-up'}
            size={17}
            color={ready ? '#fff' : palette.inkSoft}
          />
          <Text style={[styles.btnText, !ready && styles.btnTextDisabled]} numberOfLines={1}>
            {ready ? `Accept “${species}” as the ID` : 'Hoot the one you agree with'}
          </Text>
        </Pressable>
      </HardShadow>
      <Text style={styles.caption}>
        {ready ? 'SETS THE SPECIES · ADDS IT TO YOUR DEX' : 'HOOT A PROPOSAL TO LOCK IT IN'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  btn: {
    backgroundColor: palette.leaf,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Not-yet-selected state: opaque muted fill (no opacity, so the hard shadow
  // doesn't bleed through) prompting the owner to hoot one first.
  btnDisabled: {
    backgroundColor: palette.card,
  },
  btnText: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  btnTextDisabled: {
    color: palette.inkSoft,
  },
  caption: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: palette.inkSoft,
    textAlign: 'center',
    marginTop: 7,
    letterSpacing: 0.3,
  },
});
