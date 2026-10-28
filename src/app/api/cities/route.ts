import { NextResponse, type NextRequest } from "next/server";
import { searchCities } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  return NextResponse.json({ results: q.trim().length < 2 ? [] : searchCities(q, 8) });
}
