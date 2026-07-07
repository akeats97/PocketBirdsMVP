import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../config/firebaseConfig';
import { isAdminUid } from '../constants/admin';
import { useSightings } from '../app/context/SightingsContext';
import { confirmDeleteSighting } from '../app/utils/confirmDeleteSighting';
import { formatRelativeDate } from '../app/utils/formatSightingDate';
import { setPhotoUri } from '../app/utils/photoViewer';
import { openBadgeGuide } from './BadgeGuideSheet';
import { BottomSheet } from './BottomSheet';
import { Sighting } from '../app/types';
import { border, font, palette, radius, recipes, space, type } from '../constants/Colors';
import { isMysteryBird } from '../constants/unknownBird';
import { IdentifiedByLine } from './community/IdentifiedByLine';
import { NeedsIdPill } from './community/NeedsIdPill';
import { GlobalFirstBadge } from './GlobalFirstBadge';
import { Owl } from './Owl';
import { SpeciesNameLink } from './SpeciesNameLink';

interface SightingCardProps {
  sighting: Sighting;
  isNewSpecies?: boolean;
  /** Unread hoots/comments/proposals on this sighting (drives the cue). */
  unreadCount?: number;
}

function SightingCard({ sighting, isNewSpecies, unreadCount = 0 }: SightingCardProps) {
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const { deleteSighting, setGlobalFirstVerified } = useSightings();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Admin-only: any photographed sighting can be confirmed (or its confirmation
  // revoked) right from the long-press sheet. The photo gate is deliberate
  // (verification means "a real, pictured sighting"). If the sighting also holds
  // a global-first claim, verifying it lights the gold.
  const canVerify = isAdminUid(auth.currentUser?.uid) && !!sighting.photoUrl && !isMysteryBird(sighting);

  const photoSource = sighting.photoUrl || sighting.photoPath;

  const hootCount = sighting.hootCount ?? 0;
  const commentCount = sighting.commentCount ?? 0;
  const proposalCount = sighting.proposalCount ?? 0;
  const mystery = isMysteryBird(sighting);
  // The footer is a read-only engagement summary — shown only once a sighting
  // has actually collected something. A quiet card stays exactly as before.
  const hasEngagement = hootCount > 0 || commentCount > 0 || proposalCount > 0;

  const openDetail = () => router.push(`/sighting/${sighting.id}`);

  const handleLongPress = () => {
    setIsSheetVisible(true);
  };

  const handleEdit = () => {
    setIsSheetVisible(false);
    router.push(`/sighting/${sighting.id}/edit`);
  };

  const handleDelete = () => {
    setIsSheetVisible(false);
    confirmDeleteSighting(sighting, deleteSighting);
  };

  const handleVerifyToggle = () => {
    setIsSheetVisible(false);
    setGlobalFirstVerified(sighting.id, sighting.birdName, !sighting.verified).catch(() => {});
  };

  return (
    <HardShadow style={styles.shadowWrap}>
      {/* Whole-card tap → detail thread; long-press still opens delete. The
          nested photo / needs-ID pressables intercept their own taps. */}
      <Pressable
        style={styles.card}
        onPress={openDetail}
        onLongPress={handleLongPress}
        delayLongPress={500}
        android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      >
        {/* TODO: IUCN conservation status strip goes here once Wikidata dump exists.
            See CLAUDE.md "Pending Design Work" and design_handoff_pocket_dex/wikidata-dump.md. */}

        {photoSource && (
          <Pressable onPress={() => { setPhotoUri(photoSource); router.push('/photo'); }}>
            <Image
              source={{ uri: photoSource }}
              style={styles.photo}
              contentFit="cover"
            />
          </Pressable>
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.nameBlock}>
              <SpeciesNameLink name={sighting.birdName} textStyle={styles.birdName} numberOfLines={2} />
            </View>

            {/* A verified global-first wears the holo "1ST" globe pill (same as
                the Dex), which supersedes the coral lifer badge — a global-first
                is always your personal first too. See WORK_QUEUE Q-3. */}
            {/* Tapping a badge opens the legend (curiosity is the entry point). */}
            {sighting.globalFirst && sighting.verified ? (
              <Pressable onPress={openBadgeGuide} hitSlop={6}>
                <GlobalFirstBadge />
              </Pressable>
            ) : isNewSpecies ? (
              <Pressable onPress={openBadgeGuide} hitSlop={6}>
                <View style={recipes.liferBadge}>
                  <Ionicons name="star" size={9} color="#fff" />
                  <Text style={recipes.liferBadgeText}>1ST</Text>
                </View>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {sighting.location ? (
              <>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="location"
                    size={12}
                    color={sighting.coordinates ? palette.leaf : palette.muted}
                  />
                  <Text style={styles.metaText} numberOfLines={1}>{sighting.location}</Text>
                </View>
                <Text style={styles.metaDivider}>·</Text>
              </>
            ) : null}
            <Text style={styles.metaText}>{formatRelativeDate(sighting.date)}</Text>
          </View>

          {sighting.identifiedVia === 'community' && (
            <IdentifiedByLine uid={sighting.identifiedBy} username={sighting.identifiedByUsername} />
          )}

          {/* Needs-ID prompt only while there are no proposals yet — once they
              arrive the footer's proposals pill carries the live count. */}
          {mystery && proposalCount === 0 && (
            <View style={styles.needsIdRow}>
              <NeedsIdPill />
              <Text style={styles.needsIdText} numberOfLines={1}>Tap to get an ID</Text>
            </View>
          )}

          {sighting.notes && (
            <Text style={styles.notes} numberOfLines={2}>{sighting.notes}</Text>
          )}
        </View>

        {/* Engagement footer — a read-only summary of the hoots, comments, and
            ID proposals this sighting has collected. The owner can't hoot their
            own sighting, so this is a glance + tap-through, not an action bar.
            Replies happen in the detail thread. */}
        {hasEngagement && (
          <View style={styles.footer}>
            {hootCount > 0 && (
              <View style={styles.stat}>
                <Owl size={18} filled color={palette.coral} />
                <Text style={styles.statText}>{hootCount}</Text>
              </View>
            )}
            {commentCount > 0 && (
              <View style={styles.stat}>
                <Ionicons name="chatbubble-outline" size={16} color={palette.sky} />
                <Text style={styles.statText}>{commentCount}</Text>
              </View>
            )}
            {mystery && proposalCount > 0 && (
              <View style={styles.proposalsPill}>
                <View style={styles.proposalsDot} />
                <Text style={styles.proposalsText} numberOfLines={1}>
                  {sighting.leadingProposal
                    ? sighting.leadingProposal.species
                    : `${proposalCount} ${proposalCount === 1 ? 'proposal' : 'proposals'}`}
                </Text>
              </View>
            )}

            <View style={styles.trailing}>
              <Text style={[styles.trailingText, unreadCount > 0 && styles.trailingNew]}>
                {unreadCount > 0 ? `${unreadCount} new` : 'View'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={unreadCount > 0 ? palette.leaf : palette.muted}
              />
            </View>
          </View>
        )}
      </Pressable>

      {/* Unread cue — coral dot riding the top-left corner, mirroring the inbox.
          Sits outside the clipped card so the corner radius doesn't crop it. */}
      {unreadCount > 0 && <View style={styles.unreadDot} pointerEvents="none" />}

      {/* Long-press action sheet — Edit · Delete · Cancel. Slides up from the
          bottom while the scrim fades (the app-wide BottomSheet motion). */}
      <BottomSheet visible={isSheetVisible} onClose={() => setIsSheetVisible(false)}>
        <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + space.sm }]}>
          <View style={styles.sheetChipRow}>
            <Text style={styles.sheetChip}>
              {sighting.birdName} · {formatRelativeDate(sighting.date)}
            </Text>
          </View>

          <HardShadow offset={4} borderRadius={radius.card}>
            <View style={styles.sheetCard}>
              {canVerify && (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: palette.sunSoft }]}
                    onPress={handleVerifyToggle}
                  >
                    <View style={[styles.sheetIconTile, { backgroundColor: palette.sunSoft }]}>
                      <Ionicons
                        name={sighting.verified ? 'close-circle' : sighting.globalFirst ? 'trophy' : 'checkmark-circle'}
                        size={18}
                        color={palette.ink}
                      />
                    </View>
                    <View style={styles.sheetRowBody}>
                      <Text style={styles.sheetRowTitle}>
                        {sighting.verified ? 'Remove verification' : 'Verify sighting'}
                      </Text>
                      <Text style={styles.sheetRowSub}>
                        {sighting.verified
                          ? (sighting.globalFirst ? 'Removes the first-on-Pocket-Birds gold' : 'Take back the verification')
                          : (sighting.globalFirst ? 'Confirms it, and lights the global-first gold' : 'Confirm this is a real sighting')}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.sheetDivider} />
                </>
              )}

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: palette.leafSoft }]}
                onPress={handleEdit}
              >
                <View style={styles.sheetIconTile}>
                  <Ionicons name="pencil" size={18} color={palette.ink} />
                </View>
                <View style={styles.sheetRowBody}>
                  <Text style={styles.sheetRowTitle}>Edit sighting</Text>
                  <Text style={styles.sheetRowSub}>Change species, place, date or photo</Text>
                </View>
              </Pressable>

              <View style={styles.sheetDivider} />

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: palette.coralSoft }]}
                onPress={handleDelete}
              >
                <View style={[styles.sheetIconTile, { backgroundColor: palette.coralSoft }]}>
                  <Ionicons name="trash" size={18} color={palette.crimson} />
                </View>
                <View style={styles.sheetRowBody}>
                  <Text style={[styles.sheetRowTitle, { color: palette.crimson }]}>Delete sighting</Text>
                  <Text style={styles.sheetRowSub}>Remove from journal and dex</Text>
                </View>
              </Pressable>
            </View>
          </HardShadow>

          <View style={styles.sheetCancelWrap}>
            <HardShadow offset={4} borderRadius={radius.card}>
              <Pressable style={styles.sheetCancel} onPress={() => setIsSheetVisible(false)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </HardShadow>
          </View>
        </View>
      </BottomSheet>
    </HardShadow>
  );
}

// Memoized: in the virtualized Journal list, this lets a row skip re-rendering
// when its props (sighting ref, isNewSpecies, unreadCount) are unchanged — even
// when the list container re-renders (e.g. an unrelated activity update).
export default React.memo(SightingCard);

/**
 * Hard offset shadow. RN's shadow props can't render a hard, no-blur shadow,
 * so we stack an absolutely-positioned ink rectangle one layer below the
 * content. Reserve room for the offset with marginRight + marginBottom.
 */
export function HardShadow({
  children,
  style,
  offset = 4,
  borderRadius = radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  offset?: number;
  borderRadius?: number;
}) {
  return (
    <View style={style}>
      <View style={{ marginRight: offset, marginBottom: offset }}>
        <View
          style={{
            position: 'absolute',
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
            backgroundColor: palette.ink,
            borderRadius,
          }}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: space.lg,
    marginVertical: space.sm,
  },
  card: {
    ...recipes.card,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: palette.leafSoft,
  },
  body: {
    padding: space.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  birdName: {
    ...type.h3,
    color: palette.ink,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  metaText: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontWeight: '500',
  },
  metaDivider: {
    color: palette.muted,
  },
  notes: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: space.sm,
    fontStyle: 'italic',
  },

  // "Needs ID" cue for Mystery Birds (denormalized fields — no listener).
  needsIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  needsIdText: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontWeight: '500',
    flexShrink: 1,
  },

  // Engagement footer — divided from the body by the 2px ink rule, matching
  // FriendSightingCard's footer language but read-only (counts, not actions).
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontFamily: font.bodyBold,
    fontSize: 12.5,
    color: palette.ink,
  },
  proposalsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.sunSoft,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
    flexShrink: 1,
  },
  proposalsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.coral,
  },
  proposalsText: {
    fontFamily: font.bodyBold,
    fontSize: 11.5,
    color: palette.ink,
    flexShrink: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  trailingText: {
    ...type.bodyS,
    color: palette.muted,
    fontWeight: '500',
  },
  trailingNew: {
    color: palette.leaf,
    fontFamily: font.bodyBold,
  },

  // Unread dot — coral, cream-ringed, riding the card's top-left corner.
  unreadDot: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.coral,
    borderWidth: 3,
    borderColor: palette.cream,
    zIndex: 10,
  },

  // Long-press action sheet (scrim + slide handled by BottomSheet)
  sheetWrap: {
    padding: space.sm,
  },
  sheetChipRow: {
    alignItems: 'center',
    marginBottom: space.sm,
  },
  sheetChip: {
    backgroundColor: palette.ink,
    color: palette.cream,
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  sheetCard: {
    ...recipes.card,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
  },
  sheetIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    ...border.thick,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowBody: {
    flex: 1,
    minWidth: 0,
  },
  sheetRowTitle: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  sheetRowSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
  sheetDivider: {
    height: 1.5,
    backgroundColor: palette.rule,
  },
  sheetCancelWrap: {
    marginTop: space.sm,
  },
  sheetCancel: {
    backgroundColor: palette.cream,
    borderRadius: radius.card,
    ...border.thick,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
    color: palette.inkSoft,
    letterSpacing: -0.3,
  },
});
