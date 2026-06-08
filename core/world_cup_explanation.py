"""
World Cup paper-prediction explanation + Deep-Analysis enrichment builder.

Turns the real WC data sources into (a) a match-specific ``explanation`` string
and (b) a structured ``enrichment`` JSON payload that the dashboard card renders
as a premium Deep Analysis panel. Pure module: no network, no DB, no clock — the
caller resolves every input (history rows, Poisson probabilities, venue context,
squad/injury info) and passes them in.

Honesty contract (matches the rest of the WC pipeline): every number comes from
a passed-in source. Missing source -> that field is omitted / null, never
fabricated, and the explanation degrades gracefully (fail-soft).
"""
from __future__ import annotations

from typing import Any

from config.settings import settings
from core.world_cup_team_model import recent_form


# P1: altitude is only worth a sentence above this height (sea-level venues add
# nothing). Azteca (~2,240 m) and Akron/Guadalajara (1,566 m) clear it.
_ALTITUDE_RELEVANT_M = 1000


def _form_block(matches: list[dict[str, Any]], canonical_team: str, *, last_n: int = 5) -> dict[str, Any] | None:
    if not matches or not canonical_team:
        return None
    return recent_form(matches, canonical_team, last_n=last_n)


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
    strength = "shade" if gap < 0.5 else ("clearly outscore" if gap >= 0.9 else "edge")
    base = f"{favoured} {strength} the expected-goals picture ({max(lam_h, lam_a):.1f} to {min(lam_h, lam_a):.1f})"
    pick_team = {"HOME": home_team, "AWAY": away_team}.get(pick)
    if pick_team and pick_team != favoured and gap >= 0.15:
        return f"the expected goals actually lean {favoured} ({max(lam_h, lam_a):.1f} to {min(lam_h, lam_a):.1f})"
    return base


def build_wc_enrichment(
    *,
    home_team: str,
    away_team: str,
    canonical_home: str,
    canonical_away: str,
    history: list[dict[str, Any]],
    probs: dict[str, Any],
    venue: dict[str, Any] | None = None,
    squad: dict[str, Any] | None = None,
    market: dict[str, Any] | None = None,
    group: str | None = None,
) -> dict[str, Any]:
    """Structured Deep-Analysis payload for a WC paper row (see module docstring).

    ``probs`` is the output of core.world_cup_probability.national_match_probabilities
    (keys p_team_a/p_team_b/p_draw/lambda_a/lambda_b). ``venue``, ``squad`` and
    ``market`` are optional; missing keys degrade to null/empty, never fabricated.
    """
    form_home = _form_block(history, canonical_home)
    form_away = _form_block(history, canonical_away)

    venue = venue or {}
    squad = squad or {}

    enr: dict[str, Any] = {
        "kind": "world_cup",
        "form_home": form_home,
        "form_away": form_away,
        "venue": {
            "travel_km_home": venue.get("travel_km_home"),
            "travel_km_away": venue.get("travel_km_away"),
            "rest_days_home": venue.get("rest_days_home"),
            "rest_days_away": venue.get("rest_days_away"),
            "tz_shift_home": venue.get("tz_shift_home"),
            "tz_shift_away": venue.get("tz_shift_away"),
            "host_advantage": venue.get("host_advantage"),
            # P1/P2 (msg_mq3ufltj): additive venue context, display-only.
            "altitude_m": venue.get("altitude_m"),
            "altitude_delta_home": venue.get("altitude_delta_home"),
            "altitude_delta_away": venue.get("altitude_delta_away"),
            "indoor": venue.get("indoor"),
            "heat_risk": venue.get("heat_risk"),
        },
        "squad": {
            "injuries_home": list(squad.get("injuries_home") or []),
            "injuries_away": list(squad.get("injuries_away") or []),
            "revealed_home": bool(squad.get("revealed_home", False)),
            "revealed_away": bool(squad.get("revealed_away", False)),
            # Squad Condition Watch ②: XI-value fraction of best-11 + rotation
            # flag, per side. None when no value data (fail-soft, never invented).
            "xi_value_ratio_home": squad.get("xi_value_ratio_home"),
            "xi_value_ratio_away": squad.get("xi_value_ratio_away"),
            "rotation_flag_home": bool(squad.get("rotation_flag_home", False)),
            "rotation_flag_away": bool(squad.get("rotation_flag_away", False)),
        },
        "lambdas": {
            "home": probs.get("lambda_a"),
            "away": probs.get("lambda_b"),
        },
        "matches": {
            "home": probs.get("team_a_matches"),
            "away": probs.get("team_b_matches"),
        },
        "market": market,
        "group": group,
        "model": probs.get("model"),
    }
    return enr


def build_wc_explanation(
    *,
    home_team: str,
    away_team: str,
    enrichment: dict[str, Any],
    probs: dict[str, Any],
    pick: str,
    confidence: int,
    model_label: str = "Our model",  # signature-compatible; no longer surfaced as jargon
    friendly: bool = False,
) -> str:
    """Match-specific WC explanation — human prose, probability-neutral (why v2).

    Promoted 2026-06-08 from the lab rewrite (Michele, scripts/proposed_wc_
    explanation_v2 @ 34e58fb). Changes TEXT ONLY: no probability/lambda/pick
    value is touched. ``pick`` is HOME/DRAW/AWAY; ``confidence`` is the
    picked-outcome probability in whole percent. Sentences are only emitted for
    sources actually present (fail-soft, no fabrication).

    The lead is keyed to confidence via settings (single source of truth):
    ``WHY_STRONG_PICK_CONFIDENCE`` -> "strong pick"; the surfacing floor
    -> "favoured but open"; below the floor -> "no clear favourite". This binds
    the copy to the same floor the surfacing gate uses: ``SURFACE_FLOOR_FRIENDLY``
    when ``friendly`` is set, otherwise ``SURFACE_FLOOR_FOOTBALL`` (resolves the
    lab's hardcoded 55/65 vs the served 56/61, and keeps the lead in step with
    the card flag for international friendlies). Language stays English in Wave 1;
    localization is Wave 2.
    """
    strong_floor = settings.WHY_STRONG_PICK_CONFIDENCE
    favoured_floor = (
        settings.SURFACE_FLOOR_FRIENDLY if friendly else settings.SURFACE_FLOOR_FOOTBALL
    )

    pick_team = {"HOME": home_team, "AWAY": away_team, "DRAW": "a draw"}.get(pick, pick)
    lam_h = (enrichment.get("lambdas") or {}).get("home")
    lam_a = (enrichment.get("lambdas") or {}).get("away")
    xg = _xg_clause(home_team, away_team, pick, lam_h, lam_a)
    fixture = f"{home_team} vs {away_team}"

    if pick == "DRAW":
        lead = f"{fixture} shapes up as a tight, low-margin game — the draw is the call at {confidence}%."
    elif confidence >= strong_floor:
        lead = f"{pick_team} are a strong pick in {fixture} at {confidence}%"
        lead += f" — {xg}." if xg else "."
    elif confidence >= favoured_floor:
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
