// #COERENZA-1001 (d, punto 3 di Andrea) — il paywall mostra
// historyV2Stats.win_rate, che è all-time su tutte le pick concluse
// (/api/v2/history), quindi non può dire «ultime 100». Guard sul sorgente:
// FreePaywall non è esportato e il numero vero è già coperto dai test della route.
import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("il paywall non etichetta l'all-time come «ultime 100 pick»", () => {
  const src = readFileSync(join(__dirname, "page.tsx"), "utf8");
  expect(src).not.toMatch(/ultime 100 pick concluse|last 100 settled picks|100 derniers picks/);
  expect(src).toContain("hit rate · tutte le pick concluse");
});

// #SPLIT-0201 — il paywall mostra la STESSA cifra del KPI dello storico
// (headlineFigure: il totale), con la sua n; nessuna etichetta «delle nostre
// predizioni», che col totale sarebbe falsa.
it("il paywall usa headlineFigure come il KPI, con la sua n", () => {
  const src = readFileSync(join(__dirname, "page.tsx"), "utf8");
  expect(src).not.toMatch(/hitRate=\{v2RateMeaningful \? historyV2Stats\?\.win_rate/);
  expect(src).toMatch(/hitRate=\{historyV2Stats && isRateMeaningful\(v2Head\.n\) && v2Head\.winRate\s*\?\s*\{ rate: v2Head\.winRate, n: v2Head\.n \}/);
  expect(src).toContain("hit rate · tutte le pick concluse\", en: \"hit rate · all settled picks");
  expect(src).toMatch(/ru: "hit rate · все закрытые пики" \}\)\} · \{hitRate\.n\}/);
  expect(src).not.toMatch(/nostre predizioni|our predictions/);
});
