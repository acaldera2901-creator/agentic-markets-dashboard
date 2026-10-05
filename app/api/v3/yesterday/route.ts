import { NextRequest, NextResponse } from "next/server";
import { v3Allowed } from "@/lib/v3c/guard";
import { fetchSealedDay } from "@/lib/v3c/queries";
import { buildYesterday, yesterdayUtc } from "@/lib/v3c/yesterday";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3YesterdayResponse (lib/v3c/contracts.ts). Reads ONLY
// pick_ledger + pick_settlement_current for the UTC day before now.
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const now = new Date();
  const y = yesterdayUtc(now);
  try {
    return NextResponse.json(buildYesterday(await fetchSealedDay(y.from, y.to), y.day, now));
  } catch (e) {
    console.error("[v3/yesterday]", String(e));
    return NextResponse.json({ error: "yesterday unavailable" }, { status: 503 });
  }
}
