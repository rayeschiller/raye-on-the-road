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

/** "Saint Paul" / "St. Paul" / "st paul" all compare equal; same for Fort/Ft and Mount/Mt */
const canon = (x: string) =>
  norm(x).replace(/\./g, "").replace(/\bsaint\b/g, "st").replace(/\bsainte\b/g, "ste").replace(/\bfort\b/g, "ft").replace(/\bmount\b/g, "mt").replace(/\s+/g, " ").trim();
const CANON = CITIES.map((r) => canon(r[0]));

function scoreCities(name: string, hintRegion: string, limit: number): { p: CityRow; score: number }[] {
  const out: { p: CityRow; score: number }[] = [];
  name = canon(name);
  for (let i = 0; i < CITIES.length; i++) {
    const r = CITIES[i];
    const cn = CANON[i];
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

  // Bare state / country / placeholder answers ("florida", "US", "Canada") → needs review, never a same-named city
  const bare = norm(raw).replace(/[.,!]+$/g, "").trim();
  if (!bare || BARE_REGIONS.has(bare) || /^(test|n\/?a|none|idk|anywhere|everywhere)$/.test(bare)) return null;

  // Split multi-city answers on separators BEFORE normalising (norm() strips "/" and "&")
  const lower = raw.toLowerCase();
  if (/(^|[\s,])d\.?\s?c\.?(?=[\s,]|$)/.test(lower) && (/washington/.test(lower) || /^\s*d\.?\s?c\.?\s*$/.test(lower))) return resolveSingle("washington, dc", false);
  const pieces = lower.split(/\s*(?:\/|&|\bor\b|\band\b|;|\+)\s*/).map((x) => x.trim()).filter(Boolean);
  if (pieces.length > 1) return resolveSingle(pieces[0], true);
  // "Rochester NY, Buffalo NY, Toronto Canada" → 3+ comma parts: take the first if it's a city on its own
  const commaParts = lower.split(",").map((x) => x.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    // "City, Region, Country" (old-site format): accept a match only when its region / country actually agrees
    const [c, r] = commaParts;
    const k = commaParts[commaParts.length - 1];
    const byRegion = resolveSingle(`${c}, ${r}`, true);
    if (byRegion && norm(byRegion.region) === expandHint(norm(r))) return byRegion;
    const byCountry = resolveSingle(`${c}, ${k}`, true);
    if (byCountry && (norm(byCountry.country) === expandHint(norm(k)) || norm(byCountry.country).startsWith(norm(k)))) return byCountry;
    return resolveSingle(c, true);
  }
  return resolveSingle(raw, false);
}

const BARE_REGIONS = new Set<string>([
  ...Object.keys(US_ABBR),
  ...Object.values(US_ABBR).map((x) => norm(x)),
  "us", "usa", "u.s.", "u.s.a.", "united states", "america", "uk", "england", "canada", "australia", "mexico", "europe",
  "france", "germany", "spain", "italy", "israel", "ireland", "scotland", "netherlands", "japan", "brazil", "india",
]);
// every country name in the city index ("denmark", "portugal", …)
for (const r of CITIES) BARE_REGIONS.add(norm(r[2]));

function resolveSingle(text: string, strictFirst: boolean): Place | null {
  let n = norm(text.replace(/\.\s+(?=[A-Za-z]{2}\s*$)/, ", "))
    .replace(/<3|:\)|;\)|:d/g, " ")
    .replace(/\(.*?\)/g, " ")
    // leading country tag: "US Portland maine", "USA - Austin"
    .replace(/^(us|usa|u\.s\.?|united states)\b[\s,.-]*/, "")
    // stray standalone numbers ("rochester 3") unless the whole thing is a zip
    .replace(/(^|\s)\d{1,4}(?=\s|$)/g, " ")
    .replace(/\b(please|pls|plz|thanks|thank you|would love|i'?ll travel|come to|come|visit|area|county)\b/g, " ")
    .replace(/[!?]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();
  if (!n || /^\d{5}$/.test(n)) return null; // zip codes → review
  if (BARE_REGIONS.has(n)) return null;

  // "Denmark, Copenhagen" → swap when the first part is a country/state and the second a city
  const parts = n.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length === 2 && BARE_REGIONS.has(parts[0]) && !BARE_REGIONS.has(parts[1])) n = `${parts[1]}, ${parts[0]}`;

  const hits = searchCities(n, 3);
  if (!hits.length) return null;
  const top = hits[0];
  const cityPart = n.split(",")[0].trim();
  const alias = ALIASES[cityPart];
  if (alias && norm(alias) === norm(top.city)) return top;
  if (canon(top.city) === canon(cityPart)) return top;
  // "seattle wa" / "portland maine": the split candidate's name matches exactly
  if (splitQuery(n).some((c) => c.hint && canon(top.city) === canon(c.name))) return top;
  if (strictFirst) return null;
  // Accept a prefix match only if it's unambiguous
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
