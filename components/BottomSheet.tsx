import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Scrim color. Defaults to the app's standard sheet dim. */
  backdropColor?: string;
}

// Canonical bottom-sheet animation for the whole app (see CLAUDE.md "Modal
// animation rule"): the content slides UP from the bottom while the translucent
// backdrop just FADES in — the scrim never slides. On close the backdrop blinks
// out fast while the content slides back down, then the Modal unmounts.
//
// Use this for any bottom sheet / action sheet. Do NOT use `Modal
// animationType="slide"` (that slides the scrim too) or `"fade"` (pops the
// content). The richer ProposeSheet mirrors this same motion with added
// drag-to-dismiss; centered confirmation dialogs (Alert-style) are the only
// exception and may fade in place.
//
// The children own their own look and layout (incl. any bottom safe-area
// padding); this only provides the scrim + slide mechanics, anchored bottom.
export function BottomSheet({
  visible,
  onClose,
  children,
  backdropColor = 'rgba(26,36,23,0.45)',
}: BottomSheetProps) {
  const { height: screenH } = useWindowDimensions();
  // Keep the Modal mounted through the exit animation after `visible` flips off.
  const [rendered, setRendered] = useState(visible);

  const ty = useSharedValue(screenH);
  const backdropOpacity = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  useEffect(() => {
    if (visible) {
      setRendered(true);
      ty.value = screenH;
      ty.value = withSpring(0, { damping: 20, stiffness: 160 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      // Backdrop out fast (a blink, not a slide); content slides down.
      backdropOpacity.value = withTiming(0, { duration: 120 });
      ty.value = withTiming(screenH, { duration: 240 });
      // Unmount on a timer, not the animation callback: an interrupted slide
      // leaves `finished` false and would strand the Modal mounted.
      const t = setTimeout(() => setRendered(false), 260);
      return () => clearTimeout(t);
    }
  }, [visible, screenH, ty, backdropOpacity]);

  return (
    <Modal visible={rendered} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Reanimated.View
          style={[styles.backdrop, { backgroundColor: backdropColor }, backdropStyle]}
          pointerEvents="none"
        />
        <Pressable style={styles.backdropFill} onPress={onClose} />
        <Reanimated.View style={sheetStyle}>{children}</Reanimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  backdropFill: { ...StyleSheet.absoluteFillObject },
});

export default BottomSheet;
