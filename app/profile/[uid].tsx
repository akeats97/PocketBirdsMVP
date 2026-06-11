import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import ProfileView from '../../components/profile/ProfileView';

// Stack-pushed profile (friend / public / self). The implementation lives in
// components/profile/ProfileView so the You tab can render the same screen.
export default function ProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <ProfileView uid={uid} />;
}
