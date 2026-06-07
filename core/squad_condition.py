"""
Squad Condition Watch — player availability/condition data layer (① of the spec
docs/superpowers/specs/2026-06-07-squad-condition-watch.md).

What is observable pre-kickoff (and what the market prices with delay) is the
*composition and condition of the actual XI*, not the latent psycho-physical
state. This module turns the free sources already in the stack into a per-team
condition report:

  - known injuries        (ESPN injuries flag, via espn_soccer_client — caller passes them in)
  - recent callup diff    (Track A wc_squad_snapshots diff — caller passes it in)
  - XI value / best-11     (dcaribou transfermarkt valuations, optional local CDN snapshot)
  - availability ratio     (XI value / best-11, the lab's d_avail signal, clipped 1.2)

Honesty contract (matches the rest of the WC pipeline): every field comes from a
passed-in / loaded source. Copertura mancante -> that field is None (injuries an
empty list), NEVER invented. condition_report() is pure + fail-soft: it does no
network I/O and never raises into the collector cycle.

PERIMETER: ①+② only. This module feeds the why-layer and the quality-gate cap —
both PROBABILITY-NEUTRAL. The model-feature layer ③ (availability as a logit
feature on the served path) stays gated behind PROMOTION-GATE + human APPROVE.
"""
from __future__ import annotations

import csv
import gzip
import logging
from bisect import bisect_right
from collections import defaultdict
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from config.settings import settings

logger = logging.getLogger("squad_condition")

_ROOT = Path(__file__).resolve().parents[1]


# ── pure availability math (mirrors scripts/lab_squad_condition_10y.py) ───────

def availability_index(xi_value: float | None, best11_value: float | None) -> float | None:
    """XI market value / club-or-nation best-11 value, clipped to the lab cap.

    < 1.0 = key players missing/rested TODAY. None when either side is missing
    or best-11 is non-positive (no fabricated 1.0). Clip prevents a thin-roster
    artefact (XI valued > best-11) from reading as a super-strength signal.
    """
    if xi_value is None or best11_value is None or best11_value <= 0:
        return None
    return round(min(xi_value / best11_value, settings.SQUAD_AVAIL_CLIP), 4)


def xi_value(player_names: list[str], valuations: dict[str, float]) -> float | None:
    """Total market value of the starting XI, rescaled for partial coverage.

    Sums the valued starters and rescales to 11 (same as the lab's
    ``sum(xi_vals) * 11 / len(xi_vals)``). None when fewer than
    SQUAD_MIN_XI_VALUED of the named players carry a valuation — too thin to
    trust, so we report unknown rather than a biased value.
    """
    if not player_names:
        return None
    valued = [valuations[n] for n in player_names if n in valuations and valuations[n] > 0]
    if len(valued) < settings.SQUAD_MIN_XI_VALUED:
        return None
    return round(sum(valued) * 11 / len(valued), 2)


def best11_value(roster_names: list[str], valuations: dict[str, float]) -> float | None:
    """Value of the 11 most valuable players seen for the team (the best-11)."""
    pool = sorted((valuations[n] for n in roster_names if n in valuations and valuations[n] > 0),
                  reverse=True)
    if len(pool) < 11:
        return None
    return round(sum(pool[:11]), 2)


# ── point-in-time transfermarkt valuations (optional local CDN snapshot) ──────

class _Valuations:
    """Last-known market value per player NAME at or before a date.

    Built from the dcaribou transfermarkt-datasets CSVs (players + valuations).
    Name-keyed (not id) because the live sources — ESPN squads, Track A
    snapshots — only carry display names. Absent files -> empty index, every
    lookup returns None (fail-soft, the runtime default until the weekly CDN
    pull lands data in TRANSFERMARKT_DATA_DIR).
    """

    def __init__(self, by_name: dict[str, tuple[list[date], list[float]]]):
        self._by_name = by_name

    @property
    def loaded(self) -> bool:
        return bool(self._by_name)

    def at(self, name: str, when: date | None = None) -> float | None:
        entry = self._by_name.get(name)
        if not entry:
            return None
        dates, vals = entry
        if when is None:
            return vals[-1]
        i = bisect_right(dates, when) - 1
        return vals[i] if i >= 0 else None

    def as_map(self, names: list[str], when: date | None = None) -> dict[str, float]:
        out: dict[str, float] = {}
        for n in names:
            v = self.at(n, when)
            if v is not None:
                out[n] = v
        return out


def _data_dir() -> Path:
    d = Path(settings.TRANSFERMARKT_DATA_DIR)
    return d if d.is_absolute() else _ROOT / d


def _gz_rows(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        yield from csv.DictReader(fh)


def _parse_d(s: str) -> date | None:
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


@lru_cache(maxsize=1)
def load_valuations() -> _Valuations:
    """Load player-name -> point-in-time valuations from the local CDN snapshot.

    Cached for the process (the CDN refresh is weekly; the collector restarts
    pick up new data). Any missing/corrupt file -> empty index, logged at debug,
    never raised: XI-value math then degrades to None across the board.
    """
    data = _data_dir()
    players_f = data / "players.csv.gz"
    vals_f = data / "player_valuations.csv.gz"
    if not players_f.exists() or not vals_f.exists():
        logger.debug("transfermarkt data absent at %s — XI value math disabled", data)
        return _Valuations({})

    try:
        id_to_name: dict[str, str] = {}
        for r in _gz_rows(players_f):
            pid = r.get("player_id")
            name = r.get("name") or r.get("pretty_name")
            if pid and name:
                id_to_name[pid] = name

        raw: dict[str, list[tuple[date, float]]] = defaultdict(list)
        for r in _gz_rows(vals_f):
            name = id_to_name.get(r.get("player_id", ""))
            if not name:
                continue
            d = _parse_d(r.get("date", ""))
            try:
                v = float(r.get("market_value_in_eur") or 0)
            except (TypeError, ValueError):
                continue
            if d and v > 0:
                raw[name].append((d, v))

        by_name: dict[str, tuple[list[date], list[float]]] = {}
        for name, rows in raw.items():
            rows.sort()
            by_name[name] = ([d for d, _ in rows], [v for _, v in rows])
        logger.info("transfermarkt valuations loaded: %d players", len(by_name))
        return _Valuations(by_name)
    except Exception as exc:  # corrupt download must not break the collector
        logger.debug("transfermarkt valuations load failed (non-fatal): %s", exc)
        return _Valuations({})


# ── the report ────────────────────────────────────────────────────────────────

def condition_report(
    team: str,
    *,
    injured_players: list[str] | None = None,
    squad_size: int | None = None,
    recent_diff: dict[str, Any] | None = None,
    xi_value: float | None = None,
    best11_value: float | None = None,
    asof: date | None = None,
) -> dict[str, Any]:
    """Fail-soft condition report for one team. Pure (no I/O), never raises.

    All inputs are resolved by the caller (ESPN injuries, Track A snapshot diff,
    XI/best-11 values from load_valuations()). Whatever is missing comes back
    None / empty — never fabricated. ``asof`` is recorded for provenance only.

    Note: the ``xi_value`` / ``best11_value`` parameters shadow the module
    helpers intentionally — the caller passes the already-computed numbers.
    """
    injuries = [n for n in (injured_players or []) if n]
    ratio = availability_index(xi_value, best11_value)
    rotation = ratio is not None and ratio < settings.SQUAD_ROTATION_RATIO
    return {
        "team": team,
        "asof": asof.isoformat() if asof else None,
        "injuries": injuries,
        "injured_count": len(injuries) if injured_players is not None else None,
        "squad_size": squad_size,
        "xi_value": xi_value,
        "best11_value": best11_value,
        "xi_value_ratio": ratio,
        "availability_ratio": ratio,
        "rotation_flag": bool(rotation),
        "recent_diff": recent_diff,
    }


def availability_unknown(report: dict[str, Any]) -> bool:
    """True when the report has no value-based availability signal at all.

    This is the quality-gate trigger (② cap): availability IGNOTA -> the tier
    is capped (spec §4). Injuries-only / diff-only reports are still UNKNOWN for
    availability — they tell us *who* is out, not the XI-value fraction.
    """
    return report.get("availability_ratio") is None
