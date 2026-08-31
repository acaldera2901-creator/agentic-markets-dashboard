import { describe, it, expect } from "vitest";
import { showcaseAllowance, isUnlocked, projectPrediction } from "./access-projection";

// #FREE-BOARD-FULL-0831 — Da qui in poi il Free vede sulla board ANCHE le righe
// bloccate (schede vere col readout mascherato) invece di non vederle affatto.
// Il fatto che quelle righe siano innocue non è più un dettaglio del backend: è
// la condizione che rende lecito mostrarle. Questi test la inchiodano.
//
// NOTA: qui si prova la proiezione condivisa (tennis + /api/v2/predictions).
// La board calcio ha la sua `projectPredictionRow` locale in
// app/api/predictions/route.ts, non esportata, che sullo stesso ramo ritorna
// `{ ...base, locked: true }` con `base` = matchup + kickoff.

const FULL_ROW = {
  id: "evt-1",
  sport: "tennis",
  competition: "ATP Cincinnati",
  event_name: "Sinner v Alcaraz",
  home_team: "Sinner",
  away_team: "Alcaraz",
  starts_at: "2026-08-31T18:00:00Z",
  status: "scheduled",
  result: null,
  settled_at: null,
  // tutto ciò che il piano Free NON deve poter leggere:
  pick: "Sinner",
  p_home: 0.63,
  p_draw: null,
  p_away: 0.37,
  confidence_score: 0.63,
  fair_odds: 1.59,
  market: "moneyline",
  signal_type: "value",
  explanation: "modello vs mercato",
  model_version: "v2.3",
  notes: "{}",
  closing_line_value: 0.02,
  stake_suggestion: 1.5,
  edge_percent: 4.1,
  enrichment: { form: "WWLWW" },
};

// Campi che rivelano il pronostico: nessuno di questi può uscire su riga bloccata.
const GATED_FIELDS = [
  "pick", "p_home", "p_draw", "p_away", "confidence_score", "fair_odds",
  "market", "signal_type", "explanation", "model_version", "notes",
  "closing_line_value", "stake_suggestion", "edge_percent", "enrichment",
] as const;

describe("vetrina Free (#FREE-BOARD-FULL-0831)", () => {
  it("sblocca una sola riga per sport", () => {
    expect(showcaseAllowance("free")).toBe(1);
    expect(isUnlocked("free", 0)).toBe(true);
    expect(isUnlocked("free", 1)).toBe(false);
  });

  it("su 12 righe il Free ne sblocca 1 e ne blocca 11 — nessuna sparisce", () => {
    const projected = Array.from({ length: 12 }, (_, rank) =>
      projectPrediction({ ...FULL_ROW, id: `evt-${rank}` }, "free", rank)
    );
    expect(projected).toHaveLength(12);
    expect(projected.filter((r) => !r.locked)).toHaveLength(1);
    expect(projected.filter((r) => r.locked)).toHaveLength(11);
    expect(projected[0].locked).toBe(false);
  });

  it("la riga bloccata non porta NIENTE del pronostico", () => {
    const locked = projectPrediction(FULL_ROW, "free", 3);
    expect(locked.locked).toBe(true);
    for (const f of GATED_FIELDS) {
      expect(locked[f], `campo gated trapelato: ${f}`).toBeUndefined();
    }
  });

  it("la riga bloccata resta una scheda disegnabile: matchup, orario, esito", () => {
    const locked = projectPrediction(FULL_ROW, "free", 3);
    expect(locked.home_team).toBe("Sinner");
    expect(locked.away_team).toBe("Alcaraz");
    expect(locked.starts_at).toBe("2026-08-31T18:00:00Z");
    expect(locked.competition).toBe("ATP Cincinnati");
    // result/settled_at sono fatti pubblici (come il punteggio finale): servono
    // al track record onesto e restano visibili anche da bloccati.
    expect("result" in locked).toBe(true);
  });

  it("la riga sbloccata del Free porta il pick ma non i campi dei paganti", () => {
    const unlocked = projectPrediction(FULL_ROW, "free", 0);
    expect(unlocked.locked).toBe(false);
    expect(unlocked.pick).toBe("Sinner");
    expect(unlocked.confidence_score).toBe(0.63);
    expect(unlocked.edge_percent).toBeUndefined();
    expect(unlocked.closing_line_value).toBeUndefined();
    expect(unlocked.enrichment).toBeUndefined();
  });

  it("il Pro vede tutto sbloccato — è il confronto che la board deve reggere", () => {
    const rows = Array.from({ length: 12 }, (_, rank) =>
      projectPrediction({ ...FULL_ROW, id: `evt-${rank}` }, "premium", rank)
    );
    expect(rows.every((r) => !r.locked)).toBe(true);
    expect(rows[11].enrichment).toEqual({ form: "WWLWW" });
  });
});
