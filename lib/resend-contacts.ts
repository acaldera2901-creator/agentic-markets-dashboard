// lib/resend-contacts.ts
// Sync dei contatti verso Resend per i segmenti marketing (#BO-SEGMENTS-FASE1).
// REST, no SDK (coerente con lib/email.ts). NESSUN invio email: solo upsert
// contatti nell'Audience. `unsubscribed` non è MAI incluso negli upsert, così
// un re-sync non re-iscrive chi si è disiscritto (la scelta vive su Resend).

const RESEND_CONTACTS_ENDPOINT = "https://api.resend.com/contacts";
const EXPIRING_WINDOW_DAYS = 7;

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

// L'appartenenza ai segmenti è espressa SOLO tramite l'array `segments` (i doc
// Resend mostrano che si assegna al contatto). Le `properties` portano solo
// attributi stabili (plan/language/lifecycle/cohort), riscritti per intero a
// ogni sync → nessuna proprietà "seg_*" stale da ripulire.
export function buildContactPayload(
  c: SegmentContact,
  matchedSegmentKeys: string[],
  nowISO: string
): { email: string; first_name?: string; properties: Record<string, string>; segments: string[] } {
  const firstName = c.name?.trim().split(/\s+/)[0];
  const properties: Record<string, string> = {
    plan: c.plan,
    language: c.language ?? "",
    lifecycle_stage: lifecycleStage(c, nowISO),
    cohort_month: cohortMonth(c.created_at),
  };
  const payload: { email: string; first_name?: string; properties: Record<string, string>; segments: string[] } = {
    email: c.identifier,
    properties,
    segments: matchedSegmentKeys,
  };
  if (firstName) payload.first_name = firstName;
  return payload;
}

async function upsertContact(
  audienceId: string,
  apiKey: string,
  payload: ReturnType<typeof buildContactPayload>
): Promise<void> {
  // ASSUNZIONE da VERIFICARE live in Task 8 (gated): `POST /contacts` con
  // audience_id nel body fa UPSERT per email e l'array `segments` SOSTITUISCE
  // l'appartenenza; `first_name`/`properties` sono accettati in snake_case.
  // I doc Resend non lo esplicitano → il primo sync reale conferma verbo e
  // semantica prima del go-live. `unsubscribed` non è MAI inviato.
  const resp = await fetch(RESEND_CONTACTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audience_id: audienceId, ...payload }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend contact upsert failed: ${resp.status} ${body.slice(0, 200)}`);
  }
}

// Upsert di un insieme di contatti. `segmentKeysByContact` mappa identifier →
// TUTTE le key dei segmenti che il contatto matcha ora (appartenenza completa).
export async function syncSegmentToResend(
  contacts: SegmentContact[],
  segmentKeysByContact: Map<string, string[]>
): Promise<{ ok: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  if (!audienceId) throw new Error("RESEND_AUDIENCE_ID not configured");

  const nowISO = new Date().toISOString();
  let ok = 0;
  let failed = 0;
  for (const c of contacts) {
    const keys = segmentKeysByContact.get(c.identifier) ?? [];
    try {
      await upsertContact(audienceId, apiKey, buildContactPayload(c, keys, nowISO));
      ok++;
    } catch (e) {
      console.error(`[resend-contacts] upsert ${c.identifier} failed:`, String(e));
      failed++;
    }
  }
  return { ok, failed };
}
