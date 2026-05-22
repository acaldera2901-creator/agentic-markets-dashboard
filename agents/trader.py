import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.db import AsyncSessionLocal, Bet
from config.settings import settings
from sqlalchemy import select


class TraderAgent(BaseAgent):
    def __init__(self):
        super().__init__("TraderAgent")
        self._bot = None

    async def _main_loop(self) -> None:
        await self._init_telegram()
        while self._running:
            messages = await consume("risk:orders", "trader_group", "TraderAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _init_telegram(self) -> None:
        if settings.TELEGRAM_BOT_TOKEN:
            try:
                from telegram import Bot
                self._bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
            except Exception as e:
                self.logger.warning(f"Telegram init failed: {e}")

    async def _send_bet_placed_alert(self, order: dict, bet_id: str) -> None:
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        try:
            edge = float(order.get("edge", 0))
            if edge < settings.TELEGRAM_VALUE_EDGE_THRESHOLD:
                return
            match = f"{order.get('home_team')} vs {order.get('away_team')}"
            sel = order.get("selection", "?").upper()
            odds = float(order.get("odds", 0))
            stake = float(order.get("stake", 0))
            p_sel = float(order.get("p_home" if sel == "HOME" else "p_draw" if sel == "DRAW" else "p_away", 0))
            msg = (
                f"✅ [PAPER] {match}\n"
                f"{sel} @ {odds:.2f}  |  p={p_sel:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {stake:.2f}€  |  DB#{bet_id}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")

    async def _process(self, data: dict) -> None:
        try:
            await self._execute_paper(data)
        except Exception as e:
            self.logger.error(f"trader error: {e}")

    async def _execute_paper(self, order: dict) -> None:
        kickoff = str(order.get("kickoff", ""))
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                select(Bet).where(
                    Bet.match_external_id == order["match_id"],
                    Bet.status == "pending",
                )
            )
            if existing.scalar_one_or_none():
                self.logger.warning(
                    f"[PAPER] duplicate skipped: {order.get('home_team')} vs "
                    f"{order.get('away_team')} ({order['match_id']})"
                )
                return
            bet = Bet(
                match_external_id=order["match_id"],
                home_team=order.get("home_team", ""),
                away_team=order.get("away_team", ""),
                kickoff=kickoff,
                league=order.get("league", ""),
                matchday_id=kickoff[:10] if kickoff else "",
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
        await self._send_bet_placed_alert(order, str(bet.id))
        self.logger.info(
            f"[PAPER] placed: {order['home_team']} vs {order['away_team']} "
            f"{order['selection']} @ {order['odds']} stake={order['stake']}"
        )
