import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, recipes, space, type } from '../constants/Colors';
import { BottomSheet } from './BottomSheet';
import { GlobalFirstBadge } from './GlobalFirstBadge';

// Contextual badge tip (Hep request: "explain what the badges are"). Tapping
// a 1ST badge on a sighting card opens a small sheet explaining JUST that
// badge — the one the user is curious about, not a full legend.
//
// openBadgeGuide(key) works from anywhere because a single BadgeGuideHost is
// mounted in the authenticated root layout; badges deep in list rows don't
// each need to own a Modal.

export type BadgeKey = 'lifer' | 'globalFirst';

const TIPS: Record<BadgeKey, { title: string; blurb: string }> = {
  lifer: {
    title: 'Lifer',
    blurb: 'Their first time ever logging this species!',
  },
  globalFirst: {
    title: 'PocketBirds first',
    blurb:
      'The first birder on all of PocketBirds to log this species, verified by community members!',
  },
};

// The lifer blurb speaks in the second person when it's your own sighting.
const OWN_LIFER_BLURB = 'Your first time ever logging this species! Congrats!';

type OpenState = { badge: BadgeKey; own: boolean };

let openListener: ((state: OpenState) => void) | null = null;

export function openBadgeGuide(badge: BadgeKey, own = false) {
  openListener?.({ badge, own });
}

export function BadgeGuideHost() {
  const [state, setState] = useState<OpenState | null>(null);
  useEffect(() => {
    openListener = setState;
    return () => {
      openListener = null;
    };
  }, []);
  return (
    <BottomSheet visible={state !== null} onClose={() => setState(null)}>
      {state !== null && <BadgeTip badge={state.badge} own={state.own} />}
    </BottomSheet>
  );
}

function BadgeTip({ badge, own }: { badge: BadgeKey; own: boolean }) {
  const insets = useSafeAreaInsets();
  const tip = TIPS[badge];
  const blurb = badge === 'lifer' && own ? OWN_LIFER_BLURB : tip.blurb;
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.row}>
        <View style={styles.badgeCell}>
          {badge === 'globalFirst' ? (
            <GlobalFirstBadge />
          ) : (
            <View style={recipes.liferBadge}>
              <Ionicons name="star" size={9} color="#fff" />
              <Text style={recipes.liferBadgeText}>1ST</Text>
            </View>
          )}
        </View>
        <View style={styles.textCell}>
          <Text style={styles.title}>{tip.title}</Text>
          <Text style={styles.blurb}>{blurb}</Text>
        </View>
      </View>
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  badgeCell: {
    width: 64,
    alignItems: 'center',
    paddingTop: 2,
  },
  textCell: {
    flex: 1,
  },
  title: {
    ...type.h3,
    color: palette.ink,
  },
  blurb: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: space.xs,
  },
});
