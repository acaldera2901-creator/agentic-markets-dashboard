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


def surface_decision(
    *,
    sport: str,
    friendly: bool,
    confidence: int,
    tournament: str | None = None,
    world_cup: bool = False,
) -> tuple[bool, bool]:
    """Return ``(is_pick, below_threshold)`` for a row.

    ``confidence`` is the picked-outcome probability in whole percent.
    ``is_pick`` and ``below_threshold`` are always exact complements; both are
    returned so callers read intent directly without re-deriving it.
    ``tournament`` matters only for tennis (segment-aware floor); omitted, the
    row resolves to the lower tier = the stricter floor (fail-closed).
    """
    if sport.lower() == "tennis":
        # 10y lab 2026-06-08: tennis confidence IS monotone (the prior "no floor"
        # was a 60-match artifact). Segment-aware floors #TENNIS-SEG-FLOOR-1.
        is_pick = confidence >= tennis_floor_for(tournament)
        return is_pick, not is_pick

    # #WC-SURFACE-FLOOR: floor dedicato SOLO World Cup (knockout equilibrati
    # visibili; il club resta al floor standard — nessun abbassamento globale).
    if world_cup and not friendly:
        is_pick = confidence >= settings.SURFACE_FLOOR_WC
        return is_pick, not is_pick

    floor = settings.SURFACE_FLOOR_FRIENDLY if friendly else settings.SURFACE_FLOOR_FOOTBALL
    is_pick = confidence >= floor
    return is_pick, not is_pick
