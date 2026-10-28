import cities from "./seed/cities.json";
import geoSeed from "./seed/geo.json";
import rawSeed from "./seed/raw.json";
import type { Place } from "./types";

type CityRow = [string, string, string, string, number, number, number];
const CITIES = cities as unknown as CityRow[];

const US_ABBR: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California", co: "Colorado", ct: "Connecticut",
  de: "Delaware", dc: "Washington, D.C.", fl: "Florida", ga: "Georgia", hi: "Hawaii", id: "Idaho", il: "Illinois",
  in: "Indiana", ia: "Iowa", ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi", mo: "Missouri", mt: "Montana",
  ne: "Nebraska", nv: "Nevada", nh: "New Hampshire", nj: "New Jersey", nm: "New Mexico", ny: "New York",
  nc: "North Carolina", nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee", tx: "Texas", ut: "Utah",
  vt: "Vermont", va: "Virginia", wa: "Washington", wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming",
};

const ALIASES: Record<string, string> = {
  nyc: "New York City", "new york": "New York City", "new york, ny": "New York City", manhattan: "New York City",
  bk: "Brooklyn", la: "Los Angeles", "l.a.": "Los Angeles", sf: "San Francisco", philly: "Philadelphia",
  dc: "Washington", "washington dc": "Washington", "washington d.c.": "Washington", chi: "Chicago", atl: "Atlanta",
  "the bay": "San Francisco", "bay area": "San Francisco", "slc": "Salt Lake City", "pdx": "Portland",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9,.' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function rowToPlace(r: CityRow): Place {
  return { city: r[0], region: r[1], country: r[2], lat: r[4], lon: r[5] };
}

const COUNTRY_ALIAS: Record<string, string> = {
  usa: "united states", us: "united states", "u.s.": "united states", "u.s.a.": "united states", america: "united states",
  uk: "united kingdom", "u.k.": "united kingdom", england: "england", britain: "united kingdom",
  mx: "mexico", ca: "canada", au: "australia", nz: "new zealand", il: "israel", de: "germany", fr: "france", es: "spain",
};

function expandHint(h: string) {
  if (!h) return "";
  if (US_ABBR[h]) return norm(US_ABBR[h]);
  if (COUNTRY_ALIAS[h]) return COUNTRY_ALIAS[h];
  return h;
}

function scoreCities(name: string, hintRegion: string, limit: number): { p: CityRow; score: number }[] {
  const out: { p: CityRow; score: number }[] = [];
  for (const r of CITIES) {
    const cn = norm(r[0]);
    let score = 0;
    if (cn === name) score = 100;
    else if (cn.startsWith(name)) score = 60;
    else continue;
    if (hintRegion) {
      const reg = norm(r[1]);
      const ctry = norm(r[2]);
      if (reg === hintRegion || ctry === hintRegion || norm(r[3]) === hintRegion) score += 50;
      else if (reg.startsWith(hintRegion) || ctry.startsWith(hintRegion)) score += 25;
      else score -= 30;
    }
    if (r[3] === "US") score += 2;
    score += Math.min(42, Math.log10(r[6] + 1) * 6);
    out.push({ p: r, score });
    if (out.length > 4000) break;
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Split "city, hint" or "city hint" (e.g. "seattle wa", "portland maine", "london uk") into name + region/country hint. */
function splitQuery(n: string): { name: string; hint: string }[] {
  const parts = n.split(",").map((p) => p.trim()).filter(Boolean);
  const alias = (x: string) => (ALIASES[x] ? norm(ALIASES[x]) : x);
  const cands: { name: string; hint: string }[] = [{ name: alias(parts[0]), hint: expandHint(parts.slice(1).join(" ")) }];
  if (parts.length === 1) {
    const words = parts[0].split(" ");
    for (let k = 1; k <= 2 && words.length - k >= 1; k++) {
      const name = words.slice(0, words.length - k).join(" ");
      const hint = words.slice(words.length - k).join(" ");
      const exp = expandHint(hint);
      // Only treat the tail as a hint if it's a known state/country alias or a full region/country name
      if (exp !== hint || KNOWN_REGIONS.has(hint)) cands.push({ name: alias(name), hint: exp });
    }
  }
  return cands;
}

const KNOWN_REGIONS = new Set<string>();
for (const r of CITIES) {
  if (r[1]) KNOWN_REGIONS.add(norm(r[1]));
  KNOWN_REGIONS.add(norm(r[2]));
}

/** Search the city index. Prefers bigger cities and US matches; region/country hints narrow it. */
export function searchCities(q: string, limit = 8): Place[] {
  const n = norm(q);
  if (!n) return [];
  const seen = new Set<string>();
  const merged: { p: CityRow; score: number }[] = [];
  for (const c of splitQuery(n)) {
    for (const hit of scoreCities(c.name, c.hint, limit)) {
      const k = `${hit.p[0]}|${hit.p[1]}|${hit.p[2]}`;
      if (seen.has(k)) continue;
      seen.add(k);
      // exact-name matches via a hint split rank above prefix matches of the full string
      merged.push({ p: hit.p, score: hit.score + (c.hint ? 5 : 0) });
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit).map((o) => rowToPlace(o.p));
}

const GEO = geoSeed as unknown as Record<string, [number, number]>;
const RAW = rawSeed as unknown as Record<string, [string, string, string, number, number]>;

/** Resolve a free-text location answer to a city center. Returns null if ambiguous/unknown. */
export function resolveLocation(raw: string): Place | null {
  const key = (raw || "").trim().toLowerCase();
  if (!key) return null;
  const seeded = RAW[key];
  if (seeded) {
    const nr = (x: string) => (x === "Not recorded" ? "" : x);
    return { city: seeded[0], region: nr(seeded[1]), country: nr(seeded[2]), lat: seeded[3], lon: seeded[4] };
  }

  const n = norm(raw);
  // Multiple cities ("NYC or LA", "Boston / Providence") -> needs review
  if (/\b(or|and)\b|\/|&/.test(n) && n.split(/\b(?:or|and)\b|\/|&/).length > 1) {
    const first = n.split(/\b(?:or|and)\b|\/|&/)[0].trim();
    // Only accept if the first part alone is an exact well-known city
    const hits = searchCities(first, 1);
    if (hits.length && norm(hits[0].city) === norm(first.split(",")[0])) return hits[0];
    return null;
  }
  // Strip trailing chatter: "Boston please!!", "Denver :)"
  const cleaned = n.replace(/\b(please|pls|plz|thanks|thank you|would love|come to|come|visit|area)\b/g, " ").replace(/\s+/g, " ").trim();
  const hits = searchCities(cleaned, 3);
  if (!hits.length) return null;
  const top = hits[0];
  const cityPart = cleaned.split(",")[0].trim();
  const alias = ALIASES[cityPart];
  if (alias && norm(alias) === norm(top.city)) return top;
  if (norm(top.city) === cityPart) return top;
  // "seattle wa" / "portland maine": the split candidate's name matches exactly
  if (splitQuery(cleaned).some((c) => c.hint && norm(top.city) === c.name)) return top;
  // Accept a prefix match only if it's unambiguous (second hit is a different name with much lower pop)
  if (norm(top.city).startsWith(cityPart) && cityPart.length >= 5 && (!hits[1] || norm(hits[1].city) !== norm(top.city))) return top;
  return null;
}

/** Look up a previously geocoded (city, region, country) from the seed cache. */
export function seededCenter(city: string, region: string, country: string): [number, number] | null {
  const k = `${city}|${region || "Not recorded"}|${country || "Not recorded"}`;
  return GEO[k] || null;
}

export function distanceMiles(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
