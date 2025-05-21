import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { auth } from '../config/firebaseConfig';
import FriendSightingsProvider from './context/FriendSightingsContext';
import { SightingsProvider } from './context/SightingsContext';

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

function RootLayoutNav() {
  const router = useRouter();

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, navigate to add tab
        router.replace('/(tabs)/add');
      } else {
        // User is signed out, navigate to login
        router.replace('/');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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
            }} 
          />
          <Stack.Screen name="index" options={{ headerShown: false }} />
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
      // You can add any Firebase-specific initialization logic here
    }, []);

  if (!loaded) {
    return null;
  }

  return (
    <SightingsProvider>
      <FriendSightingsProvider>
        <RootLayoutNav />
      </FriendSightingsProvider>
    </SightingsProvider>
  );
}
