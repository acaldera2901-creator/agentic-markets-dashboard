from __future__ import annotations

from context.match_type import MatchTypeClassifier
from context.league_strength import LeagueStrengthAnalyzer
from context.league_odds_profile import LeagueOddsProfiler
from context.league_predictability import LeaguePredictabilityTracker
from context.competition_factors import apply_factors

_COMPLETENESS_FIELDS = [
    "match_id", "league", "home_team", "away_team", "kickoff",
    "edge", "odds", "selection", "confidence", "p_home", "p_draw", "p_away",
]


class ContextService:

    def __init__(self):
        self._classifier = MatchTypeClassifier()
        self._strength_analyzer = LeagueStrengthAnalyzer()
        self._odds_profiler = LeagueOddsProfiler()
        self._predictability = LeaguePredictabilityTracker()
        self._league_profiles: dict[str, dict] = {}

    def load_league_history(self, league_id: str, league_name: str, matches: list[dict]) -> None:
        profile = self._strength_analyzer.compute_profile(league_id, league_name, matches)
        self._league_profiles[league_id] = profile
        self._odds_profiler.compute_profile(league_id, matches)

    def load_predictions_history(self, league_id: str, predictions: list[dict]) -> None:
        self._predictability.update(league_id, predictions)

    def enrich(self, data: dict) -> dict:
        enriched = {**data}
        league = data.get("league", "")

        match_type = self._classifier.classify(data).value
        enriched["match_type"] = match_type

        league_profile = self._league_profiles.get(league, {})
        enriched["league_tier"] = league_profile.get("strength_tier")
        enriched["league_predictability_score"] = league_profile.get("predictability_score")
        enriched["league_recommended_edge_min"] = league_profile.get("recommended_edge_min")
        enriched["market_efficiency"] = league_profile.get("market_efficiency")

        pred_metrics = self._predictability.get_metrics(league)
        enriched["league_confidence_level"] = pred_metrics["confidence_level"]
        enriched["bet_filter_active"] = pred_metrics["bet_filter_active"]
        enriched["suspend_recommended"] = pred_metrics.get("suspend_recommended", False)

        base_stake = float(data.get("stake", 0.0))
        base_confidence = float(data.get("confidence", 0.7))
        factors = apply_factors(base_stake, base_confidence, match_type)
        enriched["adjusted_stake"] = factors["adjusted_stake"]
        enriched["adjusted_confidence"] = factors["adjusted_confidence"]
        enriched["match_type_penalty"] = factors["match_type_penalty"]
        enriched["stake_multiplier"] = factors["stake_multiplier"]

        selection = data.get("selection", "home")
        current_odds = float(data.get("odds", 0.0)) if data.get("odds") else None
        if current_odds:
            enriched["odds_anomaly"] = self._odds_profiler.detect_anomaly(league, selection, current_odds)
        else:
            home_odds = data.get("home_odds")
            enriched["odds_anomaly"] = (
                self._odds_profiler.detect_anomaly(league, "home", float(home_odds))
                if home_odds else False
            )

        missing = [f for f in _COMPLETENESS_FIELDS if not data.get(f)]
        enriched["data_completeness"] = round((len(_COMPLETENESS_FIELDS) - len(missing)) / len(_COMPLETENESS_FIELDS), 3)
        enriched["missing_fields"] = missing
        enriched["auto_skip_reason"] = self._auto_skip_reason(enriched)

        return enriched

    def _auto_skip_reason(self, data: dict) -> str | None:
        if data.get("suspend_recommended"):
            return f"CLV medio negativo su campionato {data.get('league', '?')} — sospeso fino a review"
        if data.get("bet_filter_active"):
            return f"Hit rate basso su {data.get('league', '?')} — stake ridotto del 50%"
        if data.get("league_tier") is None:
            return f"Dati insufficienti per campionato {data.get('league', '?')} — skip automatico"
        return None
