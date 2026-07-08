import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportTargetType, submitReport } from '../app/services/moderationService';
import { border, palette, radius, space, type } from '../constants/Colors';
import { BottomSheet } from './BottomSheet';

const REASONS = ['Spam', 'Inappropriate content', 'Harassment', 'Something else'] as const;

// Shared report flow (PL-2). One canned reason + optional detail; writes to
// the admin-only `reports` collection, which pushes the admins. Used from
// profiles (report a user) and the sighting detail (report a sighting).
export function ReportSheet({ visible, onClose, targetType, targetId, targetLabel }: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** What the title names, e.g. "@username" or "this sighting". */
  targetLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setReason(null);
    setDetail('');
    onClose();
  };

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await submitReport(targetType, targetId, detail.trim() ? `${reason}: ${detail}` : reason);
      setSending(false);
      close();
      Alert.alert('Report received', 'Thank you for flagging this. It will be reviewed.');
    } catch {
      setSending(false);
      Alert.alert('Error', "Couldn't send the report. Please try again.");
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>Report {targetLabel}</Text>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.reasonRow, reason === r && styles.reasonRowActive]}
            onPress={() => setReason(r)}
          >
            <View style={[styles.radio, reason === r && styles.radioActive]} />
            <Text style={styles.reasonText}>{r}</Text>
          </Pressable>
        ))}
        <TextInput
          style={styles.detailInput}
          value={detail}
          onChangeText={setDetail}
          placeholder="Anything else we should know? (optional)"
          placeholderTextColor={palette.muted}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <Pressable
          style={[styles.sendButton, (!reason || sending) && styles.sendButtonDisabled]}
          disabled={!reason || sending}
          onPress={send}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send report</Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.input,
  },
  reasonRowActive: {
    backgroundColor: palette.card,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    ...border.thick,
    backgroundColor: palette.cream,
  },
  radioActive: {
    backgroundColor: palette.leaf,
  },
  reasonText: {
    ...type.bodyL,
    color: palette.ink,
  },
  detailInput: {
    ...type.body,
    color: palette.ink,
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 64,
    textAlignVertical: 'top',
    marginTop: space.sm,
    ...border.thick,
  },
  sendButton: {
    marginTop: space.lg,
    backgroundColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    ...type.bodyL,
    color: palette.cream,
    fontWeight: '700',
  },
});
