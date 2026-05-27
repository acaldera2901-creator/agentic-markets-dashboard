"""
TennisSettlementAgent — resolves tennis match outcomes and settles paper bets.

Without a live exchange:
  1. On first run, bulk-expires all predictions older than EXPIRE_AFTER_DAYS
     (old Betfair market IDs are gone — no way to resolve them).
  2. For recent predictions (< EXPIRE_AFTER_DAYS, > SETTLEMENT_DELAY_HOURS),
     attempts resolution via Matchbook settled markets if configured.
  3. Predictions that can't be resolved are left pending until they expire.

Runs every POLL_INTERVAL seconds.
"""
import asyncio
import logging
from datetime import datetime, timedelta

from agents.base import BaseAgent
from core.db import AsyncSessionLocal, TennisPrediction, TennisBet
from models.elo_surface import EloSurfaceModel
from sqlalchemy import select, update

SETTLEMENT_DELAY_HOURS = 4
EXPIRE_AFTER_DAYS = 7
POLL_INTERVAL = 300

logger = logging.getLogger(__name__)


class TennisSettlementAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisSettlementAgent")
        self._elo = EloSurfaceModel()
        self._stale_expired = False  # run bulk-expire once per process lifetime

    async def _main_loop(self):
        while self._running:
            await self._settlement_cycle()
            await asyncio.sleep(POLL_INTERVAL)

    async def _settlement_cycle(self):
        if not self._stale_expired:
            await self._bulk_expire_stale()
            self._stale_expired = True

        await self._settle_recent()

    async def _bulk_expire_stale(self):
        """Mark all predictions older than EXPIRE_AFTER_DAYS as 'expired' in one query."""
        cutoff = datetime.utcnow() - timedelta(days=EXPIRE_AFTER_DAYS)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                update(TennisPrediction)
                .where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at < cutoff,
                )
                .values(outcome="expired", settled_at=datetime.utcnow())
            )
            await session.commit()
            n = result.rowcount
        if n:
            self.logger.info(
                f"[SETTLEMENT] bulk-expired {n} stale predictions (> {EXPIRE_AFTER_DAYS}d old)"
            )

    async def _settle_recent(self):
        """Attempt settlement for predictions within the last EXPIRE_AFTER_DAYS days."""
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=SETTLEMENT_DELAY_HOURS)
        max_age = now - timedelta(days=EXPIRE_AFTER_DAYS)

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at <= cutoff,
                    TennisPrediction.computed_at >= max_age,
                )
            )
            pending = result.scalars().all()

        if not pending:
            return

        resolved = await self._resolve_via_matchbook(pending)
        if not resolved:
            return

        async with AsyncSessionLocal() as session:
            await self._elo.load_from_db_async(session)

        updated = 0
        for pred, winner_position in resolved:
            outcome = "P1_WIN" if winner_position == "P1" else "P2_WIN"
            winner_name = pred.player1 if winner_position == "P1" else pred.player2
            loser_name = pred.player2 if winner_position == "P1" else pred.player1
            surface = pred.surface or "hard"
            self._elo.update(winner_name, loser_name, surface)
            await self._update_prediction(pred.id, outcome, winner_name)
            await self._settle_bets(pred.match_id, outcome)
            updated += 1

        if updated:
            async with AsyncSessionLocal() as session:
                await self._elo.save_to_db_async(session)
            self.logger.info(f"[SETTLEMENT] settled {updated} recent match(es), Elo updated")

    async def _resolve_via_matchbook(self, pending: list) -> list[tuple]:
        """
        Resolve outcomes from Matchbook settled markets (if configured).
        Returns list of (TennisPrediction, "P1"|"P2") for resolved matches.
        When no exchange is configured, returns empty list gracefully.
        """
        try:
            from core import matchbook_client
            if not matchbook_client.is_configured():
                return []
            if not hasattr(matchbook_client, "get_settled_tennis_result"):
                return []
        except Exception:
            return []

        resolved = []
        for pred in pending:
            try:
                result = await asyncio.to_thread(
                    matchbook_client.get_settled_tennis_result,
                    pred.player1,
                    pred.player2,
                    pred.computed_at,
                )
                if result in ("P1", "P2"):
                    resolved.append((pred, result))
            except Exception as e:
                self.logger.debug(f"matchbook settle lookup failed: {e}")
        return resolved

    async def _update_prediction(self, pred_id: int, outcome: str, winner: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(TennisPrediction.id == pred_id)
            )
            pred = result.scalar_one_or_none()
            if pred:
                pred.outcome = outcome
                pred.winner = winner
                pred.settled_at = datetime.utcnow()
                await session.commit()

    async def _settle_bets(self, match_id: str, outcome: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisBet).where(
                    TennisBet.match_id == match_id,
                    TennisBet.status == "pending",
                )
            )
            bets = result.scalars().all()
            for bet in bets:
                won = bet.selection == outcome[:2]  # "P1" or "P2"
                bet.status = "won" if won else "lost"
                bet.profit_loss = round(bet.stake * (bet.odds - 1), 4) if won else -bet.stake
            if bets:
                await session.commit()
