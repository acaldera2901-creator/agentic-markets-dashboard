import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { runSegmentSync } from "@/lib/segment-sync";

export const dynamic = "force-dynamic";

type SegRow = { id: string; active: boolean };

// "Sync su Resend" lancia un REFRESH COMPLETO (tutti i segmenti attivi),
// identico al cron, così lo stato dei contatti resta coerente. L'[id] serve
// solo a 404 se il segmento non esiste e a bloccare se è inattivo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const segs = await dbQuery<SegRow>("SELECT id, active FROM segments WHERE id = $1", [id]);
  const seg = segs?.[0];
  if (!seg) return NextResponse.json({ error: "segment not found" }, { status: 404 });
  if (!seg.active) return NextResponse.json({ error: "segmento inattivo: attivalo per sincronizzarlo" }, { status: 400 });

  try {
    const result = await runSegmentSync();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[segments/sync] failed:", String(e));
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
