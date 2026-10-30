import { NextResponse, type NextRequest } from "next/server";
import { siteBase, syncWelcomes } from "@/lib/welcomeSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Someone may have signed up — go check." Called by the Wix automation (POST, on every form
 * submission) and by the daily Vercel cron (GET). The request body is ignored: signups are read
 * from Wix with our own API key, so this needs no secret and can only ever welcome real
 * subscribers who haven't been welcomed yet.
 */
async function handle(req: NextRequest) {
  try {
    const r = await syncWelcomes(siteBase(req.nextUrl.origin));
    // Only counts go back to the caller (this route is public); addresses go to the logs.
    if (r.sent.length) console.log("[welcome] sent:", r.sent.join(", "));
    if (r.error) console.error("[welcome]", r.error);
    return NextResponse.json({ ok: r.ok, started: r.started ?? false, checked: r.checked, sent: r.sent.length, skipped: r.skipped }, { status: r.ok ? 200 : 503 });
  } catch (e) {
    console.error("[welcome] failed:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "temporarily unavailable; will retry on the next run" }, { status: 503 });
  }
}

export const POST = handle;
export const GET = handle;
