// app/api/v3/live/route.test.ts (#V3C-LIVESCORES) — the gate and the cache
// header. Service mocked: no DB, no network.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const allowed = vi.fn<() => Promise<boolean>>();
const flag = vi.fn<() => boolean>();
const getLive = vi.fn();
vi.mock("@/lib/v3c/guard", () => ({ v3Allowed: () => allowed(), redesignFlagOn: () => flag() }));
vi.mock("@/lib/v3c/live-service.server", () => ({ getLive: () => getLive() }));

import { GET } from "./route";

const req = () => new NextRequest("http://localhost/api/v3/live");
const BODY = { contract: "v3.live.1", generated_at: "2026-10-07T08:15:00.000Z", window_min: 180, source: { name: "ESPN", note: "" }, items: {}, coverage: {} };

describe("GET /api/v3/live", () => {
  beforeEach(() => {
    allowed.mockReset();
    flag.mockReset();
    getLive.mockReset().mockResolvedValue(BODY);
  });
  it("flag off and not admin → 404, the service is never called", async () => {
    allowed.mockResolvedValue(false);
    flag.mockReturnValue(false);
    const r = await GET(req());
    expect(r.status).toBe(404);
    expect(getLive).not.toHaveBeenCalled();
  });
  it("flag on → 200, shared CDN cache 20 s + stale-while-revalidate", async () => {
    allowed.mockResolvedValue(true);
    flag.mockReturnValue(true);
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, s-maxage=20, stale-while-revalidate=40");
    expect((await r.json()).contract).toBe("v3.live.1");
  });
  it("admin with the flag off → 200 but private, never shared by the CDN", async () => {
    allowed.mockResolvedValue(true);
    flag.mockReturnValue(false);
    const r = await GET(req());
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it("source/DB failure → 503, not an empty «nothing live»", async () => {
    allowed.mockResolvedValue(true);
    flag.mockReturnValue(true);
    getLive.mockRejectedValue(new Error("db down"));
    const r = await GET(req());
    expect(r.status).toBe(503);
  });
});
