import { resolveLocation, seededCenter } from "./geo";
import { loadState, updateState, storageMode } from "./store";
import { fetchWixPeople, wixConfigured } from "./wix";
import type { Person, Place, StoreState, WixPerson } from "./types";

const WIX_TTL_MS = 60_000;
let wixMemo: { at: number; people: WixPerson[] } | null = null;

export type DataStatus = {
  wix: { configured: boolean; live: boolean; fetchedAt: string | null; count: number; error: string | null };
  beacons: { count: number };
  storage: "supabase" | "local";
  resend: { configured: boolean; sender: string | null };
};

async function getWixPeople(force: boolean): Promise<{ people: WixPerson[]; live: boolean; fetchedAt: string | null; error: string | null }> {
  if (!wixConfigured()) {
    const s = await loadState();
    return { people: s.wixSnapshot?.people || [], live: false, fetchedAt: s.wixSnapshot?.fetchedAt || null, error: "Wix not connected" };
  }
  if (!force && wixMemo && Date.now() - wixMemo.at < WIX_TTL_MS) {
    return { people: wixMemo.people, live: true, fetchedAt: new Date(wixMemo.at).toISOString(), error: null };
  }
  try {
    const people = await fetchWixPeople();
    wixMemo = { at: Date.now(), people };
    const fetchedAt = new Date().toISOString();
    // Keep a snapshot so the site still works if Wix is down
    updateState((s) => {
      s.wixSnapshot = { fetchedAt, people };
    }).catch(() => {});
    return { people, live: true, fetchedAt, error: null };
  } catch (e) {
    const s = await loadState();
    return { people: s.wixSnapshot?.people || [], live: false, fetchedAt: s.wixSnapshot?.fetchedAt || null, error: (e as Error).message };
  }
}

function applyPlace(p: Person, place: Place | null, kind: Person["locationKind"]) {
  if (!place) return;
  p.city = place.city;
  p.region = place.region;
  p.country = place.country;
  p.lat = place.lat;
  p.lon = place.lon;
  p.locationKind = kind;
  p.needsLocation = null;
}

export async function buildPeople(opts: { force?: boolean } = {}): Promise<{ people: Person[]; status: DataStatus; state: StoreState }> {
  const [state, wix] = await Promise.all([loadState(), getWixPeople(Boolean(opts.force))]);
  const unsub = new Set(state.overrides.unsubscribed.map((e) => e.toLowerCase()));
  const excluded = new Set(state.overrides.excluded.map((e) => e.toLowerCase()));
  const byEmail = new Map<string, Person>();

  // Beacons (one-time import)
  for (const b of state.beacons) {
    const email = b.email.toLowerCase();
    if (!email || excluded.has(email)) continue;
    const p: Person = {
      email,
      firstName: b.firstName,
      lastName: b.lastName,
      city: b.city,
      region: b.region,
      country: b.country,
      lat: b.lat,
      lon: b.lon,
      rawLocation: b.rawLocation || [b.city, b.region, b.country].filter(Boolean).join(", "),
      locationKind: b.lat ? "recorded" : "none",
      sources: ["beacons"],
      wixStatus: null,
      beaconsStatus: b.status,
      siteUnsubscribed: unsub.has(email),
      emailEligible: false,
      createdAt: null,
      needsLocation: b.lat ? null : b.city || b.country ? "Could not place this location" : "No location in Beacons",
    };
    if (!p.lat && p.city) {
      const c = seededCenter(p.city, p.region, p.country);
      if (c) applyPlace(p, { city: p.city, region: p.region, country: p.country, lat: c[0], lon: c[1] }, "recorded");
    }
    byEmail.set(email, p);
  }

  // Wix (live) — requested cities win over recorded ones
  for (const w of wix.people) {
    const email = w.email.toLowerCase();
    if (!email || excluded.has(email)) continue;
    const existing = byEmail.get(email);
    const p: Person =
      existing ||
      ({
        email,
        firstName: "",
        lastName: "",
        city: "",
        region: "",
        country: "",
        lat: null,
        lon: null,
        rawLocation: "",
        locationKind: "none",
        sources: [],
        wixStatus: null,
        beaconsStatus: null,
        siteUnsubscribed: unsub.has(email),
        emailEligible: false,
        createdAt: null,
        needsLocation: null,
      } as Person);
    if (!p.sources.includes("wix")) p.sources.push("wix");
    p.firstName = p.firstName || w.firstName;
    p.lastName = p.lastName || w.lastName;
    p.wixStatus = w.subscriptionStatus;
    p.createdAt = w.createdAt || p.createdAt;
    if (w.cityAnswer) {
      p.rawLocation = w.cityAnswer;
      const place = resolveLocation(w.cityAnswer);
      if (place) applyPlace(p, place, "requested");
      else if (p.locationKind !== "recorded") {
        p.locationKind = "none";
        p.lat = null;
        p.lon = null;
        p.city = "";
        p.region = "";
        p.country = "";
        p.needsLocation = "City unclear or multiple cities";
      }
    } else if (!existing) {
      p.needsLocation = "No city answer on the Wix form";
    }
    byEmail.set(email, p);
  }

  // Manual fixes
  for (const p of byEmail.values()) {
    const rawKey = (p.rawLocation || "").trim().toLowerCase();
    const fix = state.overrides.emailFixes[p.email] || (rawKey && state.overrides.rawFixes[rawKey]);
    if (fix) applyPlace(p, fix, p.sources.includes("wix") && p.rawLocation ? "requested" : "recorded");
    const wixOk = p.wixStatus === null ? true : p.wixStatus !== "UNSUBSCRIBED";
    const beaconsOk = p.beaconsStatus === null ? true : p.beaconsStatus === "Subscribed";
    p.emailEligible = !p.siteUnsubscribed && wixOk && beaconsOk;
  }

  const people = [...byEmail.values()].sort((a, b) => (a.city || "zz").localeCompare(b.city || "zz") || a.email.localeCompare(b.email));
  const status: DataStatus = {
    wix: { configured: wixConfigured(), live: wix.live, fetchedAt: wix.fetchedAt, count: wix.people.length, error: wix.error },
    beacons: { count: state.beacons.length },
    storage: storageMode(),
    resend: { configured: Boolean(process.env.RESEND_API_KEY), sender: (process.env.EMAIL_FROM || "Raye Schiller <hello@rayeschiller.com>") || null },
  };
  return { people, status, state };
}
