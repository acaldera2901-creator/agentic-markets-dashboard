// #CLASSIC-PLANS-1014 — parità delle 5 lingue del desk, lessico vietato
// (FTC-safe, REGOLE-CLASSIC) e il prezzo annuale in pari con la fonte.
import { describe, expect, it } from "vitest";
import { PLANS_COPY, PLANS_LANGS, PRO_ANNUAL_USD, fillPlans, plansCopy } from "./plans-copy";
import { PAYGATE_PRICES } from "@/lib/paygate";
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan";

// Niente «battiamo il mercato», percentuali di successo, superlativi di
// popolarità, urgenza, gergo da scommessa (value bet, stake, edge, +EV).
const BANNED = /beat the market|battiamo|batir al mercado|battre le marché|обыгра|hit rate|win rate|\d+ ?%|guarantee|garanti|popular|popolare|populaire|популярн|most popular|only today|solo oggi|last chance|limited|\bedge\b|\+EV|value bet|\bstake\b|\btips?\b|calibrat|калибров/i;

describe("plans copy (classic)", () => {
  it("5 lingue, ogni chiave presente e non vuota, stessi segnaposto dell'inglese", () => {
    expect(PLANS_LANGS).toHaveLength(5);
    const keys = Object.keys(PLANS_COPY.en) as (keyof typeof PLANS_COPY.en)[];
    for (const l of PLANS_LANGS) {
      expect(Object.keys(PLANS_COPY[l]).sort(), l).toEqual([...keys].sort());
      for (const k of keys) {
        expect(PLANS_COPY[l][k].trim().length, `${l}.${k}`).toBeGreaterThan(0);
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
        expect(ph(PLANS_COPY[l][k]), `${l}.${k}`).toBe(ph(PLANS_COPY.en[k]));
      }
    }
  });

  it("nessuna parola vietata, in nessuna lingua", () => {
    for (const l of PLANS_LANGS) for (const [k, v] of Object.entries(PLANS_COPY[l])) {
      expect(BANNED.test(v), `${l}.${k}: ${v}`).toBe(false);
    }
  });

  it("i numeri veri: Free 3 per sport, Base 7 (solo per chi ce l'ha già)", () => {
    for (const l of PLANS_LANGS) {
      expect(PLANS_COPY[l].f1).toMatch(/\b3\b/);
      expect(PLANS_COPY[l].freeDesc).toMatch(/\b3\b/);
      expect(PLANS_COPY[l].onBase).toMatch(/\b7\b/);
    }
  });

  it("rinnovo automatico, disdetta dall'account e crypto 30 giorni stanno nella riga vicino alla CTA", () => {
    for (const l of PLANS_LANGS) {
      const b = PLANS_COPY[l].billing;
      expect(b).toMatch(/30/);
      expect(b.length).toBeGreaterThan(80);
    }
    expect(PLANS_COPY.en.billing).toMatch(/renews .* until you cancel/);
    expect(PLANS_COPY.en.billing).toMatch(/Crypto: one payment, 30 days, no renewal/);
    expect(PLANS_COPY.it.billing).toMatch(/si rinnova .* finché non lo disdici/);
  });

  it("il prezzo annuale del Pro è quello di PayGate, il mensile quello pubblico", () => {
    expect(PRO_ANNUAL_USD).toBe(PAYGATE_PRICES.premium.annual);
    expect(PUBLIC_PAID_PLANS.premium.amountUsdt).toBe(PAYGATE_PRICES.premium.monthly);
  });

  it("fallback inglese e segnaposto", () => {
    expect(plansCopy("xx").proTag).toBe("The whole board");
    expect(plansCopy("it-IT").proTag).toBe("Tutto il board");
    expect(fillPlans(plansCopy("en").accessUntil, { d: "13 Nov 2026" })).toBe("Access until 13 Nov 2026.");
  });
});
