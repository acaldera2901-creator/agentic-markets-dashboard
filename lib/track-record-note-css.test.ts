// #SPLIT-0201 — la riga del totale sotto la cifra del modello è una frase:
// minuscola, a capo consentito, larghezza cappata. Non deve ereditare lo stile
// delle etichette (maiuscolo, 9,5px) che allargava il riquadro del KPI.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { it, expect } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rule = (css: string, sel: string): string => {
  const i = css.indexOf(`${sel}{`) >= 0 ? css.indexOf(`${sel}{`) : css.indexOf(`${sel} {`);
  expect(i, sel).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("}", i));
};

it(".am-kpi .note (KPI dello storico): minuscola, a capo, cappata", () => {
  const r = rule(readFileSync(join(ROOT, "app/globals.css"), "utf8"), ".am-kpi .note");
  expect(r).toMatch(/text-transform:\s*none/);
  expect(r).toMatch(/white-space:\s*normal/);
  expect(r).toMatch(/max-width:\s*\d+ch/);
  expect(r).not.toMatch(/nowrap|min-width/);
});

it(".tr-note (card del track record): minuscola, a capo", () => {
  const r = rule(readFileSync(join(ROOT, "components/track-record/TrackRecordView.tsx"), "utf8"), ".tr-root .tr-note");
  expect(r).toMatch(/text-transform:none/);
  expect(r).toMatch(/white-space:normal/);
  expect(r).not.toMatch(/nowrap|min-width/);
});
