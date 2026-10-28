import { promises as fs } from "node:fs";
import path from "node:path";
import type { StoreState, BeaconsPerson } from "./types";

/**
 * Persistent JSON state. On Vercel this lives in Vercel Blob (BLOB_READ_WRITE_TOKEN);
 * locally it's a file in ./data/state.json.
 */

const BLOB_PATH = "raye-on-the-road/state.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "state.json");

function emptyState(): StoreState {
  return {
    overrides: { rawFixes: {}, emailFixes: {}, unsubscribed: [], excluded: [] },
    campaigns: [],
    beacons: [] as BeaconsPerson[],
    wixSnapshot: null,
  };
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

let memo: { state: StoreState; at: number } | null = null;

export async function loadState(): Promise<StoreState> {
  if (memo && Date.now() - memo.at < 5000) return memo.state;
  let state: StoreState | null = null;
  if (hasBlob()) {
    const { get } = await import("@vercel/blob");
    const r = await get(BLOB_PATH, { access: "private", useCache: false });
    if (r && r.stream) {
      const text = await new Response(r.stream).text();
      state = JSON.parse(text) as StoreState;
    }
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
  const json = JSON.stringify(state);
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, json, { access: "private", addRandomSuffix: false, contentType: "application/json", allowOverwrite: true });
  } else {
    await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PATH, json);
  }
}

export async function updateState(fn: (s: StoreState) => void | Promise<void>): Promise<StoreState> {
  memo = null;
  const s = await loadState();
  await fn(s);
  await saveState(s);
  return s;
}

export function storageMode(): "blob" | "local" {
  return hasBlob() ? "blob" : "local";
}
