# Push Notification Debugging Playbook

(Moved out of CLAUDE.md Jun 10 2026. The "Push Notifications - Working Setup" section there has the 3-part config checklist; this file is the layer-by-layer diagnostic procedure for when push breaks.)

## Debugging methodology

Push delivery is a 4-layer pipeline. Isolate the broken layer by testing each one in order: don't guess, probe.

```
[1] App registers token → [2] Cloud Function fires → [3] Expo push API → [4] FCM → device
```

**Layer 1 - Token registration:** Check Firestore `users/{uid}` for a non-null `expoPushToken` and recent `lastTokenUpdate`. If missing: native FCM isn't initializing on device (check google-services.json placement + Gradle plugin) or permissions were denied.

**Layer 2 - Cloud Function:** `firebase functions:log --only onSightingAdded -n 50`. Look for "Found push token for follower" lines. If function isn't firing or not finding tokens, problem is in `functions/index.js` or the follows query.

**Layer 3 - Expo push API:** Skip the function entirely and send a push manually via curl. This is the critical diagnostic trick: it isolates the Expo↔FCM layer from your own code.
```bash
curl -s -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/send \
  -d '{"to":"ExponentPushToken[...]","title":"test","body":"hi","channelId":"default"}'
```
Expected: `{"data":{"status":"ok","id":"<ticket>"}}`. If `status: error` with `InvalidCredentials`, the problem is your FCM V1 credential setup at Expo (IAM role or upload path, see the checklist in CLAUDE.md).

**Layer 4 - FCM delivery:** Push tickets (from send) only confirm Expo accepted the payload. Push **receipts** confirm FCM actually delivered it. Wait 5+ seconds after send, then:
```bash
curl -s -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/getReceipts \
  -d '{"ids":["<ticket-id-from-send>"]}'
```
Expected: `{"data":{"<ticket>":{"status":"ok"}}}`. If receipt has an error (e.g. `DeviceNotRegistered`), the user's token is stale: they need to reopen the app to re-register.

## Other commands

Query Firestore with admin:
```bash
cd /Users/alexkeats/Desktop/PocketBirds4/functions
GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node -e "..."
```

Test that the service account key itself works against FCM V1 directly (rules out IAM issues independent of Expo):
```bash
cd /Users/alexkeats/Desktop/PocketBirds4/functions
GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/pocketbirds-firebase-adminsdk-fbsvc-19e23de9d2.json node -e "
const {GoogleAuth} = require('google-auth-library');
(async () => {
  const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/firebase.messaging']});
  const token = await (await auth.getClient()).getAccessToken();
  const res = await fetch('https://fcm.googleapis.com/v1/projects/pocketbirds/messages:send', {
    method: 'POST', headers: {'Authorization': 'Bearer ' + token.token, 'Content-Type': 'application/json'},
    body: JSON.stringify({validate_only: true, message: {token: 'bogus', notification: {title: 't', body: 'b'}}})
  });
  console.log(res.status, await res.text());
})();
"
```
Expected: `400 ... INVALID_ARGUMENT` (the bogus token is rejected, but auth succeeded). If you see `403 PERMISSION_DENIED`, the service account lacks the Firebase Messaging API Admin role.
