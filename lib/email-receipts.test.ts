import { describe, it, expect } from "vitest";
import { resolveMailLang, receiptEmail, weeklyPickReceiptEmail, planActivatedEmail } from "./email";

// #CRYPTO-RECEIPTS-1 — la lingua è quella con cui il cliente si è iscritto
// (profiles.language). Stessa risoluzione di resolveCrmLang, così le mail di
// pagamento e quelle del CRM non escono in due lingue diverse per lo stesso cliente.
describe("resolveMailLang", () => {
  it("accetta le 5 lingue del sito, normalizza varianti e case", () => {
    expect(resolveMailLang("it")).toBe("it");
    expect(resolveMailLang("EN")).toBe("en");
    expect(resolveMailLang("es")).toBe("es");
    expect(resolveMailLang("fr-FR")).toBe("fr");
    expect(resolveMailLang("ru")).toBe("ru");
  });

  it("lingua ignota o assente → italiano, come il CRM", () => {
    expect(resolveMailLang("de")).toBe("it");
    expect(resolveMailLang(null)).toBe("it");
    expect(resolveMailLang("")).toBe("it");
  });
});

describe("receiptEmail", () => {
  // Il difetto che questa correzione chiude: i chiamanti non passavano `lang`, e il
  // builder trattava qualunque valore diverso da "en" come italiano → i profili `en`
  // (la maggioranza in DB) ricevevano la ricevuta in italiano.
  it("esce nella lingua del cliente, importo e valuta formattati per quella lingua", () => {
    const it = receiptEmail(1499, "USD", "base", null, "it");
    expect(it.subject).toBe("Ricevuta di pagamento BetRedge");
    expect(it.text).toContain("14,99");

    const en = receiptEmail(1499, "USD", "base", null, "en");
    expect(en.subject).toBe("Your BetRedge payment receipt");
    expect(en.text).toContain("14.99");

    expect(receiptEmail(1499, "USD", "base", null, "es").subject).toBe("Recibo de pago BetRedge");
    expect(receiptEmail(1499, "USD", "base", null, "fr").subject).toBe("Votre reçu de paiement BetRedge");
    expect(receiptEmail(1499, "USD", "base", null, "ru").subject).toBe("Квитанция об оплате BetRedge");
  });

  it("importo assente: nessuna riga inventata", () => {
    const m = receiptEmail(null, null, "premium", null, "en");
    expect(m.text).not.toMatch(/Amount/);
    expect(m.text).toContain("Premium");
  });
});

describe("weeklyPickReceiptEmail", () => {
  // Builder separato da receiptEmail di proposito: quello parla di "BetRedge Pro" e
  // di rinnovo/scadenza, che su un acquisto di UNA settimana sarebbe una ricevuta
  // falsa. Questa è la regola che il test protegge.
  it("nomina la settimana comprata e dichiara che NON si rinnova", () => {
    const m = weeklyPickReceiptEmail(1299, "USD", "2026-07-27", "it");
    expect(m.subject).toBe("Ricevuta — Weekly Pick");
    expect(m.text).toContain("12,99");
    expect(m.text).toContain("27/07/2026");
    expect(m.text).toMatch(/non si rinnova/);
    // Mai spacciata per un abbonamento.
    expect(m.text).not.toMatch(/BetRedge Pro|Base|Premium|scadenza/);
  });

  it("le 5 lingue ci sono tutte e dicono tutte che è un acquisto singolo", () => {
    const claims: Record<string, RegExp> = {
      it: /non si rinnova/,
      en: /does not renew/,
      es: /no se renueva/,
      fr: /ne se renouvelle pas/,
      ru: /не продлевается/,
    };
    for (const [lang, re] of Object.entries(claims)) {
      const m = weeklyPickReceiptEmail(1299, "USD", "2026-07-27", lang);
      expect(m.text, `lingua ${lang}`).toMatch(re);
      expect(m.subject.length, `lingua ${lang}`).toBeGreaterThan(0);
    }
  });

  it("porta il link alla Weekly Pick, non al desk", () => {
    const m = weeklyPickReceiptEmail(1299, "USD", "2026-07-27", "en");
    expect(m.text).toContain("/weekly-pick");
  });
});

// È la conferma che riceve anche chi paga in crypto (notifyPlanActivated la manda su
// tutti i rail) e usciva sempre in italiano.
describe("planActivatedEmail", () => {
  it("esce nella lingua del cliente", () => {
    expect(planActivatedEmail(null, "it").subject).toBe("BetRedge Pro attivato ✅");
    expect(planActivatedEmail(null, "en").subject).toBe("BetRedge Pro activated ✅");
    expect(planActivatedEmail(null, "es").subject).toBe("BetRedge Pro activado ✅");
    expect(planActivatedEmail(null, "fr").subject).toBe("BetRedge Pro activé ✅");
    expect(planActivatedEmail(null, "ru").subject).toBe("BetRedge Pro активирован ✅");
  });

  it("data di scadenza nel formato della lingua", () => {
    expect(planActivatedEmail("2026-08-27T00:00:00Z", "it").text).toContain("27/08/2026");
    expect(planActivatedEmail("2026-08-27T00:00:00Z", "en").text).toContain("27/08/2026");
  });
});
