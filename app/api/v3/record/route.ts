import { NextRequest, NextResponse } from "next/server";
import { v3Allowed } from "@/lib/v3c/guard";
import { fetchPartnerHistoryByKeys, fetchSealedFootball, fetchSealedTennis } from "@/lib/v3c/queries";
import { isOurModel, ledgerTennisKind, sealedTennisKey } from "@/lib/v3c/tennis";
import { buildRecord } from "@/lib/v3c/record";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3RecordResponse (lib/v3c/contracts.ts). Reads ONLY
// pick_ledger + pick_settlement_current (+ prediction_log for the market at seal).
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const [football, tennis] = await Promise.all([fetchSealedFootball(), fetchSealedTennis()]);
    // Price history only for our-model rows: market rows are never paired.
    const keys = tennis
      .filter((r) => isOurModel(ledgerTennisKind(r)))
      .map(sealedTennisKey)
      .filter((k): k is string => k != null);
    return NextResponse.json(buildRecord(football, new Date(), tennis, await fetchPartnerHistoryByKeys(keys)));
  } catch (e) {
    console.error("[v3/record]", String(e));
    return NextResponse.json({ error: "record unavailable" }, { status: 503 });
  }
}
