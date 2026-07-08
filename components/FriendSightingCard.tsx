import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHoots } from '../app/context/HootsContext';
import { setPhotoUri } from '../app/utils/photoViewer';
import { formatRelativeDate } from '../app/utils/formatSightingDate';
import { FriendSighting } from '../app/types';
import { auth } from '../config/firebaseConfig';
import { isAdminUid } from '../constants/admin';
import { setSightingGlobalFirstVerified } from '../app/services/sightingService';
import { border, font, palette, radius, recipes, space, type } from '../constants/Colors';
import { isMysteryBird } from '../constants/unknownBird';
import { openBadgeGuide } from './BadgeGuideSheet';
import { BottomSheet } from './BottomSheet';
import { HardShadow } from './SightingCard';
import { SpeciesNameLink } from './SpeciesNameLink';
import { GlobalFirstBadge } from './GlobalFirstBadge';
import { IdentifiedByLine } from './community/IdentifiedByLine';
import { NeedsIdPill } from './community/NeedsIdPill';
import { Avatar } from './social/Avatar';
import { FacePile } from './social/FacePile';
import { HootListSheet } from './social/HootListSheet';
import { SocialFooter } from './social/SocialFooter';

interface FriendSightingCardProps {
  sighting: FriendSighting;
  isFirstSighting?: boolean;
  /** Hide the friend name tag (e.g. on a profile, where the owner is implied). */
  hideTag?: boolean;
}

// "Victoria, Marco & 10 others hooted" — first two hooter names bold, rest
// collapsed into a count. Caller guarantees count > 0 and at least one hooter.
function HootSummaryText({
  hooters,
  count,
}: {
  hooters: { uid: string; username: string }[];
  count: number;
}) {
  const names = hooters.slice(0, 2).map((h) => h.username);
  const others = count - names.length;
  return (
    <Text style={styles.summaryText} numberOfLines={1}>
      <Text style={styles.summaryName}>{names.join(', ')}</Text>
      {others > 0 ? ` & ${others} other${others === 1 ? '' : 's'} hooted` : ' hooted'}
    </Text>
  );
}

function FriendSightingCard({ sighting, isFirstSighting, hideTag }: FriendSightingCardProps) {
  const [showHootList, setShowHootList] = useState(false);
  const [verifySheet, setVerifySheet] = useState(false);
  const { hasHooted, hootCount, toggleHoot } = useHoots();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Admin-only: long-press a friend's photographed sighting to confirm or revoke
  // verification (no edit/delete on someone else's post). If it also holds a
  // global-first claim, verifying lights the gold. The write rides the live
  // friend-feed snapshot, so no local patch is needed.
  const canVerify = isAdminUid(auth.currentUser?.uid) && !!sighting.photoUrl && !isMysteryBird(sighting);
  const handleVerifyToggle = () => {
    setVerifySheet(false);
    setSightingGlobalFirstVerified(sighting.id, sighting.birdName, !sighting.verified).catch(() => {});
  };

  const hooted = hasHooted(sighting.id);
  const count = hootCount(sighting);
  const hooters = sighting.recentHooters ?? [];
  const commentCount = sighting.commentCount ?? 0;
  const topComment = sighting.topComment;

  const openDetail = () => router.push(`/sighting/${sighting.id}`);

  return (
    <HardShadow style={styles.shadowWrap}>
      <View style={styles.card}>
        {sighting.photoUrl && (
          <Pressable onPress={() => { setPhotoUri(sighting.photoUrl!); router.push('/photo'); }}>
            <Image
              source={{ uri: sighting.photoUrl }}
              style={styles.photo}
              contentFit="cover"
            />
          </Pressable>
        )}

        <Pressable
          style={styles.body}
          onPress={openDetail}
          onLongPress={canVerify ? () => setVerifySheet(true) : undefined}
          delayLongPress={500}
        >
          {/* Friend tag — tappable, links to the poster's profile */}
          {!hideTag && (
            <View style={styles.friendTagRow}>
              <Pressable
                style={({ pressed }) => [styles.friendTag, pressed && sighting.friendId && { backgroundColor: palette.sky }]}
                onPress={() => sighting.friendId && router.push(`/profile/${sighting.friendId}`)}
                disabled={!sighting.friendId}
                hitSlop={6}
              >
                <Ionicons name="person" size={10} color={palette.ink} />
                <Text style={styles.friendTagText} numberOfLines={1}>
                  {sighting.friendName.toUpperCase()}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.headerRow}>
            <View style={styles.nameBlock}>
              <SpeciesNameLink name={sighting.birdName} textStyle={styles.birdName} numberOfLines={2} />
            </View>

            {/* A verified global-first wears the holo "1ST" globe pill (same as
                the Dex), which supersedes the coral lifer badge — a global-first
                is always a personal first too. See WORK_QUEUE Q-3. */}
            {/* Tapping a badge explains it (curiosity is the entry point). */}
            {sighting.globalFirst && sighting.verified ? (
              <Pressable onPress={() => openBadgeGuide('globalFirst')} hitSlop={6}>
                <GlobalFirstBadge />
              </Pressable>
            ) : isFirstSighting ? (
              <Pressable onPress={() => openBadgeGuide('lifer')} hitSlop={6}>
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
                  <Ionicons name="location" size={12} color={palette.muted} />
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

          {isMysteryBird(sighting) && (
            <View style={styles.needsIdRow}>
              <NeedsIdPill />
              <Text style={styles.needsIdText} numberOfLines={1}>
                {(sighting.proposalCount ?? 0) > 0
                  ? sighting.leadingProposal
                    ? `Front-runner: ${sighting.leadingProposal.species}`
                    : `${sighting.proposalCount} ${sighting.proposalCount === 1 ? 'proposal' : 'proposals'}`
                  : 'Help ID it'}
              </Text>
            </View>
          )}

          {sighting.notes && (
            <Text style={styles.notes} numberOfLines={2}>{sighting.notes}</Text>
          )}
        </Pressable>

        {/* Social footer — hoot summary (expanded) + the split action bar */}
        <View style={styles.footer}>
          {count > 0 && hooters.length > 0 && (
            <Pressable style={styles.hootSummary} onPress={() => setShowHootList(true)}>
              <FacePile
                people={hooters.map((h) => ({ name: h.username, seed: h.uid }))}
                max={3}
                size={26}
              />
              <HootSummaryText hooters={hooters} count={count} />
            </Pressable>
          )}
          <SocialFooter
            hooted={hooted}
            hootCount={count}
            commentCount={commentCount}
            onHoot={() => toggleHoot(sighting.id)}
            onComment={openDetail}
          />

          {/* Top-comment preview (expanded density) */}
          {commentCount > 0 && topComment && (
            <Pressable style={styles.commentPreview} onPress={openDetail}>
              {commentCount > 1 && (
                <Text style={styles.viewAll}>View all {commentCount} comments</Text>
              )}
              <View style={styles.previewRow}>
                {/* The row opens the detail; the commenter's face goes to
                    their profile (HEP-3 username sweep). */}
                <Pressable onPress={() => router.push(`/profile/${topComment.uid}`)} hitSlop={4}>
                  <Avatar name={topComment.username} seed={topComment.uid} size={24} />
                </Pressable>
                <Text style={styles.previewText} numberOfLines={2}>
                  <Text
                    style={styles.previewName}
                    onPress={() => router.push(`/profile/${topComment.uid}`)}
                  >
                    {topComment.username}{' '}
                  </Text>
                  {topComment.text}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <HootListSheet
        sightingId={sighting.id}
        visible={showHootList}
        onClose={() => setShowHootList(false)}
      />

      {/* Admin verify sheet — single action, no edit/delete on a friend's post */}
      <BottomSheet visible={verifySheet} onClose={() => setVerifySheet(false)}>
        <View style={[styles.verifyWrap, { paddingBottom: insets.bottom + space.sm }]}>
          <View style={styles.verifyChipRow}>
            <Text style={styles.verifyChip}>
              {sighting.birdName} · {sighting.friendName}
            </Text>
          </View>
          <HardShadow offset={4} borderRadius={radius.card}>
            <View style={styles.verifyCard}>
              <Pressable
                style={({ pressed }) => [styles.verifyRow, pressed && { backgroundColor: palette.sunSoft }]}
                onPress={handleVerifyToggle}
              >
                <View style={styles.verifyIconTile}>
                  <Ionicons
                    name={sighting.verified ? 'close-circle' : sighting.globalFirst ? 'trophy' : 'checkmark-circle'}
                    size={18}
                    color={palette.ink}
                  />
                </View>
                <View style={styles.verifyRowBody}>
                  <Text style={styles.verifyRowTitle}>
                    {sighting.verified ? 'Remove verification' : 'Verify sighting'}
                  </Text>
                  <Text style={styles.verifyRowSub}>
                    {sighting.verified
                      ? (sighting.globalFirst ? 'Removes the first-on-Pocket-Birds gold' : 'Take back the verification')
                      : (sighting.globalFirst ? 'Confirms it, and lights the global-first gold' : 'Confirm this is a real sighting')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </HardShadow>
          <View style={styles.verifyCancelWrap}>
            <HardShadow offset={4} borderRadius={radius.card}>
              <Pressable style={styles.verifyCancel} onPress={() => setVerifySheet(false)}>
                <Text style={styles.verifyCancelText}>Cancel</Text>
              </Pressable>
            </HardShadow>
          </View>
        </View>
      </BottomSheet>
    </HardShadow>
  );
}

// Memoized: the friends feed re-renders on every live sightings snapshot; this
// lets unchanged rows bail out instead of all re-rendering each update.
export default React.memo(FriendSightingCard);

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
    backgroundColor: palette.skySoft,
  },
  body: {
    padding: space.lg,
  },

  // Friend tag — sky-blue accent identifying who logged it
  friendTagRow: {
    flexDirection: 'row',
    marginBottom: space.sm,
  },
  friendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.skySoft,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.ink,
    maxWidth: '100%',
  },
  friendTagText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 10,
    color: palette.ink,
    letterSpacing: 1.2,
    fontWeight: '700',
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

  // "Needs ID" cue for Mystery Birds on the feed (denormalized — no listener).
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

  // Social footer region — divided from the card body by the 2px ink rule.
  footer: {
    borderTopWidth: 2,
    borderTopColor: palette.ink,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  hootSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.md,
  },
  summaryText: {
    ...type.bodyS,
    color: palette.inkSoft,
    flex: 1,
  },
  summaryName: {
    color: palette.ink,
    fontFamily: font.bodyBold,
  },

  // Top-comment preview below the action bar
  commentPreview: {
    marginTop: space.md,
  },
  viewAll: {
    ...type.bodyS,
    color: palette.inkSoft,
    fontFamily: font.bodyBold,
    marginBottom: space.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  previewText: {
    ...type.bodyS,
    color: palette.inkSoft,
    flex: 1,
    lineHeight: 18,
  },
  previewName: {
    color: palette.ink,
    fontFamily: font.bodyBold,
  },

  // Admin verify sheet
  verifyWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
  verifyChipRow: {
    alignItems: 'center',
  },
  verifyChip: {
    ...type.bodyS,
    color: palette.cream,
    backgroundColor: palette.ink,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  verifyCard: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    ...border.thick,
    overflow: 'hidden',
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  verifyIconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.input,
    backgroundColor: palette.sunSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...border.thick,
  },
  verifyRowBody: {
    flex: 1,
  },
  verifyRowTitle: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
  verifyRowSub: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 1,
  },
  verifyCancelWrap: {
    alignItems: 'stretch',
  },
  verifyCancel: {
    backgroundColor: palette.card,
    borderRadius: radius.card,
    ...border.thick,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  verifyCancelText: {
    ...type.bodyL,
    color: palette.ink,
    fontWeight: '700',
  },
});
