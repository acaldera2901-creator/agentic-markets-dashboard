import { NextRequest, NextResponse } from "next/server";
import { v3Allowed } from "@/lib/v3c/guard";
import { buildLineMovement } from "@/lib/v3c/line-movement-service";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3LineMovementResponse (lib/v3c/contracts.ts).
// The payload is assembled in lib/v3c/line-movement-service.ts so the match
// page (/match/[id], F4) renders the same data server-side.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await ctx.params;
  const matchId = decodeURIComponent(id);
  if (!matchId || matchId.length > 200) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const body = await buildLineMovement(matchId);
    if (!body) return NextResponse.json({ error: "unknown match" }, { status: 404 });
    return NextResponse.json(body);
  } catch (e) {
    console.error("[v3/line-movement]", String(e));
    return NextResponse.json({ error: "line movement unavailable" }, { status: 503 });
  }
}
