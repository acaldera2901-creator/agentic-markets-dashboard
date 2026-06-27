// lib/segment-sync.ts
// Logica condivisa di refresh dei segmenti su Resend (#BO-SEGMENTS-FASE1).
// Usata SIA dal cron giornaliero SIA dal pulsante "Sync" del BO, così i due
// path producono sempre lo stesso stato su Resend: ogni contatto viene
// upsertato UNA volta con l'array COMPLETO dei segmenti attivi che matcha ora
// (niente clobbering dell'appartenenza tra un segmento e l'altro).

import { dbQuery, dbExecute } from "./db";
import { validateRule, buildSegmentQuery } from "./segments";
import { syncSegmentToResend, type SegmentContact } from "./resend-contacts";

type SegRow = { id: string; key: string; rule: unknown };

export type SegmentSyncResult = {
  segments: number;
  contacts: number;
  synced: number;
  failed: number;
  ok: boolean;
};

export async function runSegmentSync(): Promise<SegmentSyncResult> {
  const segs = (await dbQuery<SegRow>("SELECT id, key, rule FROM segments WHERE active = true")) ?? [];

  const byContact = new Map<string, string[]>();
  const contactById = new Map<string, SegmentContact>();
  const perSegment: { row: SegRow; count: number }[] = [];

  for (const s of segs) {
    let rule;
    try {
      rule = validateRule(s.rule);
    } catch (e) {
      console.error(`[segment-sync] rule invalid ${s.key}:`, String(e));
      continue;
    }
    const { sql, params } = buildSegmentQuery(rule, { select: "contacts" });
    const contacts = (await dbQuery<SegmentContact>(sql, params)) ?? [];
    perSegment.push({ row: s, count: contacts.length });
    for (const c of contacts) {
      contactById.set(c.identifier, c); // stesso identifier → stessi campi: overwrite sicuro
      const arr = byContact.get(c.identifier) ?? [];
      arr.push(s.key);
      byContact.set(c.identifier, arr);
    }
  }

  const uniqueContacts = Array.from(contactById.values());
  let result = { ok: 0, failed: 0 };
  if (uniqueContacts.length) {
    result = await syncSegmentToResend(uniqueContacts, byContact);
  }

  for (const { row, count } of perSegment) {
    await dbExecute(
      "UPDATE segments SET last_count = $2, last_synced_at = NOW(), resend_segment = COALESCE(resend_segment, $3) WHERE id = $1",
      [row.id, count, row.key]
    );
  }

  // Audit best-effort (spec §3.3.6): traccia l'esito in `notifications` accanto
  // agli altri eventi del BO. Non deve mai far fallire il sync.
  try {
    await dbExecute(
      `INSERT INTO notifications (type, title, body, target, sent, sent_at)
       VALUES ('sync', 'Segments sync', $1, 'resend', $2, NOW())`,
      [`segments=${perSegment.length} contacts=${uniqueContacts.length} ok=${result.ok} failed=${result.failed}`, result.failed === 0]
    );
  } catch (e) {
    console.error("[segment-sync] audit insert failed:", String(e));
  }

  return {
    segments: perSegment.length,
    contacts: uniqueContacts.length,
    synced: result.ok,
    failed: result.failed,
    ok: result.failed === 0,
  };
}
