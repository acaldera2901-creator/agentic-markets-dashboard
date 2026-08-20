// #CRM-WEEKLY-PICK-0729 — la Weekly Pick nel CRM.
//
// Il prodotto è vivo e si compra one-off, ma il CRM lo nominava una volta sola e
// solo come feature del Pro: un utente free non poteva sapere di poterlo
// sbloccare senza abbonarsi, e un ex-pagante non sapeva che esiste un rientro da
// una settimana invece che da un mese.
//
// NB sul posto di questo file: le asserzioni sul CRM stavano in
// `tests/crm-content.test.ts`, che **vitest non esegue** — `vitest.config.ts`
// include solo `{app,lib,components,features}/**/*.test.{ts,tsx}` e in CI non
// gira nient'altro sui .ts di `tests/`. Quel file resta invariato; questi casi
// vivono qui perché qui girano davvero.

import { describe, it, expect, beforeAll } from "vitest";
import { CRM_TOUCHPOINTS, CRM_LANGS, renderCrm } from "@/lib/crm-content";

const WP = /weekly pick/i;

// `renderCrm` firma il link di disiscrizione ed è fail-closed senza segreto:
// senza questo, i casi sul rendering fallirebbero per un motivo che non c'entra
// con ciò che stanno verificando.
beforeAll(() => {
  process.env.SESSION_SECRET ||= "test-secret-crm-weekly-pick";
});

describe("Weekly Pick nel CRM — copy", () => {
  it("dove è nominata, lo è in TUTTE e 5 le lingue", () => {
    // Una menzione che esiste solo in italiano è peggio di nessuna menzione:
    // l'offerta cambierebbe a seconda della lingua dell'utente.
    for (const t of CRM_TOUCHPOINTS) {
      const langs = CRM_LANGS.filter((l) => WP.test(t.body[l]));
      expect(
        langs.length === 0 || langs.length === CRM_LANGS.length,
        `${t.key}: citata in ${langs.length}/${CRM_LANGS.length} lingue (${langs.join(",")})`
      ).toBe(true);
    }
  });

  it("chi la nomina dice che si sblocca DA SOLA — è l'informazione che mancava", () => {
    for (const key of ["acq_day5_picture", "wb_day7_renew"]) {
      const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
      expect(t, `manca il touchpoint ${key}`).toBeTruthy();
      for (const lang of CRM_LANGS) {
        expect(t!.body[lang], `${key}/${lang}`).toMatch(WP);
      }
    }
  });

  it("nessun prezzo scritto a mano nel copy", () => {
    // `weeklyPickAmount()` applica lo sconto di lancio (LAUNCH_PROMO_ENABLED,
    // −50%): una cifra hardcodata diventa falsa il giorno in cui la promo si
    // accende o si spegne, e sarebbe falsa dentro una email già spedita.
    for (const t of CRM_TOUCHPOINTS) {
      for (const lang of CRM_LANGS) {
        expect(t.body[lang], `${t.key}/${lang}`).not.toMatch(/12[.,]99|6[.,]49/);
      }
    }
  });

  it("usa il nome localizzato del prodotto, come la pagina su cui atterra", () => {
    // "Weekly Pick" è il nome proprio e resta invariato ovunque (così lo scrive
    // `unlockTitle` in app/weekly-pick/page.tsx nelle 5 lingue), ma il nome
    // descrittivo è tradotto: se l'email dicesse "multipla della casa" a un
    // utente francese, atterrerebbe su una pagina che dice "combiné".
    const wb = CRM_TOUCHPOINTS.find((t) => t.key === "wb_day7_renew")!;
    expect(wb.body.it).toMatch(/multipla della casa/i);
    expect(wb.body.en).toMatch(/house accumulator/i);
    expect(wb.body.es).toMatch(/combinada de la casa/i);
    expect(wb.body.fr).toMatch(/combiné de la maison/i);
    expect(wb.body.ru).toMatch(/экспресс/i);
  });

  it("niente claim vietati nel copy nuovo (FTC)", () => {
    for (const t of CRM_TOUCHPOINTS) {
      for (const lang of CRM_LANGS) {
        expect((t.subject[lang] + t.body[lang]).toLowerCase()).not.toMatch(
          /guaranteed|safe bet|vincita sicura|ganancia segura|gain garanti|гарантированн/
        );
      }
    }
  });
});

describe("Weekly Pick nel CRM — destinazione del bottone", () => {
  it("il touchpoint che ne parla porta ALLA Weekly Pick, non ai piani", () => {
    for (const lang of CRM_LANGS) {
      const r = renderCrm("wb_day7_renew", lang, "test@example.com");
      expect(r, `render fallito: ${lang}`).toBeTruthy();
      expect(r!.html, lang).toMatch(/\/weekly-pick\?crm=wb_day7_renew/);
      // La versione testo è quella che vedono i client che non rendono HTML:
      // se il link vive solo nell'HTML, per loro l'email non ha CTA.
      expect(r!.text, lang).toMatch(/\/weekly-pick\?crm=wb_day7_renew/);
    }
  });

  it("l'attribuzione sopravvive al percorso nuovo", () => {
    // Senza `crm=<key>` la conversione della Weekly Pick sarebbe l'unica del CRM
    // non riconducibile all'email che l'ha generata.
    const r = renderCrm("wb_day7_renew", "it", "test@example.com")!;
    expect(r.html).toMatch(/crm=wb_day7_renew/);
  });

  it("la CTA dichiarata è completa in tutte le lingue", () => {
    for (const t of CRM_TOUCHPOINTS) {
      if (!t.cta) continue;
      for (const lang of CRM_LANGS) {
        expect(t.cta.label[lang]?.trim().length, `${t.key}/${lang}`).toBeTruthy();
      }
    }
  });

  it("non-regressione: tutti gli altri touchpoint puntano ancora ai piani", () => {
    // `cta` è additivo. Se questo cade, un campo opzionale ha cambiato il
    // comportamento di 15 email che nessuno voleva toccare.
    const senzaCta = CRM_TOUCHPOINTS.filter((t) => !t.cta);
    expect(senzaCta.length).toBeGreaterThan(10);
    for (const t of senzaCta) {
      // #CRM-FAKE-OFFERS-0805: i touchpoint che parlano di sconto NON si
      // renderizzano senza una deadline reale (fail-closed, per non spedire
      // "{deadline}" o un'offerta senza scadenza). Qui la forniamo perché il test
      // riguarda la DESTINAZIONE del bottone, non la promo.
      const r = renderCrm(t.key, "it", "test@example.com", {
        launchDeadline: "2026-09-05T23:59:00Z",
      });
      expect(r, t.key).toBeTruthy();
      // #URL-PATHS-0810: la destinazione default del CRM è il path nuovo /plans.
      expect(r!.html, t.key).toMatch(/\/plans\?crm=/);
      expect(r!.html.includes("Apri BetRedge"), `${t.key}: label generica persa`).toBe(true);
    }
  });

  it("il footer legale e l'unsubscribe restano su entrambi i percorsi", () => {
    for (const key of ["wb_day7_renew", "acq_day5_picture"]) {
      const r = renderCrm(key, "it", "test@example.com")!;
      expect(r.html, key).toContain("/api/crm/unsubscribe");
      expect(r.html, key).toMatch(/18\+|operatore di gioco/);
    }
  });
});
