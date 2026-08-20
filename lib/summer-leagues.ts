// Summer-calendar leagues (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).
//
// The five leagues quality-gated by the walk-forward lab
// (am-lab/lab_summer_leagues.py, 2017-2026 held-out: W1 package ~52 picks/yr
// @74.6%). They cannot ride the football-data.org path (not on the free tier),
// so this module provides the two missing inputs for the EXISTING club
// pipeline — everything downstream (temperature calibration, market blend
// α=0.3, per-league surfacing floor, match_predictions insert, unified sync)
// is untouched:
//
//   1. HISTORY for the Poisson model: shipped snapshot
//      data/summer_leagues/history.json — last 365 days of results from the
//      lab CSVs with team names REMAPPED to ESPN displayNames at generation
//      time (am-lab/gen_summer_history.py). Refreshed by the lab (weekly is
//      plenty: the served blend is 70% market).
//   2. FIXTURES: ESPN scoreboard (slugs in core/espn_soccer_client.py, probed
//      26/26 on 2026-06-12). Veikkausliiga is the exception — ESPN's fin.1
//      payload is empty, so VEI fixtures derive from The Odds API /events
//      (quota-free endpoint; those are exactly the matches that can be served
//      anyway, since the blend needs odds).
//
// Settlement: app/api/cron/settle reads ESPN scoreboards (espn:* ids) and The
// Odds API /scores (oddsapi:* ids) for these leagues — see the cron route.
//
// QUALITY-FIRST (Michele): a fixture whose teams cannot be matched to the
// model is SKIPPED, never guessed (fail-closed).

import historySnapshot from "@/data/summer_leagues/history.json";
import type { MatchResult } from "@/lib/poisson-model";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import type { FDMatch } from "@/lib/football-data";
import { ESPN_HEADERS, ESPN_SITE_API } from "@/lib/espn";

// Display names drive the per-league surfacing floor (lib/surfacing-gate.ts
// CLUB_FLOOR_OVERRIDES matches on these): keep them aligned with the lab table.
export const SUMMER_LEAGUES: Record<string, string> = {
  ELI: "Eliteserien",
  ALL: "Allsvenskan",
  VEI: "Veikkausliiga",
  LOI: "League of Ireland",
  CSL: "Chinese Super League",
  // #SERIE-B-1 — Italian Serie B is NOT a summer league; it rides this same
  // "off-free-tier" machinery (snapshot history + ESPN fixtures + Odds API 1X2)
  // because it is not on football-data.org's free tier. The walk-forward lab
  // (scripts/lab_serie_b.py, I2 closing odds 2022-2026) does NOT clear the ~70%
  // quality bar for default surfacing: 68.2% @floor56 and per-season unstable
  // (52-58% in 2 of 4 seasons). Wired COVERAGE-first with a precautionary
  // surfacing floor of 65 (lib/surfacing-gate.ts CLUB_FLOOR_OVERRIDES) — only
  // the strongest favourites surface as picks; the rest show calibrated
  // probabilities without a pick. Revisit the floor on live settled data (as the
  // summer leagues were, #MINORS-TIGHTEN). Off-season until ~late Aug 2026.
  SB: "Serie B",
  // #EURO-MINORS-0726 — European autumn-spring leagues IN SEASON from mid/late
  // July: they fill the club-football gap with leagues close to home. Same
  // off-free-tier machinery; quality-gated by the walk-forward lab
  // (am-lab/lab_euro_minors_0726.py, same recipe/bar as the summer five,
  // 8,489 test matches 2017-2026). Pick-floors per league where numbers hold
  // >=70% (lib/surfacing-gate.ts), coverage-first elsewhere:
  //   AUT Jul-Aug 80.6% @60 (74.3% @65 full-year, n=284) -> floor 60
  //   SWZ Jul-Aug 71.7% @56 (71.8% @65 full-year)        -> floor 65
  //   DNK 64.8% @56 and DEGRADES with the floor           -> precautionary 70
  //   POL 61.3% @56, thin above                           -> precautionary 70
  AUT: "Austrian Bundesliga",
  DNK: "Danish Superliga",
  POL: "Ekstraklasa",
  SWZ: "Swiss Super League",
  // #EURO-MINORS batch 2 — il Belgio riparte il 2026-08-07, quindi entra nella
  // finestra di pubblicazione (10 giorni) il 28/07. Sta nel formato PRINCIPALE
  // di football-data.co.uk (B1), non nel "new leagues": lo snapshot lo genera
  // am-lab/gen_batch2_history.py riusando core/football_data_uk.
  // Barra superata con margine (am-lab/lab_batch2_0727.py, replica fedele del
  // serving su 2.013 partite 2019-2026): 80.7% @65 sull'anno, 72.4% @60, e
  // robusta per stagione (>=69% a floor 60 in 6 stagioni su 7). Ma AGOSTO — le
  // prime giornate, cioe' quelle che vanno live subito — e' il pezzo debole:
  // 62.5% @60 contro 70.0% @65. Per questo il floor parte a 65 e non a 60:
  // si stringe dove i dati sono deboli e si rivede su dati live (#MINORS-TIGHTEN).
  // NB copertura in rampa: alla 1a giornata 3 squadre su 18 (Kortrijk, Lommel,
  // Waasland-Beveren) sono neopromosse senza storico in massima serie -> le loro
  // partite sono SALTATE, non indovinate, finche' lo snapshot non le assorbe.
  // 2. Bundesliga (D2) sondata nello stesso lab e SCARTATA: 64.3% @56,
  // instabile per stagione, e 5 squadre su 18 senza storico alla ripartenza.
  BEL: "Belgian Pro League",
  // #COVERAGE-0812-L1 — 16 campionati, tutti sulla stessa macchina off-free-tier.
  // Storico e slug ESPN sondati uno per uno il 12/08/2026 (vedi la tabella nella
  // spec). Entrano COVERAGE-FIRST: floor 70 in lib/surfacing-gate.ts, nessun lab
  // ancora fatto, quindi solo i favoriti piu' forti possono emergere come pick.
  //
  // I NOMI SONO ASCII DI PROPOSITO. surfaceFloorFor fa `name.toLowerCase()` e poi
  // `includes(keyword)`, senza piegare i diacritici: "Süper Lig" NON contiene
  // "super lig" e il floor cadrebbe in silenzio su quello di default (56),
  // pubblicando pick su una lega mai validata. Stessa ragione per "Brasileirao"
  // (che evita anche la sottostringa "serie a"/"serie b" del Modena/Monza cluster).
  EFLC: "Championship",
  EL1: "League One",
  EL2: "League Two",
  SCO: "Scottish Premiership",
  BL2: "2. Bundesliga",
  FL2: "Ligue 2",
  PD2: "Segunda Division",
  NED: "Eredivisie",
  POR: "Primeira Liga",
  TUR: "Turkish Super Lig",
  GRE: "Super League Greece",
  ARG: "Liga Profesional",
  BRA: "Brasileirao",
  MEX: "Liga MX",
  MLS: "MLS",
  // JPN scartata: fonte storica ferma alla stagione 2025 (vedi generatore).
};

export function isSummerLeague(code: string): boolean {
  return code in SUMMER_LEAGUES;
}

// Esportata da #COVERAGE-0812-L1: /api/live la usa per interrogare solo gli
// scoreboard delle leghe che hanno un fixture in finestra (vedi liveSlugsInWindow).
export const ESPN_SLUGS: Record<string, string> = {
  ELI: "nor.1",
  ALL: "swe.1",
  VEI: "fin.1", // empty on ESPN — kept for completeness; fixtures come from odds events
  LOI: "irl.1",
  CSL: "chn.1",
  SB: "ita.2", // Serie B (#SERIE-B-1) — probed: 20 teams on ESPN 2026-07-23
  // #EURO-MINORS-0726 — probed 2026-07-26: 12 teams each. POL has NO ESPN
  // league (payload empty) -> fixtures ride the Odds API /events fallback,
  // exactly like VEI.
  AUT: "aut.1",
  DNK: "den.1",
  SWZ: "sui.1",
  BEL: "bel.1", // batch 2 — sondato 2026-07-27: 18 squadre, 1a giornata gia' a calendario
  // #COVERAGE-0812-L1 — sondati il 12/08/2026 via site.web.api (site.api rende 403
  // fuori dalle reti residenziali, #HISTORY-REFRESH-CI-0812): tutti con rosa piena.
  EFLC: "eng.2",  // 24 squadre
  EL1: "eng.3",   // 24
  EL2: "eng.4",   // 24
  SCO: "sco.1",   // 12
  BL2: "ger.2",   // 18
  FL2: "fra.2",   // 18
  PD2: "esp.2",   // 22
  NED: "ned.1",   // 18
  POR: "por.1",   // 18
  TUR: "tur.1",   // 18
  GRE: "gre.1",   // 14
  ARG: "arg.1",   // 30
  BRA: "bra.1",   // 20
  MEX: "mex.1",   // 18
  MLS: "usa.1",   // 30
};

// #LIVE-LEAGUES-0627: slug ESPN da interrogare anche nel feed LIVE del board
// (/api/live), così le card delle leghe estive mostrano punteggio in-play/finale
// come la World Cup. fin.1 (VEI) escluso: ESPN lo restituisce vuoto e The Odds
// API non va chiamata nel polling 60s (quota). Le card estive hanno match_id
// `espn:<id>` → match diretto col live scoreboard.
export const SUMMER_LIVE_ESPN_SLUGS: string[] = ["nor.1", "swe.1", "irl.1", "chn.1", "ita.2", "aut.1", "den.1", "sui.1", "bel.1"];

// #ODDS-KEYS-PARITY-0730: exported because lib/odds-api.ts derives its own
// SPORT_KEYS from this map. The two used to be maintained by hand and drifted:
// the euro-minors batch added AUT/DNK/POL/SWZ/BEL here but not in odds-api.ts,
// so fetchOdds() returned [] for them and the quality-first gate (summer league
// without real odds -> not served) silently dropped EVERY fixture of the new
// leagues. Single source of truth from now on.
export const ODDS_SPORT_KEYS: Record<string, string> = {
  ELI: "soccer_norway_eliteserien",
  ALL: "soccer_sweden_allsvenskan",
  VEI: "soccer_finland_veikkausliiga",
  LOI: "soccer_league_of_ireland",
  CSL: "soccer_china_superleague",
  SB: "soccer_italy_serie_b", // Serie B (#SERIE-B-1) — verified active on The Odds API
  // #EURO-MINORS-0726 — all four verified active on The Odds API 2026-07-26.
  AUT: "soccer_austria_bundesliga",
  DNK: "soccer_denmark_superliga",
  POL: "soccer_poland_ekstraklasa",
  SWZ: "soccer_switzerland_superleague",
  BEL: "soccer_belgium_first_div", // batch 2 — verificata attiva 2026-07-27
  // #COVERAGE-0812-L1 — tutte e 16 verificate ATTIVE su The Odds API il
  // 12/08/2026 (endpoint /v4/sports, che non consuma quota). La quota non e' un
  // vincolo: 4.956.609 richieste rimanenti su 43.391 usate, cioe' lo 0,9%.
  EFLC: "soccer_efl_champ",
  EL1: "soccer_england_league1",
  EL2: "soccer_england_league2",
  SCO: "soccer_spl",
  BL2: "soccer_germany_bundesliga2",
  FL2: "soccer_france_ligue_two",
  PD2: "soccer_spain_segunda_division",
  NED: "soccer_netherlands_eredivisie",
  POR: "soccer_portugal_primeira_liga",
  TUR: "soccer_turkey_super_league",
  GRE: "soccer_greece_super_league",
  ARG: "soccer_argentina_primera_division",
  BRA: "soccer_brazil_campeonato",
  MEX: "soccer_mexico_ligamx",
  MLS: "soccer_usa_mls",
};

type SnapshotShape = {
  generated_at: string;
  leagues: Record<
    string,
    { espn_slug: string; matches: Array<{ homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; date: string }> }
  >;
};

// ── 1. History (shipped snapshot) ────────────────────────────────────────────

export function fetchSummerHistory(code: string): MatchResult[] {
  const league = (historySnapshot as SnapshotShape).leagues[code];
  if (!league) return [];
  return league.matches.map((m) => ({
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
  }));
}

export function summerSnapshotAgeDays(): number {
  const gen = new Date((historySnapshot as SnapshotShape).generated_at);
  return Math.floor((Date.now() - gen.getTime()) / 86_400_000);
}

// ── Team-name matching (fixtures source ↔ model names) ──────────────────────
// The snapshot ships ESPN displayNames where ESPN knows the team, original CSV
// names otherwise (e.g. all of VEI). Sources may still drift ("HJK Helsinki"
// vs "HJK", "Bodø/Glimt" vs "Bodo/Glimt") → normalized containment + token
// overlap; no match → null (caller skips the fixture, fail-closed).

const NOISE = new Set(["fc", "if", "ik", "bk", "afc", "sk", "fk", "ff", "aif", "cf", "sc", "club", "cd"]);

// #TEAM-NAME-FOLD-0727 — lettere latine che NFKD NON scompone. NFKD separa
// base+segno combinante ("é" → "e"+◌́), ma ł/ø/đ/æ/ß sono glifi a sé: restano
// intatti e il nome non si normalizza mai verso la sua versione ASCII. Effetto
// sul matcher, che è fail-closed: "Wisła Płock" (Odds API) e "Wisla Plock"
// (snapshot) contano come due squadre diverse → la fixture viene SALTATA in
// silenzio. Verificato 2026-07-27 sulle fixture reali: 2 partite POL su 4 perse
// così, e "Widzew Łódź" passava solo per fortuna (overlap 0.50 esatto sul token
// "widzew"). È la stessa classe di problema che gli alias danesi manuali
// (København/Sønderjyske) tamponavano a mano in gen_euro_minors_history.py:
// piegandola qui, il matcher regge da solo su ogni lega.
const STROKE_FOLD: Record<string, string> = {
  "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "th",
  "æ": "ae", "œ": "oe", "ß": "ss", "ı": "i", "ħ": "h", "ŋ": "n", "ŧ": "t",
};

function tokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[łøđðþæœßıħŋŧ]/g, (c) => STROKE_FOLD[c])
    // Punteggiatura interna: "St. Gallen" e "St Gallen" sono la stessa squadra,
    // ma senza questo il token "st." non è "st" e i due nomi condividono solo
    // "gallen". Vale anche per "F.C." → "fc", che così finisce nella NOISE list.
    .replace(/[.'’]/g, "")
    .replace(/[/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w));
}

// #TEAM-MATCH-SAFETY-0727 — la soglia di overlap era 0.50, cioè ESATTAMENTE il
// punteggio di due nomi da due token che ne condividono uno solo. Su una squadra
// ASSENTE dal modello (tipicamente una neopromossa) il fuzzy non restituiva null
// ma la squadra sbagliata, e il board serviva una previsione calcolata sul
// modello di un'altra squadra — cioè l'esatto contrario del contratto
// fail-closed dichiarato in cima al file ("no match → null, never guessed").
// Casi reali verificati il 2026-07-27:
//   "KV Kortrijk"   (neopromossa) → "KV Mechelen"      overlap 0.50
//   "VfL Osnabruck" (neopromossa) → "VfL Bochum"       overlap 0.50
//   "Shanghai Port"               → "Shanghai Shenhua" overlap 0.50
// I prefissi di club che generano la collisione (KV, VfL, SV, Shanghai…) non
// sono nella NOISE list e non possono starci tutti: si alza la barra invece.
// 0.60 lascia passare i match informativi (3 token con 2 in comune = 0.67) e
// taglia il singolo token condiviso su due. In più, se il punteggio migliore è
// pareggiato da un'altra squadra il nome è AMBIGUO e si torna null: meglio una
// partita non servita che una servita col modello di un'altra squadra.
const MIN_OVERLAP = 0.6;

export function matchModelTeam(sourceName: string, modelTeams: Iterable<string>): string | null {
  const src = tokens(sourceName).join(" ");
  if (!src) return null;
  let best: string | null = null;
  let bestScore = 0;
  let tied = false;
  for (const team of modelTeams) {
    const t = tokens(team).join(" ");
    if (!t) continue;
    if (t === src) return team;
    if (t.includes(src) || src.includes(t)) return team;
    const a = new Set(tokens(sourceName));
    const b = new Set(tokens(team));
    let overlap = 0;
    for (const w of a) if (b.has(w)) overlap += 1;
    const score = overlap / Math.max(a.size, b.size);
    if (score > bestScore) {
      bestScore = score;
      best = team;
      tied = false;
    } else if (score === bestScore && score > 0 && team !== best) {
      tied = true;
    }
  }
  if (tied) return null; // ambiguo → fail-closed
  return bestScore >= MIN_OVERLAP ? best : null;
}

// ── 2. Fixtures ──────────────────────────────────────────────────────────────

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchEspnFixtures(code: string): Promise<FDMatch[]> {
  const slug = ESPN_SLUGS[code];
  if (!slug) return [];
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + PREDICTION_WINDOW_DAYS);
  const url =
    `${ESPN_SITE_API}/soccer/${slug}/scoreboard` +
    `?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=200`;
  try {
    const r = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      events?: Array<{
        id: string;
        date: string;
        status?: { type?: { state?: string } };
        competitions?: Array<{
          competitors?: Array<{ homeAway: string; team?: { displayName?: string } }>;
        }>;
      }>;
    };
    const out: FDMatch[] = [];
    for (const ev of data.events ?? []) {
      if (ev.status?.type?.state !== "pre") continue; // fixtures only
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team?.displayName;
      const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team?.displayName;
      if (!home || !away) continue;
      out.push({
        id: `espn:${ev.id}`,
        utcDate: ev.date,
        homeTeam: home,
        awayTeam: away,
        homeGoals: null,
        awayGoals: null,
        status: "SCHEDULED",
        minute: null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// The Odds API /events — quota-free listing of upcoming events. Used as the
// fixtures source where ESPN is empty (VEI) and as a safety net elsewhere.
async function fetchOddsApiEvents(code: string): Promise<FDMatch[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = ODDS_SPORT_KEYS[code];
  if (!apiKey || !sportKey) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const events = (await r.json()) as Array<{
      id: string;
      commence_time: string;
      home_team: string;
      away_team: string;
    }>;
    const horizon = Date.now() + PREDICTION_WINDOW_DAYS * 86_400_000;
    return events
      .filter((e) => {
        const t = Date.parse(e.commence_time);
        return t > Date.now() && t <= horizon;
      })
      .map((e) => ({
        id: `oddsapi:${e.id}`,
        utcDate: e.commence_time,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        homeGoals: null,
        awayGoals: null,
        status: "SCHEDULED",
        minute: null,
      }));
  } catch {
    return [];
  }
}

export async function fetchSummerFixtures(code: string): Promise<FDMatch[]> {
  const espn = await fetchEspnFixtures(code);
  if (espn.length > 0) return espn;
  return fetchOddsApiEvents(code);
}

// ── 3. Finished results for the settlement cron ─────────────────────────────
// Returns finished matches keyed the same way fixtures were keyed (espn:<id> /
// oddsapi:<id>), so the cron can settle match_predictions rows for these
// leagues exactly like the fd.org ones.

export type FinishedMatch = { id: string; homeGoals: number; awayGoals: number };

async function fetchEspnResults(code: string): Promise<FinishedMatch[]> {
  const slug = ESPN_SLUGS[code];
  if (!slug) return [];
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 3);
  const url =
    `${ESPN_SITE_API}/soccer/${slug}/scoreboard` +
    `?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=200`;
  try {
    const r = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      events?: Array<{
        id: string;
        status?: { type?: { completed?: boolean; state?: string } };
        competitions?: Array<{
          competitors?: Array<{ homeAway: string; score?: string }>;
        }>;
      }>;
    };
    const out: FinishedMatch[] = [];
    for (const ev of data.events ?? []) {
      if (!ev.status?.type?.completed) continue;
      const comp = ev.competitions?.[0];
      const h = comp?.competitors?.find((c) => c.homeAway === "home")?.score;
      const a = comp?.competitors?.find((c) => c.homeAway === "away")?.score;
      if (h == null || a == null) continue;
      const hg = Number(h);
      const ag = Number(a);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      out.push({ id: `espn:${ev.id}`, homeGoals: hg, awayGoals: ag });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchOddsApiScores(code: string): Promise<FinishedMatch[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = ODDS_SPORT_KEYS[code];
  if (!apiKey || !sportKey) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/scores?apiKey=${apiKey}&daysFrom=3`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{
      id: string;
      completed: boolean;
      home_team: string;
      away_team: string;
      scores: Array<{ name: string; score: string }> | null;
    }>;
    const out: FinishedMatch[] = [];
    for (const row of rows) {
      if (!row.completed || !row.scores) continue;
      const h = row.scores.find((s) => s.name === row.home_team)?.score;
      const a = row.scores.find((s) => s.name === row.away_team)?.score;
      if (h == null || a == null) continue;
      const hg = Number(h);
      const ag = Number(a);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      out.push({ id: `oddsapi:${row.id}`, homeGoals: hg, awayGoals: ag });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchSummerResults(code: string): Promise<FinishedMatch[]> {
  const [espn, oddsapi] = await Promise.all([
    fetchEspnResults(code),
    fetchOddsApiScores(code),
  ]);
  return [...espn, ...oddsapi];
}
