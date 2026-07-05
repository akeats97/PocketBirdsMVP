// Native Firebase via @react-native-firebase. The native SDK initializes
// itself at app launch from android/app/google-services.json /
// ios/PocketBirds4/GoogleService-Info.plist (see AppDelegate.swift), so there
// is no JS-side config block. Firestore gets disk persistence by default
// (offline reads + queued writes), and transport is native gRPC — the old
// WebChannel hang that needed experimentalAutoDetectLongPolling is gone.
// Auth sessions persist natively (no AsyncStorage plumbing); sessions from
// the pre-migration JS SDK don't transfer, so users sign in once after
// updating.
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
