// lib/segment-sync.ts
// Logica condivisa di refresh dei segmenti su Resend (#BO-SEGMENTS-FASE1).
// Usata SIA dal cron giornaliero SIA dal pulsante "Sync" del BO, così i due
// path producono sempre lo stesso stato su Resend: ogni contatto viene
// upsertato UNA volta e le sue appartenenze riconciliate contro l'insieme
// COMPLETO dei segmenti attivi che matcha ora (niente clobbering tra segmenti).
//
// 2026-07-27: i segmenti Resend si creano una volta via API e il loro UUID vive
// in `segments.resend_segment` (la colonna esisteva già, annotata per questo).
// Prima lì ci finiva lo slug, che non è un identificatore valido per Resend.

import { dbQuery, dbExecute } from "./db";
import { validateRule, buildSegmentQuery } from "./segments";
import { syncSegmentToResend, ensureSegmentId, type SegmentContact } from "./resend-contacts";

type SegRow = { id: string; key: string; name: string; rule: unknown; resend_segment: string | null };

export type SegmentSyncResult = {
  segments: number;
  contacts: number;
  synced: number;
  failed: number;
  added: number;
  removed: number;
  ok: boolean;
};

export async function runSegmentSync(): Promise<SegmentSyncResult> {
  const segs =
    (await dbQuery<SegRow>(
      "SELECT id, key, name, rule, resend_segment FROM segments WHERE active = true"
    )) ?? [];

  const byContact = new Map<string, string[]>();
  const contactById = new Map<string, SegmentContact>();
  const perSegment: { row: SegRow; count: number; resendId: string }[] = [];
  const managedIds = new Set<string>();

  const apiKey = process.env.RESEND_API_KEY;

  for (const s of segs) {
    let rule;
    try {
      rule = validateRule(s.rule);
    } catch (e) {
      console.error(`[segment-sync] rule invalid ${s.key}:`, String(e));
      continue;
    }
    // UUID del segmento su Resend: risolto/creato una volta, poi persistito.
    // Se manca la key non si può sincronizzare l'appartenenza → salta il segmento
    // invece di caricare contatti che finirebbero in nessun segmento.
    let resendId: string;
    try {
      if (!apiKey) throw new Error("RESEND_API_KEY not configured");
      resendId = await ensureSegmentId(apiKey, s.name, s.resend_segment);
    } catch (e) {
      console.error(`[segment-sync] segment id non risolto ${s.key}:`, String(e));
      continue;
    }
    if (resendId !== s.resend_segment) {
      await dbExecute("UPDATE segments SET resend_segment = $2, updated_at = NOW() WHERE id = $1", [s.id, resendId]);
    }
    managedIds.add(resendId);

    const { sql, params } = buildSegmentQuery(rule, { select: "contacts" });
    const contacts = (await dbQuery<SegmentContact>(sql, params)) ?? [];
    perSegment.push({ row: s, count: contacts.length, resendId });
    for (const c of contacts) {
      contactById.set(c.identifier, c); // stesso identifier → stessi campi: overwrite sicuro
      const arr = byContact.get(c.identifier) ?? [];
      arr.push(resendId);
      byContact.set(c.identifier, arr);
    }
  }

  const uniqueContacts = Array.from(contactById.values());
  let result = { ok: 0, failed: 0, added: 0, removed: 0 };
  if (uniqueContacts.length) {
    result = await syncSegmentToResend(uniqueContacts, byContact, managedIds);
  }

  for (const { row, count } of perSegment) {
    await dbExecute(
      "UPDATE segments SET last_count = $2, last_synced_at = NOW() WHERE id = $1",
      [row.id, count]
    );
  }

  // Audit best-effort (spec §3.3.6): traccia l'esito in `notifications` accanto
  // agli altri eventi del BO. Non deve mai far fallire il sync.
  try {
    await dbExecute(
      `INSERT INTO notifications (type, title, body, target, sent, sent_at)
       VALUES ('sync', 'Segments sync', $1, 'resend', $2, NOW())`,
      [
        `segments=${perSegment.length} contacts=${uniqueContacts.length} ok=${result.ok} failed=${result.failed} added=${result.added} removed=${result.removed}`,
        result.failed === 0,
      ]
    );
  } catch (e) {
    console.error("[segment-sync] audit insert failed:", String(e));
  }

  return {
    segments: perSegment.length,
    contacts: uniqueContacts.length,
    synced: result.ok,
    failed: result.failed,
    added: result.added,
    removed: result.removed,
    ok: result.failed === 0,
  };
}
