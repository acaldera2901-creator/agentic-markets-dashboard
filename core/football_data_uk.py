"""Loader for football-data.co.uk historical results + closing odds.

football-data.co.uk publishes free CSVs (one per division per season) that pair
final results with closing odds from multiple books. We use the Pinnacle closing
line (PSCH/PSCD/PSCA) as the primary "true probability" reference for CLV/ROI
backtesting, falling back to the market average (AvgCH/AvgCD/AvgCA) when Pinnacle
is missing for a row. Polite automated access is allowed by the source.
"""
from __future__ import annotations

import csv
import io
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime

FD_BASE = "https://www.football-data.co.uk/mmz4281"

# internal league code -> football-data.co.uk division code
DIVISION_MAP: dict[str, str] = {
    "PL": "E0",   # Premier League
    "BL1": "D1",  # Bundesliga
    "SA": "I1",   # Serie A
    "SB": "I2",   # Serie B (#SERIE-B-1) — off-free-tier, served via snapshot path
    "PD": "SP1",  # La Liga
    "FL1": "F1",  # Ligue 1
}


@dataclass(frozen=True)
class FDMatch:
    date: date
    league: str  # internal code (PL, BL1, ...)
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    result: str  # 'H' | 'D' | 'A'
    psc_h: float | None  # Pinnacle closing
    psc_d: float | None
    psc_a: float | None
    avg_h: float | None  # market average closing
    avg_d: float | None
    avg_a: float | None
    open_h: float | None = None  # Pinnacle opening (PSH); for line-movement features
    open_d: float | None = None
    open_a: float | None = None
    referee: str | None = None

    @property
    def closing_home(self) -> float | None:
        return self.psc_h if self.psc_h else self.avg_h

    @property
    def closing_draw(self) -> float | None:
        return self.psc_d if self.psc_d else self.avg_d

    @property
    def closing_away(self) -> float | None:
        return self.psc_a if self.psc_a else self.avg_a

    def as_model_match(self) -> dict:
        """Shape expected by DixonColesModel / Poisson backtest."""
        return {
            "home_team": self.home_team,
            "away_team": self.away_team,
            "home_goals": self.home_goals,
            "away_goals": self.away_goals,
            "date": self.date.isoformat(),
        }


def season_code(start_year: int) -> str:
    """2024 -> '2425' (the 2024/25 season folder on football-data.co.uk)."""
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def _to_float(row: dict, key: str) -> float | None:
    """Parse a cell to float. Returns None only for empty/invalid — 0 is valid (e.g. 0 goals)."""
    v = (row.get(key) or "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _parse_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def parse_row(row: dict, league: str) -> FDMatch | None:
    """Parse one CSV row into an FDMatch, or None if essential fields are missing."""
    home = (row.get("HomeTeam") or "").strip()
    away = (row.get("AwayTeam") or "").strip()
    d = _parse_date(row.get("Date", ""))
    hg = _to_float(row, "FTHG")
    ag = _to_float(row, "FTAG")
    if not home or not away or d is None or hg is None or ag is None:
        return None
    return FDMatch(
        date=d,
        league=league,
        home_team=home,
        away_team=away,
        home_goals=int(hg),
        away_goals=int(ag),
        result=(row.get("FTR") or "").strip(),
        psc_h=_to_float(row, "PSCH"),
        psc_d=_to_float(row, "PSCD"),
        psc_a=_to_float(row, "PSCA"),
        avg_h=_to_float(row, "AvgCH"),
        avg_d=_to_float(row, "AvgCD"),
        avg_a=_to_float(row, "AvgCA"),
        open_h=_to_float(row, "PSH") or _to_float(row, "B365H"),
        open_d=_to_float(row, "PSD") or _to_float(row, "B365D"),
        open_a=_to_float(row, "PSA") or _to_float(row, "B365A"),
        referee=(row.get("Referee") or "").strip() or None,
    )


def parse_csv(text: str, league: str) -> list[FDMatch]:
    reader = csv.DictReader(io.StringIO(text))
    out: list[FDMatch] = []
    for row in reader:
        m = parse_row(row, league)
        if m is not None:
            out.append(m)
    return out


def implied_probs(
    odds_h: float | None, odds_d: float | None, odds_a: float | None
) -> tuple[float, float, float] | None:
    """De-vig 1X2 closing odds into a normalized probability (basic overround removal)."""
    if not odds_h or not odds_d or not odds_a:
        return None
    inv = (1.0 / odds_h, 1.0 / odds_d, 1.0 / odds_a)
    s = inv[0] + inv[1] + inv[2]
    if s <= 0:
        return None
    return (inv[0] / s, inv[1] / s, inv[2] / s)


def download_csv(league: str, start_year: int, timeout: float = 30.0) -> str:
    div = DIVISION_MAP[league]
    url = f"{FD_BASE}/{season_code(start_year)}/{div}.csv"
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (agentic-markets data loader)"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (trusted host)
        raw = resp.read()
    return raw.decode("utf-8", errors="replace")


def load(leagues: list[str], start_years: list[int]) -> list[FDMatch]:
    """Download + parse multiple leagues/seasons. Network failures per file are skipped."""
    out: list[FDMatch] = []
    for lg in leagues:
        for yr in start_years:
            try:
                out.extend(parse_csv(download_csv(lg, yr), lg))
            except Exception:  # noqa: BLE001 — one bad file must not kill the load
                continue
    return out
