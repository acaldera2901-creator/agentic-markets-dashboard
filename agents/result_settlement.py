"""
ResultsSettlementAgent — closes the feedback loop between match outcomes and the risk engine.

Runs every 5 minutes. For each pending bet whose kickoff was at least 115 minutes ago:
  1. Fetches the final score from API-Football
  2. Determines won / lost
  3. Updates the DB record (status, profit_loss, settled_at)
  4. Publishes to settlement:results so RiskManagerAgent can call engine.release()
  5. Feeds SelfLearningEngine to improve future predictions
  6. Sends Telegram summary for settled bets
"""

import asyncio
import json
import logging
from datetime import datetime

from agents.base import BaseAgent
from core.db import get_pending_bets_for_settlement, settle_bet, get_cumulative_pnl
from core.football_api_client import get_fixture_result
from core.football_data_org_client import get_match_result as fdorg_get_match_result
from core.redis_client import publish
from core.telegram_client import send as tg_send
from config.settings import settings
from learning.self_learning import SelfLearningEngine

logger = logging.getLogger("ResultSettlementAgent")


def _outcome(selection: str, home_goals: int, away_goals: int) -> str:
    """Map (selection, score) → won | lost | push."""
    if home_goals == away_goals:
        actual = "draw"
    elif home_goals > away_goals:
        actual = "home"
    else:
        actual = "away"
    return "won" if selection == actual else "lost"


def _profit_loss(outcome: str, stake: float, odds: float) -> float:
    if outcome == "won":
        return round(stake * (odds - 1), 4)
    return round(-stake, 4)


class ResultSettlementAgent(BaseAgent):
    """Polls pending bets and settles them once the fixture is confirmed finished."""

    POLL_INTERVAL = 300   # 5 minutes

    def __init__(self):
        super().__init__("ResultSettlementAgent")
        self._self_learning = SelfLearningEngine()
        self._session_settled: int = 0
        self._session_pnl: float = 0.0

    async def _main_loop(self) -> None:
        while self._running:
            try:
                await self._settlement_cycle()
            except Exception as e:
                self.logger.error(f"settlement cycle error: {e}", exc_info=True)
            await asyncio.sleep(self.POLL_INTERVAL)

    async def _settlement_cycle(self) -> None:
        pending = await get_pending_bets_for_settlement(cutoff_minutes=115)
        if not pending:
            self.logger.debug("no pending bets ready for settlement")
            return

        self.logger.info(f"attempting settlement for {len(pending)} pending bets")
        settled_this_cycle: list[dict] = []

        for bet in pending:
            try:
                result = await self._fetch_result(bet)
                if result is None:
                    continue   # match not finished yet

                outcome = _outcome(bet.selection, result["home_goals"], result["away_goals"])
                pl = _profit_loss(outcome, float(bet.stake), float(bet.odds))

                await settle_bet(bet.id, outcome, pl)

                settlement_event = {
                    "bet_id": str(bet.id),
                    "match_id": str(bet.match_external_id),
                    "league_id": str(bet.league or ""),
                    "matchday_id": str(bet.matchday_id or bet.kickoff[:10] if bet.kickoff else ""),
                    "stake": str(bet.stake),
                    "odds": str(bet.odds),
                    "selection": str(bet.selection),
                    "outcome": outcome,
                    "profit_loss": str(pl),
                    "home_goals": str(result["home_goals"]),
                    "away_goals": str(result["away_goals"]),
                    "paper": str(bet.paper),
                }
                await publish("settlement:results", settlement_event)

                self._feed_self_learning(bet, result, outcome)

                self._session_settled += 1
                self._session_pnl += pl
                settled_this_cycle.append(settlement_event)

                self.logger.info(
                    f"settled: {bet.home_team or bet.match_external_id} vs {bet.away_team or '?'} "
                    f"| {bet.selection} | {result['home_goals']}-{result['away_goals']} "
                    f"| {outcome} | P&L: {pl:+.2f}€"
                )
            except Exception as e:
                self.logger.error(f"failed to settle bet {bet.id}: {e}", exc_info=True)

        if settled_this_cycle:
            await self._send_telegram_summary(settled_this_cycle)

    async def _fetch_result(self, bet) -> dict | None:
        """Try API-Football first, fall back to football-data.org by team names."""
        # Primary: RapidAPI (fast, by fixture ID)
        try:
            fixture_id = int(bet.match_external_id)
            result = await get_fixture_result(fixture_id)
            if result:
                return result
        except (ValueError, TypeError):
            pass
        except Exception:
            pass  # 403/429 → fall through to backup

        # Fallback: football-data.org (free, by team names + date)
        if bet.home_team and bet.away_team and bet.kickoff and bet.league and settings.FOOTBALL_DATA_ORG_API_KEY:
            try:
                result = await fdorg_get_match_result(
                    competition_code=bet.league,
                    api_key=settings.FOOTBALL_DATA_ORG_API_KEY,
                    home_team=bet.home_team,
                    away_team=bet.away_team,
                    kickoff_date=str(bet.kickoff),
                )
                if result:
                    self.logger.info(f"settled via football-data.org: {bet.home_team} vs {bet.away_team}")
                    return result
            except Exception as e:
                self.logger.debug(f"fdorg fallback failed for bet {bet.id}: {e}")

        return None

    def _feed_self_learning(self, bet, result: dict, outcome: str) -> None:
        """Build a minimal prediction dict from the bet and feed SelfLearningEngine."""
        try:
            home_goals = result["home_goals"]
            away_goals = result["away_goals"]
            actual_outcome = (
                "home" if home_goals > away_goals
                else "away" if away_goals > home_goals
                else "draw"
            )
            prediction = {
                "match_id": str(bet.match_external_id),
                "league": str(bet.league or ""),
                "match_type": "STANDARD",
                "season_phase": "MID",
                "p_home": 0.5,
                "p_draw": 0.25,
                "p_away": 0.25,
                "selection": str(bet.selection),
                "confidence": float(bet.odds and 1 / bet.odds or 0.5),
                "shap_values": {},
            }
            actual = {"match_id": str(bet.match_external_id), "outcome": actual_outcome}
            self._self_learning.process_completed_match(prediction, actual)
        except Exception as e:
            self.logger.debug(f"self-learning feed failed for bet {bet.id}: {e}")

    async def _send_telegram_summary(self, settled: list[dict]) -> None:
        if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
            return
        try:
            total_pl = sum(float(s["profit_loss"]) for s in settled)
            wins = sum(1 for s in settled if s["outcome"] == "won")
            losses = sum(1 for s in settled if s["outcome"] == "lost")
            cumulative = await get_cumulative_pnl()
            mode = "PAPER" if settings.PAPER_TRADING else "LIVE"
            lines = [
                f"📊 <b>Settlement [{mode}]</b>  {len(settled)} bet{'s' if len(settled)>1 else ''}",
                f"✅ {wins} vinti  ❌ {losses} persi  |  ciclo: <b>{total_pl:+.2f}€</b>",
                f"📈 P&L cumulativo: <b>{cumulative:+.2f}€</b>",
                "",
            ]
            for s in settled[:5]:
                icon = "✅" if s["outcome"] == "won" else "❌"
                lines.append(
                    f"{icon} {s.get('match_id','')}  {s['selection'].upper()} "
                    f"{s['home_goals']}-{s['away_goals']}  {float(s['profit_loss']):+.2f}€"
                )
            await tg_send("\n".join(lines))
        except Exception as e:
            self.logger.warning(f"telegram settlement summary failed: {e}")
