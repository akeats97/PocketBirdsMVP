#!/usr/bin/env python3
"""Pre-bundle Wikipedia intro text for every IOC species → constants/wikiBlurbs.ts.

The species Guide's Description must work fully offline, so we ship the
Wikipedia intro ("extract") for each species in the app bundle rather than
fetching at runtime. Text is CC BY-SA; attribution lives in the Guide credit
line. Species with no English article are simply absent (the Guide shows its
dashed empty card).

Uses the MediaWiki Action API with batched titles (20 per request) so the whole
list is ~560 polite, single-threaded requests with backoff — gentle on
Wikimedia's rate limits (the per-page REST endpoint gets you 429'd fast).

Resumable: progress is written to scripts/.wiki-cache.json after every batch, so
re-running only fetches names still missing. Run again any time to refresh.

USAGE:  python3 scripts/build-wiki-blurbs.py
"""
import re, json, os, time, urllib.request, urllib.parse, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.wiki-cache.json')
OUT = os.path.join(ROOT, 'constants', 'wikiBlurbs.ts')
UA = "PocketBirdsGuide/1.0 (akeats97@gmail.com) one-time offline species-guide build"
MAX_LEN = 800       # extracts average ~280 chars; cap long intros at a sentence
BATCH = 20          # Action API extracts: up to 20 per request (exlimit=max)
PAUSE = 0.4         # polite gap between requests


def ioc_names():
    return re.findall(r'name:\s*"((?:[^"\\]|\\.)*)"',
                      open(os.path.join(ROOT, 'constants', 'birdNames.ts')).read())


def bird_latin():
    t = open(os.path.join(ROOT, 'constants', 'birdLatin.ts')).read()
    return eval(re.search(r'BIRD_LATIN[^=]*=\s*(\{.*?\n\})', t, re.S).group(1))


def cap(text):
    if len(text) <= MAX_LEN:
        return text
    cut = text[:MAX_LEN]
    dot = cut.rfind('. ')
    return cut[:dot + 1] if dot > MAX_LEN * 0.5 else cut.rstrip() + '…'


def api_get(titles):
    """Query a batch of titles. Returns {requested_title: extract|None}, or None on hard failure."""
    params = {
        "action": "query", "format": "json", "prop": "extracts",
        "exintro": 1, "explaintext": 1, "redirects": 1, "exlimit": "max",
        "titles": "|".join(titles),
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    backoff = 30
    for _ in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"  429 throttled — sleeping {backoff}s")
                time.sleep(backoff)
                backoff = min(backoff * 2, 300)
                continue
            return None
        except Exception:
            time.sleep(5)
            continue
    else:
        return None

    q = d.get("query", {})
    # Map each requested title through normalization + redirects to its final title.
    chain = {}
    for n in q.get("normalized", []):
        chain[n["from"]] = n["to"]
    for rd in q.get("redirects", []):
        chain[rd["from"]] = rd["to"]

    def final(t):
        seen = set()
        while t in chain and t not in seen:
            seen.add(t); t = chain[t]
        return t

    by_title = {p["title"]: (p.get("extract") or "").strip() for p in q.get("pages", {}).values()}
    out = {}
    for t in titles:
        ex = by_title.get(final(t), "")
        out[t] = cap(ex) if ex else None
    return out


def run_pass(todo, cache, latin=None):
    """Fetch `todo` in batches; write text/'' to cache. Returns names still unresolved."""
    still = []
    done = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        res = api_get(batch)
        if res is None:
            still.extend(batch)
        else:
            for name in batch:
                ex = res[name]
                if ex is None and latin and latin.get(name) and latin[name] != name:
                    still.append(name)         # retry via Latin in the fallback pass
                else:
                    cache[name] = ex or ""     # "" = confirmed no article
        done += len(batch)
        if done % 200 == 0:
            json.dump(cache, open(CACHE, 'w'))
            print(f"  {done}/{len(todo)} done ({len(still)} deferred)")
        time.sleep(PAUSE)
    json.dump(cache, open(CACHE, 'w'))
    return still


def main():
    names = ioc_names()
    latin = bird_latin()
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    todo = [n for n in names if n not in cache]
    print(f"{len(names)} species; {len(cache)} cached; {len(todo)} to fetch by common name")

    # Pass 1: common name (defer the misses that have a binomial).
    deferred = run_pass(todo, cache, latin=latin)
    print(f"common-name pass done; {len(deferred)} to try by Latin name")

    # Pass 2: Latin-name lookup for the deferred misses (the common name had no
    # article, but the binomial often does).
    for i in range(0, len(deferred), BATCH):
        batch = deferred[i:i + BATCH]
        lat_titles = [latin[n] for n in batch]
        res = api_get(lat_titles)
        for n, lt in zip(batch, lat_titles):
            ex = res.get(lt) if res else None
            cache[n] = ex or ""        # "" = confirmed no article either way
        time.sleep(PAUSE)
    json.dump(cache, open(CACHE, 'w'))

    write_ts(names, cache)


def write_ts(names, cache):
    have = {n: cache[n] for n in names if cache.get(n)}
    with open(OUT, 'w') as f:
        f.write(
            "// Generated by scripts/build-wiki-blurbs.py - do not edit by hand.\n"
            "// Wikipedia intro text (MediaWiki extracts) per IOC v15.2 species,\n"
            "// bundled so the species Guide Description works fully offline.\n"
            "// Text is CC BY-SA (en.wikipedia.org) - attributed on the Guide credit line.\n"
            f"// {len(have)} of {len(names)} species have an article; the rest show the\n"
            "// dashed empty card. Refresh: re-run scripts/build-wiki-blurbs.py.\n\n"
            "const WIKI_BLURBS: Record<string, string> = {\n")
        for n in names:
            if cache.get(n):
                f.write(f"  {json.dumps(n)}: {json.dumps(cache[n], ensure_ascii=False)},\n")
        f.write(
            "};\n\n"
            "// Bundled Wikipedia intro for a species by IOC common name, or null when\n"
            "// no article was bundled (drives the Guide's dashed empty card).\n"
            "export function wikiBlurbFor(name: string): string | null {\n"
            "  return WIKI_BLURBS[name] ?? null;\n"
            "}\n\n"
            "export default WIKI_BLURBS;\n")
    print(f"wrote {OUT}: {len(have)} entries, {os.path.getsize(OUT)/1e6:.2f} MB")


if __name__ == '__main__':
    main()
