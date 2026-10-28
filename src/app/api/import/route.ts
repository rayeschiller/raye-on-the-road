import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { updateState } from "@/lib/store";
import { resolveLocation, seededCenter } from "@/lib/geo";
import type { BeaconsPerson } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data { file } — a Beacons audience_list.csv export.
 * Replaces the Beacons list (merges location from the old list when the new row has none).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const text = await file.text();
  if (file.name.endsWith(".json") || text.trimStart().startsWith("{")) {
    const j = JSON.parse(text) as { kind?: string; people?: BeaconsPerson[]; answers?: Record<string, string> };
    if (j.kind === "raye-on-the-road-legacy-answers" && j.answers) {
      const answers: Record<string, string> = {};
      for (const [e, a] of Object.entries(j.answers)) if (e.includes("@") && typeof a === "string" && a.trim()) answers[e.trim().toLowerCase()] = a.trim();
      await updateState((s) => {
        s.legacyAnswers = { ...(s.legacyAnswers || {}), ...answers };
      });
      return NextResponse.json({ ok: true, imported: Object.keys(answers).length });
    }
    if (j.kind !== "raye-on-the-road-beacons" || !Array.isArray(j.people)) return NextResponse.json({ error: "Not a Beacons import file" }, { status: 400 });
    const people = j.people.filter((p) => p.email?.includes("@")).map((p) => ({ ...p, email: p.email.toLowerCase() }));
    await updateState((s) => {
      s.beacons = people;
    });
    return NextResponse.json({ ok: true, imported: people.length });
  }
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const get = (r: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(r).find((h) => h.trim().toLowerCase() === k);
      if (hit && r[hit]?.trim()) return r[hit].trim();
    }
    return "";
  };
  let imported = 0;
  await updateState((s) => {
    const old = new Map(s.beacons.map((b) => [b.email.toLowerCase(), b]));
    const next: BeaconsPerson[] = [];
    for (const r of rows) {
      const email = get(r, "email", "email address").toLowerCase();
      if (!email.includes("@")) continue;
      const prev = old.get(email);
      const city = get(r, "city");
      const region = get(r, "region", "state");
      const country = get(r, "country");
      let lat: number | null = null;
      let lon: number | null = null;
      let rc = city, rr = region, rcn = country;
      if (city) {
        const c = seededCenter(city, region, country) || null;
        if (c) [lat, lon] = c;
        else {
          const place = resolveLocation([city, region, country].filter(Boolean).join(", "));
          if (place) { lat = place.lat; lon = place.lon; rc = place.city; rr = place.region; rcn = place.country; }
        }
      }
      if (!lat && prev?.lat) { lat = prev.lat; lon = prev.lon; rc = prev.city; rr = prev.region; rcn = prev.country; }
      next.push({
        email,
        firstName: get(r, "first_name", "first name") || prev?.firstName || "",
        lastName: get(r, "last_name", "last name") || prev?.lastName || "",
        city: rc, region: rr, country: rcn,
        rawLocation: [city, region, country].filter(Boolean).join(", "),
        status: "Subscribed",
        lat, lon,
      });
      imported++;
    }
    if (imported) s.beacons = next;
  });
  return NextResponse.json({ ok: true, imported });
}
