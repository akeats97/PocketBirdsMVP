import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, recipes, space, type } from '../constants/Colors';
import { BottomSheet } from './BottomSheet';
import { GlobalFirstBadge } from './GlobalFirstBadge';
import { NeedsIdPill } from './community/NeedsIdPill';

// The badge legend (Hep request: "explain what the badges are"). One sheet,
// each row shows the REAL badge next to one plain sentence. Opened from the
// You tab's ⋯ menu and by tapping any badge on a sighting card.
//
// openBadgeGuide() works from anywhere because a single BadgeGuideHost is
// mounted in the authenticated root layout; badges deep in list rows don't
// each need to own a Modal.

let openListener: (() => void) | null = null;

export function openBadgeGuide() {
  openListener?.();
}

export function BadgeGuideHost() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    openListener = () => setVisible(true);
    return () => {
      openListener = null;
    };
  }, []);
  return (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <BadgeGuideContent />
    </BottomSheet>
  );
}

function GuideRow({ badge, title, blurb }: {
  badge: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.badgeCell}>{badge}</View>
      <View style={styles.textCell}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBlurb}>{blurb}</Text>
      </View>
    </View>
  );
}

function BadgeGuideContent() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={styles.title}>What the badges mean</Text>

      <GuideRow
        badge={
          <View style={recipes.liferBadge}>
            <Ionicons name="star" size={9} color="#fff" />
            <Text style={recipes.liferBadgeText}>1ST</Text>
          </View>
        }
        title="Lifer"
        blurb="Your first time logging this species. One more for the life list."
      />
      <GuideRow
        badge={<GlobalFirstBadge />}
        title="Pocket Birds first"
        blurb="The first birder on all of Pocket Birds to log this species, verified. Outranks the red one."
      />
      <GuideRow
        badge={<NeedsIdPill />}
        title="Mystery Bird"
        blurb="Logged without an ID. Friends propose a species; the owner picks the winner."
      />
      <GuideRow
        badge={
          <View style={styles.idByExample}>
            <Ionicons name="people" size={12} color={palette.leaf} />
            <Text style={styles.idByText}>ID&apos;d by @flockmate</Text>
          </View>
        }
        title="Community ID"
        blurb="Who called it. This Mystery Bird was identified by a friend."
      />
      <GuideRow
        badge={<Ionicons name="location" size={16} color={palette.leaf} />}
        title="Green pin"
        blurb="Exact GPS coordinates are attached, not just a place name. Gray means name only."
      />
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
    paddingTop: space.lg,
  },
  title: {
    ...type.h3,
    color: palette.ink,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
  },
  badgeCell: {
    width: 64,
    alignItems: 'center',
    paddingTop: 2,
  },
  textCell: {
    flex: 1,
  },
  rowTitle: {
    ...type.body,
    color: palette.ink,
    fontWeight: '700',
  },
  rowBlurb: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
  idByExample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  idByText: {
    ...type.bodyS,
    color: palette.leaf,
    fontWeight: '600',
  },
});
