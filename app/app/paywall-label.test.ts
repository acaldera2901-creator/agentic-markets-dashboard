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
