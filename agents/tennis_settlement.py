"""
TennisSettlementAgent — resolves tennis match outcomes and settles paper bets.

Resolution order per cycle:
  1. On first run, bulk-expires all predictions older than EXPIRE_AFTER_DAYS
     (old Betfair market IDs are gone — no way to resolve them).
  2. For recent predictions (< EXPIRE_AFTER_DAYS, > SETTLEMENT_DELAY_HOURS):
     Matchbook settled markets when configured, otherwise ESPN completed
     results (the live data source — "A bt B" notes carry the winner).
  3. Predictions that can't be resolved are left pending until they expire.

Every settlement (win/loss AND expiry) is bridged to the served
unified_predictions row so the public track record (/api/v2/history)
includes tennis — without the bridge those rows stay un-historical forever
(the unified settlement cycle in ResultSettlementAgent is football-only).

Runs every POLL_INTERVAL seconds.
"""
import asyncio
import logging
from datetime import datetime, timedelta

from agents.base import BaseAgent
from core.db import AsyncSessionLocal, TennisPrediction, TennisBet
from core.espn_tennis_client import get_completed_results
from core.supabase_client import settle_unified_tennis
from core.tennis_names import canonical_player_key
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
            # Collect match_ids BEFORE the update so the unified rows can be
            # voided too (the public history must not keep them open forever).
            stale_ids = [
                row[0] for row in (
                    await session.execute(
                        select(TennisPrediction.match_id).where(
                            TennisPrediction.outcome.is_(None),
                            TennisPrediction.computed_at < cutoff,
                        )
                    )
                ).all()
            ]
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
        voided = 0
        for match_id in stale_ids:
            if await settle_unified_tennis(match_id, None, void=True):
                voided += 1
        if voided:
            self.logger.info(f"[SETTLEMENT] voided {voided} unified tennis rows (expired)")

    async def _select_pending(self) -> list:
        """Unsettled predictions in the settlement window (outcome IS NULL)."""
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
            return result.scalars().all()

    async def _settle_recent(self):
        """Attempt settlement for predictions within the last EXPIRE_AFTER_DAYS days."""
        pending = await self._select_pending()
        if not pending:
            return

        resolved = await self._resolve_via_matchbook(pending)
        if not resolved:
            # ESPN fallback: the same feed the collector uses also carries
            # completed results ("A bt B"), so no exchange is required.
            resolved = await self._resolve_via_espn(pending)
        if not resolved:
            return

        async with AsyncSessionLocal() as session:
            await self._elo.load_from_db_async(session)

        # Apply each physical match to the Elo model exactly once. Before the
        # unique index on tennis_predictions (#ELO-FIX-1) the same match could
        # arrive as N duplicate rows, and the old loop re-ran the Elo update once
        # per row — inflating ratings (Zverev to 813 matches). The unique index
        # prevents new duplicates, and this dedup keeps the rating idempotent even
        # if duplicates ever slip through again.
        elo_applied: set = set()
        updated = 0
        for entry in resolved:
            # Resolver tuples: (pred, position) or (pred, position, score_text).
            pred, winner_position = entry[0], entry[1]
            score_text = entry[2] if len(entry) > 2 else None
            outcome = "P1_WIN" if winner_position == "P1" else "P2_WIN"
            winner_name = pred.player1 if winner_position == "P1" else pred.player2
            loser_name = pred.player2 if winner_position == "P1" else pred.player1
            surface = pred.surface or "hard"
            # #18: key the dedup on the PHYSICAL match (match_id + player pair),
            # not the pair alone. Duplicate rows of one match share match_id →
            # Elo moves once; a legitimate REMATCH (same players, different
            # match_id/date) gets its own key → Elo moves again, as it should.
            match_identity = (
                getattr(pred, "match_id", None),
                frozenset((
                    canonical_player_key(winner_name),
                    canonical_player_key(loser_name),
                )),
            )
            if match_identity not in elo_applied:
                self._elo.update(winner_name, loser_name, surface)
                elo_applied.add(match_identity)
            await self._update_prediction(pred.id, outcome, winner_name)
            await self._settle_bets(pred.match_id, outcome)
            # Bridge to the public track record (/api/v2/history) — with the
            # REAL set score when ESPN provided one (#021).
            await settle_unified_tennis(
                pred.match_id, winner_name, final_score=score_text
            )
            updated += 1

        if updated:
            async with AsyncSessionLocal() as session:
                await self._elo.save_to_db_async(session)
            self.logger.info(
                f"[SETTLEMENT] settled {updated} recent row(s) "
                f"({len(elo_applied)} distinct match(es)), Elo updated"
            )

    async def _resolve_via_espn(self, pending: list) -> list[tuple]:
        """
        Resolve outcomes from ESPN completed results (free, no key).
        Matches predictions to results by canonical player-key pair; the
        winner is whoever ESPN listed first ("A bt B"). Returns the same
        (TennisPrediction, "P1"|"P2") shape as the Matchbook resolver.
        """
        try:
            results = await get_completed_results()
        except Exception as e:
            self.logger.debug(f"espn results lookup failed: {e}")
            return []
        if not results:
            return []

        by_pair: dict[frozenset, dict] = {
            frozenset((r["winner_key"], r["loser_key"])): r
            for r in results
        }

        resolved = []
        for pred in pending:
            k1 = canonical_player_key(pred.player1)
            k2 = canonical_player_key(pred.player2)
            res = by_pair.get(frozenset((k1, k2)))
            if not res:
                continue
            # #18: temporal guard — the same pair can meet more than once, so a
            # pair match alone could settle a prediction with a DIFFERENT (e.g.
            # months-old) physical match's result. When BOTH a prediction time
            # and the ESPN event date are known, require them within 3 days;
            # otherwise fall back to pair-matching (preserves rows without a date).
            pred_when = (
                getattr(pred, "scheduled", None)
                or getattr(pred, "scheduled_at", None)
                or getattr(pred, "starts_at", None)
            )
            event_date = res.get("event_date")
            if pred_when and event_date:
                try:
                    pw = pred_when if hasattr(pred_when, "tzinfo") else datetime.fromisoformat(str(pred_when).replace("Z", "+00:00"))
                    if abs((event_date - pw).total_seconds()) > 3 * 86400:
                        continue  # different physical match — don't settle from it
                except Exception:
                    pass  # unparseable date → keep the pair match (no worse than before)
            resolved.append((
                pred,
                "P1" if res["winner_key"] == k1 else "P2",
                res.get("score_text"),
            ))
        return resolved

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
