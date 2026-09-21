// #BLEND-ALPHA-0914 — pinna il peso del modello nel blend e le leghe dove e' zero.
// I valori vengono dalla misura su prediction_log del 14/09/2026 (commento in
// lib/poisson-model.ts). Cambiarli e' una decisione con APPROVE, non un refactor.
import { describe, it, expect } from "vitest";
import {
  MARKET_BLEND_ALPHA,
  MODEL_OFF_LEAGUES,
  blendAlphaFor,
  blendWithMarket,
} from "@/lib/poisson-model";

describe("#BLEND-ALPHA-0914 — peso del modello nel blend", () => {
  it("il peso di default e' 0,1 (era 0,3)", () => {
    expect(MARKET_BLEND_ALPHA).toBe(0.1);
  });

  it("le sei leghe misurate servono il prezzo puro (alpha 0)", () => {
    for (const code of ["DNK", "BEL", "NED", "LOI", "EFLC", "WC"]) {
      expect(MODEL_OFF_LEAGUES.has(code)).toBe(true);
      expect(blendAlphaFor(code)).toBe(0);
    }
  });

  it("le leghe neutre restano ad alpha pieno", () => {
    for (const code of ["MLS", "BRA", "BL2", "EL1", "PL", "SA"]) {
      expect(blendAlphaFor(code)).toBe(MARKET_BLEND_ALPHA);
    }
    expect(blendAlphaFor(null)).toBe(MARKET_BLEND_ALPHA);
    expect(blendAlphaFor(undefined)).toBe(MARKET_BLEND_ALPHA);
  });

  it("con alpha 0 il servito E' il mercato devigato, con alpha 0,1 sta a un decimo del modello", () => {
    const model = { pHome: 0.6, pDraw: 0.25, pAway: 0.15 };
    const market = { home: 0.4, draw: 0.3, away: 0.3 };
    const off = blendWithMarket(model, market, blendAlphaFor("BEL"));
    expect(off.pHome).toBeCloseTo(0.4, 12);
    expect(off.pDraw).toBeCloseTo(0.3, 12);
    const on = blendWithMarket(model, market, blendAlphaFor("MLS"));
    expect(on.pHome).toBeCloseTo(0.1 * 0.6 + 0.9 * 0.4, 12);
    expect(on.pHome + on.pDraw + on.pAway).toBeCloseTo(1, 12);
  });

  it("senza mercato il blend resta l'identita' anche nelle leghe a zero (fail-closed, nessun prezzo inventato)", () => {
    const model = { pHome: 0.6, pDraw: 0.25, pAway: 0.15 };
    const b = blendWithMarket(model, null, blendAlphaFor("DNK"));
    expect(b).toEqual(model);
  });
});
