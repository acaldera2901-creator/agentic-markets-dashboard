// #MAIL-I18N-5LANG-0805 — tutte le mail in tutte e 5 le lingue, per davvero.
//
// Prima: sito, CRM e ricevute parlavano 5 lingue; le mail di ACCOUNT no. Sei
// funzioni erano tipizzate `"it" | "en"` o usavano `const it = lang !== "en"`,
// quindi spagnolo, francese e russo ricevevano l'ITALIANO — e la rotta auth
// collassava la lingua alla sorgente (`body.language === "en" ? "en" : "it"`)
// mentre nel profilo salvava quella vera. Risultato: un cliente spagnolo riceveva
// l'attivazione in italiano e poi il CRM in spagnolo.
//
// I fallback non erano nemmeno coerenti: activation/reset/payment cadevano su
// italiano, l'OTP su inglese. Stesso utente, due lingue diverse.
//
// Il test che conta è il primo: verifica che ogni lingua sia DAVVERO tradotta,
// non che la funzione accetti il parametro. Una stringa identica all'italiano su
// una lingua diversa è il modo in cui questo bug si ripresenta.
import { describe, it, expect } from "vitest";
import {
  activationEmail,
  passwordResetEmail,
  otpEmail,
  paymentReceivedEmail,
  planActivatedEmail,
  welcomeEmail,
  cancellationEmail,
  winBackEmail,
  receiptEmail,
  weeklyPickReceiptEmail,
  resolveMailLang,
  type MailLang,
} from "./email";

const LANGS: MailLang[] = ["it", "en", "es", "fr", "ru"];

// Ogni mail resa in una lingua: (lang) => {subject, text}
const MAILS: Record<string, (l: MailLang) => { subject: string; text: string; html?: string }> = {
  activation: (l) => activationEmail("https://x/y?token=abc", l),
  passwordReset: (l) => passwordResetEmail("https://x/reset?token=abc", l),
  otp: (l) => otpEmail("123456", l),
  paymentReceived: (l) => paymentReceivedEmail(l),
  planActivated: (l) => planActivatedEmail("2026-12-31T00:00:00Z", l),
  welcome: (l) => welcomeEmail(l),
  cancellation: (l) => cancellationEmail(l),
  winBack: (l) => winBackEmail(l),
  receipt: (l) => receiptEmail(1499, "USD", "base", "2026-09-30T00:00:00Z", l),
  weeklyPickReceipt: (l) => weeklyPickReceiptEmail(1299, "USD", "2026-08-03", l),
};

describe("ogni mail è tradotta in tutte e 5 le lingue", () => {
  for (const [name, render] of Object.entries(MAILS)) {
    it(`${name}: 5 lingue, nessuna che ricade sull'italiano`, () => {
      const subjects = new Map<MailLang, string>();
      for (const l of LANGS) {
        const m = render(l);
        expect(m.subject?.trim(), `${name}/${l} subject vuoto`).toBeTruthy();
        expect(m.text?.trim(), `${name}/${l} text vuoto`).toBeTruthy();
        subjects.set(l, m.subject);
      }
      // Il cuore del test: nessuna lingua diversa dall'italiano può avere lo
      // STESSO oggetto dell'italiano. Se ricade, non è tradotta.
      for (const l of LANGS) {
        if (l === "it") continue;
        expect(subjects.get(l), `${name}/${l} ricade sull'ITALIANO`).not.toBe(subjects.get("it"));
      }
    });
  }
});

describe("il corpo cambia con la lingua, non solo l'oggetto", () => {
  for (const [name, render] of Object.entries(MAILS)) {
    it(name, () => {
      const it0 = render("it").text;
      for (const l of LANGS) {
        if (l === "it") continue;
        expect(render(l).text, `${name}/${l}: corpo identico all'italiano`).not.toBe(it0);
      }
    });
  }
});

describe("nessun residuo del vecchio comportamento it|en", () => {
  it("es/fr/ru NON ricevono più l'italiano sulle mail di account", () => {
    // Sono le tre che erano tipizzate "it" | "en" e stanno sul percorso di
    // registrazione/accesso: se una di queste torna italiana, un cliente
    // spagnolo non riesce nemmeno a capire come attivare l'account.
    for (const l of ["es", "fr", "ru"] as MailLang[]) {
      expect(activationEmail("https://x", l).subject).not.toBe(activationEmail("https://x", "it").subject);
      expect(passwordResetEmail("https://x", l).subject).not.toBe(passwordResetEmail("https://x", "it").subject);
      expect(otpEmail("1", l).subject).not.toBe(otpEmail("1", "it").subject);
      // e nemmeno l'inglese, che era il fallback INCOERENTE dell'OTP
      expect(otpEmail("1", l).subject).not.toBe(otpEmail("1", "en").subject);
    }
  });

  it("il fallback è coerente: lingua ignota → italiano, per TUTTE", () => {
    for (const [name, render] of Object.entries(MAILS)) {
      expect(render("de" as MailLang).subject, name).toBe(render("it").subject);
      expect(render("" as MailLang).subject, name).toBe(render("it").subject);
    }
  });

  it("resolveMailLang accetta i codici lunghi e ignora il resto", () => {
    expect(resolveMailLang("es-ES")).toBe("es");
    expect(resolveMailLang("FR")).toBe("fr");
    expect(resolveMailLang("ru-RU")).toBe("ru");
    expect(resolveMailLang("de")).toBe("it");
    expect(resolveMailLang(null)).toBe("it");
    expect(resolveMailLang(undefined)).toBe("it");
  });
});

describe("l'OTP resta leggibile: il codice non si perde nella traduzione", () => {
  it("ogni lingua porta il codice in oggetto e corpo", () => {
    for (const l of LANGS) {
      const m = otpEmail("904137", l);
      expect(m.subject, l).toContain("904137");
      expect(m.text, l).toContain("904137");
    }
  });
});

describe("i link non vengono localizzati per sbaglio", () => {
  it("l'URL di attivazione e reset resta intatto in ogni lingua", () => {
    for (const l of LANGS) {
      expect(activationEmail("https://betredge.com/api/auth/activate?token=T", l).text)
        .toContain("https://betredge.com/api/auth/activate?token=T");
      expect(passwordResetEmail("https://betredge.com/reset?token=T", l).text)
        .toContain("https://betredge.com/reset?token=T");
    }
  });
});
