import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HardShadow } from '../../components/SightingCard';
import { Owl } from '../../components/Owl';
import { Avatar } from '../../components/social/Avatar';
import { FacePile } from '../../components/social/FacePile';
import { HootButton } from '../../components/social/HootButton';
import { HootListSheet } from '../../components/social/HootListSheet';
import { AcceptBar } from '../../components/community/AcceptBar';
import { CommunityIdSection } from '../../components/community/CommunityIdSection';
import { MysteryPhoto } from '../../components/community/MysteryPhoto';
import { NeedsIdPill } from '../../components/community/NeedsIdPill';
import { ProposalAcceptedCelebration } from '../../components/community/ProposalAcceptedCelebration';
import { ProposeSheet } from '../../components/community/ProposeSheet';
import GlobalFirstCelebration from '../../components/GlobalFirstCelebration';
import MilestoneCelebration from '../../components/MilestoneCelebration';
import { font, palette, radius, space, type } from '../../constants/Colors';
import { isMysteryBird, isUnknownEntry } from '../../constants/unknownBird';
import { isReportEntry } from '../../constants/reportTypes';
import { isCustomSpecies } from '../../constants/customSpecies';
import { useActivity } from '../context/ActivityContext';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { useHoots } from '../context/HootsContext';
import { useSightings } from '../context/SightingsContext';
import { formatRelativeDate } from '../utils/formatSightingDate';
import { useComments } from '../hooks/useComments';
import { useProposals } from '../hooks/useProposals';
import { getCurrentUserProfile, isFollowing } from '../services/userService';
import { confirmDeleteSighting } from '../utils/confirmDeleteSighting';
import { setPhotoUri } from '../utils/photoViewer';
import { FriendSighting } from '../types';
import { timeAgo } from '../utils/timeAgo';

export default function SightingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sightingId = String(id);

  // The root layout's SafeAreaView only insets the horizontal edges now, so this
  // header-less screen owns its own top inset on BOTH platforms to clear the
  // status bar (and the bottom inset below to clear the nav bar / home bar).
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  // The root SafeAreaView no longer insets the bottom (so the tab bar can own
  // it), so this screen applies the bottom inset itself: the composer clears
  // the home indicator / nav bar. When the keyboard opens that area is covered,
  // so KeyboardStickyView pulls the footer back down by the inset on iOS.
  const bottomInset = insets.bottom;
  const bottomInsetIOS = Platform.OS === 'ios' ? insets.bottom : 0;

  const { friendSightings } = useFriendSightings();
  const { sightings, evaluateNewSpecies, applyCommunityId, markGlobalFirst, deleteSighting } = useSightings();
  const { markSightingRead } = useActivity();

  // Opening a sighting clears its unread engagement, so the Journal card's
  // unread dot / "N new" cue disappears. Mirrors how app/activity.tsx clears
  // the whole inbox on mount. Items live in the owner's inbox, so this is a
  // no-op for a friend's sighting.
  useEffect(() => {
    markSightingRead(sightingId);
    // One-shot on mount for this sighting id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sightingId]);
  const { hasHooted, hootCount, toggleHoot, hasHootedProposal, toggleProposalHoot, hasHootedComment, toggleCommentHoot } = useHoots();
  const { comments, loading, post } = useComments(sightingId);
  const { proposals, add, accept } = useProposals(sightingId);

  // Own sightings live in `sightings`; friends' in `friendSightings`. The
  // detail screen reads either. Being in your own list means you're the owner.
  const ownSighting = sightings.find((s) => s.id === sightingId);
  const sighting = useMemo(
    () => friendSightings.find((s) => s.id === sightingId) ?? ownSighting,
    [sightingId, friendSightings, ownSighting]
  );
  const isOwner = !!ownSighting;

  const [me, setMe] = useState<{ uid: string; username: string } | null>(null);
  useEffect(() => {
    getCurrentUserProfile().then((p) => {
      if (p) setMe({ uid: p.uid, username: p.username });
    });
  }, []);

  // Engagement gate (same as hoots/comments): the owner, or someone who follows
  // the owner, may propose / hoot. Resolved once for a friend's sighting.
  const ownerUid = isOwner ? me?.uid : (sighting as FriendSighting | undefined)?.friendId;
  const [followsOwner, setFollowsOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (isOwner || !ownerUid) {
      setFollowsOwner(false);
      return;
    }
    isFollowing(ownerUid).then((f) => {
      if (!cancelled) setFollowsOwner(f);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, ownerUid]);
  const canPropose = isOwner || followsOwner;

  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  // The comment being replied to (null = a top-level comment). Drives the
  // composer's "Replying to @name" banner and the replyTo written on send.
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; uid: string; username: string } | null>(null);
  const composerRef = useRef<TextInput>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPropose, setShowPropose] = useState(false);
  const [showHootList, setShowHootList] = useState(false);
  const [accepting, setAccepting] = useState(false);
  // Resolution celebration + chained new-species machinery.
  const [accepted, setAccepted] = useState<{
    species: string;
    proposerName: string;
    proposerUid: string;
    hootCount: number;
    dexNumber: number | null;
  } | null>(null);
  const [pendingGlobalFirst, setPendingGlobalFirst] = useState<string | null>(null);
  const [pendingMilestone, setPendingMilestone] = useState<number | null>(null);
  // The chained celebration modals shown after the resolution card is dismissed.
  const [globalFirstShown, setGlobalFirstShown] = useState<string | null>(null);
  const [milestoneShown, setMilestoneShown] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const mysteryBird = !!sighting && isMysteryBird(sighting);

  // The owner accepts the proposal THEY hooted ("hoot the one you agree with,
  // then lock it in"). If they've hooted more than one, the highest-ranked
  // hooted proposal is the target. Null until they hoot one.
  const selectedProposal =
    mysteryBird && isOwner ? proposals.find((p) => hasHootedProposal(p.id)) ?? null : null;

  const onSend = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const body = text;
    const reply = replyingTo;
    setText('');
    setReplyingTo(null);
    try {
      await post(body, reply ?? undefined);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      console.error('Error posting comment:', e);
      setText(body); // restore so the user doesn't lose their text
      setReplyingTo(reply); // and the reply target
    } finally {
      setPosting(false);
    }
  };

  // Aim the composer at a comment and focus it. Replying to your own comment is
  // allowed but won't notify (the Cloud Function skips the self case).
  const startReply = (c: { id: string; uid: string; username: string }) => {
    setReplyingTo({ commentId: c.id, uid: c.uid, username: c.username });
    composerRef.current?.focus();
  };

  const onSubmitProposal = (species: string, note?: string) =>
    add(species, note);

  const onShare = async () => {
    try {
      await Share.share({
        message: `Help me identify this Mystery Bird on Pocket Birds!`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  };

  // Unique real-species count the user would have AFTER accepting `species`
  // (for the "Added to your Dex · species #NN" chip). Mirrors the milestone
  // math: reports / Mystery / custom species don't count.
  const uniqueSpeciesAfter = (species: string): number => {
    const real = (name: string) =>
      !isReportEntry(name) && !isUnknownEntry(name) && !isCustomSpecies(name);
    const set = new Set(
      sightings.filter((s) => real(s.birdName)).map((s) => s.birdName.toLowerCase())
    );
    set.add(species.toLowerCase());
    return set.size;
  };

  const doAccept = async () => {
    if (!selectedProposal || accepting) return;
    setAccepting(true);
    try {
      const species = selectedProposal.species;
      // Detection runs while the sighting is still a Mystery (it's excluded from
      // species math), so this reads as "logging `species` right now".
      const { isNewSpecies, milestone } = evaluateNewSpecies(species);
      const dexNumber = isNewSpecies ? uniqueSpeciesAfter(species) : null;

      const result = await accept(selectedProposal.id);
      if (!result) {
        setAccepting(false);
        return;
      }

      // Reuse the exact post-log machinery add.tsx fires: Dex update, haptics,
      // global-first, milestone — chained behind the resolution celebration.
      applyCommunityId(sightingId, result.species, milestone);
      if (result.globalFirst) markGlobalFirst(result.species);
      if (isNewSpecies) Vibration.vibrate([0, 150, 100, 150, 100, 300]);

      setPendingGlobalFirst(result.globalFirst ? result.species : null);
      setPendingMilestone(milestone);
      setAccepted({
        species: result.species,
        proposerName: result.proposerUsername,
        proposerUid: result.proposerUid,
        hootCount: result.proposalHootCount,
        dexNumber,
      });
    } catch (e) {
      console.error('Error accepting proposal:', e);
      Alert.alert('Could not accept', 'Something went wrong. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleAccept = () => {
    if (!selectedProposal) return;
    Alert.alert(
      'Accept this ID?',
      `Set "${selectedProposal.species}" as the species and add it to your Dex?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: doAccept },
      ]
    );
  };

  // When the resolution celebration is dismissed, chain the bigger moments
  // (global-first, then milestone) the same way the Add flow prioritizes them.
  const onAcceptedDismiss = () => {
    setAccepted(null);
    if (pendingGlobalFirst) {
      const bird = pendingGlobalFirst;
      setPendingGlobalFirst(null);
      setGlobalFirstShown(bird);
    } else if (pendingMilestone) {
      const count = pendingMilestone;
      setPendingMilestone(null);
      setMilestoneShown(count);
    }
  };

  const onEditSighting = () => {
    setMenuOpen(false);
    router.push(`/sighting/${sightingId}/edit`);
  };

  const onDeleteSighting = () => {
    setMenuOpen(false);
    if (!sighting) return;
    confirmDeleteSighting(
      { id: sightingId, birdName: sighting.birdName },
      deleteSighting,
      () => router.back()
    );
  };

  const NavBar = (
    <View style={[styles.navBar, { paddingTop: topInset + space.sm }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={palette.ink} />
      </Pressable>
      <Text style={styles.navTitle}>{mysteryBird ? 'Mystery Bird' : 'Sighting'}</Text>
      <View style={styles.navRight}>
        {mysteryBird && <NeedsIdPill />}
        {isOwner && (
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={[styles.menuButton, menuOpen && styles.menuButtonOpen]}
            accessibilityLabel="Sighting options"
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={menuOpen ? palette.cream : palette.ink}
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  // Owner-only ⋯ popover (Edit · Delete), anchored top-right over a light scrim.
  const OverflowMenu = menuOpen ? (
    <>
      <Pressable style={styles.menuScrim} onPress={() => setMenuOpen(false)} />
      <View style={[styles.menuPopover, { top: topInset + 52 }]}>
        <HardShadow offset={4} borderRadius={radius.input}>
          <View style={styles.menuCard}>
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: palette.leafSoft }]}
              onPress={onEditSighting}
            >
              <Ionicons name="pencil" size={17} color={palette.ink} />
              <Text style={styles.menuRowText}>Edit</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: palette.coralSoft }]}
              onPress={onDeleteSighting}
            >
              <Ionicons name="trash" size={17} color={palette.crimson} />
              <Text style={[styles.menuRowText, { color: palette.crimson }]}>Delete</Text>
            </Pressable>
          </View>
        </HardShadow>
      </View>
    </>
  ) : null;

  if (!sighting) {
    return (
      <View style={styles.screen}>
        {NavBar}
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Couldn&apos;t load this sighting.</Text>
        </View>
      </View>
    );
  }

  const friendName = (sighting as FriendSighting).friendName ?? 'You';
  const hooters = sighting.recentHooters ?? [];
  const count = hootCount(sighting);
  const hooted = hasHooted(sightingId);

  return (
    <View style={styles.screen}>
      {NavBar}

      <ScrollView ref={scrollRef} style={styles.body} keyboardShouldPersistTaps="handled">
        {sighting.photoUrl ? (
          <Pressable onPress={() => { setPhotoUri(sighting.photoUrl!); router.push('/photo'); }}>
            <Image source={{ uri: sighting.photoUrl }} style={styles.photo} resizeMode="cover" />
          </Pressable>
        ) : mysteryBird ? (
          <MysteryPhoto height={190} />
        ) : null}

        {/* Meta */}
        <View style={styles.meta}>
          {/* Owner tag — tappable, links to the poster's profile (same as the feed card) */}
          <View style={styles.friendTagRow}>
            <Pressable
              style={({ pressed }) => [styles.friendTag, pressed && ownerUid && { backgroundColor: palette.sky }]}
              onPress={() => ownerUid && router.push(`/profile/${ownerUid}`)}
              disabled={!ownerUid}
              hitSlop={6}
            >
              <Ionicons name="person" size={10} color={palette.ink} />
              <Text style={styles.friendTagText} numberOfLines={1}>{friendName.toUpperCase()}</Text>
            </Pressable>
          </View>

          <Text style={styles.birdName}>{sighting.birdName}</Text>

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

          {sighting.notes ? (
            <Text style={styles.note}>“{sighting.notes}”</Text>
          ) : null}

          {/* Hoot summary + toggle. Tapping the face pile / count opens the
              hooter list (same as the feed card), which links to profiles. */}
          <View style={styles.hootSummary}>
            <Pressable
              style={styles.hootSummaryLeft}
              onPress={() => setShowHootList(true)}
              disabled={count === 0}
            >
              {count > 0 && hooters.length > 0 && (
                <FacePile people={hooters.map((h) => ({ name: h.username, seed: h.uid }))} max={3} size={26} />
              )}
              <Text style={styles.hootCountText}>
                <Text style={styles.hootCountNum}>{count}</Text> {count === 1 ? 'hoot' : 'hoots'}
              </Text>
            </Pressable>
            <HootButton hooted={hooted} count={count} onPress={() => toggleHoot(sightingId)} />
          </View>
        </View>

        {/* Community ID — Mystery Birds only */}
        {mysteryBird && (
          <View style={styles.communitySection}>
            <CommunityIdSection
              proposals={proposals}
              isOwner={isOwner}
              canPropose={canPropose}
              onPropose={() => setShowPropose(true)}
              onShare={onShare}
              hasHootedProposal={hasHootedProposal}
              onToggleHoot={(proposalId) => toggleProposalHoot(sightingId, proposalId)}
            />
          </View>
        )}

        {/* Comments header */}
        <View style={styles.commentsHeader}>
          <Ionicons name="chatbubble-outline" size={17} color={palette.ink} />
          <Text style={styles.commentsHeaderText}>
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
        </View>

        {/* Comment list */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: space.lg }} color={palette.inkSoft} />
        ) : comments.length === 0 ? (
          <Text style={styles.emptyComments}>No comments yet — be the first.</Text>
        ) : (
          comments.map((c) => {
            const cHooted = hasHootedComment(c.id);
            return (
              <View key={c.id} style={styles.commentRow}>
                <Pressable onPress={() => router.push(`/profile/${c.uid}`)} hitSlop={4}>
                  <Avatar name={c.username} seed={c.uid} size={34} />
                </Pressable>
                <View style={styles.commentBody}>
                  <View style={styles.commentMetaRow}>
                    <Pressable onPress={() => router.push(`/profile/${c.uid}`)} hitSlop={4}>
                      <Text style={styles.commentName}>{c.username}</Text>
                    </Pressable>
                    <Text style={styles.commentTime}>{timeAgo(c.createdAt?.toDate?.() ?? null)}</Text>
                  </View>
                  {c.replyTo && (
                    <Text style={styles.commentReplyTo} numberOfLines={1}>
                      ↳ replying to @{c.replyTo.username}
                    </Text>
                  )}
                  <Text style={styles.commentText}>{c.text}</Text>
                  <View style={styles.commentActions}>
                    <Pressable onPress={() => startReply(c)} hitSlop={8}>
                      <Text style={styles.commentReplyBtn}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => toggleCommentHoot(sightingId, c.id)}
                  hitSlop={8}
                  style={styles.commentHootBtn}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cHooted }}
                  accessibilityLabel={cHooted ? 'Remove hoot' : 'Hoot this comment'}
                >
                  {c.hootCount > 0 && (
                    <Text style={[styles.commentHootCount, cHooted && styles.commentHootCountActive]}>
                      {c.hootCount}
                    </Text>
                  )}
                  <Owl size={15} filled={cHooted} color={cHooted ? palette.coral : palette.muted} />
                </Pressable>
              </View>
            );
          })
        )}
        <View style={{ height: space.md }} />
      </ScrollView>

      {/* Accept bar + comment composer ride above the keyboard together.
          KeyboardStickyView is the reliable iOS pattern for a pinned footer
          (plain KeyboardAvoidingView left the input under the keyboard). */}
      <KeyboardStickyView offset={{ closed: 0, opened: bottomInsetIOS }}>
        {/* Owner Accept bar — pinned above the comment composer. Targets the
            proposal the owner hooted; prompts them to hoot one if they haven't. */}
        {mysteryBird && isOwner && proposals.length > 0 && (
          <AcceptBar
            species={selectedProposal?.species ?? null}
            busy={accepting}
            onAccept={handleAccept}
          />
        )}

        {/* Reply target banner — sits just above the composer when replying. */}
        {replyingTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to <Text style={styles.replyBannerName}>@{replyingTo.username}</Text>
            </Text>
            <Pressable onPress={() => setReplyingTo(null)} hitSlop={8} accessibilityLabel="Cancel reply">
              <Ionicons name="close" size={16} color={palette.inkSoft} />
            </Pressable>
          </View>
        )}

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: bottomInset + space.sm }]}>
          {me && <Avatar name={me.username} seed={me.uid} size={32} />}
          <TextInput
            ref={composerRef}
            style={styles.input}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : 'Add a comment…'}
            placeholderTextColor={palette.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || posting}
            style={[styles.sendBtn, (!text.trim() || posting) && styles.sendBtnDisabled]}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardStickyView>

      {/* Who hooted — bottom sheet, rows link to profiles */}
      <HootListSheet
        sightingId={sightingId}
        visible={showHootList}
        onClose={() => setShowHootList(false)}
      />

      {/* Propose composer */}
      <ProposeSheet
        visible={showPropose}
        ownerName={isOwner ? 'your' : `${friendName}'s`}
        location={sighting.location}
        photoUrl={sighting.photoUrl}
        onClose={() => setShowPropose(false)}
        onSubmit={onSubmitProposal}
      />

      {/* Resolution celebration (then chains global-first / milestone) */}
      <ProposalAcceptedCelebration
        visible={accepted !== null}
        species={accepted?.species ?? null}
        proposerName={accepted?.proposerName ?? ''}
        proposerUid={accepted?.proposerUid ?? ''}
        hootCount={accepted?.hootCount ?? 0}
        dexNumber={accepted?.dexNumber ?? null}
        photoUrl={sighting.photoUrl}
        onDismiss={onAcceptedDismiss}
      />

      <GlobalFirstCelebration
        visible={globalFirstShown !== null}
        birdName={globalFirstShown}
        onDismiss={() => setGlobalFirstShown(null)}
      />

      <MilestoneCelebration
        visible={milestoneShown !== null}
        count={milestoneShown}
        onDismiss={() => setMilestoneShown(null)}
      />

      {OverflowMenu}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: palette.ink,
  },
  backBtn: { padding: 2 },
  navTitle: { ...type.h3, color: palette.ink },
  navRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: space.sm },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonOpen: { backgroundColor: palette.ink },

  // Owner ⋯ popover
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,36,23,0.18)',
    zIndex: 90,
  },
  menuPopover: {
    position: 'absolute',
    right: space.lg,
    width: 188,
    zIndex: 100,
  },
  menuCard: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: palette.ink,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  menuRowText: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  menuDivider: { height: 1.5, backgroundColor: palette.rule },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.body, color: palette.inkSoft },

  body: { flex: 1 },
  photo: { width: '100%', height: 180, backgroundColor: palette.skySoft },

  meta: { padding: space.lg, borderBottomWidth: 1.5, borderBottomColor: palette.rule },
  friendTagRow: { flexDirection: 'row', marginBottom: space.sm },
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
  friendTagText: { fontFamily: font.mono, fontSize: 10, color: palette.ink, letterSpacing: 1.2, fontWeight: '700' },
  birdName: { ...type.h2, color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaText: { ...type.bodyS, color: palette.inkSoft, fontWeight: '500' },
  metaDivider: { color: palette.muted },
  note: {
    ...type.body,
    color: palette.ink,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 20,
  },

  hootSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  hootSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  hootCountText: { ...type.bodyS, color: palette.inkSoft },
  hootCountNum: { color: palette.ink, fontFamily: font.bodyBold },

  communitySection: {
    borderBottomWidth: 1.5,
    borderBottomColor: palette.rule,
    paddingBottom: space.sm,
  },

  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 6,
  },
  commentsHeaderText: { ...type.h3, color: palette.ink },
  emptyComments: { ...type.body, color: palette.muted, paddingHorizontal: space.lg, paddingVertical: space.md },

  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingVertical: 8, alignItems: 'flex-start' },
  commentBody: { flex: 1, minWidth: 0 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  commentName: { fontFamily: font.bodyBold, fontSize: 14, color: palette.ink },
  commentTime: { fontFamily: font.mono, fontSize: 10, color: palette.muted },
  commentText: { ...type.body, color: palette.ink, marginTop: 2, lineHeight: 20 },
  commentReplyTo: { fontFamily: font.mono, fontSize: 11, color: palette.muted, marginTop: 1 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: 6 },
  // Right-side hoot control: count to the left of the owl, vertically centered
  // against the whole comment row.
  commentHootBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, paddingLeft: 4 },
  commentHootCount: { fontFamily: font.monoBold, fontSize: 11, color: palette.muted },
  commentHootCountActive: { color: palette.crimson },
  commentReplyBtn: { fontFamily: font.bodyBold, fontSize: 12, color: palette.inkSoft },

  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 6,
    backgroundColor: palette.card,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
  },
  replyBannerText: { ...type.bodyS, color: palette.inkSoft, flex: 1 },
  replyBannerName: { fontFamily: font.bodyBold, color: palette.ink },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 2,
    borderTopColor: palette.ink,
    backgroundColor: palette.cream,
  },
  input: {
    flex: 1,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 5,
    fontFamily: font.body,
    fontSize: 14,
    color: palette.ink,
    maxHeight: 110,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.leaf,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
