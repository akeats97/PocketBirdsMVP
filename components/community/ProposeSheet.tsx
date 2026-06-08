import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { birdNamesAlpha, birdNamesAlphaLower } from '../../constants/birdNamesLower';
import { font, palette, radius, space, type } from '../../constants/Colors';
import { HardShadow } from '../SightingCard';
import { Owl } from '../Owl';
import { MysteryPhoto } from './MysteryPhoto';

interface ProposeSheetProps {
  visible: boolean;
  ownerName: string;
  location?: string;
  photoUrl?: string;
  onClose: () => void;
  /** Returns true if the proposal was posted (false = empty/dupe). */
  onSubmit: (species: string, note?: string) => Promise<boolean>;
}

const MAX_NOTE = 280;

// Bottom-sheet composer for a community-ID proposal. Reuses the Add-Sighting
// tiered species search (prefix > word-start > substring, cap 20) verbatim, and
// shows the COMMON NAME ONLY — no Latin, even though the bird list carries it.
export function ProposeSheet({
  visible,
  ownerName,
  location,
  photoUrl,
  onClose,
  onSubmit,
}: ProposeSheetProps) {
  const { height: screenH } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // We drive enter/exit ourselves (Modal animationType="none") so the sheet can
  // slide while the dark backdrop just fades. `rendered` keeps the Modal mounted
  // through the exit animation after the parent flips `visible` to false.
  const [rendered, setRendered] = useState(visible);

  // Drag-to-dismiss on the grabber. Uses gesture-handler + reanimated (the new
  // architecture is on, where PanResponder inside a Modal is unreliable). The
  // sheet follows the finger downward; release past a threshold (or a flick)
  // closes it, otherwise it springs back.
  const ty = useSharedValue(screenH);
  const backdropOpacity = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const dragGesture = Gesture.Pan()
    .activeOffsetY(8)   // only engage on a downward drag
    .failOffsetY(-8)    // bail if the user drags up
    .onUpdate((e) => {
      if (e.translationY > 0) ty.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        // Hand off to the close effect, which slides the sheet the rest of the
        // way down and fades the backdrop out from the current finger position.
        runOnJS(onClose)();
      } else {
        ty.value = withSpring(0, { damping: 18 });
      }
    });

  // Enter/exit. On open: mount, reset the form, slide the sheet up and fade the
  // backdrop in. On close: fade the backdrop out FAST (a quick blink, not a
  // slide) while the sheet slides down, then unmount once the slide finishes.
  useEffect(() => {
    if (visible) {
      setRendered(true);
      setQuery('');
      setSelected('');
      setSuggestions([]);
      setNote('');
      setSubmitting(false);
      ty.value = screenH;
      ty.value = withSpring(0, { damping: 20, stiffness: 160 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 120 });
      ty.value = withTiming(screenH, { duration: 240 });
      // Unmount on a timer, NOT the animation's finished callback: if the slide
      // is ever interrupted, `finished` is false and the callback never fires,
      // leaving the Modal stuck mounted (which shifts the app down on Android).
      const t = setTimeout(() => setRendered(false), 260);
      return () => clearTimeout(t);
    }
  }, [visible, screenH, ty, backdropOpacity]);

  // Same tiered, debounced search as add.tsx — real IOC species only (a
  // proposal is an identification, so no report/custom/mystery entries).
  useEffect(() => {
    if (!query || query === selected) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      const q = query.toLowerCase();
      const qSpace = ' ' + q;
      const qDash = '-' + q;
      const CAP = 20;
      const tier0: string[] = [];
      const tier1: string[] = [];
      const tier2: string[] = [];
      for (let i = 0; i < birdNamesAlpha.length; i++) {
        const lower = birdNamesAlphaLower[i];
        if (lower.startsWith(q)) {
          if (tier0.length < CAP) tier0.push(birdNamesAlpha[i]);
        } else if (tier0.length < CAP) {
          if (lower.includes(qSpace) || lower.includes(qDash)) {
            if (tier1.length < CAP) tier1.push(birdNamesAlpha[i]);
          } else if (lower.includes(q)) {
            if (tier2.length < CAP) tier2.push(birdNamesAlpha[i]);
          }
        }
        if (tier0.length >= CAP) break;
      }
      setSuggestions([...tier0, ...tier1, ...tier2].slice(0, CAP));
    }, 100);
    return () => clearTimeout(handle);
  }, [query, selected]);

  const handlePick = (name: string) => {
    setSelected(name);
    setQuery(name);
    setSuggestions([]);
  };

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(selected, note);
      if (ok) onClose();
      else setSubmitting(false);
    } catch (e) {
      console.error('Error posting proposal:', e);
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={rendered} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.ghRoot}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <Reanimated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable style={styles.backdropFill} onPress={onClose} />
        <Reanimated.View
          style={[
            styles.sheet,
            { maxHeight: screenH * 0.92, minHeight: screenH * 0.6 },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={dragGesture}>
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.thumb}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <MysteryPhoto height={44} discSize={22} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Propose an ID</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  For {ownerName} Mystery Bird{location ? ` · ${location}` : ''}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Species */}
              <Text style={styles.label}>SPECIES</Text>
              <HardShadow offset={3} borderRadius={radius.input}>
                <View style={styles.speciesInputRow}>
                  <TextInput
                    style={styles.speciesInput}
                    value={query}
                    onChangeText={(t) => {
                      setQuery(t);
                      setSelected('');
                    }}
                    placeholder="What do you think it is?"
                    placeholderTextColor={palette.muted}
                    autoCorrect={false}
                  />
                  {selected ? <Ionicons name="checkmark" size={18} color={palette.leaf} /> : null}
                </View>
              </HardShadow>

              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((name, i) => (
                    <Pressable
                      key={name}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        i === suggestions.length - 1 && styles.suggestionRowLast,
                        (pressed || name === selected) && { backgroundColor: palette.leafSoft },
                      ]}
                      onPress={() => handlePick(name)}
                    >
                      <Text style={styles.suggestionText}>{name}</Text>
                      {name === selected && <Ionicons name="checkmark" size={18} color={palette.leaf} />}
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Reasoning */}
              <Text style={[styles.label, { marginTop: space.lg }]}>
                WHY? <Text style={styles.labelHint}>(helps others vote)</Text>
              </Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Black hood, bright yellow face…"
                placeholderTextColor={palette.muted}
                multiline
                maxLength={MAX_NOTE}
              />
            </ScrollView>

            {/* Submit */}
            <View style={styles.submitWrap}>
              <HardShadow offset={4} borderRadius={radius.input}>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!selected || submitting) && styles.submitBtnDisabled,
                    pressed && selected && !submitting && { backgroundColor: palette.ink },
                  ]}
                  onPress={handleSubmit}
                  disabled={!selected || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Owl size={20} color="#fff" />
                      <Text style={styles.submitText}>Post proposal</Text>
                    </>
                  )}
                </Pressable>
              </HardShadow>
            </View>
        </Reanimated.View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ghRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Dark scrim, faded independently of the sliding sheet (so it blinks out on
  // close instead of sliding down with the sheet).
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,36,23,0.5)',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: palette.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
    borderColor: palette.ink,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: palette.rule,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.chip,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.ink,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.4,
  },
  headerSub: {
    ...type.bodyS,
    color: palette.inkSoft,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  label: {
    fontFamily: font.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  labelHint: {
    color: palette.muted,
    fontFamily: font.body,
  },
  speciesInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  speciesInput: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 16,
    color: palette.ink,
    padding: 0,
  },
  suggestions: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: palette.card,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    backgroundColor: palette.card,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  noteInput: {
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 64,
    textAlignVertical: 'top',
    fontFamily: font.body,
    fontSize: 14,
    color: palette.ink,
  },
  submitWrap: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: 1.5,
    borderTopColor: palette.rule,
  },
  submitBtn: {
    backgroundColor: palette.leaf,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: palette.ink,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Keep the disabled button OPAQUE — using opacity here let the hard-shadow
  // ink rectangle show through and looked like a janky offset overlay.
  submitBtnDisabled: {
    backgroundColor: palette.muted,
  },
  submitText: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
});
