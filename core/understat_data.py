"""Loader for the scraped Understat per-match xG data (data/understat/*.csv).

Produced by scripts/scrape_understat_xg.py. One row per match with both goals and
xG, so it is self-contained for measuring the predictive value of xG without
having to name-map onto the football-data.co.uk dataset.
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import List

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "understat"


@dataclass(frozen=True)
class XGMatch:
    date: date
    league: str
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    home_xg: float
    away_xg: float

    def as_model_match(self) -> dict:
        return {
            "home_team": self.home_team,
            "away_team": self.away_team,
            "home_goals": self.home_goals,
            "away_goals": self.away_goals,
            "date": self.date.isoformat(),
        }

    @property
    def result(self) -> str:
        return "H" if self.home_goals > self.away_goals else "A" if self.away_goals > self.home_goals else "D"


def parse_row(row: dict, league: str) -> XGMatch | None:
    try:
        return XGMatch(
            date=date.fromisoformat((row["date"] or "").strip()),
            league=league,
            home_team=(row["home_team"] or "").strip(),
            away_team=(row["away_team"] or "").strip(),
            home_goals=int(row["home_goals"]),
            away_goals=int(row["away_goals"]),
            home_xg=float(row["home_xg"]),
            away_xg=float(row["away_xg"]),
        )
    except (KeyError, ValueError, TypeError):
        return None


def parse_csv(text: str, league: str) -> List[XGMatch]:
    out: List[XGMatch] = []
    for row in csv.DictReader(io.StringIO(text)):
        m = parse_row(row, league)
        if m is not None:
            out.append(m)
    return out


def load(data_dir: Path | None = None) -> List[XGMatch]:
    """Load every cached Understat CSV. File name prefix (PL_, PD_, ...) is the league."""
    d = data_dir or DATA_DIR
    out: List[XGMatch] = []
    for fp in sorted(d.glob("*.csv")):
        league = fp.name.split("_", 1)[0]
        out.extend(parse_csv(fp.read_text(encoding="utf-8", errors="replace"), league))
    return out
