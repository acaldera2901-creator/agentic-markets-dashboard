import { describe, expect, it, vi } from "vitest";

const dbQueryStrict = vi.fn();
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbExecute: vi.fn(), dbQuery: vi.fn() }));
const record = vi.fn(async () => ({ written: true, reason: "pending" }));
vi.mock("./ledger", () => ({ recordAffiliateCommissionSafe: record }));
const { reconcileAffiliateLedger } = await import("./reconcile");

const row = (ref: string, rail = "paygate") => ({ rail, ref, identifier: "u@t.com", gross: 14.99, paid_at: "2026-10-01 10:00:00+00" });

describe("reconcileAffiliateLedger", () => {
  it("modalità recovery, data reale dell'incasso, Shopify solo segnalato", async () => {
    dbQueryStrict.mockResolvedValueOnce([row("pg-1"), row("s-1", "shopify")]);
    const r = await reconcileAffiliateLedger();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ paymentRef: "pg-1", recovery: true, paidAt: new Date("2026-10-01T10:00:00Z") }));
    expect(r).toEqual({ checked: 2, written: 1, reasons: { pending: 1 }, shopify_manual: ["s-1"], truncated: false });
  });

  it("budget di tempo esaurito → si ferma e lo dice (il resto al giro dopo)", async () => {
    record.mockClear();
    dbQueryStrict.mockResolvedValueOnce([row("a"), row("b"), row("c")]);
    let t = 0;
    const r = await reconcileAffiliateLedger(() => (t += 25_000));
    expect(record).toHaveBeenCalledTimes(1);
    expect(r.truncated).toBe(true);
  });
});
