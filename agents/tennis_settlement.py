"""
TennisSettlementAgent: polls settled Betfair tennis markets, updates Elo ratings.

Runs every 5 minutes. For each TennisPrediction older than 4 hours without an outcome:
  1. Checks Betfair for settlement (runner status=WINNER)
  2. Calls EloSurfaceModel.update(winner, loser, surface)
  3. Persists updated Elo ratings to DB
  4. Marks TennisPrediction outcome/winner/settled_at
  5. Settles pending TennisBet records (won/lost + profit_loss)
"""
import asyncio
import logging
from datetime import datetime, timedelta

from agents.base import BaseAgent
from core.betfair_client import is_configured
from core.db import AsyncSessionLocal, TennisPrediction, TennisBet
from core.tennis_betfair_client import get_settled_results
from models.elo_surface import EloSurfaceModel
from sqlalchemy import select

logger = logging.getLogger(__name__)

SETTLEMENT_DELAY_HOURS = 4
POLL_INTERVAL = 300
BETFAIR_BATCH = 50


class TennisSettlementAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisSettlementAgent")
        self._elo = EloSurfaceModel()

    async def _main_loop(self):
        while self._running:
            await self._settlement_cycle()
            await asyncio.sleep(POLL_INTERVAL)

    async def _settlement_cycle(self):
        if not is_configured():
            return

        async with AsyncSessionLocal() as session:
            await self._elo.load_from_db_async(session)

        pending = await self._get_unsettled_predictions()
        if not pending:
            return

        updated = 0
        market_ids = [p.match_id for p in pending]
        for i in range(0, len(market_ids), BETFAIR_BATCH):
            updated += await self._process_batch(
                market_ids[i:i + BETFAIR_BATCH],
                {p.match_id: p for p in pending},
            )

        if updated:
            async with AsyncSessionLocal() as session:
                await self._elo.save_to_db_async(session)
            self.logger.info(f"[SETTLEMENT] settled {updated} match(es), Elo ratings saved")

    async def _get_unsettled_predictions(self) -> list:
        cutoff = datetime.utcnow() - timedelta(hours=SETTLEMENT_DELAY_HOURS)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at <= cutoff,
                )
            )
            return result.scalars().all()

    async def _process_batch(
        self, batch_ids: list[str], pred_by_id: dict[str, TennisPrediction]
    ) -> int:
        try:
            settled = get_settled_results(batch_ids)
        except Exception as e:
            self.logger.error(f"get_settled_results error: {e}")
            return 0

        count = 0
        for mid, position in settled.items():
            if not position:
                continue
            pred = pred_by_id.get(mid)
            if not pred:
                continue

            # position is "P1" or "P2" — runner order matches player1/player2
            if position == "P1":
                outcome = "P1_WIN"
                winner_name = pred.player1
                loser_name = pred.player2
            else:
                outcome = "P2_WIN"
                winner_name = pred.player2
                loser_name = pred.player1

            surface = pred.surface or "hard"
            self._elo.update(winner_name, loser_name, surface)

            await self._update_prediction(pred.id, outcome, winner_name)
            await self._settle_bets(mid, outcome)

            self.logger.info(
                f"[SETTLEMENT] {pred.player1} vs {pred.player2} → "
                f"{winner_name} ({outcome}, surface={surface})"
            )
            count += 1

        return count

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
