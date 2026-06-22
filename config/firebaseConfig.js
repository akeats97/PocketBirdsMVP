// Import the functions you need from the SDKs you need
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
//import { getAnalytics } from "firebase/analytics";
// Optionally import the services that you want to use
// import {...} from 'firebase/database';
// import {...} from 'firebase/functions';
// import {...} from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBjzSB2lUsbsXcleOACaZjO51X4tlGH8Dw",
  authDomain: "pocketbirds.firebaseapp.com",
  projectId: "pocketbirds",
  storageBucket: "pocketbirds.firebasestorage.app",
  messagingSenderId: "854699399919",
  appId: "1:854699399919:web:cf8c622c8f6d470ccf591a",
  measurementId: "G-1776J6LESB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore.
// experimentalAutoDetectLongPolling: the default streaming WebChannel transport
// wedges on flaky / high-latency networks (e.g. Starlink with no cell backup) —
// the connection half-opens, so reads and onSnapshot listeners hang forever
// while the device still reports "wifi connected". Auto-detect notices the
// streaming transport failing and falls back to long-polling, which survives
// those networks. (If field reports persist, escalate to
// experimentalForceLongPolling: true, which always long-polls.)
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

// Initialize Firebase Auth with React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

console.log('FIREBASE CONFIG: Auth initialized with persistence'); //just for bug testing

export { app, auth, db }; // Export auth and app for use in other parts of your app

