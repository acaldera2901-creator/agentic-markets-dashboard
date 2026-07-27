// lib/resend-contacts.ts
// Sync dei contatti verso Resend per i segmenti marketing (#BO-SEGMENTS-FASE1).
// REST, no SDK (coerente con lib/email.ts). NESSUN invio email: solo contatti e
// appartenenze. `unsubscribed` non è MAI incluso negli upsert, così un re-sync
// non re-iscrive chi si è disiscritto (la scelta vive su Resend).
//
// ⚠️ 2026-07-27 — RISCRITTO dopo aver verificato l'API vera (drawer "Segments API"
// della dashboard + api-reference). La versione precedente assumeva che l'array
// `segments: ["<slug>"]` dentro `POST /contacts` definisse l'appartenenza: è FALSO.
// I Segments di Resend sono contenitori con nome + UUID (non filtri su proprietà) e
// l'appartenenza si gestisce con endpoint separati, per UUID:
//   POST   /segments                                  { name } -> { id }
//   GET    /segments                                  -> { data: [{ id, name }] }
//   GET    /contacts/{id|email}/segments              -> { data: [{ id, name }] }
//   POST   /contacts/{id|email}/segments/{segment_id}
//   DELETE /contacts/{id|email}/segments/{segment_id}
// Con la vecchia versione i contatti sarebbero entrati nell'Audience e i segmenti
// sarebbero rimasti VUOTI.

const API_BASE = "https://api.resend.com";
const EXPIRING_WINDOW_DAYS = 7;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SegmentContact = {
  id: string;
  identifier: string;
  name: string | null;
  plan: string;
  language: string | null;
  requested_plan: string | null;
  plan_expires_at: string | null;
  created_at: string;
  activated_at: string | null;
};

export function cohortMonth(createdAtISO: string): string {
  return createdAtISO.slice(0, 7); // "YYYY-MM"
}

export function lifecycleStage(c: SegmentContact, nowISO: string): "prospect" | "active" | "expiring" | "expired" {
  if (c.plan === "free" || c.plan === "pending_payment") return "prospect";
  if (!c.plan_expires_at) return "active";
  const now = new Date(nowISO).getTime();
  const exp = new Date(c.plan_expires_at).getTime();
  if (exp <= now) return "expired";
  if (exp <= now + EXPIRING_WINDOW_DAYS * 86400_000) return "expiring";
  return "active";
}

// Le `properties` portano attributi stabili, riscritti per intero a ogni sync.
// Sono anche il modo in cui si filtra direttamente dentro un Broadcast, senza
// bisogno di un segmento: plan / language / lifecycle_stage / cohort_month.
export function buildContactPayload(
  c: SegmentContact,
  nowISO: string
): { email: string; first_name?: string; properties: Record<string, string> } {
  const firstName = c.name?.trim().split(/\s+/)[0];
  const properties: Record<string, string> = {
    plan: c.plan,
    language: c.language ?? "",
    lifecycle_stage: lifecycleStage(c, nowISO),
    cohort_month: cohortMonth(c.created_at),
  };
  const payload: { email: string; first_name?: string; properties: Record<string, string> } = {
    email: c.identifier,
    properties,
  };
  if (firstName) payload.first_name = firstName;
  return payload;
}

type ApiResult = { ok: boolean; status: number; json: unknown };

async function call(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResult> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json: unknown = null;
  try { json = await resp.json(); } catch { /* 204 o body vuoto */ }
  return { ok: resp.ok, status: resp.status, json };
}

function idOf(json: unknown): string | null {
  const o = json as { id?: unknown; data?: { id?: unknown } } | null;
  const raw = o?.id ?? o?.data?.id;
  return typeof raw === "string" ? raw : null;
}

function listOf(json: unknown): { id?: unknown; name?: unknown }[] {
  const o = json as { data?: unknown } | null;
  const arr = Array.isArray(o?.data) ? o!.data : Array.isArray(json) ? json : [];
  return arr as { id?: unknown; name?: unknown }[];
}

/**
 * UUID del segmento Resend con questo nome, creandolo se manca. Idempotente: se
 * un run precedente l'ha creato ma non è riuscito a salvare l'id, lo ritrova per
 * nome invece di creare un duplicato. `existing` non-UUID (es. lo slug scritto
 * dalla versione precedente del sync) viene ignorato e risolto da zero.
 */
export async function ensureSegmentId(
  apiKey: string,
  name: string,
  existing: string | null
): Promise<string> {
  if (existing && UUID_RE.test(existing)) return existing;

  const list = await call(apiKey, "GET", "/segments?limit=100");
  if (list.ok) {
    const found = listOf(list.json).find(
      (s) => typeof s.name === "string" && s.name.toLowerCase() === name.toLowerCase()
    );
    if (found && typeof found.id === "string") return found.id;
  }

  const created = await call(apiKey, "POST", "/segments", { name });
  const id = idOf(created.json);
  if (!created.ok || !id) {
    throw new Error(`Resend segment create failed for "${name}": ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`);
  }
  return id;
}

async function upsertContact(
  audienceId: string,
  apiKey: string,
  payload: ReturnType<typeof buildContactPayload>
): Promise<void> {
  // `POST /contacts` è l'unico endpoint di creazione documentato; se il contatto
  // esiste già e il POST non fa upsert, si aggiorna con PATCH per email. Due
  // chiamate solo nel caso "già presente", mai in quello nuovo.
  const created = await call(apiKey, "POST", "/contacts", { audience_id: audienceId, ...payload });
  if (created.ok) return;
  const patched = await call(
    apiKey,
    "PATCH",
    `/contacts/${encodeURIComponent(payload.email)}`,
    { audience_id: audienceId, first_name: payload.first_name, properties: payload.properties }
  );
  if (!patched.ok) {
    throw new Error(`Resend contact upsert failed: POST ${created.status} / PATCH ${patched.status} ${JSON.stringify(patched.json).slice(0, 160)}`);
  }
}

/**
 * Allinea le appartenenze di UN contatto: aggiunge i segmenti che deve avere e
 * toglie quelli che non gli spettano più (un free che diventa pagante deve
 * USCIRE da "free consented", altrimenti il primo broadcast "offerta per chi non
 * ha un piano" arriva ai clienti paganti).
 *
 * `managed` = i soli segmenti governati dal backoffice: un segmento creato a mano
 * nella dashboard non viene MAI toccato, nemmeno per rimozione.
 */
export async function reconcileContactSegments(
  apiKey: string,
  email: string,
  want: Set<string>,
  managed: Set<string>
): Promise<{ added: number; removed: number }> {
  const enc = encodeURIComponent(email);
  const current = await call(apiKey, "GET", `/contacts/${enc}/segments?limit=100`);
  const currentIds = new Set(
    current.ok ? listOf(current.json).map((s) => s.id).filter((x): x is string => typeof x === "string") : []
  );

  let added = 0;
  let removed = 0;
  for (const id of want) {
    if (currentIds.has(id)) continue;
    const r = await call(apiKey, "POST", `/contacts/${enc}/segments/${id}`);
    if (!r.ok) throw new Error(`segment add failed (${email} → ${id}): ${r.status}`);
    added++;
  }
  for (const id of currentIds) {
    if (want.has(id) || !managed.has(id)) continue;
    const r = await call(apiKey, "DELETE", `/contacts/${enc}/segments/${id}`);
    if (!r.ok) throw new Error(`segment remove failed (${email} → ${id}): ${r.status}`);
    removed++;
  }
  return { added, removed };
}

// Upsert dei contatti + riconciliazione appartenenze. `wantIdsByContact` mappa
// identifier → UUID dei segmenti che il contatto matcha ORA.
export async function syncSegmentToResend(
  contacts: SegmentContact[],
  wantIdsByContact: Map<string, string[]>,
  managedIds: Set<string>
): Promise<{ ok: number; failed: number; added: number; removed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  if (!audienceId) throw new Error("RESEND_AUDIENCE_ID not configured");

  const nowISO = new Date().toISOString();
  let ok = 0;
  let failed = 0;
  let added = 0;
  let removed = 0;
  for (const c of contacts) {
    try {
      await upsertContact(audienceId, apiKey, buildContactPayload(c, nowISO));
      const want = new Set(wantIdsByContact.get(c.identifier) ?? []);
      const r = await reconcileContactSegments(apiKey, c.identifier, want, managedIds);
      added += r.added;
      removed += r.removed;
      ok++;
    } catch (e) {
      console.error(`[resend-contacts] sync ${c.identifier} failed:`, String(e));
      failed++;
    }
  }
  return { ok, failed, added, removed };
}
