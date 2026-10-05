import { NextRequest, NextResponse } from "next/server";
import { buildCalibration } from "@/lib/v3c/calibration";
import { v3Allowed } from "@/lib/v3c/guard";
import { fetchSealedFootball, fetchSealedTennis } from "@/lib/v3c/queries";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3CalibrationResponse (lib/v3c/contracts.ts).
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const [football, tennis] = await Promise.all([fetchSealedFootball(), fetchSealedTennis()]);
    return NextResponse.json(buildCalibration(football, tennis));
  } catch (e) {
    console.error("[v3/calibration]", String(e));
    return NextResponse.json({ error: "calibration unavailable" }, { status: 503 });
  }
}
