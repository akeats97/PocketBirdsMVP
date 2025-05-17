import { Stack, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebaseConfig';



export default function Index() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigate to main app on success
      router.replace('/(tabs)');
    } catch (error) {
      console.log('Login error:', error);
      Alert.alert(
        'nice try guy, go again'
      );
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
    
    // Basic username validation
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
      // Check if username is already taken
      if (!isLoginMode) {
        const usernameDoc = await getDoc(doc(db, "usernames", username));
        if (usernameDoc.exists()) {
          setIsLoading(false);
          Alert.alert('Error', 'turns out you\'re not very original ... try a new name');
          return;
        }
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // If in registration mode, save username to Firestore
      if (!isLoginMode) {
        try {
          // Create a user document with the username
          await setDoc(doc(db, "users", user.uid), {
            username: username,
            email: email,
            createdAt: new Date()
          });
          
          // Also create an entry in the usernames collection for uniqueness check
          await setDoc(doc(db, "usernames", username), {
            uid: user.uid
          });
          
          console.log('Username saved successfully');
          Alert.alert(
            'Success', 
            'account created successfully! it\'s time to spot some birbs!', 
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
          'account created successfully! it\'s time to spot some birbs!', 
          [{ text: 'OK', onPress: () => setIsLoginMode(true) }]
        );
      }
      
      console.log('User signed up:', user);
    } catch (error: any) {
      console.log('Signup error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'hmmm, do you have a twin with the same email? because that email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'are you sure that\'s a real email?';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'your password game is weak, make it 6+ long please';
      }
      
      Alert.alert(
        'Account Creation Failed', 
        `${errorMessage}.`
      );

    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <Text style={styles.title}>PocketBirds</Text>
      <Text style={styles.subtitle}>please don't put birds in your pockets</Text>
      
      <View style={styles.inputContainer}>
      {!isLoginMode && (
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          editable={!isLoading}
        />
      )}
      
      <TextInput
        style={[styles.input, { color: '#333' }]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
        placeholderTextColor="#999"
      />
   
      <TextInput
        style={[styles.input, { color: '#333' }]}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
        placeholderTextColor="#999"
      />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && { opacity: 0.7 }]} 
        onPress={isLoginMode ? handleLogin : handleCreateAccount}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Processing...' : (isLoginMode ? 'Login' : 'Create Account')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.createAccountContainer} 
        onPress={toggleMode}
        disabled={isLoading}
      >
        <Text style={[styles.createAccountText, isLoading && { opacity: 0.7 }]}>
          {isLoginMode ? 'Create Account' : 'Back to Login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  inputContainer: {
    width: '80%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    padding: 16,
    width: '80%',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createAccountContainer: {
    padding: 10,
  },
  createAccountText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '500',
  },
});
