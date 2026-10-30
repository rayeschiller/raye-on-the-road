import { Resend } from "resend";
import { unsubToken } from "./auth";
import { loadKeyStrict, loadState, saveKey } from "./store";
import { fetchRecentSignups, wixConfigured } from "./wix";
import { renderWelcome, WELCOME_SUBJECT } from "./welcome";

/**
 * Sends the welcome email to everyone who signed up on Wix and hasn't been welcomed yet.
 *
 * Nothing is taken from the caller: Wix just pings us ("someone signed up"), and a daily cron
 * pings us too. Either way we ask Wix for recent signups ourselves. So if this site is down
 * when someone signs up, the next ping (or the daily run) still welcomes them.
 *
 * Safety: each address is welcomed once (record in Supabase + Resend idempotency key), anyone
 * unsubscribed is skipped, and signups from before the first run are never emailed (they got
 * the old Wix email).
 */

const KEY = "welcome-email";
const LOOKBACK_DAYS = 7;

type WelcomeLog = { startedAt: string; sent: Record<string, string> };

export type SyncResult = { ok: boolean; started?: boolean; checked: number; sent: string[]; skipped: number; error?: string };

export function siteBase(fallbackOrigin: string) {
  return (process.env.SITE_URL || fallbackOrigin).replace(/\/$/, "");
}

export async function sendWelcomeTo(email: string, base: string, opts: { idempotent: boolean }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const e = email.toLowerCase();
  const unsubUrl = `${base}/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
  const { html, text } = renderWelcome({ siteUrl: base, unsubUrl, address: process.env.MAILING_ADDRESS || "" });
  const r = await new Resend(apiKey).emails.send(
    {
      from: process.env.EMAIL_FROM || "Raye Schiller <hello@rayeschiller.com>",
      to: [e],
      replyTo: process.env.EMAIL_REPLY_TO || "hello@rayeschiller.com",
      subject: WELCOME_SUBJECT,
      html,
      text,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    },
    opts.idempotent ? { idempotencyKey: `welcome/${e}` } : undefined,
  );
  if (r.error) throw new Error(r.error.message);
  return r.data?.id ?? null;
}

let running: Promise<SyncResult> | null = null;

/** Concurrent pings in the same instance share one run. */
export function syncWelcomes(base: string): Promise<SyncResult> {
  if (!running) running = doSync(base).finally(() => (running = null));
  return running;
}

async function doSync(base: string): Promise<SyncResult> {
  if (!wixConfigured()) return { ok: false, checked: 0, sent: [], skipped: 0, error: "Wix is not connected" };
  if (!process.env.RESEND_API_KEY) return { ok: false, checked: 0, sent: [], skipped: 0, error: "RESEND_API_KEY is not set" };

  // If storage is unreachable we can't tell who's been welcomed, so we stop and let the next run catch up.
  const log = await loadKeyStrict<WelcomeLog>(KEY);
  if (!log?.startedAt) {
    await saveKey<WelcomeLog>(KEY, { startedAt: new Date().toISOString(), sent: {} });
    return { ok: true, started: true, checked: 0, sent: [], skipped: 0 };
  }

  const floor = Math.max(Date.parse(log.startedAt), Date.now() - LOOKBACK_DAYS * 86_400_000);
  const recent = await fetchRecentSignups(new Date(floor).toISOString());
  const state = await loadState();
  const unsub = new Set(state.overrides.unsubscribed.map((e) => e.toLowerCase()));

  const sent: string[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const s of recent) {
    const e = s.email;
    if (seen.has(e)) continue;
    seen.add(e);
    if (log.sent[e] || unsub.has(e)) {
      skipped++;
      continue;
    }
    try {
      await sendWelcomeTo(e, base, { idempotent: true });
    } catch (err) {
      return { ok: false, checked: seen.size, sent, skipped, error: `${e}: ${(err as Error).message}` };
    }
    log.sent[e] = new Date().toISOString();
    sent.push(e);
    await saveKey(KEY, log); // record each one immediately so a crash mid-run can't double-send
  }
  return { ok: true, checked: seen.size, sent, skipped };
}
