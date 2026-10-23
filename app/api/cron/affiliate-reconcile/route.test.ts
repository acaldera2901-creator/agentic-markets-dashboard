import { afterEach, describe, expect, it, vi } from "vitest";

const replay = vi.hoisted(() => vi.fn(async () => ({ok:true,processed:0})));
vi.mock("@/lib/affiliate/rpc", () => ({affiliateRpc:replay}));
const reconcile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/affiliate/reconcile", () => ({ reconcileAffiliateLedger: reconcile }));
const opsAlert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const req = (token = "secret") =>
  new Request("https://example.test/api/cron/affiliate-reconcile", { headers: { authorization: `Bearer ${token}` } });

describe("affiliate reconcile cron", () => {
  it("richiede il CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    expect((await GET(req("wrong"))).status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("off → nessun accesso al DB", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "off");
    expect(await (await GET(req())).json()).toEqual({ ok: true, skipped: true });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("gira anche in shadow; nulla da recuperare → nessun alert", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    const r = { checked: 3, written: 0, reasons: { outside_attribution_window: 3 }, shopify_manual: [], truncated: false };
    reconcile.mockResolvedValue(r);
    expect(await (await GET(req())).json()).toEqual({ ok: true, ...r });
    expect(opsAlert).not.toHaveBeenCalled();
  });

  it("una commissione recuperata è un segnale: alert ops", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "live");
    reconcile.mockResolvedValue({ checked: 2, written: 1, reasons: { pending: 1 }, shopify_manual: ["s-9"], truncated: false });
    await GET(req());
    expect(opsAlert).toHaveBeenCalledWith("affiliate-reconcile", [
      expect.stringContaining("recuperate: 1"),
      expect.stringContaining("da verificare a mano: s-9"),
    ]);
  });

  it("replays durable refunds after reconciling and reports replay errors", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "live");
    reconcile.mockResolvedValue({checked:0,written:0,reasons:{},shopify_manual:[],truncated:false});
    replay.mockRejectedValueOnce(new Error("replay failed"));
    expect((await GET(req())).status).toBe(503);
    expect(replay).toHaveBeenCalledWith("affiliate_replay_reversals", {});
  });

  it("errore → 503, non un finto ok", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "live");
    reconcile.mockRejectedValue(new Error("db"));
    expect((await GET(req())).status).toBe(503);
  });
});
