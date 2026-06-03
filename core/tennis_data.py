"""Loader for Jeff Sackmann's tennis match data (ATP/WTA, free on GitHub).

Per-tour, per-year CSVs with results, surface, ranks and serve/return stats.
Match-level serve stats (w_ace, w_svpt, ...) describe THAT match, so they are
only usable as *post-match* updates to a player's running form — never as a
pre-match feature for the same match (would leak the result).
"""
from __future__ import annotations

import csv
import io
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime
from typing import List

RAW_BASE = "https://raw.githubusercontent.com/JeffSackmann/tennis_{tour}/master/{tour}_matches_{year}.csv"
TOURS = ("atp", "wta")


@dataclass(frozen=True)
class TennisMatch:
    date: date
    tour: str
    surface: str          # Hard | Clay | Grass | Carpet
    winner: str
    loser: str
    best_of: int
    winner_rank: int | None
    loser_rank: int | None
    minutes: int | None
    # serve stats (winner / loser) — for post-match running form, not pre-match features
    w_svpt: int | None
    w_1st_won: int | None
    w_2nd_won: int | None
    l_svpt: int | None
    l_1st_won: int | None
    l_2nd_won: int | None

    @staticmethod
    def serve_won_pct(first_won: int | None, second_won: int | None, svpt: int | None) -> float | None:
        if not svpt or first_won is None or second_won is None:
            return None
        return (first_won + second_won) / svpt


def _int(row: dict, key: str) -> int | None:
    v = (row.get(key) or "").strip()
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _parse_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    try:
        return datetime.strptime(raw, "%Y%m%d").date()  # Sackmann uses YYYYMMDD
    except ValueError:
        return None


def parse_row(row: dict, tour: str) -> TennisMatch | None:
    d = _parse_date(row.get("tourney_date", ""))
    w = (row.get("winner_name") or "").strip()
    l = (row.get("loser_name") or "").strip()
    if d is None or not w or not l:
        return None
    return TennisMatch(
        date=d,
        tour=tour,
        surface=(row.get("surface") or "").strip() or "Unknown",
        winner=w,
        loser=l,
        best_of=_int(row, "best_of") or 3,
        winner_rank=_int(row, "winner_rank"),
        loser_rank=_int(row, "loser_rank"),
        minutes=_int(row, "minutes"),
        w_svpt=_int(row, "w_svpt"),
        w_1st_won=_int(row, "w_1stWon"),
        w_2nd_won=_int(row, "w_2ndWon"),
        l_svpt=_int(row, "l_svpt"),
        l_1st_won=_int(row, "l_1stWon"),
        l_2nd_won=_int(row, "l_2ndWon"),
    )


def parse_csv(text: str, tour: str) -> List[TennisMatch]:
    out: List[TennisMatch] = []
    for row in csv.DictReader(io.StringIO(text)):
        m = parse_row(row, tour)
        if m is not None:
            out.append(m)
    return out


def download_csv(tour: str, year: int, timeout: float = 30.0) -> str:
    url = RAW_BASE.format(tour=tour, year=year)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (agentic-markets)"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="replace")
