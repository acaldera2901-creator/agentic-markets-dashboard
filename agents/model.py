import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.football_api_client import get_historical_results, LEAGUE_IDS
from models.dixon_coles import DixonColesModel
from config.settings import settings

class ModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("ModelAgent")
        self._models: dict[str, DixonColesModel] = {}

    async def _main_loop(self) -> None:
        await self._bootstrap_models()
        while self._running:
            messages = await consume("market:data", "model_group", "ModelAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _bootstrap_models(self) -> None:
        season = datetime.now().year
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                results = await get_historical_results(league_id, season)
                training = self._parse_results(results)
                if len(training) >= 10:
                    model = DixonColesModel()
                    model.fit(training)
                    self._models[league_code] = model
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
            result = {
                "match_id": payload["match_id"],
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": payload["kickoff"],
                "p_home": str(p_home),
                "p_draw": str(p_draw),
                "p_away": str(p_away),
                "odds": json.dumps(payload.get("odds", {})),
                "computed_at": datetime.utcnow().isoformat(),
            }
            await publish("model:probabilities", result)
        except Exception as e:
            self.logger.error(f"processing error: {e}")
