// lib/light-card-css-guard.test.ts — #UI-LIGHT-CARD-0830
//
// In tema chiaro la scheda prediction è CARTA: nessuna foto dietro. La foto
// resta al tema scuro, dove il fondo cinematico la regge. In chiaro era una
// macchia — due velature bianche sovrapposte lasciavano la foto visibile in una
// sola fascia accidentale, e `saturate(2)` la portava a foschia grigia sul
// calcio e a sbaffo rosa sulla terra rossa del tennis.
//
// Perché un guard e non solo la CSS: `app/machina.css` è GENERATO da
// docs/ui-machina/src/port-to-scoped.py, e i due difetti che questo file protegge
// sono entrambi silenziosi — non c'è errore, non c'è test rosso, cambia solo
// quello che si vede.
//
//  1. le classi `.im-*` montano l'immagine FUORI dal tema (servono a entrambi):
//     se cade la riga che spegne `.card-bg`/`.card-veil` in chiaro, la foto
//     torna NUDA a tutta scheda, senza nemmeno la velatura.
//  2. i token dello sport (--d-football/--d-tennis/--d-wc) vivevano SOLO dentro
//     `:root:not([data-theme="light"])`: in chiaro `var(--d-tennis)` non
//     risolveva e --mc-accent cadeva sul fallback, quindi OGNI scheda portava il
//     filetto viola del calcio, tennis compreso (misurato in produzione il
//     30/08: rgb(109,40,217) su una card tennis).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(REPO_ROOT, "app/machina.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const LIGHT = ':root[data-theme="light"]';
/** Solo le regole del tema chiaro: quelle scure portano `:not([data-theme="light"])`. */
const regoleChiare = css
  .split("}")
  .map((b) => b.trim())
  .filter((b) => b.includes(LIGHT) && !b.includes(':not([data-theme="light"])'));

describe("tema chiaro: la scheda è carta, senza foto", () => {
  it("spegne ESPLICITAMENTE i due strati della foto", () => {
    // `display:none` e non l'assenza di regole: le .im-* stanno fuori dal tema.
    const spegne = regoleChiare.filter(
      (b) => b.includes(".card-bg") && b.includes(".card-veil") && /display\s*:\s*none/.test(b),
    );
    expect(
      spegne.length,
      "nessuna regola chiara spegne .card-bg + .card-veil: la foto torna nuda a tutta scheda",
    ).toBe(1);
  });

  it("non riaccende la foto in chiaro da nessuna parte", () => {
    // Una `opacity` o un `filter` sul .card-bg chiaro vorrebbe dire che qualcuno
    // ha rimesso la foto senza passare da qui.
    const riaccende = regoleChiare.filter(
      (b) => /\.card-(bg|veil)\b/.test(b) && !/display\s*:\s*none/.test(b),
    );
    expect(riaccende, `regole chiare che stilano ancora la foto:\n${riaccende.join("\n")}`).toEqual([]);
  });
});

describe("tema chiaro: il filetto segue lo sport", () => {
  it("i token --d-* sono definiti anche in chiaro", () => {
    const token = regoleChiare.find((b) => b.includes("--d-tennis"));
    expect(token, "--d-tennis non esiste in chiaro: --mc-accent cade sul viola del calcio").toBeTruthy();
    for (const t of ["--d-football", "--d-tennis", "--d-wc"]) {
      expect(token, `manca ${t}`).toContain(t);
    }
    // il tennis è arancio, non viola: è ESATTAMENTE il difetto misurato.
    expect(token!.replace(/\s/g, "")).toContain("--d-tennis:#c2410c");
  });

  it("i valori degli sport sono gli stessi del tema scuro", () => {
    const scuro = css
      .split("}")
      .map((b) => b.trim())
      .find((b) => b.includes(':not([data-theme="light"])') && b.includes("--d-football"));
    expect(scuro).toBeTruthy();
    const chiaro = regoleChiare.find((b) => b.includes("--d-football"))!;
    for (const t of ["--d-football", "--d-tennis", "--d-wc"]) {
      const val = (s: string) => s.replace(/\s/g, "").match(new RegExp(`${t}:(#[0-9a-f]{3,8})`))?.[1];
      expect(val(chiaro), `${t} diverge tra i due temi`).toBe(val(scuro!));
    }
  });

  it("il filetto da 4px resta, ancorato a .top", () => {
    const top = regoleChiare.find((b) => b.includes(".pred .top::before"));
    expect(top, "senza il filetto la scheda chiara è il prodotto di prima").toBeTruthy();
    expect(top!).toContain("var(--mc-accent");
    expect(top!.replace(/\s/g, "")).toContain("height:4px");
    // `.top::before` è absolute: senza `position:relative` sul padre andrebbe a
    // fondo scheda invece che sul bordo alto.
    const ancora = regoleChiare.find((b) => /\.pred\s+\.top\{/.test(b + "{") || /\.pred \.top$/.test(b.split("{")[0].trim()));
    expect(regoleChiare.some((b) => b.split("{")[0].trim().endsWith(".pred .top") && /position\s*:\s*relative/.test(b)),
      `.pred .top senza position:relative — il filetto scivola\n${ancora ?? ""}`).toBe(true);
  });
});
