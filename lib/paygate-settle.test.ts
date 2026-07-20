import { describe, it, expect, vi, beforeEach } from "vitest";

// evaluateCallback resta reale (puro); mock solo di checkPaymentStatus e delle
// dipendenze DB/grant per isolare la logica di settlePendingOrder.
vi.mock("@/lib/paygate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paygate")>();
  return { ...actual, checkPaymentStatus: vi.fn() };
});
vi.mock("@/lib/db", () => ({
  getSupabaseAdminClient: vi.fn(),
  dbExecute: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/plan-grant", () => ({ activatePaygatePlan: vi.fn() }));

import { settlePendingOrder, classifyMyOrders, type MineOrder } from "./paygate-settle";
import { checkPaymentStatus } from "@/lib/paygate";
import { getSupabaseAdminClient, dbExecute } from "@/lib/db";
import { activatePaygatePlan } from "@/lib/plan-grant";

const baseOrder = {
  id: "o1", identifier: "u@x.com", plan: "base", period: "monthly",
  amount_usd: 5, status: "pending", ipn_token: "tok%3D",
} as const;

describe("settlePendingOrder — self-heal PayGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("concede il piano se PayGate=paid e valore ≥ soglia (-50%)", async () => {
    vi.mocked(checkPaymentStatus).mockResolvedValue({ status: "paid", valueCoin: 5.7, txidOut: "0xabc" });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: true, error: null }) } as never);
    vi.mocked(activatePaygatePlan).mockResolvedValue({ plan: "base" } as never);

    const r = await settlePendingOrder({ ...baseOrder });

    expect(r.granted).toBe(true);
    expect(activatePaygatePlan).toHaveBeenCalledWith("u@x.com", "base", "monthly");
    expect(dbExecute).toHaveBeenCalled(); // granted_at settato
  });

  it("NON concede se PayGate=unpaid (checkout abbandonato)", async () => {
    vi.mocked(checkPaymentStatus).mockResolvedValue({ status: "unpaid", valueCoin: null, txidOut: null });
    const r = await settlePendingOrder({ ...baseOrder });
    expect(r.granted).toBe(false);
    expect(activatePaygatePlan).not.toHaveBeenCalled();
  });

  it("NON concede se il valore netto è sotto la soglia -50%", async () => {
    vi.mocked(checkPaymentStatus).mockResolvedValue({ status: "paid", valueCoin: 1.0, txidOut: null }); // < 5*0.5
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ rpc: vi.fn() } as never);
    const r = await settlePendingOrder({ ...baseOrder });
    expect(r.granted).toBe(false);
    expect(activatePaygatePlan).not.toHaveBeenCalled();
  });

  it("idempotente: se il claim atomico non vince non concede (no doppio-grant)", async () => {
    vi.mocked(checkPaymentStatus).mockResolvedValue({ status: "paid", valueCoin: 5.7, txidOut: "0xabc" });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } as never);
    const r = await settlePendingOrder({ ...baseOrder });
    expect(r.granted).toBe(false);
    expect(activatePaygatePlan).not.toHaveBeenCalled();
  });
});

// #PAYGATE-INSTANT-GRANT: la classificazione decide l'azione del settle on-demand.
describe("classifyMyOrders — azione sull'ordine più recente", () => {
  const mk = (o: Partial<MineOrder> & { created_at: string }): MineOrder => ({
    id: o.id ?? "o", identifier: "u@x.com", plan: "base", period: "monthly", amount_usd: 14.99,
    status: "pending", ipn_token: "tok%3D", granted_at: null, ...o,
  });

  it("nessun ordine → none", () => {
    expect(classifyMyOrders([]).action).toBe("none");
  });

  it("ultimo pending con ipn_token → settle_pending (e sceglie il più recente)", () => {
    const r = classifyMyOrders([
      mk({ id: "old", created_at: "2026-07-20T10:00:00Z" }),
      mk({ id: "new", created_at: "2026-07-20T11:00:00Z" }),
    ]);
    expect(r.action).toBe("settle_pending");
    expect(r.order?.id).toBe("new");
  });

  it("ultimo paid + granted_at → granted (nulla da fare)", () => {
    const r = classifyMyOrders([mk({ status: "paid", granted_at: "2026-07-20T11:45:00Z", created_at: "2026-07-20T11:20:00Z" })]);
    expect(r.action).toBe("granted");
  });

  it("ultimo paid ma granted_at NULL → grant_paid (paid-senza-piano)", () => {
    const r = classifyMyOrders([mk({ status: "paid", granted_at: null, created_at: "2026-07-20T11:20:00Z" })]);
    expect(r.action).toBe("grant_paid");
  });

  it("ultimo pending senza ipn_token → none (non azionabile)", () => {
    const r = classifyMyOrders([mk({ status: "pending", ipn_token: null, created_at: "2026-07-20T11:20:00Z" })]);
    expect(r.action).toBe("none");
  });

  it("il paid recente vince sul pending più vecchio (no re-settle di roba vecchia)", () => {
    const r = classifyMyOrders([
      mk({ id: "vecchio-pending", status: "pending", created_at: "2026-07-19T09:00:00Z" }),
      mk({ id: "recente-paid", status: "paid", granted_at: "2026-07-20T11:45:00Z", created_at: "2026-07-20T11:20:00Z" }),
    ]);
    expect(r.action).toBe("granted");
    expect(r.order?.id).toBe("recente-paid");
  });
});
