// #CERTIFICA-1001 — the /history headline recomputed from DB rows with the SAME
// code the route runs.
//
// #COERENZA-1001: no pipeline copy any more. The route computes everything
// with lib/track-record.ts::trackRecordPopulation (isShownPick, the two
// dedups with oldest published_at, the cutover floor, the coverage
// denominator); this script calls that same function on the same rows, so
// the replay cannot diverge from the route by construction.
// tests/test_cc_coerenza.py fails if this file stops importing it.
//
// Read-only by construction: it never opens a connection. The Python check
// fetches the rows inside a READ ONLY transaction and pipes them in as JSON on
// stdin, serialised exactly like the route's exec_sql RPC
// (jsonb_agg(row_to_json(t))), so string comparisons on timestamps behave the same.
//
// stdin:  { "route_rows": [...] }   (the route's own WHERE/ORDER/LIMIT)
// stdout: { "headline": {n, won, lost}, "dedup_dropped": n, "honest": {...},
//           "route_rows": n, "finished_rows": n }
import { trackRecordPopulation } from "../../../lib/track-record";

type Row = Parameters<typeof trackRecordPopulation>[0][number];

/** Pure: the numbers the route publishes, from the rows the route reads. */
export function replay(routeRows: Row[]) {
  const p = trackRecordPopulation(routeRows);
  const won = p.headlineRows.filter((r) => r.result === "won").length;
  const lost = p.headlineRows.filter((r) => r.result === "lost").length;
  return {
    headline: { n: won + lost, won, lost },
    dedup_dropped: p.dedupDropped,
    honest: {
      // Same formula as stats.coverage in app/api/v2/history/route.ts.
      finished_shown: p.surfaced.length,
      counted: p.rows.length,
      unresolved: p.surfaced.filter((r) => r.result === "unresolved").length,
      no_result: p.surfaced.filter((r) => r.result == null).length,
      coverage: p.surfaced.length ? Number((p.rows.length / p.surfaced.length).toFixed(3)) : null,
    },
    route_rows: routeRows.length,
    // The coverage denominator is now the route population itself.
    finished_rows: routeRows.length,
  };
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { route_rows: Row[] };
  process.stdout.write(JSON.stringify(replay(input.route_rows)));
}

// Run only as a script (tsx), not when imported by a test.
if (process.argv[1] && /history_replay\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(String(e)); process.exit(1); });
}
