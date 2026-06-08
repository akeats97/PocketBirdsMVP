import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, palette, radius } from '../../constants/Colors';

// The sun-soft "NEEDS ID" pill with a coral dot. Shown in the Mystery Bird
// detail nav bar and (compact) on Journal / Friends feed cards.
export function NeedsIdPill() {
  return (
    <View style={styles.pill}>
      <View style={styles.dot} />
      <Text style={styles.label}>NEEDS ID</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.sunSoft,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.coral,
  },
  label: {
    fontFamily: font.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 0.5,
  },
});
