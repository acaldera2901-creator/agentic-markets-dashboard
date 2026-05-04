import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from config.settings import settings


def kelly_stake(
    edge: float,
    odds: float,
    bankroll: float,
    kelly_fraction: float,
    max_fraction: float | None = None,
) -> float:
    if edge <= 0:
        return 0.0
    kelly = edge / (odds - 1)
    stake = kelly * kelly_fraction * bankroll
    cap = (max_fraction if max_fraction is not None else settings.MAX_BET_FRACTION) * bankroll
    return min(stake, cap)


def is_within_limits(current_exposure: float, new_stake: float, bankroll: float, max_exposure: float) -> bool:
    return (current_exposure + new_stake / bankroll) <= max_exposure


class RiskManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__("RiskManagerAgent")
        self._current_exposure: float = 0.0
        self._monthly_pnl: float = 0.0

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("strategy:approved", "risk_group", "RiskManagerAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            if self._monthly_pnl < -settings.MAX_MONTHLY_DRAWDOWN * settings.BANKROLL:
                self.logger.warning("monthly drawdown limit hit — blocking all new bets")
                return

            edge = float(data["edge"])
            odds = float(data["odds"])
            stake = kelly_stake(edge, odds, settings.BANKROLL, settings.KELLY_FRACTION)

            if stake < 1.0:
                self.logger.info(f"stake too small ({stake:.2f}), skipping")
                return

            if not is_within_limits(self._current_exposure, stake, settings.BANKROLL, settings.MAX_TOTAL_EXPOSURE):
                self.logger.warning(f"exposure limit reached, skipping {data['home_team']} vs {data['away_team']}")
                return

            order = {
                **data,
                "stake": str(round(stake, 2)),
                "sized_at": datetime.utcnow().isoformat(),
            }
            self._current_exposure += stake / settings.BANKROLL
            await publish("risk:orders", order)
            self.logger.info(f"order approved: {data['home_team']} vs {data['away_team']} stake={stake:.2f}")
        except Exception as e:
            self.logger.error(f"risk manager error: {e}")
