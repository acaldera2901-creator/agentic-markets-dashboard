import { NextResponse } from "next/server";
import { buildWorldCupDiagnostics } from "@/lib/world-cup-readiness";

export const dynamic = "force-dynamic";

// Readiness computation lives in lib/world-cup-readiness.ts so this endpoint and
// the publication gate share a single source of truth for monitor_only/signal_ready.

function authorized(req: Request): boolean {
  const secret = process.env.RESEARCH_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const worldCup = await buildWorldCupDiagnostics();

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      world_cup: worldCup,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
