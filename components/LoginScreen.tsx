import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { auth, db } from '../config/firebaseConfig';
import { border, font, palette, radius, recipes, space, type } from '../constants/Colors';
import { HardShadow } from './SightingCard';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('nice try guy, go again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'i think you forgot something?');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'way too short! people are going to steal your birds! make it at least 6 long');
      return;
    }
    if (!isLoginMode && !username) {
      Alert.alert('Error', 'but what should we call you?');
      return;
    }
    if (!isLoginMode) {
      if (username.length < 3) {
        Alert.alert('Error', 'scrabble house rules, no 2 letter words');
        return;
      }
      if (username.includes(' ')) {
        Alert.alert('Error', 'we love space, but not in your username');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (!isLoginMode) {
        const usernameDoc = await getDoc(doc(db, 'usernames', username));
        if (usernameDoc.exists()) {
          setIsLoading(false);
          Alert.alert('Error', "turns out you're not very original ... try a new name");
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!isLoginMode) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            createdAt: new Date(),
          });
          await setDoc(doc(db, 'usernames', username), { uid: user.uid });

          Alert.alert(
            'Success',
            "account created successfully! it's time to spot some birbs!",
            [{ text: 'OK', onPress: () => setIsLoginMode(true) }]
          );
        } catch (firestoreError) {
          console.error('Error saving username:', firestoreError);
          Alert.alert(
            'Account Created',
            'Your account was created but there was an issue saving your username. Please try updating your profile later.',
            [{ text: 'OK', onPress: () => setIsLoginMode(true) }]
          );
        }
      } else {
        Alert.alert(
          'Success',
          "account created successfully! it's time to spot some birbs!",
          [{ text: 'OK', onPress: () => setIsLoginMode(true) }]
        );
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'hmmm, do you have a twin with the same email? because that email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "are you sure that's a real email?";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'your password game is weak, make it 6+ long please';
      }
      Alert.alert('Account Creation Failed', `${errorMessage}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => setIsLoginMode(!isLoginMode);

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for instructions to reset your password'
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      }
      Alert.alert('Error', errorMessage);
    }
  };

  const primaryAction = isLoginMode ? handleLogin : handleCreateAccount;
  const primaryLabel = isLoading ? 'Processing...' : (isLoginMode ? 'Login' : 'Create Account');

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={24}
    >
      <View style={styles.header}>
        <Text style={styles.title}>PocketBirds</Text>
        <Text style={styles.subtitle}>please don&apos;t put birds in your pockets</Text>
      </View>

      <View style={styles.form}>
        {!isLoginMode && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={palette.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={palette.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Password"
            placeholderTextColor={palette.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!isLoading}
            returnKeyType="go"
            onSubmitEditing={primaryAction}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={palette.ink}
            />
          </Pressable>
        </View>

        <View style={styles.buttonWrap}>
          <HardShadow offset={4} borderRadius={radius.input}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                isLoading && { opacity: 0.7 },
                pressed && { backgroundColor: palette.ink },
              ]}
              onPress={primaryAction}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            </Pressable>
          </HardShadow>
        </View>

        <Pressable
          style={styles.linkButton}
          onPress={toggleMode}
          disabled={isLoading}
        >
          <Text style={[styles.linkText, isLoading && { opacity: 0.7 }]}>
            {isLoginMode ? 'Create Account' : 'Back to Login'}
          </Text>
        </Pressable>

        {isLoginMode && (
          <Pressable
            style={styles.linkButton}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text style={[styles.linkTextSubtle, isLoading && { opacity: 0.7 }]}>
              Forgot Password?
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: space.xxl + space.sm,
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 40,
    color: palette.ink,
    letterSpacing: -1.5,
    fontWeight: '900',
  },
  subtitle: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: space.xs,
    fontStyle: 'italic',
  },

  form: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: space.md,
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: radius.input,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...border.thick,
    fontFamily: font.body,
    fontSize: 15,
    color: palette.ink,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  eyeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: palette.card,
    ...border.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonWrap: {
    marginTop: space.sm,
  },
  primaryButton: {
    ...recipes.buttonPrimary,
    paddingVertical: space.md + 2,
  },
  primaryButtonText: {
    ...recipes.buttonPrimaryText,
  },

  linkButton: {
    alignSelf: 'center',
    paddingVertical: space.sm,
  },
  linkText: {
    fontFamily: font.bodyBold,
    fontSize: 14,
    color: palette.leaf,
  },
  linkTextSubtle: {
    fontFamily: font.body,
    fontSize: 13,
    color: palette.inkSoft,
  },
});
