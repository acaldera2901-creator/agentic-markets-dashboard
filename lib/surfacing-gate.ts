// Confidence-surfacing gate — TS mirror of core/surfacing_gate.py (Wave 1,
// APPROVE Andrea 2026-06-08).
//
// SINGLE SOURCE OF TRUTH: config/settings.py SURFACE_FLOOR_FOOTBALL (56). This
// module mirrors only the club-football floor: the TS predictions route serves
// domestic club leagues, while World Cup and international friendlies are served
// by the Python national path (which reads the floors from settings directly).
// Keep this constant in sync with settings.py — tests/surfacing-gate.test.ts
// pins the value.
//
// PROBABILITY-NEUTRAL: this decides only whether a row is surfaced as a
// directional pick. It never touches p_home/p_draw/p_away or confidence_score.

export const SURFACE_FLOOR_FOOTBALL = 56;
// International friendlies floor (heavy rotation → noisier). #MINORS-TIGHTEN
// 07/07: 61→66 on live evidence (54.5% on 33 settled). Mirror of
// config/settings.py SURFACE_FLOOR_FRIENDLY (66).
export const SURFACE_FLOOR_FRIENDLY = 66;
// Tennis floors are SEGMENT-AWARE (#TENNIS-SEG-FLOOR-1, lab 2026-06-11,
// 19,790 held-out matches 2023+): at a uniform 62 the high tiers hold
// 73-77% while lower tiers sit at 69-70% — and the June grass swing
// (250s/WTA minors on grass) is the weakest cell. Keeping 62 on the high
// tier and raising the lower tiers lifts the published hit-rate 72.1%→72.9%
// and the lo-grass cell 69.4%→73.8% for −6.5% volume. Mirror of
// config/settings.py SURFACE_FLOOR_TENNIS / _LO / _LO_GRASS.
export const SURFACE_FLOOR_TENNIS = 62; // hi tier: Slam / Masters / 1000 / Finals / Olympics
export const SURFACE_FLOOR_TENNIS_LO = 64; // lower tiers (250/500/WTA minors)
export const SURFACE_FLOOR_TENNIS_LO_GRASS = 66; // lower tiers on grass (June swing)

// ── Sport nuovi (#NEWSPORTS, lab am-lab/nuovi-sport) ────────────────────────
// In entrambi la probabilità servita è il MERCATO devigato: il modello alimenta
// il why e il gate di tier, non la probabilità. L'edge è selettività, come per
// il calcio — nessuno di questi due batte la linea, e non lo diciamo.
//
// MLB — floor allineati alla v2.2 (loop premium 14/07, TRAIN 2011-17 + una sola
// run sul TEST 2018-21 con config congelata): standard 65 → 68,3% su n=641,
// premium 72 → 76,8% su n=95, consistenza TRAIN→TEST quasi perfetta (77,0→76,8).
// ⚠️ NON sono i 62/65 del Gate 1: il loop ha misurato che la banda 62-65 vale
// 63,4%, cioè zavorra, e che a 72 il win-rate salta. Il branch #NEWSPORTS
// originale portava ancora i valori vecchi (#NEWSPORTS-FLOORS-0801).
export const SURFACE_FLOOR_BASEBALL = 65;
export const SURFACE_FLOOR_BASEBALL_PREMIUM = 72;
// UFC — Gate 1 (TEST 2021-23, 1.061 fight): standard 70 → 81,4% su n=296,
// premium 75 → 86,5% su n=170. Il favourite-longshot bias è persistente (i
// grandi favoriti rendono PIÙ dell'implied), per questo il floor è più alto che
// in MLB. Riserva dichiarata nell'audit: le quote archiviate del dataset sono
// probabilmente early/soft, quindi dal vivo è attesa una compressione di qualche
// punto — è lo shadow su quote vere l'arbitro, non il backtest.
export const SURFACE_FLOOR_MMA = 70;
export const SURFACE_FLOOR_MMA_PREMIUM = 75;
// #WC-SURFACE-FLOOR (APPROVE Andrea + Michele 07/07): dedicated LOW floor for
// the World Cup ONLY (68.5% live on 92 settled — the product's strong suit;
// balanced knockouts must surface). Club stays at 56. Mirror of settings.py.
export const SURFACE_FLOOR_WC = 26;

// High-tier tournament keywords (case-insensitive substring). Conservative on
// purpose: only unambiguous names — anything unmatched falls to the LOWER tier,
// i.e. the STRICTER floor (fail-closed). Dubai/Doha are excluded (ATP 500 vs
// WTA 1000 share the venue name).
const TENNIS_HI_TIER = [
  // Grand Slams
  "australian open", "roland garros", "french open", "wimbledon", "us open",
  // Tour finals + Olympics
  "atp finals", "wta finals", "olympic",
  // Masters 1000 venues (+ WTA 1000 sharing them)
  "indian wells", "bnp paribas", "miami open", "monte carlo", "monte-carlo",
  "madrid open", "mutua madrid", "italian open", "internazionali",
  "canadian open", "national bank open", "cincinnati", "shanghai",
  "rolex paris", "paris masters", "wuhan", "china open",
  // explicit tier tag when the feed carries it
  "1000",
];

// Grass-season tournaments OUTSIDE the high tier (Wimbledon is hi). The served
// pipeline infers `surface` from the tournament name, so keying the floor on
// the name keeps the board route, the unified sync and the history metric
// (isSurfacedRow, which has no surface column) in exact agreement.
const TENNIS_LO_GRASS = [
  "halle", "terra wortmann", "queen", "hertogenbosch", "rosmalen",
  "libema", "libéma", "mallorca", "eastbourne", "birmingham", "nottingham",
  "bad homburg", "boss open", "newport", "ilkley", "surbiton",
];

// Resolve the tennis floor from the tournament name only (see note above:
// name-keyed so serving and the public hit-rate can never disagree on a row).
export function tennisFloorFor(tournament: string | null | undefined): number {
  const t = (tournament ?? "").toLowerCase();
  if (TENNIS_HI_TIER.some((k) => t.includes(k))) return SURFACE_FLOOR_TENNIS;
  if (TENNIS_LO_GRASS.some((k) => t.includes(k))) return SURFACE_FLOOR_TENNIS_LO_GRASS;
  return SURFACE_FLOOR_TENNIS_LO;
}

// Per-league club floor overrides (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12,
// walk-forward lab am-lab/lab_summer_leagues.py 2017-2026 held-out): Allsvenskan
// and League of Ireland only clear the ~70% quality bar at 60; the other summer
// leagues (Eliteserien, Veikkausliiga, China Super League) hold it at the
// standard 56. Lowercase substring match on the served competition name.
// Mirror of config/settings.py SURFACE_FLOOR_CLUB_OVERRIDES — keep in sync.
// #MINORS-TIGHTEN (Michele 07/07, LIVE data: CSL 14.3%, LOI 14.3%, VEI 40%,
// ALL 50% — summer leagues running far below the lab backtests): floors RAISED
// to shut the coin-flip tap on minor leagues. Serving-only: already-published
// history stays (no survivorship). Mirror of settings.py — keep in sync.
export const CLUB_FLOOR_OVERRIDES: ReadonlyArray<readonly [string, number]> = [
  ["allsvenskan", 65],           // live 50% @60
  ["league of ireland", 70],     // live 14.3% @60 -> nearly closed
  ["chinese super league", 70],  // live 14.3% @56 -> nearly closed
  ["veikkausliiga", 65],         // live 40% @56
  ["eliteserien", 60],           // no live sample -> precautionary
  // #SERIE-B-1 (walk-forward lab scripts/lab_serie_b.py, I2 closing odds
  // 2022-2026): the served blend does NOT clear the ~70% bar at 56 (68.2%,
  // 34.5 picks/yr) and is per-season UNSTABLE (52-58% in 2 of 4 seasons; the
  // 74.6% @60 aggregate is carried almost entirely by 2025/26). Set 65 as a
  // precautionary coverage-first floor (matches the ALL/VEI cluster): only the
  // strongest favourites surface as picks, the rest show probabilities without
  // a pick. Revisit on live settled data. Substring "serie b" ≠ "serie a".
  ["serie b", 65],
  // #EURO-MINORS-0726 (walk-forward lab am-lab/lab_euro_minors_0726.py, stessa
  // ricetta/barra delle estive, 8.489 match 2017-2026): floors dove i numeri
  // reggono ≥70%, coverage-first precauzionale altrove. Da rivedere su dati
  // live settled come le estive (#MINORS-TIGHTEN).
  ["austrian bundesliga", 60],   // lug-ago 80.6% @60; anno 74.3% @65 (n=284)
  ["swiss super league", 65],    // lug-ago 71.7% @56; anno 71.8% @65 (n=174)
  ["danish superliga", 70],      // 64.8% @56 e PEGGIORA col floor -> quasi chiusa
  ["ekstraklasa", 70],           // 61.3% @56, sottile sopra -> quasi chiusa
  // #EURO-MINORS batch 2 (am-lab/lab_batch2_0727.py, replica fedele del serving,
  // 2.013 partite 2019-2026). Sull'anno il Belgio reggerebbe gia' a 60 (72.4%),
  // ma ad agosto — le prime giornate, quelle che vanno live subito — 60 scende
  // a 62.5% mentre 65 tiene 70.0%. Si parte stretti e si rivede su dati live.
  ["belgian pro league", 65],    // anno 80.7% @65; agosto 70.0% @65
];

export type SurfaceDecision = {
  isPick: boolean;
  belowFloor: boolean;
};

// Resolve the surfacing floor for a row from its sport + competition. Mirrors
// core/surfacing_gate.py: tennis → segment-aware tennis floor (competition is
// the tournament name); football → friendly floor for international friendlies,
// per-league override where the lab requires a stricter/looser bar, otherwise
// the football floor (WC + competitive club).
export function surfaceFloorFor(
  sport: string | null | undefined,
  competition: string | null | undefined
): number {
  const s = (sport ?? "").toLowerCase();
  if (s === "tennis") return tennisFloorFor(competition);
  // #NEWSPORTS: rami ESPLICITI per sport, così uno sport nuovo non può cadere in
  // silenzio sul floor del calcio — 56 su una moneyline a due vie sarebbe
  // pubblicare quasi tutto. Sport sconosciuto continua a cadere su football:
  // è il caso "non lo conosciamo", non "lo trattiamo come baseball".
  if (s === "baseball" || s === "mlb") return SURFACE_FLOOR_BASEBALL;
  if (s === "mma" || s === "ufc") return SURFACE_FLOOR_MMA;
  const name = (competition ?? "").toLowerCase();
  // #WC-SURFACE-FLOOR: World Cup only — before the friendly/club resolution.
  if (name.includes("world cup")) return SURFACE_FLOOR_WC;
  if (name.includes("friendly")) return SURFACE_FLOOR_FRIENDLY;
  for (const [keyword, floor] of CLUB_FLOOR_OVERRIDES) {
    if (name.includes(keyword)) return floor;
  }
  return SURFACE_FLOOR_FOOTBALL;
}

// Was this settled row actually surfaced as a directional pick? A row whose
// confidence sat below its floor was shown as "no clear favourite" (no pick),
// so it must NOT count toward the public hit-rate. A null confidence cannot be
// proven to have been surfaced → excluded (fail-closed, defensive).
//
// NB: this helper answers "was it shown", i.e. it must describe the rule that
// was live WHEN the row was published — it is deliberately NOT updated with
// #TENNIS-MARKET-GATE-0805 below. Retrofitting today's stricter rule onto rows
// published under the old one would inflate the historical hit-rate by dropping
// picks we DID show (survivorship). Same call made for #MINORS-TIGHTEN 07/07.
export function isSurfacedRow(row: {
  sport?: string | null;
  competition?: string | null;
  confidence_score?: number | null;
}): boolean {
  const c = row.confidence_score;
  if (c == null) return false;
  return c >= surfaceFloorFor(row.sport, row.competition);
}

// ── #TENNIS-MARKET-GATE-0805 ────────────────────────────────────────────────
// Tennis: no market price on the picked side → no directional pick.
//
// Lab 2026-08-05 on LIVE settled rows (am-lab/REPORT-tennis-noodds-2026-08-05.md),
// unified_predictions 01/06 → 05/08, gate applied as served:
//
//              n     claimed   actual
//   with odds  183    71.6%    74.9%   (calibrated, delivers above its claim)
//   no odds    270    72.1%    58.9%   (−13.2, z=3.51, p<0.001)
//
// The no-odds cell is broken at EVERY confidence band and worst at the top:
// the 75-79 band returns 42.2% against a claimed 77.1%. That is why raising the
// floor cannot fix it — a higher floor selects MORE of the broken rows — and why
// the segment-aware floors shipped in June did not move the published number.
// Tournament tier was only a proxy for odds coverage (big events have prices).
//
// No look-ahead: `odds` is written at publication. Verified independently against
// the pre-match snapshots in prediction_log — 252/252 agreement between "market
// present pre-match" and `odds != null` on the settled join.
//
// PROBABILITY-NEUTRAL and serving-only, exactly like the floors: p1/p2 and
// confidence_score are untouched, the match keeps its card and its probabilities,
// it simply carries no directional pick.
//
// FOOTBALL IS DELIBERATELY EXCLUDED: on the same window football without a price
// runs at 95% (n=20). The same rule there would delete the best picks.
export const TENNIS_REQUIRE_MARKET = true;

// A usable decimal price on the picked side. Fail-closed: null/NaN/≤1 (a price of
// 1.0 or less pays nothing and is a feed artefact, not a market) → no market.
export function hasTennisMarket(pickedOdds: number | null | undefined): boolean {
  return (
    typeof pickedOdds === "number" &&
    Number.isFinite(pickedOdds) &&
    pickedOdds > 1
  );
}

export type TennisSurfaceDecision = SurfaceDecision & {
  // Kept SEPARATE from belowFloor on purpose: the two mean different things to a
  // customer. Below floor = "no clear favourite" (the model itself is undecided).
  // No market = the model may well have a favourite, we just have no price to
  // check it against — claiming "no clear favourite" there would be a lie.
  noMarket: boolean;
};

// Single resolution point for the tennis board, the unified sync and the best-bet
// guards, so the three can never disagree on what counts as a surfaced pick.
export function tennisSurfaceDecision(
  confidence: number,
  tournament: string | null | undefined,
  pickedOdds: number | null | undefined
): TennisSurfaceDecision {
  const { belowFloor } = surfaceDecision(confidence, tennisFloorFor(tournament));
  const noMarket = TENNIS_REQUIRE_MARKET && !hasTennisMarket(pickedOdds);
  return { isPick: !belowFloor && !noMarket, belowFloor, noMarket };
}

// `confidence` is the picked-outcome probability in whole percent (max-prob).
// The floor is inclusive: confidence >= floor surfaces a directional pick.
export function surfaceDecision(
  confidence: number,
  floor: number = SURFACE_FLOOR_FOOTBALL
): SurfaceDecision {
  const isPick = confidence >= floor;
  return { isPick, belowFloor: !isPick };
}
