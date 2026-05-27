from __future__ import annotations

import statistics

_MIN_BETS_FOR_CONFIDENCE = 50
_HIT_RATE_FILTER_THRESHOLD = 0.45
_CLV_SUSPEND_THRESHOLD = 0.0
_MIN_BETS_FOR_CLV_CHECK = 50


class LeaguePredictabilityTracker:

    def __init__(self):
        self._data: dict[str, list[dict]] = {}

    def update(self, league_id: str, predictions: list[dict]) -> None:
        self._data[league_id] = predictions

    def get_metrics(self, league_id: str) -> dict:
        preds = self._data.get(league_id, [])
        if len(preds) < _MIN_BETS_FOR_CONFIDENCE:
            return self._insufficient_metrics(league_id)

        hit_rate = self._hit_rate(preds)
        value_bets = [p for p in preds if p.get("is_value_bet")]
        vb_hit_rate = self._hit_rate(value_bets) if value_bets else None

        clv_values = [p["clv"] for p in preds if p.get("clv") is not None]
        avg_clv = statistics.mean(clv_values) if clv_values else None

        roi_values = [p["roi"] for p in preds if p.get("roi") is not None]
        roi = statistics.mean(roi_values) if roi_values else None

        brier = self._brier_score(preds)
        confidence = self._confidence_level(hit_rate, avg_clv, len(preds))
        best_type, worst_type = self._best_worst_type(preds)

        return {
            "league_id": league_id,
            "total_predictions": len(preds),
            "hit_rate": round(hit_rate, 4),
            "value_bet_hit_rate": round(vb_hit_rate, 4) if vb_hit_rate is not None else None,
            "avg_clv": round(avg_clv, 4) if avg_clv is not None else None,
            "roi": round(roi, 4) if roi is not None else None,
            "brier_score": round(brier, 4),
            "best_bet_type": best_type,
            "worst_bet_type": worst_type,
            "confidence_level": confidence,
            "bet_filter_active": self._should_filter(hit_rate, len(preds)),
            "suspend_recommended": self._should_suspend(avg_clv, len(preds)),
        }

    def _hit_rate(self, preds: list[dict]) -> float:
        if not preds:
            return 0.0
        return sum(1 for p in preds if p.get("predicted") == p.get("actual")) / len(preds)

    def _brier_score(self, preds: list[dict]) -> float:
        scores = [
            (p.get("p_predicted", 0.5) - (1 if p.get("predicted") == p.get("actual") else 0)) ** 2
            for p in preds
        ]
        return statistics.mean(scores) if scores else 0.5

    def _confidence_level(self, hit_rate: float, avg_clv: float | None, n: int) -> str:
        if n < _MIN_BETS_FOR_CONFIDENCE:
            return "INSUFFICIENT_DATA"
        if avg_clv is not None and avg_clv >= 0.02 and hit_rate >= 0.52:
            return "HIGH"
        if hit_rate >= 0.48 or (avg_clv is not None and avg_clv >= 0.01):
            return "MEDIUM"
        return "LOW"

    def _should_filter(self, hit_rate: float, n: int) -> bool:
        return n >= 100 and hit_rate < _HIT_RATE_FILTER_THRESHOLD

    def _should_suspend(self, avg_clv: float | None, n: int) -> bool:
        return avg_clv is not None and n >= _MIN_BETS_FOR_CLV_CHECK and avg_clv < _CLV_SUSPEND_THRESHOLD

    def _best_worst_type(self, preds: list[dict]) -> tuple[str | None, str | None]:
        type_stats: dict[str, list[bool]] = {}
        for p in preds:
            t = p.get("predicted", "unknown")
            type_stats.setdefault(t, []).append(p.get("predicted") == p.get("actual"))
        rates = {t: sum(v) / len(v) for t, v in type_stats.items() if len(v) >= 10}
        if not rates:
            return None, None
        return max(rates, key=rates.get), min(rates, key=rates.get)

    def _insufficient_metrics(self, league_id: str) -> dict:
        return {
            "league_id": league_id,
            "total_predictions": len(self._data.get(league_id, [])),
            "hit_rate": None, "value_bet_hit_rate": None, "avg_clv": None,
            "roi": None, "brier_score": None, "best_bet_type": None, "worst_bet_type": None,
            "confidence_level": "INSUFFICIENT_DATA",
            "bet_filter_active": False,
            "suspend_recommended": False,
        }
