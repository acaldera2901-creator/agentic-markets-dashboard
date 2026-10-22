import { afterEach, describe, expect, it, vi } from "vitest";

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
    reconcile.mockResolvedValue({ checked: 3, written: 0, reasons: { outside_attribution_window: 3 } });
    expect(await (await GET(req())).json()).toEqual({ ok: true, checked: 3, written: 0, reasons: { outside_attribution_window: 3 } });
    expect(opsAlert).not.toHaveBeenCalled();
  });

  it("una commissione recuperata è un segnale: alert ops", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "live");
    reconcile.mockResolvedValue({ checked: 1, written: 1, reasons: { pending: 1 } });
    await GET(req());
    expect(opsAlert).toHaveBeenCalledWith("affiliate-reconcile", [expect.stringContaining("recuperate: 1")]);
  });

  it("errore → 503, non un finto ok", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("AFFILIATE_MODE", "live");
    reconcile.mockRejectedValue(new Error("db"));
    expect((await GET(req())).status).toBe(503);
  });
});
