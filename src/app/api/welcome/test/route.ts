import { NextResponse, type NextRequest } from "next/server";
import { sendWelcomeTo, siteBase } from "@/lib/welcomeSync";

export const dynamic = "force-dynamic";

/** Logged-in only: /api/welcome/test?to=you@example.com sends the welcome email (doesn't count as welcomed). */
export async function GET(req: NextRequest) {
  const to = (req.nextUrl.searchParams.get("to") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return NextResponse.json({ error: "Add ?to=you@example.com" }, { status: 400 });
  try {
    const id = await sendWelcomeTo(to, siteBase(req.nextUrl.origin), { idempotent: false });
    return NextResponse.json({ ok: true, sentTo: to, id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
