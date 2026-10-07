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
  /** fixdata: no market stored (prediction_log odds null → «model only») */
  noMarket?: boolean;
  /** fixdata: minutes since the last prediction_log snapshot (a rescheduled twin stops being refreshed) */
  computedAgoMin?: number;
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

// v3c-final: MOCK_BOARD_BULK=N aggiunge N partite di calcio FITTIZIE sui prossimi 7 giorni (metà con
// storico) per misurare il peso di /predictions a scala reale (~435 righe). Senza la variabile: nulla cambia.
{
  const BULK = Number(process.env.MOCK_BOARD_BULK ?? 0);
  const CLUBS = ["Bologna", "Genoa", "Udinese", "Cagliari", "Brentford", "Fulham", "Everton", "Getafe", "Osasuna", "Mainz 05", "Freiburg", "Lens", "Nantes", "Twente", "Braga", "Hull City", "Real Salt Lake", "Feyenoord", "Wolverhampton Wanderers", "Deportivo Alavés", "Borussia Dortmund", "Olympique de Marseille"];
  const LEAGUES = ["Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1", "Eredivisie", "Championship", "MLS"];
  for (let i = 0; i < BULK; i++) {
    const kickoff = Math.round((now + (1 + (i * 167) / BULK) * H) / (15 * 60_000)) * 15 * 60_000;
    const home = CLUBS[i % CLUBS.length];
    const away = CLUBS[(i * 5 + 7) % CLUBS.length] === home ? CLUBS[(i + 3) % CLUBS.length] : CLUBS[(i * 5 + 7) % CLUBS.length];
    const odds: [number, number, number] = [r2(1.4 + (i % 9) * 0.25), r2(3.1 + (i % 5) * 0.2), r2(1.9 + (i % 7) * 0.45)];
    const mk = devig(odds);
    FOOTBALL.push({
      id: `oddsapi:bulk${String(i + 1).padStart(4, "0")}`, league: LEAGUES[i % LEAGUES.length], competition: LEAGUES[i % LEAGUES.length], kickoff, home, away, odds,
      model: [mk[0] + 0.02, mk[1] - 0.01, mk[2] - 0.01], sealed: i % 3 !== 0, books: i % 4 === 3 ? "none" : "both", history: i % 2 === 0,
    });
  }
}

// fixdata (#REDESIGN-V3C fixdata): MOCK_FIXDATA=1 adds the QA cases of v3c-final3 — FICTITIOUS numbers shaped on the
// real rows: an outlier > 25 pp (Cercle–Anderlecht, model 84% vs market 27%), one 15–25 pp, a match started 40 min ago
// with book prices (no live score), the same match twice (rescheduled: the stale twin 3 days old), a top-league match
// without market (Liverpool–Man City «model only»), and a top-league / ATP row later than lesser ones (relevance order).
if (process.env.MOCK_FIXDATA === "1") {
  const q = (inH: number) => Math.round((now + inH * H) / (15 * 60_000)) * 15 * 60_000;
  const add = (x: Omit<Fb, "league"> & { league?: string }) => FOOTBALL.push({ league: x.competition, ...x });
  add({ id: "oddsapi:fx-outlier25", competition: "Belgian Pro League", kickoff: q(3), home: "Cercle Brugge KSV", away: "RSC Anderlecht", odds: [3.6, 3.5, 2.05], model: [0.84, 0.08, 0.08], sealed: true, books: "both", history: false });
  add({ id: "oddsapi:fx-outlier18", competition: "Eredivisie", kickoff: q(3.5), home: "Ajax", away: "NEC Nijmegen", odds: [1.4, 4.8, 6.8], model: [0.48, 0.28, 0.24], sealed: true, books: "both", history: false });
  add({ id: "oddsapi:fx-started", competition: "Eredivisie", kickoff: q(-0.75), home: "Feyenoord", away: "FC Twente", odds: [1.7, 3.9, 4.6], model: [0.56, 0.24, 0.2], sealed: true, books: "both", history: false });
  add({ id: "oddsapi:fx-dup-live", competition: "League of Ireland", kickoff: q(6), home: "Shamrock Rovers", away: "Drogheda United", odds: [1.45, 4.7, 8.2], model: [0.66, 0.2, 0.14], sealed: true, books: "both", history: false });
  add({ id: "oddsapi:fx-dup-stale", competition: "League of Ireland", kickoff: q(30), home: "Shamrock Rovers", away: "Drogheda United", odds: [1.48, 4.45, 6.21], model: [0.63, 0.21, 0.16], sealed: false, books: "none", history: false, computedAgoMin: 3 * 24 * 60 });
  add({ id: "560598", competition: "Premier League", kickoff: q(26), home: "Liverpool FC", away: "Manchester City FC", odds: [2.4, 3.6, 2.9], model: [0.42, 0.25, 0.33], sealed: true, books: "none", history: false, noMarket: true });
  add({ id: "560593", competition: "Premier League", kickoff: q(5), home: "Arsenal FC", away: "Leeds United FC", odds: [1.36, 5.0, 8.0], model: [0.7, 0.18, 0.12], sealed: true, books: "both", history: false });
}

const fbKey = (f: Fb) => teamPairKey("soccer", f.home, f.away, iso(f.kickoff))!;

function boardSources() {
  return FOOTBALL.map((f) => {
    const mk = devig(f.odds);
    const p = f.noMarket ? f.model : blend(f.model, mk);
    return {
      id: f.id, league: f.league, competition: f.competition, kickoff: iso(f.kickoff), home: f.home, away: f.away,
      computed_at: iso(now - (f.computedAgoMin ?? 22) * 60_000),
      odds_home: f.noMarket ? null : f.odds[0], odds_draw: f.noMarket ? null : f.odds[1], odds_away: f.noMarket ? null : f.odds[2],
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
  // fidelity: storico anche per due partite di tennis (tape della board)
  for (const t of TENNIS.slice(0, 2)) {
    const k = tnKey(t);
    for (let x = now - 40 * H; x <= now - 36 * 60_000; x += 3 * H) {
      const drift = 1 + (rnd() - 0.5) * 0.05;
      out.push({ team_pair_key: k, bookmaker: "fortuneplay", home_name: t.p1, away_name: t.p2, odds_home: r2(t.odds[0] * 1.02 * drift), odds_draw: null, odds_away: r2(t.odds[1] * 1.01 / drift), captured_at: iso(x) });
    }
  }
  // l'ultima cattura del grafico coincide con il «best» di ora (stessa riga)
  return [...out, ...latestPrices().filter((p) => FOOTBALL.some((f) => f.history && fbKey(f) === p.team_pair_key) || TENNIS.slice(0, 2).some((t) => tnKey(t) === p.team_pair_key))];
}

type Tn = { id: string; tournament: string | null; kickoff: number; p1: string; p2: string; odds: [number, number]; elo: [number, number]; mv: string; sealed: boolean; books: boolean;
  /** tennis2: minutes before now of the pre-start Elo snapshot (default 40); partner_tournament behind «Partner feed» */
  eloAgeMin?: number; partnerTournament?: string };
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
// tennis2: every kind of tennis row the board must handle. Gauff–Andreeva's Elo is 7 h old (→ Market only);
// Alcaraz–Rune's Elo is 33 pp off the market (→ estimate shown, gap hidden). The partner feed serves
// Sinner–Zverev a second time (→ deduped), plus a Challenger (Market only), a doubles and a padel row (→ off the board).
TENNIS[0].elo = [0.74, 0.26];
TENNIS[1].elo = [0.99, 0.01];
TENNIS[3].eloAgeMin = 7 * 60;
TENNIS.push(
  { id: "tennis:partner:dup-sinner-zverev", tournament: "Partner feed", partnerTournament: "ATP Masters Shanghai - Hard", kickoff: TENNIS[0].kickoff - 4 * H, p1: "Alexander Zverev", p2: "Jannik Sinner", odds: [2.85, 1.44], elo: [0, 0], mv: "partner-market-v1", sealed: false, books: false },
  { id: "tennis:partner:braga", tournament: "Partner feed", partnerTournament: "ATP Challenger Braga - Clay", kickoff: Math.round((now + 7 * H) / (15 * 60_000)) * 15 * 60_000, p1: "Jaime Faria", p2: "Gonçalo Oliveira", odds: [1.55, 2.4], elo: [0, 0], mv: "partner-market-v1", sealed: false, books: true },
  { id: "tennis:partner:doubles", tournament: "Partner feed", partnerTournament: "WTA Wuhan - Hard (Doubles)", kickoff: Math.round((now + 8 * H) / (15 * 60_000)) * 15 * 60_000, p1: "Sara Errani/Jasmine Paolini", p2: "Coco Gauff/Jessica Pegula", odds: [1.9, 1.9], elo: [0, 0], mv: "partner-market-v1", sealed: false, books: false },
  { id: "tennis:partner:padel", tournament: "Partner feed", partnerTournament: "Padel Tour Dusseldorf", kickoff: Math.round((now + 9 * H) / (15 * 60_000)) * 15 * 60_000, p1: "Federico Chingotto/Alejandro Galan", p2: "Javier Garrido/Juan Ignacio De Pascual", odds: [1.3, 3.4], elo: [0, 0], mv: "partner-market-v1", sealed: false, books: false },
);
const tnKey = (t: Tn) => teamPairKey("tennis", t.p1, t.p2, iso(t.kickoff))!;

// livescores (#V3C-LIVESCORES): MOCK_LIVE=1 adds two football matches (one in play, one just finished) and one
// tennis match in play, plus FICTITIOUS ESPN-shaped scoreboards under /espn — the dev server reads them with
// V3C_LIVE_ESPN_BASE=http://127.0.0.1:54399/espn. Scores and minutes are INVENTED; no player is named.
// Medvedev–Fritz (already in play above) has no scoreboard on purpose: the board must say «score n/a».
// Without the variable nothing changes for the other e2e runs.
const MOCK_LIVE = process.env.MOCK_LIVE === "1";
const kick5 = (inH: number) => Math.round((now + inH * H) / (5 * 60_000)) * 5 * 60_000;
if (MOCK_LIVE) {
  FOOTBALL.push(
    { id: "oddsapi:live001", league: "Serie A", competition: "Serie A", kickoff: kick5(-1.2), home: "Juventus", away: "Napoli", odds: [2.3, 3.2, 3.2], model: [0.4, 0.28, 0.32], sealed: true, books: "both", history: false },
    { id: "oddsapi:live002", league: "Premier League", competition: "Premier League", kickoff: kick5(-2.1), home: "Arsenal", away: "Chelsea", odds: [1.9, 3.6, 4.1], model: [0.5, 0.26, 0.24], sealed: true, books: "one", history: false },
  );
  // live2 (#V3C-LIVE2): one row only The Odds API covers (Ekstraklasa: no ESPN scoreboard), one ESPN misses that
  // API-Football has (with a minute), one no source covers (→ «Kick-off · time», never a number). INVENTED scores.
  FOOTBALL.push(
    { id: "oddsapi:00000000000000000000000000c0ffee", league: "POL", competition: "Ekstraklasa", kickoff: kick5(-0.9), home: "Lech Poznan", away: "Legia Warsaw", odds: [2.1, 3.4, 3.3], model: [0.44, 0.27, 0.29], sealed: true, books: "one", history: false },
    { id: "oddsapi:00000000000000000000000000beef01", league: "NED", competition: "Eredivisie", kickoff: kick5(-0.7), home: "Ajax", away: "PSV", odds: [2.6, 3.5, 2.6], model: [0.37, 0.26, 0.37], sealed: true, books: "one", history: false },
    { id: "live-nosource-1", league: "JPN", competition: "J1 League", kickoff: kick5(-0.5), home: "Kashima Antlers", away: "Urawa Reds", odds: [2.2, 3.3, 3.2], model: [0.42, 0.28, 0.3], sealed: true, books: "one", history: false },
  );
  TENNIS.push({ id: "tennis:espn:990001:ben-shelton:lorenzo-musetti", tournament: "ATP Shanghai", kickoff: kick5(-1.0), p1: "Lorenzo Musetti", p2: "Ben Shelton", odds: [1.85, 1.95], elo: [0.52, 0.48], mv: "tennis-elo-v4", sealed: true, books: true });
}

/** The rows GET /api/v3/live reads (lib/v3c/live-service.server.ts → fetchLiveRows), same window. */
function liveRows() {
  const inWindow = (k: number) => k > now - 180 * 60_000 && k < now + 15 * 60_000;
  return [
    ...FOOTBALL.filter((f) => inWindow(f.kickoff)).map((f) => ({ source_id: f.id, source_table: "match_predictions", league: f.league, starts_at: iso(f.kickoff), home_team: f.home, away_team: f.away })),
    ...TENNIS.filter((t) => inWindow(t.kickoff)).map((t) => ({ source_id: t.id, source_table: "tennis_predictions", league: t.tournament ?? "Partner feed", starts_at: iso(t.kickoff), home_team: t.p1, away_team: t.p2 })),
  ];
}

const team = (id: string, name: string) => ({ id, displayName: name });
const goal = (min: string, teamId: string, extra: Record<string, boolean> = {}) => ({ clock: { displayValue: min }, team: { id: teamId }, scoringPlay: true, redCard: false, ownGoal: false, penaltyKick: false, shootout: false, athletesInvolved: [], ...extra });

/** Fictitious ESPN scoreboards for the MOCK_LIVE rows only. */
function espnMock(path: string): unknown {
  if (!MOCK_LIVE) return { events: [] };
  if (path.startsWith("/espn/soccer/ita.1/")) {
    const f = FOOTBALL.find((x) => x.id === "oddsapi:live001")!;
    const el = Math.floor((Date.now() - f.kickoff) / 60_000);
    const minute = el > 60 ? Math.min(90, el - 15) : Math.min(45, el);
    return { events: [{ id: "880001", date: iso(f.kickoff), status: { displayClock: `${minute}'`, type: { name: "STATUS_SECOND_HALF", state: "in", completed: false } },
      competitions: [{ competitors: [{ homeAway: "home", score: "2", team: team("111", "Juventus") }, { homeAway: "away", score: "1", team: team("114", "Napoli") }],
        details: [goal("12'", "111"), goal("38'", "114", { penaltyKick: true }), goal("51'", "111")] }] }] };
  }
  if (path.startsWith("/espn/soccer/eng.1/")) {
    const f = FOOTBALL.find((x) => x.id === "oddsapi:live002")!;
    return { events: [{ id: "880002", date: iso(f.kickoff), status: { displayClock: "90'+5'", type: { name: "STATUS_FULL_TIME", state: "post", completed: true } },
      competitions: [{ competitors: [{ homeAway: "home", score: "2", team: team("359", "Arsenal") }, { homeAway: "away", score: "2", team: team("363", "Chelsea") }],
        details: [goal("9'", "363"), goal("27'", "359"), { ...goal("70'", "363"), scoringPlay: false, redCard: true }, goal("81'", "359", { ownGoal: true }), goal("88'", "363")] }] }] };
  }
  if (path.startsWith("/espn/tennis/atp/")) {
    const t = TENNIS.find((x) => x.id.startsWith("tennis:espn:990001"))!;
    return { events: [{ id: "9901", name: "Rolex Shanghai Masters", groupings: [{ grouping: { displayName: "Men's Singles" }, competitions: [{ id: "990001", date: iso(t.kickoff),
      status: { type: { name: "STATUS_IN_PROGRESS", state: "in", completed: false } },
      competitors: [
        { homeAway: "away", athlete: { displayName: "Ben Shelton" }, possession: false, linescores: [{ value: 6 }, { value: 6, tiebreak: 3 }] },
        { homeAway: "home", athlete: { displayName: "Lorenzo Musetti" }, possession: true, linescores: [{ value: 4 }, { value: 6, tiebreak: 5 }] },
      ] }] }] }] };
  }
  return { events: [] };
}

/** live2: a fictitious The Odds API /scores for the Ekstraklasa row (no minute: the source has none). */
function oddsMock(path: string): unknown {
  if (!MOCK_LIVE || !path.startsWith("/odds/sports/soccer_poland_ekstraklasa/scores")) return [];
  const f = FOOTBALL.find((x) => x.id === "oddsapi:00000000000000000000000000c0ffee")!;
  return [{ id: "00000000000000000000000000c0ffee", commence_time: iso(f.kickoff), completed: false, home_team: "Lech Poznań", away_team: "Legia Warszawa",
    scores: [{ name: "Lech Poznań", score: "1" }, { name: "Legia Warszawa", score: "0" }], last_update: new Date(Date.now() - 40_000).toISOString() }];
}

/** live2: a fictitious API-Football `live=all` with the Eredivisie row in play. */
function apifMock(path: string): unknown {
  if (!MOCK_LIVE || !path.startsWith("/apif/fixtures")) return { errors: [], response: [] };
  const f = FOOTBALL.find((x) => x.id === "oddsapi:00000000000000000000000000beef01")!;
  const el = Math.max(1, Math.min(45, Math.floor((Date.now() - f.kickoff) / 60_000)));
  return { errors: [], results: 1, response: [{ fixture: { id: 990101, date: iso(f.kickoff), status: { short: "1H", elapsed: el, extra: null } },
    league: { name: "Eredivisie", country: "Netherlands" }, teams: { home: { id: 194, name: "Ajax" }, away: { id: 197, name: "PSV Eindhoven" } },
    goals: { home: 0, away: 1 }, score: { penalty: { home: null, away: null } },
    events: [{ time: { elapsed: Math.max(1, el - 3), extra: null }, team: { id: 197 }, player: { name: null }, type: "Goal", detail: "Normal Goal" }] }] };
}

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
      partner_tournament: t.partnerTournament ?? null,
      elo_p1: t.mv === "partner-market-v1" ? null : t.elo[0], elo_p2: t.mv === "partner-market-v1" ? null : t.elo[1],
      elo_as_of: t.mv === "partner-market-v1" ? null : iso(Math.min(now - (t.eloAgeMin ?? 40) * 60_000, t.kickoff - 30 * 60_000)),
      elo_home: t.mv === "partner-market-v1" ? null : t.p1,
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

// final2: il grafico settimanale del record. pick_ledger.league è un codice (PL, PD, SA, BL1, FL1 = i cinque
// grandi); le due settimane UTC prima della scorsa sono una sosta (solo League One), e la settimana in corso
// ha 3 partite iniziate senza esito («in attesa») e 4 ancora da giocare. Solo la query del record le vede.
const LEAGUE_CODE: Record<string, string> = { "Serie A": "SA", "Premier League": "PL", "La Liga": "PD", Bundesliga: "BL1", "Ligue 1": "FL1" };
const DAY = 24 * H;
const weekStart = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY; };
const THIS_WEEK = weekStart(now);
const inBreak = (t: number) => { const w = weekStart(t); return w === THIS_WEEK - 14 * DAY || w === THIS_WEEK - 21 * DAY; };
const OPEN_THIS_WEEK = [
  ...[3, 5, 8].map((h) => now - h * H).filter((t) => t >= THIS_WEEK),
  ...[20, 44, 68, 92].map((h) => now + h * H).filter((t) => t < THIS_WEEK + 7 * DAY),
].map((ko, i) => ({ source_id: `espn:open${i}`, home_team: TEAMS[i], away_team: TEAMS[i + 6], league: "SA", captured_at: iso(ko - 20 * H), commence_time: iso(ko), is_paper: false, p_home: 0.45, p_draw: 0.28, p_away: 0.27, result: null, outcome: null, market_p_home: 0.44, market_p_draw: 0.29, market_p_away: 0.27 }));

function sealedFootball(withOpen = false) {
  return [...SEALED.map((s) => ({
    source_id: s.source_id, home_team: s.home_team, away_team: s.away_team,
    league: inBreak(Date.parse(s.commence_time)) ? "EL1" : LEAGUE_CODE[s.competition] ?? null,
    captured_at: s.captured_at, commence_time: s.commence_time,
    is_paper: s.is_paper, p_home: s.p_home, p_draw: s.p_draw, p_away: s.p_away, result: s.result, outcome: s.outcome || null,
    market_p_home: s.market[0], market_p_draw: s.market[1], market_p_away: s.market[2],
  })), ...(withOpen ? OPEN_THIS_WEEK : [])];
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
    market_p_home: s.market[0], market_p_draw: s.market[1], market_p_away: s.market[2],
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

// newswatch: INVENTED notes (not FotMob text), teams from the mock board so the links show.
function newsState() {
  const mode = process.env.MOCK_NEWS ?? "ok";
  const ran = mode === "stale" ? now - 3 * H : now - 4 * 60_000;
  return [{ enabled: mode !== "paused", last_run_at: iso(ran), last_error: null, source_status: "ok" }];
}
function newsItems() {
  const n = (i: number, mins: number, source: string, teams: string[], en: [string, string], it: [string, string]) => ({
    guid_hash: `mockhash${i}`, source, source_url: `https://www.fotmob.com/news/mock-${i}`, published_at: iso(now - mins * 60_000),
    rewritten_en: { title: en[0], body: en[1] }, rewritten_it: { title: it[0], body: it[1] }, teams, rewrite_model: "mock · prompt v3", rewritten_at: iso(now - mins * 60_000 + 120_000),
  });
  return [
    n(1, 12, "FotMob", ["Inter"], ["Inter striker back in full training", "The club said he completed the whole session on Tuesday."], ["L’attaccante dell’Inter torna in gruppo", "Il club ha detto che ha svolto tutta la seduta martedì."]),
    n(2, 47, "SI via FotMob", ["Manchester United", "Tottenham Hotspur"], ["Manchester United name squad for Tottenham trip", "Two academy players travel with the first team."], ["Il Manchester United convoca per la trasferta col Tottenham", "Due giovani del vivaio partono con la prima squadra."]),
    n(3, 95, "The Analyst via FotMob", [], ["Goals per game reach a ten-year high", "The figure covers the first six rounds of the season."], ["Gol a partita ai massimi da dieci anni", "Il dato riguarda le prime sei giornate della stagione."]),
    n(4, 180, "FotMob", ["PSV Eindhoven"], ["PSV confirm a muscle injury for their captain", "He is expected to miss the next two league matches."], ["Il PSV conferma un problema muscolare per il capitano", "Dovrebbe saltare le prossime due partite di campionato."]),
  ];
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
  // newswatch: the two tables the news watcher writes. MOCK_NEWS=ok (default) | empty | paused | stale.
  if (s.includes("FROM news_state")) return newsState();
  if (s.includes("FROM news_items")) return process.env.MOCK_NEWS === "empty" ? [] : newsItems();
  if (s.startsWith("SELECT source_id, source_table, league, starts_at, home_team, away_team")) return liveRows();
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
  if (s.includes("market_p_home, pl.market_p_draw, pl.market_p_away\n") || (s.includes("LEFT JOIN LATERAL") && s.includes("l.is_backfill = FALSE") && !s.includes("LIMIT $") && !/LIMIT\s+\d+\s+OFFSET/i.test(s) && s.includes("m.market_p_home"))) return sealedFootball(s.includes("l.league"));
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
    if (req.method === "GET" && (req.url?.startsWith("/odds/") || req.url?.startsWith("/apif/"))) {
      res.writeHead(200, { "content-type": "application/json", "x-requests-remaining": "4900000", "x-ratelimit-requests-remaining": "90" });
      res.end(JSON.stringify(req.url.startsWith("/odds/") ? oddsMock(req.url) : apifMock(req.url)));
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/espn/")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(espnMock(req.url)));
      return;
    }
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
    // ui2: MOCK_DB_DELAY_MS=N ritarda le risposte della board (per guardare lo scheletro a occhio). Senza: nulla cambia.
    const delay = /JOIN u ON u.source_id = pl.match_id/.test(String(body)) ? Number(process.env.MOCK_DB_DELAY_MS ?? 0) : 0;
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(rows));
    }, delay);
  });
}).listen(PORT, "127.0.0.1", () => console.log(`[mock-db] fake Supabase on http://127.0.0.1:${PORT} — fictitious rows, no production access`));

process.on("SIGTERM", () => { console.log(`[mock-db] stop · non-SELECT statements seen: ${writes}`); process.exit(0); });
