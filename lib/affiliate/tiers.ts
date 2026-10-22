// lib/affiliate/tiers.ts — #AFFILIATE-TIERS-1021
// Scaglioni sui RINNOVI: più referiti paganti ha un affiliato, più alta è la
// percentuale su ogni rinnovo. Decisione di Michele (21/10/2026): solo sugli
// abbonamenti BetRedge, nessuna quota su partner/casinò, nessun multilivello
// (la PK di affiliate_attributions lo rende impossibile per costruzione).
//
// Il primo acquisto resta al tasso piatto (AFFILIATE_FIRST_RATE): lo scaglione
// premia la rete che resta abbonata, non il singolo colpo.
//
// Scala da env `AFFILIATE_RENEWAL_TIERS` = "<minimo>:<tasso>,…", es. "5:0.10,15:0.15":
//   da 5 referiti paganti il rinnovo paga il 10 %, da 15 il 15 %. Sotto il primo
//   minimo vale il tasso base (AFFILIATE_RENEWAL_RATE, oggi 7 %). "none" spegne
//   gli scaglioni. Env assente → DEFAULT_TIERS. Env malformata → DEFAULT_TIERS
//   (mai un valore inventato, come il resto di config.ts).
//
// Un referito «pagante» = ha almeno una riga positiva (first/renewal) nel
// ledger non stornata. Si conta al momento di ogni commissione, quindi lo
// scaglione sale appena il referito n-esimo paga e vale da quel pagamento in
// poi, su TUTTI i rinnovi dell'affiliato (è il premio alla rete). Il tasso
// applicato resta scritto riga per riga in affiliate_commissions.rate: la
// storia non si riscrive mai.

export type TierStep = { min: number; rate: number };

/** Scala proposta il 21/10/2026 (PROPOSAL al gate): 7 % base → 10 % da 5 → 15 % da 15. */
export const DEFAULT_TIERS: readonly TierStep[] = [
  { min: 5, rate: 0.1 },
  { min: 15, rate: 0.15 },
];

/** Parsing fail-safe: ogni gradino "min:rate" con min intero ≥ 1 e rate in [0, 1];
 *  gradini ordinati per minimo crescente e tasso crescente, altrimenti la scala
 *  è incoerente e si torna al default. "none" (o "off") = nessuno scaglione. */
export function parseTiers(raw: string | undefined, fallback: readonly TierStep[] = DEFAULT_TIERS): TierStep[] {
  if (raw == null || raw.trim() === "") return [...fallback];
  const t = raw.trim().toLowerCase();
  if (t === "none" || t === "off") return [];
  const steps: TierStep[] = [];
  for (const part of t.split(",")) {
    const m = part.trim().match(/^(\d+)\s*:\s*(\d*\.?\d+)$/);
    if (!m) return [...fallback];
    const min = Number(m[1]);
    const rate = Number(m[2]);
    if (!Number.isInteger(min) || min < 1 || !Number.isFinite(rate) || rate < 0 || rate > 1) return [...fallback];
    steps.push({ min, rate });
  }
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].min <= steps[i - 1].min || steps[i].rate <= steps[i - 1].rate) return [...fallback];
  }
  return steps;
}

export type TierPosition = {
  /** 0 = tasso base; 1, 2, … = gradino raggiunto. */
  level: number;
  /** Tasso sui rinnovi in vigore per questo conteggio. */
  rate: number;
  /** Referiti paganti contati. */
  payingReferred: number;
  /** Prossimo gradino, o null se è l'ultimo. */
  next: TierStep | null;
};

/** Il tasso sui rinnovi per `payingReferred` referiti paganti. Una scala vuota
 *  o un conteggio sotto il primo minimo → tasso base. Un gradino con tasso
 *  inferiore alla base non abbassa mai (gli scaglioni solo alzano). */
export function tierFor(payingReferred: number, baseRate: number, tiers: readonly TierStep[]): TierPosition {
  const n = Number.isFinite(payingReferred) && payingReferred > 0 ? Math.floor(payingReferred) : 0;
  let level = 0;
  let rate = baseRate;
  let next: TierStep | null = null;
  for (let i = 0; i < tiers.length; i++) {
    if (n >= tiers[i].min) {
      level = i + 1;
      rate = Math.max(rate, tiers[i].rate);
    } else {
      next = tiers[i];
      break;
    }
  }
  return { level, rate, payingReferred: n, next };
}

export function renewalRateFor(payingReferred: number, baseRate: number, tiers: readonly TierStep[]): number {
  return tierFor(payingReferred, baseRate, tiers).rate;
}

/** SQL del conteggio: referiti distinti con almeno un acquisto non interamente
 *  rimborsato (termini §3), cioè con saldo positivo tra le righe positive e i
 *  loro storni (reversal.ts: uno storno non supera mai la sua commissione, e
 *  uno storno totale pre-maturazione porta tutto a `reversed`, fuori da qui).
 *  Le righe `shadow` contano solo in modalità shadow (prova), mai in live: una
 *  scala costruita su commissioni di prova non deve pagare. Unico posto che lo
 *  sa, così ledger e pannello contano la stessa cosa. */
export function payingReferredSql(mode: "shadow" | "live" | "off"): { sql: string } {
  const statuses = mode === "shadow" ? "('shadow','pending','payable','in_payout','paid')" : "('pending','payable','in_payout','paid')";
  return {
    sql: `SELECT COUNT(*)::int AS n FROM (
       SELECT referred_identifier
         FROM affiliate_commissions
        WHERE affiliate_id = $1
          AND status IN ${statuses}
        GROUP BY referred_identifier
       HAVING SUM(amount_usd) > 0
     ) paying`,
  };
}
