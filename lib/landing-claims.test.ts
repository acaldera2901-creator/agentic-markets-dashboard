import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #CLV-CLAIM-0831 — un claim di verifica sulla landing pubblica deve avere
// dietro il dato che lo verifica.
//
// Il chip «CLV verified» / «CLV verificato» stava fra due claim veri (sigillata
// prima del fischio, calibrata) e non era vero. Misurato su produzione il
// 31/08:
//
//   unified_predictions   0 righe su 3.730 con closing_odds o closing_line_value
//   pick_settlement       1 riga su 1.127 con closing_odds
//
// E non e' un ritardo di popolamento che si risolve da se': nelle ultime 30
// giornate le righe `is_closing` di `odds_snapshots` sono 1.410, ma 1.169
// vengono da stake/roobet — la via che per regola di sistema alimenta solo la
// misura e mai il prodotto — e le 241 di `odds_api` coprono OTTO partite
// (CSL 5, ALL 2, PL 1), nessuna delle quali compare in `pick_ledger`. La
// sovrapposizione fra «partite con una chiusura» e «partite su cui abbiamo dato
// un pick» e' zero.
//
// QUANDO SI PUO' RIMETTERE. Quando esiste una quota di chiusura agganciabile ai
// nostri pick e `pick_settlement.closing_odds` e' popolata per una quota
// dichiarabile dei pick chiusi. Non prima: un claim che il nostro stesso
// database smentisce e' il tipo di cosa che, su un prodotto di scommesse, non
// costa una figura ma la fiducia.

const ROOT = join(__dirname, "..");

/** Il sorgente senza commenti: le note come QUESTA parlano del claim, e non
 *  devono far scattare la guardia che cerca il claim. Lo spogliamento e'
 *  grezzo (puo' troncare un "https://" dentro una stringa) e va benissimo:
 *  serve solo a cercare la parola CLV, non a ricompilare il file. */
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

// Il claim non era in UN posto: alla misura era su un chip di fiducia, su un
// badge renderizzato due volte, su una descrizione e su un KPI in CINQUE lingue,
// piu' una promessa DIETRO IL LUCCHETTO nel registro dei pick. Per questo la
// guardia gira su tutte le superfici che lo portavano, non solo su quella da cui
// e' partita la misura.
const SUPERFICI = ["app/landing-client.tsx", "components/track-record/PickLedger.tsx"];

describe("superfici pubbliche: nessun claim che il database smentisce", () => {
  it.each(SUPERFICI)("%s non promette un CLV verificato", (rel) => {
    const codice = senzaCommenti(readFileSync(join(ROOT, rel), "utf8"));
    expect(codice).not.toContain("CLV");
  });

  it("non resta il campo del chip rimosso", () => {
    const codice = senzaCommenti(readFileSync(join(ROOT, "app/landing-client.tsx"), "utf8"));
    expect(codice).not.toContain("chipClv");
  });

  it("il badge della prova resta, senza la meta' falsa", () => {
    // Il badge e' renderizzato: togliere il claim non deve svuotarlo, perche'
    // l'altra meta' — sigillata prima del fischio — e' vera e misurabile.
    const src = readFileSync(join(ROOT, "app/landing-client.tsx"), "utf8");
    expect(src).toContain('prBadge: "LOGGED PRE-KICK-OFF"');
    expect(src).toContain('prBadge: "REGISTRATA PRIMA DEL FISCHIO"');
  });

  it("i due chip rimasti sono ancora li' — la rimozione non ha svuotato la fila", () => {
    // Togliere il claim falso non deve togliere anche i veri: sigillata prima
    // del fischio (pick_ledger, 1.453 righe) e calibrata (lib/calibration.ts).
    const src = readFileSync(join(ROOT, "app/landing-client.tsx"), "utf8");
    expect(src).toContain("chipLogged");
    expect(src).toContain("chipCal");
    const chips = [...src.matchAll(/className="trust-chip"/g)];
    expect(chips.length).toBe(2);
  });

  it("le due lingue restano allineate: nessun campo definito in una sola", () => {
    // Un campo presente in EN e assente in IT non e' un errore di tipo se il
    // tipo cambia: e' un buco di copy che si vede solo in produzione.
    const src = readFileSync(join(ROOT, "app/landing-client.tsx"), "utf8");
    const blocco = (nome: string) => {
      const i = src.indexOf(`const ${nome}: V3Copy = {`);
      expect(i).toBeGreaterThan(-1);
      return src.slice(i, src.indexOf("\n};", i));
    };
    const campi = (b: string) =>
      new Set([...b.matchAll(/(?:^|[{,\s])([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map((m) => m[1]));
    const en = campi(blocco("V3_EN"));
    const it = campi(blocco("V3_IT"));
    for (const c of ["chipLogged", "chipCal"]) {
      expect(en.has(c)).toBe(true);
      expect(it.has(c)).toBe(true);
    }
    expect(en.has("chipClv")).toBe(false);
    expect(it.has("chipClv")).toBe(false);
  });
});
