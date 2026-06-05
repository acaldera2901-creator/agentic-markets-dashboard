"""
World Cup 2026 national-team history loader (Gate 1: national_team_model).

Reads the Kaggle martj42/international-football-results CSV, filters to recent
competitive + friendly matches, normalizes team names to the canonical spelling
used by the fixture feed, and returns rows consumable by
``world_cup_team_model.matchup_profile``.

Pure module: no side effects, no network. The only I/O is reading a static CSV.
"""
from __future__ import annotations

import csv
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from config.settings import settings


# Plausible WC2026 field used for the >=30/32 quality gate. Canonical spelling
# matches the Kaggle dataset (which is also our normalization target).
WC2026_TEAMS: tuple[str, ...] = (
    "United States", "Canada", "Mexico",
    "Argentina", "Brazil", "Uruguay", "Colombia", "Ecuador", "Paraguay",
    "France", "England", "Spain", "Portugal", "Germany", "Netherlands",
    "Belgium", "Italy", "Croatia", "Switzerland", "Denmark", "Scotland",
    "Austria", "Turkey", "Czech Republic", "Norway", "Poland", "Serbia",
    "Japan", "South Korea", "Iran", "Australia", "Saudi Arabia", "Qatar",
    "Uzbekistan", "Jordan",
    "Morocco", "Senegal", "Tunisia", "Algeria", "Egypt", "Nigeria", "Ghana",
    "Ivory Coast", "Cameroon", "South Africa",
    "Haiti", "Bosnia and Herzegovina", "Panama", "Costa Rica",
)


# Fixture-feed / API aliases -> canonical dataset spelling. Keys are normalized
# (lowercased, collapsed whitespace) so lookups are robust to casing/spacing.
_TEAM_ALIASES: dict[str, str] = {
    "usa": "United States",
    "us": "United States",
    "united states of america": "United States",
    "bosnia & herzegovina": "Bosnia and Herzegovina",
    "bosnia-herzegovina": "Bosnia and Herzegovina",
    "bosnia": "Bosnia and Herzegovina",
    "türkiye": "Turkey",
    "turkiye": "Turkey",
    "korea republic": "South Korea",
    "republic of korea": "South Korea",
    "korea dpr": "North Korea",
    "ir iran": "Iran",
    "iran islamic republic": "Iran",
    "côte d'ivoire": "Ivory Coast",
    "cote d'ivoire": "Ivory Coast",
    "czechia": "Czech Republic",
    "china pr": "China",
    "cape verde": "Cabo Verde",
    # Bookmaker-feed variants (The Odds API / exchanges) — keep WC2026 odds
    # matching robust regardless of the provider's spelling.
    "holland": "Netherlands",
    "ksa": "Saudi Arabia",
    "czech rep": "Czech Republic",
    "bosnia and herz": "Bosnia and Herzegovina",
    "bosnia herzegovina": "Bosnia and Herzegovina",
}


def _norm(name: str | None) -> str:
    return " ".join((name or "").strip().lower().split())


def canonical_team_name(name: str | None) -> str:
    """Map a fixture-feed team name to its canonical dataset spelling.

    Passthrough (title-preserving from the dataset) when no alias applies; the
    returned value is what ``matchup_profile`` must be queried with.
    """
    key = _norm(name)
    if not key:
        return ""
    if key in _TEAM_ALIASES:
        return _TEAM_ALIASES[key]
    return _CANONICAL_BY_NORM.get(key, (name or "").strip())


# Reverse index: normalized canonical name -> canonical spelling, so passthrough
# names keep dataset capitalization regardless of input casing.
_CANONICAL_BY_NORM: dict[str, str] = {_norm(t): t for t in WC2026_TEAMS}


def _resolve_csv_path(csv_path: str | None) -> Path:
    raw = csv_path or settings.WC_HISTORY_CSV
    p = Path(raw)
    if p.is_absolute():
        return p
    # repo root = parent of this file's parent (core/ -> repo)
    return Path(__file__).resolve().parent.parent / raw


@lru_cache(maxsize=4)
def _load_raw(csv_path: str, since: str, tournaments: tuple[str, ...]) -> tuple[dict[str, Any], ...]:
    path = _resolve_csv_path(csv_path)
    since_date = date.fromisoformat(since)
    allowed = {t.lower() for t in tournaments}
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            tourn = (r.get("tournament") or "").strip().lower()
            if allowed and tourn not in allowed:
                continue
            try:
                d = date.fromisoformat((r.get("date") or "").strip())
            except ValueError:
                continue
            if d < since_date:
                continue
            try:
                hg = int(r["home_score"])
                ag = int(r["away_score"])
            except (KeyError, TypeError, ValueError):
                continue
            rows.append(
                {
                    "home_team": (r.get("home_team") or "").strip(),
                    "away_team": (r.get("away_team") or "").strip(),
                    "home_goals": hg,
                    "away_goals": ag,
                    "date": d,
                }
            )
    rows.sort(key=lambda m: m["date"])
    return tuple(rows)


def load_national_history(
    *,
    csv_path: str | None = None,
    since: str | None = None,
    tournaments: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Return chronologically sorted national-team matches for WC profiling.

    Team names are kept in dataset-canonical spelling; query the result with
    ``canonical_team_name(api_name)``.
    """
    csv_arg = csv_path or settings.WC_HISTORY_CSV
    since_arg = since or settings.WC_HISTORY_SINCE
    tourn_arg = tuple(tournaments or settings.WC_HISTORY_TOURNAMENTS)
    return [dict(m) for m in _load_raw(csv_arg, since_arg, tourn_arg)]
