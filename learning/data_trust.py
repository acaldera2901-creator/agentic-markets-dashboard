from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Any, Optional

FallbackChain: dict[str, list[str]] = {
    "understat_xg": ["api_football_shots_on_target_ratio", "historical_avg_xg"],
    "pinnacle_odds": ["oddsapi_best_odds", "historical_league_avg"],
    "api_football_lineup": ["predicted_lineup_from_pattern", "skip_lineup_features"],
    "openweather": ["historical_weather_same_venue_month", "ignore_weather_features"],
}


@dataclass
class DataTrustScore:
    feature_name: str
    value: Any
    trust_score: float          # 0.0 (untrusted) → 1.0 (verified)
    staleness_minutes: int
    source: str
    validation_flags: list[str]
    fallback_used: bool
    fallback_source: Optional[str]


class DataTrustEngine:
    """
    Validates each data point before it enters the prediction pipeline.
    Returns a DataTrustScore with trust level and any validation flags.

    Rules are source-specific:
      - understat   : xG plausibility + staleness
      - api_football: lineup completeness + confirmation status
      - pinnacle    : odds range + bid/ask spread + staleness near kickoff
      - perplexity  : default 0.6, adjustable by cross-source confirmation
    """

    def score(
        self,
        feature_name: str,
        value: Any,
        *,
        source: str,
        updated_at: datetime.datetime,
        extra: Optional[dict] = None,
    ) -> DataTrustScore:
        extra = extra or {}
        now = datetime.datetime.now(datetime.timezone.utc)
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=datetime.timezone.utc)
        staleness = int((now - updated_at).total_seconds() / 60)

        dispatch = {
            "understat": self._score_understat,
            "api_football": self._score_api_football,
            "pinnacle": self._score_pinnacle,
            "perplexity": self._score_perplexity,
        }
        scorer = dispatch.get(source.lower(), self._score_generic)
        trust, flags, fallback_used, fallback_src = scorer(
            feature_name, value, staleness, extra
        )
        trust = max(0.0, min(1.0, trust))
        return DataTrustScore(
            feature_name=feature_name,
            value=value,
            trust_score=trust,
            staleness_minutes=staleness,
            source=source,
            validation_flags=flags,
            fallback_used=fallback_used,
            fallback_source=fallback_src,
        )

    def aggregate_trust(
        self,
        scores: list[DataTrustScore],
        weights: dict[str, float],
    ) -> float:
        if not scores:
            return 1.0
        if not weights:
            return sum(s.trust_score for s in scores) / len(scores)
        total_w = sum(weights.get(s.feature_name, 1.0) for s in scores)
        if total_w == 0:
            return 1.0
        return sum(
            s.trust_score * weights.get(s.feature_name, 1.0)
            for s in scores
        ) / total_w

    def stake_action(
        self,
        scores: list[DataTrustScore],
        weights: dict[str, float],
    ) -> dict:
        trust = self.aggregate_trust(scores, weights)
        if trust < 0.50:
            return {"skip": True, "reduce_stake_pct": 0.0, "prediction_trust": trust}
        if trust < 0.65:
            return {"skip": False, "reduce_stake_pct": 0.30, "prediction_trust": trust}
        return {"skip": False, "reduce_stake_pct": 0.0, "prediction_trust": trust}

    # ── Source-specific scorers ───────────────────────────────────────────────

    def _score_understat(self, name, value, staleness, extra):
        flags = []
        trust = 0.90

        if staleness > 48 * 60:
            trust = min(trust, 0.50)
            flags.append("stale_48h")

        try:
            xg = float(value)
        except (TypeError, ValueError):
            return 0.5, flags, False, None

        if xg == 0.0 and extra.get("consecutive_zero_xg_matches", 0) > 3:
            trust = min(trust, 0.30)
            flags.append("suspect_zero_xg")

        if xg > 5.0:
            trust = min(trust, 0.60)
            flags.append("outlier_xg")

        return trust, flags, False, None

    def _score_api_football(self, name, value, staleness, extra):
        flags = []
        fallback_used = False
        fallback_src = None
        trust = 0.80

        if not isinstance(value, dict):
            return trust, flags, False, None

        status = value.get("status", "")
        players = value.get("players", [])
        n_players = len(players) if isinstance(players, list) else 0

        if n_players < 9:
            trust = 0.20
            flags.append("incomplete_lineup")
            fallback_used = True
            fallback_src = FallbackChain.get("api_football_lineup", [None])[0]
            return trust, flags, fallback_used, fallback_src

        if status == "confirmed":
            trust = 0.95
        elif status == "predicted":
            minutes_to_kickoff = extra.get("minutes_to_kickoff", 0)
            if minutes_to_kickoff > 180:
                trust = min(trust, 0.40)
                flags.append("predicted_lineup_early")

        return trust, flags, fallback_used, fallback_src

    def _score_pinnacle(self, name, value, staleness, extra):
        flags = []
        trust = 0.90

        if not isinstance(value, dict):
            try:
                odds = float(value)
                value = {"odds": odds}
            except (TypeError, ValueError):
                return 0.5, flags, False, None

        odds = float(value.get("odds", 0.0))
        if odds <= 1.01 or odds > 50.0:
            flags.append("invalid_odds_range")
            return 0.0, flags, False, None

        bid = value.get("bid")
        ask = value.get("ask")
        if bid and ask and ask > 0:
            spread_pct = (ask - bid) / ask
            if spread_pct > 0.05:
                trust = min(trust, 0.70)
                flags.append("wide_spread")

        minutes_to_kickoff = extra.get("minutes_to_kickoff", 9999)
        if staleness > 60 and minutes_to_kickoff < 60:
            trust = min(trust, 0.50)
            flags.append("stale_near_kickoff")

        return trust, flags, False, None

    def _score_perplexity(self, name, value, staleness, extra):
        flags = []
        trust = 0.60
        fallback_used = False
        fallback_src = None

        if extra.get("api_football_confirms"):
            trust = 0.90
        elif extra.get("api_football_contradicts"):
            trust = 0.20
            fallback_used = True
            fallback_src = "api_football"
            flags.append("contradicts_api_football")

        return trust, flags, fallback_used, fallback_src

    def _score_generic(self, name, value, staleness, extra):
        return 0.75, [], False, None
