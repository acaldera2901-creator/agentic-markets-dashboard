import asyncio
import json
from datetime import datetime, timezone, timedelta
from agents.base import BaseAgent
from core.redis_client import publish
from core.football_api_client import get_fixtures, LEAGUE_IDS
from core.odds_api_client import get_odds
from config.settings import settings

class DataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("DataCollector")
        self._upcoming_kickoffs: list = []

    async def _main_loop(self) -> None:
        while self._running:
            try:
                await self._collect_cycle()
            except Exception as e:
                self.logger.error(f"collection error: {e}")
            interval = self._next_interval()
            self.logger.info(f"sleeping {interval}s until next cycle")
            await asyncio.sleep(interval)

    def _next_interval(self) -> int:
        return settings.PREMATCH_REFRESH_INTERVAL if self._has_imminent_match() else settings.DATA_REFRESH_INTERVAL

    def _has_imminent_match(self) -> bool:
        now = datetime.now(timezone.utc)
        window = timedelta(hours=2)
        for ko in self._upcoming_kickoffs:
            try:
                ko_dt = datetime.fromisoformat(ko.replace("Z", "+00:00"))
                if timedelta(0) <= (ko_dt - now) <= window:
                    return True
            except Exception:
                continue
        return False

    async def _collect_cycle(self) -> None:
        season = datetime.now().year
        self._upcoming_kickoffs = []
        for league_code, league_id in LEAGUE_IDS.items():
            fixtures = await get_fixtures(league_id, season)
            odds_list = await get_odds(league_code)
            odds_map = {o.get("home_team", "") + "|" + o.get("away_team", ""): o for o in odds_list}

            for fixture in fixtures:
                event = self._build_event(fixture, odds_map, league_code)
                if event:
                    self._upcoming_kickoffs.append(event["kickoff"])
                    await publish("market:data", {"payload": json.dumps(event)})
                    self.logger.debug(f"published {event['home_team']} vs {event['away_team']}")

    def _build_event(self, fixture: dict, odds_map: dict, league: str) -> dict | None:
        try:
            teams = fixture["teams"]
            home = teams["home"]["name"]
            away = teams["away"]["name"]
            kickoff = fixture["fixture"]["date"]
            match_id = str(fixture["fixture"]["id"])

            odds_key = f"{home}|{away}"
            odds_data = odds_map.get(odds_key, {})

            return {
                "match_id": match_id,
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": kickoff,
                "odds": odds_data,
                "collected_at": datetime.utcnow().isoformat(),
            }
        except (KeyError, TypeError):
            return None
