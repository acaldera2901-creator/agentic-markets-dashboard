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

    async def _send_bet_placed_alert(self, order: dict, bet_id: str, bf_result: dict | None = None) -> None:
        """Single Telegram alert sent only after bet is confirmed placed."""
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
            mode = "PAPER" if settings.PAPER_TRADING else "LIVE"
            bf_id = ""
            if bf_result:
                reports = bf_result.get("instructionReports", [])
                bf_id = reports[0].get("betId", "") if reports else ""
            id_line = f"BetID: {bf_id}" if bf_id else f"DB#{bet_id}"
            msg = (
                f"✅ [{mode}] {match}\n"
                f"{sel} @ {odds:.2f}  |  p={p_sel:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {stake:.2f}€  |  {id_line}"
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
        kickoff = str(order.get("kickoff", ""))
        async with AsyncSessionLocal() as session:
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
            "betfair_market_id": market_id,
            "betfair_selection_id": str(runner_id),
            "paper": "true",
            "executed_at": datetime.utcnow().isoformat(),
        }
        await publish("trader:executions", execution)
        await self._send_bet_placed_alert(order, str(bet.id))
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

        if not market_id or not runner_id:
            self.logger.error(
                f"[LIVE] market not found on Betfair: "
                f"{order.get('home_team')} vs {order.get('away_team')}"
            )
            return

        result = await asyncio.get_event_loop().run_in_executor(
            None, place_bet,
            market_id, runner_id, float(order["odds"]), float(order["stake"])
        )

        # Verify Betfair confirmed the bet
        bf_status = result.get("status", "FAILURE")
        reports = result.get("instructionReports", [])
        bf_bet_id = reports[0].get("betId", "") if reports else ""
        if bf_status != "SUCCESS" or not bf_bet_id:
            err = result.get("errorCode", "UNKNOWN")
            self.logger.error(
                f"[LIVE] Betfair rejected bet: "
                f"{order.get('home_team')} vs {order.get('away_team')} — {err} | full: {result}"
            )
            return

        kickoff = str(order.get("kickoff", ""))
        async with AsyncSessionLocal() as session:
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
                paper=False,
                status="pending",
                thesis=order.get("thesis", ""),
                betfair_bet_id=bf_bet_id,
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()

        await publish("trader:executions", {**order, "paper": "false", "executed_at": datetime.utcnow().isoformat()})
        await self._send_bet_placed_alert(order, str(bet.id), result)
        self.logger.info(
            f"[LIVE] placed: {order['home_team']} vs {order['away_team']} "
            f"stake={order['stake']} betId={bf_bet_id}"
        )
