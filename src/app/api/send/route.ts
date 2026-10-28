import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { buildPeople } from "@/lib/people";
import { updateState } from "@/lib/store";
import { unsubToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkify(text: string) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" style="color:#d6336c">${m}</a>`);
}

function render(body: string, firstName: string, unsubUrl: string, address: string) {
  const personalised = body.replace(/\{\{\s*first_name\s*\}\}/gi, firstName || "friend").replace(/\{\{\s*name\s*\}\}/gi, firstName || "friend");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf7f8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1b1e">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #f1e3e8">
    <div style="font-size:16px;line-height:1.6;white-space:pre-wrap">${linkify(personalised)}</div>
    <hr style="border:none;border-top:1px solid #f1e3e8;margin:28px 0 16px">
    <div style="font-size:12px;color:#8a8088;line-height:1.5">You signed up to hear when Raye is doing a show near you.${address ? `<br>${esc(address)}` : ""}<br><a href="${unsubUrl}" style="color:#8a8088">Unsubscribe</a></div>
  </div></body></html>`;
  const text = `${personalised}\n\n—\nYou signed up to hear when Raye is doing a show near you.${address ? `\n${address}` : ""}\nUnsubscribe: ${unsubUrl}`;
  return { html, text };
}

/** POST { id } — sends a draft campaign to its current recipient list. */
export async function POST(req: NextRequest) {
  const { id } = (await req.json()) as { id: string };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return NextResponse.json({ error: "Email isn't connected yet: set RESEND_API_KEY and EMAIL_FROM." }, { status: 400 });

  const { people, state } = await buildPeople();
  const campaign = state.campaigns.find((c) => c.id === id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status !== "draft") return NextResponse.json({ error: "Already sent" }, { status: 400 });
  if (!campaign.subject.trim() || !campaign.body.trim()) return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });

  const eligible = new Map(people.filter((p) => p.emailEligible).map((p) => [p.email, p]));
  const excluded = new Set(campaign.excludedEmails.map((e) => e.toLowerCase()));
  const recipients = campaign.recipients.map((e) => e.toLowerCase()).filter((e) => eligible.has(e) && !excluded.has(e));
  if (!recipients.length) return NextResponse.json({ error: "No eligible recipients" }, { status: 400 });

  await updateState((s) => {
    const c = s.campaigns.find((x) => x.id === id);
    if (c) c.status = "sending";
  });

  const base = process.env.SITE_URL || req.nextUrl.origin;
  const address = process.env.MAILING_ADDRESS || "";
  const resend = new Resend(apiKey);
  let sent = 0;
  let error: string | null = null;
  try {
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100).map((email) => {
        const p = eligible.get(email)!;
        const unsubUrl = `${base}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
        const { html, text } = render(campaign.body, p.firstName, unsubUrl, address);
        return {
          from,
          to: [email],
          subject: campaign.subject,
          html,
          text,
          headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      });
      const r = await resend.batch.send(batch);
      if (r.error) throw new Error(r.error.message);
      sent += batch.length;
    }
  } catch (e) {
    error = (e as Error).message;
  }

  await updateState((s) => {
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) return;
    c.recipients = recipients;
    c.sentCount = sent;
    c.sentAt = new Date().toISOString();
    c.status = error ? "failed" : "sent";
    c.error = error;
  });
  return NextResponse.json({ ok: !error, sent, error });
}
