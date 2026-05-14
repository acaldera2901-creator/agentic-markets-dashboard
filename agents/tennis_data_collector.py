import asyncio
import json
from datetime import datetime

from agents.base import BaseAgent
from core.redis_client import get_redis


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")

    async def _main_loop(self) -> None:
        while self._running:
            await self._collect_cycle()
            await asyncio.sleep(300)

    async def _collect_cycle(self):
        from core import tennis_betfair_client
        markets = await asyncio.to_thread(tennis_betfair_client.get_all_tennis_markets)
        if markets:
            r = await get_redis()
            payload = json.dumps({
                "markets": markets,
                "collected_at": datetime.utcnow().isoformat(),
                "count": len(markets),
            })
            await r.set("market:tennis", payload, ex=600)
            self.logger.info(f"tennis: collected {len(markets)} markets from Betfair")
        else:
            self.logger.warning("tennis: no markets returned from Betfair")
