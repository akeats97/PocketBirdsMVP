import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { signOut, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../config/firebaseConfig';
import FriendSightingsProvider from './context/FriendSightingsContext';
import { SightingsProvider, useSightings } from './context/SightingsContext';
import Index from './index';
import { notificationService } from './services/notificationService';
import { savePushToken } from './services/userService';

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

  useEffect(() => {
    const registerForNotifications = async () => {
      try {
        // Register for push notifications and get token
        const token = await notificationService.registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
          console.log('Push token saved');
        }
        
        // Set up notification response handler
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);
          
          if (data.type === 'friend_sighting') {
            // Navigate to friend sightings tab
            console.log('Friend sighting notification tapped');
            // You can add navigation logic here later
          }
        });
        
        return subscription;
      } catch (error) {
        console.error('Error registering for notifications:', error);
      }
    };

    const subscription = registerForNotifications();
    return () => {
      subscription?.then(sub => sub?.remove());
    };
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
              headerRight: () => (
                <TouchableOpacity
                  onPress={handleLogout}
                  style={{
                    marginRight: 15,
                    padding: 8,
                    minWidth: 40,
                    minHeight: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 8,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    console.log('Setting up auth listener...');
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      console.log('Auth state changed. User:', authUser ? authUser.uid : 'null');
      console.log('Previous user state:', user ? user.uid : 'null');
      setUser(authUser);
      setIsAuthLoading(false);
      console.log('Auth loading set to false');
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

  // Wait for BOTH fonts to load AND auth state to be confirmed
  if (!loaded || isAuthLoading) {
    console.log('App loading - fonts:', loaded, 'auth:', isAuthLoading);
    return null;
  }

  // Additional safety check - if we're still loading auth, don't render anything
  if (isAuthLoading) {
    console.log('Still loading auth state...');
    return null;
  }

  console.log('App rendering - user:', user ? 'logged in' : 'not logged in');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SightingsProvider>
        <FriendSightingsProvider>
          {user ? (
            // User is logged in - show the main app with Stack navigation
            <AuthenticatedApp key="authenticated" />
          ) : (
            // User is not logged in - show login screen directly (not as a route)
            <ThemeProvider value={theme} key="login">
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
    </GestureHandlerRootView>
  );
}
