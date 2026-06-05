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
from core.football_features import FootballFeatureStore
from core.football_data_org_client import get_fixtures as fdorg_fixtures, FREE_TIER_CODES
from core.odds_api_client import (
    get_all_bookmaker_odds,
    get_odds,
    normalize_name,
    snapshot_odds_to_supabase,
)
from core.matchbook_client import get_football_markets as mb_football_markets, is_configured as mb_configured
from core.world_cup_context import build_world_cup_context
from core.world_cup_registry import api_football_season_for, build_cycle_detail, is_world_cup_code
from core.world_cup_venue_context import enrich_venue_context
from core.world_cup_history import canonical_team_name, load_national_history, WC2026_TEAMS
from core.world_cup_team_model import build_profile
from core.espn_soccer_client import (
    get_squad_coverage,
    get_world_cup_teams,
    get_league_fixtures as espn_league_fixtures,
)
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
        self._football_features: FootballFeatureStore | None = None

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
        """
        Provider chain by cost (decision Andrea 2026-06-05, AM-API-001 'altra via'):
        football-data.org (free) -> ESPN scoreboard (free) -> API-Football LAST.
        The paid/quota-bound provider is the final fallback so its remaining
        quota survives for result settlement, not fixture polling — the 403/429
        storm of 2026-06-05 came from hammering it for off-season leagues.
        """
        fdorg_key = settings.FOOTBALL_DATA_ORG_API_KEY
        if fdorg_key and league_code in FREE_TIER_CODES:
            fixtures = await fdorg_fixtures(league_code, fdorg_key)
            if fixtures:
                return fixtures

        # Free fallback: ESPN scoreboard (no key, all our league codes).
        try:
            fixtures = await espn_league_fixtures(league_code)
            if fixtures:
                return fixtures
            # Two independent free sources agree there are no upcoming
            # fixtures (off-season): trust them and do NOT burn API-Football
            # quota — it is shared with result settlement. This was the
            # 403/429 storm of 2026-06-05.
            from core.espn_soccer_client import ESPN_LEAGUE_CODES
            if league_code in ESPN_LEAGUE_CODES:
                return []
        except Exception as e:
            self.logger.debug(f"ESPN fixtures fallback failed for {league_code}: {e}")

        # Last resort: API-Football (100 req/day shared with settlement) —
        # only reached for leagues without an ESPN mapping or if ESPN errored.
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

        # P4-A: squad_news via ESPN, computed BEFORE the publish loop so the
        # flags can travel inside each WC market:data payload — the ModelAgent
        # runs in another process and Redis is its only input, so without these
        # keys it can only assume False (the old hard-coded behaviour). The
        # espn client is TTL-cached 6h: cost is unchanged. Fail-soft: a
        # provider outage closes the gate, never breaks the cycle.
        squad_summary: dict[str, int] = {}
        squad_news_ready = False
        try:
            coverage = await get_squad_coverage()
            wc_teams_total = len(await get_world_cup_teams())
            squad_summary = {
                "covered": len(coverage),
                "teams": wc_teams_total,
                "injured_total": sum(c.get("injured", 0) for c in coverage.values()),
            }
            # Broad coverage, not perfection: >=80% of the qualified field
            # with a published squad keeps the gate honest and reachable.
            squad_news_ready = (
                wc_teams_total > 0
                and len(coverage) >= max(1, int(0.8 * wc_teams_total))
            )
        except Exception as e:
            source_errors.append(f"WC:squad_news:{e}")
        # settlement_feed = a result provider is configured AND the unified
        # history writer exists (P4-B in agents/result_settlement.py).
        settlement_ready = bool(
            settings.API_FOOTBALL_KEY or settings.FOOTBALL_DATA_ORG_API_KEY
        )

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

                # P3 wiring: persist a multi-bookmaker snapshot for World Cup odds
                # (audit trail + flips the odds_snapshots readiness gate). Capped
                # per cycle and non-fatal — a snapshot failure never blocks collection.
                if is_world_cup_code(league_code):
                    try:
                        snapshot_rows = await get_all_bookmaker_odds(league_code)
                        if snapshot_rows:
                            await snapshot_odds_to_supabase(snapshot_rows[:200])
                            self.logger.info(
                                "World Cup odds snapshot: %d rows captured",
                                min(len(snapshot_rows), 200),
                            )
                    except Exception as snap_err:
                        self.logger.warning(f"WC odds snapshot failed (non-fatal): {snap_err}")
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
                        if is_world_cup_code(league_code):
                            # Real gate flags for the ModelAgent data-quality
                            # scorer (replaces its hard-coded False defaults).
                            event["squad_news_ready"] = squad_news_ready
                            event["settlement_ready"] = settlement_ready
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
                # national_model + venue_context wired (paper tier); squad_news
                # + settlement_feed computed before the publish loop (they also
                # travel inside each WC payload for the ModelAgent scorer).
                national_model_ready=national_model_ready(),
                venue_context_ready=wc_venue_context_ready,
                settlement_ready=settlement_ready,
                squad_news_ready=squad_news_ready,
                squad_coverage=squad_summary,
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

            # National-team canonical fallback (World Cup): "Korea Republic" vs
            # "South Korea", "USA" vs "United States" etc. sit below the fuzzy
            # threshold — map BOTH sides to the canonical spelling before matching.
            if not odds_data and is_world_cup_code(league):
                canonical_key = (
                    f"{normalize_name(canonical_team_name(home))}|"
                    f"{normalize_name(canonical_team_name(away))}"
                )
                odds_data = odds_map.get(canonical_key)
                if not odds_data:
                    for key, val in odds_map.items():
                        k_home, _, k_away = key.partition("|")
                        if (
                            normalize_name(canonical_team_name(k_home))
                            == normalize_name(canonical_team_name(home))
                            and normalize_name(canonical_team_name(k_away))
                            == normalize_name(canonical_team_name(away))
                        ):
                            odds_data = val
                            break

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

            event = {
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
            if not is_world_cup_code(league):
                event.update(self._build_football_features(home, away, league, kickoff))
            return event
        except (KeyError, TypeError):
            return None

    def _build_football_features(self, home: str, away: str, league: str, kickoff: str) -> dict:
        try:
            if self._football_features is None:
                self._football_features = FootballFeatureStore()
            return self._football_features.match_context(home, away, league, kickoff)
        except Exception as exc:
            self.logger.debug("football feature enrichment skipped: %s", exc)
            return {}

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
