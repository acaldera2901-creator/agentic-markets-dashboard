import asyncio
import json
from datetime import datetime, timezone

from agents.base import BaseAgent
from core.redis_client import get_redis


class TennisAnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisAnalystAgent")

    async def _main_loop(self):
        while self._running:
            await self._analysis_cycle()
            await asyncio.sleep(300)

    async def _analysis_cycle(self):
        r = await get_redis()
        raw = await r.get("model:tennis_probs")
        if not raw:
            return

        data = json.loads(raw)
        predictions = data.get("predictions", [])

        TENNIS_MIN_EDGE = 0.06  # raised from 4% — reduces false positives
        TENNIS_MIN_ODDS = 1.50  # mirrors MIN_ODDS in tennis_model_agent

        opportunities = []
        for pred in predictions:
            edge = pred.get("edge")
            sel = pred.get("best_selection")
            if not (edge and edge >= TENNIS_MIN_EDGE and sel):
                continue
            odds_key = "odds_p1" if sel == "P1" else "odds_p2"
            if (pred.get(odds_key) or 0.0) < TENNIS_MIN_ODDS:
                continue
            opportunities.append({
                    **pred,
                    "analyst_notes": f"edge={edge:.1%} on {pred['best_selection']} ({pred['player1']} vs {pred['player2']})",
                    "analyst_ts": datetime.now(timezone.utc).isoformat(),
                })

        if opportunities:
            payload = json.dumps({
                "opportunities": opportunities,
                "count": len(opportunities),
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            await r.set("tennis:opportunities", payload, ex=600)
            self.logger.info(f"TennisAnalystAgent: {len(opportunities)} value bets found (min edge {TENNIS_MIN_EDGE:.0%})")
