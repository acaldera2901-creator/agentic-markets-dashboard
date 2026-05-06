import asyncio
import json
import math
import subprocess
from datetime import datetime, timedelta
from typing import List
from agents.base import BaseAgent
from core.redis_client import get_redis
from core.db import AsyncSessionLocal, Bet
from config.settings import settings
from sqlalchemy import select, text

# Features monitored by PSI
PSI_FEATURES = ["xg_home_last5", "xg_away_last5", "odds_movement", "pi_rating_diff"]

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
        self._last_psi_check = datetime.min
        self._last_monte_carlo = datetime.min

    async def _main_loop(self) -> None:
        await self._init_telegram()
        while self._running:
            await self._check_heartbeats()
            await self._check_anomalies()
            await self._maybe_send_daily_report()
            await self._maybe_run_psi()
            await self._maybe_run_monte_carlo()
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

    # ── PSI Monitoring ────────────────────────────────────────────────────────

    async def _maybe_run_psi(self) -> None:
        """Run PSI check every 24h."""
        now = datetime.utcnow()
        if (now - self._last_psi_check).total_seconds() < 86_400:
            return
        self._last_psi_check = now
        await self._compute_psi()

    @staticmethod
    def _compute_psi_value(baseline: list[float], current: list[float], bins: int = 10) -> float:
        """Population Stability Index between two distributions."""
        if not baseline or not current:
            return 0.0
        all_vals = baseline + current
        mn, mx = min(all_vals), max(all_vals)
        if mn == mx:
            return 0.0
        edges = [mn + (mx - mn) * i / bins for i in range(bins + 1)]
        def bucket(vals: list[float]) -> list[float]:
            counts = [0] * bins
            for v in vals:
                idx = min(int((v - mn) / (mx - mn) * bins), bins - 1)
                counts[idx] += 1
            total = len(vals) or 1
            return [max(c / total, 1e-4) for c in counts]

        b_pct = bucket(baseline)
        c_pct = bucket(current)
        return sum((c - b) * math.log(c / b) for c, b in zip(c_pct, b_pct))

    async def _compute_psi(self) -> None:
        """Compute PSI for key features comparing baseline vs last 7 days."""
        try:
            async with AsyncSessionLocal() as session:
                # Check table exists before querying
                tbl_check = await session.execute(
                    text("SELECT to_regclass('public.match_predictions')")
                )
                if tbl_check.scalar() is None:
                    self.logger.debug("PSI: match_predictions table not in local DB — skipping")
                    return

                # Baseline: first 30 days of predictions
                baseline_rows = await session.execute(
                    text("""
                        SELECT enrichment FROM match_predictions
                        WHERE computed_at < (SELECT MIN(computed_at) FROM match_predictions) + INTERVAL '30 days'
                        AND enrichment IS NOT NULL
                        LIMIT 500
                    """)
                )
                # Current: last 7 days
                current_rows = await session.execute(
                    text("""
                        SELECT enrichment FROM match_predictions
                        WHERE computed_at > NOW() - INTERVAL '7 days'
                        AND enrichment IS NOT NULL
                        LIMIT 500
                    """)
                )
                baselines = [r[0] for r in baseline_rows if r[0]]
                currents = [r[0] for r in current_rows if r[0]]

            if len(baselines) < 10 or len(currents) < 10:
                return  # not enough data yet

            psi_results = {}
            feature_map = {
                "xg_home_last5": "xg_home",
                "xg_away_last5": "xg_away",
                "odds_movement": "edge",
                "pi_rating_diff": "pi_home",
            }
            for feat, key in feature_map.items():
                b_vals = [float(r.get(key, 0) or 0) for r in baselines if r.get(key) is not None]
                c_vals = [float(r.get(key, 0) or 0) for r in currents if r.get(key) is not None]
                if b_vals and c_vals:
                    psi = self._compute_psi_value(b_vals, c_vals)
                    psi_results[feat] = round(psi, 4)

            warnings = []
            for feat, psi in psi_results.items():
                if psi > settings.PSI_CRITICAL_THRESHOLD:
                    warnings.append(f"🔴 CRITICAL PSI {feat}={psi:.4f}")
                elif psi > settings.PSI_WARNING_THRESHOLD:
                    warnings.append(f"🟡 WARNING PSI {feat}={psi:.4f}")

            if warnings:
                msg = "PSI Distribution Drift Detected:\n" + "\n".join(warnings)
                self.logger.warning(msg)
                await self._send_telegram(msg)
            else:
                self.logger.info(f"PSI check OK: {psi_results}")
        except Exception as e:
            self.logger.error(f"PSI computation error: {e}")

    # ── Monte Carlo Bankroll Simulation ───────────────────────────────────────

    async def _maybe_run_monte_carlo(self) -> None:
        """Run Monte Carlo simulation every Sunday night (weekday 6 = Sunday)."""
        now = datetime.utcnow()
        is_sunday_night = now.weekday() == 6 and now.hour == 23
        if not is_sunday_night:
            return
        if (now - self._last_monte_carlo).total_seconds() < 3600:
            return
        self._last_monte_carlo = now
        await self._run_monte_carlo()

    async def _run_monte_carlo(self) -> None:
        """Simulate 500-bet P&L distribution using historical edge% and stake%."""
        try:
            import random
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    text("""
                        SELECT stake, odds, status FROM bets
                        WHERE placed_at > NOW() - INTERVAL '90 days'
                        ORDER BY placed_at DESC
                        LIMIT 500
                    """)
                )
                bets = result.fetchall()

            if len(bets) < 10:
                return

            # Build empirical distribution of (stake_pct, edge_proxy)
            samples = []
            for row in bets:
                stake_pct = row[0] / settings.BANKROLL
                odds = row[1]
                # Approximate edge from status (positive for won, negative for lost)
                status = row[2]
                win_prob = 1.0 / odds if odds > 1 else 0
                samples.append((stake_pct, win_prob))

            results = []
            for _ in range(1000):  # 1000 simulations
                bankroll = settings.BANKROLL
                for _ in range(500):
                    stake_pct, win_prob = random.choice(samples)
                    stake = stake_pct * bankroll
                    if random.random() < win_prob:
                        odds_sample = 1.0 / win_prob if win_prob > 0 else 2.0
                        bankroll += stake * (odds_sample - 1)
                    else:
                        bankroll -= stake
                results.append(bankroll - settings.BANKROLL)

            results.sort()
            p5 = results[int(len(results) * 0.05)]
            p50 = results[int(len(results) * 0.50)]
            p95 = results[int(len(results) * 0.95)]

            mc_result = {
                "generated_at": now.isoformat(),
                "n_simulations": 1000,
                "n_bets": 500,
                "p5_pnl": round(p5, 2),
                "p50_pnl": round(p50, 2),
                "p95_pnl": round(p95, 2),
                "bankroll_start": settings.BANKROLL,
            }

            # Persist result
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("""
                        CREATE TABLE IF NOT EXISTS monte_carlo_results (
                            id SERIAL PRIMARY KEY,
                            result JSONB NOT NULL,
                            generated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                    """)
                )
                await session.execute(
                    text("INSERT INTO monte_carlo_results (result) VALUES (:r::jsonb)"),
                    {"r": json.dumps(mc_result)},
                )
                await session.commit()

            msg = (
                f"🎲 Monte Carlo (500 bets, 1000 sims)\n"
                f"P5: {p5:+.2f}€ | P50: {p50:+.2f}€ | P95: {p95:+.2f}€"
            )
            self.logger.info(msg)
            await self._send_telegram(msg)
        except Exception as e:
            self.logger.error(f"Monte Carlo error: {e}")
