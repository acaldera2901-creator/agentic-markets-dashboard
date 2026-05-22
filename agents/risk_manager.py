import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.telegram_client import send as tg_send, match_header
from context.competition_factors import apply_factors
from risk.engine import RiskManagerEngine
from risk.kelly import kelly_stake
from config.settings import settings

# Features used for data completeness scoring
EXPECTED_FEATURES = [
    "match_id", "league", "home_team", "away_team", "kickoff",
    "edge", "odds", "selection", "confidence", "p_home", "p_draw", "p_away",
]


def resolve_edge_threshold(data: dict) -> tuple[float, str]:
    """
    Returns (min_edge, market_efficiency_tier) based on odds source.
    Pinnacle / sharp lines → tighter edge requirement.
    """
    notes = str(data.get("notes", "")).lower()
    source = str(data.get("source", "")).lower()
    sharp_keywords = ("pinnacle", "matchbook", "exchange", "sharp")
    if any(k in notes or k in source for k in sharp_keywords):
        return settings.EDGE_MIN_SHARP, "sharp"
    return settings.EDGE_MIN_SOFT, "soft"


def data_completeness_score(data: dict) -> tuple[float, list[str]]:
    """Returns (score 0-1, list of missing fields)."""
    missing = [f for f in EXPECTED_FEATURES if not data.get(f)]
    score = (len(EXPECTED_FEATURES) - len(missing)) / len(EXPECTED_FEATURES)
    return round(score, 3), missing


def is_within_limits(current_exposure: float, new_stake: float, bankroll: float, max_exposure: float) -> bool:
    return (current_exposure + new_stake / bankroll) <= max_exposure


class RiskManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__("RiskManagerAgent")
        self._engine = RiskManagerEngine(initial_bankroll=settings.BANKROLL)
        self._cumulative_pnl: float = 0.0

    async def _main_loop(self) -> None:
        # Restore cumulative P&L from DB so bankroll is correct after restarts
        try:
            from core.db import get_cumulative_pnl
            self._cumulative_pnl = await get_cumulative_pnl()
            self.logger.info(f"bankroll restored: {settings.BANKROLL + self._cumulative_pnl:.2f}€ "
                             f"(base {settings.BANKROLL:.2f} + P&L {self._cumulative_pnl:+.2f})")
        except Exception as e:
            self.logger.warning(f"could not restore P&L from DB: {e}")

        # Run both consumers concurrently
        await asyncio.gather(
            self._consume_strategy(),
            self._consume_settlements(),
        )

    async def _consume_strategy(self) -> None:
        while self._running:
            messages = await consume("strategy:approved", "risk_group", "RiskManagerAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _consume_settlements(self) -> None:
        """Release exposure and update bankroll when bets are settled."""
        while self._running:
            messages = await consume("settlement:results", "risk_settlement_group", "RiskManagerAgent")
            for _, entries in messages:
                for _, event in entries:
                    await self._handle_settlement(event)

    async def _handle_settlement(self, event: dict) -> None:
        try:
            league_id = str(event.get("league_id", ""))
            matchday_id = str(event.get("matchday_id", ""))
            stake = float(event.get("stake", 0.0))
            pl = float(event.get("profit_loss", 0.0))
            outcome = str(event.get("outcome", ""))

            # Release exposure so future bets aren't blocked by old open positions
            if league_id and matchday_id and stake:
                self._engine.release(league_id, matchday_id, stake)

            # Update tracked P&L so circuit breaker sees real bankroll
            self._cumulative_pnl += pl

            new_bankroll = settings.BANKROLL + self._cumulative_pnl
            self._engine._circuit_breaker.update(new_bankroll)

            self.logger.info(
                f"settlement processed: outcome={outcome} pl={pl:+.2f}€ "
                f"bankroll={new_bankroll:.2f}€"
            )
        except Exception as e:
            self.logger.error(f"settlement handling error: {e}")

    async def _process(self, data: dict) -> None:
        try:
            # Auto-skip CLV suspension (context module signal — checked before engine)
            auto_skip = data.get("auto_skip_reason", "")
            if auto_skip and data.get("suspend_recommended") in (True, "True"):
                self.logger.warning(f"AUTO-SKIP: {auto_skip}")
                await tg_send(
                    f"⏸ <b>AUTO-SKIP</b>\n"
                    f"{match_header(data)}\n"
                    f"📋 {auto_skip}"
                )
                return

            # Adaptive edge threshold by market tier
            edge = float(data.get("edge", 0.0))
            edge_threshold, tier = resolve_edge_threshold(data)
            if edge < edge_threshold:
                self.logger.info(
                    f"edge {edge:.3f} < {edge_threshold:.3f} ({tier}) — "
                    f"skipping {data.get('home_team')} vs {data.get('away_team')}"
                )
                return

            # Derive matchday from kickoff
            kickoff = str(data.get("kickoff", ""))
            matchday_id = kickoff[:10] if kickoff else "unknown"

            # RiskManagerEngine — composite decision
            current_bankroll = settings.BANKROLL + self._cumulative_pnl
            decision = self._engine.evaluate(data, current_bankroll, matchday_id)

            if not decision.approved:
                reason = decision.skip_reason or "no reason"
                self.logger.warning(
                    f"bet rejected: {data.get('home_team')} vs {data.get('away_team')} — {reason}"
                )
                if decision.circuit_state.level.value != "NONE":
                    await tg_send(
                        f"⚪ <b>NESSUN BET</b> — {reason}\n"
                        f"{match_header(data)}\n"
                        f"🔴 Circuit: {decision.circuit_state.level.value}  "
                        f"drawdown: {decision.circuit_state.drawdown:.1%}"
                    )
                return

            stake = decision.final_stake

            # Register open stake in engine
            win_prob = float(data.get(f"p_{data.get('selection','home')}", 0.5))
            self._engine.commit(
                league_id=decision.league_id,
                matchday_id=matchday_id,
                stake=stake,
                win_probability=win_prob,
            )

            order = {
                **data,
                "stake": str(round(stake, 2)),
                "matchday_id": matchday_id,
                "market_efficiency_tier": tier,
                "data_completeness": str(decision.factors["data_completeness"]),
                "sized_at": datetime.utcnow().isoformat(),
                "composite_multiplier": str(round(decision.composite_multiplier, 4)),
                "circuit_level": decision.circuit_state.level.value,
                "drawdown": str(round(decision.circuit_state.drawdown, 4)),
                "league_tier": data.get("league_tier", ""),
                "auto_skip_reason": data.get("auto_skip_reason", ""),
                "odds_anomaly": data.get("odds_anomaly", "False"),
            }
            await publish("risk:orders", order)
            self.logger.info(
                f"order: {data.get('home_team')} vs {data.get('away_team')} "
                f"stake={stake:.2f} base={decision.base_stake:.2f} "
                f"multiplier={decision.composite_multiplier:.3f} tier={tier} edge={edge:.3f}"
            )
        except Exception as e:
            self.logger.error(f"risk manager error: {e}")

    async def _log_dead_letter(self, data: dict, missing: list, score: float) -> None:
        try:
            from core.db import AsyncSessionLocal
            from sqlalchemy import text
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("""
                        CREATE TABLE IF NOT EXISTS dead_letter_predictions (
                            id SERIAL PRIMARY KEY,
                            match_id VARCHAR,
                            data JSONB,
                            missing_fields TEXT[],
                            completeness_score FLOAT,
                            logged_at TIMESTAMPTZ DEFAULT NOW()
                        )
                    """)
                )
                await session.execute(
                    text("""
                        INSERT INTO dead_letter_predictions (match_id, data, missing_fields, completeness_score)
                        VALUES (:match_id, :data::jsonb, :missing, :score)
                    """),
                    {
                        "match_id": data.get("match_id", ""),
                        "data": str(data),
                        "missing": missing,
                        "score": score,
                    }
                )
                await session.commit()
        except Exception as e:
            self.logger.debug(f"dead letter log failed: {e}")
