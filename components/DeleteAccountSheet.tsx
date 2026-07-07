import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '@react-native-firebase/auth';
import { useSightings } from '../app/context/SightingsContext';
import { deleteAccount, reauthenticateWithPassword } from '../app/services/accountService';
import { auth } from '../config/firebaseConfig';
import { border, palette, radius, space, type } from '../constants/Colors';
import { BottomSheet } from './BottomSheet';

// Permanent account deletion (N-1; Apple requires an in-app path). The sheet
// is the confirmation: it spells out what goes away, requires the password
// (Firebase wants a recent sign-in for destructive ops), and double-checks
// with an Alert before calling the server. On success the auth user is gone,
// so we clear local data and sign out to land on the login screen.
export function DeleteAccountSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { clearLocalData } = useSightings();
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (working) return;
    setPassword('');
    setError(null);
    onClose();
  };

  const runDeletion = async () => {
    setWorking(true);
    setError(null);
    try {
      await reauthenticateWithPassword(password);
    } catch {
      setError("That password didn't match.");
      setWorking(false);
      return;
    }
    try {
      await deleteAccount();
      await clearLocalData().catch(() => {});
      await signOut(auth).catch(() => {});
      // Auth listener in _layout swaps to the login screen; nothing to close.
    } catch (e: any) {
      setError(e?.message ?? 'Deletion failed. Please try again.');
      setWorking(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      'Delete your account forever?',
      'Every sighting, photo, and follow goes with it. There is no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: runDeletion },
      ]
    );
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>Delete account</Text>
        <Text style={styles.body}>
          This permanently deletes your account: every sighting, photo, comment,
          hoot, and follow. Your life list does not come back. If you just want a
          break, log out instead.
        </Text>
        <Text style={styles.label}>CONFIRM YOUR PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          placeholder="Password"
          placeholderTextColor={palette.muted}
          secureTextEntry
          autoCapitalize="none"
          editable={!working}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.deleteButton, (working || !password) && styles.deleteButtonDisabled]}
          disabled={working || !password}
          onPress={confirm}
        >
          {working ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete my account</Text>
          )}
        </Pressable>
        <Pressable style={styles.cancelButton} disabled={working} onPress={close}>
          <Text style={styles.cancelButtonText}>Never mind</Text>
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
    color: palette.crimson,
    marginBottom: space.sm,
  },
  body: {
    ...type.body,
    color: palette.ink,
    marginBottom: space.lg,
  },
  label: {
    ...type.label,
    color: palette.inkSoft,
    marginBottom: space.xs,
  },
  input: {
    ...type.bodyL,
    color: palette.ink,
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
  },
  error: {
    ...type.bodyS,
    color: palette.crimson,
    marginTop: space.xs,
  },
  deleteButton: {
    marginTop: space.lg,
    backgroundColor: palette.crimson,
    borderRadius: radius.input,
    paddingVertical: space.md,
    alignItems: 'center',
    ...border.thick,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    ...type.bodyL,
    color: '#fff',
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: space.sm,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...type.body,
    color: palette.inkSoft,
  },
});
