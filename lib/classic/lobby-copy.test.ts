import { describe, expect, it } from "vitest";
import { CLASSIC_COPY, CLASSIC_LANGS, classicCopy, fill } from "./lobby-copy";
import { EXTRA_LOCALES } from "@/lib/i18n/extra-locales";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const BANNED = /\b(guaranteed?|lock|sure win|easy money|crush the book|tips?|bonus|boost|hurry|last chance|only today)\b/i;

describe("lobby-copy (classic)", () => {
  it("covers the 11 site languages: en, it and every extra locale", () => {
    expect([...CLASSIC_LANGS].sort()).toEqual(["en", "it", ...Object.keys(EXTRA_LOCALES)].sort());
  });

  it("every language has every key, non-empty, with the same placeholders", () => {
    const keys = Object.keys(CLASSIC_COPY.en).sort();
    for (const lang of CLASSIC_LANGS) {
      const t = CLASSIC_COPY[lang] as Record<string, string>;
      expect(Object.keys(t).sort(), lang).toEqual(keys);
      for (const k of keys) {
        expect(t[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(ph(t[k]), `${lang}.${k}`).toEqual(ph((CLASSIC_COPY.en as Record<string, string>)[k]));
      }
    }
  });

  it("banner titles ≤ 6 words, subtitles ≤ 12, no promo/urgency lexicon", () => {
    for (const lang of CLASSIC_LANGS) {
      const t = CLASSIC_COPY[lang];
      for (const k of ["b1Title", "b2Title", "b3Title"] as const) expect(words(t[k]), `${lang}.${k}`).toBeLessThanOrEqual(6);
      for (const k of ["b1Sub", "b2Sub", "b3Sub"] as const) expect(words(t[k]), `${lang}.${k}`).toBeLessThanOrEqual(12);
    }
    for (const s of Object.values(CLASSIC_COPY.en)) expect(s).not.toMatch(BANNED);
  });

  it("falls back to English and fills placeholders", () => {
    expect(classicCopy("xx")).toBe(CLASSIC_COPY.en);
    expect(fill("Matches: {n}", { n: 3 })).toBe("Matches: 3");
    expect(fill("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
