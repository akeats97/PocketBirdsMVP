import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { signOut, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { auth } from '../config/firebaseConfig';
import FriendSightingsProvider from './context/FriendSightingsContext';
import { SightingsProvider, useSightings } from './context/SightingsContext';
import Index from './index';

console.log('ROOT LAYOUT: Firebase imported'); //just for bug testing

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4A90E2',
  },
};

// Authenticated App Component
function AuthenticatedApp() {
  const { clearLocalData } = useSightings();
  
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Starting logout process...');
              await clearLocalData();
              console.log('Local data cleared');
              await signOut(auth);
              console.log('Firebase signOut completed');
              // No navigation needed - auth state change will handle UI update
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={true}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: true,
              title: 'Pocket Birds v0.5',
              headerTitleStyle: {
                fontSize: 20,
                fontWeight: '600',
              },
              headerRight: () => (
                <TouchableOpacity
                  onPress={handleLogout}
                  style={{
                    marginRight: 15,
                    padding: 5,
                  }}
                >
                  <Ionicons name="log-out-outline" size={24} color="#4A90E2" />
                </TouchableOpacity>
              ),
            }} 
          />
        </Stack>
      </SafeAreaView>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Listen for auth state changes at the top level
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      console.log('Auth state changed. User:', authUser ? authUser.uid : 'null');
      setUser(authUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Add a useEffect to ensure Firebase is initialized
  useEffect(() => {
    console.log('Firebase Auth initialized');
  }, []);

  if (!loaded || isAuthLoading) {
    return null;
  }

  return (
    <SightingsProvider>
      <FriendSightingsProvider>
        {user ? (
          // User is logged in - show the main app
          <AuthenticatedApp />
        ) : (
          // User is not logged in - show login screen
          <ThemeProvider value={theme}>
            <StatusBar
              barStyle="dark-content"
              backgroundColor="#ffffff"
              translucent={true}
            />
            <SafeAreaView style={{ flex: 1 }}>
              <Index />
            </SafeAreaView>
          </ThemeProvider>
        )}
      </FriendSightingsProvider>
    </SightingsProvider>
  );
}
