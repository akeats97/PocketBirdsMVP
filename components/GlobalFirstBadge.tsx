import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { font, palette, radius } from '../constants/Colors';
import { HoloFill } from './Holo';

// The "1ST" global-first badge — holographic fill behind a globe icon. Mirrors
// the Dex tile's globePill (app/(tabs)/dex.tsx) so the sighting card and the Dex
// read as the same treatment. Shown on a sighting card only when the sighting is
// BOTH global-first AND admin-verified, superseding the coral lifer "1ST" badge
// (a global-first is always your personal first too). See WORK_QUEUE Q-3.
export function GlobalFirstBadge() {
  return (
    <View style={styles.pill}>
      <HoloFill />
      <Ionicons name="globe-outline" size={9} color={palette.ink} />
      <Text style={styles.pillText}>1ST</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  pillText: {
    fontFamily: font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: palette.ink,
  },
});
