// Test del poller Soro RSS (#SORO-RSS-0813). La fixture replica la struttura
// verificata sul feed reale del 13/08 (guid UUID isPermaLink=false, CDATA in
// content:encoded, enclosure+media:content sullo storage Supabase di Soro).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const storageUpload = vi.fn();
const storageGetPublicUrl = vi.fn();
vi.mock("@/lib/db", () => ({
  dbQuery: vi.fn(),
  dbQueryStrict: (...a: unknown[]) => dbQueryStrict(...a),
  dbExecute: (...a: unknown[]) => dbExecute(...a),
  getSupabaseAdminClient: () => ({
    storage: {
      from: () => ({ upload: storageUpload, getPublicUrl: storageGetPublicUrl }),
    },
  }),
}));
const opsAlert = vi.fn();
vi.mock("@/lib/ops-alert", () => ({ opsAlert: (...a: unknown[]) => opsAlert(...a) }));

const SORO_IMG =
  "https://afocirmbqdxnkyescnev.supabase.co/storage/v1/object/public/featured-images/x/196051df.webp";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>betredge.com</title>
    <link>https://www.betredge.com</link>
    <item>
      <title>Implied Probability &amp; Betting Odds</title>
      <link>https://www.betredge.com/implied-probability-from-betting-odds</link>
      <guid isPermaLink="false">196051df-8d8f-40af-a031-9a009fc897a3</guid>
      <pubDate>Thu, 13 Aug 2026 09:52:04 GMT</pubDate>
      <description>Learn how to calculate implied probability.</description>
      <content:encoded><![CDATA[<p>A price of +150 is not a prediction.</p><h2>What it measures</h2>]]></content:encoded>
      <enclosure url="${SORO_IMG}" type="image/webp" length="0" />
      <media:content url="${SORO_IMG}" medium="image" />
    </item>
  </channel>
</rss>`;

describe("parseSoroFeed", () => {
  it("estrae guid, titolo decodificato, link, CDATA e immagine enclosure", async () => {
    const { parseSoroFeed } = await import("./soro-rss");
    const items = parseSoroFeed(FEED);
    expect(items).toHaveLength(1);
    expect(items[0].guid).toBe("196051df-8d8f-40af-a031-9a009fc897a3");
    expect(items[0].title).toBe("Implied Probability & Betting Odds");
    expect(items[0].link).toBe("https://www.betredge.com/implied-probability-from-betting-odds");
    expect(items[0].contentHtml).toContain("<p>A price of +150 is not a prediction.</p>");
    expect(items[0].imageUrl).toBe(SORO_IMG);
    expect(items[0].pubDate).toBe("Thu, 13 Aug 2026 09:52:04 GMT");
  });

  it("feed senza item = lista vuota", async () => {
    const { parseSoroFeed } = await import("./soro-rss");
    expect(parseSoroFeed("<rss><channel></channel></rss>")).toEqual([]);
  });
});

describe("slugFromItem", () => {
  it("prende l'ultimo segmento del path, con o senza prefisso /blog/", async () => {
    const { slugFromItem } = await import("./soro-rss");
    expect(
      slugFromItem({ link: "https://www.betredge.com/implied-probability", title: "x" })
    ).toBe("implied-probability");
    expect(
      slugFromItem({ link: "https://www.betredge.com/blog/my-post/", title: "x" })
    ).toBe("my-post");
  });

  it("link vuoto o senza path = fallback sul titolo slugificato", async () => {
    const { slugFromItem } = await import("./soro-rss");
    expect(slugFromItem({ link: "", title: "Implied Probability & Odds!" })).toBe(
      "implied-probability-odds"
    );
    expect(slugFromItem({ link: "https://www.betredge.com", title: "My Title" })).toBe("my-title");
  });
});

describe("needsRehost", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ourproject.supabase.co";
  });

  it("storage Soro = sì; betredge e storage nostro = no", async () => {
    const { needsRehost } = await import("./soro-rss");
    expect(needsRehost(SORO_IMG)).toBe(true);
    expect(needsRehost("https://www.betredge.com/logo.png")).toBe(false);
    expect(needsRehost("https://ourproject.supabase.co/storage/v1/object/public/blog-images/a.webp")).toBe(false);
    expect(needsRehost("not-a-url")).toBe(false);
  });
});

describe("runSoroRssSync", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SORO_RSS_URL = "https://app.trysoro.com/api/rss/test-uuid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ourproject.supabase.co";
    dbQueryStrict.mockResolvedValue([]);
    dbExecute.mockResolvedValue([]);
    storageUpload.mockResolvedValue({ error: null });
    storageGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          "https://ourproject.supabase.co/storage/v1/object/public/blog-images/196051df-8d8f-40af-a031-9a009fc897a3/featured.webp",
      },
    });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("trysoro.com")) return new Response(FEED, { status: 200 });
      // download immagine
      return new Response(new ArrayBuffer(16), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("senza SORO_RSS_URL lancia (default-deny)", async () => {
    delete process.env.SORO_RSS_URL;
    const { runSoroRssSync } = await import("./soro-rss");
    await expect(runSoroRssSync()).rejects.toThrow("SORO_RSS_URL not configured");
  });

  it("il fetch del feed usa il cache-buster _cb", async () => {
    const { runSoroRssSync } = await import("./soro-rss");
    await runSoroRssSync();
    const feedCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(String(feedCall)).toMatch(/\?_cb=\d+/);
  });

  it("item nuovo: immagine ri-ospitata e INSERT draft con ON CONFLICT DO NOTHING", async () => {
    const { runSoroRssSync } = await import("./soro-rss");
    const result = await runSoroRssSync();
    expect(result).toMatchObject({
      scanned: 1,
      inserted: 1,
      skipped: 0,
      imagesRehosted: 1,
      imageErrors: 0,
    });
    expect(storageUpload).toHaveBeenCalledWith(
      "196051df-8d8f-40af-a031-9a009fc897a3/featured.webp",
      expect.anything(),
      expect.objectContaining({ contentType: "image/webp" })
    );
    const [sql, params] = dbExecute.mock.calls[0];
    expect(sql).toContain("ON CONFLICT (guid) DO NOTHING");
    expect(sql).toContain("'draft'");
    expect(params[0]).toBe("196051df-8d8f-40af-a031-9a009fc897a3");
    expect(params[1]).toBe("implied-probability-from-betting-odds");
    // featured_image_url = la NOSTRA public URL, non lo storage Soro
    expect(params[6]).toContain("ourproject.supabase.co");
    expect(params[7]).toBe(SORO_IMG);
  });

  it("guid già presente: skip senza toccare storage né DB", async () => {
    dbQueryStrict.mockResolvedValueOnce([{ guid: "196051df-8d8f-40af-a031-9a009fc897a3" }]);
    const { runSoroRssSync } = await import("./soro-rss");
    const result = await runSoroRssSync();
    expect(result).toMatchObject({ scanned: 1, inserted: 0, skipped: 1 });
    expect(dbExecute).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("slug già occupato da altro guid: suffisso dal guid", async () => {
    dbQueryStrict
      .mockResolvedValueOnce([]) // check guid
      .mockResolvedValueOnce([{ slug: "implied-probability-from-betting-odds" }]); // check slug
    const { runSoroRssSync } = await import("./soro-rss");
    await runSoroRssSync();
    const [, params] = dbExecute.mock.calls[0];
    expect(params[1]).toBe("implied-probability-from-betting-odds-196051df");
  });

  it("download immagine fallito: bozza salvata con URL originale + imageErrors + opsAlert", async () => {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("trysoro.com")) return new Response(FEED, { status: 200 });
      return new Response("nope", { status: 404 });
    }) as typeof fetch;
    const { runSoroRssSync } = await import("./soro-rss");
    const result = await runSoroRssSync();
    expect(result).toMatchObject({ inserted: 1, imagesRehosted: 0, imageErrors: 1 });
    const [, params] = dbExecute.mock.calls[0];
    expect(params[6]).toBeNull();
    expect(params[7]).toBe(SORO_IMG);
    expect(opsAlert).toHaveBeenCalledWith(
      "cron/soro-rss",
      expect.arrayContaining([expect.stringContaining("NOT rehosted")])
    );
  });

  it("feed HTTP 403 (feed disabled): opsAlert e throw", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Feed is disabled", { status: 403 })) as typeof fetch;
    const { runSoroRssSync } = await import("./soro-rss");
    await expect(runSoroRssSync()).rejects.toThrow("HTTP 403");
    expect(opsAlert).toHaveBeenCalled();
  });
});
