// #CRM-FAKE-OFFERS-0805 — il CRM prometteva sconti che non esistono.
//
// Trovato il 05/08 cercando dove mettere la promo di lancio nel CRM. Tre email di
// acquisition, tutte LIVE e tutte con una promessa non mantenibile:
//
//   acq_day14_welcome_offer (day 10)  "−20% per 72h"
//   acq_day21_last_chance   (day 21)  "−30% per 48h"
//   acq_day28_final         (day 28)  "−30% + 3 giorni di prova Pro"
//
// Nel codice l'unico sconto è LAUNCH_PROMO_DISCOUNT = 0.5 (−50%, solo primo
// acquisto) e di trial non esiste NESSUN meccanismo. Erano già uscite **8 copie a
// 4 persone reali** (l'ultima la mattina del 05/08). E il countdown era
// per-utente — 72h/48h — cioè il dark pattern che il resto del prodotto evita di
// proposito («mai un timer per-utente che si resetta»).
//
// Questi test non difendono il copy: difendono la REGOLA. Il primo è quello che
// conta — impedisce che un'altra percentuale inventata rientri per distrazione.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CRM_TOUCHPOINTS,
  promoGatedKeys,
  renderCrm,
  launchDeadlineLabel,
} from "./crm-content";
import { LAUNCH_PROMO_DISCOUNT } from "./paygate";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;
const ENV = { ...process.env };

beforeEach(() => {
  process.env.LAUNCH_PROMO_DEADLINE = "2026-09-05T23:59:00Z";
  // renderCrm firma il link di disiscrizione: senza segreto è fail-closed e
  // solleva (giusto in produzione, rumore qui).
  process.env.CRM_UNSUB_SECRET = "test-secret";
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("nessuna percentuale inventata può rientrare", () => {
  const REAL = `${Math.round(LAUNCH_PROMO_DISCOUNT * 100)}`; // "50"

  it("ogni percentuale citata nel copy è quella VERA", () => {
    const offenders: string[] = [];
    for (const t of CRM_TOUCHPOINTS) {
      for (const lang of LANGS) {
        for (const field of ["subject", "body"] as const) {
          const text = t[field][lang];
          for (const m of text.matchAll(/(\d+)\s?%/g)) {
            if (m[1] !== REAL) offenders.push(`${t.key}.${field}.${lang}: ${m[0]}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("chi cita una percentuale è gatato sulla promo", () => {
    const gated = promoGatedKeys();
    const ungatedWithPercent = CRM_TOUCHPOINTS.filter(
      (t) =>
        !gated.has(t.key) &&
        LANGS.some((l) => /\d+\s?%/.test(t.subject[l]) || /\d+\s?%/.test(t.body[l]))
    ).map((t) => t.key);
    expect(ungatedWithPercent).toEqual([]);
  });

  it("nessuna email promette un trial: nel prodotto non esiste", () => {
    // "provare"/"tested" sono legittimi; quello che non deve esistere è la
    // promessa di N giorni di prova di un piano.
    const TRIAL = /(\d+\s?(giorni|days?|días|jours|дн\w*)\s+(di\s+)?(prova|trial|prueba|essai|пробн))|(prova|trial|prueba|essai)\s+(gratuita|gratis|free|de\s+\d)/i;
    const offenders = CRM_TOUCHPOINTS.filter((t) =>
      LANGS.some((l) => TRIAL.test(t.subject[l]) || TRIAL.test(t.body[l]))
    ).map((t) => t.key);
    expect(offenders).toEqual([]);
  });
});

describe("i touchpoint con offerta sono gatati e datati", () => {
  it("promoGatedKeys è derivata dai dati, non scritta a mano", () => {
    const gated = promoGatedKeys();
    expect(gated).toEqual(
      new Set(CRM_TOUCHPOINTS.filter((t) => t.requiresLaunchPromo).map((t) => t.key))
    );
    // le tre offerte di acquisition
    expect(gated.has("acq_day14_welcome_offer")).toBe(true);
    expect(gated.has("acq_day21_last_chance")).toBe(true);
    expect(gated.has("acq_day28_final")).toBe(true);
  });

  it("ogni touchpoint gatato porta {deadline} in TUTTE le 5 lingue", () => {
    // Se una lingua non lo avesse, quel cliente riceverebbe un'offerta senza
    // scadenza — che è il claim che la guardia FTC vuole evitare.
    for (const t of CRM_TOUCHPOINTS.filter((x) => x.requiresLaunchPromo)) {
      for (const lang of LANGS) {
        expect(t.body[lang], `${t.key}/${lang}`).toContain("{deadline}");
      }
    }
  });

  it("NESSUN touchpoint non-gatato parla di scadenza promo", () => {
    for (const t of CRM_TOUCHPOINTS.filter((x) => !x.requiresLaunchPromo)) {
      for (const lang of LANGS) {
        expect(t.body[lang]).not.toContain("{deadline}");
      }
    }
  });

  it("winback e retention non sono gatati: chi ha già pagato NON è idoneo", () => {
    // Prometterebbero uno sconto che il checkout rifiuta (firstPaidOrder=false).
    // ⚠️ Il 05/08 questo commento diceva che il copy di winback e retention "era
    // già coerente" perché non prometteva sconti. Era vero e insufficiente: quelle
    // due email promettevano un "bonus fedeltà (early access)" e "un'offerta
    // riservata", cioè benefici inesistenti invece di prezzi inesistenti. Corrette
    // il 17/08 (#CRM-COPY-TRUTHFUL-0817); la guardia sta nel describe qui sotto.
    const gated = promoGatedKeys();
    const wrongFlow = CRM_TOUCHPOINTS.filter(
      (t) => gated.has(t.key) && t.flow !== "acquisition"
    ).map((t) => t.key);
    expect(wrongFlow).toEqual([]);
  });
});

// #CRM-COPY-TRUTHFUL-0817 — il fix del 05/08 guardava UN asse solo (percentuali,
// sconti, trial) e ne restava un altro aperto: benefici inventati che non sono
// prezzi. Tre email promettevano roba che nel prodotto non esiste — un "bonus
// fedeltà (early access)" con una "streak" (ret_1d_before), "un'offerta riservata"
// non gatata e con CTA a prezzo pieno (wb_day14_offer), "il riepilogo del mese"
// che l'email non contiene (ret_7d_before) — e ret_7d_before era già uscita a un
// destinatario reale il 17/08 alle 07:00.
//
// Un denylist non può dimostrare un'assenza: la regola che difende è "se il copy
// NOMINA un beneficio, quel beneficio deve esistere nel prodotto". Quando ne
// scappa un altro, si aggiunge qui invece di correggere solo la stringa.
describe("nessun beneficio inventato può rientrare", () => {
  const FAKE_BENEFITS: Array<[string, RegExp]> = [
    ["bonus fedeltà", /bonus\s+(fedelt\w+|de\s+fidelidad|fid[ée]lit\w*)|loyalty\s+bonus|бонус за лояльность/i],
    ["early access", /early\s+access|access[oa]\s+anticipad[oa]|accès\s+anticipé|ранний доступ/i],
    ["streak", /\bstreak\b|\bracha\b|votre\s+série|сохраните серию/i],
    ["riepilogo del mese", /riepilogo del mese|monthly recap|resumen del mes|r[ée]cap du mois|итоги месяца/i],
    ["offerta riservata", /offert[ae]\s+(riservat\w+|privat\w+)|private\s+\w*\s?offer|oferta\s+(reservada|privada)|offre\s+(réservée|privée)|(закрытое|личное) предложение/i],
    ["programma fedeltà", /programma\s+fedelt\w+|loyalty\s+program|programa\s+de\s+fidelidad/i],
  ];

  it.each(FAKE_BENEFITS)("nessun touchpoint promette %s", (_label, re) => {
    const offenders: string[] = [];
    for (const t of CRM_TOUCHPOINTS) {
      for (const lang of LANGS) {
        for (const field of ["subject", "body"] as const) {
          if (re.test(t[field][lang])) offenders.push(`${t.key}.${field}.${lang}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("i tre touchpoint corretti restano corretti in tutte e 5 le lingue", () => {
    // Pin di regressione sui casi concreti: non basta che il denylist passi, i
    // tre devono avere copy non vuoto e coerente col fatto che li ha sostituiti.
    for (const key of ["ret_1d_before", "ret_7d_before", "wb_day14_offer"]) {
      const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
      expect(t, key).toBeDefined();
      for (const lang of LANGS) {
        expect(t!.subject[lang].length, `${key}/${lang} subject`).toBeGreaterThan(10);
        expect(t!.body[lang].length, `${key}/${lang} body`).toBeGreaterThan(40);
      }
    }
  });

  it("wb_day14_offer non promette più nulla di acquistabile a condizioni speciali", () => {
    // La chiave conserva "_offer" perché è la PK del dedup (rinominarla
    // rimanderebbe l'email a chi l'ha già ricevuta): il contratto vero è il copy.
    const t = CRM_TOUCHPOINTS.find((x) => x.key === "wb_day14_offer")!;
    expect(t.requiresLaunchPromo).toBeUndefined();
    for (const lang of LANGS) {
      expect(t.body[lang]).not.toMatch(/sconto|discount|descuento|remise|скидк/i);
      expect(t.body[lang]).not.toContain("{deadline}");
    }
  });
});

describe("render: mai un token grezzo, mai una data inventata", () => {
  it("sostituisce {deadline} con la data reale, localizzata", () => {
    const it = renderCrm("acq_day14_welcome_offer", "it", "a@b.com");
    expect(it).not.toBeNull();
    expect(it!.text).not.toContain("{deadline}");
    expect(it!.html).not.toContain("{deadline}");
    expect(it!.text).toContain("5 settembre");

    const en = renderCrm("acq_day14_welcome_offer", "en", "a@b.com");
    expect(en!.text).toMatch(/5 September/);
  });

  it("senza deadline NON renderizza — il chiamante non ha niente da inviare", () => {
    delete process.env.LAUNCH_PROMO_DEADLINE;
    for (const key of ["acq_day14_welcome_offer", "acq_day21_last_chance", "acq_day28_final"]) {
      for (const lang of LANGS) {
        expect(renderCrm(key, lang, "a@b.com"), `${key}/${lang}`).toBeNull();
      }
    }
  });

  it("una deadline invalida non passa per buona", () => {
    process.env.LAUNCH_PROMO_DEADLINE = "non-una-data";
    expect(renderCrm("acq_day28_final", "it", "a@b.com")).toBeNull();
    expect(launchDeadlineLabel("it", "spazzatura")).toBeNull();
    expect(launchDeadlineLabel("it", null)).toBeNull();
  });

  it("i touchpoint SENZA offerta si renderizzano come prima, promo o non promo", () => {
    delete process.env.LAUNCH_PROMO_DEADLINE;
    const m = renderCrm("onb_activate", "it", "a@b.com");
    expect(m).not.toBeNull();
    expect(m!.subject).toBeTruthy();
  });

  it("la deadline esplicita vince sull'env", () => {
    const m = renderCrm("acq_day21_last_chance", "en", "a@b.com", {
      launchDeadline: "2026-10-01T00:00:00Z",
    });
    expect(m!.text).toContain("1 October");
  });
});

describe("la data annunciata è quella che il server applica", () => {
  it("formatta in UTC, non nel fuso del server", () => {
    // launchPromoActive() confronta now < deadline in UTC. Con 23:59Z e un server
    // in Europa, il fuso locale avrebbe reso "6 settembre" per una promo che
    // muore il 5: un giorno di sconto promesso e non erogato.
    process.env.LAUNCH_PROMO_DEADLINE = "2026-09-05T23:59:00Z";
    expect(launchDeadlineLabel("it")).toBe("5 settembre");
    expect(launchDeadlineLabel("en")).toBe("5 September");
    expect(launchDeadlineLabel("fr")).toBe("5 septembre");
  });

  it("regge una deadline a mezzanotte esatta", () => {
    process.env.LAUNCH_PROMO_DEADLINE = "2026-09-01T00:00:00Z";
    expect(launchDeadlineLabel("en")).toBe("1 September");
  });
});

// #CRM-RENEWAL-COND-0819 — la clausola sul rinnovo deve dipendere dal rail, e in
// assenza di informazione deve TACERE. Il difetto che questo test difende: dire
// "l'accesso non si rinnova da solo, paga di nuovo" a un abbonato carta Shopify è
// falso (i selling plan sono MONTH/YEAR, verificato nel sorgente da calde il 19/08)
// e nella lettura peggiore lo invita a pagare due volte.
describe("clausola sul rinnovo: condizionale al rail, muta se non sa", () => {
  const RINNOVO = /rinnov|renew|renov|продлев/i;

  it("rail one-off: dice che non si rinnova, ed è vero", () => {
    for (const src of ["paygate", "PayGate", " paypal ", "crypto"]) {
      const m = renderCrm("ret_7d_before", "it", "a@b.com", { planSource: src });
      expect(m, src).not.toBeNull();
      expect(m!.text, src).toMatch(/non si rinnova da solo/i);
    }
  });

  it("rail ricorrenti: dice che si rinnova da solo, senza 'se'", () => {
    // plan-grant.ts distingue GIA' i due casi shopify: 'shopify' = subscription
    // contract, 'shopify_oneoff' = 30 giorni una volta. Quindi la frase e' certa.
    for (const src of ["shopify", "stripe"]) {
      const m = renderCrm("ret_7d_before", "it", "a@b.com", { planSource: src });
      expect(m!.text, src).toMatch(/si rinnova da solo/i);
      expect(m!.text, src).not.toMatch(/non si rinnova/i);
      expect(m!.text, src).not.toMatch(/se.*rinnovo automatico/i);
    }
  });

  it("shopify_oneoff sta con i one-off, non con i ricorrenti", () => {
    // E' il caso che avevo trattato come ambiguo al primo giro: non lo e'.
    const m = renderCrm("ret_7d_before", "it", "a@b.com", { planSource: "shopify_oneoff" });
    expect(m!.text).toMatch(/non si rinnova da solo/i);
  });

  it("sorgente assente o non-pagante: NESSUNA frase sul rinnovo", () => {
    for (const src of [undefined, null, "", "referral", "manual", "admin"]) {
      const m = renderCrm("ret_7d_before", "it", "a@b.com", { planSource: src });
      expect(m, String(src)).not.toBeNull();
      expect(m!.text, String(src)).not.toMatch(RINNOVO);
      // e il resto dell'email c'è ancora: il silenzio non deve svuotare il corpo
      expect(m!.text, String(src)).toMatch(/piano Free/i);
    }
  });

  it("nessun token grezzo e nessun doppio spazio in nessuna lingua e su nessun rail", () => {
    for (const lang of LANGS) {
      for (const src of [undefined, "shopify", "paygate", "referral"]) {
        const m = renderCrm("ret_7d_before", lang, "a@b.com", { planSource: src });
        const tag = `${lang}/${src}`;
        expect(m, tag).not.toBeNull();
        expect(m!.text, tag).not.toContain("{renewal}");
        expect(m!.html, tag).not.toContain("{renewal}");
        expect(m!.text, tag).not.toMatch(/ {2,}/);
      }
    }
  });
});
