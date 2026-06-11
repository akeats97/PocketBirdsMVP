import React from 'react';
import ProfileView from '../../components/profile/ProfileView';
import { auth } from '../../config/firebaseConfig';

// The You tab — your own profile (journal, dex, stats, logout), permanently
// one tap away now that the home feed mixes in friends' sightings.
export default function YouScreen() {
  return <ProfileView uid={auth.currentUser?.uid} embedded />;
}
