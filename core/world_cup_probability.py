"""
National-team 1X2 probabilities for the World Cup paper tier.

There is no Dixon-Coles model for national teams (no shared league pool), so
this is a deliberately simple Poisson rates model on top of the national
history profiles (core/world_cup_team_model.build_profile):

  lambda_a = attack_a * (defense_b / mu)
  lambda_b = attack_b * (defense_a / mu)

where attack/defense are goals for/against per match and mu is the dataset
average goals per team per match. Venue is neutral by construction (World Cup
group stage on neutral or host ground; no home-advantage term in v1 — the
host_advantage_team context flag is surfaced upstream but intentionally not
priced here until validated).

Output feeds ONLY paper-tier rows (is_paper=true, no odds/edge claims), never
the customer signal path — same honesty rule as the rest of the WC pipeline.
"""
from __future__ import annotations

import math
from typing import Any

from core.world_cup_team_model import build_profile

MAX_GOALS = 10  # Poisson grid truncation; tail mass beyond this is negligible


def _poisson_pmf(lam: float, k: int) -> float:
    return math.exp(-lam) * lam**k / math.factorial(k)


def _dataset_mu(matches: list[dict[str, Any]]) -> float:
    """Average goals per TEAM per match across the dataset (fallback 1.25)."""
    total_goals = 0
    n = 0
    for m in matches:
        try:
            total_goals += int(m["home_goals"]) + int(m["away_goals"])
            n += 1
        except (KeyError, TypeError, ValueError):
            continue
    if n == 0:
        return 1.25
    return max(total_goals / (2 * n), 0.1)


def national_match_probabilities(
    matches: list[dict[str, Any]],
    team_a: str,
    team_b: str,
    *,
    max_goals: int = MAX_GOALS,
) -> dict[str, Any] | None:
    """1X2 probabilities for team_a vs team_b on neutral ground.

    Teams must already be in dataset-canonical spelling (use
    core.world_cup_history.canonical_team_name upstream, exactly like
    matchup_profile). Returns None when either profile is missing —
    fail-closed: no profile, no probabilities, no row.
    """
    a = build_profile(matches, team_a)
    b = build_profile(matches, team_b)
    if not a or not b:
        return None

    mu = _dataset_mu(matches)
    # Multiplicative rates: what A scores scaled by how leaky B is vs average.
    lam_a = max(a.goals_for_per_match * (b.goals_against_per_match / mu), 0.05)
    lam_b = max(b.goals_for_per_match * (a.goals_against_per_match / mu), 0.05)

    p_a = p_draw = p_b = 0.0
    for ga in range(max_goals + 1):
        pa = _poisson_pmf(lam_a, ga)
        for gb in range(max_goals + 1):
            p = pa * _poisson_pmf(lam_b, gb)
            if ga > gb:
                p_a += p
            elif ga == gb:
                p_draw += p
            else:
                p_b += p

    total = p_a + p_draw + p_b
    if total <= 0:
        return None
    return {
        "p_team_a": round(p_a / total, 4),
        "p_draw": round(p_draw / total, 4),
        "p_team_b": round(p_b / total, 4),
        "lambda_a": round(lam_a, 3),
        "lambda_b": round(lam_b, 3),
        "team_a_matches": a.matches,
        "team_b_matches": b.matches,
        "data_quality": round(min(a.data_quality, b.data_quality), 3),
        "model": "wc-poisson-rates-v1",
    }
