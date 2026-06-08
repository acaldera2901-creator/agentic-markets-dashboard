"""
PROPOSED rewrite of core.world_cup_explanation.build_wc_explanation (analysis/spec,
NOT wired). Michele-side, 2026-06-08. Probability-neutral: changes TEXT ONLY — no
probability/lambda/pick value is touched. build_wc_enrichment is reused unchanged.

Goal: keep the honesty contract (every number from a passed-in source, fail-soft,
no fabrication) but turn the robotic stat-block into prose a football fan reads —
technical and neutral, yet human.

Changes vs served build_wc_explanation:
  * LEAD keyed to confidence: strong pick / favoured-but-open / coin-flip. No fake
    "leans" on a flat distribution — below ~55 it says "no clear favourite" (the
    2026-06-08 friendlies finding made human; pairs with the confidence-floor gate).
  * No internal jargon ("Poisson rates", raw "Expected goals: 1.06, 1.08"); the xG
    gap becomes "sharper going forward", and a pick that contradicts the xG is
    acknowledged honestly instead of printed as a naked contradiction.
  * Form W-D-L -> natural language; travel/timezone only when materially large.

Tests: tests/test_wc_explanation_v2.py (9 cases). The served tests
(tests/test_world_cup_explanation.py) must be co-evolved when this is wired, as the
prose contract changes (no more "Expected goals:" / "W-" literals).
"""
from __future__ import annotations

from typing import Any

from core.world_cup_explanation import build_wc_enrichment  # reused unchanged

_ALTITUDE_RELEVANT_M = 1000


def _form_human(team: str, form: dict[str, Any] | None) -> str | None:
    if not form or not form.get("played"):
        return None
    w, d, l, n = form["w"], form["d"], form["l"], form["played"]
    gf, ga = form.get("gf"), form.get("ga")
    if l == 0 and w >= n - 1 and n >= 3:
        run = f"{team} have won {w} of their last {n}" if d else f"{team} have won all {n} of their last games"
    elif l == 0:
        run = f"{team} are unbeaten in their last {n} ({w}W-{d}D)"
    elif w == 0:
        run = f"{team} have failed to win in their last {n} ({d}D-{l}L)"
    elif l >= n - 1:
        run = f"{team} have lost {l} of their last {n}"
    else:
        run = f"{team} come in {w}W-{d}D-{l}L over their last {n}"
    if isinstance(gf, int) and isinstance(ga, int) and n:
        if ga <= n // 3 and ga <= 3:
            run += f", conceding just {ga}"
        elif ga >= n * 2:
            run += f", but leaking {ga} goals in that run"
    return run


def _xg_clause(home_team, away_team, pick, lam_h, lam_a):
    if not (isinstance(lam_h, (int, float)) and isinstance(lam_a, (int, float))):
        return None
    diff = lam_h - lam_a
    favoured = home_team if diff > 0 else away_team
    gap = abs(diff)
    if gap < 0.15:
        return "the expected goals are almost level"
    strength = "edge" if gap < 0.5 else ("clearly outscore" if gap >= 0.9 else "shade")
    base = f"{favoured} {strength} the expected-goals picture ({max(lam_h, lam_a):.1f} to {min(lam_h, lam_a):.1f})"
    pick_team = {"HOME": home_team, "AWAY": away_team}.get(pick)
    if pick_team and pick_team != favoured and gap >= 0.15:
        return f"the expected goals actually lean {favoured} ({max(lam_h, lam_a):.1f} to {min(lam_h, lam_a):.1f})"
    return base


def build_wc_explanation_v2(
    *,
    home_team: str,
    away_team: str,
    enrichment: dict[str, Any],
    probs: dict[str, Any],
    pick: str,
    confidence: int,
    model_label: str = "Our model",  # signature-compatible; no longer surfaced as jargon
) -> str:
    pick_team = {"HOME": home_team, "AWAY": away_team, "DRAW": "a draw"}.get(pick, pick)
    lam_h = (enrichment.get("lambdas") or {}).get("home")
    lam_a = (enrichment.get("lambdas") or {}).get("away")
    xg = _xg_clause(home_team, away_team, pick, lam_h, lam_a)
    fixture = f"{home_team} vs {away_team}"

    if pick == "DRAW":
        lead = f"{fixture} shapes up as a tight, low-margin game — the draw is the call at {confidence}%."
    elif confidence >= 65:
        lead = f"{pick_team} are a strong pick in {fixture} at {confidence}%"
        lead += f" — {xg}." if xg else "."
    elif confidence >= 55:
        lead = f"{pick_team} are favoured in {fixture} ({confidence}%), but it's far from settled"
        lead += f": {xg}." if xg else "."
    else:
        lead = (f"{fixture} is close to a coin-flip — no clear favourite, "
                f"with {pick_team} edging it at just {confidence}%")
        lead += f". In fact, {xg}." if xg else "."

    parts: list[str] = [lead]

    fh = _form_human(home_team, enrichment.get("form_home"))
    fa = _form_human(away_team, enrichment.get("form_away"))
    forms = [p for p in (fh, fa) if p]
    if forms:
        parts.append("; ".join(forms) + ".")

    venue = enrichment.get("venue") or {}
    ctx: list[str] = []
    for team, side in ((home_team, "home"), (away_team, "away")):
        travel = venue.get(f"travel_km_{side}")
        tz = venue.get(f"tz_shift_{side}")
        bits = []
        if isinstance(travel, (int, float)) and travel >= 4000:
            bits.append("a long trip")
        if isinstance(tz, (int, float)) and abs(tz) >= 3:
            bits.append(f"a {abs(int(tz))}-hour body-clock shift")
        if bits:
            ctx.append(f"{team} face {' and '.join(bits)}")
    if ctx:
        parts.append("; ".join(ctx) + ".")
    elif venue.get("host_advantage"):
        parts.append(f"Home support is behind {venue['host_advantage']}.")

    alt = venue.get("altitude_m")
    if isinstance(alt, (int, float)) and alt >= _ALTITUDE_RELEVANT_M:
        deltas = {home_team: venue.get("altitude_delta_home"), away_team: venue.get("altitude_delta_away")}
        big = max(((t, dd) for t, dd in deltas.items() if isinstance(dd, (int, float))),
                  key=lambda kv: kv[1], default=None)
        if big and big[1] >= _ALTITUDE_RELEVANT_M:
            parts.append(f"Played at {int(alt):,}m altitude — {big[0]} climb ~{int(big[1]):,}m above their usual base, and visiting legs tend to go in the closing stages.")
        else:
            parts.append(f"Played at {int(alt):,}m altitude, where visiting legs tend to go late on.")
    if venue.get("heat_risk") is True:
        parts.append("A midday kickoff in summer heat will sap the tempo for both sides.")

    squad = enrichment.get("squad") or {}
    for team, side in ((home_team, "home"), (away_team, "away")):
        ratio = squad.get(f"xi_value_ratio_{side}")
        if squad.get(f"rotation_flag_{side}") and isinstance(ratio, (int, float)):
            parts.append(f"{team} look set to rotate — their likely XI is worth about {round(ratio*100)}% of their strongest side.")
        else:
            inj = [n for n in (squad.get(f"injuries_{side}") or []) if n]
            if inj:
                shown = ", ".join(inj[:3])
                more = f" and {len(inj)-3} others" if len(inj) > 3 else ""
                parts.append(f"{team} are without {shown}{more}.")

    market = enrichment.get("market")
    if isinstance(market, dict):
        mp = {"HOME": market.get("p_home"), "DRAW": market.get("p_draw"), "AWAY": market.get("p_away")}.get(pick)
        if isinstance(mp, (int, float)):
            agree = "much the same" if abs(round(mp*100) - confidence) <= 6 else "it differently"
            parts.append(f"The market sees {agree}, pricing the same outcome at {round(mp*100)}%.")

    parts.append("Paper pick — track record only, no edge claimed. Bet responsibly.")
    return " ".join(parts)
