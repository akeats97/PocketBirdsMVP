// Import the functions you need from the SDKs you need
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Auth with React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

console.log('FIREBASE CONFIG: Auth initialized with persistence'); //just for bug testing

export { app, auth, db }; // Export auth and app for use in other parts of your app

