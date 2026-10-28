import { NextResponse, type NextRequest } from "next/server";
import { checkPassword, COOKIE, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password: string };
  if (!checkPassword(password || "")) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, sessionToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
