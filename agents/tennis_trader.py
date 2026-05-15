import asyncio
import json
from datetime import datetime, timezone

from agents.base import BaseAgent
from core.redis_client import get_redis
from config.settings import settings


class TennisTraderAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisTraderAgent")
        self._bot = None
        self._processed_ids: set = set()

    async def _main_loop(self):
        if settings.TELEGRAM_BOT_TOKEN:
            try:
                from telegram import Bot
                self._bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
            except Exception as e:
                self.logger.warning(f"Telegram init failed: {e}")

        while self._running:
            await self._trading_cycle()
            await asyncio.sleep(300)

    async def _trading_cycle(self):
        r = await get_redis()
        raw = await r.get("tennis:orders")
        if not raw:
            return

        data = json.loads(raw)
        orders = data.get("orders", [])

        for order in orders:
            match_id = order.get("match_id", "")
            if match_id in self._processed_ids:
                continue

            await self._execute_paper(order)
            self._processed_ids.add(match_id)
            if len(self._processed_ids) > 500:
                self._processed_ids = set(list(self._processed_ids)[-250:])

    async def _execute_paper(self, order: dict):
        from core.db import AsyncSessionLocal, TennisBet
        from sqlalchemy import select

        player_name = order.get("player1") if order.get("best_selection") == "P1" else order.get("player2")
        odds = order.get("odds_p1") if order.get("best_selection") == "P1" else order.get("odds_p2")

        try:
            async with AsyncSessionLocal() as session:
                existing = await session.execute(
                    select(TennisBet).where(
                        TennisBet.match_id == order["match_id"],
                        TennisBet.status == "pending",
                    )
                )
                if existing.scalars().first():
                    self.logger.warning(
                        f"[TENNIS] duplicate skipped: pending bet already exists for "
                        f"{order.get('player1')} vs {order.get('player2')} ({order['match_id']})"
                    )
                    return
                bet = TennisBet(
                    match_id=order["match_id"],
                    selection=order.get("best_selection", "P1"),
                    player_name=player_name,
                    odds=odds or 2.0,
                    stake=order.get("stake", 1.0),
                    paper=True,
                    status="pending",
                )
                session.add(bet)
                await session.commit()
                self.logger.info(
                    f"TENNIS signal: {player_name} @ {odds:.2f} "
                    f"stake={order.get('stake'):.2f}€ edge={order.get('edge', 0):.1%}"
                )
                await self._send_alert(order, player_name, odds)
        except Exception as e:
            self.logger.error(f"_execute_paper error: {e}")

    async def _send_alert(self, order: dict, player: str, odds: float):
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        edge = order.get("edge", 0)
        if edge < 0.04:
            return
        try:
            msg = (
                f"🎾 [SIGNAL] TENNIS EDGE\n"
                f"{order.get('player1')} vs {order.get('player2')}\n"
                f"▶ {player} @ {odds:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {order.get('stake', 0):.2f}€  |  {order.get('tournament', '')} ({order.get('surface', '').upper()})"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")
