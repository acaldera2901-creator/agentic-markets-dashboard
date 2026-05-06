from __future__ import annotations

import statistics

_MIN_MATCHES = 20
_ANOMALY_SIGMA = 1.5


class LeagueOddsProfiler:

    def __init__(self):
        self._profiles: dict[str, dict] = {}

    def compute_profile(self, league_id: str, matches: list[dict]) -> dict:
        if len(matches) < _MIN_MATCHES:
            profile = self._empty_profile(league_id)
            self._profiles[league_id] = profile
            return profile

        n = len(matches)
        results = [m.get("result") for m in matches]

        home_win_pct = results.count("home") / n
        draw_pct = results.count("draw") / n
        away_win_pct = results.count("away") / n

        home_odds = [m["home_odds"] for m in matches if m.get("home_odds") and m["home_odds"] > 1.0]
        draw_odds = [m["draw_odds"] for m in matches if m.get("draw_odds") and m["draw_odds"] > 1.0]
        away_odds = [m["away_odds"] for m in matches if m.get("away_odds") and m["away_odds"] > 1.0]

        over25 = [m for m in matches if (m.get("total_goals") or 0) > 2]
        btts = [m for m in matches if m.get("both_scored")]

        value_zone = self._value_zone(home_win_pct, draw_pct, away_win_pct,
                                      home_odds, draw_odds, away_odds)

        profile = {
            "league_id": league_id,
            "home_win_pct": round(home_win_pct, 4),
            "draw_pct": round(draw_pct, 4),
            "away_win_pct": round(away_win_pct, 4),
            "avg_home_odds": round(statistics.mean(home_odds), 3) if home_odds else None,
            "avg_draw_odds": round(statistics.mean(draw_odds), 3) if draw_odds else None,
            "avg_away_odds": round(statistics.mean(away_odds), 3) if away_odds else None,
            "home_odds_std": round(statistics.stdev(home_odds), 3) if len(home_odds) > 1 else None,
            "draw_odds_std": round(statistics.stdev(draw_odds), 3) if len(draw_odds) > 1 else None,
            "away_odds_std": round(statistics.stdev(away_odds), 3) if len(away_odds) > 1 else None,
            "over25_pct": round(len(over25) / n, 4),
            "btts_pct": round(len(btts) / n, 4),
            "home_advantage_index": round(self._home_advantage_index(matches), 4),
            "value_zone": value_zone,
            "total_matches": n,
        }
        self._profiles[league_id] = profile
        return profile

    def detect_anomaly(
        self,
        league_id: str,
        outcome: str,
        current_odds: float,
        sigma_threshold: float = _ANOMALY_SIGMA,
    ) -> bool:
        profile = self._profiles.get(league_id)
        if not profile:
            return False
        avg = profile.get(f"avg_{outcome}_odds")
        std = profile.get(f"{outcome}_odds_std")
        if avg is None or std is None or std == 0:
            return False
        return abs(current_odds - avg) / std >= sigma_threshold

    def _home_advantage_index(self, matches: list[dict]) -> float:
        home_wins = sum(1 for m in matches if m.get("result") == "home")
        away_wins = sum(1 for m in matches if m.get("result") == "away")
        return home_wins / away_wins if away_wins else 2.0

    def _value_zone(self, h_pct, d_pct, a_pct, home_odds, draw_odds, away_odds) -> str:
        candidates = []
        if home_odds:
            candidates.append(("home", h_pct - 1 / statistics.mean(home_odds)))
        if draw_odds:
            candidates.append(("draw", d_pct - 1 / statistics.mean(draw_odds)))
        if away_odds:
            candidates.append(("away", a_pct - 1 / statistics.mean(away_odds)))
        if not candidates:
            return "none"
        best = max(candidates, key=lambda x: x[1])
        return best[0] if best[1] > 0 else "none"

    def _empty_profile(self, league_id: str) -> dict:
        return {
            "league_id": league_id,
            "home_win_pct": None, "draw_pct": None, "away_win_pct": None,
            "avg_home_odds": None, "avg_draw_odds": None, "avg_away_odds": None,
            "home_odds_std": None, "draw_odds_std": None, "away_odds_std": None,
            "over25_pct": None, "btts_pct": None, "home_advantage_index": None,
            "value_zone": "none", "total_matches": 0,
        }
