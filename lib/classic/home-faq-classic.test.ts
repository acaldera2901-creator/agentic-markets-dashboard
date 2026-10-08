// #CLASSIC-INT-1008 — la FAQ della Home a flag acceso: stesse domande, tre
// risposte riscritte sui fatti della scheda Slab, nessuna frase falsa sul live.
import { describe, expect, it } from "vitest";
import { HOME_FAQ, HOME_FAQ_ACTIVE, HOME_FAQ_CLASSIC } from "@/lib/home-faq";
import { CLASSIC } from "@/lib/classic/flag";

describe("home FAQ (classic)", () => {
  it("keeps every question and changes only answers 2, 4 and 6", () => {
    for (const lang of ["en", "it"] as const) {
      const base = HOME_FAQ[lang];
      const cl = HOME_FAQ_CLASSIC[lang];
      expect(cl.map(([q]) => q)).toEqual(base.map(([q]) => q));
      const changed = cl.map(([, a], i) => (a === base[i][1] ? null : i)).filter((i) => i != null);
      expect(changed, lang).toEqual([1, 3, 5]);
    }
  });

  it("makes no claim of a live model, a one-number card or Pro-only live", () => {
    for (const [, a] of [...HOME_FAQ_CLASSIC.en, ...HOME_FAQ_CLASSIC.it]) {
      expect(a).not.toMatch(/reads the game again|rilegge il match|one number|un numero solo|Live is Pro only|live è solo Pro/i);
      expect(a).not.toMatch(/\b(guaranteed?|lock|sure win|easy money)\b/i);
    }
  });

  it("follows the build flag: main FAQ when off, classic when on", () => {
    expect(HOME_FAQ_ACTIVE).toBe(CLASSIC ? HOME_FAQ_CLASSIC : HOME_FAQ);
  });
});
