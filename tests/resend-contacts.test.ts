// tests/resend-contacts.test.ts
import assert from "node:assert/strict";
import { lifecycleStage, cohortMonth, buildContactPayload, reconcileContactSegments, type SegmentContact } from "../lib/resend-contacts";

const NOW = "2026-06-27T12:00:00.000Z";

const base: SegmentContact = {
  id: "u1", identifier: "a@b.com", name: "Mario Rossi", plan: "premium",
  language: "it", requested_plan: null, plan_expires_at: "2026-12-01T00:00:00.000Z",
  created_at: "2026-05-10T00:00:00.000Z", activated_at: "2026-05-10T00:00:00.000Z",
};

assert.equal(cohortMonth(base.created_at), "2026-05");

// premium con scadenza lontana → active
assert.equal(lifecycleStage(base, NOW), "active");
// premium che scade entro 7gg → expiring
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-30T00:00:00.000Z" }, NOW), "expiring");
// scaduto → expired
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-01T00:00:00.000Z" }, NOW), "expired");
// free attivato → prospect
assert.equal(lifecycleStage({ ...base, plan: "free", plan_expires_at: null }, NOW), "prospect");

const payload = buildContactPayload(base, NOW);
assert.equal(payload.email, "a@b.com");
assert.equal(payload.first_name, "Mario");
assert.equal(payload.properties.plan, "premium");
assert.equal(payload.properties.language, "it");
assert.equal(payload.properties.lifecycle_stage, "active");
assert.equal(payload.properties.cohort_month, "2026-05");
// Le properties sono l'unico contenuto del contatto: niente seg_* e — dal 27/07 —
// nessun array `segments`, perché l'appartenenza NON è un campo del contatto ma si
// gestisce con POST/DELETE /contacts/{email}/segments/{uuid}.
assert.equal("seg_pro_it" in payload.properties, false);
assert.equal("segments" in payload, false);
// MAI impostare unsubscribed nell'upsert
assert.equal("unsubscribed" in payload, false);

// ── riconciliazione appartenenze (fetch stubbato) ────────────────────────────
// Difende due invarianti: un contatto che non matcha più un segmento ne ESCE
// (altrimenti un free diventato pagante resta in "free consented" e il broadcast
// per i non-paganti arriva ai clienti), e un segmento creato a mano nella
// dashboard non viene MAI toccato.
const realFetch = globalThis.fetch;
function stub(currentIds: string[]) {
  const calls: { method: string; path: string }[] = [];
  globalThis.fetch = (async (url: string | URL, init?: { method?: string }) => {
    const path = String(url).replace("https://api.resend.com", "");
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    const body = method === "GET" ? { object: "list", data: currentIds.map((id) => ({ id })) } : { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return calls;
}

async function membershipTests() {
  {
    // già in SEG-A e in un segmento non gestito; deve entrare in SEG-B e non uscire da niente
    const calls = stub(["SEG-A", "SEG-HANDMADE"]);
    const r = await reconcileContactSegments("k", "a@b.com", new Set(["SEG-A", "SEG-B"]), new Set(["SEG-A", "SEG-B"]));
    assert.deepEqual(r, { added: 1, removed: 0 });
    assert.deepEqual(
      calls.filter((c) => c.method !== "GET"),
      [{ method: "POST", path: "/contacts/a%40b.com/segments/SEG-B" }]
    );
  }
  {
    // non matcha più nulla: esce da SEG-A (gestito) e resta nel segmento fatto a mano
    const calls = stub(["SEG-A", "SEG-HANDMADE"]);
    const r = await reconcileContactSegments("k", "a@b.com", new Set(), new Set(["SEG-A", "SEG-B"]));
    assert.deepEqual(r, { added: 0, removed: 1 });
    assert.deepEqual(
      calls.filter((c) => c.method !== "GET"),
      [{ method: "DELETE", path: "/contacts/a%40b.com/segments/SEG-A" }]
    );
  }
  globalThis.fetch = realFetch;
  console.log("resend contacts ok");
}

membershipTests().catch((e) => { console.error(e); process.exit(1); });
