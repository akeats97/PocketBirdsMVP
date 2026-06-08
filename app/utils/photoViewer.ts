// In-memory hand-off for the full-screen photo viewer route (`app/photo.tsx`).
//
// We deliberately do NOT pass the image URL as an expo-router param: Firebase
// Storage download URLs encode the path separator as `%2F`
// (`.../o/sightings%2F123.jpeg`), and expo-router URL-decodes param values,
// turning `%2F` into a literal `/`. Firebase then rejects that path with HTTP
// 400 and the image shows black. Stashing the exact string in a module
// variable and navigating with no param sidesteps all URL encoding.
//
// Safe because every open is an in-app `router.push('/photo')` (no deep
// linking): we set the value synchronously right before navigating, and the
// route reads it once on mount.
let pendingUri: string | null = null;

export function setPhotoUri(uri: string) {
  pendingUri = uri;
}

export function getPhotoUri(): string | null {
  return pendingUri;
}
