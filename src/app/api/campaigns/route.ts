import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { loadState, updateState } from "@/lib/store";
import type { Campaign, CampaignFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await loadState();
  return NextResponse.json({ campaigns: s.campaigns });
}

/** POST: create or update a draft. Body: Partial<Campaign> with optional id. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Campaign> & { filter?: CampaignFilter };
  let saved: Campaign | null = null;
  await updateState((s) => {
    const existing = body.id ? s.campaigns.find((c) => c.id === body.id) : null;
    if (existing) {
      if (existing.status !== "draft") throw new Error("Only drafts can be edited");
      Object.assign(existing, {
        subject: body.subject ?? existing.subject,
        body: body.body ?? existing.body,
        filter: body.filter ?? existing.filter,
        recipients: body.recipients ?? existing.recipients,
        excludedEmails: body.excludedEmails ?? existing.excludedEmails,
      });
      saved = existing;
    } else {
      const c: Campaign = {
        id: randomUUID(),
        subject: body.subject || "",
        body: body.body || "",
        filter: body.filter || { center: null, radiusMiles: 25, includeRecorded: true, includeRequested: true },
        recipients: body.recipients || [],
        excludedEmails: body.excludedEmails || [],
        status: "draft",
        createdAt: new Date().toISOString(),
        sentAt: null,
        sentCount: 0,
        error: null,
      };
      s.campaigns.unshift(c);
      saved = c;
    }
  });
  return NextResponse.json({ campaign: saved });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  await updateState((s) => {
    s.campaigns = s.campaigns.filter((c) => c.id !== id || c.status !== "draft");
  });
  return NextResponse.json({ ok: true });
}
