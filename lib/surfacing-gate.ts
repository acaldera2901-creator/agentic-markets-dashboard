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
// International friendlies floor (heavy rotation → noisier). Mirror of
// config/settings.py SURFACE_FLOOR_FRIENDLY (61).
export const SURFACE_FLOOR_FRIENDLY = 61;
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
export const CLUB_FLOOR_OVERRIDES: ReadonlyArray<readonly [string, number]> = [
  ["allsvenskan", 60],         // SWE — lug-ago 72.6% @60
  ["league of ireland", 60],   // LOI — lug-ago 70.2% @60
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
  if ((sport ?? "").toLowerCase() === "tennis") return tennisFloorFor(competition);
  const name = (competition ?? "").toLowerCase();
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
export function isSurfacedRow(row: {
  sport?: string | null;
  competition?: string | null;
  confidence_score?: number | null;
}): boolean {
  const c = row.confidence_score;
  if (c == null) return false;
  return c >= surfaceFloorFor(row.sport, row.competition);
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
