import asyncio
import json
import time
import traceback
import unicodedata
from difflib import SequenceMatcher
from datetime import datetime, timezone, timedelta
from agents.base import BaseAgent
from core.redis_client import publish
from core.football_api_client import get_fixtures as apifootball_fixtures, LEAGUE_IDS
from core.football_data_org_client import get_fixtures as fdorg_fixtures, FREE_TIER_CODES
from core.odds_api_client import get_odds, normalize_name
from core.matchbook_client import get_football_markets as mb_football_markets, is_configured as mb_configured
from config.settings import settings


def _ascii_lower(s: str) -> str:
    """Strip diacritics and lowercase — handles München↔Munich type mismatches."""
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii').lower().strip()


def _name_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, _ascii_lower(a), _ascii_lower(b)).ratio()


class DataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("DataCollector")
        self._upcoming_kickoffs: list = []
        self._consecutive_empty_cycles: int = 0
        self._last_offseason_log: float = 0.0

    async def _main_loop(self) -> None:
        while self._running:
            try:
                await self._collect_cycle()
            except Exception as e:
                self.logger.error(f"collection error: {e}\n{traceback.format_exc()}")
            interval = self._next_interval()
            self.logger.info(f"sleeping {interval}s until next cycle")
            await asyncio.sleep(interval)

    def _next_interval(self) -> int:
        if self._consecutive_empty_cycles >= 3:
            return 1800  # 30 min during off-season — check twice an hour
        return settings.PREMATCH_REFRESH_INTERVAL if self._has_imminent_match() else settings.DATA_REFRESH_INTERVAL

    def _has_imminent_match(self) -> bool:
        now = datetime.now(timezone.utc)
        window = timedelta(hours=2)
        for ko in self._upcoming_kickoffs:
            try:
                ko_dt = datetime.fromisoformat(ko.replace("Z", "+00:00"))
                if timedelta(0) <= (ko_dt - now) <= window:
                    return True
            except Exception:
                continue
        return False

    async def _fetch_fixtures(self, league_code: str, league_id: int) -> list:
        """Prefer football-data.org (free, no daily cap); fall back to API-Football."""
        fdorg_key = settings.FOOTBALL_DATA_ORG_API_KEY
        if fdorg_key and league_code in FREE_TIER_CODES:
            fixtures = await fdorg_fixtures(league_code, fdorg_key)
            if fixtures:
                return fixtures

        # fallback: API-Football (100 req/day)
        if settings.API_FOOTBALL_KEY:
            now = datetime.now()
            # Seasons start Aug/Sep — before August we're still in the previous season
            season = now.year if now.month >= 8 else now.year - 1
            return await apifootball_fixtures(league_id, season)
        return []

    async def _collect_cycle(self) -> None:
        self._upcoming_kickoffs = []
        published_this_cycle = 0
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                fixtures = await self._fetch_fixtures(league_code, league_id)
                # Primary odds source: Matchbook Exchange
                odds_map: dict = {}
                if mb_configured():
                    try:
                        mb_list = await asyncio.to_thread(mb_football_markets)
                        if mb_list:
                            self.logger.info(f"Matchbook football: {len(mb_list)} markets total")
                            for o in mb_list:
                                key = o["home_team_normalized"] + "|" + o["away_team_normalized"]
                                if key not in odds_map:
                                    odds_map[key] = o
                    except Exception as mb_err:
                        self.logger.warning(f"Matchbook odds error: {mb_err}")

                # Fallback: The Odds API
                if not odds_map:
                    odds_list = await get_odds(league_code)
                    odds_map = {
                        o.get("home_team_normalized","") + "|" + o.get("away_team_normalized",""): o
                        for o in odds_list
                    }
                    if odds_map:
                        self.logger.info(f"OddsAPI {league_code}: {len(odds_map)} markets")
                published = 0
                for fixture in fixtures:
                    event = self._build_event(fixture, odds_map, league_code)
                    if event:
                        self._upcoming_kickoffs.append(event["kickoff"])
                        await publish("market:data", {"payload": json.dumps(event)})
                        published += 1
                if published:
                    self.logger.info(f"published {published} fixtures for {league_code}")
                    published_this_cycle += published
            except Exception as e:
                self.logger.error(f"error collecting {league_code}: {e}\n{traceback.format_exc()}")

        if published_this_cycle == 0:
            self._consecutive_empty_cycles += 1
            now = time.time()
            if now - self._last_offseason_log >= 3600:
                self.logger.info(
                    f"[OFF-SEASON] no fixtures found ({self._consecutive_empty_cycles} consecutive "
                    "empty cycles). System idle — next check in 30 min."
                )
                self._last_offseason_log = now
        else:
            self._consecutive_empty_cycles = 0

    def _build_event(self, fixture: dict, odds_map: dict, league: str) -> dict | None:
        try:
            teams = fixture["teams"]
            home = teams["home"]["name"]
            away = teams["away"]["name"]
            kickoff = fixture["fixture"]["date"]
            match_id = str(fixture["fixture"]["id"])

            odds_key = f"{normalize_name(home)}|{normalize_name(away)}"
            odds_data = odds_map.get(odds_key)

            # Fuzzy fallback: substring + similarity (handles umlaut mismatches like München↔Munich,
            # abbreviations like "Paris St-G"↔"Paris Saint-Germain", and suffix variants)
            if not odds_data:
                home_n = normalize_name(home)
                away_n = normalize_name(away)
                for key, val in odds_map.items():
                    k_home, _, k_away = key.partition("|")
                    home_ok = (k_home in home_n or home_n in k_home or _name_sim(home_n, k_home) >= 0.65)
                    away_ok = (k_away in away_n or away_n in k_away or _name_sim(away_n, k_away) >= 0.65)
                    if home_ok and away_ok:
                        odds_data = val
                        break

            return {
                "match_id": match_id,
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": kickoff,
                "odds": odds_data or {},
                "collected_at": datetime.now(timezone.utc).isoformat(),
            }
        except (KeyError, TypeError):
            return None
