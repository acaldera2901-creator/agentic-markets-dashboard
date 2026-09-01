"""
Confidence-surfacing gate (Wave 1, APPROVE Andrea 2026-06-08).

Pure decision function. Decides ONLY whether a prediction is surfaced as a
directional pick or as a "no clear favourite" row. It is **probability-neutral**:
it never touches, returns, or recomputes any probability or confidence score —
the caller keeps serving and logging the exact same numbers. The gate flips a
publish flag, nothing else.

Floors live in config.settings (SURFACE_FLOOR_*), mirrored in lib/surfacing-gate.ts
for the TS club path. Floors are inclusive: confidence >= floor surfaces a pick.

Tennis floors are SEGMENT-AWARE (#TENNIS-SEG-FLOOR-1, lab 2026-06-11): hi tier
(Slam/Masters/1000/Finals/Olympics) keeps 62, lower tiers 64, lower tiers on
grass 66. The tier/grass resolution is keyed on the TOURNAMENT NAME — the same
keyword lists live in lib/surfacing-gate.ts (tennisFloorFor); keep in sync.
"""
from __future__ import annotations

from config.settings import settings

# High-tier tournament keywords (case-insensitive substring). Conservative on
# purpose: only unambiguous names — anything unmatched falls to the LOWER tier,
# i.e. the STRICTER floor (fail-closed). Dubai/Doha excluded (ATP 500 vs
# WTA 1000 share the venue name). Mirror of TENNIS_HI_TIER in surfacing-gate.ts.
TENNIS_HI_TIER = (
    "australian open", "roland garros", "french open", "wimbledon", "us open",
    "atp finals", "wta finals", "olympic",
    "indian wells", "bnp paribas", "miami open", "monte carlo", "monte-carlo",
    "madrid open", "mutua madrid", "italian open", "internazionali",
    "canadian open", "national bank open", "cincinnati", "shanghai",
    "rolex paris", "paris masters", "wuhan", "china open",
    "1000",
)

# Grass-season tournaments OUTSIDE the high tier (Wimbledon is hi). Name-keyed
# (not the surface column) so every consumer resolves the same floor for the
# same row. Mirror of TENNIS_LO_GRASS in surfacing-gate.ts.
TENNIS_LO_GRASS = (
    "halle", "terra wortmann", "queen", "hertogenbosch", "rosmalen",
    "libema", "libéma", "mallorca", "eastbourne", "birmingham", "nottingham",
    "bad homburg", "boss open", "newport", "ilkley", "surbiton",
)


def tennis_floor_for(tournament: str | None) -> int:
    """Segment-aware tennis floor from the tournament name (see module note)."""
    t = (tournament or "").lower()
    if any(k in t for k in TENNIS_HI_TIER):
        return settings.SURFACE_FLOOR_TENNIS
    if any(k in t for k in TENNIS_LO_GRASS):
        return settings.SURFACE_FLOOR_TENNIS_LO_GRASS
    return settings.SURFACE_FLOOR_TENNIS_LO


def tennis_has_market(picked_odds: float | None) -> bool:
    """A usable decimal price on the picked side (#TENNIS-MARKET-GATE-0805).

    Fail-closed: None/NaN/<=1 (a price of 1.0 or less pays nothing and is a feed
    artefact, not a market) -> no market. Mirror of hasTennisMarket in
    lib/surfacing-gate.ts.
    """
    if picked_odds is None:
        return False
    try:
        o = float(picked_odds)
    except (TypeError, ValueError):
        return False
    return o == o and o > 1.0  # o == o rejects NaN


def tennis_surface_decision(
    *,
    confidence: int,
    tournament: str | None = None,
    picked_odds: float | None = None,
) -> tuple[bool, bool, bool]:
    """Return ``(is_pick, below_floor, no_market)`` for a tennis row.

    #TENNIS-MARKET-GATE-0805 — lab 05/08 on LIVE settled rows (01/06-05/08,
    am-lab/REPORT-tennis-noodds-2026-08-05.md): tennis picks WITH a market price
    return 74.9% against a claimed 71.6% (n=183), those WITHOUT return 58.9%
    against a claimed 72.1% (n=270), z=3.51. The no-odds cell is broken at every
    confidence band and WORST at the top (75-79 band: 42.2% actual vs 77.1%
    claimed), so a higher floor selects more of the broken rows instead of fewer
    — which is why the segment-aware floors of June never moved the number.

    ``below_floor`` and ``no_market`` are kept DISTINCT because they mean
    different things to a customer: below floor = the model has no clear
    favourite; no market = it may well have one, we just have no price to check
    it against. Probability-neutral, serving-only — the row keeps its card and
    its probabilities, it just carries no directional pick.

    Football is deliberately NOT subject to this rule (95% without a price on the
    same window, n=20). Mirror of tennisSurfaceDecision in lib/surfacing-gate.ts.
    """
    below_floor = confidence < tennis_floor_for(tournament)
    no_market = not tennis_has_market(picked_odds)
    return (not below_floor and not no_market), below_floor, no_market


def club_floor_for(competition: str | None) -> int:
    """Per-league club floor (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).

    Lowercase substring match on the served competition display name against
    settings.SURFACE_FLOOR_CLUB_OVERRIDES; anything not listed uses the standard
    SURFACE_FLOOR_FOOTBALL. Mirrored in lib/surfacing-gate.ts clubFloorFor —
    keep the keyword lists in sync.
    """
    name = (competition or "").lower()
    for keyword, floor in settings.SURFACE_FLOOR_CLUB_OVERRIDES.items():
        if keyword in name:
            return floor
    return settings.SURFACE_FLOOR_FOOTBALL


def nations_floor_for(league_code: str | None) -> int:
    """Per-competition Nations League floor (#NATIONS-LEAGUE-0826).

    Walk-forward lab am-lab/lab_nations_league_floor.py: UNL 62 (held-out
    68.0%, n=128 — the tier-banded groups make UEFA-NL the weak international
    segment), CNL 56 = standard (held-out 74.3%, n=167). Unknown nations code
    falls to the STRICTER default (fail-closed). Mirror of nationsFloorFor in
    lib/surfacing-gate.ts — keep in sync.
    """
    code = (league_code or "").upper()
    return settings.SURFACE_FLOOR_NATIONS.get(code, settings.SURFACE_FLOOR_NATIONS_DEFAULT)


def surface_decision(
    *,
    sport: str,
    friendly: bool,
    confidence: int,
    tournament: str | None = None,
    world_cup: bool = False,
    nations_league_code: str | None = None,
) -> tuple[bool, bool]:
    """Return ``(is_pick, below_threshold)`` for a row.

    ``confidence`` is the picked-outcome probability in whole percent.
    ``is_pick`` and ``below_threshold`` are always exact complements; both are
    returned so callers read intent directly without re-deriving it.
    ``tournament`` matters only for tennis (segment-aware floor); omitted, the
    row resolves to the lower tier = the stricter floor (fail-closed).
    """
    s = sport.lower()
    if s == "tennis":
        # 10y lab 2026-06-08: tennis confidence IS monotone (the prior "no floor"
        # was a 60-match artifact). Segment-aware floors #TENNIS-SEG-FLOOR-1.
        is_pick = confidence >= tennis_floor_for(tournament)
        return is_pick, not is_pick

    # #NEWSPORTS — rami ESPLICITI per sport: uno sport nuovo non deve poter cadere
    # in silenzio sul floor del calcio (56 su una moneyline a due vie pubblica
    # quasi tutto). Specchio di lib/surfacing-gate.ts, valori in settings.
    # I floor MLB sono quelli della v2.2 (65/72), NON i 62/65 del Gate 1: il loop
    # premium ha misurato la banda 62-65 al 63,4% e il salto a 72.
    if s in ("baseball", "mlb"):
        is_pick = confidence >= settings.SURFACE_FLOOR_BASEBALL
        return is_pick, not is_pick
    if s in ("mma", "ufc"):
        is_pick = confidence >= settings.SURFACE_FLOOR_MMA
        return is_pick, not is_pick

    # #NATIONS-LEAGUE-0826: dedicated per-competition floor. Checked BEFORE the
    # world_cup branch on purpose — the national model path used to treat every
    # non-friendly as World Cup ("world_cup=not is_friendly"), and a Nations
    # League row falling through to SURFACE_FLOOR_WC (26) would publish nearly
    # everything on the weakest international segment.
    if nations_league_code:
        is_pick = confidence >= nations_floor_for(nations_league_code)
        return is_pick, not is_pick

    # #WC-SURFACE-FLOOR: floor dedicato SOLO World Cup (knockout equilibrati
    # visibili; il club resta al floor standard — nessun abbassamento globale).
    if world_cup and not friendly:
        is_pick = confidence >= settings.SURFACE_FLOOR_WC
        return is_pick, not is_pick

    floor = settings.SURFACE_FLOOR_FRIENDLY if friendly else settings.SURFACE_FLOOR_FOOTBALL
    is_pick = confidence >= floor
    return is_pick, not is_pick
