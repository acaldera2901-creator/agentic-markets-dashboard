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
from core.data_hub import DataHub
from core.football_data_org_client import get_fixtures as fdorg_fixtures, FREE_TIER_CODES
from core.odds_api_client import get_odds, normalize_name
from core.matchbook_client import get_football_markets as mb_football_markets, is_configured as mb_configured
from core.world_cup_context import build_world_cup_context
from core.world_cup_registry import api_football_season_for, build_cycle_detail, is_world_cup_code
from core.world_cup_venue_context import enrich_venue_context
from core.world_cup_history import canonical_team_name, load_national_history, WC2026_TEAMS
from core.world_cup_team_model import build_profile
from config.settings import settings


def _ascii_lower(s: str) -> str:
    """Strip diacritics and lowercase — handles München↔Munich type mismatches."""
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii').lower().strip()


def _parse_kickoff(value) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        return None


def national_model_ready() -> bool:
    """True when the national-team history covers the WC field at signal quality.

    Cheap and cached (``load_national_history`` is lru_cached): a profile clears
    the gate when ``data_quality >= 0.75`` (>=15 recent matches). The model agent
    consumes the same history; this only reflects readiness in the heartbeat.
    """
    try:
        matches = load_national_history()
    except Exception:
        return False
    if not matches:
        return False
    covered = 0
    for team in WC2026_TEAMS:
        profile = build_profile(matches, team)
        if profile and profile.data_quality >= 0.75:
            covered += 1
    return covered >= int(len(WC2026_TEAMS) * 0.9)


def build_team_prev_kickoff_registry(fixtures: list[dict]) -> dict[str, dict]:
    """Per-team previous-kickoff map from the real fixture feed.

    Walks fixtures in kickoff order; for each fixture records the previous
    kickoff already seen for each of its two teams (canonical-keyed, so a team's
    earlier matches are found regardless of API spelling). Returns
    ``{match_id: {team_a_prev_kickoff, team_b_prev_kickoff}}``. First match of a
    team -> ``None`` (rest_days undefined by design; travel/timezone still resolve).
    """
    parsed: list[tuple[str, str, str, datetime | None]] = []
    for fx in fixtures:
        try:
            mid = str(fx["fixture"]["id"])
            home = fx["teams"]["home"]["name"]
            away = fx["teams"]["away"]["name"]
        except (KeyError, TypeError):
            continue
        ko = _parse_kickoff(fx.get("fixture", {}).get("date"))
        parsed.append((mid, home, away, ko))

    parsed.sort(key=lambda r: (r[3] is None, r[3] or datetime.max.replace(tzinfo=timezone.utc)))

    last_seen: dict[str, datetime] = {}
    registry: dict[str, dict] = {}
    for mid, home, away, ko in parsed:
        ckey_a = canonical_team_name(home)
        ckey_b = canonical_team_name(away)
        registry[mid] = {
            "team_a_prev_kickoff": last_seen.get(ckey_a),
            "team_b_prev_kickoff": last_seen.get(ckey_b),
        }
        if ko is not None:
            last_seen[ckey_a] = ko
            last_seen[ckey_b] = ko
    return registry


def _name_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, _ascii_lower(a), _ascii_lower(b)).ratio()


class DataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("DataCollector")
        self._upcoming_kickoffs: list = []
        self._consecutive_empty_cycles: int = 0
        self._last_offseason_log: float = 0.0
        self._hub = DataHub()

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
            season = api_football_season_for(
                league_code,
                now.year if now.month >= 8 else now.year - 1,
            )
            return await apifootball_fixtures(league_id, season)
        return []

    async def _collect_cycle(self) -> None:
        self._upcoming_kickoffs = []
        published_this_cycle = 0
        league_counts: dict[str, dict[str, int]] = {}
        source_errors: list[str] = []
        wc_venue_context_ready = False
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                fixtures = await self._fetch_fixtures(league_code, league_id)
                prev_kickoff_registry: dict[str, dict] = (
                    build_team_prev_kickoff_registry(fixtures)
                    if is_world_cup_code(league_code)
                    else {}
                )
                league_counts[league_code] = {
                    "fixtures": len(fixtures),
                    "odds_markets": 0,
                    "matched_odds": 0,
                    "published_events": 0,
                }
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
                        source_errors.append(f"{league_code}:matchbook:{mb_err}")

                # Fallback: The Odds API
                if not odds_map:
                    odds_list = await get_odds(league_code)
                    odds_map = {
                        o.get("home_team_normalized","") + "|" + o.get("away_team_normalized",""): o
                        for o in odds_list
                    }
                    if odds_map:
                        self.logger.info(f"OddsAPI {league_code}: {len(odds_map)} markets")
                league_counts[league_code]["odds_markets"] = len(odds_map)
                published = 0
                matched_odds = 0
                for fixture in fixtures:
                    venue_prev = prev_kickoff_registry.get(
                        str(fixture.get("fixture", {}).get("id"))
                    )
                    event = self._build_event(fixture, odds_map, league_code, venue_prev)
                    if event:
                        self._upcoming_kickoffs.append(event["kickoff"])
                        if event.get("odds"):
                            matched_odds += 1
                        wc_ctx = event.get("world_cup_context")
                        if wc_ctx and wc_ctx.get("data_completeness_score", 0) >= 0.78:
                            wc_venue_context_ready = True
                        await publish("market:data", {"payload": json.dumps(event)})
                        published += 1
                league_counts[league_code]["matched_odds"] = matched_odds
                league_counts[league_code]["published_events"] = published
                if published:
                    self.logger.info(f"published {published} fixtures for {league_code}")
                    published_this_cycle += published
                if is_world_cup_code(league_code):
                    self.logger.info(
                        "World Cup monitor: fixtures=%s odds_markets=%s matched_odds=%s published=%s",
                        len(fixtures),
                        len(odds_map),
                        matched_odds,
                        published,
                    )
            except Exception as e:
                self.logger.error(f"error collecting {league_code}: {e}\n{traceback.format_exc()}")
                source_errors.append(f"{league_code}:collect:{e}")

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

        self.set_status_detail(
            build_cycle_detail(
                league_counts=league_counts,
                source_errors=source_errors,
                # national_model + venue_context are now wired (paper tier). Settlement
                # stays false -> registry readiness remains monitor_only for signal,
                # but the WC data-quality tier reaches paper_only in ModelAgent.
                national_model_ready=national_model_ready(),
                venue_context_ready=wc_venue_context_ready,
                settlement_ready=False,
            )
        )

        # DataHub enrichment — fire-and-forget, never blocks core pipeline
        try:
            leagues = list(LEAGUE_IDS.keys())
            hub_fixtures = await self._hub.collect_all_fixtures(leagues)
            await self._hub.collect_all_odds(leagues)
            self.logger.info("DataHub enriched %d fixtures", len(hub_fixtures))
        except Exception as hub_exc:
            self.logger.warning("DataHub enrichment failed (non-blocking): %s", hub_exc)

    def _build_event(
        self,
        fixture: dict,
        odds_map: dict,
        league: str,
        venue_prev: dict | None = None,
    ) -> dict | None:
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
                "provider_event_id": match_id,
                "provider_source": "api-football",
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": kickoff,
                "odds": odds_data or {},
                "world_cup_context": (
                    self._build_wc_context(fixture, home, away, kickoff, venue_prev)
                    if is_world_cup_code(league)
                    else None
                ),
                "collected_at": datetime.now(timezone.utc).isoformat(),
            }
        except (KeyError, TypeError):
            return None

    def _build_wc_context(
        self, fixture: dict, home: str, away: str, kickoff: str, venue_prev: dict | None
    ) -> dict:
        prev = venue_prev or {}
        venue_fields = enrich_venue_context(
            fixture,
            team_a=home,
            team_b=away,
            host_city=fixture.get("fixture", {}).get("venue", {}).get("city"),
            team_a_prev_kickoff=prev.get("team_a_prev_kickoff"),
            team_b_prev_kickoff=prev.get("team_b_prev_kickoff"),
            kickoff=_parse_kickoff(kickoff),
        )
        return build_world_cup_context(
            fixture=fixture, team_a=home, team_b=away, venue_fields=venue_fields
        )
