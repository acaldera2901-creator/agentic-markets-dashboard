import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";
import { syncSegmentToResend, type SegmentContact } from "@/lib/resend-contacts";

export const dynamic = "force-dynamic";

type SegRow = { id: string; key: string; rule: unknown; active: boolean };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const segs = await dbQuery<SegRow>("SELECT id, key, rule, active FROM segments WHERE id = $1", [id]);
  const seg = segs?.[0];
  if (!seg) return NextResponse.json({ error: "segment not found" }, { status: 404 });

  let rule;
  try {
    rule = validateRule(seg.rule);
  } catch (e) {
    return NextResponse.json({ error: `stored rule invalid: ${String(e)}` }, { status: 500 });
  }

  // Match dei contatti idonei (eligibility consenso applicata in buildSegmentQuery).
  const { sql, params: qp } = buildSegmentQuery(rule, { select: "contacts" });
  const contacts = (await dbQuery<SegmentContact>(sql, qp)) ?? [];

  // Per Fase 1 il sync è per-segmento: ogni contatto porta SOLO questo segmento.
  // (L'appartenenza multi-segmento completa arriva dal refresh-all del cron, Task 7.)
  const byContact = new Map<string, string[]>();
  for (const c of contacts) byContact.set(c.identifier, [seg.key]);

  let result: { ok: number; failed: number };
  try {
    result = await syncSegmentToResend(seg.key, contacts, byContact);
  } catch (e) {
    return NextResponse.json({ error: "sync failed", detail: String(e) }, { status: 500 });
  }

  await dbExecute(
    "UPDATE segments SET last_count = $2, last_synced_at = NOW(), resend_segment = COALESCE(resend_segment, $3) WHERE id = $1",
    [id, contacts.length, seg.key]
  );

  return NextResponse.json({ ok: result.failed === 0, synced: result.ok, failed: result.failed, count: contacts.length });
}
