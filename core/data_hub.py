# core/data_hub.py
"""
DataHub — multi-source data orchestrator.
Calls all configured providers in parallel, merges results, writes to Supabase.
"""
from __future__ import annotations
import asyncio
import logging
import time
from datetime import date

import httpx
from config.settings import settings
from core.quota_tracker import QuotaTracker

logger = logging.getLogger("data_hub")

# Odds snapshot cadence (#ODDS-1, APPROVE Andrea 2026-06-06): base 30 min,
# densified to 10 min when a kickoff is imminent (closing-line capture).
# Decoupled from the collector cycle (900s/60s prematch) so model freshness
# never multiplies credit burn: 6 credits × ~10 active keys at this cadence
# ≈ 85-90K credits/month worst case, inside the 100K plan.
ODDS_SNAPSHOT_INTERVAL_BASE = 1800
ODDS_SNAPSHOT_INTERVAL_IMMINENT = 600


class DataHub:
    def __init__(
        self,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._url = supabase_url or settings.SUPABASE_URL
        self._key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY
        self.quota = QuotaTracker(supabase_url=self._url, supabase_key=self._key)
        self._last_odds_snapshot: float = 0.0

    # ── public ────────────────────────────────────────────────────────────────

    async def collect_all_fixtures(self, leagues: list[str], season: int | None = None) -> list[dict]:
        """Collect fixtures from all providers, merge, write to Supabase."""
        if season is None:
            today = date.today()
            season = today.year if today.month >= 8 else today.year - 1

        tasks = []
        if self.quota.can_call("api_football") and settings.API_FOOTBALL_KEY:
            tasks.append(self._collect_api_football(leagues, season))
        if self.quota.can_call("football_data_org") and settings.FOOTBALL_DATA_ORG_API_KEY:
            tasks.append(self._collect_fdorg(leagues, season))
        if self.quota.can_call("openligadb") and any(l in ["BL1", "BL2"] for l in leagues):
            tasks.append(self._collect_openligadb(leagues, season))

        if not tasks:
            logger.warning("DataHub: no providers available")
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)
        fixture_lists = [r for r in results if isinstance(r, list)]
        merged = self._merge_fixtures(fixture_lists)
        await self._write_fixtures(merged)
        logger.info("DataHub: %d fixtures from %d providers", len(merged), len(fixture_lists))
        return merged

    async def collect_all_odds(self, leagues: list[str], *, imminent_kickoff: bool = False) -> list[dict]:
        """Collect multi-bookmaker odds and snapshot to Supabase.

        Internally throttled (#ODDS-1): runs at most every 30 min (10 min when
        ``imminent_kickoff`` — a kickoff within 2h, for closing-line density),
        regardless of how often the collector cycles. After each snapshot the
        closing line of any just-started match is marked.
        """
        if not self.quota.can_call("odds_api") or not settings.ODDS_API_KEY:
            return []
        min_interval = (
            ODDS_SNAPSHOT_INTERVAL_IMMINENT if imminent_kickoff else ODDS_SNAPSHOT_INTERVAL_BASE
        )
        now = time.monotonic()
        if self._last_odds_snapshot and now - self._last_odds_snapshot < min_interval:
            return []
        self._last_odds_snapshot = now
        from core.odds_api_client import (
            SNAPSHOT_CREDITS_PER_CALL,
            get_all_bookmaker_odds,
            mark_closing_lines,
            snapshot_odds_to_supabase,
        )
        all_rows: list[dict] = []
        for league in leagues:
            try:
                rows = await get_all_bookmaker_odds(league)
                if rows:
                    # quota-guard skips (off-season key / missing key) return []
                    # without spending credits — only count real provider calls.
                    await self.quota.increment("odds_api", SNAPSHOT_CREDITS_PER_CALL)
                all_rows.extend(rows)
            except Exception as exc:
                logger.debug("odds error %s: %s", league, exc)
        if all_rows:
            await snapshot_odds_to_supabase(all_rows)
        await mark_closing_lines()
        return all_rows

    async def collect_tennis_fixtures(self, days_ahead: int = 7) -> list[dict]:
        """Collect tennis fixtures and write to tennis_fixtures table."""
        if not self.quota.can_call("tennis_rapidapi") or not settings.RAPIDAPI_KEY:
            return []
        from core.tennis_api_client import TennisAPIClient
        from core.tennis_odds_api_client import get_tennis_odds, merge_tennis_odds
        client = TennisAPIClient()
        fixtures = await client.get_upcoming_fixtures(days_ahead=days_ahead)
        if fixtures and settings.ODDS_API_KEY and self.quota.can_call("odds_api"):
            try:
                odds = await get_tennis_odds()
                fixtures = merge_tennis_odds(fixtures, odds)
                await self.quota.increment("odds_api")
            except Exception as exc:
                logger.debug("tennis odds enrichment error: %s", exc)
        if fixtures:
            await client.write_fixtures_to_supabase(fixtures)
            await self.quota.increment("tennis_rapidapi")
        return fixtures

    # ── merge ─────────────────────────────────────────────────────────────────

    def _merge_fixtures(self, fixture_lists: list[list[dict]]) -> list[dict]:
        seen: dict[str, dict] = {}
        for fixtures in fixture_lists:
            for f in fixtures:
                key = self._dedup_key(f)
                if key not in seen:
                    seen[key] = {**f, "providers_used": [f.get("provider", "unknown")]}
                else:
                    provider = f.get("provider", "unknown")
                    if provider not in seen[key]["providers_used"]:
                        seen[key]["providers_used"].append(provider)
        return list(seen.values())

    @staticmethod
    def _norm_team(name: str) -> str:
        # LOW (#18): normalize accents/punctuation/spacing so the SAME fixture
        # from different providers ("Atlético"/"Atletico", "Inter Milan"/"Inter
        # Milan ") collapses to one dedup key instead of duplicating rows.
        import unicodedata
        s = unicodedata.normalize("NFKD", name or "")
        s = "".join(c for c in s if not unicodedata.combining(c))
        return "".join(c for c in s.lower() if c.isalnum())

    def _dedup_key(self, fixture: dict) -> str:
        home = self._norm_team(fixture.get("home_team", ""))
        away = self._norm_team(fixture.get("away_team", ""))
        kickoff = str(fixture.get("kickoff", ""))[:10]
        return f"{home}|{away}|{kickoff}"

    # ── collectors ────────────────────────────────────────────────────────────

    async def _collect_api_football(self, leagues: list[str], season: int) -> list[dict]:
        from core.football_api_client import get_fixtures, LEAGUE_IDS
        results = []
        for league_code in leagues:
            league_id = LEAGUE_IDS.get(league_code)
            if not league_id:
                continue
            try:
                fixtures = await get_fixtures(league_id, season)
                for f in fixtures:
                    parsed = self._parse_api_football(f, league_code)
                    if parsed:
                        results.append(parsed)
                await self.quota.increment("api_football")
            except Exception as exc:
                logger.debug("api_football %s: %s", league_code, exc)
        return results

    async def _collect_fdorg(self, leagues: list[str], season: int) -> list[dict]:
        from core.football_data_org_client import get_historical_results, FREE_TIER_CODES
        results = []
        for league_code in leagues:
            if league_code not in FREE_TIER_CODES:
                continue
            try:
                raw = await get_historical_results(league_code, settings.FOOTBALL_DATA_ORG_API_KEY)
                for f in raw:
                    parsed = self._parse_fdorg(f, league_code)
                    if parsed:
                        results.append(parsed)
                await self.quota.increment("football_data_org")
            except Exception as exc:
                logger.debug("fdorg %s: %s", league_code, exc)
        return results

    async def _collect_openligadb(self, leagues: list[str], season: int) -> list[dict]:
        from core.openligadb_client import get_upcoming_fixtures
        results = []
        for league_code in [l for l in leagues if l in ("BL1", "BL2")]:
            try:
                fixtures = await get_upcoming_fixtures(league_code, season)
                results.extend(fixtures)
                await self.quota.increment("openligadb")
            except Exception as exc:
                logger.debug("openligadb %s: %s", league_code, exc)
        return results

    # ── parsers ───────────────────────────────────────────────────────────────

    def _parse_api_football(self, raw: dict, league_code: str) -> dict | None:
        try:
            fixture = raw.get("fixture", {})
            teams = raw.get("teams", {})
            home = teams.get("home", {}).get("name", "")
            away = teams.get("away", {}).get("name", "")
            kickoff = fixture.get("date", "")
            if not home or not away or not kickoff:
                return None
            status = fixture.get("status", {}).get("short", "")
            if status in ("FT", "AET", "PEN", "CANC", "PST"):
                return None
            return {
                "match_id": f"apifootball:{league_code}:{fixture.get('id', '')}",
                "home_team": home, "away_team": away, "kickoff": kickoff,
                "league": league_code,
                "venue": fixture.get("venue", {}).get("name", ""),
                "provider": "api_football",
                "_home_team_id": teams.get("home", {}).get("id"),
                "_away_team_id": teams.get("away", {}).get("id"),
                "_fixture_id": fixture.get("id"),
            }
        except Exception:
            return None

    def _parse_fdorg(self, raw: dict, league_code: str) -> dict | None:
        try:
            home = raw.get("homeTeam", {}).get("name", "")
            away = raw.get("awayTeam", {}).get("name", "")
            kickoff = raw.get("utcDate", "")
            if not home or not away or not kickoff:
                return None
            if raw.get("status") in ("FINISHED", "CANCELLED", "POSTPONED"):
                return None
            return {
                "match_id": f"fdorg:{league_code}:{raw.get('id', '')}",
                "home_team": home, "away_team": away, "kickoff": kickoff,
                "league": league_code, "provider": "fdorg",
            }
        except Exception:
            return None

    # ── Supabase write ─────────────────────────────────────────────────────────

    async def _write_fixtures(self, fixtures: list[dict]) -> None:
        if not fixtures or not self._url or not self._key:
            return
        clean = [{k: v for k, v in f.items() if not k.startswith("_")} for f in fixtures]
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                resp = await c.post(
                    f"{self._url.rstrip('/')}/rest/v1/fixtures_enriched",
                    json=clean,
                    headers={
                        "apikey": self._key,
                        "Authorization": f"Bearer {self._key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
            # LOW (#20): a fire-and-forget POST hid RLS/schema rejects (4xx) — the
            # write silently failed and no one knew. Surface non-2xx loudly.
            if resp.status_code >= 300:
                logger.warning(
                    "fixtures write rejected: %s %s", resp.status_code, resp.text[:300]
                )
        except Exception as exc:
            logger.debug("fixtures write error (non-fatal): %s", exc)
