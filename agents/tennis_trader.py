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

            if settings.PAPER_TRADING:
                await self._execute_paper(order)
            else:
                await self._execute_live(order)

            self._processed_ids.add(match_id)
            if len(self._processed_ids) > 500:
                self._processed_ids = set(list(self._processed_ids)[-250:])

    def _selection_info(self, order: dict) -> tuple[str | None, float | None, int | None]:
        """Return (player_name, odds, selection_id) for the chosen side."""
        side = order.get("best_selection", "P1")
        if side == "P1":
            return (
                order.get("player1"),
                order.get("odds_p1"),
                order.get("selection_id_p1"),
            )
        return (
            order.get("player2"),
            order.get("odds_p2"),
            order.get("selection_id_p2"),
        )

    async def _check_duplicate(self, match_id: str) -> bool:
        from core.db import AsyncSessionLocal, TennisBet
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                select(TennisBet).where(
                    TennisBet.match_id == match_id,
                    TennisBet.status == "pending",
                )
            )
            return existing.scalars().first() is not None

    async def _execute_paper(self, order: dict):
        from core.db import AsyncSessionLocal, TennisBet

        player_name, odds, _ = self._selection_info(order)

        try:
            if await self._check_duplicate(order["match_id"]):
                self.logger.warning(
                    f"[TENNIS] duplicate skipped: pending bet already exists for "
                    f"{order.get('player1')} vs {order.get('player2')} ({order['match_id']})"
                )
                return

            async with AsyncSessionLocal() as session:
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
                f"[PAPER] TENNIS: {player_name} @ {odds:.2f} "
                f"stake={order.get('stake'):.2f}€ edge={order.get('edge', 0):.1%}"
            )
            await self._send_alert(order, player_name, odds, mode="PAPER")
        except Exception as e:
            self.logger.error(f"_execute_paper error: {e}")

    async def _execute_live(self, order: dict):
        from core.db import AsyncSessionLocal, TennisBet
        from core.betfair_client import get_best_back_price, place_bet

        player_name, model_odds, selection_id = self._selection_info(order)
        market_id = order.get("match_id", "")

        if not market_id or not selection_id:
            self.logger.error(
                f"[LIVE TENNIS] missing market_id or selection_id for "
                f"{order.get('player1')} vs {order.get('player2')} — falling back to paper"
            )
            await self._execute_paper(order)
            return

        if await self._check_duplicate(market_id):
            self.logger.warning(
                f"[LIVE TENNIS] duplicate skipped: {order.get('player1')} vs {order.get('player2')} ({market_id})"
            )
            return

        try:
            live_odds = await asyncio.get_event_loop().run_in_executor(
                None, get_best_back_price, market_id, int(selection_id)
            )
        except Exception as e:
            self.logger.error(f"[LIVE TENNIS] get_best_back_price error: {e}")
            return

        if not live_odds:
            self.logger.error(
                f"[LIVE TENNIS] no Betfair BACK price for {player_name} in market {market_id}"
            )
            return

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, place_bet, market_id, int(selection_id), live_odds, float(order["stake"])
            )
        except Exception as e:
            self.logger.error(f"[LIVE TENNIS] place_bet error: {e}")
            return

        bf_status = result.get("status", "FAILURE")
        instructions = (result.get("instructionReports") or [{}])
        bf_bet_id = None
        if bf_status == "SUCCESS" and instructions:
            bf_bet_id = instructions[0].get("betId") or instructions[0].get("instruction", {}).get("betId")

        if bf_status != "SUCCESS" or not bf_bet_id:
            err = result.get("errorCode", "UNKNOWN")
            self.logger.error(
                f"[LIVE TENNIS] Betfair rejected: {player_name} @ {live_odds} — {err} | {result}"
            )
            return

        try:
            async with AsyncSessionLocal() as session:
                bet = TennisBet(
                    match_id=market_id,
                    selection=order.get("best_selection", "P1"),
                    player_name=player_name,
                    odds=float(live_odds),
                    stake=float(order["stake"]),
                    paper=False,
                    status="pending",
                    betfair_bet_id=bf_bet_id,
                )
                session.add(bet)
                await session.commit()
        except Exception as e:
            self.logger.error(f"[LIVE TENNIS] DB save error: {e}")
            return

        self.logger.info(
            f"[LIVE] TENNIS: {player_name} @ {live_odds:.2f} "
            f"stake={order.get('stake'):.2f}€ edge={order.get('edge', 0):.1%} betId={bf_bet_id}"
        )
        await self._send_alert(order, player_name, live_odds, mode="LIVE")

    async def _send_alert(self, order: dict, player: str | None, odds: float | None, mode: str = "LIVE"):
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        edge = order.get("edge", 0)
        if edge < 0.04:
            return
        try:
            emoji = "🟢" if mode == "LIVE" else "🟡"
            msg = (
                f"🎾 [{mode}] TENNIS BET\n"
                f"{order.get('player1')} vs {order.get('player2')}\n"
                f"▶ {player} @ {odds:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {order.get('stake', 0):.2f}€  |  {order.get('tournament', '')} ({order.get('surface', '').upper()})\n"
                f"{emoji} Mode: {mode}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")
