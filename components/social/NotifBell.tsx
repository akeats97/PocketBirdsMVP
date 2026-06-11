import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NotificationMode } from '../../app/services/notificationPrefsService';
import { palette } from '../../constants/Colors';

// The bell glyph whose shape encodes the push level (YouTube-style convention,
// no color fill):
//   all        → ringing bell: the bell + two small motion arcs flanking it
//   highlights → plain bell
//   none       → bell-off: the bell with a diagonal slash (drawn muted)
// 16×16 viewBox, stroke-only, round caps/joins — see the social-graph handoff §4.
const BELL_BODY = 'M4 11V7a4 4 0 018 0v4l1 1.5H3L4 11zM6.5 14a1.5 1.5 0 003 0';
const ARC_LEFT = 'M2.5 4.6a3.2 3.2 0 00-1 2.4';
const ARC_RIGHT = 'M13.5 4.6a3.2 3.2 0 011 2.4';
const SLASH = 'M2.4 2.4l11.2 11.2';

export function BellGlyph({
  mode,
  size = 16,
  color = palette.ink,
}: {
  mode: NotificationMode;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d={BELL_BODY}
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {mode === 'all' && (
        <>
          <Path d={ARC_LEFT} stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={ARC_RIGHT} stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {mode === 'none' && (
        <Path d={SLASH} stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

// The icon color for a given mode: ink for all/highlights, muted for none.
export function bellColor(mode: NotificationMode): string {
  return mode === 'none' ? palette.muted : palette.ink;
}

// A 34×34 circular chip carrying the bell glyph — same border + corner
// language as the action pills it sits next to. All three states share the
// neutral card background; the icon carries the meaning. Tapping opens the
// level picker.
export function NotifBell({
  mode,
  onPress,
}: {
  mode: NotificationMode;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.chip} onPress={onPress} hitSlop={6} accessibilityLabel="Notifications">
      <BellGlyph mode={mode} size={16} color={bellColor(mode)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
