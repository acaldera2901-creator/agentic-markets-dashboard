// lib/news/per-note.test.ts (#NEWS-FOTMOB-PROD-1026) — the per-note picture:
// the source id out of the URL, the opaque name (sha256), the lookup, the
// fallback to the kind's picture, every listed file really under
// /public/images/news, and the wire that carries no id and no source.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fotmobIdOf, NOTE_IMAGE_NAMES, noteImageByName } from "./per-note";
import { noteImage, noteImageName } from "./per-note.server";
import { cardFromRow, feedFromTable, type NewsItemRow, type NewsStateRow } from "./table";
import { rowsFor, wireFeed } from "./view";

const row = (guid: string, url: string, teams: string[] = []): NewsItemRow => ({
  guid_hash: guid, source: "FotMob", source_url: url, published_at: "2026-10-29T08:30:04.000Z",
  rewritten_en: { title: "Chivu concedes Inter lacked conviction in win", body: "Inter beat Venezia 2-0." },
  rewritten_it: { title: "Chivu ammette che l'Inter ha mancato di convinzione", body: "L'Inter ha battuto il Venezia 2-0." },
  teams, rewrite_model: "m", rewritten_at: "2026-10-29T08:38:00.000Z",
});
const STATE: NewsStateRow = { enabled: true, last_run_at: "2026-10-29T09:00:00Z", last_error: null, source_status: "ok" };
const NOW = Date.parse("2026-10-29T09:00:00Z");

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

describe("noteImageName · the opaque convention the watcher follows", () => {
  it("is «news-» + sha256(id)[:12], never the id itself", () => {
    expect(noteImageName("34p7x1w2mryx1d30uxb50a7qb")).toBe("news-85469d0dd84e");
    expect(noteImageName("1h64s2rd5exkn16klbwyxxlsns")).toBe("news-3ad88e639192");
    expect(noteImageName("4jikbwtyvot1ka7zjol4z8ww")).toBe("news-d92d970f9936");
    expect(noteImageName("mb6zakc8ytax1tip7i9m9dlsx")).toBe("news-39567f5fa699");
    expect(noteImageName("x")).toMatch(/^news-[0-9a-f]{12}$/);
    expect(noteImageName("x")).not.toBe(noteImageName("y"));
  });
});

describe("noteImage · lookup and fallback", () => {
  it("the four notes of 29/10 have their own picture; a note without one gets null", () => {
    expect(noteImage({ url: "https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu" })).toEqual({ src: "/images/news/news-85469d0dd84e.webp", png: "/images/news/news-85469d0dd84e.png", width: 1200, height: 675 });
    expect(noteImage({ url: "https://www.fotmob.com/news/zzzz-unknown" })).toBeNull();
    expect(noteImageByName("news-000000000000")).toBeNull();
  });
  it("every listed picture exists (webp and png), is opaque and is ours", () => {
    for (const name of NOTE_IMAGE_NAMES) {
      expect(name).toMatch(/^news-[0-9a-f]{12}$/);
      const img = noteImageByName(name)!;
      expect(existsSync(join(process.cwd(), "public", img.src)), img.src).toBe(true);
      expect(existsSync(join(process.cwd(), "public", img.png)), img.png).toBe(true);
      expect(img.width / img.height).toBeCloseTo(16 / 9, 2);
    }
    expect(NOTE_IMAGE_NAMES.size).toBe(4);
  });
  it("a bad source URL is dropped by the data layer before any lookup", () => {
    expect(cardFromRow(row("d", "javascript:alert(1)"))).toBeNull();
  });
});

describe("the wire · nothing that leaves the server points back to the source", () => {
  const feed = feedFromTable(STATE, [
    row("a", "https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu", ["Inter", "Venezia"]),
    row("b", "https://www.fotmob.com/news/unknown1-x"),
    row("c", "https://www.fotmob.com/news/unknown2-x"),
  ], NOW);
  const wire = wireFeed(feed, noteImage);
  it("wireFeed keeps guid, time, text, teams and the resolved picture; drops url and source; no source name, no source id anywhere", () => {
    expect(wire.state).toBe("ok");
    if (wire.state !== "ok") return;
    expect(Object.keys(wire.cards[0]).sort()).toEqual(["guid", "image", "note", "t", "teams"]);
    expect(wire.cards[0].image?.src).toBe("/images/news/news-85469d0dd84e.webp");
    expect(wire.cards[1].image).toBeNull();
    const json = JSON.stringify(wire);
    expect(json).not.toMatch(/fotmob/i);
    expect(json).not.toContain("34p7x1w2mryx1d30uxb50a7qb");
    expect(wireFeed({ state: "paused", since: null }, noteImage)).toEqual({ state: "paused", since: null });
  });
  it("in the browser, a note with its own picture shows it; the others keep the kind's picture (de-dup between them); a data card never resolves on its own", () => {
    if (wire.state !== "ok") return;
    const rows = rowsFor(wire.cards, "en", null);
    expect(rows.map((r) => r.image?.src)).toEqual(["/images/news/news-85469d0dd84e.webp", "/news/news-01-risultato.webp", "/news/news-07-generica.webp"]);
    expect(rows[0].image && "png" in rows[0].image).toBe(true);
    expect(rowsFor(feed.state === "ok" ? feed.cards : [], "en", null).map((r) => r.image?.src)).toEqual(["/news/news-01-risultato.webp", "/news/news-07-generica.webp", "/news/news-01-risultato.webp"]);
  });
});
