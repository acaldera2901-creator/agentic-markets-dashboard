import { NextRequest, NextResponse } from "next/server";
import { v3Allowed } from "@/lib/v3c/guard";
import { fetchSealedFootball } from "@/lib/v3c/queries";
import { buildRecord } from "@/lib/v3c/record";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3RecordResponse (lib/v3c/contracts.ts). Reads ONLY
// pick_ledger + pick_settlement_current (+ prediction_log for the market at seal).
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(buildRecord(await fetchSealedFootball()));
  } catch (e) {
    console.error("[v3/record]", String(e));
    return NextResponse.json({ error: "record unavailable" }, { status: 503 });
  }
}
