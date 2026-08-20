// Test della route cron soro-rss (#SORO-RSS-0813).
import { describe, it, expect, vi, beforeEach } from "vitest";

const runSoroRssSync = vi.fn();
vi.mock("@/lib/soro-rss", () => ({ runSoroRssSync: (...a: unknown[]) => runSoroRssSync(...a) }));

// Il mock controlla l'HEADER, non solo il secret: un mock pigro che ritorna
// sempre true farebbe passare il test del 401 per il motivo sbagliato.
vi.mock("@/lib/admin-auth", () => ({
  verifyBearer: (r: Request, s?: string) =>
    Boolean(s) && r.headers.get("authorization") === `Bearer ${s}`,
}));

describe("GET /api/cron/soro-rss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "sekret";
    process.env.SORO_RSS_URL = "https://app.trysoro.com/api/rss/test-uuid";
    runSoroRssSync.mockResolvedValue({
      scanned: 1,
      inserted: 1,
      skipped: 0,
      imagesRehosted: 1,
      imageErrors: 0,
      errors: [],
    });
  });

  it("401 senza cron secret", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/api/cron/soro-rss"));
    expect(res.status).toBe(401);
    expect(runSoroRssSync).not.toHaveBeenCalled();
  });

  it("503 se SORO_RSS_URL non è configurata (default-deny, niente fetch)", async () => {
    delete process.env.SORO_RSS_URL;
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://x/api/cron/soro-rss", {
        headers: { authorization: "Bearer sekret" },
      })
    );
    expect(res.status).toBe(503);
    expect(runSoroRssSync).not.toHaveBeenCalled();
  });

  it("200 con i contatori del sync", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://x/api/cron/soro-rss", {
        headers: { authorization: "Bearer sekret" },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ scanned: 1, inserted: 1 });
  });

  it("500 se il sync lancia", async () => {
    runSoroRssSync.mockRejectedValueOnce(new Error("feed fetch failed: HTTP 403"));
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://x/api/cron/soro-rss", {
        headers: { authorization: "Bearer sekret" },
      })
    );
    expect(res.status).toBe(500);
  });
});
