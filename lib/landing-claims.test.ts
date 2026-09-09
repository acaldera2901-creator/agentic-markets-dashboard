import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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

// #AUTH-FOOTER-0909 — i metodi di pagamento dichiarati devono essere quelli veri.
//
// Il footer sotto il bottone Login diceva «BetRedge Pro e' crypto-only», ed era
// falso: il rail principale e' la CARTA (abbonamento Shopify) e il crypto e'
// l'alternativa. Lo dicevano gia' i commenti a app/app/page.tsx:3304 e :4133, e
// le card dei piani mostravano gia' «Carta o crypto» — la copy delle card e'
// stata corretta e auth_footer e' rimasto indietro.
//
// Misurato il 09/09: il claim viveva in 14 occorrenze su 11 LINGUE, in due
// registri paralleli (i blocchi locale inline di page.tsx e lib/i18n/locales/).
// Andrea l'ha trovato su uno screenshot mobile, non un test.
//
// Percio' questa guardia NON elenca i file a mano: legge la cartella. Il difetto
// di classe delle due volte precedenti (#CLV-CLAIM-0831 e il carosello) e' stato
// esattamente quello — una guardia che gira su una lista scritta a mano, e un
// claim che vive nel file che non e' in lista. Una lingua nuova non deve poter
// entrare senza passare da qui.
const CRYPTO_ONLY = [
  /crypto[-\s]only/i,
  /solo\s+cripto/i,
  /solo\s+crypto/i,
  /only\s+crypto/i,
  /crypto\s+uniquement/i,
  /exclusivement\s+en\s+crypto/i,
  /ausschließlich\s+per\s+krypto/i,
  /alleen\s+crypto/i,
  /endast\s+crypto/i,
  /только\s+крипта/i,
  /wyłącznie\s+w\s+kryptowalutach/i,
  /yalnızca\s+kripto/i,
  /exclusivamente\s+em\s+cripto/i,
];

/** Ogni file di lingua, letto dalla cartella e non da una lista a mano. */
function fileDiLingua(): string[] {
  const dir = join(ROOT, "lib/i18n/locales");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts")
    .map((f) => `lib/i18n/locales/${f}`);
}

describe("#AUTH-FOOTER-0909 — i rail di pagamento dichiarati sono quelli veri", () => {
  const superfici = [...fileDiLingua(), "app/app/page.tsx"];

  it("la cartella delle lingue non e' vuota (se lo fosse, il test passerebbe a vuoto)", () => {
    // Senza questa, un rename della cartella renderebbe la guardia muta invece
    // che rossa — che e' il modo in cui un controllo verde smette di misurare.
    expect(fileDiLingua().length).toBeGreaterThanOrEqual(9);
  });

  it.each(superfici)("%s non dichiara il pagamento come solo-crypto", (rel) => {
    const codice = senzaCommenti(readFileSync(join(ROOT, rel), "utf8"));
    for (const re of CRYPTO_ONLY) {
      expect(codice, `claim solo-crypto in ${rel}: ${re}`).not.toMatch(re);
    }
  });

  it.each(fileDiLingua())("%s definisce auth_footer (nessuna lingua senza copy)", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).toContain("auth_footer");
  });

  it("il footer di login e le card dei piani nominano gli stessi rail", () => {
    // L'incoerenza fra due superfici che parlano dello stesso fatto e' il difetto
    // vero: qui la card diceva «Carta o crypto» e il footer «crypto-only».
    const src = readFileSync(join(ROOT, "app/app/page.tsx"), "utf8");
    const footers = [...src.matchAll(/auth_footer:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(footers.length).toBeGreaterThanOrEqual(5);
    // La card dei piani nomina la carta: il footer non puo' ometterla.
    expect(src).toContain('en: "Card or crypto');
    const carta = /carta|card|tarjeta|carte|карт|karte|kart|kaart|kort|cartão|kartą/i;
    for (const f of footers) {
      expect(f, `auth_footer senza il rail carta: "${f}"`).toMatch(carta);
    }
  });
});
