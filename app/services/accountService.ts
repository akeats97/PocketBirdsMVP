import { EmailAuthProvider, reauthenticateWithCredential } from '@react-native-firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { callCloudFunction } from './functionsClient';

// Account deletion (N-1). The heavy lifting happens server-side in the
// `deleteAccount` callable (functions/index.js), which removes everything the
// account owns and finally the Auth user itself.

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
  await callCloudFunction('deleteAccount');
}
