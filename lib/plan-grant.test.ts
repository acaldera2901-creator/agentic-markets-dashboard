import { describe, it, expect, vi, beforeEach } from "vitest";

// #REFERRAL-V2-0808 — l'aggancio del referral ai cinque rail di pagamento.
// Questo file governa il DENARO: i test qui sotto inchiodano due cose che nessun
// test precedente copriva.
//   1. `checkReferralTiers` parte dopo OGNI grant riuscito, anche quando il piano
//      NON transiziona (premium → premium): è il caso dell'invitato che ha i 7
//      giorni regalati e poi paga.
//   2. Un errore del referral non può far fallire il grant.
//
// Il DB è mockato; `computePaygateGrant` resta reale (puro, già testato).
vi.mock("./db", () => ({
  dbQuery: vi.fn(),
  dbQueryStrict: vi.fn(),
  dbExecute: vi.fn(),
}));
vi.mock("./notify", () => ({ sendTransactional: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./referral-rewards", () => ({ checkReferralTiers: vi.fn().mockResolvedValue(undefined) }));

import {
  activateAdminPlan,
  activateStripePlan,
  activatePaygatePlan,
  activatePaypalPlan,
  activateShopifyPlan,
} from "./plan-grant";
import { checkReferralTiers } from "./referral-rewards";
import { dbQuery, dbQueryStrict, dbExecute } from "./db";

const ID = "invited@x.com";
const DAY = 86_400_000;
const future = () => new Date(Date.now() + 20 * DAY).toISOString();

type Profile = {
  identifier: string;
  name: string | null;
  plan: string;
  requested_plan: string | null;
  plan_expires_at: string | null;
  plan_source: string | null;
};

/** La riga di `profiles` che il DB mockato restituisce a tutti i rail. */
let profile: Profile | null;

/** `vi.clearAllMocks()` azzera le CHIAMATE ma NON le implementazioni: senza un
 *  reset esplicito il mock che lancia (test "se checkReferralTiers lancia")
 *  contamina i test successivi. */
function resetDb(p: Partial<Profile> = {}) {
  vi.clearAllMocks();
  profile = {
    identifier: ID,
    name: "Amico",
    plan: "free",
    requested_plan: null,
    plan_expires_at: null,
    plan_source: null,
    ...p,
  };
  const read = async (sql: string) => {
    // L'ordine conta: la SELECT della notifica combacia anche con /FROM profiles/.
    if (/INSERT INTO events/i.test(sql)) return [] as never;
    if (/plan_expires_at::text, language/i.test(sql)) return [{ plan_expires_at: null, language: "en" }] as never;
    // Stripe legge `plan AS old_plan`: la stessa riga serve entrambe le forme.
    if (/FROM profiles/i.test(sql)) {
      return (profile ? [{ ...profile, old_plan: profile.plan }] : []) as never;
    }
    return [] as never;
  };
  vi.mocked(dbQuery).mockImplementation(read as never);
  vi.mocked(dbQueryStrict).mockImplementation(read as never);
  vi.mocked(dbExecute).mockImplementation(async () => [] as never);
  vi.mocked(checkReferralTiers).mockImplementation(async () => undefined);
}

// Rete di sicurezza: ogni test ri-arma comunque il DB con lo stato che gli serve.
beforeEach(() => resetDb());

/** I cinque rail, ognuno col suo stato di partenza minimo per concedere. */
const RAILS: { name: string; start: Partial<Profile>; run: () => Promise<unknown> }[] = [
  {
    name: "admin (USDT)",
    start: { plan: "pending_payment", requested_plan: "premium" },
    run: () => activateAdminPlan(ID),
  },
  {
    name: "stripe",
    start: { plan: "free" },
    run: () => activateStripePlan(ID, "premium", "sub_1", null),
  },
  {
    name: "paygate",
    start: { plan: "free" },
    run: () => activatePaygatePlan(ID, "premium", "monthly"),
  },
  {
    name: "paypal",
    start: { plan: "free" },
    run: () => activatePaypalPlan(ID, "premium", "monthly"),
  },
  {
    name: "shopify",
    start: { plan: "free" },
    run: () => activateShopifyPlan(ID, "premium", "monthly"),
  },
];

describe("aggancio del referral ai rail di pagamento", () => {
  for (const rail of RAILS) {
    it(`${rail.name}: dopo un grant riuscito controlla i gradini`, async () => {
      resetDb(rail.start);
      const r = await rail.run();
      expect(r).not.toBeNull();
      expect(checkReferralTiers).toHaveBeenCalledTimes(1);
      expect(checkReferralTiers).toHaveBeenCalledWith(ID);
    });

    // I soldi sono arrivati: nessun errore del referral può annullare il grant.
    it(`${rail.name}: se checkReferralTiers lancia, il grant riesce comunque`, async () => {
      resetDb(rail.start);
      vi.mocked(checkReferralTiers).mockRejectedValue(new Error("boom"));
      const r = await rail.run();
      expect(r).not.toBeNull();
    });
  }
});

describe("il caso che il ramo della transizione perde", () => {
  // IL test del Task 3. L'invitato ha i 7 giorni di PRO regalati
  // (plan='premium', plan_source='referral') e poi PAGA: before.plan === plan,
  // quindi NESSUNA transizione e NESSUNA notifica. Se il controllo dei gradini
  // stesse dentro `if (before.plan !== plan)`, chi lo ha invitato non riceverebbe
  // mai credito per l'amico con la più alta probabilità di pagare.
  const gifted: Partial<Profile> = {
    plan: "premium",
    plan_source: "referral",
    plan_expires_at: future(),
  };

  it("shopify: premium → premium non notifica, ma conta per chi ha invitato", async () => {
    resetDb(gifted);

    const r = await activateShopifyPlan(ID, "premium", "monthly");

    expect(r).not.toBeNull();
    // Prova che NON c'è stata transizione: notifyPlanActivated scrive su `events`.
    const events = vi.mocked(dbQuery).mock.calls.filter((c) => /INSERT INTO events/i.test(String(c[0])));
    expect(events).toHaveLength(0);
    // …e nonostante ciò il conteggio è scattato.
    expect(checkReferralTiers).toHaveBeenCalledTimes(1);
    expect(checkReferralTiers).toHaveBeenCalledWith(ID);
  });

  it("stripe: rinnovo premium → premium senza notifica, gradini controllati", async () => {
    resetDb(gifted);

    await activateStripePlan(ID, "premium", "sub_1", null);

    expect(vi.mocked(dbQuery).mock.calls.filter((c) => /INSERT INTO events/i.test(String(c[0])))).toHaveLength(0);
    expect(checkReferralTiers).toHaveBeenCalledTimes(1);
  });

  it("paygate: rinnovo premium → premium senza notifica, gradini controllati", async () => {
    resetDb(gifted);

    await activatePaygatePlan(ID, "premium", "monthly");

    expect(vi.mocked(dbQuery).mock.calls.filter((c) => /INSERT INTO events/i.test(String(c[0])))).toHaveLength(0);
    expect(checkReferralTiers).toHaveBeenCalledTimes(1);
  });
});

describe("nessun grant, nessun controllo", () => {
  it("identifier inesistente: non concede e non controlla i gradini", async () => {
    resetDb();
    profile = null;

    expect(await activatePaygatePlan(ID, "premium", "monthly")).toBeNull();
    expect(await activateShopifyPlan(ID, "premium", "monthly")).toBeNull();
    expect(await activateStripePlan(ID, "premium", null, null)).toBeNull();
    expect(checkReferralTiers).not.toHaveBeenCalled();
  });

  it("admin: profilo non in pending_payment → nessun grant, nessun controllo", async () => {
    resetDb({ plan: "free", requested_plan: "premium" });
    expect(await activateAdminPlan(ID)).toBeNull();
    expect(checkReferralTiers).not.toHaveBeenCalled();
  });

  it("shopify bloccato dalla guardia PayGate: nessun controllo", async () => {
    resetDb({ plan: "premium", plan_source: "paygate", plan_expires_at: future() });
    expect(await activateShopifyPlan(ID, "premium", "monthly")).toBeNull();
    expect(dbExecute).not.toHaveBeenCalled();
    expect(checkReferralTiers).not.toHaveBeenCalled();
  });
});
