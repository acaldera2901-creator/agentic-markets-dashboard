// lib/news/per-note.test.ts (#NEWS-FOTMOB-PROD-1026) — the per-note picture:
// the FotMob id out of the source URL, the lookup, the fallback to the kind's
// picture, and every listed file really under /public/images/news.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fotmobIdOf, NOTE_IMAGES, noteImage } from "./per-note";
import { cardFromRow, feedFromTable, type NewsItemRow, type NewsStateRow } from "./table";
import { rowsFor } from "./view";

const row = (guid: string, url: string, teams: string[] = []): NewsItemRow => ({
  guid_hash: guid, source: "FotMob", source_url: url, published_at: "2026-10-29T08:30:04.000Z",
  rewritten_en: { title: "Chivu concedes Inter lacked conviction in win", body: "Inter beat Venezia 2-0." },
  rewritten_it: { title: "Chivu ammette che l'Inter ha mancato di convinzione", body: "L'Inter ha battuto il Venezia 2-0." },
  teams, rewrite_model: "m", rewritten_at: "2026-10-29T08:38:00.000Z",
});

describe("fotmobIdOf", () => {
  it("reads the id of /news and /topnews links, with or without a language prefix; anything else → null", () => {
    expect(fotmobIdOf("https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu-admits-inter-played-without-conviction")).toBe("34p7x1w2mryx1d30uxb50a7qb");
    expect(fotmobIdOf("https://www.fotmob.com/it/news/1h64s2rd5exkn16klbwyxxlsns-were-winning")).toBe("1h64s2rd5exkn16klbwyxxlsns");
    expect(fotmobIdOf("https://www.fotmob.com/topnews/30177-fotmob-totw-premier-league")).toBe("30177");
    expect(fotmobIdOf("https://www.fotmob.com/leagues/55/overview/serie")).toBeNull();
    expect(fotmobIdOf("https://example.com/news/34p7x1w2mryx1d30uxb50a7qb-x")).toBeNull();
    expect(fotmobIdOf("not a url")).toBeNull();
  });
});

describe("noteImage · lookup and fallback", () => {
  it("the four notes of 29/10 have their own picture; a note without one gets null", () => {
    expect(noteImage({ url: "https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu" })).toEqual({ src: "/images/news/news-34p7x1w2mryx1d30uxb50a7qb-chivu-inter-no-conviction.webp", png: "/images/news/news-34p7x1w2mryx1d30uxb50a7qb-chivu-inter-no-conviction.png", width: 1200, height: 675 });
    expect(noteImage({ url: "https://www.fotmob.com/news/zzzz-unknown" })).toBeNull();
  });
  it("every listed file exists (webp and png) and is ours, not FotMob's", () => {
    for (const [id, img] of Object.entries(NOTE_IMAGES)) {
      expect(img.src).toBe(`/images/news/${img.src.split("/").pop()}`);
      expect(img.src).toContain(id);
      expect(img.src).not.toMatch(/fotmob\.com/);
      expect(existsSync(join(process.cwd(), "public", img.src)), img.src).toBe(true);
      expect(existsSync(join(process.cwd(), "public", img.png)), img.png).toBe(true);
      expect(img.width / img.height).toBeCloseTo(16 / 9, 2);
    }
  });
  it("in a list, a note with its own picture shows it; the others keep the kind's picture (with the de-dup between them)", () => {
    const state: NewsStateRow = { enabled: true, last_run_at: "2026-10-29T09:00:00Z", last_error: null, source_status: "ok" };
    const feed = feedFromTable(state, [
      row("a", "https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu", ["Inter", "Venezia"]),
      row("b", "https://www.fotmob.com/news/unknown1-x"),
      row("c", "https://www.fotmob.com/news/unknown2-x"),
    ], Date.parse("2026-10-29T09:00:00Z"));
    const rows = rowsFor(feed.state === "ok" ? feed.cards : [], "en", null);
    expect(rows.map((r) => r.image?.src)).toEqual([
      "/images/news/news-34p7x1w2mryx1d30uxb50a7qb-chivu-inter-no-conviction.webp",
      "/news/news-01-risultato.webp",
      "/news/news-07-generica.webp",
    ]);
    expect(rows[0].image && "png" in rows[0].image).toBe(true);
    expect(cardFromRow(row("d", "javascript:alert(1)"))).toBeNull();
  });
});

describe("the wire · nothing that leaves the server points back to the source", () => {
  it("wireFeed keeps guid, time, text, teams and the resolved picture; drops url and source; other states pass through", async () => {
    const { wireFeed, rowsFor } = await import("./view");
    const state: NewsStateRow = { enabled: true, last_run_at: "2026-10-29T09:00:00Z", last_error: null, source_status: "ok" };
    const feed = feedFromTable(state, [row("a", "https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu", ["Inter", "Venezia"]), row("b", "https://www.fotmob.com/news/unknown-x")], Date.parse("2026-10-29T09:00:00Z"));
    const wire = wireFeed(feed);
    expect(wire.state).toBe("ok");
    if (wire.state !== "ok") return;
    expect(Object.keys(wire.cards[0]).sort()).toEqual(["guid", "image", "note", "t", "teams"]);
    expect(wire.cards[0].image?.src).toContain("chivu-inter-no-conviction");
    expect(wire.cards[1].image).toBeNull();
    expect(JSON.stringify(wire)).not.toMatch(/fotmob/i);
    // the browser builds the same rows from the wire cards as from the data cards
    expect(rowsFor(wire.cards, "en", null).map((r) => r.image?.src)).toEqual(rowsFor(feed.state === "ok" ? feed.cards : [], "en", null).map((r) => r.image?.src));
    expect(wireFeed({ state: "paused", since: null })).toEqual({ state: "paused", since: null });
  });
});
