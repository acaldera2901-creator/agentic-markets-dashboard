import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fake minimale del DB per il ledger: risponde alle SUE query per pattern e
// tiene in memoria attribuzioni e commissioni, con lo stesso vincolo della
// migration (una sola riga positiva per rail + rail_payment_ref).
type Commission = { rail: string; ref: string; referred: string; kind: string; amount: number; status: string; params: unknown[] };
const state = {
  referredBy: "AFF1" as string | null,
  affiliate: { id: 7, identifier: "aff@x.com" } as { id: number; identifier: string } | null,
  fingerprints: [] as { identifier: string; kind: string; value_hash: string; seen_at: string }[],
  attributions: new Map<string, { affiliate_id: number; status: string }>(),
  commissions: [] as Commission[],
  down: false,
};

async function fakeDb(sql: string, params: unknown[] = []): Promise<unknown[]> {
  if (state.down) throw new Error("db down");
  if (/FROM affiliate_attributions/.test(sql)) {
    const a = state.attributions.get(String(params[0]));
    return a ? [a] : [];
  }
  if (/FROM profiles/.test(sql)) return state.referredBy === undefined ? [] : [{ referred_by: state.referredBy }];
  if (/FROM affiliates/.test(sql)) return state.affiliate ? [state.affiliate] : [];
  if (/FROM affiliate_payer_fingerprints/.test(sql)) return state.fingerprints;
  if (/INSERT INTO affiliate_attributions/.test(sql)) {
    const key = String(params[0]);
    if (!state.attributions.has(key)) {
      state.attributions.set(key, { affiliate_id: Number(params[1]), status: String(params[2]) });
    }
    return [];
  }
  if (/COUNT\(\*\)::int AS n FROM affiliate_commissions\s+WHERE rail = \$1/.test(sql)) {
    return [{ n: state.commissions.filter((c) => c.rail === params[0] && c.ref === params[1]).length }];
  }
  if (/COUNT\(\*\)::int AS n FROM affiliate_commissions\s+WHERE referred_identifier = \$1/.test(sql)) {
    return [{ n: state.commissions.filter((c) => c.referred === params[0]).length }];
  }
  if (/INSERT INTO affiliate_commissions/.test(sql)) {
    const [, referred, rail, ref, kind, , , , amount, , status] = params as [unknown, string, string, string, string, unknown, unknown, unknown, number, unknown, string];
    if (!state.commissions.some((c) => c.rail === rail && c.ref === ref)) {
      state.commissions.push({ rail, ref, referred, kind, amount, status, params });
    }
    return [];
  }
  throw new Error(`query inattesa nel test: ${sql}`);
}

const dbQueryStrict = vi.fn(fakeDb);
const dbExecute = vi.fn(fakeDb);
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbExecute, dbQuery: vi.fn() }));

const { recordAffiliateCommissionSafe, decideCommission } = await import("./ledger");

const CFG = { firstRate: 0.2, renewalRate: 0.07, renewalMaxMonths: null as number | null, holdDays: 60 };
const PAID = new Date("2026-10-01T12:00:00Z");
const input = (over: Partial<Parameters<typeof recordAffiliateCommissionSafe>[0]> = {}) => ({
  identifier: "u@t.com",
  rail: "paypal" as const,
  paymentRef: "pp-1",
  grossUsd: 14.99,
  paidAt: PAID,
  ...over,
});

const savedMode = process.env.AFFILIATE_MODE;
beforeEach(() => {
  vi.clearAllMocks();
  state.referredBy = "AFF1";
  state.affiliate = { id: 7, identifier: "aff@x.com" };
  state.fingerprints = [];
  state.attributions = new Map();
  state.commissions = [];
  state.down = false;
  process.env.AFFILIATE_MODE = "shadow";
  delete process.env.AFFILIATE_RENEWAL_MAX_MONTHS;
});
afterEach(() => {
  if (savedMode === undefined) delete process.env.AFFILIATE_MODE;
  else process.env.AFFILIATE_MODE = savedMode;
  delete process.env.AFFILIATE_RENEWAL_MAX_MONTHS;
});

describe("decideCommission (pura)", () => {
  const base = { mode: "shadow" as const, config: CFG, attributionStatus: "valid" as const, netUsd: 14.99, paidAt: PAID };

  it("20% sul primo acquisto, 7% dal secondo", () => {
    expect(decideCommission({ ...base, renewalIndex: 0 })).toMatchObject({ write: true, kind: "first", rate: 0.2, amountUsd: 3 });
    expect(decideCommission({ ...base, renewalIndex: 1 })).toMatchObject({ write: true, kind: "renewal", rate: 0.07, amountUsd: 1.05 });
  });

  it("RENEWAL_MAX_MONTHS=12: il 12° rinnovo paga, il 13° no", () => {
    const capped = { ...base, config: { ...CFG, renewalMaxMonths: 12 } };
    expect(decideCommission({ ...capped, renewalIndex: 12 }).write).toBe(true);
    expect(decideCommission({ ...capped, renewalIndex: 13 })).toEqual({ write: false, reason: "renewal_cap" });
  });

  it("RENEWAL_MAX_MONTHS=null non ferma mai", () => {
    expect(decideCommission({ ...base, renewalIndex: 500 }).write).toBe(true);
  });

  it("shadow → status shadow; live → pending; hold di 60 giorni", () => {
    const s = decideCommission({ ...base, renewalIndex: 0 });
    const l = decideCommission({ ...base, mode: "live", renewalIndex: 0 });
    expect(s).toMatchObject({ status: "shadow", payableAfterISO: "2026-11-30T12:00:00.000Z" });
    expect(l).toMatchObject({ status: "pending" });
  });

  it("off, self_referral, void → niente; fraud_review → scrive (resta ferma a mano)", () => {
    expect(decideCommission({ ...base, mode: "off", renewalIndex: 0 }).write).toBe(false);
    expect(decideCommission({ ...base, attributionStatus: "self_referral", renewalIndex: 0 }).write).toBe(false);
    expect(decideCommission({ ...base, attributionStatus: "void", renewalIndex: 0 }).write).toBe(false);
    expect(decideCommission({ ...base, attributionStatus: "fraud_review", renewalIndex: 0 }).write).toBe(true);
  });

  it("netto 0 → nessuna riga", () => {
    expect(decideCommission({ ...base, netUsd: 0, renewalIndex: 0 })).toEqual({ write: false, reason: "zero_amount" });
  });
});

describe("recordAffiliateCommissionSafe", () => {
  it("AFFILIATE_MODE=off (o assente): no-op totale, nessuna query", async () => {
    delete process.env.AFFILIATE_MODE;
    expect(await recordAffiliateCommissionSafe(input())).toEqual({ written: false, reason: "mode_off" });
    process.env.AFFILIATE_MODE = "off";
    expect(await recordAffiliateCommissionSafe(input())).toEqual({ written: false, reason: "mode_off" });
    expect(dbQueryStrict).not.toHaveBeenCalled();
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("shadow, prima conversione: congela l'attribuzione e scrive una riga first al 20% in shadow", async () => {
    const r = await recordAffiliateCommissionSafe(input({ identifier: " U@T.com " }));
    expect(r).toEqual({ written: true, reason: "shadow" });
    expect(state.attributions.get("u@t.com")).toEqual({ affiliate_id: 7, status: "valid" });
    expect(state.commissions).toHaveLength(1);
    const c = state.commissions[0];
    expect(c).toMatchObject({ rail: "paypal", ref: "pp-1", referred: "u@t.com", kind: "first", amount: 3, status: "shadow" });
    // gross, net, rate, renewal_index, paid_at, payable_after
    expect(c.params.slice(5, 8)).toEqual([14.99, 14.99, 0.2]);
    expect(c.params[9]).toBe(0);
    expect(c.params.slice(11)).toEqual(["2026-10-01T12:00:00.000Z", "2026-11-30T12:00:00.000Z"]);
  });

  it("il rinnovo successivo è renewal al 7%, e non rilegge più referred_by", async () => {
    await recordAffiliateCommissionSafe(input());
    state.referredBy = null; // anche se il profilo cambiasse, l'attribuzione è congelata
    const r = await recordAffiliateCommissionSafe(input({ paymentRef: "pp-2" }));
    expect(r.written).toBe(true);
    expect(state.commissions.map((c) => [c.kind, c.amount])).toEqual([["first", 3], ["renewal", 1.05]]);
  });

  it("doppia consegna PayPal (capture + webhook, stessa ref): una riga sola", async () => {
    await recordAffiliateCommissionSafe(input());
    const second = await recordAffiliateCommissionSafe(input());
    expect(second).toEqual({ written: false, reason: "duplicate" });
    expect(state.commissions).toHaveLength(1);
  });

  it("RENEWAL_MAX_MONTHS=12 da env: la 14ª consegna (13° rinnovo) non scrive", async () => {
    process.env.AFFILIATE_RENEWAL_MAX_MONTHS = "12";
    for (let i = 0; i < 13; i++) await recordAffiliateCommissionSafe(input({ paymentRef: `pp-${i}` }));
    const r = await recordAffiliateCommissionSafe(input({ paymentRef: "pp-13" }));
    expect(r).toEqual({ written: false, reason: "renewal_cap" });
    expect(state.commissions).toHaveLength(13);
  });

  it("live → riga pending", async () => {
    process.env.AFFILIATE_MODE = "live";
    expect(await recordAffiliateCommissionSafe(input())).toEqual({ written: true, reason: "pending" });
    expect(state.commissions[0].status).toBe("pending");
  });

  it("self-referral (il proprio codice): attribuzione marcata, nessuna commissione", async () => {
    state.affiliate = { id: 7, identifier: "u@t.com" };
    const r = await recordAffiliateCommissionSafe(input());
    expect(r).toEqual({ written: false, reason: "attribution_self_referral" });
    expect(state.attributions.get("u@t.com")?.status).toBe("self_referral");
    expect(state.commissions).toHaveLength(0);
  });

  it("device condiviso fra affiliato e referito → self_referral", async () => {
    state.fingerprints = [
      { identifier: "aff@x.com", kind: "device_hash", value_hash: "d1", seen_at: "2026-09-01T00:00:00Z" },
      { identifier: "u@t.com", kind: "device_hash", value_hash: "d1", seen_at: "2026-09-30T00:00:00Z" },
    ];
    expect((await recordAffiliateCommissionSafe(input())).reason).toBe("attribution_self_referral");
  });

  it("senza referred_by o con affiliato non iscritto/attivo: nessuna attribuzione, nessuna riga", async () => {
    state.referredBy = null;
    expect((await recordAffiliateCommissionSafe(input())).reason).toBe("not_attributed");
    state.referredBy = "AFF1";
    state.affiliate = null;
    expect((await recordAffiliateCommissionSafe(input())).reason).toBe("not_attributed");
    expect(state.attributions.size).toBe(0);
    expect(state.commissions).toHaveLength(0);
  });

  it("importo ignoto (Shopify amount NULL) → nessuna commissione", async () => {
    const r = await recordAffiliateCommissionSafe(input({ rail: "shopify", grossUsd: null }));
    expect(r).toEqual({ written: false, reason: "net_unresolved" });
    expect(state.commissions).toHaveLength(0);
  });

  it("tasse dedotte dal netto", async () => {
    await recordAffiliateCommissionSafe(input({ rail: "shopify", grossUsd: 18.29, meta: { taxUsd: 3.3 } }));
    expect(state.commissions[0].params.slice(5, 9)).toEqual([18.29, 14.99, 0.2, 3]);
  });

  it("DB giù: non lancia mai, ritorna error", async () => {
    state.down = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordAffiliateCommissionSafe(input())).resolves.toEqual({ written: false, reason: "error" });
    spy.mockRestore();
  });

  it("paidAt non valido: non lancia", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordAffiliateCommissionSafe(input({ paidAt: new Date("garbage") }))).resolves.toMatchObject({ written: false });
    spy.mockRestore();
  });
});
