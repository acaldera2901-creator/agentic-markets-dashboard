import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.db import AsyncSessionLocal, Bet
from config.settings import settings


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

    async def _send_value_bet_alert(self, order: dict) -> None:
        """Send Telegram alert for value bets above edge threshold."""
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        try:
            edge = float(order.get("edge", 0))
            if edge < settings.TELEGRAM_VALUE_EDGE_THRESHOLD:
                return
            ci_low = float(order.get("ci_low", 0))
            ci_high = float(order.get("ci_high", 1))
            match = f"{order.get('home_team')} vs {order.get('away_team')}"
            sel = order.get("selection", "?").upper()
            odds = float(order.get("odds", 0))
            stake = float(order.get("stake", 0))
            p_sel = order.get("p_home" if sel == "HOME" else "p_draw" if sel == "DRAW" else "p_away", 0)
            tier = order.get("market_efficiency_tier", "soft")
            mode = "PAPER" if settings.PAPER_TRADING else "LIVE"
            msg = (
                f"🎯 [{mode}] {match}\n"
                f"Bet: {sel} | p={float(p_sel):.2f} | Odds={odds:.2f}\n"
                f"Edge=+{edge*100:.1f}% | Stake={stake:.2f}u\n"
                f"Conf: [{ci_low:.2f}-{ci_high:.2f}] | Tier: {tier}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")

    async def _process(self, data: dict) -> None:
        try:
            if settings.PAPER_TRADING:
                await self._execute_paper(data)
            else:
                await self._execute_live(data)
        except Exception as e:
            self.logger.error(f"trader error: {e}")

    def _lookup_betfair(self, order: dict) -> tuple[str, int]:
        """Try to find Betfair market_id and selection_id. Returns ("", 0) on failure."""
        try:
            from core.betfair_client import find_market, is_configured
            if not is_configured():
                return "", 0
            result = find_market(order["home_team"], order["away_team"], order.get("league", "SA"))
            if result:
                selection = order.get("selection", "home")
                runner_id = result["runner_map"].get(selection, 0)
                return result["market_id"], runner_id
        except Exception as e:
            self.logger.warning(f"betfair lookup failed: {e}")
        return "", 0

    async def _execute_paper(self, order: dict) -> None:
        market_id, runner_id = await asyncio.get_event_loop().run_in_executor(
            None, self._lookup_betfair, order
        )
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
            "betfair_market_id": market_id,
            "betfair_selection_id": str(runner_id),
            "paper": "true",
            "executed_at": datetime.utcnow().isoformat(),
        }
        await publish("trader:executions", execution)
        await self._send_value_bet_alert(order)
        bf_info = f" [BF:{market_id}]" if market_id else ""
        self.logger.info(
            f"[PAPER] placed: {order['home_team']} vs {order['away_team']} "
            f"{order['selection']} @ {order['odds']} stake={order['stake']}{bf_info}"
        )

    async def _execute_live(self, order: dict) -> None:
        from core.betfair_client import place_bet
        market_id = order.get("betfair_market_id", "")
        runner_id = int(order.get("betfair_selection_id", 0))
        if not market_id or not runner_id:
            market_id, runner_id = await asyncio.get_event_loop().run_in_executor(
                None, self._lookup_betfair, order
            )
        result = place_bet(
            market_id=market_id,
            selection_id=runner_id,
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
        await self._send_value_bet_alert(order)
        self.logger.info(f"[LIVE] placed: {order['home_team']} vs {order['away_team']} stake={order['stake']}")
