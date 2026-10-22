// La logica (proporzione, residuo, maturazione, finestra, idempotenza, corse)
// sta nella funzione SQL ed è provata su Postgres vero in pg.integration.test.ts.
// Qui il contratto dei rail: off = no-op, argomenti giusti, errore = mai throw + alert.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/db", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
const after = vi.fn();
vi.mock("next/server", () => ({ after }));
const opsAlert = vi.fn(async () => undefined);
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));

const { reverseAffiliateCommissionSafe, scheduleAffiliateReversal } = await import("./reversal");

const input = { rail: "shopify" as const, paymentRef: " o1 ", eventRef: "r1", refundedGrossUsd: 12.5 };
const saved = process.env.AFFILIATE_MODE;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.AFFILIATE_MODE = "shadow";
  delete process.env.AFFILIATE_CLAWBACK_DAYS;
});
afterEach(() => {
  if (saved === undefined) delete process.env.AFFILIATE_MODE;
  else process.env.AFFILIATE_MODE = saved;
});

describe("reverseAffiliateCommissionSafe", () => {
  it("off → no-op senza RPC, schedule non registra after()", async () => {
    process.env.AFFILIATE_MODE = "off";
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: false, reason: "mode_off" });
    scheduleAffiliateReversal(input);
    expect(after).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("chiama la funzione SQL con ref ripulita e CLAWBACK_DAYS di config", async () => {
    rpc.mockResolvedValue({ data: { ok: true, written: true, reason: "reversal", status: "pending", amount: -2.5 }, error: null });
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: true, reason: "reversal" });
    expect(rpc).toHaveBeenCalledWith("affiliate_reverse_commission", {
      p_rail: "shopify",
      p_ref: "o1",
      p_event: "r1",
      p_refunded: 12.5,
      p_clawback_days: 120,
    });
  });

  it("DB giù → non lancia, alert con i dati per ripeterlo dall'endpoint admin", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: false, reason: "error" });
    expect(opsAlert).toHaveBeenCalledWith("affiliate-reversal", [
      expect.stringMatching(/payment_ref= o1 .*event_ref=r1 refunded_usd=12\.5/),
    ]);
  });

  it("schedule: il lavoro gira dentro after(), non subito", () => {
    scheduleAffiliateReversal(input);
    expect(after).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});
