#!/usr/bin/env python3
"""Regenerate constants/birdRanges.ts from a GBIF admin-1 occurrence summary.

Fine-grained (state/province) range data so the Add-screen bird search can lead
with species that actually occur near the user, not just the right zoogeographic
realm (which can't tell a Black-billed Magpie in Alberta from a California-only
Yellow-billed Magpie - both are Nearctic). Ships static + offline, same pattern
as iucnStatus.ts / avonet.ts.

DATA SOURCE (commercially clean, redistributable, no runtime API):
  A GBIF SQL occurrence download, aggregated server-side to admin-1 + counts:

    SELECT speciesKey, species, countryCode, stateProvince, COUNT(*) AS n
    FROM occurrence
    WHERE classKey = 212                              -- Aves
      AND license IN ('CC0_1_0', 'CC_BY_4_0')         -- excludes CC-BY-NC
      AND basisOfRecord = 'HUMAN_OBSERVATION'
      AND occurrenceStatus = 'PRESENT'
    GROUP BY speciesKey, species, countryCode, stateProvince

  Submit via POST https://api.gbif.org/v1/occurrence/download/request
  (format SQL_TSV_ZIP). The download email carries the citation DOI - paste it
  into ATTRIBUTION below. >82% of GBIF bird records are CC0/CC-BY, so the license
  filter barely dents coverage; eBird publishes to GBIF (the EOD dataset) as
  CC-BY-4.0, so its data IS included this way (unlike a direct eBird.org pull).

JOIN: GBIF's `species` column is a clean binomial; we match it to IOC v15.2
common names through constants/birdLatin.ts, direct binomial first then the same
genus-synonym recovery build-species-data.py uses. Species with no GBIF match
carry no fine data and the app falls back to realm ranking - graceful.

TIERING (a species is "Expected" in a region unless it's a true vagrant there):
  demote to non-expected iff BOTH
    - the region is < 0.5%  of the species' own records   (SP_SHARE), AND
    - the species is < 0.10% of the region's total records (REG_SHARE).
  The species-share leg protects range-restricted residents; the region-share
  leg (effort-normalized, so heavily-birded states don't inflate chased vagrants)
  protects widespread species. Validated across all ~11k species: 0 are left
  Expected nowhere. We ship only the Expected regions per species; "rare here" vs
  "out of range" is then derivable at runtime from country membership.

USAGE:
   python3 scripts/build-bird-ranges.py <gbif_summary.tsv>

Refresh cadence: re-run the GBIF download yearly-ish (ranges shift, coverage
grows) and re-run this. Update ATTRIBUTION with the new DOI.
"""
import sys, os, re, csv, json, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Paste the DOI from the GBIF download-ready email (e.g. "10.15468/dl.xxxxxx").
ATTRIBUTION = "GBIF.org (2026), GBIF Occurrence Download https://doi.org/10.15468/dl.5kx2c9"

SP_SHARE = 0.005    # region < 0.5% of the species' records ...
REG_SHARE = 0.001   # ... AND species < 0.10% of the region's records -> not expected


# ─── shared with build-species-data.py (kept identical on purpose) ────────────
def norm(s):
    """Lowercased genus + species (drop any subspecies/qualifier tokens)."""
    return ' '.join((s or '').strip().lower().split()[:2])


def load_bird_latin():
    t = open(os.path.join(ROOT, 'constants', 'birdLatin.ts')).read()
    return eval(re.search(r'BIRD_LATIN[^=]*=\s*(\{.*?\n\})', t, re.S).group(1))  # noqa: S307


def ioc_meta():
    """Return (order list, name->family)."""
    t = open(os.path.join(ROOT, 'constants', 'birdNames.ts')).read()
    order, fam, cur = [], {}, None
    for m in re.finditer(r'family:\s*"((?:[^"\\]|\\.)*)"|name:\s*"((?:[^"\\]|\\.)*)"', t):
        if m.group(1) is not None:
            cur = m.group(1)
        else:
            order.append(m.group(2)); fam[m.group(2)] = cur
    return order, fam


def genus_families(latin, fam):
    gf = defaultdict(set)
    for common, lat in latin.items():
        g = norm(lat).split(' ')[0]
        if g and common in fam:
            gf[g].add(fam[common])
    return gf


def epithet_index(norm_names):
    idx = defaultdict(set)
    for nm in norm_names:
        parts = nm.split()
        if len(parts) == 2:
            idx[parts[1]].add(nm)
    return idx


def genus_synonym(binomial, src_index, target_family, genus_fams):
    n = norm(binomial)
    parts = n.split()
    if len(parts) != 2 or len(parts[1]) < 4:
        return None
    cands = {c for c in src_index.get(parts[1], set()) if c != n}
    if len(cands) != 1:
        return None
    match = next(iter(cands))
    if target_family not in genus_fams.get(match.split(' ')[0], ()):
        return None
    return match


def _within1(a, b):
    """True if a and b differ by at most one insertion/deletion/substitution."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la == lb:                                   # one substitution
        return sum(x != y for x, y in zip(a, b)) == 1
    if la > lb:                                    # ensure a is the shorter
        a, b, la, lb = b, a, lb, la
    i = j = 0                                      # one insertion in b
    skipped = False
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1; j += 1
        elif skipped:
            return False
        else:
            skipped = True; j += 1
    return True


def fuzzy_epithet(binomial, gbif_by_genus):
    """Same genus, epithet within one edit, exactly one GBIF candidate. Catches
    IOC<->GBIF spelling/gender drift (Pica nuttallii vs nuttalli, -us vs -a). The
    genus + uniqueness guards keep it from mixing up distinct congeners."""
    parts = norm(binomial).split()
    if len(parts) != 2 or len(parts[1]) < 4:
        return None
    genus, epithet = parts
    cands = [c for c in gbif_by_genus.get(genus, {})
             if c != epithet and _within1(epithet, c)]
    if len(cands) != 1:
        return None
    return f"{genus} {cands[0]}"


# ─── region key (MUST match normProv/regionKey emitted into birdRanges.ts) ────
def norm_prov(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'\(.*?\)', '', s)
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()


def region_key(cc, prov):
    return f"{(cc or '').strip().upper()}|{norm_prov(prov)}"


# ─── build ────────────────────────────────────────────────────────────────────
def load_gbif(path):
    """Return src[binomial] = {region_key: n}, merging spelling/case variants."""
    src = defaultdict(lambda: defaultdict(int))
    with open(path, newline='') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            b = norm(row['species'])
            if len(b.split()) != 2:      # genus-only / blank rows can't be joined
                continue
            src[b][region_key(row['countrycode'], row['stateprovince'])] += int(row['n'])
    return src


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/build-bird-ranges.py <gbif_summary.tsv>")
    latin = load_bird_latin()
    order, fam = ioc_meta()
    genus_fams = genus_families(latin, fam)
    src = load_gbif(sys.argv[1])
    src_index = epithet_index(src.keys())
    gbif_by_genus = defaultdict(set)
    for b in src:
        g, e = b.split()
        gbif_by_genus[g].add(e)

    # IOC common name -> {region_key: n}: direct binomial, then genus-synonym
    # (genus rename), then fuzzy-epithet (spelling/gender drift) recovery.
    ranges = {}
    direct = recovered = fuzzy = 0
    for name in order:
        b = norm(latin.get(name, ''))
        if not b:
            continue
        if b in src:
            ranges[name] = src[b]; direct += 1
            continue
        alt = genus_synonym(latin[name], src_index, fam.get(name), genus_fams)
        if alt:
            ranges[name] = src[alt]; recovered += 1
            continue
        alt = fuzzy_epithet(latin[name], gbif_by_genus)
        if alt:
            ranges[name] = src[alt]; fuzzy += 1

    # region + species totals for the two-share tiering.
    reg_total = defaultdict(int)
    sp_total = {}
    for name, regs in ranges.items():
        sp_total[name] = sum(regs.values())
        for r, n in regs.items():
            reg_total[r] += n

    # keep only Expected regions per species.
    region_ids = {}          # region_key -> index (assigned in first-seen order)
    expected = {}            # name -> sorted [region index]
    orphans = 0
    for name, regs in ranges.items():
        tot = sp_total[name] or 1
        keep = []
        for r, n in regs.items():
            if n / tot < SP_SHARE and n / reg_total[r] < REG_SHARE:
                continue     # true vagrant here
            keep.append(region_ids.setdefault(r, len(region_ids)))
        if keep:
            expected[name] = sorted(keep)
        else:
            orphans += 1

    write_ts(region_ids, expected)
    matched = direct + recovered + fuzzy
    print(f"IOC species with range data: {matched:,} of {len(order):,} "
          f"({direct:,} direct + {recovered:,} genus-synonym + {fuzzy:,} fuzzy-epithet)")
    print(f"regions: {len(region_ids):,}   expected (species,region) pairs: "
          f"{sum(len(v) for v in expected.values()):,}")
    print(f"species left Expected nowhere: {orphans}")


def write_ts(region_ids, expected):
    out = os.path.join(ROOT, 'constants', 'birdRanges.ts')
    regions = [None] * len(region_ids)
    for r, i in region_ids.items():
        regions[i] = r
    with open(out, 'w') as f:
        f.write(
            "// Generated by scripts/build-bird-ranges.py - do not edit by hand.\n"
            "// GBIF admin-1 (state/province) bird occurrence ranges, filtered to\n"
            "// CC0/CC-BY, joined to IOC v15.2 common names via constants/birdLatin.ts.\n"
            f"// {ATTRIBUTION}\n"
            "//\n"
            "// RANGE_REGIONS[i] = \"<ISO country>|<normalized province>\". RANGE_EXPECTED\n"
            "// maps a species to the region indices where it normally occurs (vagrant\n"
            "// records already filtered out). normProv/regionKey below MUST stay in\n"
            "// step with norm_prov/region_key in the build script.\n\n"
        )
        f.write("export const RANGE_REGIONS: string[] = [\n")
        for r in regions:
            f.write(f"  {json.dumps(r)},\n")
        f.write("];\n\n")
        f.write("export const RANGE_EXPECTED: Record<string, number[]> = {\n")
        for name in expected:
            f.write(f"  {json.dumps(name)}: [{','.join(map(str, expected[name]))}],\n")
        f.write("};\n\n")
        f.write(
            "function normProv(s: string): string {\n"
            "  if (!s) return '';\n"
            "  return s\n"
            "    .normalize('NFKD')\n"
            "    .replace(/[\\u0300-\\u036f]/g, '')\n"
            "    .replace(/\\([^)]*\\)/g, '')\n"
            "    .toLowerCase()\n"
            "    .replace(/[^a-z0-9]+/g, ' ')\n"
            "    .trim();\n"
            "}\n\n"
            "export function regionKey(countryCode: string, province: string): string {\n"
            "  return `${(countryCode || '').trim().toUpperCase()}|${normProv(province)}`;\n"
            "}\n\n"
            "// Lazy indexes: region key -> its index, and species -> Set<regionIndex>.\n"
            "let _regionIdx: Map<string, number> | null = null;\n"
            "let _expected: Map<string, Set<number>> | null = null;\n"
            "function regionIndex(countryCode: string, province: string): number {\n"
            "  if (!_regionIdx) {\n"
            "    _regionIdx = new Map();\n"
            "    RANGE_REGIONS.forEach((r, i) => _regionIdx!.set(r, i));\n"
            "  }\n"
            "  const i = _regionIdx.get(regionKey(countryCode, province));\n"
            "  return i === undefined ? -1 : i;\n"
            "}\n"
            "function expectedIndex(): Map<string, Set<number>> {\n"
            "  if (!_expected) {\n"
            "    _expected = new Map();\n"
            "    for (const [name, ids] of Object.entries(RANGE_EXPECTED)) {\n"
            "      _expected.set(name, new Set(ids));\n"
            "    }\n"
            "  }\n"
            "  return _expected;\n"
            "}\n\n"
            "// True if we have any range data for this admin-1 region. When false the\n"
            "// caller can't trust admin-1 tiering here (unknown/unmatched province) and\n"
            "// should fall back to realm ranking for the whole list.\n"
            "export function hasRegion(countryCode: string, province: string): boolean {\n"
            "  return regionIndex(countryCode, province) >= 0;\n"
            "}\n\n"
            "export type RangeStatus = 'expected' | 'country' | 'elsewhere' | 'unknown';\n\n"
            "// Where does `name` sit relative to the user's admin-1 region?\n"
            "//   expected  - normally occurs in the user's state/province\n"
            "//   country   - not the user's province, but expected elsewhere in-country\n"
            "//   elsewhere - has range data, but none in the user's country (rare/out of range)\n"
            "//   unknown   - no GBIF range data for this species (fall back to realm ranking)\n"
            "export function rangeStatusFor(\n"
            "  name: string,\n"
            "  countryCode: string,\n"
            "  province: string\n"
            "): RangeStatus {\n"
            "  const ids = expectedIndex().get(name);\n"
            "  if (!ids || ids.size === 0) return 'unknown';\n"
            "  const here = regionIndex(countryCode, province);\n"
            "  if (here >= 0 && ids.has(here)) return 'expected';\n"
            "  const cc = (countryCode || '').trim().toUpperCase() + '|';\n"
            "  for (const i of ids) {\n"
            "    if (RANGE_REGIONS[i].startsWith(cc)) return 'country';\n"
            "  }\n"
            "  return 'elsewhere';\n"
            "}\n"
        )


if __name__ == '__main__':
    main()
