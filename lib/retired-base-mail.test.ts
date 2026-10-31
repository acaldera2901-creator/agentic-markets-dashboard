// #RETIRE-BASE-1031 — Base non si vende più: nessuna mail (benvenuto o scala CRM
// di upgrade) lo propone. L'upgrade è Pro, col prezzo vero del listino server.
import { describe, it, expect } from "vitest";
import { welcomeEmail } from "./email";
import { CRM_TOUCHPOINTS, CRM_LANGS } from "./crm-content";
import { PAYGATE_PRICES } from "./paygate";

const MONTHLY = `$${PAYGATE_PRICES.premium.monthly}`; // $29.99
const ANNUAL = `$${PAYGATE_PRICES.premium.annual}`; // $329.99

describe("mail senza Base", () => {
  it("benvenuto: in tutte le lingue propone Pro al prezzo vero, mai Base", () => {
    for (const lang of CRM_LANGS) {
      const { text, html } = welcomeEmail(lang);
      expect(text, lang).not.toMatch(/\bBase\b/);
      expect(html, lang).not.toMatch(/\bBase\b/);
      expect(text, lang).toContain("BetRedge Pro");
      expect(text, lang).toContain(MONTHLY);
      expect(text, lang).toContain(ANNUAL);
    }
  });

  it("CRM: nessun touchpoint nomina Base, in nessuna lingua", () => {
    for (const t of CRM_TOUCHPOINTS) {
      for (const lang of CRM_LANGS) {
        expect(`${t.subject[lang]} ${t.body[lang]}`, `${t.key}/${lang}`).not.toMatch(/\bBase\b/);
      }
    }
  });

  it("CRM: i touchpoint che citano un prezzo usano quello vero di Pro", () => {
    const priced = CRM_TOUCHPOINTS.filter((t) => /\$\d/.test(t.body.en));
    expect(priced.map((t) => t.key).sort()).toEqual(["acq_day2_tested", "acq_day5_picture"]);
    for (const t of priced) {
      for (const lang of CRM_LANGS) {
        expect(t.body[lang], `${t.key}/${lang}`).toContain(MONTHLY);
        expect(t.body[lang], `${t.key}/${lang}`).toContain(ANNUAL);
      }
    }
  });
});
