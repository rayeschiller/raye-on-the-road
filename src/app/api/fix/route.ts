import { NextResponse, type NextRequest } from "next/server";
import { updateState } from "@/lib/store";
import type { Place } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST { email?, raw?, place: Place | null }
 * - raw: fixes everyone who typed that same answer
 * - email: fixes just this person
 * - place null: clears the fix
 * POST { email, exclude: true|false } hides/unhides a contact
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; raw?: string; place?: Place | null; exclude?: boolean };
  await updateState((s) => {
    if (typeof body.exclude === "boolean" && body.email) {
      const e = body.email.toLowerCase();
      s.overrides.excluded = s.overrides.excluded.filter((x) => x !== e);
      if (body.exclude) s.overrides.excluded.push(e);
      return;
    }
    if (body.raw) {
      const k = body.raw.trim().toLowerCase();
      if (body.place) s.overrides.rawFixes[k] = body.place;
      else delete s.overrides.rawFixes[k];
    }
    if (body.email) {
      const k = body.email.toLowerCase();
      if (body.place) s.overrides.emailFixes[k] = body.place;
      else delete s.overrides.emailFixes[k];
    }
  });
  return NextResponse.json({ ok: true });
}
