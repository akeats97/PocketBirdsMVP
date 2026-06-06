import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { signOut, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { auth } from '../config/firebaseConfig';
import { palette } from '../constants/Colors';
import { CURRENT_RELEASE_NAME } from '../constants/release';
import ActivityProvider, { useActivity } from './context/ActivityContext';
import FriendSightingsProvider from './context/FriendSightingsContext';
import HootsProvider from './context/HootsContext';
import { SightingsProvider, useSightings } from './context/SightingsContext';
import { WishlistProvider } from './context/WishlistContext';
import LoginScreen from '../components/LoginScreen';
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
    primary: palette.leaf,
    background: palette.cream,
    text: palette.ink,
    border: palette.ink,
    notification: palette.coral,
  },
};

// Header bell → opens the Activity screen, with an unread dot.
function HeaderBell() {
  const { unreadCount } = useActivity();
  return (
    <TouchableOpacity
      onPress={() => router.push('/activity')}
      style={{
        marginRight: 4,
        padding: 8,
        minWidth: 40,
        minHeight: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={unreadCount > 0 ? `Activity, ${unreadCount} unread` : 'Activity'}
    >
      <Ionicons name="notifications-outline" size={24} color={palette.ink} />
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: palette.coral,
            borderWidth: 1,
            borderColor: palette.cream,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

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
          console.log('Push token saved:', token);
        } else {
          console.warn('Push token registration returned null — check permissions.');
        }
        
        // Set up notification response handler (fires when app is warm)
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);

          if (data.type === 'friend_sighting') {
            router.push('/(tabs)/friends');
          } else if ((data.type === 'hoot' || data.type === 'comment') && data.sightingId) {
            router.push(`/sighting/${data.sightingId}`);
          }
        });

        // Handle cold-start: if the app was launched by tapping a notification
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data;
          console.log('Notification tapped (cold start):', data);
          if (data.type === 'friend_sighting') {
            router.push('/(tabs)/friends');
          } else if ((data.type === 'hoot' || data.type === 'comment') && data.sightingId) {
            router.push(`/sighting/${data.sightingId}`);
          }
        }

        return subscription;
      } catch (error: any) {
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
        backgroundColor={palette.cream}
        translucent={true}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.cream }}>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: true,
              headerBackVisible: false,
              title: `Pocket Birds ${CURRENT_RELEASE_NAME}`,
              headerStyle: {
                backgroundColor: palette.cream,
              },
              headerTintColor: palette.ink,
              headerTitleStyle: {
                fontFamily: 'BricolageGrotesque_700Bold',
                fontSize: 20,
                color: palette.ink,
              },
              headerShadowVisible: false,
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                  <HeaderBell />
                  <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                      padding: 8,
                      minWidth: 40,
                      minHeight: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 8,
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="log-out-outline" size={24} color={palette.ink} />
                  </TouchableOpacity>
                </View>
              ),
            }}
          />
          <Stack.Screen name="sighting/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="activity" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[uid]" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[uid]/compare" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaView>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
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
      <KeyboardProvider>
      <SightingsProvider>
        <FriendSightingsProvider>
          <HootsProvider>
          <ActivityProvider>
          <WishlistProvider>
            {user ? (
              // User is logged in - show the main app with Stack navigation
              <AuthenticatedApp key="authenticated" />
            ) : (
              // User is not logged in - show login screen directly (not as a route)
              <ThemeProvider value={theme} key="login">
                <StatusBar
                  barStyle="dark-content"
                  backgroundColor={palette.cream}
                  translucent={true}
                />
                <SafeAreaView style={{ flex: 1, backgroundColor: palette.cream }}>
                  <LoginScreen />
                </SafeAreaView>
              </ThemeProvider>
            )}
          </WishlistProvider>
          </ActivityProvider>
          </HootsProvider>
        </FriendSightingsProvider>
      </SightingsProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
