import { describe, it, expect } from "vitest";
import { quotaFillCopy, fillDay } from "./quota-fill";

// #QUOTA-NEXTDAY-0929 — il messaggio di board quando la quota di oggi è stata
// completata con le giornate successive.
const SOSTA = { today: 0, borrowed: 7, resumes_on: "2026-10-03" };

describe("quotaFillCopy", () => {
  it("zero partite oggi: dice che oggi non si gioca e quando si riprende, in 5 lingue", () => {
    expect(quotaFillCopy("it", "football", SOSTA)).toContain("Oggi il calcio non si gioca: riprende sabato 3 ottobre");
    expect(quotaFillCopy("en", "football", SOSTA)).toContain("No football today: it resumes Saturday 3 October");
    expect(quotaFillCopy("es", "football", SOSTA)).toContain("sábado");
    expect(quotaFillCopy("fr", "football", SOSTA)).toContain("samedi 3 octobre");
    expect(quotaFillCopy("ru", "football", SOSTA)).toContain("3 октября");
  });

  it("non dichiara una sosta nazionali che il server non conosce", () => {
    for (const lang of ["it", "en", "es", "fr", "ru"] as const) {
      expect(quotaFillCopy(lang, "football", SOSTA).toLowerCase()).not.toMatch(/nazional|international|nacional|international|сборн/);
    }
  });

  it("giornata corta: numero di oggi, singolare gestito", () => {
    const one = { today: 1, borrowed: 2, resumes_on: "2026-09-30" };
    const two = { today: 2, borrowed: 1, resumes_on: "2026-09-30" };
    expect(quotaFillCopy("it", "tennis", one)).toBe("Oggi c'è una sola partita di tennis: la tua quota di oggi include anche quelle di mercoledì 30 settembre.");
    expect(quotaFillCopy("it", "football", two)).toContain("Oggi ci sono solo 2 partite di calcio");
    expect(quotaFillCopy("en", "football", one)).toContain("Only one football match today");
  });

  it("una data rotta non fa esplodere il banner", () => {
    expect(fillDay("it", { resumes_on: "boh" })).toBe("boh");
    expect(fillDay("it", { resumes_on: "boh", resumes_at: "nemmeno" })).toBe("boh");
  });
});

// #QUOTA-TZ-FIX-0929 — lo scenario di prod del 29/09: prima card NY Red Bulls–
// St. Louis, 23:30Z del 30/09, mostrata «Thu 1 Oct, 01:30» a Roma. Il banner
// diceva «Wednesday 30 September» perché formattava il giorno UTC.
describe("quotaFillCopy nel fuso dell'utente", () => {
  const PROD = { today: 0, borrowed: 7, resumes_on: "2026-09-30", resumes_at: "2026-09-30T23:30:00.000Z" };
  it("Roma: riprende giovedì 1 ottobre, come la prima card", () => {
    expect(quotaFillCopy("en", "football", PROD, "Europe/Rome")).toContain("it resumes Thursday 1 October");
    expect(quotaFillCopy("it", "football", PROD, "Europe/Rome")).toContain("riprende giovedì 1 ottobre");
  });
  it("New York: la stessa partita è mercoledì 30 settembre, e il banner lo dice", () => {
    expect(quotaFillCopy("en", "football", PROD, "America/New_York")).toContain("it resumes Wednesday 30 September");
  });
  it("senza resumes_at (server precedente) resta il giorno del server", () => {
    expect(quotaFillCopy("en", "football", { today: 0, borrowed: 7, resumes_on: "2026-09-30" }, "Europe/Rome"))
      .toContain("it resumes Wednesday 30 September");
  });
  it("fuso non valido: nessuna eccezione", () => {
    expect(() => quotaFillCopy("en", "football", PROD, "Not/AZone")).not.toThrow();
  });
});
