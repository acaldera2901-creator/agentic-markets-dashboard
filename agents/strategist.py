import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.claude_client import ask

STRATEGIST_SYSTEM = """You are the Head of Strategy at a quantitative prediction market trading desk.
You receive validated value bet opportunities from the analyst team.
Your role: write a clear trade thesis and assign a final conviction score (0-10).
Reject opportunities with score < 6. Output JSON only."""

class StrategistAgent(BaseAgent):
    def __init__(self):
        super().__init__("StrategistAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("analyst:opportunities", "strategist_group", "StrategistAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            prompt = f"""Opportunity:
Match: {data['home_team']} vs {data['away_team']} ({data['league']})
Kickoff: {data['kickoff']}
Selection: {data['selection']} @ {data['odds']} decimal
Edge: {data['edge']}
Analyst confidence: {data['confidence']}
Analyst notes: {data['notes']}

Write a trade thesis and score this opportunity.
Reply ONLY with JSON:
{{"conviction": 0-10, "thesis": "one sentence thesis", "approve": true/false}}"""

            response = await ask(STRATEGIST_SYSTEM, prompt)
            result = json.loads(response)

            if not result.get("approve") or result.get("conviction", 0) < 6:
                self.logger.info(f"rejected: {data['home_team']} vs {data['away_team']} conviction={result.get('conviction')}")
                return

            approved = {
                **data,
                "conviction": str(result["conviction"]),
                "thesis": result["thesis"],
                "approved_at": datetime.utcnow().isoformat(),
            }
            await publish("strategy:approved", approved)
            self.logger.info(f"approved: {data['home_team']} vs {data['away_team']} [{result['thesis'][:60]}]")
        except Exception as e:
            self.logger.error(f"strategist error: {e}")
