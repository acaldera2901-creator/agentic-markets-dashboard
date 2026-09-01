// lib/mobile-css-guard.test.ts — #UI-MOBILE-0822
//
// `app/mobile.css` esiste per una promessa sola: sotto i 640px cambia tutto,
// sopra i 640px NON ESISTE. Il desktop di BetRedge è stato misurato riga per
// riga (contrasto WCAG a zero su dieci rotte e due temi, sweep 28/28) e quella
// verifica non deve poter essere annullata da una regola aggiunta in fretta
// fuori dalla media query.
//
// Una singola regola scritta fuori dal blocco `@media` colpirebbe OGNI
// larghezza in silenzio: nessun errore, nessun test rosso, solo il desktop che
// cambia. Questo guard rende quel caso rumoroso.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOGLIO = join(REPO_ROOT, "app/mobile.css");

/** Via i commenti: dentro ci sono graffe e parentesi che falserebbero il conto. */
function senzaCommenti(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Estremi del primo blocco @media, bilanciando le graffe. */
function bloccoMedia(css: string): { inizio: number; fine: number } {
  const inizio = css.indexOf("@media");
  if (inizio < 0) return { inizio: -1, fine: -1 };
  let livello = 0;
  for (let i = inizio; i < css.length; i++) {
    if (css[i] === "{") livello++;
    else if (css[i] === "}") {
      livello--;
      if (livello === 0) return { inizio, fine: i };
    }
  }
  return { inizio, fine: -1 };
}

describe("mobile.css non può toccare il desktop", () => {
  const css = senzaCommenti(readFileSync(FOGLIO, "utf8"));
  const { inizio, fine } = bloccoMedia(css);

  it("contiene esattamente una media query, e si chiude", () => {
    expect(inizio).toBeGreaterThanOrEqual(0);
    expect(fine).toBeGreaterThan(inizio);
    // Una seconda @media non è vietata in assoluto, ma va aggiunta con
    // intenzione: se compare, questo test chiede di aggiornare il guard.
    expect(css.slice(fine).includes("@media")).toBe(false);
  });

  it("il breakpoint è quello dichiarato: max-width 640px", () => {
    expect(css.slice(inizio, css.indexOf("{", inizio))).toContain("max-width: 640px");
  });

  it("NESSUNA regola vive fuori dalla media query", () => {
    const prima = css.slice(0, inizio).trim();
    const dopo = css.slice(fine + 1).trim();
    expect(
      prima,
      `\n${prima.length} caratteri di CSS PRIMA della media query: colpirebbero ogni larghezza.\n${prima.slice(0, 200)}\n`,
    ).toBe("");
    expect(
      dopo,
      `\n${dopo.length} caratteri di CSS DOPO la media query: colpirebbero ogni larghezza.\n${dopo.slice(0, 200)}\n`,
    ).toBe("");
  });

  it("le graffe sono bilanciate (un foglio troncato applica regole a caso)", () => {
    const aperte = (css.match(/\{/g) ?? []).length;
    const chiuse = (css.match(/\}/g) ?? []).length;
    expect(aperte).toBe(chiuse);
  });

  it("ogni `!important` sta DENTRO la media query", () => {
    // Contro uno stile inline (il banner cookie scrive misure e colori
    // nell'attributo style) !important è l'unico strumento che arriva. Ma fuori
    // dalla media query colpirebbe il desktop e sarebbe inarrestabile: è quello
    // il caso da vietare, non l'uso in sé.
    const blocco = css.slice(inizio, fine);
    const dentro = (blocco.match(/!important/g) ?? []).length;
    const totali = (css.match(/!important/g) ?? []).length;
    expect(dentro, "un !important fuori dalla media query colpirebbe ogni larghezza").toBe(totali);
  });
});
