import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { avonetFor, Migration } from '../../constants/avonet';
import { regionsFor, REGION_LABELS, RegionCode } from '../../constants/birdNames';
import { font, palette, radius, space, STATUS_LABEL, STATUS_VISUAL } from '../../constants/Colors';
import { statusFor } from '../../constants/iucnStatus';
import { wikiBlurbFor } from '../../constants/wikiBlurbs';
import { getWikiBlurb, WikiBlurb } from '../../app/services/wikiService';
import { HardShadow } from '../SightingCard';

// The Guide tab — licensed open data only (AVONET morphology, IUCN status via
// Wikidata, Wikipedia description, the app's eight realms). Order leads with
// range: Where it lives -> Description -> Measurements -> Conservation.

// Approximate realm positions over the equirectangular map (percent x/y).
const REALM_POS: Record<RegionCode, { x: number; y: number }> = {
  NA: { x: 22.2, y: 23.3 }, MA: { x: 25.6, y: 40.6 }, SA: { x: 33.9, y: 56.7 },
  PAL: { x: 62.5, y: 21.1 }, AF: { x: 55.6, y: 48.9 }, OR: { x: 76.4, y: 40.0 },
  AU: { x: 87.2, y: 63.9 }, OC: { x: 94.4, y: 52.8 },
};

const MIGRATION_BLURB: Record<Migration, string> = {
  sedentary: 'Stays put year-round.',
  partial: 'Some move, some stay.',
  migratory: 'Whole population shifts seasonally.',
};
const MIGRATION_LABEL: Record<Migration, string> = {
  sedentary: 'Sedentary', partial: 'Partial', migratory: 'Migratory',
};
const MIGRATION_ORDER: Migration[] = ['sedentary', 'partial', 'migratory'];

export default function SpeciesGuide({ name, latin }: { name: string; latin: string }) {
  const av = avonetFor(name);
  const status = statusFor(name);
  const realms = regionsFor(name);

  return (
    <View style={styles.body}>
      {/* 1. Where it lives */}
      <SectionLabel>Where it lives</SectionLabel>
      <View style={styles.mapCard}>
        <RealmWorld realms={realms} />
        <View style={styles.realmList}>
          {realms.map(r => (
            <View key={r} style={styles.realmRow}>
              <View style={styles.realmCheck}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
              <Text style={styles.realmName}>{REGION_LABELS[r]}</Text>
              <Text style={styles.realmCode}>{r}</Text>
            </View>
          ))}
          {realms.length === 0 && (
            <Text style={styles.realmEmpty}>Range not recorded for this species.</Text>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.migrateHeader}>
          <Ionicons name="swap-horizontal" size={14} color={palette.leaf} />
          <Text style={styles.migrateTitle}>Migration</Text>
        </View>
        <MigrationIndicator migration={av?.migration ?? null} />
      </View>

      {/* 2. Description */}
      <SectionLabel style={styles.sectionGap}>Description</SectionLabel>
      <WikiCard name={name} latin={latin} />

      {/* 3. Measurements */}
      <SectionLabel style={styles.sectionGap}>Measurements</SectionLabel>
      <View style={styles.statRow}>
        <StatCell icon="scale-outline" label="Body mass" value={av?.mass ?? null} unit="g" sub="typical adult" />
        <StatCell icon="resize-outline" label="Wing chord" value={av?.wingChord ?? null} unit="mm" sub="folded wing" />
      </View>
      <View style={styles.chipRow}>
        <FactChip icon="leaf-outline" label="Habitat" value={av?.habitat ?? null} tint={palette.leafSoft} />
        <FactChip icon="nutrition-outline" label="Diet" value={av?.diet ?? null} tint={palette.sunSoft} />
      </View>

      {/* 4. Conservation */}
      <SectionLabel style={styles.sectionGap}>Conservation</SectionLabel>
      <HardShadow offset={3} borderRadius={radius.card}>
        <View style={styles.statusCard}>
          <View style={[styles.statusStrip, { backgroundColor: STATUS_VISUAL[status].bg }]}>
            <Text style={[styles.statusText, { color: STATUS_VISUAL[status].fg }]}>
              {status} · {STATUS_LABEL[status]}
            </Text>
            <Text style={[styles.statusText, { color: STATUS_VISUAL[status].fg, opacity: 0.7 }]}>IUCN</Text>
          </View>
        </View>
      </HardShadow>

      {/* 5. Credit line */}
      <Text style={styles.credit}>
        Measurements: AVONET (CC BY 4.0). Status: IUCN via Wikidata. Description: Wikipedia (CC BY-SA) · en.wikipedia.org
      </Text>
      <View style={{ height: space.xxl }} />
    </View>
  );
}

// ─── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

// ─── Description — bundled Wikipedia intro (offline), Wikipedia text is CC BY-SA.
// Almost every IOC species ships its intro in the app, so this renders instantly
// offline. The handful not bundled (custom / newly split names) fall back to a
// live fetch + cache when online, and otherwise show the dashed empty card.
function WikiCard({ name, latin }: { name: string; latin: string }) {
  const bundled = wikiBlurbFor(name);
  const [blurb, setBlurb] = useState<WikiBlurb>(
    bundled != null ? { text: bundled, loaded: true } : { text: null, loaded: false }
  );
  useEffect(() => {
    if (bundled != null) {
      setBlurb({ text: bundled, loaded: true });
      return;
    }
    let cancelled = false;
    setBlurb({ text: null, loaded: false });
    getWikiBlurb(name, latin).then(b => { if (!cancelled) setBlurb(b); });
    return () => { cancelled = true; };
  }, [name, latin, bundled]);

  if (!blurb.loaded) {
    return (
      <View style={styles.wikiCardLoading}>
        <ActivityIndicator color={palette.leaf} />
      </View>
    );
  }
  if (blurb.text == null) {
    return (
      <View style={styles.wikiCardEmpty}>
        <Text style={styles.wikiEmptyText}>
          No write-up for this species yet. We&apos;ll tuck one in when Wikipedia has an article — the facts above are always on your phone.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.wikiCard}>
      <Text style={styles.wikiText}>{blurb.text}</Text>
    </View>
  );
}

// ─── Measurement cell — value or graceful "—  / not in AVONET" ───────────────
function StatCell({ icon, label, value, unit, sub }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: number | null; unit: string; sub: string;
}) {
  const missing = value == null;
  return (
    <View style={styles.statCell}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={14} color={missing ? palette.muted : palette.leaf} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, missing && styles.statValueMissing]}>{missing ? '—' : value}</Text>
        {!missing && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      <Text style={[styles.statSub, missing && styles.statSubMissing]}>{missing ? 'not in AVONET' : sub}</Text>
    </View>
  );
}

// ─── Fact chip — habitat / diet ──────────────────────────────────────────────
function FactChip({ icon, label, value, tint }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null; tint: string;
}) {
  const missing = value == null;
  return (
    <View style={[styles.factChip, { backgroundColor: missing ? palette.card : tint }]}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={14} color={missing ? palette.muted : palette.ink} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.factValue, missing && styles.factValueMissing]}>{missing ? 'Not in AVONET' : value}</Text>
    </View>
  );
}

// ─── World map — realm pins over the equirectangular plate ───────────────────
function RealmWorld({ realms }: { realms: RegionCode[] }) {
  return (
    <ImageBackground
      source={require('../../assets/images/world-equirect.png')}
      style={styles.map}
      imageStyle={styles.mapImage}
      resizeMode="stretch"
    >
      {realms.map(r => {
        const p = REALM_POS[r];
        return (
          <View key={r} style={[styles.pin, { left: `${p.x}%`, top: `${p.y}%` }]}>
            <Text style={styles.pinText}>{r}</Text>
          </View>
        );
      })}
    </ImageBackground>
  );
}

// ─── Migration — 3-state indicator ───────────────────────────────────────────
function MigrationIndicator({ migration }: { migration: Migration | null }) {
  return (
    <View>
      <View style={styles.migRow}>
        {MIGRATION_ORDER.map(k => {
          const on = migration === k;
          return (
            <View key={k} style={[styles.migCell, on && styles.migCellOn]}>
              <Text style={[styles.migCellText, on && styles.migCellTextOn]}>{MIGRATION_LABEL[k]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.migBlurb}>
        {migration ? MIGRATION_BLURB[migration] : 'Migration not recorded in AVONET.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.md },
  sectionGap: { marginTop: space.lg },
  sectionLabel: {
    fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: palette.inkSoft, marginBottom: space.sm,
  },

  // Description
  wikiCard: { backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.ink, borderRadius: radius.card, padding: space.lg },
  wikiText: { fontFamily: font.body, fontSize: 13, color: palette.ink, lineHeight: 19.5 },
  wikiCardEmpty: {
    backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.ink,
    borderStyle: 'dashed', borderRadius: radius.chip, paddingVertical: 11, paddingHorizontal: 13,
  },
  wikiEmptyText: { fontFamily: font.body, fontSize: 12.5, color: palette.inkSoft, lineHeight: 18 },
  wikiCardLoading: {
    backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.ink,
    borderRadius: radius.card, padding: space.lg, alignItems: 'center',
  },

  // Measurements
  statRow: { flexDirection: 'row', gap: 8 },
  statCell: {
    flex: 1, backgroundColor: palette.card, borderWidth: 2, borderColor: palette.ink,
    borderRadius: radius.chip, paddingVertical: 10, paddingHorizontal: 12,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: {
    fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 0.7,
    textTransform: 'uppercase', color: palette.inkSoft,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 3 },
  statValue: { fontFamily: font.displayBlack, fontSize: 24, letterSpacing: -0.7, color: palette.ink },
  statValueMissing: { color: palette.muted },
  statUnit: { fontFamily: font.mono, fontSize: 11, color: palette.inkSoft },
  statSub: { fontFamily: font.mono, fontSize: 8.5, color: palette.inkSoft, marginTop: 1 },
  statSubMissing: { color: palette.muted },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  factChip: { flex: 1, borderWidth: 1.5, borderColor: palette.ink, borderRadius: radius.chip, paddingVertical: 8, paddingHorizontal: 10 },
  factValue: { fontFamily: font.bodyBold, fontSize: 13.5, color: palette.ink, marginTop: 3 },
  factValueMissing: { color: palette.muted },

  // Conservation
  statusCard: { backgroundColor: palette.card, borderWidth: 2, borderColor: palette.ink, borderRadius: radius.card, overflow: 'hidden' },
  statusStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12 },
  statusText: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Where it lives
  mapCard: { backgroundColor: palette.card, borderWidth: 2, borderColor: palette.ink, borderRadius: radius.card, padding: space.lg },
  map: { width: '100%', height: 168, backgroundColor: '#e7ecdd' },
  mapImage: { borderRadius: radius.chip, borderWidth: 2, borderColor: palette.ink },
  pin: {
    position: 'absolute', width: 24, height: 24, marginLeft: -12, marginTop: -12,
    borderRadius: radius.pill, backgroundColor: palette.leaf, borderWidth: 2, borderColor: palette.ink,
    alignItems: 'center', justifyContent: 'center', boxShadow: `2px 2px 0 ${palette.ink}`,
  },
  pinText: { fontFamily: font.monoBold, fontSize: 8.5, color: '#fff' },

  realmList: { marginTop: space.md, gap: 6 },
  realmRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  realmCheck: { width: 18, height: 18, borderRadius: radius.pill, backgroundColor: palette.leaf, alignItems: 'center', justifyContent: 'center' },
  realmName: { fontFamily: font.bodyBold, fontSize: 13.5, color: palette.ink },
  realmCode: { fontFamily: font.mono, fontSize: 9, color: palette.muted, marginLeft: 'auto' },
  realmEmpty: { fontFamily: font.body, fontSize: 12.5, color: palette.inkSoft },

  divider: { height: 1, backgroundColor: palette.rule, marginVertical: space.md },
  migrateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  migrateTitle: { fontFamily: font.bodyBold, fontSize: 12.5, color: palette.ink },
  migRow: { flexDirection: 'row', gap: 4 },
  migCell: {
    flex: 1, alignItems: 'center', backgroundColor: palette.card, borderWidth: 1.5,
    borderColor: palette.rule, borderRadius: 7, paddingVertical: 6,
  },
  migCellOn: { backgroundColor: palette.leaf, borderColor: palette.leaf },
  migCellText: { fontFamily: font.bodyBold, fontSize: 11, color: palette.muted },
  migCellTextOn: { color: '#fff' },
  migBlurb: { fontFamily: font.mono, fontSize: 9, color: palette.inkSoft, marginTop: 6 },

  // Credit
  credit: { fontFamily: font.mono, fontSize: 9, color: palette.muted, lineHeight: 13.5, marginTop: space.lg },
});
