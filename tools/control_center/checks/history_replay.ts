// #CERTIFICA-1001 — the /history headline recomputed from DB rows with the SAME
// code the route runs (lib/dedupe-fixtures, lib/track-record, lib/surfacing-gate).
//
// Read-only by construction: it never opens a connection. The Python check
// fetches the rows inside a READ ONLY transaction and pipes them in as JSON on
// stdin, serialised exactly like the route's exec_sql RPC
// (jsonb_agg(row_to_json(t))), so string comparisons on timestamps behave the same.
//
// stdin:  { "route_rows": [...], "finished_rows": [...] }
// stdout: { "headline": {n, won, lost}, "dedup_dropped": n, "honest": {...} }
import { dedupeByFixture } from "../../../lib/dedupe-fixtures";
import { isBeforeFootballFloorCutover } from "../../../lib/track-record";
import { footballSurfaceDecisionFor } from "../../../lib/surfacing-gate";

type Row = {
  sport?: string | null; competition?: string | null; market?: string | null;
  home_team?: string | null; away_team?: string | null;
  pick?: string | null; notes?: string | null; result?: string | null;
  starts_at?: string | null; settled_at?: string | null;
  confidence_score?: number | null; verification_state?: string | null;
  is_historical?: boolean | null;
};

// COPY of wasShownAsPick in app/api/v2/history/route.ts, which is not exported.
// Shortcut accepted on purpose: exporting it means touching product code (gated).
// Upgrade path: move it to lib/track-record.ts (the audit's `isShownPick`) and
// import it here. tests/test_cc_coerenza.py fails if the route's body changes.
function wasShownAsPick(row: Row): boolean {
  if (!row.pick) return false;
  let belowFloor = false;
  try {
    const surface = (JSON.parse(row.notes ?? "{}") as { surface?: { below_floor?: boolean } }).surface;
    belowFloor = surface?.below_floor === true;
  } catch { /* unparseable/absent notes → treat as above floor → count it */ }
  if (!belowFloor) return true;
  return row.competition === "World Cup";
}

const DEDUPE = {
  when: (r: Row) => r.starts_at,
  freshness: (r: Row) => r.settled_at ?? r.starts_at,
  extra: (r: Row) => `${r.sport ?? ""}|${r.market ?? ""}`,
};

const inHeadline = (r: Row) =>
  isBeforeFootballFloorCutover(r.starts_at) || footballSurfaceDecisionFor(r).isPick;

async function main() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    route_rows: Row[]; finished_rows: Row[];
  };

  // Same pipeline as route.ts, step by step.
  const shown = input.route_rows.filter(wasShownAsPick);
  const surfaced = dedupeByFixture(shown, DEDUPE);
  const rows = surfaced.filter((r) => r.verification_state === "verified");
  const headline = rows.filter(inHeadline);
  const won = headline.filter((r) => r.result === "won").length;
  const lost = headline.filter((r) => r.result === "lost").length;

  // Honest coverage: every shown, deduplicated pick whose match ended >48h ago,
  // unresolved / NULL / unverified / floor-excluded included in the denominator.
  const finished = dedupeByFixture(input.finished_rows.filter(wasShownAsPick), DEDUPE);
  const counted = finished.filter(
    (r) => r.is_historical === true && r.result !== "unresolved"
      && r.verification_state === "verified" && inHeadline(r),
  ).length;

  process.stdout.write(JSON.stringify({
    headline: { n: won + lost, won, lost },
    dedup_dropped: shown.length - surfaced.length,
    honest: {
      finished_shown: finished.length,
      counted,
      unresolved: finished.filter((r) => r.result === "unresolved").length,
      no_result: finished.filter((r) => r.result == null).length,
      coverage: finished.length ? Number((counted / finished.length).toFixed(3)) : null,
    },
    route_rows: input.route_rows.length,
    finished_rows: input.finished_rows.length,
  }));
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
