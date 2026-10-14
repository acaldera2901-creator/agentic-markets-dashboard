// #CLASSIC-INVITE-1014 — guardie del copy della tab Invita (classic):
// parità delle 5 lingue, lessico vietato, la versione v1 senza denaro,
// l'anteprima v2 con i rischi detti e il banner «dati di esempio».
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INVITE_COPY, INVITE_LANGS, INVITE_SAMPLE, fillInvite, inviteCopy } from "./invite-copy";

type Group = Record<string, string>;
const groups = ["common", "v1", "v2"] as const;
const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

// Niente promesse di guadagno, niente urgenza, niente gergo da scommessa.
const BANNED =
  /earn up to|you(’|')ll earn|make money|passive income|easy money|get rich|unlimited|guadagna fino|soldi facili|reddito passivo|gana hasta|dinero fácil|ingresos pasivos|gagnez jusqu|argent facile|revenu passif|зарабатывайте до|лёгкие деньги|пассивный доход|only today|solo oggi|last chance|ultima occasione|hurry|affrettati|limited|limitat|beat the market|battiamo|\bedge\b|\+EV|value bet|\bstake\b|hit rate|win rate/i;

describe("invite copy (classic)", () => {
  it("5 lingue, stessi gruppi e chiavi dell'inglese, nessuna vuota, stessi segnaposto", () => {
    expect(INVITE_LANGS).toHaveLength(5);
    for (const g of groups) {
      const en = INVITE_COPY.en[g] as unknown as Group;
      const keys = Object.keys(en).sort();
      for (const l of INVITE_LANGS) {
        const cur = INVITE_COPY[l][g] as unknown as Group;
        expect(Object.keys(cur).sort(), `${l}.${g}`).toEqual(keys);
        for (const k of keys) {
          expect(cur[k].trim().length, `${l}.${g}.${k}`).toBeGreaterThan(0);
          expect(ph(cur[k]), `${l}.${g}.${k}`).toBe(ph(en[k]));
        }
      }
    }
  });

  it("nessuna parola vietata, in nessuna lingua e in nessun gruppo", () => {
    for (const l of INVITE_LANGS) for (const g of groups) {
      for (const [k, v] of Object.entries(INVITE_COPY[l][g])) expect(BANNED.test(v), `${l}.${g}.${k}: ${v}`).toBe(false);
    }
  });

  it("a flag v2 spento (common + v1) non si promettono soldi: nessuna valuta, nessuna commissione, nessuna percentuale tranne la promo di lancio", () => {
    const MONEY = /\$|€|USDT|USDC|Polygon|crypto|wallet|commission|commissione|comisi|комисси|payout|pagament|pago|versement|выплат|\b(20|7) ?%/i;
    for (const l of INVITE_LANGS) {
      const all = { ...INVITE_COPY[l].common, ...INVITE_COPY[l].v1 } as Group;
      for (const [k, v] of Object.entries(all)) {
        if (k === "promo") continue; // −50% sul prezzo: informazione, gated da launchPromoLive()
        expect(MONEY.test(v), `${l}.${k}: ${v}`).toBe(false);
      }
    }
  });

  it("l'anteprima v2 dice che è un'anteprima con dati di esempio, e i termini veri sono tutti scritti", () => {
    for (const l of INVITE_LANGS) {
      const t = INVITE_COPY[l].v2;
      expect(t.previewTitle, l).toMatch(/—/);
      expect(t.lede, l).toMatch(/20%/);
      expect(t.lede, l).toMatch(/7%/);
      expect(t.lede, l).toMatch(/USDT/);
      expect(t.lede, l).toMatch(/Polygon/);
      expect(t.lede, l).toMatch(/50 ?\$|\$50/);
      expect(t.rule2, l).toMatch(/\b60\b/); // hold 60 giorni
      expect(t.rule3, l).toMatch(/\b120\b/); // storno 120 giorni
      expect(t.rule4, l).toMatch(/50/);
      expect(t.lPendingNote, l).toMatch(/\b60\b/);
    }
    expect(INVITE_COPY.en.v2.previewTitle).toBe("Preview — program coming soon, sample data");
    expect(INVITE_COPY.it.v2.previewTitle).toBe("Anteprima — programma in arrivo, dati di esempio");
    // nessuna garanzia: il rischio detto, in ogni lingua
    expect(INVITE_COPY.en.v2.rule5).toMatch(/Nothing is guaranteed/);
    expect(INVITE_COPY.it.v2.rule5).toMatch(/Nessuna garanzia/);
    for (const l of INVITE_LANGS) expect(INVITE_COPY[l].v2.rule5.length, l).toBeGreaterThan(40);
  });

  it("il wallet dichiara che nulla viene raccolto", () => {
    expect(INVITE_COPY.en.v2.walletState).toMatch(/nothing typed here is collected/);
    expect(INVITE_COPY.it.v2.walletState).toMatch(/niente di quello che scrivi qui viene raccolto/);
  });

  it("i dati di esempio sono coerenti: commissione = 20% o 7% della base", () => {
    for (const r of INVITE_SAMPLE.rows) {
      const pct = r.event === "first" ? 0.2 : 0.07;
      expect(r.amount, r.who).toBeCloseTo(Math.round(r.base * pct * 100) / 100, 2);
    }
    expect(INVITE_SAMPLE.payable).toBeLessThan(INVITE_SAMPLE.threshold); // sotto soglia: «passa al mese dopo»
  });

  it("la soglia dell'esempio è quella del backend v2 proposto (MIN_PAYOUT_USD=50), se il file esiste", () => {
    let src = "";
    try { src = readFileSync("lib/affiliate/config.ts", "utf8"); } catch { /* backend v2 non mergiato: niente da confrontare */ }
    if (src) expect(src).toMatch(/MIN_PAYOUT_USD\s*=\s*50\b/);
    expect(INVITE_SAMPLE.threshold).toBe(50);
  });

  it("fallback inglese e segnaposto", () => {
    expect(inviteCopy("xx").common.copy).toBe("Copy link");
    expect(inviteCopy("it-IT").common.copy).toBe("Copia link");
    expect(fillInvite(inviteCopy("en").v1.tierAt, { n: 5 })).toBe("at 5 friends");
  });
});
