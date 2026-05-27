from __future__ import annotations

import statistics
from datetime import datetime, timezone
from config.settings import settings

_TOP5_IDS = {"PL", "SA", "PD", "BL1", "FL1"}
_TIER_EDGE_MIN = {1: 0.04, 2: 0.035, 3: 0.03, 4: 0.025, 5: 0.02, None: 0.05}


class LeagueStrengthAnalyzer:

    def compute_profile(self, league_id: str, league_name: str, matches: list[dict]) -> dict:
        if len(matches) < settings.MIN_LEAGUE_MATCHES:
            return self._insufficient_data_profile(league_id, league_name)

        tier = 1 if league_id in _TOP5_IDS else self._compute_tier(league_id, matches)
        avg_xg = self._compute_avg_xg(matches)
        volatility = self._compute_result_volatility(matches)
        efficiency = self._compute_market_efficiency(matches)
        liquidity = self._compute_liquidity(matches)
        upset_rate = self._compute_upset_rate(matches)
        predictability = self._compute_predictability(efficiency, upset_rate)

        return {
            "league_id": league_id,
            "league_name": league_name,
            "strength_tier": tier,
            "market_efficiency": round(efficiency, 4),
            "predictability_score": round(predictability, 4),
            "avg_xg_per_game": round(avg_xg, 3) if avg_xg is not None else None,
            "result_volatility": round(volatility, 4),
            "liquidity_score": round(liquidity, 4),
            "recommended_edge_min": _TIER_EDGE_MIN.get(tier, 0.03),
            "total_matches_analyzed": len(matches),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def _insufficient_data_profile(self, league_id: str, league_name: str) -> dict:
        return {
            "league_id": league_id,
            "league_name": league_name,
            "strength_tier": None,
            "market_efficiency": 0.5,
            "predictability_score": 0.5,
            "avg_xg_per_game": None,
            "result_volatility": None,
            "liquidity_score": 0.5,
            "recommended_edge_min": _TIER_EDGE_MIN[None],
            "total_matches_analyzed": 0,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def _compute_tier(self, league_id: str, matches: list[dict]) -> int:
        efficiency = self._compute_market_efficiency(matches)
        liquidity = self._compute_liquidity(matches)
        score = (efficiency + liquidity) / 2
        if score >= 0.80:
            return 2
        elif score >= 0.65:
            return 3
        elif score >= 0.50:
            return 4
        return 5

    def _compute_avg_xg(self, matches: list[dict]) -> float | None:
        xg_values = []
        for m in matches:
            h_xg, a_xg = m.get("home_xg"), m.get("away_xg")
            if h_xg is not None and a_xg is not None:
                xg_values.append(float(h_xg) + float(a_xg))
            else:
                h_sot, a_sot = m.get("home_shots_on_target"), m.get("away_shots_on_target")
                if h_sot is not None and a_sot is not None:
                    xg_values.append((float(h_sot) + float(a_sot)) * 0.33)
        if not xg_values:
            goals = [m.get("home_goals", 0) + m.get("away_goals", 0) for m in matches]
            return statistics.mean(goals) if goals else None
        return statistics.mean(xg_values)

    def _compute_result_volatility(self, matches: list[dict]) -> float:
        diffs = []
        for m in matches:
            hg, ag = m.get("home_goals"), m.get("away_goals")
            if hg is not None and ag is not None:
                diffs.append(float(hg) - float(ag))
        return statistics.stdev(diffs) if len(diffs) >= 2 else 0.0

    def _compute_market_efficiency(self, matches: list[dict]) -> float:
        overrounds = []
        for m in matches:
            h, d, a = m.get("home_odds"), m.get("draw_odds"), m.get("away_odds")
            if h and d and a and all(o > 1.0 for o in (h, d, a)):
                overrounds.append(1 / h + 1 / d + 1 / a - 1.0)
        if not overrounds:
            return 0.5
        return max(0.0, min(1.0, 1.0 - statistics.mean(overrounds)))

    def _compute_liquidity(self, matches: list[dict]) -> float:
        home_odds = [m["home_odds"] for m in matches if m.get("home_odds") and m["home_odds"] > 1.0]
        if len(home_odds) < 5:
            return 0.5
        cv = statistics.stdev(home_odds) / statistics.mean(home_odds)
        return max(0.0, min(1.0, 1.0 - cv * 2.0))

    def _compute_upset_rate(self, matches: list[dict]) -> float:
        upsets = total = 0
        for m in matches:
            h, a, result = m.get("home_odds"), m.get("away_odds"), m.get("result")
            if h is None or a is None or result is None:
                continue
            favorite = "home" if h <= a else "away"
            if favorite != result and result != "draw":
                upsets += 1
            total += 1
        return upsets / total if total else 0.3

    def _compute_predictability(self, market_efficiency: float, upset_rate: float) -> float:
        return max(0.0, min(1.0, (market_efficiency + (1.0 - upset_rate)) / 2.0))
