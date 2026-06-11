"""Normalized cross-book odds event (#SPORTSBOOK-SCRAPER-1)."""
from dataclasses import dataclass, field, asdict


@dataclass
class OddsEvent:
    source: str                       # 'roobet' | 'stake'
    sport: str                        # 'soccer' | 'tennis'
    competitors: list[str]            # [home/p1, away/p2]
    scheduled: int | None             # unix seconds (kickoff)
    # match result: 1X2 (calcio) o match-winner (tennis, draw=None)
    odds_home: float | None = None
    odds_draw: float | None = None
    odds_away: float | None = None
    # totals (over/under) sulla linea principale
    total_line: float | None = None
    total_over: float | None = None
    total_under: float | None = None
    event_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)
