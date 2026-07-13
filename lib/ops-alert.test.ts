import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { opsAlert } from "./ops-alert";

describe("opsAlert (fire-and-forget cron notifier)", () => {
  const prev = process.env.ALERT_WEBHOOK_URL;

  beforeEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ALERT_WEBHOOK_URL;
    else process.env.ALERT_WEBHOOK_URL = prev;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("env assente → NON chiama fetch, logga soltanto", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await opsAlert("cron/settle", ["boom"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith("[ops-alert]", "cron/settle", ["boom"]);
  });

  it("env presente → POST JSON corretto {source,errors,ts}", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hook.example/notify";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await opsAlert("cron/paygate-reconcile", ["e1", "e2"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hook.example/notify");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["content-type"]).toBe("application/json");
    const body = JSON.parse(String(opts.body));
    expect(body.source).toBe("cron/paygate-reconcile");
    expect(body.errors).toEqual(["e1", "e2"]);
    expect(typeof body.ts).toBe("string");
    expect(Number.isNaN(Date.parse(body.ts))).toBe(false);
  });

  it("fetch fallisce → NON rilancia (fire-and-forget)", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hook.example/notify";
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(opsAlert("cron/settle", ["x"])).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
