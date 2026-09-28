// lib/ui/detail-head.test.ts — #PICK-COERENTE-0928
//
// La card in griglia e la scheda aperta da «View analysis» devono dire la
// stessa cosa della stessa riga. Misurato da qa-andrea il 28/09 su
// Leganés–Castellón (piano Base): card «PICK CD Castellón · 42%», scheda
// «No pick · 71% · Confidence Low 27%» e, sotto, «no market price» su una
// partita quotata 3.35/3.5/2.34. La testa della scheda ricalcolava da sé
// (testata a doppia chance, quota solo FortunePlay, confidenza di fallback)
// invece di leggere la derivazione della card.
//
// Due guardie: i numeri su quella riga vera, e il desk che passa alla testa
// `cardData` — non una seconda derivazione che può tornare a divergere.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { fromDeskFootball } from "./desk-card";
import { footballWhyReasons } from "./why-reasons";

// La riga servita al piano Base il 28/09 (proiezione reale di /api/predictions,
// solo i campi che leggono card e scheda).
const LEGANES_CASTELLON = {
  match_id: "oddsapi:52ddb81b6601824c1444b86aac5f8902",
  league: "PD2",
  league_name: "Segunda Division",
  home_team: "Leganés",
  away_team: "CD Castellón",
  kickoff: "2026-09-28T18:30:00+00:00",
  p_home: 0.294323872989432,
  p_draw: 0.284992956652088,
  p_away: 0.42068317035848,
  odds_home: 3.35,
  odds_draw: 3.5,
  odds_away: 2.34,
  best_selection: "AWAY",
  confidence_score: null,
  locked: false,
  enrichment: { surface: { below_floor: true } },
};

describe("scheda e card sulla stessa riga (Leganés–Castellón, Base)", () => {
  const card = fromDeskFootball(LEGANES_CASTELLON, { winLabel: "to win", drawLabel: "Draw" });

  it("la card nomina l'esito più probabile, senza «to win» sotto il floor", () => {
    expect(card.pick).toBe("CD Castellón");
    expect(Math.round(card.modelPct!)).toBe(42);
  });

  it("il prezzo di mercato c'è: è la quota 1X2 reale dello stesso esito", () => {
    expect(card.marketPct).toBeCloseTo(100 / 2.34, 5);
  });

  it("con quel prezzo, «Reliability» non dice più «no market price»", () => {
    const why = footballWhyReasons({
      home: LEGANES_CASTELLON.home_team,
      away: LEGANES_CASTELLON.away_team,
      matchesHome: 20, matchesAway: 20,
      modelPct: card.modelPct, marketPct: card.marketPct,
    });
    const text = why.map((r) => r.text).join(" ");
    expect(text).not.toMatch(/no market price/i);
  });

  it("controllo: senza prezzo la frase resta, ed è vera (la garanzia FTC non si tocca)", () => {
    const why = footballWhyReasons({ home: "A", away: "B", marketPct: null });
    expect(why.map((r) => r.text).join(" ")).toMatch(/no market price/i);
  });
});

describe("il desk passa alla testa della scheda i dati della card", () => {
  const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const src = readFileSync(join(REPO_ROOT, "app/app/page.tsx"), "utf8");

  /** Il blocco `head: { ... }` di ogni scheda del desk, fino alla prima `},`. */
  const heads = [...src.matchAll(/\n\s+head: \{\n([\s\S]*?)\n\s+\},/g)].map((m) => m[1]);

  it("ci sono due teste: calcio e tennis", () => {
    expect(heads.length).toBe(2);
  });

  it("pick, percentuale e confidenza vengono da cardData", () => {
    for (const h of heads) {
      expect(h).toMatch(/pick: cardData\.pick,/);
      expect(h).toMatch(/modelPct: cardData\.modelPct,/);
      expect(h).toMatch(/confidence: cardData\.confidence,/);
    }
  });

  it("il «perché» riceve lo stesso prezzo di mercato della card", () => {
    const whyCalls = src.match(/modelPct: [\w.]+, marketPct: [\w.]+,/g) ?? [];
    expect(whyCalls).toEqual([
      "modelPct: cardData.modelPct, marketPct: cardData.marketPct,",
      "modelPct: cardData.modelPct, marketPct: cardData.marketPct,",
    ]);
  });
});
