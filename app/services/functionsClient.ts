import { auth } from '../../config/firebaseConfig';

// Minimal client for Firebase callable functions over their HTTPS protocol
// (POST { data }, Authorization: Bearer <ID token>, response { result } or
// { error }). Used instead of adding @react-native-firebase/functions: a
// couple of endpoints don't justify a new native dependency, which would
// force dev-client + production rebuilds.
const FUNCTIONS_BASE = 'https://us-central1-pocketbirds.cloudfunctions.net';

export async function callCloudFunction<T = unknown>(
  name: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? `${name} failed (HTTP ${res.status})`);
  }
  return json?.result as T;
}
