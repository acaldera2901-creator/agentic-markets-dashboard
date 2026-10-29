// lib/news/copy.test.ts (#NEWS-FOTMOB-PROD-1026) — the 11 tables aligned, as
// lobby-copy.test.ts keeps the lobby's: every key in every language, the same
// placeholders, and the lexicon the brand kit bans kept out of the English.
import { describe, expect, it } from "vitest";
import { EXTRA_LOCALES } from "@/lib/i18n/extra-locales";
import { fillNews, NEWS_COPY, NEWS_LANGS, newsCopy } from "./copy";

const BANNED = /\b(guaranteed?|lock|sure win|easy money|crush the book|tips?|bonus|boost|hurry|last chance|only today|hit.?rate|odds|bet|bets|betting)\b/i;

describe("news copy", () => {
  it("covers the 11 site languages: en, it and every extra locale", () => {
    expect([...NEWS_LANGS].sort()).toEqual(["en", "it", ...Object.keys(EXTRA_LOCALES)].sort());
  });
  it("every language has every key, non-empty, with the same placeholders", () => {
    const keys = Object.keys(NEWS_COPY.en).sort();
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const lang of NEWS_LANGS) {
      const t = NEWS_COPY[lang] as Record<string, string>;
      expect(Object.keys(t).sort(), lang).toEqual(keys);
      for (const k of keys) {
        expect(t[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
        expect(ph(t[k]), `${lang}.${k}`).toEqual(ph((NEWS_COPY.en as Record<string, string>)[k]));
      }
    }
  });
  it("takedown is always there; the English carries no banned lexicon", () => {
    for (const lang of NEWS_LANGS) {
      expect(NEWS_COPY[lang].takedown).toContain("info@betredge.com");
      expect(NEWS_COPY[lang].takedown).toMatch(/24/);
    }
    for (const s of Object.values(NEWS_COPY.en)) expect(s).not.toMatch(BANNED);
  });
  it("unknown language → English; placeholders filled", () => {
    expect(newsCopy("xx")).toBe(NEWS_COPY.en);
    expect(newsCopy(null).latest).toBe("Latest football news");
    expect(fillNews(newsCopy("it").updatedAt, { time: "13:43" })).toBe("Aggiornato alle 13:43");
    expect(fillNews("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
