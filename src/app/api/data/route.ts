import { NextResponse, type NextRequest } from "next/server";
import { buildPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const { people, status, state } = await buildPeople({ force });
  return NextResponse.json({ people, status, campaigns: state.campaigns, generatedAt: new Date().toISOString() });
}
