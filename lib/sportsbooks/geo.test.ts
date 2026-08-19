import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

// #GEO-OPEN-0819 — la policy geo è cambiata: APERTA in tutto il mondo, decisione di
// Jo del 19/08 con parere legale scritto. Questo file era il presidio del regime
// precedente (#GOLIVE-HIGH-D): asseriva che IT/DE/FR/NL/ES/BE fossero bloccate a
// prescindere dall'allowlist env, perché in quelle giurisdizioni promuovere operatori
// non licenziati è un illecito autonomo. Non lo cancello e non lo svuoto: lo riscrivo
// per il regime nuovo, così il cambio di policy resta leggibile qui e non solo in un
// commento. Quello che difende adesso è il MECCANISMO: default aperto, e l'env
// `GEO_BLOCKED_COUNTRIES` come leva per ri-chiudere una giurisdizione senza release.
//
// Nota tecnica: la costante è calcolata all'IMPORT del modulo, quindi ogni caso che
// cambia l'env deve resettare i moduli e re-importare. Cambiare `process.env` dopo
// l'import non ha alcun effetto, e un test scritto così passerebbe per il motivo
// sbagliato.
const ENV = { ...process.env };

async function load(blocked?: string, allowlist?: string) {
  if (blocked === undefined) delete process.env.GEO_BLOCKED_COUNTRIES;
  else process.env.GEO_BLOCKED_COUNTRIES = blocked;
  if (allowlist === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
  else process.env.SPORTSBOOK_GEO_ALLOWLIST = allowlist;
  vi.resetModules();
  return await import("./index");
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { process.env = { ...ENV }; });

describe("geo aperta per default (#GEO-OPEN-0819)", () => {
  it("senza env nessuna giurisdizione è bloccata", async () => {
    const { GEO_BLOCKED_COUNTRIES } = await load(undefined, "*");
    expect([...GEO_BLOCKED_COUNTRIES]).toEqual([]);
  });

  it("le sei geo del regime precedente ora passano con allowlist globale", async () => {
    // È il cuore del cambio: prima erano hard-bloccate anche con "*".
    const { geoAllowed } = await load(undefined, "*");
    for (const cc of ["IT", "DE", "FR", "NL", "ES", "BE"]) {
      expect(geoAllowed(cc), cc).toBe(true);
    }
    expect(geoAllowed("CH")).toBe(true);
    expect(geoAllowed("GB")).toBe(true);
  });

  it("l'allowlist continua a governare: vuota = nessuno, elenco = solo quelli", async () => {
    // La geo aperta NON significa link a chiunque: il master `linksEnabled` e
    // l'allowlist restano i due interruttori di prima, e questo non è cambiato.
    const { geoAllowed } = await load(undefined, "");
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("GB")).toBe(false);
    const g2 = await load(undefined, "GB,CH");
    expect(g2.geoAllowed("GB")).toBe(true);
    expect(g2.geoAllowed("IT")).toBe(false);
  });
});

describe("la leva per ri-chiudere una giurisdizione funziona", () => {
  it("una geo elencata nell'env resta bloccata anche con allowlist globale", async () => {
    // È la strada da usare se arriva una diffida o cambia il parere legale:
    // configurazione, non release.
    const { geoAllowed, GEO_BLOCKED_COUNTRIES } = await load("IT,DE", "*");
    expect([...GEO_BLOCKED_COUNTRIES].sort()).toEqual(["DE", "IT"]);
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("DE")).toBe(false);
    expect(geoAllowed("FR")).toBe(true);   // non elencata → aperta
  });

  it("l'env tollera spazi e minuscole, come gli header reali", async () => {
    const { geoAllowed } = await load(" it , De ", "*");
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("it")).toBe(false);
    expect(geoAllowed(" IT ")).toBe(false);
    expect(geoAllowed("DE")).toBe(false);
  });

  it("una geo bloccata resta bloccata anche se elencata nell'allowlist", async () => {
    // L'ordine dei due controlli conta: il blocco vince sull'allowlist, come prima.
    const { geoAllowed } = await load("IT", "IT,GB");
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("GB")).toBe(true);
  });

  it("env vuota o solo virgole = aperto, non un blocco fantasma", async () => {
    const { GEO_BLOCKED_COUNTRIES } = await load(" , ,", "*");
    expect([...GEO_BLOCKED_COUNTRIES]).toEqual([]);
  });
});
