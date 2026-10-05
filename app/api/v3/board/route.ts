import { NextRequest, NextResponse } from "next/server";
import { buildBoardResponse } from "@/lib/v3c/board-service";
import { v3Allowed } from "@/lib/v3c/guard";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3BoardResponse (lib/v3c/contracts.ts), docs/v3c-data-api.md.
// The payload is assembled in lib/v3c/board-service.ts so the home and
// /predictions can render the same data server-side (F3).
export async function GET(req: NextRequest) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await buildBoardResponse(new Date()));
  } catch (e) {
    console.error("[v3/board]", String(e));
    return NextResponse.json({ error: "board unavailable" }, { status: 503 });
  }
}
