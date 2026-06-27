import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { runSegmentSync } from "@/lib/segment-sync";

export const dynamic = "force-dynamic";

// Refresh giornaliero di tutti i segmenti attivi → Resend. Cron-secret gated.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSegmentSync();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/segments-sync] failed:", String(e));
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
