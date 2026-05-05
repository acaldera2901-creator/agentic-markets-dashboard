import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from config.settings import settings

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
            result = await self._evaluate(data)

            if not result.get("approve") or result.get("conviction", 0) < 6:
                self.logger.info(
                    f"rejected: {data['home_team']} vs {data['away_team']} "
                    f"conviction={result.get('conviction')}"
                )
                return

            approved = {
                **data,
                "conviction": str(result["conviction"]),
                "thesis": result["thesis"],
                "approved_at": datetime.utcnow().isoformat(),
            }
            await publish("strategy:approved", approved)
            self.logger.info(
                f"approved: {data['home_team']} vs {data['away_team']} "
                f"[{result['thesis'][:60]}]"
            )
        except Exception as e:
            self.logger.error(f"strategist error: {e}")

    async def _evaluate(self, data: dict) -> dict:
        """Use Claude if available, otherwise rule-based conviction scoring."""
        if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY.startswith("sk-ant-..."):
            edge = float(data.get("edge", 0))
            confidence = float(data.get("confidence", 0.7))
            # Conviction 0-10: edge ≥ 5% → approve
            # 3% → 5, 5% → 7, 8% → 9, 10%+ → 10
            conviction = min(4 + int(edge * 60), 10)
            approve = conviction >= 6  # approves at edge ≥ ~3.5%
            thesis = (
                f"Poisson model identifies {edge:.1%} edge on {data['selection']} "
                f"for {data['home_team']} vs {data['away_team']} ({data['league']})"
            )
            return {"conviction": conviction, "thesis": thesis, "approve": approve}

        try:
            from core.claude_client import ask
            prompt = (
                f"Opportunity:\n"
                f"Match: {data['home_team']} vs {data['away_team']} ({data['league']})\n"
                f"Kickoff: {data['kickoff']}\n"
                f"Selection: {data['selection']} @ {data['odds']} decimal\n"
                f"Edge: {data['edge']}\n"
                f"Analyst confidence: {data['confidence']}\n"
                f"Analyst notes: {data['notes']}\n\n"
                "Write a trade thesis and score this opportunity.\n"
                'Reply ONLY with JSON: {"conviction": 0-10, "thesis": "one sentence thesis", "approve": true/false}'
            )
            response = await ask(STRATEGIST_SYSTEM, prompt)
            return json.loads(response)
        except Exception as e:
            self.logger.warning(f"Claude unavailable, using rule-based: {e}")
            edge = float(data.get("edge", 0))
            conviction = min(int(edge * 20 + 4), 10)
            return {
                "conviction": conviction,
                "thesis": f"Rule-based: {float(data.get('edge', 0)):.1%} edge on {data['selection']}",
                "approve": conviction >= 6,
            }
