import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.db import AsyncSessionLocal, Bet
from config.settings import settings


class TraderAgent(BaseAgent):
    def __init__(self):
        super().__init__("TraderAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("risk:orders", "trader_group", "TraderAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            if settings.PAPER_TRADING:
                await self._execute_paper(data)
            else:
                await self._execute_live(data)
        except Exception as e:
            self.logger.error(f"trader error: {e}")

    async def _execute_paper(self, order: dict) -> None:
        async with AsyncSessionLocal() as session:
            bet = Bet(
                match_external_id=order["match_id"],
                selection=order["selection"],
                odds=float(order["odds"]),
                stake=float(order["stake"]),
                paper=True,
                status="pending",
                thesis=order.get("thesis", ""),
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)

        execution = {
            **order,
            "bet_id": str(bet.id),
            "paper": "true",
            "executed_at": datetime.utcnow().isoformat(),
        }
        await publish("trader:executions", execution)
        self.logger.info(
            f"[PAPER] placed: {order['home_team']} vs {order['away_team']} "
            f"{order['selection']} @ {order['odds']} stake={order['stake']}"
        )

    async def _execute_live(self, order: dict) -> None:
        from core.betfair_client import place_bet
        result = place_bet(
            market_id=order.get("betfair_market_id", ""),
            selection_id=int(order.get("betfair_selection_id", 0)),
            odds=float(order["odds"]),
            stake=float(order["stake"]),
        )
        async with AsyncSessionLocal() as session:
            bet = Bet(
                match_external_id=order["match_id"],
                selection=order["selection"],
                odds=float(order["odds"]),
                stake=float(order["stake"]),
                paper=False,
                status="pending",
                thesis=order.get("thesis", ""),
                betfair_bet_id=str(result.get("betId", "")),
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()

        await publish("trader:executions", {**order, "paper": "false", "executed_at": datetime.utcnow().isoformat()})
        self.logger.info(f"[LIVE] placed: {order['home_team']} vs {order['away_team']} stake={order['stake']}")
