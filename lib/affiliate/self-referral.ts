// lib/affiliate/self-referral.ts — #AFFILIATE-V2-0930
// Anti-self-referral OLTRE l'identificativo. Pura, niente DB: il chiamante le
// passa i fatti (identifier, email, fingerprint) delle due parti.
//
// Esiti (PROPOSAL-tecnica §4.2):
//  · `self_referral` — la commissione non nasce mai. Stesso identifier, stessa
//    email canonica, stesso fingerprint di pagamento o stesso device hash: è la
//    stessa persona con due account.
//  · `fraud_review`  — la commissione nasce ma resta ferma, sbloccata a mano.
//    Solo IP condiviso entro 24h: potrebbero essere due coinquilini, e punirli
//    in automatico sarebbe sbagliato.
//  · `valid`         — nessun segnale.

export type FingerprintKind =
  | "paypal_payer_id"
  | "stripe_card_fp"
  | "shopify_customer_id"
  | "email_canonical"
  | "ip_hash"
  | "device_hash";

export type Fingerprint = {
  kind: FingerprintKind;
  valueHash: string;
  /** ISO timestamp; serve solo per la finestra dell'IP. */
  seenAt: string;
};

export type Party = {
  identifier: string;
  /** Se assente e l'identifier è un'email, si usa quello. */
  email?: string | null;
  fingerprints?: Fingerprint[];
};

export type SelfReferralStatus = "valid" | "self_referral" | "fraud_review";

export type SelfReferralVerdict = { status: SelfReferralStatus; reason: string | null };

/** Fingerprint che, se condivisi, provano la stessa persona. */
const HARD_KINDS: ReadonlySet<FingerprintKind> = new Set([
  "paypal_payer_id",
  "stripe_card_fp",
  "shopify_customer_id",
  "email_canonical",
  "device_hash",
]);

export const IP_WINDOW_HOURS = 24;

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Email canonica: minuscole, senza `+tag`, e — SOLO per gmail — senza punti
 *  nella parte locale (per Gmail `a.x@` e `ax@` sono la stessa casella; per
 *  gli altri provider no, e unirli colpirebbe persone diverse). `null` se non
 *  è un'email. */
export function canonicalEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

function normId(s: string): string {
  return s.trim().toLowerCase();
}

function emailOf(p: Party): string | null {
  return canonicalEmail(p.email ?? (p.identifier.includes("@") ? p.identifier : null));
}

export function selfReferralCheck(affiliate: Party, referred: Party): SelfReferralVerdict {
  if (normId(affiliate.identifier) === normId(referred.identifier)) {
    return { status: "self_referral", reason: "same_identifier" };
  }

  const ea = emailOf(affiliate);
  const er = emailOf(referred);
  if (ea && er && ea === er) {
    return { status: "self_referral", reason: "same_canonical_email" };
  }

  const fa = affiliate.fingerprints ?? [];
  const fr = referred.fingerprints ?? [];

  for (const a of fa) {
    if (!HARD_KINDS.has(a.kind)) continue;
    if (fr.some((r) => r.kind === a.kind && r.valueHash === a.valueHash)) {
      return { status: "self_referral", reason: `shared_${a.kind}` };
    }
  }

  const windowMs = IP_WINDOW_HOURS * 3_600_000;
  for (const a of fa) {
    if (a.kind !== "ip_hash") continue;
    const ta = new Date(a.seenAt).getTime();
    for (const r of fr) {
      if (r.kind !== "ip_hash" || r.valueHash !== a.valueHash) continue;
      const tr = new Date(r.seenAt).getTime();
      // Una data illeggibile non prova niente: non si manda in revisione nessuno.
      if (Number.isNaN(ta) || Number.isNaN(tr)) continue;
      if (Math.abs(ta - tr) <= windowMs) {
        return { status: "fraud_review", reason: "shared_ip_24h" };
      }
    }
  }

  return { status: "valid", reason: null };
}
