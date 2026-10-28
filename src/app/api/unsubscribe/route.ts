import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsub } from "@/lib/auth";
import { updateState } from "@/lib/store";

export const dynamic = "force-dynamic";

async function handle(email: string | null, token: string | null) {
  if (!email || !token || !verifyUnsub(email, token)) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  const e = email.toLowerCase();
  await updateState((s) => {
    if (!s.overrides.unsubscribed.includes(e)) s.overrides.unsubscribed.push(e);
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // Supports both our page and RFC 8058 one-click (List-Unsubscribe-Post)
  const url = req.nextUrl;
  return handle(url.searchParams.get("e"), url.searchParams.get("t"));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  return handle(url.searchParams.get("e"), url.searchParams.get("t"));
}
