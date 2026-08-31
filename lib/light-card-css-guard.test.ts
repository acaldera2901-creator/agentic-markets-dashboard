// lib/light-card-css-guard.test.ts — #UI-LIGHT-MIRROR-0830
//
// Regola di Andrea (30/08): «le schede devono essere uguali ma con i temi
// diversi». Questo guard la rende un test: per un elenco di proprietà
// STRUTTURALI, la regola del tema chiaro deve dire la STESSA cosa di quella
// del tema scuro. I colori sono liberi — è il resto che non deve divergere.
//
// Perché serve: `app/machina.css` è GENERATO da
// docs/ui-machina/src/port-to-scoped.py, e la divergenza che ha prodotto i due
// difetti segnalati era invisibile a occhio. Misurata con getComputedStyle sui
// due temi, in chiaro `.pred` aveva `padding:16px 16px 14px` invece di 0,
// `display:block` invece di flex/column, NESSUN bordo (un anello in box-shadow
// al suo posto) e `transition:box-shadow,filter,transform` invece di
// `transform,border-color`. Da lì:
//   · il bordo non si accendeva all'hover — non c'era un bordo da accendere;
//   · il filetto da 4px (che anche in scuro sta su `.top::before`) nasceva
//     16px dentro il bordo, perché `.top` viveva dentro il padding di `.pred`.
//
// Gli altri difetti già pagati e ancora sorvegliati: due velature sovrapposte
// che lasciavano la foto in una fascia accidentale; la velatura BIANCA su una
// scena notturna (da cui `saturate(2)` e lo sbaffo rosa sulla terra rossa); i
// token --d-* assenti in chiaro (tennis col filetto viola del calcio); `.rnd`
// raggruppato coi grigi della carta pur stando dentro la fascia.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(REPO_ROOT, "app/machina.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const LIGHT = ':root[data-theme="light"]';
const DARK = ':root:not([data-theme="light"])';

type Rule = { sel: string; decls: string };
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sel: m[1].trim(), decls: m[2].trim() }))
  .filter((r) => r.sel && !r.sel.startsWith("@"));

/** Tutte le dichiarazioni che il tema `theme` applica a `sel`, in ordine di cascata. */
function declsFor(theme: string, sel: string): string {
  return rules
    .filter((r) => {
      const parts = r.sel.split(",").map((s) => s.trim());
      return parts.some((p) => p.startsWith(theme) && p.endsWith(sel));
    })
    .map((r) => r.decls)
    .join(";");
}
/** Ultimo valore dichiarato per `prop` (la cascata: vince l'ultimo). */
function prop(decls: string, name: string): string | null {
  const hits = [...decls.matchAll(new RegExp(`(?:^|;)\\s*${name}\\s*:([^;]+)`, "g"))];
  return hits.length ? hits[hits.length - 1][1].trim().replace(/\s+/g, " ") : null;
}

describe("la scheda chiara ripete la struttura di quella scura", () => {
  // Proprietà strutturali: quelle che decidono la GEOMETRIA e il comportamento.
  // I colori restano fuori — è il punto: stessa scheda, temi diversi.
  const STRUTTURA: Record<string, string[]> = {
    ".pred": ["padding", "border-radius", "box-shadow", "display", "flex-direction", "overflow", "isolation", "position"],
    ".pred .top": ["display", "align-items", "justify-content", "gap", "padding"],
    ".pred .fx": ["display", "gap", "padding"],
    ".pred .scorebar": ["display", "align-items", "gap", "padding", "border-radius"],
    ".pred .v2r": ["margin-top", "display", "align-items", "justify-content", "gap", "padding", "border-radius"],
    ".pred .pred-more": ["padding", "border-radius"],
  };

  for (const [sel, props] of Object.entries(STRUTTURA)) {
    // il tema scuro scrive `.top`/`.fx`/... anche senza il prefisso `.pred `
    const alt = sel.replace(/^\.pred /, "");
    it(`${sel} — stesse proprietà strutturali nei due temi`, () => {
      const l = declsFor(LIGHT, sel) + ";" + declsFor(LIGHT, alt);
      const d = declsFor(DARK, sel) + ";" + declsFor(DARK, alt);
      expect(l.trim().replace(/^;|;$/g, ""), `il tema chiaro non dichiara nulla per ${sel}`).not.toBe("");
      for (const p of props) {
        const dv = prop(d, p);
        if (dv == null) continue; // il tema scuro non la fissa: niente da rispettare
        expect(prop(l, p), `${sel} · ${p}: scuro "${dv}", chiaro "${prop(l, p)}"`).toBe(dv);
      }
    });
  }

  it(".pred ha un BORDO vero anche in chiaro (senza, l'hover non ha cosa accendere)", () => {
    const l = declsFor(LIGHT, ".pred");
    const b = prop(l, "border");
    expect(b, ".pred in chiaro non dichiara `border`").toBeTruthy();
    expect(b!.replace(/\s/g, ""), `border = "${b}" — serve 1px solid`).toMatch(/^1pxsolid/);
    expect(prop(l, "box-shadow"), "l'anello in box-shadow convive col bordo: doppio contorno").toBe("none");
  });

  it("la transizione è quella del tema scuro (transform + border-color)", () => {
    const l = prop(declsFor(LIGHT, ".pred"), "transition");
    const d = prop(declsFor(DARK, ".pred"), "transition");
    expect(l, `transizione: scuro "${d}", chiaro "${l}"`).toBe(d);
  });

  it("l'hover alza la scheda e accende il bordo col colore dello sport, come in scuro", () => {
    const l = declsFor(LIGHT, ".pred:hover"), d = declsFor(DARK, ".pred:hover");
    expect(l, "in chiaro non esiste :hover sulla scheda").not.toBe("");
    expect(prop(l, "transform"), `transform: scuro "${prop(d, "transform")}"`).toBe(prop(d, "transform"));
    const bc = prop(l, "border-color");
    expect(bc, "l'hover non tocca border-color: il bordo non si illumina").toBeTruthy();
    expect(bc!, "il bordo acceso non usa il colore dello sport").toContain("--mc-accent");
    expect(bc!.replace(/\s/g, ""), "la miscela non è quella del tema scuro (65%)").toContain("65%");
  });
});

describe("il filetto da 4px", () => {
  // #ACCENT-BAR-0831 — i 4px ora sono 1px di BORDO ALTO col colore dello sport
  // piu' 3px di striscia su `.top::before`. Il cambio non e' cosmetico: `.top`
  // vive dentro il bordo di `.pred`, e `overflow:hidden` ritaglia al padding box
  // — quindi nessun figlio potra' mai coprire quel bordo, e con la striscia da
  // 4px tutta dentro il filetto risultava rientrato di 1px su tre lati, come una
  // striscia colorata dentro una cornice grigia. Il guard passa dal misurare la
  // striscia al misurare il TOTALE, che e' l'invariante che conta.
  it("il colore dello sport arriva a filo e somma 4px, nei DUE temi", () => {
    for (const [nome, t] of [["chiaro", LIGHT], ["scuro", DARK]] as const) {
      const d = declsFor(t, ".pred .top::before") + ";" + declsFor(t, ".top::before");
      const striscia = prop(d, "height");
      expect(striscia, `${nome}: la striscia non dichiara un'altezza`).toBeTruthy();
      const bordoAlto = prop(declsFor(t, ".pred"), "border-top-color");
      expect(bordoAlto, `${nome}: il bordo alto non porta il colore dello sport, quindi il filetto resta rientrato di 1px`).toContain("--mc-accent");
      // 1px di bordo + la striscia = i 4px di sempre
      expect(1 + parseFloat(striscia!), `${nome}: bordo + striscia non fanno 4px`).toBe(4);
      expect(prop(d, "background"), `${nome}: la striscia non usa il colore dello sport`).toContain("--mc-accent");
    }
  });

  it("l'hover non smorza il bordo ALTO: li' il colore resta pieno", () => {
    // l'hover schiarisce i bordi al 65%; sul bordo alto quello spegnerebbe il
    // filetto proprio mentre l'utente ci passa sopra.
    for (const [nome, t] of [["chiaro", LIGHT], ["scuro", DARK]] as const) {
      const h = declsFor(t, ".pred:hover");
      expect(prop(h, "border-top-color"), `${nome}: l'hover non ridichiara il bordo alto`).toContain("--mc-accent");
      expect(prop(h, "border-top-color"), `${nome}: l'hover smorza anche il bordo alto`).not.toContain("color-mix");
    }
  });

  // #CARD-OUTLINE-0831 — «il contorno non chiude la scheda»: nello SPLIT `.top`
  // sta nella prima colonna della griglia, quindi la striscia copriva il 54%
  // della larghezza (misurato 284 su 525) e il contorno alto cambiava spessore a
  // metà scheda. Due meta' del difetto, due invarianti da sorvegliare.
  it("la striscia sfonda oltre `.top`, per arrivare al bordo destro anche nello split", () => {
    for (const [nome, t] of [["chiaro", LIGHT], ["scuro", DARK]] as const) {
      const d = declsFor(t, ".pred .top::before") + ";" + declsFor(t, ".top::before");
      const r = prop(d, "right");
      expect(r, `${nome}: la striscia non dichiara \`right\``).toBeTruthy();
      expect(r!.startsWith("-"), `${nome}: \`right:${r}\` ferma la striscia al bordo di .top, che nello split e' mezza scheda`).toBe(true);
    }
  });

  it("`.top` sta sopra `.v2r`, o in chiaro il readout opaco copre la striscia", () => {
    // `.top` e' essa stessa un contesto di impilamento (z-index 2 da `.pred > *`),
    // quindi lo z-index della striscia vale solo DENTRO `.top`: fuori competono
    // `.top` e `.v2r`, a pari livello vince chi viene dopo nel DOM. In scuro non
    // si vedeva (fondo translucido), in chiaro il readout e' OPACO e copriva.
    for (const [nome, t] of [["chiaro", LIGHT], ["scuro", DARK]] as const) {
      const z = prop(declsFor(t, ".pred .top"), "z-index");
      expect(z, `${nome}: .top non dichiara uno z-index`).toBeTruthy();
      expect(Number(z), `${nome}: .top a z-index ${z} non batte il readout (2)`).toBeGreaterThan(2);
    }
  });

  it("la smussatura IN ALTO continua il bordo alto, quella in basso resta neutra", () => {
    // Se la smussatura alta e' grigia spezza il filetto in due: un triangolino di
    // colore staccato dalla barra, con un cuneo grigio in mezzo. Misurato il 31/08.
    const globals = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const reg = /\.card > \.pred::before\s*\{([^}]*)\}/g;
    const corpi = [...globals.matchAll(reg)].map((m) => m[1]);
    expect(corpi.length, "nessuna regola per la smussatura alta in globals").toBeGreaterThan(0);
    expect(corpi.join(";"), "la smussatura alta non prende il colore dello sport").toContain("--mc-accent");
  });

  it("in chiaro .pred ha padding:0, o il filetto nasce dentro il bordo", () => {
    // È la causa esatta del difetto segnalato: .top vive nel padding di .pred,
    // quindi con padding 16px il filetto partiva 16px dentro e restava 32px corto.
    expect(prop(declsFor(LIGHT, ".pred"), "padding")).toBe("0");
  });

  it("le smussature degli angoli (.pred::before/::after) non sono state rubate in chiaro", () => {
    const rubate = rules.filter((r) =>
      r.sel.split(",").some((p) => p.trim().startsWith(LIGHT) && /\.pred::(before|after)$/.test(p.trim())),
    );
    expect(rubate.map((r) => r.sel), "in chiaro globals disegna lì le smussature: sovrascriverle lascia un trattino diagonale").toEqual([]);
  });
});

describe("la fascia fotografica in chiaro", () => {
  const chiare = rules.filter((r) => r.sel.split(",").some((p) => p.trim().startsWith(LIGHT)));
  const stilano = (sel: string) => chiare.filter((r) => r.sel.split(",").some((p) => p.trim().endsWith(sel)));

  // #CARD-HUD-0830 — la scheda ha ora DUE varianti: quella impilata (sempre) e
  // lo split, che si accende via container query quando la scheda e' larga.
  // Ognuna porta la sua velatura, ma una scheda ne vede sempre e solo UNA: la
  // seconda regola SOVRASCRIVE la prima sullo stesso elemento, non ne aggiunge
  // un'altra sopra — che era il difetto originale. Il guard passa quindi da
  // «una sola regola» a «una per variante, e nessuna delle due bianca»: la
  // lezione sorvegliata (niente bianco su scena notturna) resta intatta.
  const variante = (r: Rule) => (/\.pred\.hud/.test(r.sel) ? "split" : "base");

  it("ogni variante ha UNA velatura, e nessuna è BIANCA", () => {
    const v = stilano(".card-veil");
    const base = v.filter((r) => variante(r) === "base");
    const split = v.filter((r) => variante(r) === "split");
    expect(base.length, `velature base in chiaro: ${base.length} (deve essere 1)`).toBe(1);
    expect(split.length, `velature split in chiaro: ${split.length} (max 1)`).toBeLessThanOrEqual(1);
    for (const r of v) {
      expect(r.decls, `velatura senza gradiente: ${r.sel}`).toContain("linear-gradient");
      expect(/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(r.decls), `velatura BIANCA su scena notturna (${r.sel}): fa foschia grigia`).toBe(false);
    }
  });

  it("nessuna SECONDA velatura su .top o .fx (era la causa della macchia)", () => {
    for (const sel of [".pred .top", ".pred .fx"]) {
      const g = stilano(sel).filter((r) => /background\s*:\s*linear-gradient/.test(r.decls));
      expect(g.map((r) => r.sel), `${sel} porta un gradiente: sovrapposto a .card-veil ricrea la fascia accidentale`).toEqual([]);
    }
  });

  it("foto e velatura finiscono nello stesso punto, in ENTRAMBE le varianti", () => {
    // Variante impilata: 154px = distanza da `.v2r` al fondo scheda, misurata su
    // tutte e 126 le schede con questa struttura. Se il layout del readout
    // cambia, va RI-MISURATA, non indovinata.
    const primo = (sel: string, v: "base" | "split") =>
      stilano(sel).find((r) => variante(r) === v)?.decls ?? "";
    expect(prop(primo(".card-bg", "base"), "bottom"), "la foto non è ritagliata alla fascia").toBe("154px");
    expect(prop(primo(".card-veil", "base"), "bottom"), "la velatura non finisce dove finisce la foto").toBe("154px");

    // Variante split: niente costante da ri-misurare — foto e velatura arrivano
    // al fondo scheda e sono coperte sotto il readout da `.v2r`/`.why` opachi.
    // Devono pero' finire nello STESSO punto anche in orizzontale, altrimenti
    // sotto il pannello dei dati resta una scheggia della fotografia.
    const bg = primo(".card-bg", "split");
    if (bg) {
      const veil = primo(".card-veil", "split");
      for (const lato of ["top", "bottom", "left", "right"]) {
        expect(prop(veil, lato), `nello split la velatura diverge dalla foto su ${lato}`).toBe(prop(bg, lato));
      }
    }
  });

  it("la foto non è sovra-saturata (era lo sbaffo rosa sulla terra rossa)", () => {
    const f = prop(stilano(".card-bg")[0].decls, "filter") ?? "";
    const sat = Number(f.replace(/\s/g, "").match(/saturate\(([\d.]+)\)/)?.[1]);
    expect(sat, `saturate(${sat}) — sopra 1.5 la terra rossa diventa rosa`).toBeLessThan(1.5);
  });

  it("i token --d-* esistono in chiaro e valgono come in scuro", () => {
    const l = chiare.find((r) => r.decls.includes("--d-football"))?.decls ?? "";
    const d = rules.find((r) => r.sel.startsWith(DARK) && r.decls.includes("--d-football"))?.decls ?? "";
    for (const t of ["--d-football", "--d-tennis", "--d-wc"]) {
      const val = (s: string) => s.replace(/\s/g, "").match(new RegExp(`${t}:(#[0-9a-f]{3,8})`))?.[1];
      expect(val(l), `manca ${t} in chiaro: --mc-accent cade sul viola del calcio`).toBeTruthy();
      expect(val(l), `${t} diverge tra i due temi`).toBe(val(d));
    }
  });
});

describe("il testo, chiaro sulla fascia e scuro sulla carta", () => {
  const chiare = rules.filter((r) => r.sel.split(",").some((p) => p.trim().startsWith(LIGHT)));
  const colore = (sel: string) => {
    const r = chiare.filter((x) => x.sel.split(",").some((p) => p.trim().endsWith(sel)));
    return r.length ? prop(r[r.length - 1].decls, "color") : null;
  };
  const medio = (c: string) => {
    const h = c.length === 4 ? c.slice(1).split("").map((x) => parseInt(x + x, 16)) : [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
    return h.reduce((a, b) => a + b, 0) / 3;
  };

  it.each([".league", ".rnd", ".when", ".teams", ".vs", ".stt", ".sc"])("%s è CHIARO (sta sulla foto)", (sel) => {
    const c = colore(`.pred ${sel}`);
    expect(c, `${sel} senza colore dichiarato in chiaro`).toBeTruthy();
    expect(medio(c!), `${sel} = ${c} — scuro sopra la fascia scura`).toBeGreaterThan(170);
  });

  it.each([".v2r-eye", ".v2r-qlab", ".v2r-conf-t", ".v2r-sub"])("%s resta SCURO (sta sulla carta)", (sel) => {
    const c = colore(`.pred ${sel}`);
    expect(c, `${sel} senza colore dichiarato in chiaro`).toBeTruthy();
    expect(medio(c!), `${sel} = ${c} — chiaro sulla carta bianca`).toBeLessThan(120);
  });

  it(".rnd sta con la FASCIA, non coi grigi della carta", () => {
    // Oggi `.rnd` è vuoto su tutta la board: se finisse coi grigi scuri, il
    // difetto comparirebbe solo il giorno che arriva il dato.
    expect(colore(".pred .rnd")).not.toBe("#3a4149");
  });
});
