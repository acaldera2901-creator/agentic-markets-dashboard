import asyncio
import subprocess
from datetime import datetime, timedelta
from typing import List
from agents.base import BaseAgent
from core.redis_client import get_redis
from core.db import AsyncSessionLocal, Bet
from config.settings import settings
from sqlalchemy import select

AGENT_PROCESSES = [
    "data_collector", "model", "analyst",
    "strategist", "risk_manager", "trader",
]

AGENT_HEARTBEAT_KEYS = {
    "data_collector": "DataCollector",
    "model": "ModelAgent",
    "analyst": "AnalystAgent",
    "strategist": "StrategistAgent",
    "risk_manager": "RiskManagerAgent",
    "trader": "TraderAgent",
}

AGENT_CLASS_NAMES = {
    "data_collector": "DataCollectorAgent",
    "model": "ModelAgent",
    "analyst": "AnalystAgent",
    "strategist": "StrategistAgent",
    "risk_manager": "RiskManagerAgent",
    "trader": "TraderAgent",
}


def is_heartbeat_stale(timestamp_iso: str, timeout_seconds: int = 60) -> bool:
    try:
        ts = datetime.fromisoformat(timestamp_iso)
        return (datetime.utcnow() - ts).total_seconds() > timeout_seconds
    except Exception:
        return True


def compute_pnl(bets: List[dict]) -> float:
    total = 0.0
    for b in bets:
        if b["status"] == "won":
            total += b["stake"] * (b["odds"] - 1)
        elif b["status"] == "lost":
            total -= b["stake"]
    return total


class MonitorAgent(BaseAgent):
    def __init__(self):
        super().__init__("MonitorAgent")
        self._bot = None
        self._last_report = datetime.min

    async def _main_loop(self) -> None:
        await self._init_telegram()
        while self._running:
            await self._check_heartbeats()
            await self._check_anomalies()
            await self._maybe_send_daily_report()
            await asyncio.sleep(30)

    async def _init_telegram(self) -> None:
        if settings.TELEGRAM_BOT_TOKEN:
            try:
                from telegram import Bot
                self._bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
                self.logger.info("Telegram bot initialized")
            except Exception as e:
                self.logger.warning(f"Telegram init failed: {e}")

    async def _send_telegram(self, message: str) -> None:
        if self._bot and settings.TELEGRAM_CHAT_ID:
            try:
                await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=message)
            except Exception as e:
                self.logger.error(f"Telegram send failed: {e}")

    async def _check_heartbeats(self) -> None:
        r = await get_redis()
        for agent_key, hb_key in AGENT_HEARTBEAT_KEYS.items():
            hb = await r.get(f"health:{hb_key}")
            if hb is None or is_heartbeat_stale(hb, settings.HEARTBEAT_TIMEOUT):
                self.logger.warning(f"{hb_key} heartbeat missing — restarting")
                await self._restart_agent(agent_key)
                await self._send_telegram(f"⚠️ {hb_key} crashed — restarted automatically")

    async def _restart_agent(self, agent_name: str) -> None:
        class_name = AGENT_CLASS_NAMES.get(agent_name, "")
        if not class_name:
            return
        try:
            subprocess.Popen(
                [
                    ".venv/bin/python", "-c",
                    f"import asyncio; from agents.{agent_name} import {class_name}; asyncio.run({class_name}().run())"
                ],
                start_new_session=True,
                cwd="/Users/calde/Desktop/sistema-andrea/agentic-markets",
            )
        except Exception as e:
            self.logger.error(f"restart failed for {agent_name}: {e}")

    async def _check_anomalies(self) -> None:
        r = await get_redis()
        exists = await r.exists("model:probabilities")
        if not exists:
            return
        try:
            info = await r.xinfo_stream("model:probabilities")
            last_id = info.get("last-generated-id", "0-0")
            last_ms = last_id.split("-")[0]
            if last_ms != "0":
                last_ts = datetime.utcfromtimestamp(int(last_ms) / 1000)
                if (datetime.utcnow() - last_ts).total_seconds() > 3600:
                    self.logger.warning("model:probabilities stream silent for >1h")
                    await self._send_telegram("⚠️ Model Agent has not published in 1 hour")
        except Exception as e:
            self.logger.error(f"anomaly check error: {e}")

    async def _maybe_send_daily_report(self) -> None:
        now = datetime.utcnow()
        if now.hour == 8 and (now - self._last_report).total_seconds() > 3600:
            report = await self._build_report()
            await self._send_telegram(report)
            self._last_report = now

    async def _build_report(self) -> str:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Bet))
            bets = result.scalars().all()

        bet_dicts = [{"stake": b.stake, "odds": b.odds, "status": b.status} for b in bets]
        pnl = compute_pnl(bet_dicts)
        won = sum(1 for b in bet_dicts if b["status"] == "won")
        lost = sum(1 for b in bet_dicts if b["status"] == "lost")
        total = won + lost
        win_rate = (won / total * 100) if total > 0 else 0
        mode = "PAPER" if settings.PAPER_TRADING else "LIVE"

        return (
            f"📊 Agentic Markets Daily Report [{mode}]\n"
            f"Total bets: {total} | Won: {won} | Lost: {lost}\n"
            f"Win rate: {win_rate:.1f}%\n"
            f"P&L: {'+'if pnl>=0 else ''}{pnl:.2f}€\n"
            f"Bankroll: {settings.BANKROLL:.0f}€"
        )
