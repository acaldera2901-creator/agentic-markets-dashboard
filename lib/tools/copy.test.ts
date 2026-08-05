// lib/tools/copy.test.ts (#TOOLS-HUB-0805)
// Il dizionario dei tool è l'unica fonte di testo delle 55 pagine: se un locale
// perde una chiave, quella pagina esce mezza inglese e nessuno se ne accorge in
// produzione. Questo test è il guardiano.

import { describe, it, expect } from "vitest";
import {
  TOOL_SLUGS,
  TOOL_LOCALES,
  isToolSlug,
  isToolLocale,
  toolPath,
  hubPath,
} from "./registry";
import { getToolsCopy, TOOLS_COPY } from "./copy";

describe("registry", () => {
  it("ha cinque tool e undici lingue", () => {
    expect(TOOL_SLUGS).toHaveLength(5);
    expect(TOOL_LOCALES).toHaveLength(11);
    expect(TOOL_LOCALES[0]).toBe("en");
  });

  it("riconosce slug e locali validi, rifiuta il resto", () => {
    expect(isToolSlug("kelly-criterion")).toBe(true);
    expect(isToolSlug("kelly")).toBe(false);
    expect(isToolSlug("../etc/passwd")).toBe(false);
    expect(isToolLocale("it")).toBe(true);
    expect(isToolLocale("xx")).toBe(false);
    expect(isToolLocale("EN")).toBe(false);
  });

  it("costruisce le URL: l'inglese senza prefisso, le altre col loro", () => {
    expect(hubPath("en")).toBe("/tools");
    expect(hubPath("it")).toBe("/it/tools");
    expect(toolPath("kelly-criterion", "en")).toBe("/tools/kelly-criterion");
    expect(toolPath("kelly-criterion", "it")).toBe("/it/tools/kelly-criterion");
    expect(toolPath("ev-calculator", "ru")).toBe("/ru/tools/ev-calculator");
  });
});

describe("dizionari registrati", () => {
  const locales = Object.keys(TOOLS_COPY) as (keyof typeof TOOLS_COPY)[];

  it("esistono per TUTTE le lingue dichiarate, senza fallback silenzioso all'inglese", () => {
    // getToolsCopy ripiega su en per un locale ignoto: comodo a runtime, ma se
    // una lingua dichiarata non ha il suo dizionario la pagina esce in inglese
    // sotto una URL /de/ — e nessuno se ne accorge. Questo lo impedisce.
    for (const locale of TOOL_LOCALES) {
      expect(locales, `dizionario mancante: ${locale}`).toContain(locale);
    }
  });

  it("non riusano l'oggetto inglese per un'altra lingua", () => {
    for (const locale of TOOL_LOCALES) {
      if (locale === "en") continue;
      expect(TOOLS_COPY[locale], locale).not.toBe(TOOLS_COPY.en);
      expect(TOOLS_COPY[locale]!.tools["kelly-criterion"].h1, locale).not.toBe(
        TOOLS_COPY.en.tools["kelly-criterion"].h1
      );
    }
  });

  it("l'esempio del margine è aritmeticamente giusto in ogni lingua", () => {
    // Trovato in verifica visiva il 2026-08-05: il testo diceva "1.91 e 1.91 →
    // 52.38% ciascuna → 104.76% → 4.76 punti", che sono i numeri della −110
    // ESATTA (1.909090…), mentre il calcolatore sulla stessa pagina mostrava
    // 4.71%. Ora l'esempio è 1.90/1.90 → 52.63% → 105.26% → 5.26 punti, e i
    // default del calcolatore sono gli stessi. Se qualcuno rimette i vecchi
    // numeri, la pagina torna a contraddirsi: questo test lo blocca.
    for (const locale of TOOL_LOCALES) {
      const text = TOOLS_COPY[locale]!.tools["margin-calculator"].explainer.join(" ");
      expect(text, `${locale}: manca l'esempio 1.90`).toContain("1.90");
      expect(text, `${locale}: manca il margine 5.26/5,26`).toMatch(/5[.,]26/);
      expect(text, `${locale}: 4.76 non corrisponde a 1.90/1.90`).not.toMatch(/4[.,]76/);
      expect(text, `${locale}: 52.38 non corrisponde a 1.90`).not.toMatch(/52[.,]38/);
    }
  });

  it("il 52,38% resta attribuito alla −110, non a 1.91", () => {
    // 1/1.91 = 52.36%. Il 52.38% è di 1.9091 (la −110 esatta): scriverlo accanto
    // a "1.91" fa sbagliare chiunque verifichi col nostro stesso convertitore.
    for (const locale of TOOL_LOCALES) {
      for (const par of TOOLS_COPY[locale]!.tools["odds-converter"].explainer) {
        if (/52[.,]38/.test(par)) {
          expect(par, `${locale}: 52,38% attribuito a 1.91`).not.toMatch(/1\.91[^0-9]/);
        }
      }
    }
  });

  it("non contengono caratteri fuori posto (residui di scrittura)", () => {
    for (const locale of TOOL_LOCALES) {
      const text = JSON.stringify(TOOLS_COPY[locale]);
      // CJK in un dizionario europeo = carattere finito lì per sbaglio.
      expect(text, `${locale}: carattere CJK`).not.toMatch(/[぀-ヿ一-鿿]/);
    }
  });

  for (const locale of Object.keys(TOOLS_COPY) as (keyof typeof TOOLS_COPY)[]) {
    describe(`locale ${locale}`, () => {
      const dict = TOOLS_COPY[locale]!;
      const en = TOOLS_COPY.en;

      it("ha l'hub completo", () => {
        expect(dict.hub.metaTitle.length).toBeGreaterThan(10);
        expect(dict.hub.metaDescription.length).toBeGreaterThan(50);
        expect(dict.hub.h1.length).toBeGreaterThan(3);
        expect(dict.hub.lede.length).toBeGreaterThan(20);
        expect(dict.hub.intro.length).toBeGreaterThanOrEqual(2);
      });

      it("ha le stringhe comuni", () => {
        for (const key of Object.keys(en.common) as (keyof typeof en.common)[]) {
          expect(dict.common[key], `common.${key}`).toBeTruthy();
        }
      });

      it("ha tutti e cinque i tool", () => {
        expect(Object.keys(dict.tools).sort()).toEqual([...TOOL_SLUGS].sort());
      });

      for (const slug of TOOL_SLUGS) {
        describe(slug, () => {
          it("ha metadata, titolo e attacco", () => {
            const t = dict.tools[slug];
            expect(t.metaTitle.length).toBeGreaterThan(10);
            expect(t.metaDescription.length).toBeGreaterThan(50);
            expect(t.metaDescription.length).toBeLessThan(200);
            expect(t.h1.length).toBeGreaterThan(3);
            expect(t.lede.length).toBeGreaterThan(20);
          });

          it("ha le stesse etichette dell'inglese, né una in meno né una inventata", () => {
            expect(Object.keys(dict.tools[slug].labels).sort()).toEqual(
              Object.keys(en.tools[slug].labels).sort()
            );
            for (const [k, v] of Object.entries(dict.tools[slug].labels)) {
              expect(v, `labels.${k}`).toBeTruthy();
            }
          });

          it("ha formula, spiegazione vera e FAQ", () => {
            const t = dict.tools[slug];
            expect(t.formula.length).toBeGreaterThanOrEqual(1);
            expect(t.explainer.length).toBeGreaterThanOrEqual(2);
            const words = t.explainer.join(" ").split(/\s+/).length;
            expect(words, "parole nell'explainer").toBeGreaterThan(150);
            expect(t.faq.length).toBeGreaterThanOrEqual(3);
            for (const f of t.faq) {
              expect(f.q.length).toBeGreaterThan(8);
              expect(f.a.length).toBeGreaterThan(40);
            }
          });
        });
      }

      it("la pagina Kelly porta l'avvertimento su varianza e rovina", () => {
        expect(dict.tools["kelly-criterion"].caveat!.length).toBeGreaterThan(60);
      });

      it("non promette profitti (FTC-safe)", () => {
        const all = JSON.stringify(dict).toLowerCase();
        for (const banned of [
          "guaranteed profit",
          "beat the market",
          "risk-free profit",
          "profitto garantito",
          "battiamo il mercato",
          "vincita garantita",
        ]) {
          expect(all, `claim vietato: ${banned}`).not.toContain(banned);
        }
      });
    });
  }
});

describe("getToolsCopy", () => {
  it("torna il dizionario del locale chiesto", () => {
    expect(getToolsCopy("en")).toBe(TOOLS_COPY.en);
  });

  it("ripiega sull'inglese per un locale che non esiste", () => {
    // @ts-expect-error: è esattamente il caso che vogliamo coprire
    expect(getToolsCopy("xx")).toBe(TOOLS_COPY.en);
  });
});
