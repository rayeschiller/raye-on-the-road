import { promises as fs } from "node:fs";
import path from "node:path";
import type { StoreState, BeaconsPerson } from "./types";

/**
 * Persistent JSON state: one row in a Supabase `kv` table (free tier) when
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set; otherwise ./data/state.json locally.
 *
 *   create table rotr_kv (key text primary key, value jsonb not null, updated_at timestamptz default now());
 */

const KEY = "raye-on-the-road";
const LOCAL_PATH = path.join(process.cwd(), "data", "state.json");

function emptyState(): StoreState {
  return {
    overrides: { rawFixes: {}, emailFixes: {}, unsubscribed: [], excluded: [] },
    campaigns: [],
    beacons: [] as BeaconsPerson[],
    wixSnapshot: null,
    legacyAnswers: {},
  };
}

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function storageMode(): "supabase" | "local" {
  return supabase() ? "supabase" : "local";
}

let memo: { state: StoreState; at: number } | null = null;

export async function loadState(): Promise<StoreState> {
  if (memo && Date.now() - memo.at < 5000) return memo.state;
  let state: StoreState | null = null;
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/rotr_kv?select=value&key=eq.${KEY}`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase read failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as { value: StoreState }[];
    state = rows[0]?.value ?? null;
  } else {
    try {
      state = JSON.parse(await fs.readFile(LOCAL_PATH, "utf8")) as StoreState;
    } catch {
      state = null;
    }
  }
  const merged = { ...emptyState(), ...(state || {}) };
  merged.overrides = { ...emptyState().overrides, ...(merged.overrides || {}) };
  memo = { state: merged, at: Date.now() };
  return merged;
}

export async function saveState(state: StoreState): Promise<void> {
  memo = { state, at: Date.now() };
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/rotr_kv?on_conflict=key`, {
      method: "POST",
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: KEY, value: state, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Supabase write failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  } else {
    await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PATH, JSON.stringify(state));
  }
}

/** Separate rows for data that must never be clobbered by (or clobber) the main state. */
export async function loadKey<T>(key: string): Promise<T | null> {
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/rotr_kv?select=value&key=eq.${encodeURIComponent(key)}`, { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: T }[];
    return rows[0]?.value ?? null;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", `${key.replace(/[^a-z0-9-]/gi, "_")}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Like loadKey, but throws if storage can't be read (null only means "no row yet"). */
export async function loadKeyStrict<T>(key: string): Promise<T | null> {
  const sb = supabase();
  if (!sb) return loadKey<T>(key);
  const res = await fetch(`${sb.url}/rest/v1/rotr_kv?select=value&key=eq.${encodeURIComponent(key)}`, { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
  const rows = (await res.json()) as { value: T }[];
  return rows[0]?.value ?? null;
}

export async function saveKey<T>(key: string, value: T): Promise<void> {
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/rotr_kv?on_conflict=key`, {
      method: "POST",
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Supabase write failed: ${res.status}`);
    return;
  }
  await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "data", `${key.replace(/[^a-z0-9-]/gi, "_")}.json`), JSON.stringify(value));
}

export async function updateState(fn: (s: StoreState) => void | Promise<void>): Promise<StoreState> {
  memo = null;
  const s = await loadState();
  await fn(s);
  await saveState(s);
  return s;
}
