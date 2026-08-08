import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Il DB è mockato; `computePaygateGrant` resta REALE (è puro e già testato):
// il test #1 verifica proprio che il grant passi da lì e non da un
// `NOW() + INTERVAL` che accorcerebbe un abbonamento attivo.
vi.mock("./db", () => ({
  dbQuery: vi.fn().mockResolvedValue([]),
  dbQueryStrict: vi.fn().mockResolvedValue([]),
  dbExecute: vi.fn().mockResolvedValue([]),
}));

import {
  REFERRAL_TIERS,
  INVITEE_BONUS_DAYS,
  reachedTiers,
  countPayingInvitees,
  checkReferralTiers,
  grantInviteeBonus,
  hasRoomAccess,
  isRoomActivePlan,
} from "./referral-rewards";
import { planAmountUsdt, PUBLIC_PLAN_KEYS } from "./commercial-plan";
import { dbQueryStrict, dbExecute } from "./db";

const DAY = 86_400_000;

// ── Prezzi: LETTI da commercial-plan, mai hardcodati ─────────────────────────
const PRO_MONTHLY = planAmountUsdt("premium");
const CHEAPEST_PAID = Math.min(...PUBLIC_PLAN_KEYS.map((k) => planAmountUsdt(k)));

describe("reachedTiers", () => {
  it("sotto la prima soglia non sblocca niente", () => {
    expect(reachedTiers(0)).toEqual([]);
    expect(reachedTiers(1)).toEqual([]);
  });
  it("a 2 sblocca il primo gradino", () => {
    expect(reachedTiers(2)).toEqual([2]);
  });
  it("a 5 ha i primi due", () => {
    expect(reachedTiers(5)).toEqual([2, 5]);
  });
  it("a 10 li ha sbloccati tutti e tre", () => {
    expect(reachedTiers(10)).toEqual([2, 5, 10]);
  });
  it("oltre la soglia massima non inventa gradini", () => {
    expect(reachedTiers(50)).toEqual([2, 5, 10]);
  });
});

describe("la scala combacia con il CHECK della migration 015", () => {
  // Il CHECK è `tier IN (0, 2, 5, 10)`: 0 = bonus invitato, il resto i gradini.
  // Se qui si aggiunge un gradino senza toccare la 015, l'INSERT esplode in prod.
  it("i tier dell'helper sono un sottoinsieme di {0,2,5,10}", () => {
    const allowed = new Set([0, 2, 5, 10]);
    for (const t of REFERRAL_TIERS) expect(allowed.has(t.tier)).toBe(true);
    expect(allowed.has(0)).toBe(true); // il tier del bonus invitato
  });
  it("solo il gradino della stanza non concede giorni", () => {
    const roomless = REFERRAL_TIERS.filter((t) => t.rewardDays === null);
    expect(roomless.map((t) => t.tier)).toEqual([10]);
    expect(roomless.every((t) => t.grantsRoom)).toBe(true);
  });
});

describe("invariante anti-arbitraggio", () => {
  // Per ogni gradino: il premio non deve valere più di quanto costa sbloccarlo,
  // altrimenti il programma regala prodotto invece di acquisire utenti.
  // I prezzi si LEGGONO da commercial-plan: se domani cambiano, questo test
  // diventa rosso invece di lasciare aperto un arbitraggio.
  it("nessun gradino è economicamente farmabile", () => {
    for (const t of REFERRAL_TIERS) {
      if (t.rewardDays === null) continue; // la stanza non ha valore monetario
      const rewardValue = PRO_MONTHLY * (t.rewardDays / 30);
      const attackCost = t.tier * CHEAPEST_PAID;
      expect(rewardValue).toBeLessThanOrEqual(attackCost);
    }
  });

  it("il bonus dell'invitato non supera il piano più economico", () => {
    expect(PRO_MONTHLY * (INVITEE_BONUS_DAYS / 30)).toBeLessThanOrEqual(CHEAPEST_PAID);
  });
});

// ── Helper per pilotare il DB mockato ────────────────────────────────────────
/** `vi.clearAllMocks()` azzera le CHIAMATE ma NON le implementazioni: senza
 *  questo reset i mock che lanciano (test dello UNIQUE, test del DB rotto)
 *  contaminavano i test successivi. */
function resetDb() {
  vi.clearAllMocks();
  vi.mocked(dbQueryStrict).mockImplementation(async () => [] as never);
  vi.mocked(dbExecute).mockImplementation(async () => [] as never);
}

/** Coda di risposte per dbQueryStrict, consumata nell'ordine delle chiamate. */
function queueReads(...responses: unknown[][]) {
  const q = [...responses];
  vi.mocked(dbQueryStrict).mockImplementation(async () => (q.shift() ?? []) as never);
}

/** L'ultimo UPDATE su profiles passato a dbExecute, coi suoi parametri. */
function lastProfileUpdate(): { sql: string; params: unknown[] } | null {
  const calls = vi.mocked(dbExecute).mock.calls.filter((c) => /UPDATE profiles/i.test(String(c[0])));
  const last = calls[calls.length - 1];
  return last ? { sql: String(last[0]), params: (last[1] ?? []) as unknown[] } : null;
}

const INVITER = "inviter@x.com";
const INVITED = "friend@x.com";

/** Le letture nell'ordine esatto in cui checkReferralTiers le fa:
 *  referred_by dell'invitato → invitante+piano dal codice → conteggio →
 *  per ogni gradino: pre-check di idempotenza (+ verifica post-INSERT se claimato). */
function tierReads(opts: {
  referredBy: string | null;
  inviterPlan?: string;
  inviterExpiry?: string | null;
  payingCount?: number;
  alreadyGranted?: number[];
}) {
  const plan = opts.inviterPlan ?? "free";
  const reads: unknown[][] = [[{ referred_by: opts.referredBy }]];
  if (!opts.referredBy) return reads;
  reads.push([{ identifier: INVITER, plan, plan_expires_at: opts.inviterExpiry ?? null }]);
  reads.push([{ n: opts.payingCount ?? 0 }]); // countPayingInvitees
  const granted = opts.alreadyGranted ?? [];
  const overwritable = plan !== "pending_payment" && plan !== "admin_full";
  for (const tier of reachedTiers(opts.payingCount ?? 0)) {
    const givesDays = REFERRAL_TIERS.find((t) => t.tier === tier)!.rewardDays !== null;
    if (givesDays && !overwritable) continue; // guardia PRIMA del claim: nessuna lettura
    reads.push([{ n: granted.includes(tier) ? 1 : 0 }]); // pre-check idempotenza
    if (granted.includes(tier)) continue;
    reads.push([{ n: 1 }]); // verifica post-INSERT
  }
  return reads;
}

describe("countPayingInvitees", () => {
  beforeEach(resetDb);

  it("conta i pagamenti AVVENUTI, non gli abbonati attivi, ed esclude sé stessi", async () => {
    queueReads([{ n: 3 }]);
    const n = await countPayingInvitees("amico", INVITER);
    expect(n).toBe(3);

    const [sql, params] = vi.mocked(dbQueryStrict).mock.calls[0] as [string, unknown[]];
    // Monotonia: la sorgente sono gli ordini granted, mai profiles.plan.
    expect(sql).toMatch(/granted_at IS NOT NULL/);
    expect(sql).not.toMatch(/plan IN/i);
    // Anti self-referral e codice normalizzato in UPPER.
    expect(sql).toMatch(/identifier <> \$2/);
    expect(params).toEqual(["AMICO", INVITER]);
  });
});

describe("checkReferralTiers — il grant dei gradini", () => {
  beforeEach(resetDb);

  // Test #1 del piano: il premio ESTENDE, non accorcia.
  it("con PRO attivo a 20 giorni, il premio da 29 porta a 49 giorni", async () => {
    const now = Date.now();
    const expiry = new Date(now + 20 * DAY).toISOString();
    queueReads(...tierReads({ referredBy: "AMICO", inviterPlan: "premium", inviterExpiry: expiry, payingCount: 2 }));

    await checkReferralTiers(INVITED);

    const upd = lastProfileUpdate();
    expect(upd).not.toBeNull();
    // Se qualcuno riscrive `plan_expires_at = NOW() + INTERVAL '29 days'`
    // questo test diventa rosso: la nuova scadenza sarebbe a 29 giorni, non 49.
    expect(upd!.sql).not.toMatch(/INTERVAL/i);
    const newExpiry = new Date(String(upd!.params[2])).getTime();
    const days = (newExpiry - now) / DAY;
    expect(days).toBeGreaterThan(48.9);
    expect(days).toBeLessThan(49.1);
    expect(upd!.params[1]).toBe("premium");
    expect(upd!.sql).toMatch(/plan_source = 'referral'/);
  });

  it("senza piano attivo il premio parte da ora (29 giorni)", async () => {
    const now = Date.now();
    queueReads(...tierReads({ referredBy: "AMICO", inviterPlan: "free", inviterExpiry: null, payingCount: 2 }));

    await checkReferralTiers(INVITED);

    const days = (new Date(String(lastProfileUpdate()!.params[2])).getTime() - now) / DAY;
    expect(days).toBeGreaterThan(28.9);
    expect(days).toBeLessThan(29.1);
  });

  // Test #2 del piano: idempotenza.
  it("un gradino già in referral_rewards non viene concesso una seconda volta", async () => {
    queueReads(...tierReads({ referredBy: "AMICO", payingCount: 2, alreadyGranted: [2] }));

    await checkReferralTiers(INVITED);

    expect(vi.mocked(dbExecute).mock.calls.filter((c) => /INSERT INTO referral_rewards/i.test(String(c[0])))).toHaveLength(0);
    expect(lastProfileUpdate()).toBeNull();
  });

  it("se l'INSERT perde la corsa sullo UNIQUE, il premio NON si concede", async () => {
    queueReads(...tierReads({ referredBy: "AMICO", payingCount: 2 }));
    vi.mocked(dbExecute).mockImplementation(async (sql: string) => {
      if (/INSERT INTO referral_rewards/i.test(sql)) throw new Error("duplicate key value violates unique constraint");
      return [] as never;
    });

    await checkReferralTiers(INVITED);

    expect(lastProfileUpdate()).toBeNull();
  });

  // Test #5 del piano.
  it("un utente senza referred_by non fa nulla e non lancia", async () => {
    queueReads(...tierReads({ referredBy: null }));
    await expect(checkReferralTiers(INVITED)).resolves.toBeUndefined();
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("un referred_by che non corrisponde a nessun codice non concede nulla", async () => {
    queueReads([{ referred_by: "CODICEINVENTATO" }], []); // nessun invitante
    await checkReferralTiers(INVITED);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  // Test #6 del piano: il chiamante è un rail di pagamento.
  it("col DB che throwa, risolve comunque senza lanciare", async () => {
    vi.mocked(dbQueryStrict).mockRejectedValue(new Error("boom"));
    await expect(checkReferralTiers(INVITED)).resolves.toBeUndefined();
  });

  // «altri 60 giorni, cumulativi coi 29 del gradino precedente» (spec §1.3):
  // chi arriva a 5 in un colpo deve prendere 89 giorni, non 60.
  it("due gradini nella stessa passata si impilano (29 + 60 = 89)", async () => {
    const now = Date.now();
    queueReads(...tierReads({ referredBy: "AMICO", inviterPlan: "free", payingCount: 5 }));

    await checkReferralTiers(INVITED);

    const days = (new Date(String(lastProfileUpdate()!.params[2])).getTime() - now) / DAY;
    expect(days).toBeGreaterThan(88.9);
    expect(days).toBeLessThan(89.1);
  });

  it("il gradino 10 non scrive nessun flag e non tocca i giorni", async () => {
    queueReads(...tierReads({ referredBy: "AMICO", payingCount: 10 }));

    await checkReferralTiers(INVITED);

    // Il premio è la riga referral_rewards, non un flag: `referral_room_access`
    // sapeva solo diventare TRUE ⇒ stanza eterna. Ora l'appartenenza si calcola.
    const room = vi.mocked(dbExecute).mock.calls.filter((c) => /referral_room_access/i.test(String(c[0])));
    expect(room).toHaveLength(0);
    // Tre gradini raggiunti, ma solo due concedono giorni.
    const dayGrants = vi.mocked(dbExecute).mock.calls.filter((c) => /plan_source = 'referral'/.test(String(c[0])));
    expect(dayGrants).toHaveLength(2);
  });

  it("i tre gradini insieme registrano il conteggio del momento per l'audit", async () => {
    queueReads(...tierReads({ referredBy: "AMICO", payingCount: 10 }));

    await checkReferralTiers(INVITED);

    const inserts = vi.mocked(dbExecute).mock.calls.filter((c) => /INSERT INTO referral_rewards/i.test(String(c[0])));
    expect(inserts.map((c) => (c[1] as unknown[])[1])).toEqual([2, 5, 10]);
    for (const ins of inserts) expect((ins[1] as unknown[])[2]).toBe(10);
  });

  it("NON scrive su un profilo in pending_payment: il rail USDT attiva solo da lì", async () => {
    const reads = tierReads({ referredBy: "AMICO", inviterPlan: "pending_payment", payingCount: 2 });
    queueReads(...reads);

    await checkReferralTiers(INVITED);

    expect(lastProfileUpdate()).toBeNull();
    // Il gradino NON viene consumato: nessuna riga scritta, si riprova.
    expect(vi.mocked(dbExecute).mock.calls.filter((c) => /INSERT INTO referral_rewards/i.test(String(c[0])))).toHaveLength(0);
  });
});

describe("grantInviteeBonus", () => {
  beforeEach(resetDb);

  it("con un codice valido concede 7 giorni di PRO e registra il tier 0", async () => {
    const now = Date.now();
    queueReads(
      [{ referred_by: "AMICO", plan: "free", plan_expires_at: null }],
      [{ n: 1 }], // il codice esiste su un altro profilo
      [{ n: 0 }], // nessun bonus già preso
      [{ n: 1 }] // verifica post-INSERT
    );

    await expect(grantInviteeBonus(INVITED)).resolves.toBe(true);

    const ins = vi.mocked(dbExecute).mock.calls.find((c) => /INSERT INTO referral_rewards/i.test(String(c[0])));
    expect((ins![1] as unknown[])[1]).toBe(0);
    const upd = lastProfileUpdate()!;
    expect(upd.params[1]).toBe("premium");
    const days = (new Date(String(upd.params[2])).getTime() - now) / DAY;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("senza referred_by non concede niente", async () => {
    queueReads([{ referred_by: null, plan: "free", plan_expires_at: null }]);
    await expect(grantInviteeBonus(INVITED)).resolves.toBe(false);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  // Il buco vero: referred_by alla registrazione passa solo la regex, non un
  // controllo di esistenza. Senza validazione, ?ref=QUALSIASICOSA = 7 giorni gratis.
  it("un codice che non esiste non concede il bonus", async () => {
    queueReads([{ referred_by: "CODICEINVENTATO", plan: "free", plan_expires_at: null }], [{ n: 0 }]);
    await expect(grantInviteeBonus(INVITED)).resolves.toBe(false);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("il bonus si concede una volta sola", async () => {
    queueReads([{ referred_by: "AMICO", plan: "free", plan_expires_at: null }], [{ n: 1 }], [{ n: 1 }]);
    await expect(grantInviteeBonus(INVITED)).resolves.toBe(false);
    expect(lastProfileUpdate()).toBeNull();
  });

  it("col DB che throwa non lancia: un'attivazione non deve fallire per un bonus", async () => {
    vi.mocked(dbQueryStrict).mockRejectedValue(new Error("boom"));
    await expect(grantInviteeBonus(INVITED)).resolves.toBe(false);
  });
});

// ── La stanza del gradino 10: il premio finisce quando finisce il piano ──────
// Il buco che questi test chiudono: `profiles.referral_room_access` veniva
// scritto SOLO a TRUE e da nessuna parte a FALSE ⇒ stanza di fatto eterna,
// contro la promessa «finché resti attivo». Ora l'appartenenza si CALCOLA.

/** La riga che `hasRoomAccess` legge: gradino 10 raggiunto o no, piano, scadenza. */
function roomRow(opts: { tier10: boolean; plan: string; expiry: string | null }) {
  return [{ plan: opts.plan, plan_expires_at: opts.expiry, tier10: opts.tier10 ? 1 : 0 }];
}

const MEMBER = "member@x.com";

describe("hasRoomAccess", () => {
  beforeEach(resetDb);

  it("gradino 10 + premium non scaduto ⇒ membro", async () => {
    queueReads(roomRow({ tier10: true, plan: "premium", expiry: new Date(Date.now() + 10 * DAY).toISOString() }));
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(true);
  });

  it("gradino 10 + piano scaduto ieri ⇒ NON membro (è la revoca che mancava)", async () => {
    queueReads(roomRow({ tier10: true, plan: "premium", expiry: new Date(Date.now() - DAY).toISOString() }));
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(false);
  });

  it("gradino 10 + plan 'free' ⇒ NON membro", async () => {
    queueReads(roomRow({ tier10: true, plan: "free", expiry: null }));
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(false);
  });

  it("scaduto e poi ri-pagato ⇒ membro di nuovo, senza rifare i 10 inviti", async () => {
    // La riga tier = 10 in referral_rewards non si perde: cambia solo il piano.
    queueReads(
      roomRow({ tier10: true, plan: "premium", expiry: new Date(Date.now() - DAY).toISOString() }),
      roomRow({ tier10: true, plan: "premium", expiry: new Date(Date.now() + 30 * DAY).toISOString() })
    );
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(false);
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(true);
    // Il rientro non richiede NESSUNA scrittura: niente da ri-concedere.
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("gradino 10 non raggiunto + premium attivo ⇒ NON membro", async () => {
    queueReads(roomRow({ tier10: false, plan: "premium", expiry: new Date(Date.now() + 10 * DAY).toISOString() }));
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(false);
  });

  it("piano a pagamento con scadenza NULL (righe legacy) ⇒ membro, come effectivePlan", async () => {
    queueReads(roomRow({ tier10: true, plan: "base", expiry: null }));
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(true);
  });

  it("profilo inesistente ⇒ NON membro", async () => {
    queueReads([]);
    await expect(hasRoomAccess(MEMBER)).resolves.toBe(false);
  });

  it("legge il gradino 10 e risolve il profilo come lib/auth.ts", async () => {
    queueReads(roomRow({ tier10: true, plan: "premium", expiry: null }));
    await hasRoomAccess(MEMBER);
    const [sql, params] = vi.mocked(dbQueryStrict).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/r\.tier = 10/);
    // Il flag memorizzato non deve rientrare dalla finestra.
    expect(sql).not.toMatch(/referral_room_access/i);
    // Match esatto preferito al normalizzato: nel DB esistono profili che
    // differiscono per sole maiuscole.
    expect(sql).toMatch(/LOWER\(TRIM\(p\.identifier\)\) = \$1/);
    expect(params).toEqual([MEMBER]);
  });

  // Al contrario dei rail di pagamento, qui il fail-closed sarebbe PEGGIORE:
  // un singhiozzo del DB butterebbe fuori un pagante dalla stanza.
  it("con il DB rotto LANCIA, non risponde 'non è membro'", async () => {
    vi.mocked(dbQueryStrict).mockRejectedValue(new Error("boom"));
    await expect(hasRoomAccess(MEMBER)).rejects.toThrow(/boom/);
  });
});

describe("isRoomActivePlan — specchio di effectivePlan", () => {
  it("una data di scadenza CORROTTA nega l'accesso, non lo rende eterno", () => {
    // #BUGCHECK-0617: `NaN < Date.now()` è false, quindi senza il fail-closed
    // una riga con data corrotta resterebbe attiva per sempre.
    expect(isRoomActivePlan("premium", "non-una-data")).toBe(false);
  });
  it("admin_full non è nella stanza: la regola del gradino 10 è base/premium", () => {
    expect(isRoomActivePlan("admin_full", null)).toBe(false);
  });
  it("pending_payment non è un piano attivo", () => {
    expect(isRoomActivePlan("pending_payment", null)).toBe(false);
  });
});

describe("la vista 016 e hasRoomAccess non possono divergere in silenzio", () => {
  // Due specchi della stessa regola (SQL per il bot, TS per l'app): se qualcuno
  // ne cambia uno solo, questo test diventa rosso.
  const MIGRATION = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations", "016_referral_room_view.sql"),
    "utf8"
  );

  it("la vista calcola la stessa condizione: tier 10 + piano a pagamento non scaduto", () => {
    expect(MIGRATION).toMatch(/CREATE OR REPLACE VIEW public\.referral_room_members/);
    expect(MIGRATION).toMatch(/r\.tier = 10/);
    expect(MIGRATION).toMatch(/plan IN \('base', 'premium'\)/);
    expect(MIGRATION).toMatch(/plan_expires_at IS NULL OR p\.plan_expires_at > NOW\(\)/);
  });

  it("la vista non è un canale di lettura per anon/authenticated", () => {
    // Le viste in PG girano coi permessi del PROPRIETARIO se non lo dichiarano:
    // senza questo, la vista scavalcherebbe l'RLS di referral_rewards (015).
    expect(MIGRATION).toMatch(/security_invoker\s*=\s*true/);
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.referral_room_members FROM anon, authenticated/);
  });

  it("nessuno rimette in vita il flag vestigiale", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "referral-rewards.ts"), "utf8");
    expect(src).not.toMatch(/referral_room_access\s*=\s*TRUE/i);
  });
});
