# agents/tennis_data_collector.py
import asyncio
from datetime import datetime

from agents.base import BaseAgent
from config.settings import settings
from core.tennis_api_client import TennisAPIClient
from core.espn_tennis_client import get_fixtures as espn_get_fixtures
from core.tennis_odds_api_client import get_tennis_odds, merge_tennis_odds
from core.tennis_tour_filter import filter_main_tour, parse_denylist

# Odds columns added by the v4 migration. Every row in the PostgREST bulk upsert
# must carry the same keys, so unmatched fixtures get explicit nulls.
_ODDS_FIELDS = ("odds_p1", "odds_p2", "odds_provider", "odds_bookmaker", "odds_event_id")


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")
        self._client = TennisAPIClient()

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

    async def _collect_cycle(self):
        try:
            # Prova prima RapidAPI (se key configurata e subscritta)
            fixtures = await self._client.get_upcoming_fixtures(days_ahead=7)
            source = "rapidapi_tennis"

            # Fallback ESPN — gratuito, nessuna key, funziona durante i tornei
            if not fixtures:
                fixtures = await espn_get_fixtures()
                source = "espn"

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
                self.logger.info("tennis: nessun fixture disponibile (nessun torneo attivo o quota esaurita)")
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": 0,
                    "source": "none",
                    "status": "no_active_tournaments",
                })
        except Exception as exc:
            self.logger.error("tennis collection error: %s", exc)
