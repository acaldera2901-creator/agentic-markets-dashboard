/**
 * scripts/x-dryrun.ts — #X-PIPELINE-0810 · the day on X, PRINTED, never sent.
 *
 * Composes the five posts of the matchday cadence from the real predictions in
 * `unified_predictions` and writes them to stdout with X's weighted length and
 * the pay-per-usage cost of each one. It imports lib/x-posts.ts (pure) and does
 * NOT import lib/x-client.ts: there is no code path from this script to the
 * network, so it cannot publish even with credentials in .env.
 *
 * Read-only on the DB. Falls back to a fixture when Supabase is not configured
 * or the window is empty, and says which of the two it used.
 *
 * Run:  npx tsx scripts/x-dryrun.ts [--fixture] [--day YYYY-MM-DD]
 */
import fs from "node:fs";
import path from "node:path";

// Same minimal .env reader used by scripts/audit_prediction_accuracy.ts — the
// scripts in this repo each load their own env; no shared loader exists.
function loadEnv(file: string) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] ??= v;
  }
}
loadEnv(".env");

import { dbQuery } from "../lib/db";
import {
  composeDay,
  dayCostUsd,
  postCostUsd,
  X_POST_MAX_WEIGHTED,
  type XPrediction,
  type XDaySchedule,
} from "../lib/x-posts";
import { mapRows, type MapReport, type UnifiedRowForX } from "../lib/x-predictions";

const argv = process.argv.slice(2);
const forceFixture = argv.includes("--fixture");
const dayArg = argv.includes("--day") ? argv[argv.indexOf("--day") + 1] : null;
const DAY = dayArg ?? new Date().toISOString().slice(0, 10);

async function fetchDay(day: string): Promise<MapReport> {
  // Same publication filters as the served board (app/api/v2/predictions):
  // published, not historical, not demo. Bound parameters, no interpolation.
  //
  // p_home/p_draw/p_away are NOT columns of this table (verified against
  // information_schema on 2026-08-10: none of its 51 columns is called that). The
  // 1/X/2 split lives in `notes` as JSON — which is why app/api/v2/predictions
  // parses notes for every row: its p_* column reads are always undefined.
  const rows = await dbQuery<UnifiedRowForX>(
    `SELECT id, sport, competition, home_team, away_team, player_one, player_two,
            market, pick, confidence_score, odds, starts_at, notes
       FROM unified_predictions
      WHERE starts_at >= ($1)::date
        AND starts_at <  ($1)::date + interval '1 day'
        AND published_at IS NOT NULL
        AND is_historical = FALSE
        AND is_demo = FALSE
      ORDER BY starts_at ASC
      LIMIT 200`,
    [day]
  );
  return mapRows(rows);
}

/** Fixture with the shape of a normal matchday — used when the DB is unavailable. */
function fixture(day: string): XPrediction[] {
  const at = (hhmm: string) => `${day}T${hhmm}:00.000Z`;
  return [
    { id: "fx1", sport: "football", competition: "Premier League", home: "Arsenal", away: "Everton", favorite: "Arsenal", modelPct: 63, marketPct: 60.2, edgePct: 2.8, startsAtUtc: at("14:00") },
    { id: "fx2", sport: "tennis", competition: "ATP Cincinnati", home: "Sinner", away: "Alcaraz", favorite: "Sinner", modelPct: 58, marketPct: 54.1, edgePct: 3.9, startsAtUtc: at("17:00") },
    { id: "fx3", sport: "football", competition: "Serie A", home: "Inter", away: "Roma", favorite: "Inter", modelPct: 54, marketPct: 57.1, edgePct: -3.1, startsAtUtc: at("18:30") },
    { id: "fx4", sport: "football", competition: "Bundesliga", home: "Bayern", away: "Leipzig", favorite: "Bayern", modelPct: 61, marketPct: 55.2, edgePct: 5.8, startsAtUtc: at("19:45") },
    { id: "fx5", sport: "tennis", competition: "WTA Cincinnati", home: "Swiatek", away: "Gauff", favorite: "Swiatek", modelPct: 71, marketPct: 55.6, edgePct: 15.4, startsAtUtc: at("20:30") },
  ];
}

const LINE = "─".repeat(72);

/** The funnel from DB rows to publishable predictions — never a silent loss. */
function renderFunnel(report: MapReport) {
  console.log(`Righe lette da unified_predictions: ${report.rowsIn}`);
  console.log(`Predizioni pubblicabili dopo la mappatura: ${report.predictions.length}`);
  const drops = Object.entries(report.dropped).filter(([, n]) => n > 0);
  if (drops.length > 0) {
    console.log("Righe scartate (e perché):");
    for (const [reason, n] of drops) console.log(`    · ${n} × ${reason}`);
  }
}

function render(schedule: XDaySchedule, source: string) {
  console.log(LINE);
  console.log(`DRY RUN — NIENTE È STATO PUBBLICATO SU X. Giornata ${DAY}.`);
  console.log(`Dati: ${source}`);
  console.log(LINE);

  for (const post of schedule.posts) {
    const over = post.weightedLength > X_POST_MAX_WEIGHTED ? "  ⚠️ OLTRE IL LIMITE" : "";
    console.log("");
    console.log(
      `▸ ${post.slot}  ·  ${post.scheduledAtUtc.slice(11, 16)} UTC  ·  ${post.weightedLength}/${X_POST_MAX_WEIGHTED} pesati  ·  media: ${post.media ?? "nessuna"}  ·  $${postCostUsd(post).toFixed(3)}${over}`
    );
    for (const l of post.text.split("\n")) console.log(`    │ ${l}`);
  }

  if (schedule.skipped.length > 0) {
    console.log("");
    console.log("NON PUBBLICATI (e perché):");
    for (const s of schedule.skipped) console.log(`    · ${s.slot} → ${s.reason}`);
  }

  const day = dayCostUsd(schedule.posts);
  const withUrl = schedule.posts.filter((p) => p.hasUrl).length;
  console.log("");
  console.log(LINE);
  console.log(`Post: ${schedule.posts.length}/5 · con link: ${withUrl}`);
  console.log(
    `Costo: $${day.toFixed(3)}/giorno → $${(day * 30).toFixed(2)}/mese ai prezzi pay-per-usage del 2026-08-10 ($0,015 post · $0,200 post con link).`
  );
  if (withUrl > 0) {
    const noLink = schedule.posts.length * 0.015;
    console.log(
      `Riferimento: gli stessi ${schedule.posts.length} post SENZA link costerebbero $${(noLink * 30).toFixed(2)}/mese. Il link è ~13× il costo del post.`
    );
  }
  console.log(LINE);
}

/**
 * Half time and full time are illustrated on the first kickoff of the day: the
 * real scheduler fires them from live-score events, which a dry run cannot wait
 * for. Every other slot is composed from the data as it is.
 */
function scheduleFor(predictions: XPrediction[]): XDaySchedule {
  const first = predictions[0];
  // The illustrative score must AGREE with favoriteWon, or the demo shows
  // "Shnaider 2-0 Swiatek → Swiatek correct" and reads as a bug in the copy.
  const favIsHome = first?.favorite === first?.home;
  const ht = favIsHome ? "1-0" : "0-1";
  const ft = favIsHome ? "2-0" : "0-2";
  return composeDay({
    dayUtc: DAY,
    predictions,
    halftimeMatch: first ? { ...first, halftimeScore: ht } : null,
    fulltimeMatch: first ? { ...first, finalScore: ft, favoriteWon: true } : null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/app`
      : undefined,
  });
}

async function main() {
  if (forceFixture) {
    render(scheduleFor(fixture(DAY)), "FIXTURE (--fixture)");
    printFootnotes();
    return;
  }

  const report = await fetchDay(DAY);
  console.log(LINE);
  renderFunnel(report);
  console.log("");
  render(scheduleFor(report.predictions), `unified_predictions, ${DAY}`);

  // A real day that produces nothing is the finding, not a reason to quietly
  // substitute a fixture: the funnel above stays on screen and the illustration
  // is labelled as such, below it.
  if (report.predictions.length === 0) {
    console.log("");
    console.log("↑ NESSUN POST DAI DATI VERI DI OGGI. Qui sotto la stessa giornata su FIXTURE,");
    console.log("  solo per far vedere la copy che uscirebbe con dati completi.");
    console.log("");
    render(scheduleFor(fixture(DAY)), "FIXTURE — illustrazione, NON i dati di oggi");
  }
  printFootnotes();
}

function printFootnotes() {
  console.log("");
  console.log("Le righe HT/FT usano un punteggio ILLUSTRATIVO (1-0 / 2-0): in produzione");
  console.log("arrivano dagli eventi live-score, non da questo script.");
  console.log("La probability card la RENDERIZZA il worker Maven Studio (satori→resvg, in");
  console.log("memoria): qui è indicata come media, non generata.");
}

main().catch((e) => {
  console.error("[x-dryrun] errore:", e);
  process.exit(1);
});
