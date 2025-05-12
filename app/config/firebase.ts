import { initializeApp } from 'firebase/app';

// Your web app's Firebase configuration
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

// Export the app and config
export { app };
export default firebaseConfig;
