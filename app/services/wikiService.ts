import AsyncStorage from '@react-native-async-storage/async-storage';

// Wikipedia intro text for the species Guide tab.
//
// We fetch the REST summary (en.wikipedia.org) and cache the result on the
// device so it shows offline after the first view. Text is CC BY-SA; the
// attribution lives in the Guide credit line. A species with no article (or a
// failed offline fetch) returns { text: null }, which drives the dashed empty
// card — never an error.

export interface WikiBlurb {
  text: string | null;
  loaded: boolean; // true once we've resolved (from cache or network)
}

const CACHE_PREFIX = 'wiki.summary.v1.';
// Cached text is fine to keep a long time; species write-ups barely change.
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

interface CacheEntry {
  text: string | null;
  at: number;
}

const memory = new Map<string, WikiBlurb>();

// REST summary endpoint. Wikipedia resolves redirects/spaces for us, so the
// common name usually lands; we fall back to the Latin name on a miss.
async function fetchSummary(title: string): Promise<string | null | undefined> {
  // undefined = network/transient failure (don't cache); null = no article.
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    const data = await res.json();
    if (data?.type === 'disambiguation') return null;
    const text: string | undefined = data?.extract;
    return text && text.trim() ? text.trim() : null;
  } catch {
    return undefined;
  }
}

export async function getWikiBlurb(commonName: string, latinName?: string): Promise<WikiBlurb> {
  const key = commonName.trim();
  const cached = memory.get(key);
  if (cached) return cached;

  const storeKey = CACHE_PREFIX + key.toLowerCase();
  try {
    const rawCache = await AsyncStorage.getItem(storeKey);
    if (rawCache) {
      const entry: CacheEntry = JSON.parse(rawCache);
      if (Date.now() - entry.at < TTL_MS) {
        const blurb = { text: entry.text, loaded: true };
        memory.set(key, blurb);
        return blurb;
      }
    }
  } catch {
    // ignore cache read failures
  }

  let text = await fetchSummary(commonName);
  if (text == null && latinName && latinName !== commonName) {
    // common-name miss — try the binomial before giving up
    const viaLatin = await fetchSummary(latinName);
    if (viaLatin !== undefined) text = viaLatin;
  }

  if (text === undefined) {
    // transient failure — report empty but don't poison the cache
    return { text: null, loaded: false };
  }

  const blurb = { text, loaded: true };
  memory.set(key, blurb);
  try {
    await AsyncStorage.setItem(storeKey, JSON.stringify({ text, at: Date.now() } as CacheEntry));
  } catch {
    // ignore cache write failures
  }
  return blurb;
}
