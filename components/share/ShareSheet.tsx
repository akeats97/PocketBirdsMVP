import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, palette, radius, space } from '../../constants/Colors';
import { ShareCardData } from '../../app/utils/shareCardData';
import { saveCardImage, shareCardImage } from '../../app/utils/captureCardShare';
import { BottomSheet } from '../BottomSheet';
import { HardShadow } from '../SightingCard';
import { ShareCard } from './ShareCard';

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData | null;
}

// Share sheet for a sighting: renders the collectible card and hands it to the
// OS as a PNG — Save to camera roll, or Share… (WhatsApp / Messages / Stories /
// etc. via the system sheet). The universal-link half of the design is deferred
// (needs web infra), so this pass is image-only.
export function ShareSheet({ visible, onClose, data }: Props) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  // The card's photo must finish loading before we snapshot it, or the art comes
  // out blank. No photo → nothing to wait for.
  const [artReady, setArtReady] = useState(false);

  // Reset the ready gate whenever a new card opens.
  React.useEffect(() => {
    if (visible) setArtReady(!data?.photoUrl);
  }, [visible, data?.photoUrl]);

  const run = async (kind: 'save' | 'share') => {
    if (busy || !artReady) return;
    setBusy(kind);
    try {
      if (kind === 'save') await saveCardImage(cardRef.current);
      else await shareCardImage(cardRef.current);
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grip} />
        <Text style={styles.title}>Share sighting</Text>

        <ScrollView
          contentContainerStyle={styles.previewWrap}
          showsVerticalScrollIndicator={false}
        >
          {data && <ShareCard ref={cardRef} data={data} onArtReady={() => setArtReady(true)} />}
        </ScrollView>

        <View style={styles.actions}>
          <ActionButton
            icon="download-outline"
            label={busy === 'save' ? 'Saving…' : 'Save to Photos'}
            onPress={() => run('save')}
            busy={busy === 'save'}
            disabled={!!busy || !artReady}
          />
          <ActionButton
            icon="share-social-outline"
            label={busy === 'share' ? 'Opening…' : 'Share…'}
            onPress={() => run('share')}
            busy={busy === 'share'}
            disabled={!!busy || !artReady}
            primary
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function ActionButton({
  icon, label, onPress, busy, disabled, primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <View style={styles.actionCell}>
      <HardShadow offset={3} borderRadius={radius.input}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={[styles.action, primary && styles.actionPrimary, disabled && styles.actionDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={primary ? '#fff' : palette.ink} />
          ) : (
            <Ionicons name={icon} size={18} color={primary ? '#fff' : palette.ink} />
          )}
          <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
        </Pressable>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: palette.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 3,
    borderColor: palette.ink,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  grip: { width: 40, height: 4, borderRadius: 99, backgroundColor: palette.muted, alignSelf: 'center', marginBottom: space.md },
  title: { fontFamily: font.displayBlack, fontSize: 19, letterSpacing: -0.4, color: palette.ink, marginBottom: space.md },

  previewWrap: { alignItems: 'center', paddingVertical: space.sm },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionCell: { flex: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: space.md,
  },
  actionPrimary: { backgroundColor: palette.leaf },
  actionDisabled: { opacity: 0.5 },
  actionText: { fontFamily: font.bodyBold, fontSize: 14, color: palette.ink },
  actionTextPrimary: { color: '#fff' },
});

export default ShareSheet;
