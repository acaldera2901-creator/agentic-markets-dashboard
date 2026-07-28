// tests/resend-contacts.test.ts
import assert from "node:assert/strict";
import { lifecycleStage, cohortMonth, buildContactPayload, reconcileContactSegments, ensureContactProperties, syncSegmentToResend, CONTACT_PROPERTY_KEYS, type SegmentContact } from "../lib/resend-contacts";

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

// ── properties dichiarate prima dei contatti ─────────────────────────────────
// Riproduce il fallimento del sync del 2026-07-28: `POST /contacts` rispondeva
// 422 `validation_error: "One or more properties do not exist"` per TUTTI gli 11
// contatti. In Resend le custom properties sono uno SCHEMA dell'audience: vanno
// dichiarate (`POST /contact-properties`) prima di poter essere assegnate a un
// contatto. L'unica dichiarata era `Reminder_Sequence_Completed` (di Steve).
async function propertyTests() {
  {
    // audience come era in prod: manca tutto il nostro schema → va creato
    const calls: { method: string; path: string; body: unknown }[] = [];
    globalThis.fetch = (async (url: string | URL, init?: { method?: string; body?: string }) => {
      const path = String(url).replace("https://api.resend.com", "");
      const method = init?.method ?? "GET";
      calls.push({ method, path, body: init?.body ? JSON.parse(init.body) : undefined });
      if (method === "GET") {
        return new Response(JSON.stringify({ data: [{ key: "Reminder_Sequence_Completed" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ object: "contact_property", id: "p1" }), { status: 200 });
    }) as unknown as typeof fetch;

    const created = await ensureContactProperties("k");
    assert.deepEqual(created.sort(), ["cohort_month", "language", "lifecycle_stage", "plan"]);
    // create con `key` + `type` (non `name`: la doc parla di key, e con name Resend
    // accetta la chiamata ma la property nasce senza chiave usabile)
    const posts = calls.filter((c) => c.method === "POST");
    assert.equal(posts.length, 4);
    assert.deepEqual(posts[0].body, { key: "plan", type: "string" });
    assert.equal(posts.every((c) => c.path === "/contact-properties"), true);
  }
  {
    // schema già completo → nessuna scrittura (idempotente: gira a ogni sync)
    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL, init?: { method?: string }) => {
      calls.push(init?.method ?? "GET");
      return new Response(
        JSON.stringify({ data: CONTACT_PROPERTY_KEYS.map((key) => ({ key })) }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const created = await ensureContactProperties("k");
    assert.deepEqual(created, []);
    assert.deepEqual(calls, ["GET"]);
  }
  {
    // il motivo del fallimento non deve restare nei soli console.error: senza
    // questo, in prod si vedeva `failed=11` e nient'altro (6 ore per la diagnosi).
    globalThis.fetch = (async (url: string | URL, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      if (String(url).endsWith("/contacts") && method === "POST") {
        return new Response(
          JSON.stringify({ name: "validation_error", message: "One or more properties do not exist", statusCode: 422 }),
          { status: 422 }
        );
      }
      return new Response(JSON.stringify({ name: "not_found", statusCode: 404 }), { status: 404 });
    }) as unknown as typeof fetch;

    const r = await syncSegmentToResend([base], new Map(), new Set());
    assert.equal(r.ok, 0);
    assert.equal(r.failed, 1);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /properties do not exist/);
    assert.match(r.errors[0], /a@b\.com/);
  }
  globalThis.fetch = realFetch;
  console.log("resend properties ok");
}

membershipTests()
  .then(propertyTests)
  .catch((e) => { console.error(e); process.exit(1); });
