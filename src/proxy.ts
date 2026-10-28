import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

const PUBLIC = [/^\/login/, /^\/unsubscribe/, /^\/api\/login/, /^\/api\/unsubscribe/, /^\/_next\//, /^\/favicon/, /^\/icon/];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (!process.env.SITE_PASSWORD) return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  if (verifySession(token)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
