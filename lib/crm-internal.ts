// lib/crm-internal.ts — chi è "interno" e quindi NON è un cliente da coltivare.
//
// #CRM-EXCLUDE-INTERNAL-0817. Misurato il 17/08: in sei settimane il lifecycle
// CRM ha scritto a 9 indirizzi e 8 erano del team o di persone vicine (soci,
// account di prova, referral interni). Su 20 profili circa 11 sono interni.
// Effetto pratico: il team riceve email da cliente ("il tuo accesso scade",
// "ultima occasione") su acquisti di test, e legge quello come "l'automazione
// non funziona". Effetto peggiore: gli stessi indirizzi stanno nell'Audience
// Resend, da cui si compongono i Broadcast.
//
// Perché un modulo unico invece di due controlli: la regola di idoneità ESISTE
// GIÀ in due copie — `isEligible` in lib/crm.ts (motore CRM, TypeScript) ed
// `eligibilitySql` in lib/segments.ts (Audience, SQL) — e il 27/07 erano
// divergenti per un mese (il consenso stava solo nella prima). Qui il predicato
// e il frammento SQL nascono dalla stessa lista: aggiungere un indirizzo lo
// toglie da entrambe le superfici, o da nessuna.
//
// Config in env, non in repo: sono email di persone reali (niente PII nel
// codice) e la lista cambia senza deploy.
//   CRM_INTERNAL_IDENTIFIERS="a@x.io, b@y.com"   (match esatto)
//   CRM_INTERNAL_DOMAINS="mavenagency.io"        (match esatto sul dominio)
// A env vuote il gate resta comunque attivo sul solo suffisso .local (sotto).

// RFC 6762: `.local` è riservato al mDNS e non è consegnabile via SMTP. Un
// indirizzo che finisce così è per costruzione un account di prova (li generiamo
// noi come qa-prod-<ts>@betredge-test.local), mai un cliente: vale sempre, non
// serve configurarlo, e non è un dato personale da tenere in env.
const UNDELIVERABLE_SUFFIX = ".local";

function listFromEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function internalIdentifiers(): string[] {
  return listFromEnv("CRM_INTERNAL_IDENTIFIERS");
}

export function internalDomains(): string[] {
  // Un dominio scritto come "@maven.io" o "maven.io" vale uguale: chi configura
  // non deve indovinare la forma.
  return listFromEnv("CRM_INTERNAL_DOMAINS").map((d) => d.replace(/^@/, ""));
}

function domainOf(identifier: string): string {
  const at = identifier.lastIndexOf("@");
  return at === -1 ? "" : identifier.slice(at + 1);
}

/**
 * true = fuori dal CRM e fuori dall'Audience. Deve restare allineato a
 * internalSqlFragment(): i test verificano che le due strade diano lo stesso
 * verdetto sugli stessi indirizzi.
 */
export function isInternalIdentifier(identifier: string | null | undefined): boolean {
  const id = (identifier ?? "").trim().toLowerCase();
  if (!id) return false;
  if (id.endsWith(UNDELIVERABLE_SUFFIX)) return true;
  if (internalIdentifiers().includes(id)) return true;
  const domain = domainOf(id);
  return domain !== "" && internalDomains().includes(domain);
}

/**
 * Lo stesso filtro in SQL, per le query che selezionano i profili direttamente
 * (Audience/segmenti). `startIndex` è il primo $n libero del chiamante; i valori
 * passano SOLO come params, perché lib/db interpola i $n come literal e la
 * whitelist è l'unica difesa da injection (vedi testa di lib/segments.ts).
 */
export function internalSqlFragment(startIndex: number): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  // Il guard .local non ha parametri: `right(...)` confronta il suffisso esatto,
  // così non serve una LIKE con caratteri da escapare.
  const parts: string[] = [
    `right(lower(identifier), ${UNDELIVERABLE_SUFFIX.length}) <> '${UNDELIVERABLE_SUFFIX}'`,
  ];
  let n = startIndex;
  for (const id of internalIdentifiers()) {
    parts.push(`lower(identifier) <> $${n}`);
    params.push(id);
    n += 1;
  }
  for (const domain of internalDomains()) {
    parts.push(`split_part(lower(identifier), '@', 2) <> $${n}`);
    params.push(domain);
    n += 1;
  }
  return { sql: parts.join(" AND "), params };
}
