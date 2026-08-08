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
  // Il conteggio è scritto a mano di proposito: derivarlo da TOOL_SLUGS renderebbe
  // l'asserzione vuota. Va alzato a mano ogni volta che entra un tool — è il
  // promemoria che quel tool serve anche in undici dizionari e nella sitemap.
  it("ha dieci tool e undici lingue", () => {
    expect(TOOL_SLUGS).toHaveLength(10);
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

  it("gli esempi di ogni tool hanno numeri, non promesse", () => {
    // Ogni esempio deve contenere almeno una cifra: un \"esempio\" senza numeri
    // sarebbe solo un altro paragrafo travestito.
    for (const locale of TOOL_LOCALES) {
      for (const slug of TOOL_SLUGS) {
        const ex = TOOLS_COPY[locale]!.tools[slug].example;
        const text = [...ex.rows.map((r) => r.value), ex.note].join(" ");
        expect(text, `${locale}/${slug}: esempio senza numeri`).toMatch(/\d/);
      }
    }
  });

  it("il grassetto editoriale è chiuso, non lasciato a metà", () => {
    // `**` spaiati finirebbero a schermo come asterischi.
    for (const locale of TOOL_LOCALES) {
      for (const slug of TOOL_SLUGS) {
        for (const par of TOOLS_COPY[locale]!.tools[slug].explainer) {
          const marks = (par.match(/\*\*/g) ?? []).length;
          expect(marks % 2, `${locale}/${slug}: ** spaiato`).toBe(0);
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

      it("ha tutti i tool dichiarati in TOOL_SLUGS", () => {
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

          it("ha frase chiave, esempio numerico, spiegazione vera e FAQ", () => {
            const t = dict.tools[slug];
            // I blocchi formula sono stati rimossi da tutte le pagine (Andrea,
            // 2026-08-05): al loro posto un esempio numerico lavorato, che ogni
            // tool DEVE avere — quello slot non può restare vuoto.
            expect(t.example.rows.length, "righe dell'esempio").toBeGreaterThanOrEqual(4);
            expect(t.example.title.length).toBeGreaterThan(8);
            expect(t.example.note.length).toBeGreaterThan(80);
            expect(t.takeaway.length, "frase chiave").toBeGreaterThan(40);
            expect(t.explainer.length).toBeGreaterThanOrEqual(2);
            // Misurato in CARATTERI e non in parole: polacco e turco dicono la
            // stessa cosa dell'inglese con ~40 parole in meno (misurato: 143 e
            // 137 parole contro 177, ma 968 e 888 caratteri contro 953). Una
            // soglia a parole boccia una traduzione densa, non una tirata via.
            const chars = t.explainer.join(" ").length;
            expect(chars, "caratteri nell'explainer").toBeGreaterThan(800);
            expect(t.faq.length).toBeGreaterThanOrEqual(3);
            for (const f of t.faq) {
              expect(f.q.length).toBeGreaterThan(8);
              expect(f.a.length).toBeGreaterThan(40);
            }
          });
        });
      }

      it("l'esempio di Kelly porta i numeri esatti", () => {
        const k = dict.tools["kelly-criterion"];
        const numbers = [...k.example.rows.map((r) => r.value), k.example.note].join(" ");
        // bankroll 1.000 · quota 2.00 · p 55% → edge 10% → pieno 100, mezzo 50;
        // cinque sconfitte: 1000·0.9^5 = 590 (serve +69%) · 1000·0.95^5 = 774 (+29%)
        for (const n of ["2.00", "55%", "10%", "100", "50", "590", "69", "774", "29"]) {
          expect(numbers, `numero mancante nell'esempio: ${n}`).toContain(n);
        }
      });

      it("l'esempio della multipla combacia con quello che mostra il calcolatore", () => {
        // Il default del ParlayCalculator è 4 × 1.80 col 5% di margine per gamba,
        // e mostra 10.50 · 9,53% · 21,55%. Il margine composto è l'unico numero
        // della pagina che nasce da un'ASSUNZIONE (il 5%): se l'esempio scrivesse
        // un valore diverso da 1,05⁴ − 1 nessuno saprebbe da dove viene.
        const p = dict.tools["parlay-calculator"];
        const numbers = [...p.example.rows.map((r) => r.value), p.example.note].join(" ");
        expect(numbers, "manca la quota 1.80").toContain("1.80");
        expect(numbers, "manca la quota combinata 10.50").toContain("10.50");
        expect(numbers, "manca la probabilità 9,53%").toMatch(/9[.,]53/);
        expect(numbers, "manca il margine composto 21,55%").toMatch(/21[.,]55/);
        // 21,6% è l'arrotondamento della vecchia pagina: qui il calcolatore
        // mostra due decimali, e l'esempio deve dire quello che si legge.
        expect(numbers, "21,6 non è quello che mostra il readout").not.toMatch(/21[.,]6[^0-9]/);
      });

      it("l'esempio del ROI porta il contrasto con lo yield, non un arrotondamento", () => {
        // Il valore delle due pagine è il confronto: lo STESSO 400 di profitto
        // è +40,00% su 1.000 di cassa e +4,00% su 10.000 giocati. Se una delle
        // due cifre sparisce dalla pagina, sparisce il contenuto.
        const t = dict.tools["roi-calculator"];
        const numbers = [...t.example.rows.map((r) => r.value), t.example.note].join(" ");
        expect(numbers, "manca il capitale 1.000").toMatch(/1[ .,]?000/);
        expect(numbers, "manca il ROI 40,00%").toMatch(/40[.,]00/);
        expect(numbers, "manca il capitale finale 1.400").toMatch(/1[ .,]?400/);
        expect(numbers, "manca il giocato 10.000").toMatch(/10[ .,]?000/);
        expect(numbers, "manca lo yield 4,00% del caso identico").toMatch(/4[.,]00/);
        // Il readout mostra due decimali: "40,0%" o "4,0%" non è ciò che si legge.
        expect(numbers, "40,0 non è quello che mostra il readout").not.toMatch(/40[.,]0(?!0)/);
        expect(numbers, "4,0 non è quello che mostra il readout").not.toMatch(/(?<!\d)4[.,]0(?!0)/);
        // Il rimando all'altra pagina non è decorativo: senza di lui la pagina
        // invita a confrontare un 40% di ROI con un 4% di yield.
        expect(t.explainer.join(" "), "l'explainer ROI non cita lo yield").toMatch(/yield/i);
      });

      it("l'esempio dello yield porta il turnover, il contrasto col ROI e il rumore", () => {
        // L'altra metà del confronto: 200 giocate da 50 fanno 10.000 di
        // turnover, e lo STESSO 400 di profitto è +4,00% qui e +40,00% di ROI.
        const t = dict.tools["yield-calculator"];
        const numbers = [...t.example.rows.map((r) => r.value), t.example.note].join(" ");
        expect(numbers, "mancano le 200 scommesse").toContain("200");
        expect(numbers, "manca lo stake medio 50").toContain("50");
        expect(numbers, "manca il turnover 10.000 derivato").toMatch(/10[ .,]?000/);
        expect(numbers, "manca lo yield 4,00%").toMatch(/4[.,]00/);
        expect(numbers, "manca il ROI 40,00% del caso identico").toMatch(/40[.,]00/);
        // La deviazione standard su 200 giocate: 1/√200 = 7,07 punti. È la riga
        // che impedisce alla pagina di far leggere un edge in venti scommesse.
        expect(numbers, "manca la deviazione standard 7,07 su 200 giocate").toMatch(/7[.,]07/);
        expect(numbers, "4,0 non è quello che mostra il readout").not.toMatch(/(?<!\d)4[.,]0(?!0)/);
        expect(t.explainer.join(" "), "l'explainer yield non cita il ROI").toMatch(/ROI/i);
        // Onestà obbligatoria: il tetto del ~5% e il campione che serve.
        expect(t.explainer.join(" "), "manca il riferimento al 5% sostenuto").toMatch(/5\s*%|%\s*5/);
        expect(t.explainer.join(" "), "manca il campione da 2.500 giocate").toMatch(/2[ .,]?500/);
      });

      it("l'esempio dello stake porta la puntata, il ritorno e la fetta di cassa", () => {
        // 100 di obiettivo a 2.50 ⇒ 100 / 1.5 = 66,67 di puntata, 166,67 di
        // ritorno, e su una cassa da 1.000 il 6,67%. Sono i default del
        // calcolatore: se l'esempio si sposta, la pagina si contraddice.
        const t = dict.tools["stake-calculator"];
        const numbers = [...t.example.rows.map((r) => r.value), t.example.note].join(" ");
        expect(numbers, "manca la quota 2.50").toMatch(/2[.,]50/);
        expect(numbers, "manca la puntata 66,67").toMatch(/66[.,]67/);
        expect(numbers, "manca il ritorno totale 166,67").toMatch(/166[.,]67/);
        expect(numbers, "manca la fetta di cassa 6,67%").toMatch(/6[.,]67/);
        // Il readout mostra due decimali: 66,7 e 6,7 non sono ciò che si legge.
        expect(numbers, "66,7 non è quello che mostra il readout").not.toMatch(/166?[.,]7(?!\d)/);
        expect(numbers, "6,7 non è quello che mostra il readout").not.toMatch(/(?<!\d)6[.,]7(?!\d)/);
        // Il rimando a Kelly è il punto della pagina, e passa dal 44% implicito:
        // 66,67 su 1.000 è il full Kelly di chi crede al 44% a 2.50 (edge +10%).
        const prose = t.explainer.join(" ");
        expect(prose, "l'explainer stake non cita Kelly").toMatch(/kelly|келли/i);
        expect(prose, "manca il 44% implicito nello stake da desiderio").toMatch(/44/);
      });

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
