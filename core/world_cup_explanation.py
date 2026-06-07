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

from core.world_cup_team_model import recent_form


# P1: altitude is only worth a sentence above this height (sea-level venues add
# nothing). Azteca (~2,240 m) and Akron/Guadalajara (1,566 m) clear it.
_ALTITUDE_RELEVANT_M = 1000


def _form_block(matches: list[dict[str, Any]], canonical_team: str, *, last_n: int = 5) -> dict[str, Any] | None:
    if not matches or not canonical_team:
        return None
    return recent_form(matches, canonical_team, last_n=last_n)


def _form_phrase(team: str, form: dict[str, Any] | None) -> str | None:
    if not form or not form.get("played"):
        return None
    return (
        f"{team} go in on {form['w']}W-{form['d']}D-{form['l']}L over their "
        f"last {form['played']} ({form['gf']} scored, {form['ga']} conceded)"
    )


def _venue_phrase(team: str, venue: dict[str, Any] | None, side: str) -> str | None:
    if not venue:
        return None
    travel = venue.get(f"travel_km_{side}")
    rest = venue.get(f"rest_days_{side}")
    tz = venue.get(f"tz_shift_{side}")
    bits: list[str] = []
    if isinstance(travel, (int, float)):
        bits.append(f"{int(travel)} km of travel")
    if isinstance(rest, (int, float)):
        bits.append(f"{int(rest)} days' rest")
    if isinstance(tz, (int, float)) and tz != 0:
        bits.append(f"{abs(int(tz))}h timezone shift")
    if not bits:
        return None
    return f"{team} face " + ", ".join(bits)


def _altitude_phrase(venue: dict[str, Any], home_team: str, away_team: str) -> str | None:
    alt = venue.get("altitude_m")
    if not isinstance(alt, (int, float)) or alt < _ALTITUDE_RELEVANT_M:
        return None
    base = f"Played at {int(alt):,}m altitude"
    # Name the team facing the largest jump from its habitual altitude.
    deltas = {
        home_team: venue.get("altitude_delta_home"),
        away_team: venue.get("altitude_delta_away"),
    }
    big = max(
        ((t, d) for t, d in deltas.items() if isinstance(d, (int, float))),
        key=lambda kv: kv[1],
        default=None,
    )
    if big and big[1] >= _ALTITUDE_RELEVANT_M:
        return (
            f"{base} — {big[0]} climb ~{int(big[1]):,}m above their usual base; "
            "visiting sides typically tire in the closing stages"
        )
    return f"{base} — visiting sides typically tire in the closing stages"


def _heat_phrase(venue: dict[str, Any]) -> str | None:
    if venue.get("heat_risk") is True:
        return "Midday outdoor kickoff in summer heat — fatigue and tempo risk for both sides"
    return None


def _squad_phrase(team: str, injuries: list[str] | None) -> str | None:
    inj = [n for n in (injuries or []) if n]
    if not inj:
        return None
    shown = ", ".join(inj[:3])
    more = f" (+{len(inj) - 3} more)" if len(inj) > 3 else ""
    return f"{team} are without {shown}{more}"


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
    model_label: str = "National Poisson rates model",
) -> str:
    """Match-specific WC explanation (2-4 sentences) from the enrichment payload.

    ``pick`` is HOME/DRAW/AWAY; ``confidence`` is the picked-outcome probability
    in whole percent. Sentences are only emitted for sources actually present.
    """
    pick_label = {"HOME": home_team, "AWAY": away_team, "DRAW": "the draw"}.get(pick, pick)

    # Sentence 1: the model verdict + the lambdas it rests on.
    lam_h = enrichment.get("lambdas", {}).get("home")
    lam_a = enrichment.get("lambdas", {}).get("away")
    lam_txt = ""
    if isinstance(lam_h, (int, float)) and isinstance(lam_a, (int, float)):
        lam_txt = f" Expected goals (Poisson rates): {home_team} {lam_h:.2f}, {away_team} {lam_a:.2f}."
    s1 = (
        f"{model_label} leans {pick_label} at {confidence}% for "
        f"{home_team} vs {away_team}.{lam_txt}"
    )

    parts: list[str] = [s1]

    # Sentence 2: recent form of both sides.
    fh = _form_phrase(home_team, enrichment.get("form_home"))
    fa = _form_phrase(away_team, enrichment.get("form_away"))
    form_sentences = [p for p in (fh, fa) if p]
    if form_sentences:
        parts.append("; ".join(form_sentences) + ".")

    # Sentence 3: venue / travel / rest context, only sides with data.
    venue = enrichment.get("venue") or {}
    vh = _venue_phrase(home_team, {
        "travel_km_home": venue.get("travel_km_home"),
        "rest_days_home": venue.get("rest_days_home"),
        "tz_shift_home": venue.get("tz_shift_home"),
    }, "home")
    va = _venue_phrase(away_team, {
        "travel_km_away": venue.get("travel_km_away"),
        "rest_days_away": venue.get("rest_days_away"),
        "tz_shift_away": venue.get("tz_shift_away"),
    }, "away")
    venue_sentences = [p for p in (vh, va) if p]
    if venue_sentences:
        parts.append("; ".join(venue_sentences) + ".")
    elif venue.get("host_advantage"):
        parts.append(f"Host-nation advantage favours {venue['host_advantage']}.")

    # P1/P2: altitude (>1000 m) and midday-heat lines, only when relevant.
    alt_phrase = _altitude_phrase(venue, home_team, away_team)
    if alt_phrase:
        parts.append(alt_phrase + ".")
    heat = _heat_phrase(venue)
    if heat:
        parts.append(heat + ".")

    # Sentence 4: squad / injuries, only when a reveal carries names.
    squad = enrichment.get("squad") or {}
    sh = _squad_phrase(home_team, squad.get("injuries_home"))
    sa = _squad_phrase(away_team, squad.get("injuries_away"))
    squad_sentences = [p for p in (sh, sa) if p]
    if squad_sentences:
        parts.append("; ".join(squad_sentences) + ".")

    # Market reference when odds exist.
    market = enrichment.get("market")
    if market and isinstance(market, dict):
        mp = {"HOME": market.get("p_home"), "DRAW": market.get("p_draw"), "AWAY": market.get("p_away")}.get(pick)
        if isinstance(mp, (int, float)):
            parts.append(f"Market (de-vig) prices the same pick at {round(mp * 100)}%.")

    parts.append("Paper tier: track-record transparency only, no edge claimed. Bet responsibly.")
    return " ".join(parts)
