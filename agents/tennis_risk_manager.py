import asyncio
import json
from datetime import datetime, timezone

from agents.base import BaseAgent
from core.redis_client import get_redis
from config.settings import settings
from risk.kelly import kelly_stake

# Minimum exchange ticket size (Betfair/Matchbook back min).
TENNIS_MIN_STAKE = 2.0


class TennisRiskManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisRiskManagerAgent")
        self._pnl = 0.0

    async def _main_loop(self):
        while self._running:
            await self._sizing_cycle()
            await asyncio.sleep(300)

    async def _refresh_pnl(self):
        """Load real settled tennis P&L so the drawdown guard sees live bankroll.

        Paper-only at launch: read the paper ledger, kept separate from live.
        """
        try:
            from core.db import get_tennis_cumulative_pnl
            self._pnl = await get_tennis_cumulative_pnl(paper=True)
        except Exception as e:
            self.logger.warning(f"tennis P&L refresh failed (non-fatal): {e}")

    async def _sizing_cycle(self):
        await self._refresh_pnl()
        r = await get_redis()
        raw = await r.get("tennis:opportunities")
        if not raw:
            return

        data = json.loads(raw)
        opportunities = data.get("opportunities", [])

        bankroll = settings.BANKROLL + self._pnl

        TENNIS_DRAWDOWN_LIMIT = getattr(settings, "TENNIS_DRAWDOWN_LIMIT", 0.12)
        if self._pnl < -(bankroll * TENNIS_DRAWDOWN_LIMIT):
            self.logger.warning("TennisRiskManager: drawdown limit reached — blocking all bets")
            return

        TENNIS_MAX_BET_PCT = getattr(settings, "TENNIS_MAX_BET_PCT", 0.20)
        TENNIS_KELLY_FRACTION = getattr(settings, "TENNIS_KELLY_FRACTION", 0.25)

        orders = []
        for opp in opportunities:
            edge = opp.get("edge", 0)
            odds = opp.get("odds_p1") if opp.get("best_selection") == "P1" else opp.get("odds_p2", 2.0)

            if not odds or edge <= 0:
                continue

            # kelly_stake signature: (edge, odds, bankroll, kelly_fraction, max_bet_pct)
            stake = kelly_stake(edge, odds, bankroll, TENNIS_KELLY_FRACTION, TENNIS_MAX_BET_PCT)
            stake = min(stake, bankroll * TENNIS_MAX_BET_PCT)
            # Kelly sized this to ~0 → no real edge after fractioning, skip it.
            # Only round UP to the exchange minimum when Kelly already wants a
            # positive stake (never as a blanket override that bets on noise).
            if stake <= 0:
                continue
            stake = round(max(stake, TENNIS_MIN_STAKE), 2)

            orders.append({
                **opp,
                "stake": stake,
                "bankroll": bankroll,
                "risk_approved": True,
                "risk_ts": datetime.now(timezone.utc).isoformat(),
            })

        if orders:
            payload = json.dumps({
                "orders": orders,
                "count": len(orders),
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            await r.set("tennis:orders", payload, ex=600)
            self.logger.info(f"TennisRiskManager: {len(orders)} orders sized (bankroll={bankroll:.2f}€)")
