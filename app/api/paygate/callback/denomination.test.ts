import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), status: vi.fn(), rpc: vi.fn(), grant: vi.fn(), weekly: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery: mock.query, dbExecute: mock.execute, getSupabaseAdminClient: () => ({ rpc: mock.rpc }) }));
vi.mock("@/lib/paygate", async (original) => ({ ...await original<typeof import("@/lib/paygate")>(), checkPaymentStatus: mock.status }));
vi.mock("@/lib/plan-grant", () => ({ activatePaygatePlan: mock.grant, sendPlanReceipt: vi.fn() }));
vi.mock("@/lib/weekly-pick-server", () => ({ grantWeeklyPick: mock.weekly, notifyWeeklyPickGranted: vi.fn() }));
vi.mock("@/lib/shopify-admin", () => ({ createMirroredPaidOrder: vi.fn() }));
import { GET as plan } from "./route";
import { GET as weekly } from "../../weekly-pick/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  mock.query.mockResolvedValue([{ id: "test-order", identifier: "test@example.invalid", plan: "base", period: "monthly", week_start: "2026-09-21", amount_usd: 5, status: "pending", ipn_token: "test-ipn", shopify_order_id: "already-mirrored" }]);
  mock.execute.mockResolvedValue(undefined);
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.grant.mockResolvedValue({ plan: "base" });
  mock.weekly.mockResolvedValue(true);
});
describe.each([["plan", plan], ["weekly", weekly]] as const)("%s denomination validation", (_name, handler) => {
  it.each([null, "polygon-pol"])("cannot use callback coin to replace verified denomination %s", async (coin) => {
    mock.status.mockResolvedValue({ status: "paid", valueCoin: 100, coin, txidOut: "verified-tx" });
    await handler(new Request("https://www.betredge.com/callback?token=test&coin=polygon_usdc&value_coin=100"));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.grant).not.toHaveBeenCalled();
    expect(mock.weekly).not.toHaveBeenCalled();
  });
  it("accepts supported server denomination even when query contains a different one", async () => {
    mock.status.mockResolvedValue({ status: "paid", valueCoin: 5, coin: "polygon-usdc", txidOut: "verified-tx" });
    await handler(new Request("https://www.betredge.com/callback?token=test&coin=polygon_pol&value_coin=999"));
    expect(mock.rpc).toHaveBeenCalledOnce();
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ p_value: 5, p_txid: "verified-tx" });
  });
});
