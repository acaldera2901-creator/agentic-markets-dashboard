import { NextRequest, NextResponse } from "next/server";
import { redesignFlagOn, v3Allowed } from "@/lib/v3c/guard";
import { getLive } from "@/lib/v3c/live-service.server";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3LiveResponse (lib/v3c/live-contract.ts). Live scores
// for the board rows that kicked off in the last ~3 hours: information only,
// never written anywhere, never part of the record or the estimates.
//
// Caching: the payload is the same for everyone, so with the flag on the CDN
// may share it for 20 s (+ 40 s stale while it refreshes). The admin path
// (flag off) is per-request and private — a shared cache would hand the admin's
// 200 to the next anonymous visitor.
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cacheControl = redesignFlagOn() ? "public, s-maxage=20, stale-while-revalidate=40" : "private, no-store";
  try {
    return NextResponse.json(await getLive(), { headers: { "Cache-Control": cacheControl } });
  } catch (e) {
    console.error("[v3/live]", String(e));
    return NextResponse.json({ error: "live unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
