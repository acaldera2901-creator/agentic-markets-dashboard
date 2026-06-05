"""Pre-match tennis feature store built from historical match data.

The store is intentionally point-in-time: callers pass a cutoff date and only
matches strictly before that date are used. This keeps live predictions aligned
with the no-leakage backtest.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable

from core.tennis_data import TennisMatch, parse_csv
from core.tennis_names import canonical_player_key

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SERVE = 0.62
DEFAULT_RETURN = 0.38


def normalize_surface(surface: str | None) -> str:
    raw = (surface or "hard").strip().lower()
    if "clay" in raw:
        return "clay"
    if "grass" in raw:
        return "grass"
    return "hard"


@dataclass(frozen=True)
class TennisPlayerFeatures:
    player: str
    serve_form: float = DEFAULT_SERVE
    return_form: float = DEFAULT_RETURN
    matches_total: int = 0
    surface_matches: int = 0
    recent_matches_14d: int = 0
    rest_days: int | None = None
    sets_last_match: int = 2
    last_rank: int | None = None
    reliability: float = 0.0


class TennisFeatureStore:
    def __init__(self, matches: list[TennisMatch], cutoff: date | None = None) -> None:
        self.cutoff = cutoff
        self.matches = sorted(
            [m for m in matches if cutoff is None or m.date < cutoff],
            key=lambda m: m.date,
        )
        self._stats: dict[str, dict[str, Any]] = defaultdict(self._empty_stats)
        self._build()

    @staticmethod
    def _empty_stats() -> dict[str, Any]:
        return {
            "serve_won": 0.0,
            "serve_pts": 0.0,
            "return_won": 0.0,
            "return_pts": 0.0,
            "matches": 0,
            "surface_matches": defaultdict(int),
            "dates": [],
            "sets_last": 2,
            "rank": None,
        }

    @classmethod
    def from_matches(cls, matches: Iterable[TennisMatch], cutoff: date | None = None) -> "TennisFeatureStore":
        return cls(list(matches), cutoff=cutoff)

    @classmethod
    def from_cache(cls, cutoff: date | None = None, cache_dir: Path | None = None) -> "TennisFeatureStore":
        cache = cache_dir or ROOT / "data" / "tennis"
        matches: list[TennisMatch] = []
        for fp in sorted(cache.glob("*_*.csv")):
            tour = fp.stem.split("_", 1)[0].lower()
            if tour not in {"atp", "wta"}:
                continue
            matches.extend(parse_csv(fp.read_text(encoding="utf-8", errors="replace"), tour))
        return cls(matches, cutoff=cutoff)

    def _build(self) -> None:
        for match in self.matches:
            surface = normalize_surface(match.surface)
            self._update_player(
                player=match.winner,
                opponent=match.loser,
                surface=surface,
                match_date=match.date,
                serve_won=(match.w_1st_won or 0) + (match.w_2nd_won or 0),
                serve_pts=match.w_svpt or 0,
                return_won=(match.l_svpt or 0) - ((match.l_1st_won or 0) + (match.l_2nd_won or 0)),
                return_pts=match.l_svpt or 0,
                rank=match.winner_rank,
                sets=match.best_of,
            )
            self._update_player(
                player=match.loser,
                opponent=match.winner,
                surface=surface,
                match_date=match.date,
                serve_won=(match.l_1st_won or 0) + (match.l_2nd_won or 0),
                serve_pts=match.l_svpt or 0,
                return_won=(match.w_svpt or 0) - ((match.w_1st_won or 0) + (match.w_2nd_won or 0)),
                return_pts=match.w_svpt or 0,
                rank=match.loser_rank,
                sets=match.best_of,
            )

    def _update_player(
        self,
        player: str,
        opponent: str,
        surface: str,
        match_date: date,
        serve_won: int,
        serve_pts: int,
        return_won: int,
        return_pts: int,
        rank: int | None,
        sets: int,
    ) -> None:
        del opponent
        key = canonical_player_key(player)
        if not key:
            return
        stats = self._stats[key]
        if serve_pts > 0:
            stats["serve_won"] += serve_won
            stats["serve_pts"] += serve_pts
        if return_pts > 0:
            stats["return_won"] += max(0, return_won)
            stats["return_pts"] += return_pts
        stats["matches"] += 1
        stats["surface_matches"][surface] += 1
        stats["dates"].append(match_date)
        stats["sets_last"] = sets
        if rank is not None:
            stats["rank"] = rank

    def player_features(self, player: str, surface: str, fixture_date: date | None = None) -> TennisPlayerFeatures:
        key = canonical_player_key(player)
        stats = self._stats.get(key or "")
        if not stats:
            return TennisPlayerFeatures(player=player)

        norm_surface = normalize_surface(surface)
        serve_pts = float(stats["serve_pts"])
        return_pts = float(stats["return_pts"])
        matches_total = int(stats["matches"])
        surface_matches = int(stats["surface_matches"][norm_surface])
        serve_form = stats["serve_won"] / serve_pts if serve_pts >= 50 else DEFAULT_SERVE
        return_form = stats["return_won"] / return_pts if return_pts >= 50 else DEFAULT_RETURN

        dates: list[date] = stats["dates"]
        last_date = dates[-1] if dates else None
        rest_days = (fixture_date - last_date).days if fixture_date and last_date else None
        recent = sum(1 for d in dates if fixture_date and 0 < (fixture_date - d).days <= 14)
        reliability = min(1.0, (matches_total / 20.0) * 0.55 + (surface_matches / 12.0) * 0.45)

        return TennisPlayerFeatures(
            player=player,
            serve_form=round(float(serve_form), 4),
            return_form=round(float(return_form), 4),
            matches_total=matches_total,
            surface_matches=surface_matches,
            recent_matches_14d=recent,
            rest_days=rest_days,
            sets_last_match=int(stats["sets_last"] or 2),
            last_rank=stats["rank"],
            reliability=round(float(reliability), 4),
        )

    def h2h(self, p1: str, p2: str, surface: str | None = None) -> dict[str, int]:
        k1 = canonical_player_key(p1)
        k2 = canonical_player_key(p2)
        norm_surface = normalize_surface(surface) if surface else None
        p1_wins = p2_wins = surface_p1 = surface_p2 = 0
        for match in self.matches:
            winner = canonical_player_key(match.winner)
            loser = canonical_player_key(match.loser)
            if {winner, loser} != {k1, k2}:
                continue
            won_by_p1 = winner == k1
            p1_wins += 1 if won_by_p1 else 0
            p2_wins += 0 if won_by_p1 else 1
            if norm_surface and normalize_surface(match.surface) == norm_surface:
                surface_p1 += 1 if won_by_p1 else 0
                surface_p2 += 0 if won_by_p1 else 1
        return {
            "h2h_p1_wins": p1_wins,
            "h2h_p2_wins": p2_wins,
            "h2h_surface_p1": surface_p1,
            "h2h_surface_p2": surface_p2,
        }

    def match_context(self, p1: str, p2: str, surface: str, fixture_date: date | None = None) -> dict[str, Any]:
        f1 = self.player_features(p1, surface, fixture_date)
        f2 = self.player_features(p2, surface, fixture_date)
        h2h = self.h2h(p1, p2, surface)
        feature_quality = min(1.0, (f1.reliability + f2.reliability) / 2.0)
        return {
            "serve_form_p1": f1.serve_form,
            "serve_form_p2": f2.serve_form,
            "return_form_p1": f1.return_form,
            "return_form_p2": f2.return_form,
            "matches_total_p1": f1.matches_total,
            "matches_total_p2": f2.matches_total,
            "surface_matches_p1": f1.surface_matches,
            "surface_matches_p2": f2.surface_matches,
            "surface_reliability_p1": f1.reliability,
            "surface_reliability_p2": f2.reliability,
            "feature_quality": round(float(feature_quality), 4),
            "p1_rest_days": f1.rest_days,
            "p2_rest_days": f2.rest_days,
            "p1_sets_last": f1.sets_last_match,
            "p2_sets_last": f2.sets_last_match,
            "p1_recent_matches_14d": f1.recent_matches_14d,
            "p2_recent_matches_14d": f2.recent_matches_14d,
            "p1_rank_latest": f1.last_rank,
            "p2_rank_latest": f2.last_rank,
            **h2h,
        }
