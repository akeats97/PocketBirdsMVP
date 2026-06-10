import FontAwesome from '@expo/vector-icons/FontAwesome';
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
import { User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebaseConfig';
import { palette } from '../constants/Colors';
import ActivityProvider from './context/ActivityContext';
import FriendSightingsProvider from './context/FriendSightingsContext';
import HootsProvider from './context/HootsContext';
import { SightingsProvider } from './context/SightingsContext';
import { WishlistProvider } from './context/WishlistContext';
import LoginScreen from '../components/LoginScreen';
import { notificationService } from './services/notificationService';
import { savePushToken } from './services/userService';

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

// Authenticated App Component
function AuthenticatedApp() {
  useEffect(() => {
    const registerForNotifications = async () => {
      try {
        // Register for push notifications and get token
        const token = await notificationService.registerForPushNotificationsAsync();
        if (token) {
          await savePushToken(token);
        } else {
          console.warn('Push token registration returned null — check permissions.');
        }
        
        // Set up notification response handler (fires when app is warm)
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;

          if (data.type === 'friend_sighting') {
            router.push('/(tabs)/friends');
          } else if (
            (data.type === 'hoot' ||
              data.type === 'comment' ||
              data.type === 'proposal' ||
              data.type === 'proposal_accepted') &&
            data.sightingId
          ) {
            router.push(`/sighting/${data.sightingId}`);
          } else if (data.type === 'follow' && data.actorUid) {
            // Open the new follower's profile so you can follow them back.
            router.push(`/profile/${data.actorUid}`);
          }
        });

        // Handle cold-start: if the app was launched by tapping a notification
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data;
          if (data.type === 'friend_sighting') {
            router.push('/(tabs)/friends');
          } else if (
            (data.type === 'hoot' ||
              data.type === 'comment' ||
              data.type === 'proposal' ||
              data.type === 'proposal_accepted') &&
            data.sightingId
          ) {
            router.push(`/sighting/${data.sightingId}`);
          } else if (data.type === 'follow' && data.actorUid) {
            // Open the new follower's profile so you can follow them back.
            router.push(`/profile/${data.actorUid}`);
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
      {/* Don't consume the TOP or BOTTOM inset here — only the horizontal edges.
          TOP: the native-stack header (the `(tabs)` route) reserves the status-bar
          inset itself on BOTH platforms, and the header-LESS pushed screens
          (sighting/[id], activity, profile) own their top inset via
          useSafeAreaInsets. Adding 'top' here double-insets the header — it shoved
          the iOS title bar down and clipped the bell/avatar off the right edge
          (and did the same on Android before this was removed there).
          BOTTOM: the tab bar (and the pushed screens) apply their own bottom
          safe-area padding; insetting it here too left an empty strip below the
          tab bar on iOS. */}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: palette.cream }}
        edges={['left', 'right']}
      >
        <Stack>
          {/* The tab screens render their own shared header (wordmark + bell +
              avatar) via components/AppHeader.tsx — see app/(tabs)/_layout.tsx.
              We don't use the native-stack header here because iOS 26's glass
              bar-button styling clipped the custom header-right controls. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sighting/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="sighting/[id]/edit" options={{ headerShown: false }} />
          <Stack.Screen name="photo" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="activity" options={{ headerShown: false }} />
          <Stack.Screen name="species/[name]" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[uid]" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[uid]/compare" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[uid]/connections" options={{ headerShown: false }} />
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
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
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

  // Wait for BOTH fonts to load AND auth state to be confirmed
  if (!loaded || isAuthLoading) {
    return null;
  }

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
