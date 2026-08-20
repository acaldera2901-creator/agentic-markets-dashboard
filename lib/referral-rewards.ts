// lib/referral-rewards.ts — #REFERRAL-V2-0808
// Unico posto che sa (a) chi conta come invitato pagante e (b) cosa si sblocca.
// Sta separato da plan-grant.ts perché quello owna il DENARO: qui si regala
// accesso, e i due non devono potersi confondere.
//
// I premi sono ACCESSO, mai denaro (vincolo VIA A, rischio #1 del go-live).
// I tier scritti qui devono restare dentro il CHECK della migration 015
// (`tier IN (0, 2, 5, 10)`): un gradino nuovo qui senza la migration esplode
// in prod sull'INSERT. Il test lo inchioda.

import { dbQueryStrict, dbExecute } from "./db";
import { internalInviteSpec } from "./internal-invite";
import { computePaygateGrant, type GrantablePlan } from "./plan-grant";

export const INVITEE_BONUS_DAYS = 7;

/** Il tier del bonus dell'invitato: sta nella stessa tabella dei gradini perché
 *  ha la stessa esigenza — concedere una volta sola. */
export const INVITEE_TIER = 0;

/** Il piano regalato dai premi. `plan_source = 'referral'` (scritto letterale
 *  nell'UPDATE, mai interpolato: lo vieta il guard di lib/sql-guard.test.ts)
 *  lo distingue da un piano pagato. */
const REWARD_PLAN: GrantablePlan = "premium";

export type ReferralTier = {
  tier: 2 | 5 | 10;
  /** Giorni di PRO regalati; `null` = il premio non è tempo (la stanza). */
  rewardDays: number | null;
  grantsRoom: boolean;
};

export const REFERRAL_TIERS: ReferralTier[] = [
  // 29 e non 30: deciso da Andrea (2026-08-08) per rispettare l'invariante
  // anti-arbitraggio — a 30 giorni il premio valeva $29.99 contro $29.98 di
  // costo minimo (2 × BASE) e l'invariante fallìva di un centesimo.
  { tier: 2, rewardDays: 29, grantsRoom: false },
  { tier: 5, rewardDays: 60, grantsRoom: false },
  { tier: 10, rewardDays: null, grantsRoom: true },
];

/** Stati del piano su cui NON si scrive un premio a giorni.
 *  · `pending_payment` — activateAdminPlan attiva SOLO da questo stato
 *    (`WHERE plan = 'pending_payment'`): sovrascriverlo regalando PRO farebbe
 *    perdere per sempre l'attivazione di un pagamento USDT già incassato.
 *  · `admin_full` — computePaygateGrant non lo conosce (rank 0) e lo
 *    declasserebbe a `premium`: un premio non deve togliere accesso.
 *  In entrambi i casi il gradino NON viene consumato — nessuna riga in
 *  referral_rewards — quindi si riprova al prossimo giro. */
const PLANS_NOT_OVERWRITABLE = new Set(["pending_payment", "admin_full"]);

/** I gradini raggiunti con N invitati paganti, in ordine crescente. */
export function reachedTiers(payingCount: number): number[] {
  return REFERRAL_TIERS.filter((t) => payingCount >= t.tier).map((t) => t.tier);
}

/** Invitati col mio codice che hanno pagato ALMENO UNA VOLTA.
 *  Guarda gli ordini granted, non profiles.plan: un amico che paga e poi
 *  disdice resta contato ⇒ il conteggio non regredisce mai.
 *  ⚠️ Le tabelle ordini oggi sono due; con PR #217 arriva Shopify: questa
 *  query è l'UNICO posto da aggiornare. */
export async function countPayingInvitees(code: string, selfIdentifier: string): Promise<number> {
  const rows = await dbQueryStrict<{ n: number | string }>(
    `SELECT COUNT(DISTINCT p.identifier)::int AS n
       FROM profiles p
       JOIN (
         SELECT identifier FROM paygate_orders WHERE granted_at IS NOT NULL
         UNION ALL
         SELECT identifier FROM paypal_orders  WHERE granted_at IS NOT NULL
       ) o ON o.identifier = p.identifier
      WHERE UPPER(p.referred_by) = $1
        AND p.identifier <> $2`,
    [code.toUpperCase(), selfIdentifier]
  );
  return Number(rows[0]?.n ?? 0);
}

/** Prende il gradino in esclusiva. INSERT poi SELECT di verifica: `exec_sql` non
 *  riporta né RETURNING né il rowcount, e lo UNIQUE (identifier, tier) della 015
 *  è il lock vero — due chiamate concorrenti non possono vincere entrambe.
 *  Chi perde la corsa riceve l'errore dello UNIQUE e NON concede. */
async function claimTier(identifier: string, tier: number, payingCount: number): Promise<boolean> {
  const before = await dbQueryStrict<{ n: number | string }>(
    "SELECT COUNT(*)::int AS n FROM referral_rewards WHERE identifier = $1 AND tier = $2",
    [identifier, tier]
  );
  if (Number(before[0]?.n ?? 0) > 0) return false; // già concesso

  try {
    await dbExecute(
      "INSERT INTO referral_rewards (identifier, tier, paying_count) VALUES ($1, $2, $3)",
      [identifier, tier, payingCount]
    );
  } catch (e) {
    // Unique race (l'ha preso un'altra chiamata) o errore DB: in entrambi i casi
    // non si concede. Un premio mancato si recupera a mano; uno doppio no.
    console.error(`[referral] claim del gradino ${tier} fallito per ${identifier}:`, String(e));
    return false;
  }

  const after = await dbQueryStrict<{ n: number | string }>(
    "SELECT COUNT(*)::int AS n FROM referral_rewards WHERE identifier = $1 AND tier = $2",
    [identifier, tier]
  );
  return Number(after[0]?.n ?? 0) === 1;
}

/** Regala `days` giorni di PRO **passando da computePaygateGrant**: stack del
 *  tempo residuo + anti-downgrade. Scrivere `NOW() + INTERVAL 'N days'`
 *  ACCORCEREBBE l'abbonamento di chi ha già PRO attivo — il premio diventerebbe
 *  una punizione. Ritorna il nuovo stato del piano per poter impilare più
 *  gradini nella stessa passata (29 + 60 = 89, non 60). */
async function grantRewardDays(
  identifier: string,
  days: number,
  current: { plan: string; expiryISO: string | null }
): Promise<{ plan: string; expiryISO: string }> {
  const { plan, expiryISO } = computePaygateGrant({
    currentPlan: current.plan,
    currentExpiryISO: current.expiryISO,
    purchasedPlan: REWARD_PLAN,
    days,
    nowISO: new Date().toISOString(),
  });

  // NB: `requested_plan` NON si azzera — a differenza dei rail pagati, un regalo
  // non deve cancellare l'intenzione d'acquisto dell'utente.
  await dbExecute(
    `UPDATE profiles
        SET plan = $2,
            plan_expires_at = $3::timestamptz,
            plan_source = 'referral',
            updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [identifier, plan, expiryISO]
  );
  return { plan, expiryISO };
}

// ── Il gradino 10: la stanza riservata ───────────────────────────────────────
// L'appartenenza NON è memorizzata. `profiles.referral_room_access` (015) è
// VESTIGIALE: il codice la scriveva solo a TRUE e nessuna riga la rimetteva a
// FALSE, quindi la stanza risultava eterna — l'opposto della promessa «finché
// resti attivo». Non si scrive più (nessun lettore in repo, verificato con grep
// il 2026-08-08); la colonna resta in prod perché un DROP è distruttivo e va
// approvato da Andrea, e la migration 016 le mette un COMMENT che lo dichiara.
// La verità si CALCOLA, in due specchi che devono restare identici:
//   · SQL  → vista `referral_room_members` (db/migrations/016) — la legge il bot
//   · TS   → hasRoomAccess() qui sotto — la legge il codice applicativo

/** Piano «attivo» ai fini della stanza. Specchio di `effectivePlan()`
 *  (lib/auth.ts), fail-closed incluso: solo `base`/`premium` contano
 *  (`admin_full` NO, la regola del gradino 10 è esplicitamente questa), una
 *  scadenza assente vale attiva (righe legacy) e una data CORROTTA nega
 *  l'accesso invece di renderlo eterno (#BUGCHECK-0617).
 *  Il confine dell'uguaglianza esatta (`t === now`) qui è attivo e nella vista
 *  no (`> NOW()`): non osservabile, NOW() ha risoluzione microsecondi. */
export function isRoomActivePlan(plan: string, expiresAtISO: string | null): boolean {
  if (plan !== "base" && plan !== "premium") return false;
  if (!expiresAtISO) return true;
  const t = new Date(expiresAtISO).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now();
}

/** È ADESSO nella stanza del gradino 10? Punto d'ingresso per il codice
 *  applicativo (il bot può interrogare direttamente la vista).
 *
 *  Legge i fatti grezzi e applica il predicato qui, invece di fare SELECT sulla
 *  vista: così la regola è testabile senza un Postgres, e la funzione non si
 *  rompe finché la 016 non è applicata. La riga tier = 10 è PERMANENTE, quindi
 *  chi scade e poi ri-paga rientra senza rifare i 10 inviti.
 *
 *  Il profilo si risolve come in lib/auth.ts (match esatto preferito a quello
 *  normalizzato) perché nel DB esistono profili che differiscono per sole
 *  maiuscole.
 *
 *  **Fail-LOUD**: un errore del DB LANCIA (dbQueryStrict) invece di rispondere
 *  `false`. Chi revoca l'accesso non deve poter confondere un singhiozzo di rete
 *  con «non è più membro» e buttare fuori un pagante (stesso motivo di
 *  MEDIUM-12 in lib/db.ts). `false` significa solo: non membro. */
export async function hasRoomAccess(identifier: string): Promise<boolean> {
  const rows = await dbQueryStrict<{
    plan: string;
    plan_expires_at: string | null;
    tier10: number | string;
  }>(
    `SELECT p.plan,
            p.plan_expires_at::text AS plan_expires_at,
            (SELECT COUNT(*)::int FROM referral_rewards r
              WHERE r.identifier = p.identifier AND r.tier = 10) AS tier10
       FROM profiles p
      WHERE p.identifier = $1 OR LOWER(TRIM(p.identifier)) = $1
      ORDER BY (p.identifier = $1) DESC, p.created_at ASC
      LIMIT 1`,
    [identifier]
  );
  const row = rows[0];
  if (!row) return false;
  if (Number(row.tier10 ?? 0) === 0) return false; // gradino 10 mai raggiunto
  return isRoomActivePlan(row.plan, row.plan_expires_at);
}

/** Chiamata dopo OGNI grant di pagamento riuscito, con l'identifier di chi ha
 *  pagato: risale al suo invitante e concede i gradini appena raggiunti.
 *
 *  **Non lancia mai.** Il chiamante è un rail di pagamento: un premio mancato si
 *  recupera dal log, un pagamento non concesso è un cliente perso. */
export async function checkReferralTiers(invitedIdentifier: string): Promise<void> {
  try {
    const me = await dbQueryStrict<{ referred_by: string | null }>(
      `SELECT referred_by FROM profiles
        WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
        LIMIT 1`,
      [invitedIdentifier]
    );
    const code = (me[0]?.referred_by ?? "").trim().toUpperCase();
    if (!code) return; // nessuna attribuzione: niente da fare

    // Il codice va risolto a un profilo REALE: `referred_by` alla registrazione
    // passa solo la regex, non un controllo di esistenza.
    const inviterRows = await dbQueryStrict<{
      identifier: string;
      plan: string;
      plan_expires_at: string | null;
    }>(
      `SELECT identifier, plan, plan_expires_at::text AS plan_expires_at
         FROM profiles
        WHERE UPPER(referral_code) = $1
        LIMIT 1`,
      [code]
    );
    const inviter = inviterRows[0];
    if (!inviter) return; // codice inesistente / orfano

    const payingCount = await countPayingInvitees(code, inviter.identifier);
    const tiers = reachedTiers(payingCount);
    if (!tiers.length) return;

    // Stato del piano tenuto localmente per impilare più gradini nella stessa
    // passata: chi arriva a 5 di colpo prende 29 + 60 giorni, non solo 60.
    let planState = { plan: inviter.plan, expiryISO: inviter.plan_expires_at };

    for (const tier of tiers) {
      const spec = REFERRAL_TIERS.find((t) => t.tier === tier);
      if (!spec) continue;

      // La guardia va PRIMA del claim: così un profilo non sovrascrivibile non
      // consuma il gradino e il premio resta concedibile al giro dopo.
      if (spec.rewardDays !== null && PLANS_NOT_OVERWRITABLE.has(planState.plan)) {
        console.error(
          `[referral] gradino ${tier} rinviato: ${inviter.identifier} è in stato '${planState.plan}'`
        );
        continue;
      }

      if (!(await claimTier(inviter.identifier, tier, payingCount))) continue;

      // INSERT-poi-grant: se il grant fallisce qui si perde UN premio
      // (recuperabile dal log); l'ordine inverso ne concederebbe due.
      if (spec.rewardDays !== null) {
        planState = await grantRewardDays(inviter.identifier, spec.rewardDays, planState);
      }
      // `spec.grantsRoom` non fa scattare nessuna scrittura: la riga appena
      // inserita in referral_rewards È il premio, e l'appartenenza si calcola da
      // lì (hasRoomAccess / vista referral_room_members). Alzare un flag lo
      // rendeva irrevocabile.
      console.log(
        `[referral] gradino ${tier} concesso a ${inviter.identifier} (invitati paganti: ${payingCount})`
      );
    }
  } catch (e) {
    // Rete di sicurezza: qualunque cosa vada storta, il rail di pagamento a
    // monte non se ne accorge.
    console.error(`[referral] check dei gradini fallito per ${invitedIdentifier}:`, String(e));
  }
}

/** Il bonus dell'INVITATO: 7 giorni di PRO all'attivazione, se si è registrato
 *  con un codice che esiste davvero. Registrato con `tier = 0` per l'idempotenza.
 *
 *  #INTERNAL-INVITE-0813 — un codice INTERNO (lib/internal-invite, da env) passa
 *  da qui con i SUOI giorni e senza proprietario: è un link che mandiamo a mano,
 *  non il referral di un utente. Lo slot resta lo stesso (tier 0), quindi una
 *  persona prende UN bonus e quale dipende dal link con cui è entrata.
 *
 *  **Non lancia mai** (ritorna false): un bonus mancato non deve impedire
 *  un'attivazione. Ritorna true solo se i giorni sono stati concessi ora. */
export async function grantInviteeBonus(identifier: string): Promise<boolean> {
  try {
    const rows = await dbQueryStrict<{
      referred_by: string | null;
      plan: string;
      plan_expires_at: string | null;
    }>(
      `SELECT referred_by, plan, plan_expires_at::text AS plan_expires_at
         FROM profiles
        WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1
        LIMIT 1`,
      [identifier]
    );
    const me = rows[0];
    const code = (me?.referred_by ?? "").trim().toUpperCase();
    if (!me || !code) return false;

    // Un codice interno non ha proprietario per definizione: la sua autorità è
    // la env, quindi il controllo sotto va SALTATO (non allentato).
    const internal = internalInviteSpec(code);
    const days = internal ? internal.days : INVITEE_BONUS_DAYS;

    if (!internal) {
      // Il codice deve esistere su un ALTRO profilo. Senza questo controllo
      // chiunque si registra con ?ref=QUALSIASICOSA si prende 7 giorni di PRO:
      // alla registrazione `referred_by` passa solo la regex.
      const owner = await dbQueryStrict<{ n: number | string }>(
        `SELECT COUNT(*)::int AS n FROM profiles
          WHERE UPPER(referral_code) = $1 AND identifier <> $2`,
        [code, identifier]
      );
      if (Number(owner[0]?.n ?? 0) === 0) return false;
    }

    if (PLANS_NOT_OVERWRITABLE.has(me.plan)) {
      console.error(`[referral] bonus invitato rinviato: ${identifier} è in stato '${me.plan}'`);
      return false;
    }

    // paying_count = 0: il bonus non dipende da un conteggio, la colonna è
    // NOT NULL e per il tier 0 il valore d'audit è appunto zero.
    if (!(await claimTier(identifier, INVITEE_TIER, 0))) return false;

    await grantRewardDays(identifier, days, {
      plan: me.plan,
      expiryISO: me.plan_expires_at,
    });
    console.log(
      `[referral] bonus invitato di ${days} giorni concesso a ${identifier} (codice ${code}${internal ? ", interno" : ""})`
    );
    return true;
  } catch (e) {
    console.error(`[referral] bonus invitato fallito per ${identifier}:`, String(e));
    return false;
  }
}
