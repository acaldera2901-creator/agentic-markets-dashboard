# agents/tennis_data_collector.py
import asyncio
from datetime import datetime, timezone, timedelta

from agents.base import BaseAgent
from config.settings import settings
from core.tennis_api_client import TennisAPIClient
from core.espn_tennis_client import (
    get_fixtures as espn_get_fixtures,
    get_fixtures_from_header as espn_get_fixtures_from_header,
    EspnFeedUnavailable,
)
from core.tennis_odds_api_client import get_tennis_odds, merge_tennis_odds, _pair_key
from core.tennis_oddspapi_client import get_oddspapi_tennis_odds
from core.tennis_tour_filter import filter_main_tour, parse_denylist

NEAR_KICKOFF_HOURS = 6
MAX_ODDSPAPI_ATTEMPTS = 3


def collection_status(feed_error: str | None, dropped_report: dict | None) -> str:
    """Perche' la raccolta ha reso ZERO fixture (#TENNIS-FEED-DOWN-0805).

    Funzione a parte, e testata, perche' prima era un ramo `else` che riportava
    SEMPRE `no_active_tournaments` — cioe' la piu' rassicurante delle tre cause —
    e il 05/08 e' costato una mattina: ESPN aveva 51 partite singolari in corso di
    programmazione, il board era vuoto e l'agente diceva che non c'erano tornei.

      feed_unavailable      il feed ha rifiutato o non risponde -> E' UN GUASTO
      all_filtered          il feed ha risposto, la curation ha scartato tutto
      no_active_tournaments il feed ha risposto e davvero non c'e' nulla
    """
    if feed_error:
        return "feed_unavailable"
    if dropped_report and (dropped_report.get("qualifying") or dropped_report.get("minor")):
        return "all_filtered"
    return "no_active_tournaments"


def oddspapi_candidates(fixtures: list[dict], tried: dict[str, int],
                        near_hours: int = NEAR_KICKOFF_HOURS,
                        max_attempts: int = MAX_ODDSPAPI_ATTEMPTS) -> set[str]:
    """Pair-key dei match SCOPERTI (no odds_p1) entro `near_hours` dal kickoff e
    sotto il cap tentativi. Puro/testabile."""
    now = datetime.now(timezone.utc)
    out: set[str] = set()
    for f in fixtures:
        if f.get("odds_p1") is not None:
            continue
        sa = f.get("scheduled_at")
        try:
            ko = datetime.fromisoformat(str(sa).replace("Z", "+00:00"))
        except Exception:
            continue
        if ko < now or ko > now + timedelta(hours=near_hours):
            continue
        k = _pair_key(f.get("player1"), f.get("player2"), sa)
        if not k or tried.get(k, 0) >= max_attempts:
            continue
        out.add(k)
    return out

# Odds columns added by the v4 migration. Every row in the PostgREST bulk upsert
# must carry the same keys, so unmatched fixtures get explicit nulls.
_ODDS_FIELDS = ("odds_p1", "odds_p2", "odds_provider", "odds_bookmaker", "odds_event_id")


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")
        self._client = TennisAPIClient()
        self._oddspapi_tried: dict[str, int] = {}

    async def _main_loop(self) -> None:
        while self._running:
            await self._collect_cycle()
            await asyncio.sleep(1800)  # ogni 30 min per ESPN (nessun limite quota)

    async def _merge_market_odds(self, fixtures: list[dict]) -> tuple[list[dict], int]:
        """Enrich fixtures with The Odds API h2h prices (fail-soft, P1 wiring)."""
        merged_count = 0
        if settings.ODDS_API_KEY:
            try:
                odds = await get_tennis_odds()
                if odds:
                    fixtures = merge_tennis_odds(fixtures, odds)
                    merged_count = sum(1 for f in fixtures if f.get("odds_p1") is not None)
            except Exception as exc:
                self.logger.warning("tennis odds merge failed (non-fatal): %s", exc)
        # Uniform keys for the bulk upsert: unmatched rows carry explicit nulls.
        for fixture in fixtures:
            for field in _ODDS_FIELDS:
                fixture.setdefault(field, None)
        return fixtures, merged_count

    async def _merge_oddspapi_fallback(self, fixtures: list[dict]) -> tuple[list[dict], int]:
        """Per i match ancora scoperti vicini al kickoff, prova OddsPapi (fetch-once
        on-success + retry cap). Fail-soft."""
        if not settings.ODDSPAPI_KEY:
            return fixtures, 0
        wanted = oddspapi_candidates(fixtures, self._oddspapi_tried)
        if not wanted:
            return fixtures, 0
        for k in wanted:
            self._oddspapi_tried[k] = self._oddspapi_tried.get(k, 0) + 1  # conta il tentativo
        added = 0
        try:
            rows = await get_oddspapi_tennis_odds(wanted)
            if rows:
                before = sum(1 for f in fixtures if f.get("odds_p1") is not None)
                fixtures = merge_tennis_odds(fixtures, rows)
                # provider override per le righe arricchite da OddsPapi
                got_keys = {_pair_key(r["player1"], r["player2"], r["scheduled_at"]) for r in rows}
                for f in fixtures:
                    fk = _pair_key(f.get("player1"), f.get("player2"), f.get("scheduled_at"))
                    if fk in got_keys and f.get("odds_provider") == "the_odds_api" and f.get("odds_event_id") in {r["odds_event_id"] for r in rows}:
                        f["odds_provider"] = "oddspapi"
                after = sum(1 for f in fixtures if f.get("odds_p1") is not None)
                added = after - before
                # successo → non ritentare questi
                for r in rows:
                    rk = _pair_key(r["player1"], r["player2"], r["scheduled_at"])
                    if rk:
                        self._oddspapi_tried[rk] = MAX_ODDSPAPI_ATTEMPTS
        except Exception as exc:
            self.logger.warning("oddspapi fallback failed (non-fatal): %s", exc)
        return fixtures, added

    async def _collect_cycle(self):
        try:
            # Prova prima RapidAPI (se key configurata e subscritta)
            fixtures = await self._client.get_upcoming_fixtures(days_ahead=7)
            source = "rapidapi_tennis"

            # Fallback ESPN — gratuito, nessuna key, funziona durante i tornei
            if not fixtures:
                fixtures = await espn_get_fixtures()
                source = "espn"

            # #TENNIS-FEED-DOWN-0805 — secondo fallback sull'endpoint HEADER, lo
            # stesso che questo modulo usa già per il settlement. Il 05/08 il
            # day-scoreboard rendeva 403 mentre l'header rendeva 51 partite non
            # concluse (Toronto Masters + Varsavia) e il board era VUOTO: due
            # sorgenti sullo stesso feed, una sola cadeva.
            feed_error: str | None = None
            if not fixtures:
                try:
                    fixtures = await espn_get_fixtures_from_header()
                    source = "espn_header"
                except EspnFeedUnavailable as exc:
                    feed_error = str(exc)
                    self.logger.error("tennis: feed ESPN non disponibile: %s", exc)

            # Board curation (#020): main draw + main tour only. Drops are
            # logged per tournament so the curation is visible, never silent.
            dropped_report = None
            if fixtures:
                fixtures, dropped_report = filter_main_tour(
                    fixtures,
                    denylist=parse_denylist(settings.TENNIS_TOURNAMENT_DENYLIST),
                    include_qualifying=settings.TENNIS_INCLUDE_QUALIFYING,
                )
                if dropped_report["qualifying"] or dropped_report["minor"]:
                    self.logger.info(
                        "tennis filter: dropped %d qualifying + %d minor-circuit (%s)",
                        dropped_report["qualifying"],
                        dropped_report["minor"],
                        ", ".join(
                            f"{name}={n}"
                            for name, n in sorted(dropped_report["dropped_tournaments"].items())
                        ),
                    )

            if fixtures:
                fixtures, odds_merged = await self._merge_market_odds(fixtures)
                fixtures, oddspapi_added = await self._merge_oddspapi_fallback(fixtures)
                if oddspapi_added:
                    self.logger.info("tennis: +%d quote da OddsPapi (match erba/250 scoperti)", oddspapi_added)
                    odds_merged += oddspapi_added
                await self._client.write_fixtures_to_supabase(fixtures)
                self.logger.info(
                    "tennis: %d fixtures da %s (%d con odds reali)", len(fixtures), source, odds_merged
                )
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": len(fixtures),
                    "odds_merged": odds_merged,
                    "dropped_qualifying": (dropped_report or {}).get("qualifying", 0),
                    "dropped_minor": (dropped_report or {}).get("minor", 0),
                    "source": source,
                    "collected_at": datetime.utcnow().isoformat(),
                })
            else:
                # #TENNIS-FEED-DOWN-0805 — la ragione dello zero, distinta.
                status = collection_status(feed_error, dropped_report)

                if status == "feed_unavailable":
                    # Un guasto della sorgente del 93% del volume servito non deve
                    # stare in un campo di stato che nessuno guarda.
                    self.logger.error(
                        "tennis: NESSUN fixture perche' il feed non risponde (%s) — board a rischio vuoto",
                        feed_error,
                    )
                else:
                    self.logger.info("tennis: nessun fixture disponibile (status=%s)", status)

                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": 0,
                    "source": "none",
                    "status": status,
                    "feed_error": feed_error,
                    "dropped_qualifying": (dropped_report or {}).get("qualifying", 0),
                    "dropped_minor": (dropped_report or {}).get("minor", 0),
                })
        except Exception as exc:
            self.logger.error("tennis collection error: %s", exc)
