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
from datetime import datetime, timedelta, timezone

from agents.base import BaseAgent
from core.db import get_pending_bets_for_settlement, settle_bet, get_cumulative_pnl
from core.espn_soccer_client import (
    get_match_disposition as espn_get_match_disposition,
    get_match_result as espn_get_match_result,
)
from core.football_api_client import (
    get_fixture_result,
    get_fixture_disposition,
    get_fixture_result_by_teams_date,
)
from core.football_data_org_client import get_match_result as fdorg_get_match_result
from core.odds_api_client import (
    SPORT_KEYS,
    get_score_by_teams_date as odds_get_score_by_teams_date,
)
from core.redis_client import publish
from core.supabase_client import (
    fetch_unsettled_unified_predictions,
    record_pick_settlement,
    settle_unified_prediction,
)
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
        # Per-cycle cache of The Odds API /scores responses, keyed by sport_key:
        # one /scores call covers every row of that sport in a cycle (#ODDS-SCORES-1).
        self._scores_cache: dict = {}

    async def _main_loop(self) -> None:
        while self._running:
            try:
                await self._settlement_cycle()
            except Exception as e:
                self.logger.error(f"settlement cycle error: {e}", exc_info=True)
            try:
                await self._unified_settlement_cycle()
            except Exception as e:
                self.logger.error(f"unified settlement cycle error: {e}", exc_info=True)
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
                    # #17: a match that will never finish (canceled / abandoned /
                    # postponed / walkover) must not stay pending forever. Past a
                    # grace window, if the source reports it abandoned, void the
                    # bet (refund, profit_loss=0) — never guess a score. Mirrors
                    # the void path already on tennis (#5) and unified rows.
                    void_event = await self._try_void_abandoned(bet)
                    if void_event is not None:
                        settled_this_cycle.append(void_event)
                    continue   # match not finished yet (or just voided)

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

    # Grace before an unfinished bet is voided. Same rationale as the unified
    # void path: a suspension can be transient; only void once the source
    # confirms the fixture will never complete AND enough time has passed.
    VOID_BET_AFTER_HOURS = 6

    async def _try_void_abandoned(self, bet) -> dict | None:
        """Void a pending bet whose fixture the source reports abandoned (#17).

        Returns the settlement event (for the Telegram summary) when the bet was
        voided, else None. Void = status 'void', profit_loss=0 (refund); the
        settlement event releases the engine exposure exactly like a win/loss.
        """
        if not bet.kickoff:
            return None
        try:
            ko = datetime.fromisoformat(str(bet.kickoff).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - ko < timedelta(hours=self.VOID_BET_AFTER_HOURS):
            return None
        try:
            fixture_id = int(bet.match_external_id)
        except (ValueError, TypeError):
            return None
        try:
            disposition = await get_fixture_disposition(fixture_id)
        except Exception as e:
            self.logger.debug(f"disposition lookup failed for bet {bet.id}: {e}")
            return None
        if disposition != "abandoned":
            return None

        await settle_bet(bet.id, "void", 0.0)
        settlement_event = {
            "bet_id": str(bet.id),
            "match_id": str(bet.match_external_id),
            "league_id": str(bet.league or ""),
            "matchday_id": str(bet.matchday_id or (bet.kickoff[:10] if bet.kickoff else "")),
            "stake": str(bet.stake),
            "odds": str(bet.odds),
            "selection": str(bet.selection),
            "outcome": "void",
            "profit_loss": "0.0",
            "home_goals": "",
            "away_goals": "",
            "paper": str(bet.paper),
        }
        await publish("settlement:results", settlement_event)
        self.logger.info(
            f"voided (abandoned): {bet.home_team or bet.match_external_id} vs "
            f"{bet.away_team or '?'} | stake {bet.stake} refunded"
        )
        return settlement_event

    async def _unified_settlement_cycle(self) -> None:
        """
        P4-B / P5: settle served rows in unified_predictions (incl. World Cup)
        and move them into history (is_historical=TRUE). This is what feeds the
        public track record and flips the WC `settlement`/`history` gates.
        Result only — no money metrics are written (product line: hit-rate).
        """
        rows = await fetch_unsettled_unified_predictions(cutoff_minutes=115)
        if not rows:
            return

        # Fresh /scores window each cycle: a match that just completed must be
        # re-fetched, not served from a stale "not completed" cache entry.
        self._scores_cache = {}
        self.logger.info(f"unified settlement: {len(rows)} rows past cutoff")
        settled = 0
        for row in rows:
            try:
                result = await self._fetch_unified_result(row)
                if result is None:
                    # A match ESPN will never complete (suspended/abandoned/
                    # postponed/canceled) would otherwise sit on the board
                    # forever. Past a 6h grace, void it — never guess a score.
                    if await self._should_void_abandoned(row):
                        if await settle_unified_prediction(str(row["id"]), "void"):
                            settled += 1
                            self.logger.info(
                                f"unified voided (abandoned): {row.get('home_team')} vs "
                                f"{row.get('away_team')} ({row.get('competition')})"
                            )
                    continue  # not finished / providers have no score yet

                pick = str(row.get("pick") or "").lower()
                market = str(row.get("market") or "1X2")
                if market != "1X2" or pick not in ("home", "draw", "away"):
                    # Unknown market/pick: settle as void rather than guessing.
                    outcome = "void"
                else:
                    outcome = _outcome(pick, result["home_goals"], result["away_goals"])

                final_score = f"{result['home_goals']}-{result['away_goals']}"
                if await settle_unified_prediction(
                    str(row["id"]),
                    outcome,
                    # #021: real final score into the served history row.
                    final_score=final_score,
                ):
                    settled += 1
                    self.logger.info(
                        f"unified settled: {row.get('home_team')} vs {row.get('away_team')} "
                        f"({row.get('competition')}) | {pick} | "
                        f"{final_score} | {outcome}"
                        + (" | WC" if row.get("world_cup_stage") else "")
                    )
                    # #TRACKREC-PROOF-1 — append-only settlement for the honest
                    # ledger. Keyed to the pick_ledger row written at publish time
                    # by lib/unified-adapter.ts (source_table='match_predictions',
                    # source_id=external_event_id, model_version='football-v4-xg-model').
                    # closing_odds is left NULL here (no verified joinable close yet
                    # — never fabricated); CLV backfill from odds_snapshots is a
                    # separate joinable step. Fully fail-soft.
                    ext = row.get("external_event_id")
                    if ext:
                        realized = (
                            "DRAW"
                            if result["home_goals"] == result["away_goals"]
                            else "HOME"
                            if result["home_goals"] > result["away_goals"]
                            else "AWAY"
                        )
                        await record_pick_settlement(
                            source_table="match_predictions",
                            source_id=str(ext),
                            model_version="football-v4-xg-model",
                            result=outcome,
                            outcome=realized,
                            final_score=final_score,
                        )
            except Exception as e:
                self.logger.error(f"failed to settle unified row {row.get('id')}: {e}")

        if settled:
            self.set_status_detail({
                "type": "unified_settlement",
                "settled": settled,
                "pending": len(rows) - settled,
                "settled_at": datetime.now(timezone.utc).isoformat(),
            })

    # Grace before an unfinished, abandoned ESPN match is voided. A suspension
    # can be transient (resumed same day); 6h covers the realistic cases while
    # still clearing the board (#PAPER-SETTLE-1).
    VOID_ABANDONED_AFTER_HOURS = 6

    async def _should_void_abandoned(self, row: dict) -> bool:
        """True if an ESPN-sourced row is past grace AND ESPN reports it
        abandoned (no settleable score will ever arrive). ESPN-only scope: the
        quota providers cover the rest and abandoned friendlies are the case
        observed in prod (Denmark vs Ukraine, 2026-06-07)."""
        starts_at = row.get("starts_at")
        if not starts_at:
            return False
        try:
            start = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return False
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - start < timedelta(hours=self.VOID_ABANDONED_AFTER_HOURS):
            return False
        ext = str(row.get("external_event_id") or "")
        if not ext.startswith("espn:"):
            return False
        disposition = await espn_get_match_disposition(
            str(row.get("league") or ""), ext.removeprefix("espn:")
        )
        return disposition == "abandoned"

    def _odds_sport_key(self, row: dict) -> str | None:
        """Map a unified row's league/competition to a The Odds API sport key.

        Reuses core.odds_api_client.SPORT_KEYS (our league codes -> Odds API
        keys, incl. WC -> soccer_fifa_world_cup). FRIENDLY has no Odds API key
        (the provider lists no international-friendlies sport) -> None, so those
        rows stay on the ESPN + team/date fallback. None when unmapped, so the
        caller never burns a /scores credit on a competition we can't query.
        """
        league = str(row.get("league") or "").upper()
        return SPORT_KEYS.get(league)

    async def _fetch_unified_result(self, row: dict) -> dict | None:
        """Result lookup for a unified row: ESPN-by-id, then The Odds API
        /scores (robust paid source), then the dead/limited api-football path."""
        ext = row.get("external_event_id")
        # ESPN-sourced rows ("espn:<event_id>") settle straight from the ESPN
        # summary by event id — the only result source for ESPN-only
        # competitions (FRIENDLY); free, so tried before the quota providers.
        ext_str = str(ext or "")
        if ext_str.startswith("espn:"):
            try:
                result = await espn_get_match_result(
                    str(row.get("league") or ""), ext_str.removeprefix("espn:")
                )
                if result:
                    return result
            except Exception as e:
                self.logger.debug(f"ESPN result lookup failed for {ext_str}: {e}")
            if str(row.get("league") or "").upper() == "FRIENDLY":
                # ESPN's fifa.friendly feed is unreliable for some
                # internationals: it flagged Oman vs Kuwait (2026-06-09)
                # canceled though it was played 4-2, so the row was wrongly
                # voided. Fall back to an ESPN-independent lookup by team
                # names + date (api-football direct host). Only FRIENDLY rows
                # reach this — the WC/club path settled from ESPN above. None
                # (no FINAL fixture found) keeps the abandoned-void behaviour.
                if row.get("home_team") and row.get("away_team") and row.get("starts_at"):
                    try:
                        result = await get_fixture_result_by_teams_date(
                            str(row["home_team"]),
                            str(row["away_team"]),
                            str(row["starts_at"]),
                        )
                        if result:
                            return result
                    except Exception as e:
                        self.logger.debug(
                            f"friendly team+date fallback failed for {row.get('id')}: {e}"
                        )
                return None

        # The Odds API /scores: robust paid result source covering every
        # competition we have odds for. Tried before the dead api-football
        # path. FRIENDLY returned above (no Odds API key); WC and the club
        # leagues map via SPORT_KEYS. None (not completed / not in the 3-day
        # window) falls through so genuinely canceled matches stay void.
        sport_key = self._odds_sport_key(row)
        if (
            sport_key and row.get("home_team") and row.get("away_team")
            and row.get("starts_at")
        ):
            try:
                result = await odds_get_score_by_teams_date(
                    sport_key,
                    str(row["home_team"]),
                    str(row["away_team"]),
                    str(row["starts_at"]),
                    _cache=self._scores_cache,
                )
                if result:
                    return result
            except Exception as e:
                self.logger.debug(
                    f"odds-api /scores lookup failed for unified {row.get('id')}: {e}"
                )

        try:
            result = await get_fixture_result(int(ext))
            if result:
                return result
        except (ValueError, TypeError):
            pass
        except Exception:
            pass  # 403/429 → fall through to backup

        if (
            row.get("home_team") and row.get("away_team") and row.get("starts_at")
            and row.get("league") and settings.FOOTBALL_DATA_ORG_API_KEY
        ):
            try:
                return await fdorg_get_match_result(
                    competition_code=str(row["league"]),
                    api_key=settings.FOOTBALL_DATA_ORG_API_KEY,
                    home_team=str(row["home_team"]),
                    away_team=str(row["away_team"]),
                    kickoff_date=str(row["starts_at"]),
                )
            except Exception as e:
                self.logger.debug(f"fdorg fallback failed for unified {row.get('id')}: {e}")
        return None

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
            # Scope the cumulative P&L to the active ledger so a [PAPER] summary
            # never reports the live ledger (or vice-versa) — same separation the
            # risk engine uses (audit LOW finding).
            cumulative = await get_cumulative_pnl(paper=settings.PAPER_TRADING)
            mode = "PAPER" if settings.PAPER_TRADING else "LIVE"
            lines = [
                f"📊 <b>Settlement [{mode}]</b>  {len(settled)} bet{'s' if len(settled)>1 else ''}",
                f"✅ {wins} vinti  ❌ {losses} persi  |  ciclo: <b>{total_pl:+.2f}€</b>",
                f"📈 P&L cumulativo: <b>{cumulative:+.2f}€</b>",
                "",
            ]
            for s in settled[:5]:
                outcome = s["outcome"]
                icon = "✅" if outcome == "won" else "↩️" if outcome == "void" else "❌"
                score = (
                    "VOID"
                    if outcome == "void"
                    else f"{s['home_goals']}-{s['away_goals']}"
                )
                lines.append(
                    f"{icon} {s.get('match_id','')}  {s['selection'].upper()} "
                    f"{score}  {float(s['profit_loss']):+.2f}€"
                )
            await tg_send("\n".join(lines))
        except Exception as e:
            self.logger.warning(f"telegram settlement summary failed: {e}")
