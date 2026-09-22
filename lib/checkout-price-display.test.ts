import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #CRYPTO-PRICE-0910 — il prezzo MOSTRATO deve essere quello ADDEBITATO.
//
// Il difetto: il rail crypto mostrava `price` (il mensile) mentre il server
// addebitava `discountedAmountFor(plan, period)` — cioe' l'ANNUALE quando
// l'utente aveva scelto Annuale, e concedeva 365 giorni
// (lib/plan-grant.ts: `days = period === "annual" ? 365 : 30`).
// Con l'Annuale selezionato: mostrato ~$15, addebitato ~$165.
// L'addebito era SUPERIORE a quello esposto nel momento della decisione.
//
// QA ne aveva visti 2; erano 5. Per questo la guardia non elenca i punti: nega
// il pattern su tutto il file, cosi' un sesto punto non puo' nascere.
const SRC = readFileSync(join(__dirname, "..", "app/app/page.tsx"), "utf8");

/** Il sorgente senza commenti: le note come QUESTA nominano il difetto, e non
 *  devono far scattare la guardia che lo cerca. */
function senzaCommenti(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((r) => {
      const i = r.indexOf("//");
      return i === -1 ? r : r.slice(0, i);
    })
    .join("\n");
}

describe("#CRYPTO-PRICE-0910 — prezzo mostrato = prezzo addebitato", () => {
  const codice = senzaCommenti(SRC);

  it("nessun importo mostrato usa `price` grezzo invece di `displayPrice`", () => {
    // `displayPrice.toFixed` non matcha: la P e' maiuscola.
    const grezzi = [...codice.matchAll(/(?<![A-Za-z])price\.toFixed\(/g)];
    expect(grezzi.length, `${grezzi.length} importi mostrano il prezzo del solo mensile`).toBe(0);
  });

  it("la durata del rail crypto non e' un numero fisso", () => {
    // "30 giorni" hardcodato era vero solo col mensile.
    expect(codice).not.toMatch(/pagamento singolo da 30 giorni/);
    expect(codice).not.toMatch(/one-time payment for 30 days/);
  });

  it("la durata segue il periodo, e usa i giorni che il server concede", () => {
    expect(codice).toContain('const cryptoDays = period === "annual" ? 365 : 30');
    expect(codice).toMatch(/\$\{cryptoDays\} giorni/);
    expect(codice).toMatch(/\$\{cryptoDays\} days/);
  });

  it("displayPrice resta definito dal periodo (se salta, i 5 punti tornano falsi)", () => {
    expect(codice).toContain("const displayPrice = period ===");
  });
});
