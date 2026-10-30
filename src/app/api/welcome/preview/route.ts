import { type NextRequest } from "next/server";
import { renderWelcome } from "@/lib/welcome";

export const dynamic = "force-dynamic";

/** Logged-in preview of the welcome email: /api/welcome/preview */
export async function GET(req: NextRequest) {
  const base = (process.env.SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const { html } = renderWelcome({ siteUrl: base, unsubUrl: `${base}/unsubscribe`, address: process.env.MAILING_ADDRESS || "" });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
