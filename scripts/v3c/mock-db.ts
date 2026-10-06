// scripts/v3c/mock-db.ts (#REDESIGN-V3C polish) — un finto Supabase per il dev
// server e i test Playwright LOCALI del redesign, così non toccano MAI il DB di
// produzione (staging e prod condividono lo stesso Supabase).
//
// Risponde solo a POST /rest/v1/rpc/exec_sql (lib/db.ts → dbQuery/dbQueryStrict),
// riconosce le SELECT di lib/v3c/queries.ts per una sottostringa e restituisce
// righe FITTIZIE costruite qui, relative all'ora corrente. Tutto il resto → [].
// Ogni statement che non è una SELECT/WITH viene contato e stampato: a fine
// sessione il contatore deve essere 0 (e comunque non arriva da nessuna parte).
//
// Uso (vedi docs/redesign/polish.md):
//   npx tsx scripts/v3c/mock-db.ts &                       # 127.0.0.1:54399
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 SUPABASE_SERVICE_ROLE_KEY=mock \
//   NEXT_PUBLIC_REDESIGN=1 NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs" npx next dev -p 3123
//
// I nomi sono di squadre/giocatori veri perché il layout va visto con nomi
// veri (lunghezze, accenti); quote, probabilità ed esiti sono INVENTATI.
import { createServer } from "node:http";
import { teamPairKey } from "../../lib/team-pair-key";

const PORT = Number(process.env.MOCK_DB_PORT ?? 54399);
const H = 3_600_000;
const now = Date.now();
const iso = (t: number) => new Date(t).toISOString();

// Generatore deterministico: stessa sessione, stessi numeri su ogni pagina.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

type Fb = {
  id: string; league: string; competition: string; kickoff: number; home: string; away: string;
  odds: [number, number, number]; model: [number, number, number]; sealed: boolean; books: "both" | "tie" | "one" | "none"; history: boolean;
};

const FOOTBALL: Fb[] = [
  ["Serie A", "Inter", "Torino", 2.5, [1.62, 4.1, 5.6], [0.6, 0.23, 0.17], true, "both", true],
  ["Serie A", "Atalanta", "Hellas Verona", 4, [1.48, 4.6, 6.8], [0.58, 0.24, 0.18], true, "tie", true],
  ["Premier League", "Brighton & Hove Albion", "Nottingham Forest", 5.5, [2.05, 3.55, 3.7], [0.5, 0.26, 0.24], true, "both", false],
  ["Premier League", "Manchester United", "Tottenham Hotspur", 7, [2.3, 3.6, 3.0], [0.37, 0.27, 0.36], true, "one", true],
  ["La Liga", "Real Sociedad", "Rayo Vallecano", 8.5, [1.95, 3.4, 4.2], [0.48, 0.28, 0.24], true, "none", false],
  ["Bundesliga", "Borussia Mönchengladbach", "1. FC Union Berlin", 9, [2.2, 3.5, 3.3], [0.43, 0.27, 0.3], false, "both", false],
  ["Ligue 1", "Olympique Lyonnais", "Stade Rennais", 26, [1.88, 3.75, 4.0], [0.46, 0.27, 0.27], true, "both", true],
  ["Serie A", "Fiorentina", "Lazio", 28, [2.45, 3.3, 2.95], [0.33, 0.3, 0.37], true, "both", false],
  ["Eredivisie", "PSV Eindhoven", "AZ Alkmaar", 30, [1.55, 4.5, 5.2], [0.67, 0.19, 0.14], true, "both", true],
  ["Primeira Liga", "Sporting CP", "Vitória de Guimarães", 31.5, [1.35, 5.2, 8.5], [0.7, 0.18, 0.12], true, "one", false],
  ["Championship", "Sheffield Wednesday", "West Bromwich Albion", 50, [2.6, 3.3, 2.75], [0.36, 0.28, 0.36], false, "none", false],
  ["MLS", "Inter Miami CF", "Columbus Crew", 53, [1.9, 3.9, 3.7], [0.47, 0.26, 0.27], true, "both", false],
  // polish-2: modello ≈ mercato → gap −0,04 / +0,04 pp: deve leggersi «±0.0», mai «−0.0»
  ["Serie A", "Bologna", "Genoa", 6.5, [2.0, 3.5, 3.8], [0.4754, 0.2737, 0.2509], true, "both", true],
].map(([competition, home, away, inH, odds, model, sealed, books, history], i) => ({
  id: `oddsapi:mock${String(i + 1).padStart(3, "0")}`,
  league: String(competition), competition: String(competition),
  kickoff: Math.round((now + Number(inH) * H) / (15 * 60_000)) * 15 * 60_000,
  home: String(home), away: String(away),
  odds: odds as [number, number, number], model: model as [number, number, number],
  sealed: Boolean(sealed), books: books as Fb["books"], history: Boolean(history),
}));

const devig = (o: number[]) => { const s = o.reduce((a, x) => a + 1 / x, 0); return o.map((x) => 1 / x / s); };
const blend = (m: number[], mk: number[]) => m.map((x, i) => 0.3 * x + 0.7 * mk[i]);
const r2 = (x: number) => Math.round(x * 100) / 100;

const fbKey = (f: Fb) => teamPairKey("soccer", f.home, f.away, iso(f.kickoff))!;

function boardSources() {
  return FOOTBALL.map((f) => {
    const mk = devig(f.odds);
    const p = blend(f.model, mk);
    return {
      id: f.id, league: f.league, competition: f.competition, kickoff: iso(f.kickoff), home: f.home, away: f.away,
      computed_at: iso(now - 22 * 60_000),
      odds_home: f.odds[0], odds_draw: f.odds[1], odds_away: f.odds[2],
      model_p_home: f.model[0], model_p_draw: f.model[1], model_p_away: f.model[2],
      p_home: p[0], p_draw: p[1], p_away: p[2],
      sealed_at: f.sealed ? iso(f.kickoff - 30 * H) : null,
    };
  });
}

type Pp = { team_pair_key: string; bookmaker: string; home_name: string; away_name: string; odds_home: number | null; odds_draw: number | null; odds_away: number | null; captured_at: string };

/** Ultima cattura per book (fortuneplay, ybets) — «tie» = stesso prezzo sui due book. */
function latestPrices(): Pp[] {
  const out: Pp[] = [];
  for (const f of FOOTBALL) {
    if (f.books === "none") continue;
    const k = fbKey(f);
    const fp = f.odds.map((o, i) => r2(o * (i === 0 ? 1.03 : 1.01)));
    const yb = f.books === "tie" ? fp : f.odds.map((o, i) => r2(o * (i === 2 ? 1.04 : 0.99)));
    out.push({ team_pair_key: k, bookmaker: "fortuneplay", home_name: f.home, away_name: f.away, odds_home: fp[0], odds_draw: fp[1], odds_away: fp[2], captured_at: iso(now - 38 * 60_000) });
    if (f.books !== "one") out.push({ team_pair_key: k, bookmaker: "ybets", home_name: f.home, away_name: f.away, odds_home: yb[0], odds_draw: yb[1], odds_away: yb[2], captured_at: iso(now - 41 * 60_000) });
  }
  for (const t of TENNIS) {
    if (!t.books) continue;
    const k = tnKey(t);
    out.push({ team_pair_key: k, bookmaker: "fortuneplay", home_name: t.p1, away_name: t.p2, odds_home: r2(t.odds[0] * 1.02), odds_draw: null, odds_away: r2(t.odds[1] * 1.01), captured_at: iso(now - 35 * 60_000) });
  }
  return out;
}

/** Storico per il grafico: una cattura ogni 2 ore per 2 giorni, solo per le partite con history. */
function history(): Pp[] {
  const out: Pp[] = [];
  for (const f of FOOTBALL) {
    if (!f.history) continue;
    const k = fbKey(f);
    for (let t = now - 48 * H; t <= now - 38 * 60_000; t += 2 * H) {
      const drift = 1 + (rnd() - 0.5) * 0.06;
      out.push({ team_pair_key: k, bookmaker: "fortuneplay", home_name: f.home, away_name: f.away, odds_home: r2(f.odds[0] * drift), odds_draw: r2(f.odds[1] * (1 + (rnd() - 0.5) * 0.03)), odds_away: r2(f.odds[2] / drift), captured_at: iso(t) });
    }
  }
  // l'ultima cattura del grafico coincide con il «best» di ora (stessa riga)
  return [...out, ...latestPrices().filter((p) => FOOTBALL.some((f) => f.history && fbKey(f) === p.team_pair_key))];
}

type Tn = { id: string; tournament: string | null; kickoff: number; p1: string; p2: string; odds: [number, number]; elo: [number, number]; mv: string; sealed: boolean; books: boolean };
const TENNIS: Tn[] = [
  ["ATP Shanghai", "Jannik Sinner", "Alexander Zverev", 3, [1.42, 2.9], [0.66, 0.34], "tennis-elo-v4", true, true],
  ["ATP Shanghai", "Carlos Alcaraz", "Holger Rune", 5, [1.3, 3.6], [0.72, 0.28], "tennis-elo-v4", true, true],
  ["WTA Wuhan", "Aryna Sabalenka", "Jasmine Paolini", 6, [1.36, 3.2], [0.69, 0.31], "partner-market-v1", true, true],
  ["WTA Wuhan", "Coco Gauff", "Mirra Andreeva", 24, [1.8, 2.05], [0.53, 0.47], "tennis-elo-v4", false, false],
  // polish-2: in corso da ~2h10 e SENZA torneo («Partner feed») → riga Live senza minuti
  [null, "Daniil Medvedev", "Taylor Fritz", -2.2, [1.7, 2.15], [0.56, 0.44], "tennis-elo-v4", true, true],
].map(([tournament, p1, p2, inH, odds, elo, mv, sealed, books], i) => ({
  id: `tennis:mock${i + 1}`, tournament: tournament == null ? null : String(tournament), kickoff: Math.round((now + Number(inH) * H) / (15 * 60_000)) * 15 * 60_000,
  p1: String(p1), p2: String(p2), odds: odds as [number, number], elo: elo as [number, number], mv: String(mv), sealed: Boolean(sealed), books: Boolean(books),
}));
const tnKey = (t: Tn) => teamPairKey("tennis", t.p1, t.p2, iso(t.kickoff))!;

function tennisSources() {
  return TENNIS.map((t) => {
    const mk = devig(t.odds);
    return {
      id: t.id, tournament: t.tournament, kickoff: iso(t.kickoff), player1: t.p1, player2: t.p2,
      p1: mk[0], p2: mk[1], odds_p1: t.odds[0], odds_p2: t.odds[1], edge: null, model_version: t.mv,
      computed_at: iso(now - 30 * 60_000), odds_bookmaker: "fortuneplay", surfaced_pick: mk[0] >= mk[1] ? t.p1 : t.p2,
      model_p1: t.mv === "partner-market-v1" ? null : t.elo[0], model_p2: t.mv === "partner-market-v1" ? null : t.elo[1],
      model_as_of: iso(now - 40 * 60_000),
      sealed_at: t.sealed ? iso(t.kickoff - 20 * H) : null, sealed_p1: t.sealed ? mk[0] : null, sealed_p2: t.sealed ? mk[1] : null,
      sealed_odds: t.sealed ? t.odds[0] : null, sealed_signal_type: null,
    };
  });
}

// ── registro sigillato: 180 partite di calcio negli ultimi 70 giorni, 8 coppie gemelle ──
const TEAMS = ["Bologna", "Genoa", "Udinese", "Cagliari", "Brentford", "Fulham", "Everton", "Getafe", "Osasuna", "Mainz 05", "Freiburg", "Lens", "Nantes", "Twente", "Braga", "Hull City", "Real Salt Lake", "Feyenoord"];
type Sealed = { source_id: string; home_team: string; away_team: string; competition: string; captured_at: string; commence_time: string; is_paper: boolean; p_home: number; p_draw: number; p_away: number; result: string; outcome: string; final_score: string; market: number[]; odds: number[]; pick: string };
const SEALED: Sealed[] = [];
for (let i = 0; i < 180; i++) {
  const ko = now - (2 + i * 9.1) * H;
  const odds = [r2(1.5 + rnd() * 2.5), r2(3 + rnd()), r2(1.8 + rnd() * 4)];
  const mk = devig(odds);
  const model = mk.map((x) => x * (0.9 + rnd() * 0.2));
  const sm = model.reduce((a, b) => a + b, 0);
  const p = blend(model.map((x) => x / sm), mk);
  const top = p.indexOf(Math.max(...p));
  const u = rnd();
  const outIdx = u < p[0] ? 0 : u < p[0] + p[1] ? 1 : 2;
  const OUT = ["HOME", "DRAW", "AWAY"];
  const h = TEAMS[i % TEAMS.length];
  const a = TEAMS[(i * 7 + 3) % TEAMS.length] === h ? TEAMS[(i + 5) % TEAMS.length] : TEAMS[(i * 7 + 3) % TEAMS.length];
  const hg = outIdx === 0 ? 2 : outIdx === 1 ? 1 : 0;
  const ag = outIdx === 2 ? 2 : outIdx === 1 ? 1 : 0;
  const row: Sealed = {
    source_id: `espn:${700000 + i}`, home_team: h, away_team: a, competition: ["Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1"][i % 5],
    captured_at: iso(ko - 28 * H), commence_time: iso(ko), is_paper: false, p_home: p[0], p_draw: p[1], p_away: p[2],
    result: i === 0 ? "unresolved" : top === outIdx ? "won" : "lost", outcome: i === 0 ? "" : OUT[outIdx], final_score: i === 0 ? "" : `${hg}-${ag}`,
    market: mk, odds, pick: OUT[top],
  };
  SEALED.push(row);
  // la stessa partita sigillata due volte (espn:* + oddsapi:*): il record e le ricevute la contano una volta
  if (i % 22 === 3) SEALED.push({ ...row, source_id: `oddsapi:twin${i}`, captured_at: iso(ko - 20 * H) });
}

function sealedFootball() {
  return SEALED.map((s) => ({
    source_id: s.source_id, home_team: s.home_team, away_team: s.away_team, captured_at: s.captured_at, commence_time: s.commence_time,
    is_paper: s.is_paper, p_home: s.p_home, p_draw: s.p_draw, p_away: s.p_away, result: s.result, outcome: s.outcome || null,
    market_p_home: s.market[0], market_p_draw: s.market[1], market_p_away: s.market[2],
  }));
}

function footballReceipts(sql: string) {
  const m = /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i.exec(sql);
  const limit = m ? Number(m[1]) : 50;
  const offset = m ? Number(m[2]) : 0;
  const excluded = new Set([...sql.matchAll(/'((?:espn|oddsapi):[^']+)'/g)].map((x) => x[1]));
  return [...SEALED]
    .filter((s) => !excluded.has(s.source_id))
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at) || a.source_id.localeCompare(b.source_id))
    .slice(offset, offset + limit)
    .map((s) => ({
      source_table: "match_predictions", source_id: s.source_id, model_version: "football-v4-xg-model", home_team: s.home_team, away_team: s.away_team,
      competition: s.competition, pick: s.pick, p_home: s.p_home, p_draw: s.p_draw, p_away: s.p_away, odds: s.odds[["HOME", "DRAW", "AWAY"].indexOf(s.pick)],
      is_paper: false, captured_at: s.captured_at.replace("Z", "000Z").replace(/\.(\d{3})000Z$/, ".$1000Z"), commence_time: s.commence_time,
      result: s.result, outcome: s.outcome || null, final_score: s.final_score || null, settlement_revision: 1,
      market_p_home: s.market[0], market_p_draw: s.market[1], market_p_away: s.market[2], odds_home: s.odds[0], odds_draw: s.odds[1], odds_away: s.odds[2],
    }));
}

const PLAYERS = ["Taylor Fritz", "Casper Ruud", "Daniil Medvedev", "Tommy Paul", "Iga Swiatek", "Elena Rybakina", "Qinwen Zheng", "Madison Keys"];
const SEALED_TN = Array.from({ length: 40 }, (_, i) => {
  const ko = now - (3 + i * 14) * H;
  const p = 0.5 + rnd() * 0.3;
  const p1 = PLAYERS[i % PLAYERS.length];
  const p2 = PLAYERS[(i + 3) % PLAYERS.length];
  return {
    source_id: `tennis:sealed${i}`, model_version: i % 3 === 0 ? "partner-market-v1" : "tennis-elo-v4", home_team: p1, away_team: p2, pick: p1,
    p, odds: i % 2 === 0 ? r2(1 / p * 0.95) : null, signal_type: null, captured_at: iso(ko - 18 * H), commence_time: iso(ko),
    result: rnd() < p ? "won" : "lost", competition: "ATP Tour", final_score: "6-4 6-3",
  };
});

function sealedDay(sql: string) {
  const m = /commence_time >= '([^']+)'::timestamptz\s+AND l\.commence_time <  '([^']+)'/.exec(sql);
  if (!m) return [];
  const [from, to] = [Date.parse(m[1]), Date.parse(m[2])];
  const fb = SEALED.filter((s) => s.source_id.startsWith("espn:") && Date.parse(s.commence_time) >= from && Date.parse(s.commence_time) < to).map((s) => ({
    sport: "football", home_team: s.home_team, away_team: s.away_team, competition: s.competition, league: s.competition, pick: s.pick,
    confidence: Math.max(s.p_home, s.p_draw, s.p_away), p_home: s.p_home, p_draw: s.p_draw, p_away: s.p_away,
    commence_time: s.commence_time, captured_at: s.captured_at, is_paper: false, result: s.result, outcome: s.outcome || null, final_score: s.final_score || null,
  }));
  const tn = SEALED_TN.filter((s) => Date.parse(s.commence_time) >= from && Date.parse(s.commence_time) < to).map((s) => ({
    sport: "tennis", home_team: s.home_team, away_team: s.away_team, competition: s.competition, league: null, pick: s.pick, confidence: s.p,
    p_home: s.p, p_draw: null, p_away: 1 - s.p, commence_time: s.commence_time, captured_at: s.captured_at, is_paper: false, result: s.result, outcome: null, final_score: s.final_score,
  }));
  return [...fb, ...tn];
}

function keysIn(sql: string): Set<string> {
  return new Set([...sql.matchAll(/'(\d{4}-\d{2}-\d{2}:[^']+)'/g)].map((x) => x[1]));
}

let writes = 0;
function answer(sql: string): unknown[] {
  const s = sql.trim();
  if (!/^(select|with)\b/i.test(s)) {
    writes += 1;
    console.warn(`[mock-db] NON-SELECT statement #${writes} (ignored, nothing is written anywhere):`, s.slice(0, 120));
    return [];
  }
  if (s.startsWith("SELECT l.source_id, l.home_team, l.away_team, l.captured_at, l.commence_time, s.result, s.outcome")) return sealedFootball(); // fetchTwinDroppedIds
  if (s.includes("FROM blog_posts")) {
    const posts = [
      { slug: "mock-serie-a-weekend-prices", title: "Serie A weekend: where the prices moved most", description: "Three matches where the market moved before kick-off, and what the sealed estimate said.", featured_image_url: null, pub_date: iso(now - 20 * H), published_at: iso(now - 19 * H) },
      { slug: "mock-tennis-asian-swing", title: "The Asian swing in tennis: reading a two-way market", description: "Margin, implied probability and why a 1.30 favourite is not a sure thing.", featured_image_url: null, pub_date: iso(now - 70 * H), published_at: iso(now - 69 * H) },
      { slug: "mock-what-margin-means", title: "What the bookmaker margin really costs you", description: "A worked example with three prices and the calculator.", featured_image_url: null, pub_date: iso(now - 150 * H), published_at: iso(now - 150 * H) },
    ];
    const slug = /slug = '([^']+)'/.exec(s)?.[1];
    if (slug) {
      const p = posts.find((x) => x.slug === slug);
      return p ? [{ ...p, content_html: "<p>Fictitious article body for the local layout check. Prices, margins and estimates here are invented.</p><h2>The market</h2><p>The market price is the odds turned into a percentage, margin removed.</p><p>Our estimate sits next to it, 70% market and 30% model.</p>" }] : [];
    }
    return posts;
  }
  if (s.includes("JOIN u ON u.source_id = pl.match_id")) return boardSources();
  if (s.includes("JOIN tennis_predictions tp")) return tennisSources();
  if (s.includes("GROUP BY 1 ORDER BY 1") && s.includes("unified_predictions")) return [];
  if (s.includes("DISTINCT ON (team_pair_key, bookmaker)")) { const k = keysIn(s); return latestPrices().filter((p) => k.has(p.team_pair_key)); }
  if (s.includes("FROM partner_price_history") && s.includes("team_pair_key IN")) { const k = keysIn(s); return history().filter((p) => k.has(p.team_pair_key)); }
  if (s.includes("FROM partner_price_history WHERE team_pair_key =")) { const k = keysIn(s); return history().filter((p) => k.has(p.team_pair_key)); }
  if (s.includes("FROM ah_odds_history")) return [];
  if (s.includes("FROM prediction_log WHERE match_id =")) {
    const id = /match_id = '([^']+)'/.exec(s)?.[1];
    const f = FOOTBALL.find((x) => x.id === id);
    if (f) return [{ home: f.home, away: f.away, kickoff: iso(f.kickoff) }];
    const old = SEALED.find((x) => x.source_id === id);
    return old ? [{ home: old.home_team, away: old.away_team, kickoff: old.commence_time }] : [];
  }
  if (s.includes("FROM tennis_predictions WHERE match_id =")) {
    const id = /match_id = '([^']+)'/.exec(s)?.[1];
    const t = TENNIS.find((x) => x.id === id);
    if (id === "tennis:offboard1") return [{ home: "Ben Shelton", away: "Tommy Paul", kickoff: iso(now - 30 * H) }]; // polish-2: fuori board, senza torneo
    return t ? [{ home: t.p1, away: t.p2, kickoff: iso(t.kickoff) }] : [];
  }
  if (s.includes("l.commence_time >=") && s.includes("pick_settlement_current")) return sealedDay(s);
  if (s.includes("market_p_home, pl.market_p_draw, pl.market_p_away\n") || (s.includes("LEFT JOIN LATERAL") && s.includes("l.is_backfill = FALSE") && !s.includes("LIMIT $") && !/LIMIT\s+\d+\s+OFFSET/i.test(s) && s.includes("m.market_p_home"))) return sealedFootball();
  if (/LIMIT\s+\d+\s+OFFSET/i.test(s) && s.includes("m.market_p_home")) return footballReceipts(s);
  if (/LIMIT\s+\d+\s+OFFSET/i.test(s) && s.includes("l.sport = 'tennis'")) {
    const m = /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i.exec(s)!;
    return [...SEALED_TN].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).slice(Number(m[2]), Number(m[2]) + Number(m[1]))
      .map((r) => ({ ...r, source_table: "tennis_predictions", p_home: r.p, p_away: 1 - r.p, settlement_revision: 1 }));
  }
  if (s.includes("l.sport = 'tennis'") && s.includes("l.confidence AS p")) return SEALED_TN;
  if (s.includes("correction_reason AS reason FROM pick_settlement c")) return [{ reason: "late_result" }, { reason: "score_fix" }];
  if (s.includes("c.correction_reason AS reason") && s.includes("ORDER BY c.settled_at DESC")) {
    const a = SEALED[5];
    const b = SEALED[11];
    return [
      { sport: "football", home_team: a.home_team, away_team: a.away_team, commence_time: a.commence_time, settlement_revision: 2, settled_at: iso(now - 30 * H), before: "unresolved", after: a.result, before_score: null, after_score: a.final_score, reason: "late_result" },
      { sport: "football", home_team: b.home_team, away_team: b.away_team, commence_time: b.commence_time, settlement_revision: 2, settled_at: iso(now - 80 * H), before: "lost", after: b.result, before_score: "1-1", after_score: b.final_score, reason: "score_fix" },
    ];
  }
  return [];
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let rows: unknown[] = [];
    if (req.method === "POST" && req.url?.startsWith("/rest/v1/rpc/exec_sql")) {
      try {
        rows = answer(String(JSON.parse(body).query ?? ""));
      } catch (e) {
        console.error("[mock-db] bad body", String(e));
      }
    } else if (req.method !== "GET" && req.method !== "HEAD") {
      writes += 1;
      console.warn(`[mock-db] ${req.method} ${req.url} (#${writes}) ignored`);
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(rows));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`[mock-db] fake Supabase on http://127.0.0.1:${PORT} — fictitious rows, no production access`));

process.on("SIGTERM", () => { console.log(`[mock-db] stop · non-SELECT statements seen: ${writes}`); process.exit(0); });
