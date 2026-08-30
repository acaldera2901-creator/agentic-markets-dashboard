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
  it("sta su .top::before nei DUE temi (in scuro .pred::before sono le smussature)", () => {
    for (const [nome, t] of [["chiaro", LIGHT], ["scuro", DARK]] as const) {
      const d = declsFor(t, ".pred .top::before") + ";" + declsFor(t, ".top::before");
      expect(prop(d, "height"), `${nome}: il filetto non è alto 4px`).toBe("4px");
      expect(prop(d, "background"), `${nome}: il filetto non usa il colore dello sport`).toContain("--mc-accent");
    }
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

  it("la velatura è UNA sola, ed è SCURA", () => {
    const v = stilano(".card-veil");
    expect(v.length, `velature in chiaro: ${v.length} (deve essere 1)`).toBe(1);
    expect(v[0].decls).toContain("linear-gradient");
    expect(/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(v[0].decls), "velatura BIANCA su scena notturna: fa foschia grigia").toBe(false);
  });

  it("nessuna SECONDA velatura su .top o .fx (era la causa della macchia)", () => {
    for (const sel of [".pred .top", ".pred .fx"]) {
      const g = stilano(sel).filter((r) => /background\s*:\s*linear-gradient/.test(r.decls));
      expect(g.map((r) => r.sel), `${sel} porta un gradiente: sovrapposto a .card-veil ricrea la fascia accidentale`).toEqual([]);
    }
  });

  it("foto e velatura finiscono nello stesso punto, sul bordo alto del readout", () => {
    // 154px = distanza da `.v2r` al fondo scheda, misurata su tutte e 126 le
    // schede con questa struttura. Se il layout del readout cambia, va
    // RI-MISURATA, non indovinata.
    const b = (s: string) => prop(stilano(s)[0]?.decls ?? "", "bottom");
    expect(b(".card-bg"), "la foto non è ritagliata alla fascia").toBe("154px");
    expect(b(".card-veil"), "la velatura non finisce dove finisce la foto").toBe(b(".card-bg"));
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
