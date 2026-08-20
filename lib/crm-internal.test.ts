// #CRM-EXCLUDE-INTERNAL-0817 — il team non è un cliente da coltivare.
//
// Il test che conta è l'ultimo blocco: la regola vive in due superfici (il motore
// CRM in TypeScript e l'Audience in SQL) e nel 2026 sono già divergute una volta
// per un mese. Qui si verifica che escano dalla stessa lista e che gli indici $n
// restino coerenti quando la lista non è vuota — un off-by-one lì produrrebbe una
// WHERE che confronta il campo sbagliato, in silenzio.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isInternalIdentifier, internalSqlFragment, internalDomains } from "./crm-internal";
import { isEligible } from "./crm";
import { buildSegmentQuery } from "./segments";
import { enterResendOnboarding } from "./resend-contacts";

const ENV = { ...process.env };
beforeEach(() => {
  delete process.env.CRM_INTERNAL_IDENTIFIERS;
  delete process.env.CRM_INTERNAL_DOMAINS;
});
afterEach(() => {
  process.env = { ...ENV };
});

function profile(identifier: string) {
  return {
    identifier,
    plan: "premium",
    language: "en",
    created_at: "2026-07-01T00:00:00Z",
    activated_at: "2026-07-01T00:00:00Z",
    plan_expires_at: "2026-12-01T00:00:00Z",
    marketing_opt_in: true,
    marketing_opt_out: false,
  };
}

describe("chi è interno", () => {
  it("a env vuote resta attivo solo il guard .local", () => {
    // Gli account di prova li generiamo noi come qa-prod-<ts>@betredge-test.local
    // e `.local` non è consegnabile (RFC 6762): è interno per costruzione.
    expect(isInternalIdentifier("qa-prod-1786633664@betredge-test.local")).toBe(true);
    expect(isInternalIdentifier("cliente@gmail.com")).toBe(false);
    expect(isInternalIdentifier("chiunque@mavenagency.io")).toBe(false);
  });

  it("match esatto sull'indirizzo, senza farsi ingannare da maiuscole e spazi", () => {
    process.env.CRM_INTERNAL_IDENTIFIERS = " Tommy@Example.COM , socio@x.io ";
    expect(isInternalIdentifier("tommy@example.com")).toBe(true);
    expect(isInternalIdentifier("  TOMMY@EXAMPLE.COM  ")).toBe(true);
    expect(isInternalIdentifier("socio@x.io")).toBe(true);
    // Non deve prendere per interno un indirizzo che lo contiene soltanto.
    expect(isInternalIdentifier("nottommy@example.com")).toBe(false);
  });

  it("match sul dominio, con o senza @ davanti", () => {
    process.env.CRM_INTERNAL_DOMAINS = "@mavenagency.io, betredge-test.local";
    expect(internalDomains()).toEqual(["mavenagency.io", "betredge-test.local"]);
    expect(isInternalIdentifier("steve@mavenagency.io")).toBe(true);
    expect(isInternalIdentifier("steve@MAVENAGENCY.IO")).toBe(true);
    // Dominio diverso che finisce con la stessa stringa: NON è interno.
    expect(isInternalIdentifier("tizio@notmavenagency.io")).toBe(false);
  });

  it("input vuoto o senza dominio non è interno (lo scarta già isEligible)", () => {
    expect(isInternalIdentifier("")).toBe(false);
    expect(isInternalIdentifier(null)).toBe(false);
    expect(isInternalIdentifier("senza-chiocciola")).toBe(false);
  });
});

describe("il gate agisce sul motore CRM", () => {
  it("un pagante interno NON è idoneo, lo stesso profilo esterno sì", () => {
    process.env.CRM_INTERNAL_DOMAINS = "mavenagency.io";
    expect(isEligible(profile("steve@mavenagency.io"))).toBe(false);
    expect(isEligible(profile("cliente@gmail.com"))).toBe(true);
  });

  it("un account di prova .local non è idoneo nemmeno senza configurazione", () => {
    expect(isEligible(profile("qa-prod-1@betredge-test.local"))).toBe(false);
  });
});

describe("il gate copre anche l'automation Resend", () => {
  // Dal 17/08 (#CRM-RESEND-ENGINE-0817) l'acquisition la manda l'automation su
  // Resend, innescata all'attivazione: `isEligible` non passa da lì. Se il gate
  // stesse solo nel motore CRM, un interno con l'opt-in spuntato entrerebbe nella
  // sequenza e nessun controllo del codice lo fermerebbe.
  //
  // ⚠️ Le env di Resend vanno settate, altrimenti questi test passano per il
  // motivo sbagliato: senza API key `upsertContactForActivation` esce prima di
  // leggere il profilo, quindi «loadContact non chiamato» sarebbe vero anche SENZA
  // il gate. Verificato togliendo il gate: senza queste due righe restavano verdi.
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_AUDIENCE_ID = "aud_test";
  });

  it("un interno non entra nell'automation e non crea il contatto", async () => {
    process.env.CRM_INTERNAL_DOMAINS = "mavenagency.io";
    const loadContact = vi.fn();
    const entered = await enterResendOnboarding("steve@mavenagency.io", loadContact);
    expect(entered).toBe(false);
    // Non deve nemmeno provare a leggere il profilo: nessuna chiamata a Resend.
    expect(loadContact).not.toHaveBeenCalled();
  });

  it("un account di prova .local non entra nell'automation", async () => {
    const loadContact = vi.fn();
    expect(await enterResendOnboarding("qa-prod-1@betredge-test.local", loadContact)).toBe(false);
    expect(loadContact).not.toHaveBeenCalled();
  });

  it("un indirizzo esterno prosegue oltre il gate", async () => {
    // Il gate non deve bloccare i clienti. Con le env presenti e un profilo che
    // non si trova, `upsertContactForActivation` si ferma PRIMA di qualsiasi
    // chiamata HTTP: quello che si osserva è che il profilo viene LETTO, cioè che
    // il gate lo ha lasciato passare.
    const loadContact = vi.fn().mockResolvedValue(null);
    expect(await enterResendOnboarding("cliente@gmail.com", loadContact)).toBe(false);
    expect(loadContact).toHaveBeenCalledWith("cliente@gmail.com");
  });
});

describe("la stessa lista finisce nell'Audience, con gli indici giusti", () => {
  it("il frammento SQL ha una clausola per ogni voce e i params in ordine", () => {
    process.env.CRM_INTERNAL_IDENTIFIERS = "a@x.io,b@y.io";
    process.env.CRM_INTERNAL_DOMAINS = "maven.io";
    const { sql, params } = internalSqlFragment(5);
    expect(params).toEqual(["a@x.io", "b@y.io", "maven.io"]);
    expect(sql).toContain("$5");
    expect(sql).toContain("$6");
    expect(sql).toContain("$7");
    expect(sql).not.toContain("$8");
    // il guard .local non consuma parametri
    expect(sql).toContain("right(lower(identifier), 6) <> '.local'");
    // i valori passano SOLO come params: nessuna email interpolata nell'SQL
    expect(sql).not.toContain("a@x.io");
  });

  it("nessuna voce configurata = solo il guard .local, zero params", () => {
    const { sql, params } = internalSqlFragment(2);
    expect(params).toEqual([]);
    expect(sql).toBe("right(lower(identifier), 6) <> '.local'");
  });

  it("buildSegmentQuery non sfasa i $n delle clausole quando la lista è piena", () => {
    process.env.CRM_INTERNAL_IDENTIFIERS = "a@x.io,b@y.io";
    process.env.CRM_INTERNAL_DOMAINS = "maven.io";
    const { sql, params } = buildSegmentQuery(
      { all: [{ field: "plan", op: "eq", value: "premium" }] },
      { select: "contacts" }
    );
    // $1 admin + $2,$3 indirizzi + $4 dominio + $5 = il valore della clausola:
    // se l'indice slittasse, la WHERE confronterebbe plan con un'email.
    expect(params).toEqual([params[0], "a@x.io", "b@y.io", "maven.io", "premium"]);
    expect(sql).toContain("$5");
    expect(sql).not.toContain("$6");
    expect(sql).toContain("split_part(lower(identifier), '@', 2)");
  });

  it("SQL e TypeScript danno lo stesso verdetto sugli stessi indirizzi", () => {
    process.env.CRM_INTERNAL_IDENTIFIERS = "a@x.io";
    process.env.CRM_INTERNAL_DOMAINS = "maven.io";
    const { params } = internalSqlFragment(1);
    // Ogni valore che l'SQL esclude deve essere interno anche per il predicato.
    for (const p of params) {
      const asAddress = String(p).includes("@") ? String(p) : `chiunque@${p}`;
      expect(isInternalIdentifier(asAddress), asAddress).toBe(true);
    }
  });
});
