import { buildPeople } from "./people";

export type ShareCity = { city: string; region: string; country: string; pct: number; bar: number };

/** Aggregated, anonymous city shares. Cities with fewer than MIN people are folded into "Everywhere else" so nobody is identifiable. */
export async function getShare(): Promise<{ cities: ShareCity[]; other: number; countries: number; updatedAt: string }> {
  const MIN = 3;
  const { people } = await buildPeople();
  const located = people.filter((p) => p.lat != null && p.city);
  const total = located.length || 1;
  const m = new Map<string, { city: string; region: string; country: string; n: number }>();
  for (const p of located) {
    const k = `${p.city}|${p.region}|${p.country}`;
    const e = m.get(k) || { city: p.city, region: p.region, country: p.country, n: 0 };
    e.n++;
    m.set(k, e);
  }
  const all = [...m.values()].sort((a, b) => b.n - a.n);
  const shown = all.filter((c) => c.n >= MIN).slice(0, 25);
  const shownN = shown.reduce((a, c) => a + c.n, 0);
  const max = shown[0]?.n || 1;
  return {
    cities: shown.map((c) => ({ city: c.city, region: c.region, country: c.country, pct: Math.round((c.n / total) * 1000) / 10, bar: Math.round((c.n / max) * 100) })),
    other: Math.round(((total - shownN) / total) * 1000) / 10,
    countries: new Set(located.map((p) => p.country).filter(Boolean)).size,
    updatedAt: new Date().toISOString(),
  };
}
