import { describe, it, expect } from "vitest";
import { quotaRuleCopy } from "./quota-rule";

// #INCLUDED-TODAY-0928 — la riga «le tue N letture di oggi · altre M con Pro».
describe("quotaRuleCopy", () => {
  it("plurale: i due numeri sono quelli passati, in tutte le lingue", () => {
    expect(quotaRuleCopy("it", 3, 12)).toEqual({ yours: "Le tue 3 letture di oggi", more: "Altre 12 con Pro" });
    expect(quotaRuleCopy("en", 7, 40)).toEqual({ yours: "Your 7 readings today", more: "40 more with Pro" });
    expect(quotaRuleCopy("es", 3, 2)).toEqual({ yours: "Tus 3 lecturas de hoy", more: "2 más con Pro" });
    expect(quotaRuleCopy("fr", 3, 2)).toEqual({ yours: "Vos 3 lectures du jour", more: "2 de plus avec Pro" });
    expect(quotaRuleCopy("ru", 3, 2)).toEqual({ yours: "Открыто сегодня: 3", more: "Ещё 2 с Pro" });
  });
  it("singolare: una partita sola oggi non produce «1 letture»", () => {
    expect(quotaRuleCopy("it", 1, 1)).toEqual({ yours: "La tua lettura di oggi", more: "Un'altra con Pro" });
    expect(quotaRuleCopy("en", 1, 1)).toEqual({ yours: "Your reading today", more: "1 more with Pro" });
    expect(quotaRuleCopy("fr", 1, 1).yours).toBe("Votre lecture du jour");
    expect(quotaRuleCopy("es", 1, 1).more).toBe("Una más con Pro");
  });
  it("non scrive mai un numero negativo o frazionario", () => {
    expect(quotaRuleCopy("en", -2, 2.9).yours).toBe("Your 0 readings today");
    expect(quotaRuleCopy("en", 2.9, -1).more).toBe("0 more with Pro");
  });
});
