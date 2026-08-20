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

import { promoEligibility } from "@/lib/creator-promo";
import { isInternalIdentifier } from "@/lib/crm-internal";
import { dbQuery } from "@/lib/db";

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

// Lo SCHEMA delle properties dell'audience. In Resend una custom property non
// nasce col contatto: va dichiarata prima (`POST /contact-properties`), altrimenti
// `POST /contacts` risponde 422 "One or more properties do not exist" — è ciò che
// ha fatto fallire 11/11 contatti il 2026-07-28. Chi aggiunge una property a
// `buildContactPayload` la aggiunge ANCHE qui, o il sync torna a fallire in blocco.
export const CONTACT_PROPERTY_KEYS = ["plan", "language", "lifecycle_stage", "cohort_month", "tenure_bucket", "promo_eligible"] as const;

/**
 * Anzianità dell'account come etichetta. Serve perché le properties Resend sono
 * stringhe: "iscritto negli ultimi 7 giorni" non si esprime come confronto su una
 * data dentro un Broadcast, ma su un'etichetta sì. Sostituisce i due segmenti
 * `joined_last_7d` e `tenure_30d_plus`, che il piano Resend (3 segmenti) non
 * permette di tenere come contenitori dedicati.
 * Le soglie ricalcano quelle delle regole in `segments`: <7gg e >=30gg.
 */
export function tenureBucket(createdAtISO: string, nowISO: string): "new_7d" | "mid_8_29d" | "30d_plus" {
  const days = (new Date(nowISO).getTime() - new Date(createdAtISO).getTime()) / 86400_000;
  if (days < 7) return "new_7d";
  if (days < 30) return "mid_8_29d";
  return "30d_plus";
}

// Le `properties` portano attributi stabili, riscritti per intero a ogni sync.
// Sono anche il modo in cui si filtra direttamente dentro un Broadcast, senza
// bisogno di un segmento: plan / language / lifecycle_stage / cohort_month.
export function buildContactPayload(
  c: SegmentContact,
  nowISO: string,
  promoEligible = false
): { email: string; first_name?: string; properties: Record<string, string> } {
  const firstName = c.name?.trim().split(/\s+/)[0];
  const properties: Record<string, string> = {
    plan: c.plan,
    language: c.language ?? "",
    lifecycle_stage: lifecycleStage(c, nowISO),
    cohort_month: cohortMonth(c.created_at),
    tenure_bucket: tenureBucket(c.created_at, nowISO),
    // #CRM-RESEND-ENGINE-0817 — il kill-switch della promo per l'automation Resend.
    // Le tre mail-offerta su Resend hanno la deadline scritta LETTERALE nel template
    // (là non si può leggere un'env), quindi senza questa property continuerebbero a
    // promettere −50% anche a promo spenta: è #CRM-FAKE-OFFERS-0805 che rientra, con
    // la differenza che il codice non potrebbe fermarlo. I tre nodi-offerta sono
    // gatati su `promo_eligible = "true"`, e la property nasce con fallback "false"
    // → in dubbio non si promette.
    // Default `false` nella firma di proposito: chi chiama senza calcolare
    // l'eleggibilità non finisce per promettere uno sconto per distrazione.
    promo_eligible: promoEligible ? "true" : "false",
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

/**
 * Crea/aggiorna su Resend il contatto di UN profilo, con le properties già scritte.
 *
 * #CRM-RESEND-CONTACT-FIRST-0817 — va chiamata PRIMA di `sendResendEvent`, e il
 * perché è l'intero senso di questa funzione. Le condizioni dell'automation leggono
 * `contact.lifecycle_stage`; il contatto però lo creerebbe l'evento stesso, e le
 * properties le scrive il sync delle 05:00. Chi si registra e attiva nello stesso
 * momento — il percorso NORMALE, minuti di distanza — sarebbe valutato con
 * `lifecycle_stage` ASSENTE, e siccome le properties nascono senza fallback (vedi
 * `ensureContactProperties`) `assente is not equal to "prospect"` è vero: su quei
 * nodi vero significa uscire. Risultato: l'utente esce a g0 e non riceve nulla.
 *
 * È la stessa forma del difetto che teneva morta l'automation di Steve
 * (`Deposit_Done`): una condizione che legge uno stato che non esiste ancora. La
 * cura è la stessa in entrambi i casi — far esistere lo stato prima che qualcuno
 * lo legga, non dare un fallback che mentirebbe sui paganti.
 *
 * Best-effort: ritorna `false` invece di lanciare. È sul percorso di attivazione.
 */
export async function loadProfileContact(identifier: string): Promise<SegmentContact | null> {
  const rows = await dbQuery<SegmentContact>(
    `SELECT id::text, identifier, name, plan, language, requested_plan,
            plan_expires_at::text, created_at::text, activated_at::text
       FROM profiles WHERE identifier = $1 LIMIT 1`,
    [identifier]
  );
  return rows[0] ?? null;
}

export async function upsertContactForActivation(
  identifier: string,
  // Cucitura per il test dell'ordine: la sola dipendenza non-HTTP di questa
  // funzione. Il default è la lettura vera; il test inietta un profilo finto
  // perché quello che va difeso è la SEQUENZA delle chiamate a Resend.
  loadContact: (id: string) => Promise<SegmentContact | null> = loadProfileContact
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.error("[resend-contacts] upsert pre-evento saltato: RESEND_API_KEY/RESEND_AUDIENCE_ID non configurate");
    return false;
  }
  try {
    const c = await loadContact(identifier);
    if (!c) {
      console.error("[resend-contacts] upsert pre-evento: profilo non trovato", identifier);
      return false;
    }
    // Stessa fonte del sync e del checkout, così le tre superfici non divergono.
    let promoEligible = false;
    try {
      promoEligible = (await promoEligibility(identifier)).firstPaidOrder;
    } catch (e) {
      console.error("[resend-contacts] promo eligibility fallita (pre-evento):", identifier, String(e));
    }
    await ensureContactProperties(apiKey);
    await upsertContact(audienceId, apiKey, buildContactPayload(c, new Date().toISOString(), promoEligible));
    return true;
  } catch (e) {
    console.error("[resend-contacts] upsert pre-evento fallito:", identifier, String(e));
    return false;
  }
}

/**
 * Fa entrare un profilo nell'automation di onboarding su Resend: contatto con le
 * properties PRIMA, evento DOPO. L'ordine è il contenuto di questa funzione, e sta
 * qui e non nella route perché è la cosa che regredisce in silenzio se qualcuno
 * riordina due righe.
 *
 * Se l'upsert del contatto non riesce l'evento NON parte, di proposito: un evento
 * su un contatto senza `lifecycle_stage` produce un run che scarta l'utente e in
 * Observability è indistinguibile da «ha funzionato». Meglio nessun run e una riga
 * di errore che dice cosa è mancato — l'utente si recupera dopo il sync.
 */
export async function enterResendOnboarding(
  identifier: string,
  loadContact: (id: string) => Promise<SegmentContact | null> = loadProfileContact
): Promise<boolean> {
  // #CRM-EXCLUDE-INTERNAL-0817 — il gate degli interni sta QUI e non solo in
  // `isEligible`, perché dal 17/08 l'acquisition non passa più dal motore CRM:
  // questa funzione crea il contatto in Audience e innesca l'automation, quindi è
  // l'unico punto che decide se un indirizzo entra nella sequenza. Un membro del
  // team che attiva un account con l'opt-in spuntato entrerebbe altrimenti nella
  // stessa scala di un cliente, e il gate del cron non lo vedrebbe mai.
  // (Il sync giornaliero è coperto a monte: i contatti arrivano da
  // buildSegmentQuery, che ora esclude gli interni in SQL.)
  if (isInternalIdentifier(identifier)) {
    console.log("[resend-contacts] interno: nessun ingresso nell'automation", identifier);
    return false;
  }
  const ready = await upsertContactForActivation(identifier, loadContact);
  if (!ready) {
    console.error(
      "[resend-contacts] evento NON inviato: contatto non pronto, l'automation scarterebbe il profilo",
      identifier
    );
    return false;
  }
  return sendResendEvent("Account_Activated", identifier);
}

/**
 * Spara un evento custom a Resend: è l'UNICA cosa che innesca una Automation
 * (#CRM-RESEND-ENGINE-0817). Un invio transazionale su `POST /emails` non ne
 * innesca nessuna — per questo `Onboarding_Automation` è rimasta a 0 run dal
 * giorno in cui è nata.
 *
 * Il contatto viene creato da Resend quando l'automation gira, quindi chiamare
 * questa funzione **è** un trattamento marketing: il chiamante deve verificare il
 * consenso PRIMA (vedi `app/api/auth/activate/route.ts`), non dopo.
 *
 * Best-effort per scelta: ritorna `false` invece di lanciare. È chiamata su un
 * percorso — l'attivazione dell'account — dove un errore di Resend non deve mai
 * costare l'accesso all'utente.
 */
export async function sendResendEvent(event: string, email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[resend-contacts] events/send saltato: RESEND_API_KEY non configurata");
    return false;
  }
  try {
    const r = await call(apiKey, "POST", "/events/send", { event, email });
    if (!r.ok) {
      console.error(`[resend-contacts] events/send ${event} -> ${r.status}`, JSON.stringify(r.json));
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[resend-contacts] events/send ${event} fallito:`, String(e));
    return false;
  }
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

/**
 * Dichiara su Resend le properties che il sync assegna ai contatti, creando solo
 * quelle mancanti. Idempotente: gira a ogni sync e in condizioni normali costa
 * una sola GET. Non tocca le properties di altri (es. `Reminder_Sequence_Completed`
 * usata dall'automation di Steve). Ritorna le chiavi create ora.
 */
export async function ensureContactProperties(apiKey: string): Promise<string[]> {
  const list = await call(apiKey, "GET", "/contact-properties?limit=100");
  if (!list.ok) {
    throw new Error(`Resend contact-properties list failed: ${list.status} ${JSON.stringify(list.json).slice(0, 160)}`);
  }
  const existing = new Set(
    listOf(list.json)
      .map((p) => (p as { key?: unknown }).key)
      .filter((k): k is string => typeof k === "string")
  );

  const created: string[] = [];
  for (const key of CONTACT_PROPERTY_KEYS) {
    if (existing.has(key)) continue;
    // type "string" per tutte: plan/language/lifecycle_stage/cohort_month sono
    // etichette, non misure. Nessun fallback_value → property assente ≠ "".
    const r = await call(apiKey, "POST", "/contact-properties", { key, type: "string" });
    if (!r.ok) {
      throw new Error(`Resend contact-property create failed for "${key}": ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
    }
    created.push(key);
  }
  return created;
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
    // Entrambi i body, POST per primo: è quello che porta la causa. Riportare solo
    // il PATCH mostrava "not_found" (il contatto non c'è perché il POST è fallito)
    // e nascondeva il vero errore, "One or more properties do not exist".
    throw new Error(
      `Resend contact upsert failed: POST ${created.status} ${JSON.stringify(created.json).slice(0, 160)}` +
        ` / PATCH ${patched.status} ${JSON.stringify(patched.json).slice(0, 80)}`
    );
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
): Promise<{ ok: number; failed: number; added: number; removed: number; errors: string[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  if (!audienceId) throw new Error("RESEND_AUDIENCE_ID not configured");

  const nowISO = new Date().toISOString();
  let ok = 0;
  let failed = 0;
  let added = 0;
  let removed = 0;
  // I motivi dei fallimenti risalgono al chiamante, non solo a console.error: i log
  // runtime non sono sempre leggibili (403 sul token) e `failed=11` da solo non dice
  // NIENTE su cosa fare. Cap a 5: serve la causa, non l'elenco completo.
  const errors: string[] = [];
  for (const c of contacts) {
    try {
      // #CRM-RESEND-ENGINE-0817 — l'eleggibilità la calcola `promoEligibility`, che è
      // già la fonte unica usata dal checkout e copre tutti e tre i rail (PayGate,
      // PayPal, carta Shopify) oltre a ritornare NOT_ELIGIBLE con la promo spenta.
      // Riscriverne qui una copia della SQL sarebbe la strada per farle divergere —
      // è già successo una volta, quando al conteggio mancava il rail carta.
      // Scorciatoia accettata: una query per contatto (N+1). Con l'Audience attuale
      // (14 contatti, sync una volta al giorno alle 05:00) è irrilevante; sopra il
      // migliaio va sostituita con un'unica query che ritorna gli identifier con
      // ordini pagati, calcolata prima del loop.
      // Fail-closed: se il controllo non risponde, `false` → offerte non promesse.
      let promoEligible = false;
      try {
        promoEligible = (await promoEligibility(c.identifier)).firstPaidOrder;
      } catch (e) {
        console.error("[resend-contacts] promo eligibility fallita:", c.identifier, String(e));
      }
      await upsertContact(audienceId, apiKey, buildContactPayload(c, nowISO, promoEligible));
      const want = new Set(wantIdsByContact.get(c.identifier) ?? []);
      const r = await reconcileContactSegments(apiKey, c.identifier, want, managedIds);
      added += r.added;
      removed += r.removed;
      ok++;
    } catch (e) {
      const msg = `${c.identifier}: ${String(e)}`;
      console.error("[resend-contacts] sync failed:", msg);
      if (errors.length < 5) errors.push(msg);
      failed++;
    }
  }
  return { ok, failed, added, removed, errors };
}
