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
        side = order.get("best_selection", "P1")
        if side == "P1":
            return order.get("player1"), order.get("odds_p1"), order.get("selection_id_p1")
        return order.get("player2"), order.get("odds_p2"), order.get("selection_id_p2")

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

        if settings.EXPERIMENT_MODE:
            # Experiment mode: never write the client-served `tennis_bets` table.
            self.logger.info(
                f"[EXPERIMENT] TENNIS not persisted: {player_name} @ "
                f"{(odds or 2.0):.2f} stake={order.get('stake', 1.0):.2f}€ "
                f"edge={order.get('edge', 0):.1%}"
            )
            return

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
        """Route to Matchbook if configured, otherwise paper."""
        match_id = order.get("match_id", "")
        if match_id.startswith("mb_"):
            await self._execute_live_matchbook(order)
        else:
            self.logger.info(
                f"[TENNIS] no live exchange for market {match_id} — routing to paper"
            )
            await self._execute_paper(order)

    async def _execute_live_matchbook(self, order: dict):
        """Place a live bet on Matchbook Exchange."""
        from core.db import AsyncSessionLocal, TennisBet
        from core import matchbook_client

        player_name, model_odds, runner_id = self._selection_info(order)
        match_id = order.get("match_id", "")

        if not match_id or not runner_id:
            self.logger.error(
                f"[LIVE MATCHBOOK] missing match_id or runner_id for "
                f"{order.get('player1')} vs {order.get('player2')} — falling back to paper"
            )
            await self._execute_paper(order)
            return

        try:
            if await self._check_duplicate(match_id):
                self.logger.warning(
                    f"[LIVE MATCHBOOK] duplicate skipped: {order.get('player1')} vs {order.get('player2')}"
                )
                return
        except Exception as e:
            self.logger.error(f"[LIVE MATCHBOOK] _check_duplicate error: {e}")
            return

        # Use odds from order (fetched in the last 5-min cycle — fresh enough)
        odds = model_odds or 2.0
        stake = float(order.get("stake", 2.0))

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, matchbook_client.place_bet, int(runner_id), odds, stake
            )
        except Exception as e:
            self.logger.error(f"[LIVE MATCHBOOK] place_bet error: {e} — falling back to paper")
            await self._execute_paper(order)
            return

        mb_status = result.get("status", "")
        mb_bet_id = str(result.get("id", "")) if result.get("id") else None

        if mb_status not in ("matched", "open") or not mb_bet_id:
            self.logger.error(
                f"[LIVE MATCHBOOK] bet rejected: {player_name} @ {odds} — status={mb_status} | {result}"
            )
            await self._execute_paper(order)
            return

        matched_odds = float(result.get("odds", odds))

        try:
            async with AsyncSessionLocal() as session:
                bet = TennisBet(
                    match_id=match_id,
                    selection=order.get("best_selection", "P1"),
                    player_name=player_name,
                    odds=matched_odds,
                    stake=stake,
                    paper=False,
                    status="pending",
                    betfair_bet_id=mb_bet_id,  # reuse field for Matchbook bet ID
                )
                session.add(bet)
                await session.commit()
        except Exception as e:
            self.logger.error(f"[LIVE MATCHBOOK] DB save error: {e}")
            return

        self.logger.info(
            f"[LIVE MATCHBOOK] TENNIS: {player_name} @ {matched_odds:.2f} "
            f"stake={stake:.2f}€ edge={order.get('edge', 0):.1%} betId={mb_bet_id}"
        )
        await self._send_alert(order, player_name, matched_odds, mode="LIVE-MB")

    async def _send_alert(self, order: dict, player: str | None, odds: float | None, mode: str = "LIVE"):
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        edge = order.get("edge", 0)
        if edge < 0.04:
            return
        try:
            emoji = "🟢" if mode.startswith("LIVE") else "🟡"
            exchange_tag = "Matchbook" if "MB" in mode else "Paper"
            msg = (
                f"🎾 [{mode}] TENNIS BET — {exchange_tag}\n"
                f"{order.get('player1')} vs {order.get('player2')}\n"
                f"▶ {player} @ {odds:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {order.get('stake', 0):.2f}€  |  {order.get('tournament', '')} ({order.get('surface', '').upper()})\n"
                f"{emoji} Mode: {mode}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")
