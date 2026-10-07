// #LEDGER-SIGILLATA-1007 — le regole del registro sigillato, flag spento e acceso.
import { describe, expect, it } from "vitest";
import {
  applySealedGrading,
  gradeSealedPick,
  inSealedCohort,
  ledgerSettlementResult,
  parseFinalScore,
  sealedEntriesSql,
  sealedGradingConfig,
  sealedMapFrom,
  shouldSealFootballPick,
  type SealedEntry,
} from "./ledger-sealed-grading";
import { isShownPick, trackRecordPopulation } from "./track-record";

const ON = sealedGradingConfig({ LEDGER_SEALED_GRADING: "1", LEDGER_SEALED_FROM: "2026-10-20T00:00:00Z" });
const OFF = sealedGradingConfig({});

describe("config: fail-closed", () => {
  it("spento di default, e spento con il flag ma senza una data valida", () => {
    expect(OFF.enabled).toBe(false);
    expect(sealedGradingConfig({ LEDGER_SEALED_GRADING: "1" }).enabled).toBe(false);
    expect(sealedGradingConfig({ LEDGER_SEALED_GRADING: "1", LEDGER_SEALED_FROM: "domani" }).enabled).toBe(false);
    expect(sealedGradingConfig({ LEDGER_SEALED_GRADING: "true", LEDGER_SEALED_FROM: "2026-10-20" }).enabled).toBe(false);
  });
  it("acceso solo con 1 + data ISO", () => {
    expect(ON).toEqual({ enabled: true, from: "2026-10-20T00:00:00.000Z", fromMs: Date.parse("2026-10-20T00:00:00Z") });
  });
});

describe("(a) sigillo alla prima pick pubblicata", () => {
  it("flag spento: si sigilla anche la pick NULL, come main", () => {
    expect(shouldSealFootballPick(null, OFF)).toBe(true);
    expect(shouldSealFootballPick("HOME", OFF)).toBe(true);
  });
  it("flag acceso: solo una pick vera", () => {
    expect(shouldSealFootballPick(null, ON)).toBe(false);
    expect(shouldSealFootballPick("", ON)).toBe(false);
    expect(shouldSealFootballPick("AWAY", ON)).toBe(true);
  });
});

describe("(b) esito nel registro", () => {
  const base = { servedResult: "lost" as const, sealedPick: "HOME", homeGoals: 2, awayGoals: 1 };
  it("flag spento: sempre l'esito servito", () => {
    expect(ledgerSettlementResult({ ...base, commenceTime: "2026-11-01T15:00:00Z" }, OFF)).toBe("lost");
  });
  it("prima della data: l'esito servito", () => {
    expect(ledgerSettlementResult({ ...base, commenceTime: "2026-10-19T23:59:59Z" }, ON)).toBe("lost");
  });
  it("dalla data: l'esito della SIGILLATA, anche se la servita e' cambiata", () => {
    expect(ledgerSettlementResult({ ...base, commenceTime: "2026-10-20T00:00:00Z" }, ON)).toBe("won");
  });
  it("una servita sparita (void) non rende void la sigillata", () => {
    expect(ledgerSettlementResult(
      { ...base, servedResult: "void", homeGoals: 0, awayGoals: 1, commenceTime: "2026-11-01T15:00:00Z" }, ON,
    )).toBe("lost");
  });
  it("senza pick sigillata resta l'esito servito (la FK rifiutera' comunque la riga)", () => {
    expect(ledgerSettlementResult({ ...base, sealedPick: null, commenceTime: "2026-11-01T15:00:00Z" }, ON)).toBe("lost");
  });
  it("grading e punteggio", () => {
    expect(gradeSealedPick("draw", "DRAW")).toBe("won");
    expect(gradeSealedPick("P1", "HOME")).toBe("void");
    expect(parseFinalScore("2-1")).toEqual({ h: 2, a: 1 });
    expect(parseFinalScore("6-4 6-3")).toBeNull();
    expect(inSealedCohort(null, ON)).toBe(false);
  });
});

describe("(c) track record", () => {
  const entry = (over: Partial<SealedEntry>): SealedEntry => ({
    source_id: "m1", pick: "HOME", confidence: 0.61, commence_time: "2026-11-01T15:00:00Z",
    settle_result: "lost", settle_outcome: "HOME", ...over,
  });
  const row = (over: Record<string, unknown>) => ({
    id: "r", sport: "football", competition: "Serie A", market: "1X2",
    source_table: "match_predictions", source_id: "m1", home_team: "Inter", away_team: "Milan",
    starts_at: "2026-11-01T15:00:00Z", published_at: "2026-10-30T08:00:00Z",
    pick: "AWAY", result: "lost", verification_state: "verified",
    notes: JSON.stringify({ final_score: "2-1" }), confidence_score: 40,
    explanation: "Pick: AWAY", odds: 3.1,
    ...over,
  });

  it("flag spento: righe IDENTICHE (stesso array, nessuna statistica)", () => {
    const rows = [row({})];
    const out = applySealedGrading(rows, sealedMapFrom([entry({})]), OFF, isShownPick);
    expect(out.rows).toBe(rows);
    expect(out.stats).toBeNull();
  });

  it("la sigillata HOME vince dove la servita AWAY perde, e la prosa della servita cade", () => {
    const out = applySealedGrading([row({})], sealedMapFrom([entry({})]), ON, isShownPick);
    expect(out.rows[0]).toMatchObject({
      pick: "HOME", result: "won", confidence_score: 61, explanation: null, odds: null, ledger_sealed: true,
    });
    expect(out.stats).toMatchObject({ sealed_rows: 1, pick_differs: 1, result_changed: 1, served_without_seal: 0 });
  });

  it("la servita void (sparita sotto floor) torna un esito verificato", () => {
    const r = row({ pick: null, result: "void", verification_state: null, notes: JSON.stringify({ final_score: "0-1", surface: { below_floor: true } }) });
    const out = applySealedGrading([r], sealedMapFrom([entry({ settle_outcome: null, settle_result: "void" })]), ON, isShownPick);
    expect(out.rows[0]).toMatchObject({ pick: "HOME", result: "lost", verification_state: "verified" });
    // conta nel numero: il below_floor della servita non la nasconde
    expect(trackRecordPopulation(out.rows).headlineRows).toHaveLength(1);
  });

  it("void vero (nessun punteggio) resta void", () => {
    const r = row({ result: "void", verification_state: null, notes: null });
    const out = applySealedGrading([r], sealedMapFrom([entry({ settle_outcome: null, settle_result: "void" })]), ON, isShownPick);
    expect(out.rows[0]).toMatchObject({ pick: "HOME", result: "void", verification_state: null });
  });

  it("riga del periodo SENZA sigillo: esce dal numero ed e' dichiarata", () => {
    const out = applySealedGrading([row({})], new Map(), ON, isShownPick);
    expect(out.rows[0].pick).toBeNull();
    expect(out.stats?.served_without_seal).toBe(1);
    expect(trackRecordPopulation(out.rows).headlineRows).toHaveLength(0);
  });

  it("prima della data e fuori dal calcio nulla cambia", () => {
    const before = row({ starts_at: "2026-10-19T15:00:00Z" });
    const tennis = row({ sport: "tennis", source_table: "tennis_predictions" });
    const out = applySealedGrading([before, tennis], sealedMapFrom([entry({})]), ON, isShownPick);
    expect(out.rows[0]).toBe(before);
    expect(out.rows[1]).toBe(tennis);
  });

  it("la SQL legge solo le sigillate vere del periodo, ultima revisione, senza alias t", () => {
    const sql = sealedEntriesSql(ON.from!);
    expect(sql).toContain("l.pick IS NOT NULL");
    expect(sql).toContain("l.commence_time >= '2026-10-20T00:00:00.000Z'");
    expect(sql).toContain("settlement_revision DESC");
    expect(sql).not.toMatch(/\bAS t\b|\)\s*t\b/);
  });
});
