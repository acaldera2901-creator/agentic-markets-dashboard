// #WEEKLY-PICK-CLOSED-0904 — il checkout PayGate della Weekly Pick non vende una
// settimana senza multipla né una già tutta decisa.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbExecute = vi.fn();
const hasWeeklyPickStrict = vi.fn();
const weeklyPickWeekStateStrict = vi.fn();
const createReceivingWallet = vi.fn();
vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict: vi.fn(), dbExecute }));
vi.mock("@/lib/activation", () => ({ siteOrigin: () => "https://x" }));
vi.mock("@/lib/paygate", () => ({
  newOrderToken: () => ({ token: "tok", tokenHash: "hash" }),
  createReceivingWallet,
  buildPayUrl: () => "https://pay.example/x",
  launchPromoActive: () => false,
  LAUNCH_PROMO_DISCOUNT: 0.5,
}));
vi.mock("@/lib/weekly-pick-server", () => ({
  hasWeeklyPickStrict,
  weeklyPickWeekStateStrict,
  weeklyPickClosed: (s: { exists: boolean; legs: number; remaining: number }) => s.exists && s.legs > 0 && s.remaining === 0,
}));

const load = () => import("./route");

const req = () => new Request("https://x/api/weekly-pick/checkout", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WEEKLY_PICK_ENABLED = "true";
  process.env.PAYGATE_PAYOUT_WALLET = "0xabc";
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "free", name: null, plan_expires_at: null });
  hasWeeklyPickStrict.mockResolvedValue(false);
  weeklyPickWeekStateStrict.mockResolvedValue({ exists: true, legs: 5, remaining: 3 });
  dbExecute.mockResolvedValue([]);
  createReceivingWallet.mockResolvedValue({ addressIn: "addr", polygonAddressIn: "poly", ipnToken: "ipn" });
});

describe("POST /api/weekly-pick/checkout — guardia settimana", () => {
  it("settimana aperta → crea ordine e restituisce URL", async () => {
    const res = await (await load()).POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://pay.example/x" });
    expect(dbExecute).toHaveBeenCalled();
    expect(weeklyPickWeekStateStrict).toHaveBeenCalledTimes(1);
  });

  it("tutte le gambe decise → 409 week closed, NESSUN ordine", async () => {
    weeklyPickWeekStateStrict.mockResolvedValue({ exists: true, legs: 5, remaining: 0 });
    const res = await (await load()).POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "week closed" });
    expect(dbExecute).not.toHaveBeenCalled();
    expect(createReceivingWallet).not.toHaveBeenCalled();
  });

  it("nessuna multipla questa settimana → 404, NESSUN ordine", async () => {
    weeklyPickWeekStateStrict.mockResolvedValue({ exists: false, legs: 0, remaining: 0 });
    const res = await (await load()).POST(req());
    expect(res.status).toBe(404);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("lettura stato fallita → 500 fail-closed, NESSUN ordine", async () => {
    weeklyPickWeekStateStrict.mockRejectedValue(new Error("db down"));
    const res = await (await load()).POST(req());
    expect(res.status).toBe(500);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("le guardie preesistenti vengono prima: già comprata → 409 senza leggere lo stato", async () => {
    hasWeeklyPickStrict.mockResolvedValue(true);
    const res = await (await load()).POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already purchased" });
    expect(weeklyPickWeekStateStrict).not.toHaveBeenCalled();
  });
});
