"""Normalized cross-book odds event (#SPORTSBOOK-SCRAPER-1)."""
from dataclasses import dataclass, asdict

from core.odds_api_client import normalize_name
from core.tennis_names import canonical_player_key

# Colonne reali della tabella odds_snapshots (vedi core/odds_api_client._SNAPSHOT_COLUMNS).
_SNAPSHOT_COLUMNS = (
    "match_id", "team_pair_key", "commence_time", "bookmaker", "source", "market",
    "odds_home", "odds_draw", "odds_away",
    "ah_line", "ah_home", "ah_away", "overround",
    "total_line", "total_over", "total_under",
)


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

    def _commence_iso(self) -> str | None:
        if self.scheduled is None:
            return None
        from datetime import datetime, timezone
        return datetime.fromtimestamp(self.scheduled, tz=timezone.utc).isoformat()

    def _pair_key(self) -> str | None:
        if not self.scheduled or len(self.competitors) < 2:
            return None
        day = self._commence_iso()[:10]
        a, b = self.competitors[0], self.competitors[1]
        if self.sport == "tennis":
            k = sorted([canonical_player_key(a), canonical_player_key(b)])
        else:
            k = sorted([normalize_name(a), normalize_name(b)])
        return f"{day}:{'|'.join(k)}"

    def to_snapshot_row(self) -> dict:
        """Proietta sull'esatto set colonne di odds_snapshots (joinabile via
        team_pair_key con le nostre prediction). Mercato 'match' = 1X2/match-winner."""
        pair = self._pair_key()
        return {
            "match_id": f"{self.source}:{self.sport}:{pair}",
            "team_pair_key": pair,
            "commence_time": self._commence_iso(),
            "bookmaker": self.source,
            "source": self.source,
            "market": "match",
            "odds_home": self.odds_home,
            "odds_draw": self.odds_draw,
            "odds_away": self.odds_away,
            "ah_line": None, "ah_home": None, "ah_away": None, "overround": None,
            "total_line": self.total_line,
            "total_over": self.total_over,
            "total_under": self.total_under,
        }
