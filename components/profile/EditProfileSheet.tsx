import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BIO_MAX_LENGTH, updateProfileBio } from '../../app/services/userService';
import { border, palette, radius, space, type } from '../../constants/Colors';
import { BottomSheet } from '../BottomSheet';

// Edit profile (HEP-11). v1 edits exactly one thing: the bio. The username is
// shown read-only (usernames are immutable at the rules layer; they're the
// identity). Hosted by the self ProfileView; openEditProfile() lets the
// AppHeader's ⋯ menu (which sits above the You tab) trigger it without
// plumbing props through the tab tree.

let openListener: (() => void) | null = null;

export function openEditProfile() {
  if (openListener) openListener();
  else Alert.alert('Hmm', 'Open your profile tab first, then try again.');
}

export function EditProfileSheet({ username, bio, onSaved }: {
  username: string;
  /** The current saved bio ('' when none). Seeds the field each open. */
  bio: string;
  onSaved: (newBio: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = openListener;
    openListener = () => setVisible(true);
    return () => {
      openListener = prev;
    };
  }, []);

  // Re-seed the draft from the saved bio each time the sheet opens, so a
  // cancelled edit doesn't linger into the next session.
  useEffect(() => {
    if (visible) setDraft(bio);
  }, [visible, bio]);

  const close = () => {
    if (saving) return;
    setVisible(false);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const trimmed = draft.trim();
    try {
      await updateProfileBio(trimmed);
      onSaved(trimmed);
      setSaving(false);
      setVisible(false);
    } catch {
      setSaving(false);
      Alert.alert('Error', "Couldn't save your profile. Please try again.");
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>Edit profile</Text>

        <Text style={styles.label}>USERNAME</Text>
        <Text style={styles.username}>{username}</Text>

        <Text style={styles.label}>BIO</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, BIO_MAX_LENGTH))}
          placeholder="Say something about your flock"
          placeholderTextColor={palette.muted}
          multiline
          maxLength={BIO_MAX_LENGTH}
          editable={!saving}
        />
        <Text style={styles.counter}>{draft.length}/{BIO_MAX_LENGTH}</Text>

        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color={palette.cream} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
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
    marginBottom: space.lg,
  },
  label: {
    ...type.label,
    color: palette.inkSoft,
    marginBottom: space.xs,
  },
  username: {
    ...type.bodyL,
    color: palette.ink,
    marginBottom: space.lg,
  },
  input: {
    ...type.bodyL,
    color: palette.ink,
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 64,
    textAlignVertical: 'top',
    ...border.thick,
  },
  counter: {
    ...type.bodyS,
    color: palette.muted,
    alignSelf: 'flex-end',
    marginTop: space.xs,
  },
  saveButton: {
    marginTop: space.md,
    backgroundColor: palette.ink,
    borderRadius: radius.input,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...type.bodyL,
    color: palette.cream,
    fontWeight: '700',
  },
});
