# agents/tennis_data_collector.py
import asyncio
from datetime import datetime

from agents.base import BaseAgent
from core.tennis_api_client import TennisAPIClient


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")
        self._client = TennisAPIClient()

    async def _main_loop(self) -> None:
        while self._running:
            await self._collect_cycle()
            await asyncio.sleep(3600)  # hourly — respect 100 req/day quota

    async def _collect_cycle(self):
        try:
            fixtures = await self._client.get_upcoming_fixtures(days_ahead=7)
            if fixtures:
                await self._client.write_fixtures_to_supabase(fixtures)
                self.logger.info("tennis: collected %d fixtures from RapidAPI", len(fixtures))
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": len(fixtures),
                    "source": "rapidapi_tennis",
                    "collected_at": datetime.utcnow().isoformat(),
                })
            else:
                self.logger.info("tennis: no fixtures returned (quota exhausted or no matches today)")
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": 0,
                    "source": "rapidapi_tennis",
                    "status": "empty",
                })
        except Exception as exc:
            self.logger.error("tennis collection error: %s", exc)
