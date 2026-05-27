"""
Feature engineering module.

Computes all derived features used by the ensemble models.
Each function is pure (no side effects) and returns a dict of feature values.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional


# ─── motivation_score ─────────────────────────────────────────────────────────

def motivation_score(
    position: int,        # current table position (1 = top)
    total_teams: int,     # number of teams in the league
    matches_remaining: int,
    max_matches: int = 38,
    *,
    title_zone_pct: float = 0.10,    # top X% = title contender
    europe_zone_pct: float = 0.25,   # top 25% = European spots
    relegation_zone_pct: float = 0.20,  # bottom 20% = relegation fight
) -> float:
    """
    Compute motivation score 0-1 based on table position and games remaining.

    Logic:
    - Teams in title/Europe/relegation fights → high motivation (0.7-1.0)
    - Teams with nothing to play for → low motivation (0.1-0.3)
    - Motivation decays if too many/few games remain

    Args:
        position: 1-indexed table position (1 = leader)
        total_teams: total teams in competition
        matches_remaining: games left in season
        max_matches: total matches in full season

    Returns:
        float [0, 1]
    """
    if total_teams == 0 or max_matches == 0:
        return 0.5

    relative_pos = position / total_teams  # 0 = top, 1 = bottom
    season_completion = 1.0 - (matches_remaining / max_matches)

    n_title = max(1, round(total_teams * title_zone_pct))
    n_europe = max(1, round(total_teams * europe_zone_pct))
    n_relegation = round(total_teams * relegation_zone_pct)
    relegation_cutoff = total_teams - n_relegation

    # Base motivation from position
    if position <= n_title:
        base = 0.90
    elif position <= n_europe:
        base = 0.75
    elif position > relegation_cutoff:
        base = 0.80  # relegation fight = high motivation
    else:
        base = 0.30  # mid-table, nothing at stake

    # Urgency multiplier: motivation peaks when season is 60-90% complete
    # and tapers off at very start or at the very end
    urgency = _urgency_curve(season_completion)

    return round(min(base * urgency, 1.0), 3)


def _urgency_curve(season_completion: float) -> float:
    """Bell-ish curve: peaks at ~75% of season, low at start and end."""
    if season_completion < 0.20:
        return 0.60 + season_completion * 2.0   # ramp up
    elif season_completion < 0.85:
        return 1.0                               # peak urgency
    else:
        return max(0.50, 1.0 - (season_completion - 0.85) * 3.0)  # season over


# ─── xg_luck_streak ──────────────────────────────────────────────────────────

def xg_luck_streak(
    xg_per_match: list[float],
    goals_per_match: list[float],
    last_n: int = 5,
) -> Optional[float]:
    """
    xG luck metric = mean(xG - Goals) over last N matches.

    Positive → team has been scoring LESS than expected (due for regression upward).
    Negative → team has been scoring MORE than expected (regression risk downward).

    Args:
        xg_per_match: xG in each recent match (oldest first)
        goals_per_match: actual goals in each recent match
        last_n: number of recent matches to consider

    Returns:
        float or None if insufficient data
    """
    if len(xg_per_match) < 2 or len(goals_per_match) < 2:
        return None

    xs = xg_per_match[-last_n:]
    gs = goals_per_match[-last_n:]
    pairs = list(zip(xs, gs))
    if not pairs:
        return None

    return round(sum(x - g for x, g in pairs) / len(pairs), 3)


# ─── ah_odds_movement ─────────────────────────────────────────────────────────

def ah_odds_movement(
    ah_opening_home: Optional[float],
    ah_current_home: Optional[float],
    ah_opening_away: Optional[float],
    ah_current_away: Optional[float],
) -> Optional[float]:
    """
    Asian Handicap odds movement = change in home-side odds since opening.

    Positive → market moved TOWARD home (home is being backed).
    Negative → market moved TOWARD away (away is being backed).

    Uses implied probability shift rather than raw odds change to be
    scale-invariant across different line levels.

    Returns:
        float or None if missing data
    """
    if None in (ah_opening_home, ah_current_home):
        return None

    def to_prob(odds: float) -> float:
        return 1.0 / odds if odds > 0 else 0.5

    open_prob = to_prob(ah_opening_home)
    curr_prob = to_prob(ah_current_home)
    return round(curr_prob - open_prob, 4)


# ─── referee_foul_rate ───────────────────────────────────────────────────────

def normalize_referee_foul_rate(raw_fouls_per_game: Optional[float]) -> Optional[float]:
    """
    Normalize referee foul rate to [0, 1].

    Historical range: ~18-35 fouls/game across European leagues.
    Below 22 → lenient (low), above 30 → strict (high).

    Returns:
        float in [0, 1] or None if no data
    """
    if raw_fouls_per_game is None:
        return None
    mn, mx = 18.0, 36.0
    return round(min(max((raw_fouls_per_game - mn) / (mx - mn), 0.0), 1.0), 3)


# ─── Feature bundle helper ────────────────────────────────────────────────────

def build_feature_bundle(
    *,
    # Motivation inputs
    home_position: Optional[int] = None,
    away_position: Optional[int] = None,
    total_teams: int = 20,
    matches_remaining: int = 19,
    max_matches: int = 38,
    # xG luck inputs
    home_xg_history: Optional[list[float]] = None,
    home_goals_history: Optional[list[float]] = None,
    away_xg_history: Optional[list[float]] = None,
    away_goals_history: Optional[list[float]] = None,
    # AH movement inputs
    ah_opening_home: Optional[float] = None,
    ah_current_home: Optional[float] = None,
    ah_opening_away: Optional[float] = None,
    ah_current_away: Optional[float] = None,
    # Referee
    referee_fouls_per_game: Optional[float] = None,
) -> dict:
    """Compute all derived features and return as dict."""
    bundle: dict = {}

    if home_position is not None:
        bundle["motivation_home"] = motivation_score(
            home_position, total_teams, matches_remaining, max_matches
        )
    if away_position is not None:
        bundle["motivation_away"] = motivation_score(
            away_position, total_teams, matches_remaining, max_matches
        )

    if home_xg_history and home_goals_history:
        bundle["xg_luck_home"] = xg_luck_streak(home_xg_history, home_goals_history)
    if away_xg_history and away_goals_history:
        bundle["xg_luck_away"] = xg_luck_streak(away_xg_history, away_goals_history)

    ah_mov = ah_odds_movement(ah_opening_home, ah_current_home, ah_opening_away, ah_current_away)
    if ah_mov is not None:
        bundle["ah_odds_movement"] = ah_mov

    ref_rate = normalize_referee_foul_rate(referee_fouls_per_game)
    if ref_rate is not None:
        bundle["referee_foul_rate"] = ref_rate

    return bundle
