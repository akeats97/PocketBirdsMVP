import { EmailAuthProvider, reauthenticateWithCredential } from '@react-native-firebase/auth';
import { auth } from '../../config/firebaseConfig';

// Account deletion (N-1). The heavy lifting happens server-side in the
// `deleteAccount` callable (functions/index.js), which removes everything the
// account owns and finally the Auth user itself. We invoke it over the
// callable HTTPS protocol with a raw fetch + ID token instead of adding
// @react-native-firebase/functions: one endpoint doesn't justify a new native
// dependency (which would force dev-client + production rebuilds).
const DELETE_ACCOUNT_URL = 'https://us-central1-pocketbirds.cloudfunctions.net/deleteAccount';

// Firebase requires a recent sign-in for security-sensitive operations, so the
// delete flow re-checks the password first. Throws on a wrong password (the
// caller shows the error inline).
export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Not signed in');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken(true);
  const res = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: {} }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? `Deletion failed (HTTP ${res.status})`);
  }
}
