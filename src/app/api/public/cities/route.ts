import { NextResponse } from "next/server";
import { getShare } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getShare();
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
