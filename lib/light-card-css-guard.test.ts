// lib/light-card-css-guard.test.ts — #UI-LIGHT-BAND-0830 (sostituisce #UI-LIGHT-CARD-0830)
//
// In tema chiaro la scheda prediction ha una FASCIA FOTOGRAFICA in testa: foto
// sotto UNA velatura SCURA, testo chiaro sopra; sotto la fascia si torna alla
// carta e i numeri stanno li'.
//
// Perche' un guard e non solo la CSS: `app/machina.css` e' GENERATO da
// docs/ui-machina/src/port-to-scoped.py, e i difetti che questo file protegge
// sono TUTTI silenziosi — non c'e' errore, non c'e' test rosso, cambia solo
// quello che si vede. Sono i quattro gia' pagati una volta:
//
//  1. DUE velature sovrapposte (.card-veil + un fondo su .top/.fx) lasciavano
//     la foto visibile in una fascia sottile e ACCIDENTALE, sotto lega e
//     orario. Una velatura sola, o si ricrea la macchia.
//  2. la velatura chiara: `scene-stadium.jpg` e' notturna, sotto il bianco fa
//     solo foschia grigia — da cui il `saturate(2)` che sulla terra rossa dava
//     lo sbaffo rosa. La velatura DEVE essere scura.
//  3. i token --d-* vivevano solo in `:root:not([data-theme="light"])`: in
//     chiaro `var(--d-tennis)` non risolveva e OGNI scheda portava il filetto
//     viola del calcio (misurato in produzione: rgb(109,40,217) su una tennis).
//  4. il filetto su `.top::before`: `.pred` ha `padding:16px`, quindi nasceva
//     16px dentro il bordo e 32px piu' corto. Va sul contenitore.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(REPO_ROOT, "app/machina.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const LIGHT = ':root[data-theme="light"]';
/** Solo le regole del tema chiaro: quelle scure portano `:not([data-theme="light"])`. */
const chiare = css
  .split("}")
  .map((b) => b.trim())
  .filter((b) => b.includes(LIGHT) && !b.includes(':not([data-theme="light"])'));
/** Le regole che STILANO un selettore (non quelle che lo nominano dentro un :not). */
const cheStilano = (sel: string) =>
  chiare.filter((b) => b.split("{")[0].split(",").some((s) => s.trim().endsWith(sel)));

describe("tema chiaro · la fascia fotografica", () => {
  it("la velatura e' UNA sola, ed e' SCURA", () => {
    const veli = cheStilano(".card-veil");
    expect(veli.length, `velature in chiaro: ${veli.length} (devono essere 1)`).toBe(1);
    const v = veli[0];
    expect(v, "la velatura non ha un gradiente").toContain("linear-gradient");
    expect(
      /rgba\(\s*255\s*,\s*255\s*,\s*255/.test(v),
      "velatura BIANCA: la scena notturna sotto il bianco fa foschia grigia",
    ).toBe(false);
  });

  it("nessuna SECONDA velatura su .top o .fx (era la causa della macchia)", () => {
    for (const sel of [".pred .top", ".pred .fx"]) {
      const conFondo = cheStilano(sel).filter((b) => /background\s*:/.test(b.split("{")[1] ?? ""));
      expect(
        conFondo,
        `${sel} riporta un fondo: sovrapposto a .card-veil ricrea la fascia accidentale\n${conFondo.join("\n")}`,
      ).toEqual([]);
    }
  });

  it("foto e velatura sono ritagliate alla fascia, con lo STESSO bottom", () => {
    const bottom = (sel: string) => cheStilano(sel)[0]?.replace(/\s/g, "").match(/bottom:(\d+)px/)?.[1];
    const bg = bottom(".card-bg"), veil = bottom(".card-veil");
    // 140px = distanza dal bordo alto del readout al fondo scheda, misurata su
    // tutte e 126 le schede della board (valore unico). Se cambia il layout del
    // readout, questo numero va ri-misurato — non indovinato.
    expect(bg, ".card-bg non e' ritagliata: la foto torna dietro tutta la scheda").toBe("140");
    expect(veil, "la velatura non finisce dove finisce la foto").toBe(bg);
  });

  it("la foto non e' sovra-saturata (era lo sbaffo rosa sulla terra rossa)", () => {
    const f = cheStilano(".card-bg")[0].replace(/\s/g, "");
    const sat = f.match(/saturate\(([\d.]+)\)/)?.[1];
    expect(sat, "manca il filtro sulla foto").toBeTruthy();
    expect(Number(sat), `saturate(${sat}) — sopra 1.5 la terra rossa diventa rosa`).toBeLessThan(1.5);
  });
});

describe("tema chiaro · il testo sulla fascia", () => {
  // Sopra i fari dello stadio il fondo peggiore e' un pixel BIANCO della foto
  // sotto la velatura piu' sottile (.64): rgb(96,96,96). Ogni testo della
  // fascia deve stare chiaro, o sparisce proprio dove la foto e' piu' bella.
  const NELLA_FASCIA = [".league", ".rnd", ".when", ".teams", ".vs", ".stt", ".sc"];
  const SULLA_CARTA = [".v2r-eye", ".v2r-qlab", ".v2r-conf-t", ".v2r-sub"];

  it.each(NELLA_FASCIA)("%s e' CHIARO (sta sulla foto)", (sel) => {
    const r = cheStilano(sel);
    expect(r.length, `${sel} non ha un colore dichiarato in chiaro`).toBeGreaterThan(0);
    const col = r[0].replace(/\s/g, "").match(/color:(#[0-9a-f]{3,6})/i)?.[1];
    expect(col, `${sel} senza color`).toBeTruthy();
    // media dei canali: chiaro = sopra 170/255
    const h = col!.length === 4 ? col!.slice(1).split("").map((c) => parseInt(c + c, 16)) : [1, 3, 5].map((i) => parseInt(col!.substr(i, 2), 16));
    const media = h.reduce((a, b) => a + b, 0) / 3;
    expect(media, `${sel} = ${col} — scuro sopra la fascia scura`).toBeGreaterThan(170);
  });

  it.each(SULLA_CARTA)("%s resta SCURO (sta sulla carta)", (sel) => {
    const r = chiare.filter((b) => b.split("{")[0].includes(sel));
    expect(r.length, `${sel} non ha un colore dichiarato in chiaro`).toBeGreaterThan(0);
    const col = r[0].replace(/\s/g, "").match(/color:(#[0-9a-f]{6})/i)?.[1];
    const h = [1, 3, 5].map((i) => parseInt(col!.substr(i, 2), 16));
    expect(h.reduce((a, b) => a + b, 0) / 3, `${sel} = ${col} — chiaro sulla carta bianca`).toBeLessThan(120);
  });

  it(".rnd sta con la FASCIA, non con la carta", () => {
    // Oggi `.rnd` (turno del torneo) e' vuoto su tutta la board: se finisse coi
    // grigi scuri, il difetto comparirebbe solo il giorno che arriva il dato.
    const conRnd = chiare.filter((b) => b.split("{")[0].includes(".rnd"));
    expect(conRnd.length).toBeGreaterThan(0);
    for (const b of conRnd) expect(b, ".rnd raggruppato coi grigi della carta").not.toContain("#3a4149");
  });
});

describe("tema chiaro · il filetto dello sport", () => {
  it("sta sul CONTENITORE, non su .top (che ha 16px di padding sopra)", () => {
    const suCard = chiare.filter((b) => b.split("{")[0].includes("[data-mc].card::before"));
    expect(suCard.length, "il filetto non e' sul contenitore: nasce dentro il bordo").toBe(1);
    expect(suCard[0].replace(/\s/g, "")).toContain("height:4px");
    expect(suCard[0]).toContain("var(--mc-accent");
    // e il contenitore deve essere posizionato, se no l'absolute scappa
    expect(
      chiare.some((b) => b.split("{")[0].split(",").some((s) => s.trim().endsWith("[data-mc].card")) && /position\s*:\s*relative/.test(b)),
      "[data-mc].card senza position:relative — il filetto se ne va",
    ).toBe(true);
  });

  it("il vecchio filetto su .top::before e' spento", () => {
    const t = chiare.filter((b) => b.split("{")[0].includes(".top::before"));
    expect(t.length, "regola su .top::before assente: potrebbe tornare doppio").toBe(1);
    expect(t[0].replace(/\s/g, ""), "il vecchio filetto disegna ancora").toContain("content:none");
  });

  it("i token --d-* esistono in chiaro e valgono come nel tema scuro", () => {
    const chiaro = chiare.find((b) => b.includes("--d-football"));
    expect(chiaro, "--d-* non esiste in chiaro: --mc-accent cade sul viola del calcio").toBeTruthy();
    const scuro = css.split("}").map((b) => b.trim())
      .find((b) => b.includes(':not([data-theme="light"])') && b.includes("--d-football"));
    for (const t of ["--d-football", "--d-tennis", "--d-wc"]) {
      const val = (s: string) => s.replace(/\s/g, "").match(new RegExp(`${t}:(#[0-9a-f]{3,8})`))?.[1];
      expect(val(chiaro!), `manca ${t} in chiaro`).toBeTruthy();
      expect(val(chiaro!), `${t} diverge tra i due temi`).toBe(val(scuro!));
    }
    expect(chiaro!.replace(/\s/g, ""), "il tennis e' arancio, non viola").toContain("--d-tennis:#c2410c");
  });
});
