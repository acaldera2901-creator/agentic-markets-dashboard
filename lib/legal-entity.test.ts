// #EMAIL-SENDER-IDENTITY-0824 — la riga di identità del mittente e' l'unica cosa
// che tiene insieme i footer di TUTTE le email. Questi test esistono perche' e' gia'
// divergita una volta (PR #221: env con un'identita', sito con un'altra) e perche'
// il requisito e' esplicito: la societa' operativa non deve comparire nelle email.
import { describe, it, expect } from "vitest";
import { impressumLine, LEGAL_ENTITY, PRIVACY_CONTROLLER } from "./legal-entity";
import { activationEmail, welcomeEmail, receiptEmail } from "./email";

describe("impressumLine", () => {
  it("dichiara marchio e indirizzo di corrispondenza", () => {
    expect(impressumLine()).toBe("Betredge · 66 Paul Street, London EC2A 4NA");
  });

  it("NON nomina la societa' operativa ne' la sede svizzera", () => {
    const line = impressumLine().toLowerCase();
    for (const vietato of ["maven", "agency ag", "blegistrasse", "baar", "che-", "uid"]) {
      expect(line, vietato).not.toContain(vietato);
    }
  });

  it("non promette una sede legale che non c'e'", () => {
    // 66 Paul Street e' una casella di corrispondenza: il footer non deve
    // presentarla come sede legale o registro.
    const line = impressumLine().toLowerCase();
    for (const vietato of ["registered office", "sede legale", "company no", "reg. no"]) {
      expect(line, vietato).not.toContain(vietato);
    }
  });
});

describe("tutte le email mostrano la stessa identita'", () => {
  const line = impressumLine();

  it("attivazione (transazionale) la include", () => {
    expect(activationEmail("https://www.betredge.com/x").html).toContain(line);
  });

  it("welcome la include", () => {
    expect(welcomeEmail().html).toContain(line);
  });

  it("ricevuta la include", () => {
    const r = receiptEmail(999, "EUR", "base", "2026-09-24", "en");
    expect(r.html).toContain(line);
  });

  it("nessuna email transazionale nomina la societa' operativa", () => {
    for (const html of [
      activationEmail("https://www.betredge.com/x").html,
      welcomeEmail().html,
    ]) {
      expect(html.toLowerCase()).not.toContain("maven");
    }
  });
});

describe("LEGAL_ENTITY", () => {
  it("non espone piu' campi di registro che il footer non deve dichiarare", () => {
    expect(Object.keys(LEGAL_ENTITY).sort()).toEqual(
      ["brand", "contactEmail", "correspondence", "senderName"].sort(),
    );
  });
});

// #SITE-ENTITY-0824 — guardia sulle superfici PUBBLICHE. La societa' operativa non
// deve comparire in nessuna pagina o componente che l'utente legge. Il test guarda
// il SORGENTE: se qualcuno riscrive l'entita' a mano invece di usare LEGAL_ENTITY,
// diventa rosso prima del deploy. E' gia' successo quattro volte — app/terms,
// app/privacy, components/SiteFooter e app/widget avevano ognuno la propria copia.
function leggi(file: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  return readFileSync(`${process.cwd()}/${file}`, "utf8");
}

describe("nessuna superficie pubblica nomina la societa' operativa", () => {
  const SUPERFICI = [
    "components/SiteFooter.tsx",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/widget/page.tsx",
  ];
  const VIETATI = [/maven\s*agency/i, /blegistrasse/i, /CHE&#8209;193/i, /CHE-193/i];

  // #PRIVACY-CONTROLLER-0915 — `/privacy` §1 e' l'UNICA sezione dove la societa'
  // deve comparire (art. 13(1)(a) GDPR: il titolare va nominato). Il divieto resta
  // su tutto il RESTO della pagina, quindi qui si ritaglia via solo quella sezione
  // invece di togliere il file dalla guardia. Se qualcuno rinomina l'intestazione
  // il ritaglio non trova piu' niente e il test fallisce: la protezione non puo'
  // sparire in silenzio.
  const INIZIO_TITOLARE = ">1. Controller</h2>";
  function senzaSezioneTitolare(src: string): string {
    const inizio = src.indexOf(INIZIO_TITOLARE);
    expect(inizio, "app/privacy/page.tsx: sezione '1. Controller' non trovata").toBeGreaterThan(-1);
    const fine = src.indexOf("</section>", inizio);
    expect(fine, "app/privacy/page.tsx: sezione '1. Controller' non chiusa").toBeGreaterThan(-1);
    return src.slice(0, inizio) + src.slice(fine);
  }

  it("nessuna nomina la societa', la sede o il numero di registro", () => {
    for (const file of SUPERFICI) {
      const src = file === "app/privacy/page.tsx" ? senzaSezioneTitolare(leggi(file)) : leggi(file);
      for (const vietato of VIETATI) {
        expect(src, `${file} contiene ${vietato}`).not.toMatch(vietato);
      }
    }
  });

  it("l'eccezione del titolare non si estende alle altre superfici", () => {
    for (const file of SUPERFICI.filter((f) => f !== "app/privacy/page.tsx")) {
      expect(leggi(file), `${file} usa PRIVACY_CONTROLLER`).not.toMatch(/PRIVACY_CONTROLLER/);
    }
  });

  // NB: si pretende un IMPORT vero, non la stringa "legal-entity" da qualche parte.
  // La prima versione di questo test passava perche' trovava il nome del modulo
  // dentro un commento, mentre l'import mancava davvero (lo ha beccato tsc).
  it("tutte importano LEGAL_ENTITY invece di riscrivere l'identita'", () => {
    for (const file of SUPERFICI) {
      expect(leggi(file), file).toMatch(/import\s*\{[^}]*LEGAL_ENTITY[^}]*\}\s*from\s*"@\/lib\/legal-entity"/);
    }
  });
});

// #PRIVACY-CONTROLLER-0915 — la guardia OPPOSTA, e voluta. Sopra si verifica che la
// societa' NON compaia; qui che compaia dove la legge la pretende. Senza questo test
// il ritaglio della sezione §1 sarebbe solo un buco nella protezione: l'entita'
// potrebbe sparire di nuovo da `/privacy` senza che nulla diventi rosso, ed e'
// esattamente quello che e' successo ad agosto (#SITE-ENTITY-0824) prima che Andrea
// decidesse, il 2026-09-15, di rimetterla SOLO li'.
describe("/privacy §1 nomina il titolare del trattamento", () => {
  const src = leggi("app/privacy/page.tsx");
  const sezione = (() => {
    const inizio = src.indexOf(">1. Controller</h2>");
    return src.slice(inizio, src.indexOf("</section>", inizio));
  })();

  it("il dato del titolare e' completo: denominazione, sede e UID", () => {
    expect(PRIVACY_CONTROLLER.name).toBe("Maven Agency AG");
    expect(PRIVACY_CONTROLLER.address).toBe("Blegistrasse 7, 6340 Baar (ZG), Switzerland");
    expect(PRIVACY_CONTROLLER.uid).toBe("CHE-193.960.193");
  });

  it("la sezione lo rende, e da PRIVACY_CONTROLLER invece che a mano", () => {
    expect(sezione).toMatch(/data controller is/);
    for (const campo of ["PRIVACY_CONTROLLER.name", "PRIVACY_CONTROLLER.address", "PRIVACY_CONTROLLER.uid"]) {
      expect(sezione, campo).toContain(`{${campo}}`);
    }
    expect(src).toMatch(/import\s*\{[^}]*PRIVACY_CONTROLLER[^}]*\}\s*from\s*"@\/lib\/legal-entity"/);
  });

  it("il titolare resta fuori dai footer delle email", () => {
    // #EMAIL-SENDER-IDENTITY-0824 (Jo) non e' stato toccato dalla decisione del 15/09.
    for (const html of [
      activationEmail("https://www.betredge.com/x").html,
      welcomeEmail().html,
      receiptEmail(999, "EUR", "base", "2026-09-24", "en").html,
    ]) {
      for (const vietato of [PRIVACY_CONTROLLER.name, PRIVACY_CONTROLLER.uid, "Blegistrasse"]) {
        expect(html, vietato).not.toContain(vietato);
      }
    }
  });
});
