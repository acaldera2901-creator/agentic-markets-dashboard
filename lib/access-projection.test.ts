import { describe, it, expect } from "vitest";
import { showcaseAllowance, isUnlocked, projectPrediction, showcaseRanking, currentShowcaseDay, utcDay, type ShowcaseCandidate } from "./access-projection";

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
  it("sblocca tre righe per sport, per giorno", () => {
    expect(showcaseAllowance("free")).toBe(3);
    expect(isUnlocked("free", 0)).toBe(true);
    expect(isUnlocked("free", 2)).toBe(true);
    expect(isUnlocked("free", 3)).toBe(false);
  });

  it("su 12 righe il Free ne sblocca 3 e ne blocca 9 — nessuna sparisce", () => {
    const projected = Array.from({ length: 12 }, (_, rank) =>
      projectPrediction({ ...FULL_ROW, id: `evt-${rank}` }, "free", rank)
    );
    expect(projected).toHaveLength(12);
    expect(projected.filter((r) => !r.locked)).toHaveLength(3);
    expect(projected.filter((r) => r.locked)).toHaveLength(9);
    expect(projected[0].locked).toBe(false);
  });

  it("il Base ne sblocca 7", () => {
    expect(showcaseAllowance("base")).toBe(7);
    const projected = Array.from({ length: 12 }, (_, rank) =>
      projectPrediction({ ...FULL_ROW, id: `evt-${rank}` }, "base", rank)
    );
    expect(projected.filter((r) => !r.locked)).toHaveLength(7);
  });

  it("la riga bloccata non porta NIENTE del pronostico", () => {
    const locked = projectPrediction(FULL_ROW, "free", 9);
    expect(locked.locked).toBe(true);
    for (const f of GATED_FIELDS) {
      expect(locked[f], `campo gated trapelato: ${f}`).toBeUndefined();
    }
  });

  it("la riga bloccata resta una scheda disegnabile: matchup, orario, esito", () => {
    const locked = projectPrediction(FULL_ROW, "free", 9);
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

// ── La regola giornaliera (#FREE-BASE-DAILY-QUOTA-0831) ──────────────────────
// La board serve una finestra di 10 giorni. Se la quota si conta sulla finestra,
// le stesse righe restano sbloccate per giorni e «3 al giorno» è un claim falso.
// Questi test tengono la promessa attaccata al meccanismo.

const cand = (id: string, conf: number, startsAt: string, surfaced = true): ShowcaseCandidate =>
  ({ id, surfaced, conf, edge: 0.03, startsAt });

describe("vetrina giornaliera (#FREE-BASE-DAILY-QUOTA-0831)", () => {
  const OGGI = "2026-08-31";

  it("solo le partite di oggi prendono un rank finito", () => {
    const rank = showcaseRanking([
      cand("oggi-1", 0.70, "2026-08-31T18:00:00Z"),
      cand("oggi-2", 0.65, "2026-08-31T20:45:00Z"),
      cand("domani", 0.99, "2026-09-01T18:00:00Z"),
    ], { scopeDay: OGGI });
    expect(rank.get("oggi-1")).toBe(0);
    expect(rank.get("oggi-2")).toBe(1);
    expect(rank.get("domani")).toBe(Number.POSITIVE_INFINITY);
  });

  it("la riga di domani resta coperta anche col pronostico più forte del board", () => {
    // `domani` ha la confidenza più alta: sulla vecchia regola era il rank 0 e
    // il Free la vedeva. Ora aspetta il suo giorno.
    const rank = showcaseRanking([
      cand("oggi", 0.55, "2026-08-31T18:00:00Z"),
      cand("domani", 0.99, "2026-09-01T18:00:00Z"),
    ], { scopeDay: OGGI });
    expect(isUnlocked("free", rank.get("oggi")!)).toBe(true);
    expect(isUnlocked("free", rank.get("domani")!)).toBe(false);
    expect(isUnlocked("base", rank.get("domani")!)).toBe(false);
  });

  it("il Pro NON si blocca sul rank infinito — la quota infinita vince sul rank", () => {
    // È il difetto che la guardia in isUnlocked previene: `Infinity < Infinity`
    // è falso, quindi senza guardia il Pro perdeva tutto ciò che non è di oggi.
    expect(isUnlocked("premium", Number.POSITIVE_INFINITY)).toBe(true);
    expect(isUnlocked("admin_full", Number.POSITIVE_INFINITY)).toBe(true);
    expect(isUnlocked("anonymous", 0)).toBe(false);
  });

  it("un giorno con meno partite della quota le apre tutte, e non prende in prestito da domani", () => {
    const rank = showcaseRanking([
      cand("oggi-1", 0.70, "2026-08-31T18:00:00Z"),
      cand("oggi-2", 0.60, "2026-08-31T20:00:00Z"),
      cand("domani-1", 0.90, "2026-09-01T18:00:00Z"),
      cand("domani-2", 0.85, "2026-09-01T20:00:00Z"),
    ], { scopeDay: OGGI });
    const sbloccate = ["oggi-1", "oggi-2", "domani-1", "domani-2"]
      .filter((id) => isUnlocked("free", rank.get(id)!));
    expect(sbloccate).toEqual(["oggi-1", "oggi-2"]);
  });

  it("senza scopeDay resta la regola vecchia: concorre tutta la finestra", () => {
    // La usa il hub Mondiali: fuori stagione nessuna partita WC è "oggi", e la
    // regola giornaliera lo lascerebbe interamente bloccato.
    const rank = showcaseRanking([
      cand("lontana", 0.99, "2026-11-14T18:00:00Z"),
      cand("oggi", 0.50, "2026-08-31T18:00:00Z"),
    ]);
    expect(rank.get("lontana")).toBe(0);
    expect(isUnlocked("free", rank.get("lontana")!)).toBe(true);
  });

  it("una data illeggibile o assente non entra nella vetrina del giorno", () => {
    const rank = showcaseRanking([
      { id: "senza-data", surfaced: true, conf: 0.99, edge: 0.1 },
      { id: "data-rotta", surfaced: true, conf: 0.98, edge: 0.1, startsAt: "non-una-data" },
      cand("oggi", 0.40, "2026-08-31T18:00:00Z"),
    ], { scopeDay: OGGI });
    expect(rank.get("senza-data")).toBe(Number.POSITIVE_INFINITY);
    expect(rank.get("data-rotta")).toBe(Number.POSITIVE_INFINITY);
    expect(rank.get("oggi")).toBe(0);
  });

  it("utcDay e currentShowcaseDay parlano la stessa lingua", () => {
    expect(utcDay("2026-08-31T23:59:59Z")).toBe("2026-08-31");
    expect(utcDay("2026-09-01T00:00:01Z")).toBe("2026-09-01");
    expect(utcDay(null)).toBe(null);
    expect(utcDay("boh")).toBe(null);
    expect(currentShowcaseDay(new Date("2026-08-31T22:30:00Z"))).toBe("2026-08-31");
  });
});

