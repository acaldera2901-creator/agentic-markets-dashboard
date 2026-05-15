import asyncio
import json
from datetime import datetime, timezone
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.football_api_client import get_historical_results as apifootball_history, LEAGUE_IDS
from core.football_data_org_client import get_historical_results as fdorg_history, FREE_TIER_CODES
from models.dixon_coles import DixonColesModel
from models.conformal import calibrate_from_history, get_interval, interval_width
from context.context_service import ContextService
from core.db import persist_league_profile, persist_match_classification
from learning.season_phase import SeasonPhaseAdapter
from config.settings import settings

# Expected matches per season per league (home + away; 20-team league = 380 total)
_LEAGUE_TOTAL_MATCHES: dict[str, int] = {
    "PL": 380, "SA": 380, "PD": 380, "BL1": 306,
    "FL1": 380, "CL": 125, "EL": 96, "ECL": 96,
}


class ModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("ModelAgent")
        self._models: dict[str, DixonColesModel] = {}
        self._history: dict[str, list] = {}  # league → parsed match results for conformal
        self._context_svc = ContextService()
        self._phase_adapter = SeasonPhaseAdapter()

    async def _main_loop(self) -> None:
        await self._bootstrap_models()
        while self._running:
            messages = await consume("market:data", "model_group", "ModelAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _fetch_history(self, league_code: str, league_id: int) -> list:
        fdorg_key = settings.FOOTBALL_DATA_ORG_API_KEY
        if fdorg_key and league_code in FREE_TIER_CODES:
            results = await fdorg_history(league_code, fdorg_key, days_back=365)
            if results:
                return results
        if settings.API_FOOTBALL_KEY:
            now = datetime.now()
            season = now.year if now.month >= 8 else now.year - 1
            return await apifootball_history(league_id, season)
        return []

    async def _bootstrap_models(self) -> None:
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                results = await self._fetch_history(league_code, league_id)
                training = self._parse_results(results)
                if len(training) >= 10:
                    model = DixonColesModel()
                    model.fit(training)
                    self._models[league_code] = model
                    self._history[league_code] = training

                    # Calibrate conformal predictor on the same training set
                    # Use last 20% as "calibration" split to avoid data leakage
                    n_cal = max(int(len(training) * 0.20), 10)
                    calibration_set = training[-n_cal:]
                    cal_probs = []
                    for m in calibration_set:
                        try:
                            ph, pd, pa = model.predict(m["home_team"], m["away_team"])
                            cal_probs.append({
                                "p_home": ph, "p_draw": pd, "p_away": pa,
                                "home_goals": m["home_goals"], "away_goals": m["away_goals"],
                            })
                        except Exception:
                            continue
                    if cal_probs:
                        calibrate_from_history(league_code, cal_probs)
                        self.logger.info(
                            f"conformal calibrated for {league_code} on {len(cal_probs)} matches"
                        )

                    # Carica storia campionato nel ContextService
                    raw_matches = [
                        {
                            "home_goals": m["home_goals"],
                            "away_goals": m["away_goals"],
                            "result": (
                                "home" if m["home_goals"] > m["away_goals"]
                                else "away" if m["away_goals"] > m["home_goals"]
                                else "draw"
                            ),
                        }
                        for m in training
                    ]
                    profile = self._context_svc.load_league_history(league_code, league_code, raw_matches)
                    if profile:
                        try:
                            await persist_league_profile(profile)
                        except Exception as db_err:
                            self.logger.warning(f"league profile DB persist failed for {league_code}: {db_err}")
                    self.logger.info(f"fitted model for {league_code} on {len(training)} matches")
                else:
                    self.logger.warning(f"insufficient data for {league_code}: {len(training)} matches")
            except Exception as e:
                self.logger.error(f"bootstrap error for {league_code}: {e}")

    def _parse_results(self, fixtures: list) -> list:
        matches = []
        for f in fixtures:
            try:
                score = f["score"]["fulltime"]
                if score["home"] is None or score["away"] is None:
                    continue
                matches.append({
                    "home_team": f["teams"]["home"]["name"],
                    "away_team": f["teams"]["away"]["name"],
                    "home_goals": int(score["home"]),
                    "away_goals": int(score["away"]),
                })
            except (KeyError, TypeError):
                continue
        return matches

    async def _process(self, data: dict) -> None:
        try:
            payload = json.loads(data["payload"])
            league = payload["league"]
            home = payload["home_team"]
            away = payload["away_team"]
            model = self._models.get(league)
            if not model or not model.fitted:
                return
            if home not in model._team_idx or away not in model._team_idx:
                return

            p_home, p_draw, p_away = model.predict(home, away)

            # Conformal prediction intervals
            ci_home = get_interval(league, p_home)
            ci_draw = get_interval(league, p_draw)
            ci_away = get_interval(league, p_away)

            # Gate: skip publishing if best-selection interval is too wide
            best_p = max(p_home, p_draw, p_away)
            ci_width = interval_width(league, best_p)

            result = {
                "match_id": payload["match_id"],
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": payload["kickoff"],
                "p_home": str(p_home),
                "p_draw": str(p_draw),
                "p_away": str(p_away),
                # Conformal intervals for best selection
                "ci_low": str(min(ci_home[0], ci_draw[0], ci_away[0])),
                "ci_high": str(max(ci_home[1], ci_draw[1], ci_away[1])),
                "ci_width": str(ci_width),
                "odds": json.dumps(payload.get("odds", {})),
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

            # Arricchisci con contesto campionato/partita
            ctx_input = {
                "home_team": home, "away_team": away, "league": league,
                "match_id": payload["match_id"],
                "kickoff": payload["kickoff"],
                "confidence": max(p_home, p_draw, p_away),
            }
            ctx = self._context_svc.enrich(ctx_input)
            result["match_type"] = ctx["match_type"]
            result["league_tier"] = str(ctx.get("league_tier") or "")
            result["league_confidence_level"] = ctx["league_confidence_level"]
            result["bet_filter_active"] = str(ctx["bet_filter_active"])
            result["auto_skip_reason"] = ctx.get("auto_skip_reason") or ""
            result["odds_anomaly"] = str(ctx.get("odds_anomaly", False))
            result["data_completeness"] = str(ctx["data_completeness"])
            result["market_efficiency"] = str(ctx.get("market_efficiency") or "")

            # Season phase detection — uses training set size as matchday proxy
            n_played = len(self._history.get(league, []))
            total = _LEAGUE_TOTAL_MATCHES.get(league, 380)
            phase = self._phase_adapter.detect_phase(n_played, total)
            phase_cfg = self._phase_adapter.get_config(phase)
            result["season_phase"] = phase.value
            result["phase_stake_multiplier"] = str(phase_cfg.stake_multiplier)
            result["phase_edge_boost"] = str(phase_cfg.edge_min_boost)
            result["phase_dead_rubber_skip"] = str(phase_cfg.dead_rubber_auto_skip)

            await publish("model:probabilities", result)

            # Persist match classification asynchronously (best-effort)
            try:
                await persist_match_classification({**ctx_input, **ctx})
            except Exception as db_err:
                self.logger.debug(f"match classification persist skipped: {db_err}")
        except Exception as e:
            self.logger.error(f"processing error: {e}")
