// #REDESIGN-V3C F6 — /record: receipts, corrections, honest copy, routing.
// Fictitious rows only, no DB.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V3C_LANGS, copyKeys } from "./copy";
import { V3C_RECORD_COPY, brierVerdict, recordCopyFor } from "./copy-record";
import { classifyCorrection, footballReceipt, mergeReceipts, receiptFingerprint, summarizeCorrections, tennisReceipt, type FootballReceiptRow, type TennisReceiptRow } from "./receipts";
import { buildRecord, type SealedFootballRow } from "./record";
import { binLabel, dotRadius, parseReceiptPage, parseReceiptSport, signedPp, signed4, shortFingerprint } from "./record-view";
import { v3cRewrites } from "./rewrites";
import { v3cRedirects } from "./redirects";

const fb = (over: Partial<FootballReceiptRow> = {}): FootballReceiptRow => ({
  source_table: "match_predictions",
  source_id: "m1",
  model_version: "football-v4-xg-model",
  home: "Genoa",
  away: "Fiorentina",
  competition: "Serie A",
  pick: null,
  p_home: 0.48,
  p_draw: 0.27,
  p_away: 0.25,
  odds: null,
  is_paper: false,
  captured_at: "2026-10-04T09:02:00.123456Z",
  commence_time: "2026-10-04T18:45:00.000Z",
  result: "void",
  outcome: "HOME",
  final_score: "2-1",
  revision: 1,
  market_p_home: 0.44,
  market_p_draw: 0.29,
  market_p_away: 0.27,
  odds_home: 2.15,
  odds_draw: 3.3,
  odds_away: 3.5,
  ...over,
});

describe("football receipt", () => {
  it("no pick shown → reads the estimate's top outcome and says so; verdict from the outcome", () => {
    const r = footballReceipt(fb());
    expect(r.read).toBe("home");
    expect(r.read_kind).toBe("top");
    expect(r.price).toBe(2.15);
    expect(r.estimate_p).toBe(0.48);
    expect(r.market_p).toBe(0.44);
    expect(r.gap_pp).toBe(4);
    expect(r.verdict).toBe("in_favour");
  });
  it("a pick shown is the outcome read; a loss is shown as a loss", () => {
    const r = footballReceipt(fb({ pick: "AWAY", result: "lost" }));
    expect(r.read).toBe("away");
    expect(r.read_kind).toBe("pick");
    expect(r.gap_pp).toBe(-2);
    expect(r.verdict).toBe("against");
  });
  it("no market at seal: no gap, the reason instead — never a fabricated market", () => {
    const r = footballReceipt(fb({ market_p_home: null, market_p_draw: null, market_p_away: null, odds_home: null, odds_draw: null, odds_away: null, is_paper: true }));
    expect(r.market_p).toBeNull();
    expect(r.gap_pp).toBeNull();
    expect(r.gap_null_reason).toBe("no_market_at_seal");
    expect(r.price).toBeNull();
  });
  it("no outcome: void or unresolved, not a win or a loss", () => {
    expect(footballReceipt(fb({ outcome: null, result: "void" })).verdict).toBe("void");
    expect(footballReceipt(fb({ outcome: null, result: "unresolved" })).verdict).toBe("unresolved");
  });
});

const tn = (over: Partial<TennisReceiptRow> = {}): TennisReceiptRow => ({
  source_table: "tennis_predictions",
  source_id: "t1",
  model_version: "partner-market-v1",
  home_team: "A Player",
  away_team: "B Player",
  pick: "A Player",
  p: 0.62,
  p_home: 0.62,
  p_away: 0.38,
  result: "won",
  odds: 1.55,
  signal_type: "paper",
  captured_at: "2026-10-04T08:00:00.000000Z",
  commence_time: "2026-10-04T12:00:00.000Z",
  competition: "ATP Shanghai",
  final_score: "6-4 6-3",
  revision: 1,
  ...over,
});

describe("tennis receipt", () => {
  it("market rows: the sealed number IS the market — no gap, said so", () => {
    const r = tennisReceipt(tn());
    expect(r.tennis_kind).toBe("market_tempered");
    expect(r.gap_pp).toBeNull();
    expect(r.gap_null_reason).toBe("is_market");
    expect(r.verdict).toBe("in_favour");
  });
  it("our Elo without a feed price before the seal: no gap, no market", () => {
    const r = tennisReceipt(tn({ model_version: "tennis-elo-v4", odds: null, result: "lost" }));
    expect(r.tennis_kind).toBe("model_tempered");
    expect(r.gap_null_reason).toBe("no_market_at_seal");
    expect(r.verdict).toBe("against");
  });
});

describe("fingerprint", () => {
  it("is SHA-256 of the printed recipe, recomputable from the sealed fields", () => {
    const f = { source_table: "match_predictions", source_id: "m1", model_version: "v", captured_at: "2026-10-04T09:02:00.123456Z", p_home: 0.48, p_draw: 0.27, p_away: 0.25, odds: null };
    const expected = createHash("sha256").update("v1|match_predictions|m1|v|2026-10-04T09:02:00.123456Z|0.48|0.27|0.25|").digest("hex");
    expect(receiptFingerprint(f)).toBe(expected);
    expect(receiptFingerprint({ ...f, p_home: 0.49 })).not.toBe(expected);
    expect(shortFingerprint(expected)).toBe(`${expected.slice(0, 4)}…${expected.slice(-2)}`);
    expect(shortFingerprint("not-a-hash")).toBe("");
  });
});

describe("corrections", () => {
  it("classifies the reasons stored in prod (06/10)", () => {
    expect(classifyCorrection("recupero:CALCIO-1001 fonte=gemello")).toEqual({ cause: "late_result", source: "gemello", new_date: null });
    expect(classifyCorrection("recupero:CALCIO-1001 fonte=espn-id prova=rinviata-oltre-48h:2026-10-21")).toEqual({ cause: "postponed", source: "espn-id", new_date: "2026-10-21" });
    expect(classifyCorrection("recupero:CALCIO-1001 fonte=espn-data-nomi prova=STATUS_POSTPONED").cause).toBe("postponed");
    expect(classifyCorrection("nessuna pick mostrata: il mastro dichiarava won (#SETTLE-0909)").cause).toBe("no_pick_shown");
    expect(classifyCorrection("backfill:RISULTATI-PARTNER-1001").cause).toBe("late_fill");
    expect(classifyCorrection("something new").cause).toBe("other");
    expect(classifyCorrection(null).cause).toBe("other");
  });
  it("counts every correction by cause; the latest keep the raw reason", () => {
    const s = summarizeCorrections(
      [{ reason: "backfill:X" }, { reason: "recupero:Y fonte=espn-id" }, { reason: "recupero:Y fonte=espn-id" }],
      [{ sport: "football", home: "A", away: "B", kickoff: "2026-09-01T18:00:00Z", revision: 2, corrected_at: "2026-10-01T12:00:00Z", before: "unresolved", after: "won", before_score: null, after_score: "1-0", reason: "recupero:Y fonte=espn-id" }],
    );
    expect(s.total).toBe(3);
    expect(s.by_cause.late_result).toBe(2);
    expect(s.by_cause.late_fill).toBe(1);
    expect(s.latest[0].reason_raw).toBe("recupero:Y fonte=espn-id");
  });
});

describe("receipts order", () => {
  it("newest seal first, ties by id", () => {
    const a = footballReceipt(fb({ source_id: "b" }));
    const b = footballReceipt(fb({ source_id: "a" }));
    const c = tennisReceipt(tn({ captured_at: "2026-10-05T10:00:00.000000Z" }));
    expect(mergeReceipts([a, b], [c]).map((r) => r.source_id)).toEqual(["t1", "a", "b"]);
  });
});

describe("Brier side by side", () => {
  const rows: SealedFootballRow[] = Array.from({ length: 40 }, (_, i) => ({
    source_id: `m${i}`,
    captured_at: "2026-09-01T10:00:00Z",
    commence_time: "2026-09-01T18:00:00Z",
    is_paper: false,
    p_home: 0.5,
    p_draw: 0.3,
    p_away: 0.2,
    result: "void",
    outcome: i % 2 ? "HOME" : "AWAY",
    market_p_home: 0.45 + (i % 3) * 0.01,
    market_p_draw: 0.3,
    market_p_away: 0.25 - (i % 3) * 0.01,
  }));
  it("each Brier carries its own 95% interval, containing the mean", () => {
    const b = buildRecord(rows, new Date("2026-10-05T00:00:00Z")).brier;
    expect(b.estimate_ci95).toBeTruthy();
    expect(b.market_ci95).toBeTruthy();
    expect(b.estimate_ci95!.low).toBeLessThanOrEqual(b.estimate!);
    expect(b.estimate_ci95!.high).toBeGreaterThanOrEqual(b.estimate!);
    expect(b.market_ci95!.low).toBeLessThanOrEqual(b.market!);
  });
  it("the honest sentence is chosen by the interval of the difference", () => {
    expect(brierVerdict({ low: 0.0002, high: 0.0049 })).toBe("market_better");
    expect(brierVerdict({ low: -0.001, high: 0.002 })).toBe("tie");
    expect(brierVerdict({ low: -0.004, high: -0.001 })).toBe("ours_lower");
    expect(brierVerdict(null)).toBeNull();
    expect(recordCopyFor("en").kpi.verdict.market_better).toBe("The market is slightly better than ours. We publish it anyway.");
  });
});

describe("copy", () => {
  const strings = (o: unknown): string[] =>
    typeof o === "string" ? [o] : typeof o === "function" ? [String((o as (...a: string[]) => string)("x", "y", "z", "w"))] : o && typeof o === "object" ? Object.values(o).flatMap(strings) : [];
  it("never uses ROI, CLV, hit-rate, win rate or profit language (all 11 languages)", () => {
    for (const lang of V3C_LANGS) {
      const all = strings(V3C_RECORD_COPY[lang]).join(" \n ");
      for (const bad of [/\bROI\b/i, /\bCLV\b/i, /hit[- ]?rate/i, /win rate/i, /guarantee/i, /garantit/i, /beat(s|ing)? the market/i, /battiamo/i, /\block\b/i, /sure win/i, /profit/i]) {
        expect(all, `${lang}: ${bad}`).not.toMatch(bad);
      }
    }
  });
  it("IT is complete: same keys as EN", () => {
    expect(copyKeys(V3C_RECORD_COPY.it as unknown as Record<string, unknown>)).toEqual(copyKeys(V3C_RECORD_COPY.en as unknown as Record<string, unknown>));
  });
  it("docs/v3c-i18n-keys.md lists the record keys for F10", () => {
    const doc = readFileSync(join(process.cwd(), "docs/v3c-i18n-keys.md"), "utf8");
    for (const k of copyKeys(V3C_RECORD_COPY.en as unknown as Record<string, unknown>)) expect(doc).toContain(`\`record.${k}\``);
  });
});

describe("routing (flag)", () => {
  it("off: no redirect, /history stays", () => {
    for (const v of [undefined, "", "0", "false"]) expect(v3cRedirects(v)).toEqual([]);
  });
  it("on: /history and /risultati → /record, permanent (308); /record served by /v3c/record", () => {
    const r = v3cRedirects("1");
    expect(r).toContainEqual({ source: "/history", destination: "/record", permanent: true });
    expect(r).toContainEqual({ source: "/risultati", destination: "/record", permanent: true });
    const rw = v3cRewrites("1") as { beforeFiles: { source: string; destination: string }[] };
    expect(rw.beforeFiles).toContainEqual({ source: "/record", destination: "/v3c/record" });
  });
  it("query params are parsed defensively", () => {
    expect(parseReceiptSport("tennis")).toBe("tennis");
    expect(parseReceiptSport("<x>")).toBe("football");
    expect(parseReceiptSport("all")).toBe("all");
    expect(parseReceiptPage("2")).toBe(2);
    expect(parseReceiptPage("-1")).toBe(0);
    expect(parseReceiptPage("999")).toBe(0);
    expect(parseReceiptPage(["3"])).toBe(3);
  });
});

describe("view helpers", () => {
  it("formats with a typographic minus and fixed decimals", () => {
    expect(signed4(-0.0012)).toBe("−0.0012");
    expect(signed4(0.0026)).toBe("+0.0026");
    expect(signedPp(-0.66)).toBe("−0.7");
    expect(binLabel({ from: 0.6, to: 0.7 })).toBe("60–70%");
    expect(dotRadius(1, 1000)).toBe(3);
    expect(dotRadius(1000, 1000)).toBe(9);
  });
});
