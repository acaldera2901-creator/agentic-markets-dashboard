import { describe, it, expect, vi, beforeEach } from "vitest";

// #REFERRAL-V2-0808 — quello che questi test difendono:
// `paid` (abbonati ATTIVI ora) era una metrica che regrediva: un amico che paga e
// poi disdice sparisce dal contatore, e con lui il premio già concesso. `paying`
// conta i PAGAMENTI AVVENUTI (ordini con granted_at) e non torna mai indietro.
// Il conteggio vero vive in lib/referral-rewards.ts: qui NON lo mockiamo, così il
// test inchioda anche l'SQL che lo implementa.

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const getSessionPlan = vi.fn();

vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/auth", () => ({ getSessionPlan }));

const ME = "creator@x.com";
const req = () => new Request("https://x/api/referral/stats");

/** Il DB mockato risponde in base all'SQL, non all'ordine delle chiamate: il
 *  route può riordinare le query senza rendere il test verde per caso. */
type Fixture = {
  myCode?: string | null;
  signups?: number;
  /** Ordini granted degli invitati (il conteggio di countPayingInvitees). */
  payingInvitees?: number;
  /** Gradini già concessi: tier → granted_at. */
  granted?: Record<number, string>;
  /** Simula la 015 non ancora applicata in Supabase. */
  rewardsTableMissing?: boolean;
};

function mockDb(f: Fixture) {
  const route = (sql: string) => {
    if (/referral_code\s+FROM profiles/.test(sql)) {
      return [{ referral_code: f.myCode === undefined ? "AMICO" : f.myCode }];
    }
    if (/AS signups/.test(sql)) return [{ signups: f.signups ?? 0 }];
    if (/FROM referral_rewards/.test(sql)) {
      if (f.rewardsTableMissing) throw new Error('relation "referral_rewards" does not exist');
      return Object.entries(f.granted ?? {}).map(([tier, granted_at]) => ({
        tier: Number(tier),
        granted_at,
      }));
    }
    // countPayingInvitees (lib/referral-rewards, dbQueryStrict)
    if (/paygate_orders/.test(sql)) return [{ n: f.payingInvitees ?? 0 }];
    return [];
  };
  const impl = async (sql: string) => route(String(sql));
  dbQuery.mockImplementation(impl);
  dbQueryStrict.mockImplementation(impl);
}

/** `vi.clearAllMocks()` azzera le chiamate ma NON le implementazioni. */
beforeEach(() => {
  vi.clearAllMocks();
  dbQuery.mockReset();
  dbQueryStrict.mockReset();
  dbExecute.mockReset();
  getSessionPlan.mockReset();
  getSessionPlan.mockResolvedValue({ identifier: ME, plan: "free", name: null, plan_expires_at: null });
  dbExecute.mockResolvedValue([]);
  mockDb({});
});

describe("GET /api/referral/stats", () => {
  // IL test: l'invitato ha pagato e adesso è tornato free. `paid` lo perdeva.
  it("torna paying (pagamenti avvenuti), non gli abbonati attivi", async () => {
    mockDb({ myCode: "AMICO", signups: 3, payingInvitees: 1 });

    const { GET } = await import("./route");
    const body = await (await GET(req())).json();

    expect(body.paying).toBe(1);
    // L'SQL che conta guarda granted_at, MAI profiles.plan: un `plan IN (...)`
    // qui è la regressione che riporta il bug.
    const countSql = String(
      [...dbQuery.mock.calls, ...dbQueryStrict.mock.calls].map((c) => String(c[0])).find((s) => /paygate_orders/.test(s))
    );
    expect(countSql).toMatch(/granted_at IS NOT NULL/);
    expect(countSql).not.toMatch(/plan IN/);
  });

  it("signups resta (non rompe la UI attuale) e paid non c'è più", async () => {
    mockDb({ myCode: "AMICO", signups: 4, payingInvitees: 2 });

    const { GET } = await import("./route");
    const body = await (await GET(req())).json();

    expect(body).toMatchObject({ code: "AMICO", signups: 4, paying: 2 });
    expect(body).not.toHaveProperty("paid");
    // I giorni dell'amico arrivano dall'helper: il pannello non li hardcoda.
    expect(body.inviteeBonusDays).toBe(7);
  });

  it("torna lo stato dei tre gradini, con i giorni di premio", async () => {
    mockDb({
      myCode: "AMICO",
      signups: 9,
      payingInvitees: 5,
      granted: { 2: "2026-08-01T10:00:00Z", 5: "2026-08-07T10:00:00Z" },
    });

    const { GET } = await import("./route");
    const body = await (await GET(req())).json();

    expect(body.tiers).toEqual([
      { tier: 2, reached: true, granted_at: "2026-08-01T10:00:00Z", rewardDays: 29, grantsRoom: false },
      { tier: 5, reached: true, granted_at: "2026-08-07T10:00:00Z", rewardDays: 60, grantsRoom: false },
      { tier: 10, reached: false, granted_at: null, rewardDays: null, grantsRoom: true },
    ]);
  });

  // Il tier 0 è il bonus dell'INVITATO: non è un gradino del programma di invito
  // e non deve comparire fra i tre.
  it("il tier 0 (bonus invitato) non entra nei gradini", async () => {
    mockDb({ myCode: "AMICO", payingInvitees: 0, granted: { 0: "2026-08-02T10:00:00Z" } });

    const { GET } = await import("./route");
    const body = await (await GET(req())).json();

    expect(body.tiers.map((t: { tier: number }) => t.tier)).toEqual([2, 5, 10]);
    expect(body.tiers.every((t: { granted_at: string | null }) => t.granted_at === null)).toBe(true);
  });

  it("senza codice claimato resta 403 con la ragione", async () => {
    mockDb({ myCode: null });

    const { GET } = await import("./route");
    const res = await GET(req());

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/referral code/i);
  });

  it("401 senza sessione", async () => {
    getSessionPlan.mockResolvedValue(null);
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
  });

  // La 015 si applica a mano in Supabase, quindi il codice può girare prima della
  // tabella: in quel caso il pannello deve continuare a mostrare il link e gli
  // iscritti, non morire.
  it("senza la tabella dei premi risponde comunque con code e signups", async () => {
    mockDb({ myCode: "AMICO", signups: 6, payingInvitees: 2, rewardsTableMissing: true });

    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ code: "AMICO", signups: 6 });
    expect(body.tiers.every((t: { granted_at: string | null }) => t.granted_at === null)).toBe(true);
  });

  // Anti-enumerazione (audit #1): il proprio identifier resta escluso dai conteggi,
  // altrimenti chi si registra col proprio codice si conta da solo.
  it("esclude sé stesso dai conteggi", async () => {
    mockDb({ myCode: "AMICO", signups: 1, payingInvitees: 1 });
    const { GET } = await import("./route");
    await GET(req());

    const calls = [...dbQuery.mock.calls, ...dbQueryStrict.mock.calls];
    const signupsCall = calls.find((c) => /AS signups/.test(String(c[0])));
    const countCall = calls.find((c) => /paygate_orders/.test(String(c[0])));
    expect(signupsCall?.[1]).toEqual(["AMICO", ME]);
    expect(countCall?.[1]).toEqual(["AMICO", ME]);
  });
});
