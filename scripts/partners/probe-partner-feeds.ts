// #V3C-PARTNERS (F7) — prova dal vivo, SOLA LETTURA, da lanciare in locale.
// Legge i feed dei book gated (RollXO, N1 Bet, Wildz, Beazt) con gli stessi
// adapter del board, e misura quante partite del board (SELECT su
// prediction_log/tennis_predictions, nessuna scrittura) trovano una quota.
// NON scrive su DB, NON tocca env: il gate è passato solo a questa chiamata.
//
//   npx tsx --env-file=<file con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY> scripts/partners/probe-partner-feeds.ts [out.json]
//
// Carico: una sweep come quella del board (BetConstruct ≤ 24 GET per book,
// Altenar 2 GET per book, distanziate). Da non mettere in un cron: per quello
// c'è la PROPOSAL docs/v3c-partners-collector-proposal.md.
import { writeFileSync } from "node:fs";
import { PARTNER_FEEDS_ENV, fetchAllPriceBooks } from "@/lib/price-books";
import { footballPairKey, liveFeedRows } from "@/lib/v3c/board";
import { fetchBoardSources, fetchTennisBoardSources } from "@/lib/v3c/queries";
import { tennisPairKey } from "@/lib/v3c/tennis";
import { fuzzyFootballMatch } from "@/lib/v3c/fixture-match";
import { buildBoardResponse } from "@/lib/v3c/board-service";

const GATED = "rollxo,n1bet,wildz,beazt";

async function main() {
  const out = process.argv[2] ?? "/tmp/partner-feeds-probe.json";
  const [football, tennis] = await Promise.all([fetchBoardSources(), fetchTennisBoardSources()]);
  const fKeys = new Map(football.map((s) => [footballPairKey(s), s] as const).filter(([k]) => k));
  const tKeys = new Map(tennis.map((t) => [tennisPairKey(t), t] as const).filter(([k]) => k));

  const t0 = Date.now();
  const boards = await fetchAllPriceBooks(t0, { [PARTNER_FEEDS_ENV]: GATED });
  const fixtures = new Map([...fKeys].map(([k, s]) => [k!, { home: s.home, away: s.away, kickoff: s.kickoff }]));
  const report = boards.map(({ book, map }) => {
    const exact = [...fKeys.keys()].filter((k) => map.has(k!));
    // same join as the board (exact key, + strict name-tolerant join for Altenar)
    const joined = liveFeedRows([{ book, map }], new Set(fixtures.keys()), new Date(t0), fixtures).rows;
    const fHit = exact;
    const fuzzy = [...fixtures].filter(([k]) => !map.has(k)).flatMap(([, f]) => {
      const hit = book.platform === "altenar" ? fuzzyFootballMatch(map, f) : null;
      return hit ? [`${f.home} - ${f.away}  ||  ${hit.fm.homeName} - ${hit.fm.awayName}${hit.swapped ? " (swapped)" : ""}`] : [];
    });
    const tHit = [...tKeys.keys()].filter((k) => map.has(k!));
    const samples = fHit.slice(0, 5).map((k) => {
      const m = map.get(k!)!;
      return { home: m.homeName, away: m.awayName, start: m.startTime, odds: [m.oddsHome, m.oddsDraw, m.oddsAway] };
    });
    return {
      book: book.key, platform: book.platform, fixtures_in_feed: map.size,
      board_football: `${fHit.length}/${fKeys.size}`, board_football_joined: `${joined.length}/${fKeys.size}`,
      fuzzy_joins: fuzzy, board_tennis: `${tHit.length}/${tKeys.size}`, samples,
    };
  });
  // The whole /api/v3/board payload as the preview would build it after the
  // APPROVE — gate set for THIS process only, nothing written anywhere.
  process.env[PARTNER_FEEDS_ENV] = GATED;
  const board = await buildBoardResponse(new Date());
  const nBooks = board.matches.map((m) => new Set(m.outcomes.flatMap((o) => o.book_prices.map((b) => b.bookmaker))).size);
  const histogram = nBooks.reduce<Record<number, number>>((h, n) => ({ ...h, [n]: (h[n] ?? 0) + 1 }), {});
  const example = board.matches.find((m, i) => nBooks[i] >= 5);
  const boardSummary = {
    coverage: board.coverage.with_book_price, tennis_coverage: board.coverage.tennis.with_book_price,
    football_matches_by_book_count: histogram,
    example: example && {
      match: `${example.home} - ${example.away}`, kickoff: example.kickoff,
      outcomes: example.outcomes.map((o) => ({ outcome: o.outcome, best: o.best_price && [o.best_price.bookmaker, o.best_price.price], prices: o.book_prices.map((b) => [b.bookmaker, b.price]) })),
      books: example.books,
    },
  };
  const body = { at: new Date(t0).toISOString(), elapsed_ms: Date.now() - t0, report, board: boardSummary };
  writeFileSync(out, JSON.stringify(body, null, 2));
  for (const r of report) console.log(r.book.padEnd(12), r.platform.padEnd(13), String(r.fixtures_in_feed).padStart(5), "football exact", r.board_football, "joined", r.board_football_joined, "tennis", r.board_tennis);
  console.log("board with gate on:", JSON.stringify(boardSummary.coverage), "football rows by #books:", JSON.stringify(histogram));
  console.log(`→ ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
