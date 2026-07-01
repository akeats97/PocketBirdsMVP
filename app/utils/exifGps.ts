import * as FileSystem from 'expo-file-system';

// Minimal JPEG EXIF GPS reader.
//
// Why this exists: on Android every OS-level way of getting a picked photo's
// GPS can fail (the Photo Picker REDACTS location by zero-filling the GPS
// rationals while leaving the tags in place, and expo-image-picker's native
// EXIF export collapses DMS rationals to 0.0). Parsing the bytes ourselves
// tells us exactly what's in the served file, including the difference
// between "no GPS written" and "GPS redacted to zeros" (the `reason` field).
// GPS-only on purpose; this is not a general EXIF library.
//
// Every read is bounds-checked and any structural surprise returns null.

const HEADER_BYTES = 256 * 1024; // EXIF lives in APP1, always near the file start

function base64ToBytes(b64: string): Uint8Array {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = table.indexOf(clean[i]);
    if (v === -1) continue; // tolerate whitespace/newlines
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

interface GpsResult {
  latitude: number;
  longitude: number;
}

export interface GpsParseOutcome {
  coords: GpsResult | null;
  // Machine-readable trail of why coords is null (or 'ok'). 'zeroed-coords'
  // is the Photo Picker redaction signature: tags intact, values 0/0.
  reason:
    | 'ok'
    | 'read-failed'
    | 'empty-read'
    | 'not-jpeg'
    | 'no-exif-app1'
    | 'bad-tiff'
    | 'no-gps-ifd'
    | 'no-coord-tags'
    | 'bad-coord-format'
    | 'zeroed-coords'
    | 'out-of-range';
}

function gpsFromTiff(b: Uint8Array, tiff: number, end: number): GpsParseOutcome {
  const fail = (reason: GpsParseOutcome['reason']): GpsParseOutcome => ({ coords: null, reason });
  if (tiff + 8 > end) return fail('bad-tiff');
  const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  const big = b[tiff] === 0x4d && b[tiff + 1] === 0x4d;
  if (!little && !big) return fail('bad-tiff');

  const u16 = (o: number): number | null =>
    o + 2 <= end ? (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]) : null;
  const u32 = (o: number): number | null =>
    o + 4 <= end
      ? little
        ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
        : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
      : null;

  if (u16(tiff + 2) !== 42) return fail('bad-tiff');
  const ifd0Rel = u32(tiff + 4);
  if (ifd0Rel === null) return fail('bad-tiff');

  // Walk an IFD's entries; returns a map of wanted tag -> entry offset.
  const findEntries = (ifd: number, wanted: number[]): Map<number, number> | null => {
    const found = new Map<number, number>();
    const count = u16(ifd);
    if (count === null) return null;
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      const tag = u16(entry);
      if (tag === null) return found;
      if (wanted.includes(tag)) found.set(tag, entry);
    }
    return found;
  };

  const ifd0 = tiff + ifd0Rel;
  const gpsPointer = findEntries(ifd0, [0x8825])?.get(0x8825);
  if (gpsPointer === undefined) return fail('no-gps-ifd');
  const gpsIfdRel = u32(gpsPointer + 8);
  if (gpsIfdRel === null) return fail('no-gps-ifd');
  const gpsIfd = tiff + gpsIfdRel;

  const entries = findEntries(gpsIfd, [0x0001, 0x0002, 0x0003, 0x0004]);
  if (!entries) return fail('no-coord-tags');
  const latRefE = entries.get(0x0001);
  const latE = entries.get(0x0002);
  const lngRefE = entries.get(0x0003);
  const lngE = entries.get(0x0004);
  if (latE === undefined || lngE === undefined) return fail('no-coord-tags');

  // ASCII ref ("N\0" etc.) is <=4 bytes so it's stored inline in the entry.
  const readRef = (entry: number | undefined): string =>
    entry === undefined || entry + 9 > end ? '' : String.fromCharCode(b[entry + 8]);

  // Coordinate: 3 RATIONALs (type 5, count 3) stored at an offset.
  const readCoord = (entry: number): number | null => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    if (type !== 5 || count !== 3) return null;
    const relOff = u32(entry + 8);
    if (relOff === null) return null;
    const v = tiff + relOff;
    let coord = 0;
    const divisors = [1, 60, 3600];
    for (let i = 0; i < 3; i++) {
      const num = u32(v + i * 8);
      const den = u32(v + i * 8 + 4);
      if (num === null || den === null) return null;
      if (den === 0) {
        if (num !== 0) return null;
        continue; // 0/0 component: redaction or unused seconds
      }
      coord += num / den / divisors[i];
    }
    return coord;
  };

  const lat = readCoord(latE);
  const lng = readCoord(lngE);
  if (lat === null || lng === null) return fail('bad-coord-format');
  if (lat === 0 && lng === 0) return fail('zeroed-coords'); // redaction signature
  const latSigned = readRef(latRefE) === 'S' ? -lat : lat;
  const lngSigned = readRef(lngRefE) === 'W' ? -lng : lng;
  if (Math.abs(latSigned) > 90 || Math.abs(lngSigned) > 180) return fail('out-of-range');
  return { coords: { latitude: latSigned, longitude: lngSigned }, reason: 'ok' };
}

export function gpsFromJpegBytes(b: Uint8Array): GpsParseOutcome {
  if (b.length === 0) return { coords: null, reason: 'empty-read' };
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { coords: null, reason: 'not-jpeg' };
  let off = 2;
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) return { coords: null, reason: 'no-exif-app1' };
    const marker = b[off + 1];
    // EOI / start of scan: image data begins, no EXIF was found before it.
    if (marker === 0xd9 || marker === 0xda) return { coords: null, reason: 'no-exif-app1' };
    if (marker === 0xff) {
      off += 1; // fill byte before a marker
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      off += 2;
      continue;
    }
    const size = (b[off + 2] << 8) | b[off + 3];
    if (size < 2) return { coords: null, reason: 'no-exif-app1' };
    const segStart = off + 4;
    if (
      marker === 0xe1 &&
      size >= 8 &&
      segStart + 6 <= b.length &&
      b[segStart] === 0x45 && // "Exif\0\0"
      b[segStart + 1] === 0x78 &&
      b[segStart + 2] === 0x69 &&
      b[segStart + 3] === 0x66 &&
      b[segStart + 4] === 0 &&
      b[segStart + 5] === 0
    ) {
      const segEnd = Math.min(off + 2 + size, b.length);
      return gpsFromTiff(b, segStart + 6, segEnd);
    }
    off += 2 + size;
  }
  return { coords: null, reason: 'no-exif-app1' };
}

// Read the GPS coordinates embedded in a JPEG file's EXIF. Never throws; the
// outcome's `reason` says exactly why coords is null.
export async function gpsFromJpegFile(uri: string): Promise<GpsParseOutcome> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: HEADER_BYTES,
    });
    return gpsFromJpegBytes(base64ToBytes(b64));
  } catch {
    return { coords: null, reason: 'read-failed' };
  }
}
