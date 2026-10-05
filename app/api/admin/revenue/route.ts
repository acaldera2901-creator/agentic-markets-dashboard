import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQueryStrict } from "@/lib/db";
import { computeRevenue } from "@/lib/revenue";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional, inclusive)
// Cash collected, MRR, ARPU and annual share across every payment rail
// (#GROWTH-TRACKING-1006.4). Read-only.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
    return NextResponse.json({ error: "from/to must be YYYY-MM-DD" }, { status: 400 });
  }
  const report = await computeRevenue((sql) => dbQueryStrict(sql), { from, to });
  return NextResponse.json(report);
}
