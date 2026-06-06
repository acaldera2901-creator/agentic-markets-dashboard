"""
Tennis board curation (#020, Andrea 2026-06-06).

Everything visible on the site must be under our control: the board serves
main-draw, main-tour matches only. Two explicit, data-driven rules:

1. Qualifying rounds — dropped via the REAL ESPN round field
   ("Qualifying 1st Round", "Qualifying Final", ...). No name guessing.
2. Minor circuits (ITF / Challenger / WTA 125) — dropped via the explicit
   TENNIS_TOURNAMENT_DENYLIST in config/settings.py (env-overridable, CSV).
   ESPN exposes no tier field, so the denylist is the honest control surface:
   reviewed when the weekly calendar changes, and every drop is LOGGED so
   curation stays visible instead of silent.

Pure functions, no I/O — the collector applies them and logs the report.
"""
from __future__ import annotations

import unicodedata


def _fold(s: str | None) -> str:
    """Accent-fold + lowercase ('Libéma' → 'libema') for stable matching."""
    return (
        unicodedata.normalize("NFKD", s or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .strip()
    )


def is_qualifying(fixture: dict) -> bool:
    return "qualifying" in _fold(fixture.get("round"))


def is_denylisted(fixture: dict, denylist: tuple[str, ...]) -> bool:
    tournament = _fold(fixture.get("tournament"))
    return any(token and token in tournament for token in denylist)


def parse_denylist(csv_value: str) -> tuple[str, ...]:
    return tuple(_fold(t) for t in (csv_value or "").split(",") if t.strip())


def filter_main_tour(
    fixtures: list[dict],
    *,
    denylist: tuple[str, ...],
    include_qualifying: bool = False,
) -> tuple[list[dict], dict]:
    """Return (kept_fixtures, report).

    report = {"qualifying": n, "minor": n, "dropped_tournaments": {name: n}}
    """
    kept: list[dict] = []
    report: dict = {"qualifying": 0, "minor": 0, "dropped_tournaments": {}}
    for fixture in fixtures:
        if not include_qualifying and is_qualifying(fixture):
            report["qualifying"] += 1
            name = fixture.get("tournament") or "?"
            report["dropped_tournaments"][name] = report["dropped_tournaments"].get(name, 0) + 1
            continue
        if is_denylisted(fixture, denylist):
            report["minor"] += 1
            name = fixture.get("tournament") or "?"
            report["dropped_tournaments"][name] = report["dropped_tournaments"].get(name, 0) + 1
            continue
        kept.append(fixture)
    return kept, report
