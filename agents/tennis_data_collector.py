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
        from core import matchbook_client

        markets: list[dict] = []

        if matchbook_client.is_configured():
            try:
                mb_markets = await asyncio.to_thread(matchbook_client.get_tennis_markets)
                if mb_markets:
                    markets.extend(mb_markets)
                    self.logger.info(f"tennis: {len(mb_markets)} markets from Matchbook")
            except Exception as e:
                self.logger.error(f"tennis: Matchbook collection error: {e}")
        else:
            self.logger.debug("tennis: no exchange configured — skipping collection")

        if markets:
            r = await get_redis()
            payload = json.dumps({
                "markets": markets,
                "collected_at": datetime.utcnow().isoformat(),
                "count": len(markets),
            })
            await r.set("market:tennis", payload, ex=600)
            self.logger.info(f"tennis: {len(markets)} total markets cached")
        else:
            self.logger.debug("tennis: no markets available")
