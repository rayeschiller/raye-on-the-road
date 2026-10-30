import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { unsubToken } from "@/lib/auth";
import { loadKey, loadState, saveKey } from "@/lib/store";
import { extractSignup, renderWelcome, WELCOME_SUBJECT } from "@/lib/welcome";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SENT_KEY = "welcome-sent";

function authorized(req: NextRequest) {
  const want = (process.env.WELCOME_HOOK_SECRET || "").trim();
  if (!want) return false;
  const got = (req.nextUrl.searchParams.get("key") || req.headers.get("x-hook-key") || "").trim();
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendWelcome(email: string, req: NextRequest, opts: { force: boolean }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });

  const e = email.toLowerCase();
  const state = await loadState();
  if (state.overrides.unsubscribed.includes(e)) return NextResponse.json({ ok: true, skipped: "unsubscribed" });

  const sent = (await loadKey<Record<string, string>>(SENT_KEY)) || {};
  if (sent[e] && !opts.force) return NextResponse.json({ ok: true, skipped: "already welcomed", at: sent[e] });

  const base = (process.env.SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const unsubUrl = `${base}/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
  const { html, text } = renderWelcome({ siteUrl: base, unsubUrl, address: process.env.MAILING_ADDRESS || "" });
  const from = process.env.EMAIL_FROM || "Raye Schiller <hello@rayeschiller.com>";

  const r = await new Resend(apiKey).emails.send({
    from,
    to: [e],
    replyTo: process.env.EMAIL_REPLY_TO || "hello@rayeschiller.com",
    subject: WELCOME_SUBJECT,
    html,
    text,
    headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 502 });

  if (!opts.force) {
    sent[e] = new Date().toISOString();
    await saveKey(SENT_KEY, sent);
  }
  return NextResponse.json({ ok: true, sent: e, id: r.data?.id });
}

/**
 * Wix automation ("Form submitted" → send HTTP request) posts here:
 *   POST https://road.rayeschiller.com/api/hooks/signup?key=WELCOME_HOOK_SECRET
 * Body: whatever Wix sends; we find the subscriber's email in it.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown = null;
  const raw = await req.text();
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = Object.fromEntries(new URLSearchParams(raw));
  }
  const found = extractSignup(payload);
  if (!found) {
    console.warn("[welcome] no email in payload:", raw.slice(0, 1500));
    // 200 so Wix doesn't retry forever on a payload we can't use
    return NextResponse.json({ ok: false, error: "No subscriber email found in payload" });
  }
  return sendWelcome(found.email, req, { force: false });
}

/** Manual test: GET /api/hooks/signup?key=…&to=you@example.com (always sends, doesn't mark as welcomed). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const to = req.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json({ ok: true, ready: Boolean(process.env.RESEND_API_KEY) });
  return sendWelcome(to, req, { force: true });
}
