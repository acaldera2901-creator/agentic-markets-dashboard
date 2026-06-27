import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";
import { syncSegmentToResend, type SegmentContact } from "@/lib/resend-contacts";

export const dynamic = "force-dynamic";

type SegRow = { id: string; key: string; rule: unknown };

// Refresh giornaliero: ricalcola l'appartenenza di OGNI segmento attivo e
// sincronizza i contatti su Resend con l'appartenenza multi-segmento completa
// (un contatto può stare in più segmenti). Cron-secret gated, default-deny.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const segs = (await dbQuery<SegRow>("SELECT id, key, rule FROM segments WHERE active")) ?? [];

  // 1. Calcola i match di ogni segmento e costruisci la mappa identifier → [keys].
  const byContact = new Map<string, string[]>();
  const contactById = new Map<string, SegmentContact>();
  const perSegment: { row: SegRow; contacts: SegmentContact[] }[] = [];

  for (const s of segs) {
    let rule;
    try { rule = validateRule(s.rule); } catch (e) { console.error(`[segments-sync] rule invalid ${s.key}:`, String(e)); continue; }
    const { sql, params } = buildSegmentQuery(rule, { select: "contacts" });
    const contacts = (await dbQuery<SegmentContact>(sql, params)) ?? [];
    perSegment.push({ row: s, contacts });
    for (const c of contacts) {
      contactById.set(c.identifier, c);
      const arr = byContact.get(c.identifier) ?? [];
      arr.push(s.key);
      byContact.set(c.identifier, arr);
    }
  }

  // 2. Un solo upsert per contatto (deduplicato) con TUTTE le sue key.
  const uniqueContacts = Array.from(contactById.values());
  let result = { ok: 0, failed: 0 };
  if (uniqueContacts.length) {
    try {
      result = await syncSegmentToResend("__all__", uniqueContacts, byContact);
    } catch (e) {
      return NextResponse.json({ error: "sync failed", detail: String(e) }, { status: 500 });
    }
  }

  // 3. Aggiorna last_count/last_synced_at per ciascun segmento.
  for (const { row, contacts } of perSegment) {
    await dbExecute(
      "UPDATE segments SET last_count = $2, last_synced_at = NOW(), resend_segment = COALESCE(resend_segment, $3) WHERE id = $1",
      [row.id, contacts.length, row.key]
    );
  }

  return NextResponse.json({ ok: result.failed === 0, segments: segs.length, contacts: uniqueContacts.length, synced: result.ok, failed: result.failed });
}
