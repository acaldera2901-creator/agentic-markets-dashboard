# agents/tennis_data_collector.py
import asyncio
from datetime import datetime

from agents.base import BaseAgent
from core.tennis_api_client import TennisAPIClient
from core.espn_tennis_client import get_fixtures as espn_get_fixtures


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")
        self._client = TennisAPIClient()

    async def _main_loop(self) -> None:
        while self._running:
            await self._collect_cycle()
            await asyncio.sleep(1800)  # ogni 30 min per ESPN (nessun limite quota)

    async def _collect_cycle(self):
        try:
            # Prova prima RapidAPI (se key configurata e subscritta)
            fixtures = await self._client.get_upcoming_fixtures(days_ahead=7)
            source = "rapidapi_tennis"

            # Fallback ESPN — gratuito, nessuna key, funziona durante i tornei
            if not fixtures:
                fixtures = await espn_get_fixtures()
                source = "espn"

            if fixtures:
                await self._client.write_fixtures_to_supabase(fixtures)
                self.logger.info("tennis: %d fixtures da %s", len(fixtures), source)
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": len(fixtures),
                    "source": source,
                    "collected_at": datetime.utcnow().isoformat(),
                })
            else:
                self.logger.info("tennis: nessun fixture disponibile (nessun torneo attivo o quota esaurita)")
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": 0,
                    "source": "none",
                    "status": "no_active_tournaments",
                })
        except Exception as exc:
            self.logger.error("tennis collection error: %s", exc)
