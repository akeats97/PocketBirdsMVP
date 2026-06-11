import { Redirect } from 'expo-router';

export default function Index() {
  // Land on the Journal feed — the merged you + friends home screen.
  return <Redirect href="/(tabs)" />;
}
