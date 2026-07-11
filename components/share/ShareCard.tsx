import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { RegionCode } from '../../constants/birdNames';
import { font, palette, STATUS_VISUAL } from '../../constants/Colors';
import { ShareCardData } from '../../app/utils/shareCardData';
import { HoloFill } from '../Holo';

// The shareable collectible card — the "v2 art-led" direction from the
// Shareable Sighting design doc. Rendered at a fixed pixel size so it captures
// to a crisp, consistent PNG regardless of device. Presentational only: all
// data comes pre-shaped as ShareCardData.

export const SHARE_CARD_WIDTH = 320;

// Realm dot positions over the equirectangular world plate (percent x/y), same
// coordinates the Species Guide uses.
const REALM_POS: Record<RegionCode, { x: number; y: number }> = {
  NA: { x: 22.2, y: 23.3 }, MA: { x: 25.6, y: 40.6 }, SA: { x: 33.9, y: 56.7 },
  PAL: { x: 62.5, y: 21.1 }, AF: { x: 55.6, y: 48.9 }, OR: { x: 76.4, y: 40.0 },
  AU: { x: 87.2, y: 63.9 }, OC: { x: 94.4, y: 52.8 },
};

// Ring + inner-surface colors per rarity. base = ink ring; lifer = coral ring
// (the app's "1st" language); global = animated holo, drawn as a fill behind an
// inset card so it reads as a rainbow border.
function frameFor(rarity: ShareCardData['rarity']) {
  switch (rarity) {
    case 'lifer':
      return { ring: palette.coral, gap: '#fff8f5', inner: '#fff8f5' };
    case 'global':
      return { ring: palette.card, gap: palette.card, inner: palette.card };
    default:
      return { ring: palette.ink, gap: palette.card, inner: palette.card };
  }
}

function RealmMini({ realms }: { realms: RegionCode[] }) {
  return (
    <ImageBackground
      source={require('../../assets/images/world-equirect.png')}
      style={styles.map}
      imageStyle={styles.mapImage}
      resizeMode="stretch"
    >
      {realms.map((r) => {
        const p = REALM_POS[r];
        return <View key={r} style={[styles.realmDot, { left: `${p.x}%`, top: `${p.y}%` }]} />;
      })}
    </ImageBackground>
  );
}

function Badge({ rarity }: { rarity: ShareCardData['rarity'] }) {
  if (rarity === 'global') {
    return (
      <View style={styles.badge}>
        <HoloFill />
        <Ionicons name="globe-outline" size={11} color={palette.ink} />
        <Text style={[styles.badgeText, { color: palette.ink }]}>GLOBAL FIRST</Text>
      </View>
    );
  }
  if (rarity === 'lifer') {
    return (
      <View style={[styles.badge, { backgroundColor: palette.coral }]}>
        <Ionicons name="star" size={10} color="#fff" />
        <Text style={[styles.badgeText, { color: '#fff' }]}>LIFER</Text>
      </View>
    );
  }
  return null;
}

interface Props {
  data: ShareCardData;
  /** onLoad of the art photo, so the sheet can wait before capturing. */
  onArtReady?: () => void;
}

export const ShareCard = React.forwardRef<View, Props>(({ data, onArtReady }, ref) => {
  const frame = frameFor(data.rarity);
  const status = STATUS_VISUAL[data.statusCode];

  return (
    <View ref={ref} collapsable={false} style={[styles.outer, { backgroundColor: frame.ring }]}>
      {data.rarity === 'global' && <HoloFill />}

      <View style={[styles.gap, { backgroundColor: frame.gap }]}>
        <View style={[styles.inner, { backgroundColor: frame.inner }]}>
          {/* Head — family + name, DEX catalog pill */}
          <View style={styles.head}>
            <View style={styles.headLeft}>
              {data.family ? <Text style={styles.family}>{data.family.toUpperCase()}</Text> : null}
              <Text style={styles.name} numberOfLines={2}>{data.name}</Text>
            </View>
            {data.dexNumber != null && (
              <View style={[styles.noPill, data.rarity === 'lifer' && { backgroundColor: palette.coral }]}>
                {data.rarity === 'global' && <HoloFill />}
                <Text style={[styles.noKicker, data.rarity === 'lifer' && { color: '#fff' }]}>DEX</Text>
                <Text style={[styles.noNum, data.rarity === 'lifer' && { color: '#fff' }]}>#{data.dexNumber}</Text>
              </View>
            )}
          </View>

          {/* Art — full-bleed photo (or a tinted fallback), badge bottom-left */}
          <View style={styles.art}>
            {data.photoUrl ? (
              <Image
                source={{ uri: data.photoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                onLoad={onArtReady}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: `hsl(${data.hue} 42% 72%)` }]} />
            )}
            <View style={styles.badgeWrap}>
              <Badge rarity={data.rarity} />
            </View>
          </View>

          {/* Sighting headline */}
          <View style={styles.sight}>
            <Text style={styles.loggedBy} numberOfLines={1}>Logged by {data.loggedBy}</Text>
            <Text style={styles.when} numberOfLines={1}>
              {[data.location, data.dateLabel].filter(Boolean).join('  ·  ').toUpperCase()}
            </Text>
          </View>

          {/* Stat band — realm map + mass + wing */}
          <View style={styles.band}>
            <View style={styles.bmap}>
              <RealmMini realms={data.regions} />
            </View>
            <View style={styles.bandCell}>
              <Text style={styles.cellKey}>MASS</Text>
              <Text style={styles.cellVal}>
                {data.mass ? data.mass.value : '—'}
                {data.mass ? <Text style={styles.cellUnit}> {data.mass.unit}</Text> : null}
              </Text>
            </View>
            <View style={styles.bandCell}>
              <Text style={styles.cellKey}>WING CHORD</Text>
              <Text style={styles.cellVal}>
                {data.wing ? data.wing.value : '—'}
                {data.wing ? <Text style={styles.cellUnit}> {data.wing.unit}</Text> : null}
              </Text>
            </View>
          </View>

          {/* Guide facts footnote */}
          <View style={styles.facts}>
            <Fact label="HABITAT" value={data.habitat} align="left" />
            <Fact label="DIET" value={data.diet} align="center" />
            <Fact label="MIGRATION" value={data.migration} align="right" />
          </View>

          {/* Foot — status + brand */}
          <View style={styles.foot}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.bg }]} />
              <Text style={styles.statusLabel}>{data.statusLabel}</Text>
            </View>
            <Text style={styles.brand}>Pocket Birds</Text>
          </View>
        </View>
      </View>
    </View>
  );
});
ShareCard.displayName = 'ShareCard';

function Fact({ label, value, align }: { label: string; value: string | null; align: 'left' | 'center' | 'right' }) {
  return (
    <View style={{ flex: 1, alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>{value ?? '—'}</Text>
    </View>
  );
}

const RING = 3;
const GAP = 9;

const styles = StyleSheet.create({
  outer: { width: SHARE_CARD_WIDTH, borderRadius: 22, padding: RING, overflow: 'hidden' },
  gap: { borderRadius: 19, padding: GAP },
  inner: { borderRadius: 12, borderWidth: 1.5, borderColor: palette.rule, padding: 10, overflow: 'hidden' },

  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headLeft: { flex: 1, minWidth: 0 },
  family: { fontFamily: font.mono, fontSize: 8.5, letterSpacing: 1.4, color: palette.muted },
  name: { fontFamily: font.displayBlack, fontSize: 21, letterSpacing: -0.6, color: palette.ink, marginTop: 2 },
  noPill: {
    borderWidth: 1.5, borderColor: palette.ink, borderRadius: 9, overflow: 'hidden',
    paddingHorizontal: 8, paddingTop: 3, paddingBottom: 4, alignItems: 'center', marginTop: 1,
  },
  noKicker: { fontFamily: font.mono, fontSize: 6, letterSpacing: 1.4, color: palette.inkSoft },
  noNum: { fontFamily: font.displayBlack, fontSize: 13, letterSpacing: -0.3, color: palette.ink },

  art: {
    marginTop: 11, marginHorizontal: -10, height: 226,
    borderTopWidth: 2, borderBottomWidth: 2, borderColor: palette.ink, overflow: 'hidden',
  },
  badgeWrap: { position: 'absolute', left: 8, bottom: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingLeft: 7, paddingRight: 9,
    borderRadius: 999, borderWidth: 1.5, borderColor: palette.ink, overflow: 'hidden',
  },
  badgeText: { fontFamily: font.bodyBold, fontSize: 10, letterSpacing: 0.5 },

  sight: { paddingTop: 13, paddingHorizontal: 1 },
  loggedBy: { fontFamily: font.displayBlack, fontSize: 15, letterSpacing: -0.3, color: palette.ink },
  when: { fontFamily: font.mono, fontSize: 8.5, letterSpacing: 0.8, color: palette.inkSoft, marginTop: 3 },

  band: {
    flexDirection: 'row', marginTop: 13, borderWidth: 2, borderColor: palette.ink,
    borderRadius: 10, overflow: 'hidden', minHeight: 46, backgroundColor: palette.card,
  },
  bmap: { width: 96, backgroundColor: '#dae6ef' },
  bandCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center', borderLeftWidth: 1.5, borderLeftColor: palette.rule },
  cellKey: { fontFamily: font.mono, fontSize: 7, letterSpacing: 1, color: palette.inkSoft },
  cellVal: { fontFamily: font.displayBlack, fontSize: 16, letterSpacing: -0.4, color: palette.ink, marginTop: 1 },
  cellUnit: { fontFamily: font.mono, fontSize: 8.5, color: palette.inkSoft },

  facts: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 13, paddingHorizontal: 1 },
  factLabel: { fontFamily: font.mono, fontSize: 6.5, letterSpacing: 1.1, color: palette.muted },
  factValue: { fontFamily: font.bodyBold, fontSize: 11, color: palette.ink, marginTop: 2 },

  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 13, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: palette.rule,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 999, borderWidth: 1.5, borderColor: palette.ink },
  statusLabel: { fontFamily: font.mono, fontSize: 9, color: palette.inkSoft },
  brand: { fontFamily: font.display, fontSize: 10.5, letterSpacing: -0.2, color: palette.ink },

  map: { flex: 1, position: 'relative' },
  mapImage: { opacity: 0.9 },
  realmDot: {
    position: 'absolute', width: 7, height: 7, borderRadius: 999,
    backgroundColor: palette.leaf, borderWidth: 1, borderColor: palette.ink,
    marginLeft: -3.5, marginTop: -3.5,
  },
});

export default ShareCard;
