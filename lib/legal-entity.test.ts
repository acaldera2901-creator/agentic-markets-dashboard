// #EMAIL-SENDER-IDENTITY-0824 — la riga di identità del mittente e' l'unica cosa
// che tiene insieme i footer di TUTTE le email. Questi test esistono perche' e' gia'
// divergita una volta (PR #221: env con un'identita', sito con un'altra) e perche'
// il requisito e' esplicito: la societa' operativa non deve comparire nelle email.
import { describe, it, expect } from "vitest";
import { impressumLine, LEGAL_ENTITY } from "./legal-entity";
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
      ["brand", "correspondence", "senderName"].sort(),
    );
  });
});
