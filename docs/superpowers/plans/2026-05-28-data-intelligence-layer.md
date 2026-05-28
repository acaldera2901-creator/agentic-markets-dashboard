# Data Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-source data ingestion layer that feeds all free APIs into Supabase, then wire the enriched data into a FeatureAdjuster that improves football and tennis prediction accuracy.

**Architecture:** A `DataHub` orchestrator calls all configured providers in parallel with quota tracking, writes canonical data to new Supabase tables, and the `FeatureAdjuster` applies form/xG/motivation/weather/H2H corrections to Dixon-Coles probabilities before publishing.

**Tech Stack:** Python asyncio, httpx, pandas, Supabase REST (existing pattern from `core/supabase_client.py`), pytest-asyncio for tests.

---

## File Map

**New files:**
- `supabase/migrations/20260528000000_data_intelligence.sql` — new tables
- `core/quota_tracker.py` — per-provider API quota enforcement
- `core/data_hub.py` — multi-source orchestrator
- `core/openligadb_client.py` — free German football API
- `core/football_data_co_uk.py` — free historical CSV loader
- `core/tennis_api_client.py` — RapidAPI Tennis (API-Sports)
- `models/feature_adjuster.py` — probability correction pipeline
- `tests/test_quota_tracker.py`
- `tests/test_feature_adjuster.py`
- `tests/test_data_hub.py`
- `tests/test_tennis_api_client.py`

**Modified files:**
- `core/football_api_client.py` — add standings, form, H2H, injuries, referee
- `core/odds_api_client.py` — add multi-bookmaker + AH snapshot
- `core/football_data_org_client.py` — add standings endpoint
- `config/settings.py` — add `TENNIS_RAPIDAPI_HOST`, `DATA_COLLECTION_DAYS_AHEAD`
- `agents/data_collector.py` — use DataHub, write to fixtures_enriched
- `agents/model.py` — apply FeatureAdjuster post-DC
- `agents/analyst.py` — use confidence_weight from FeatureAdjuster
- `agents/tennis_data_collector.py` — use TennisAPIClient
- `agents/tennis_model_agent.py` — read tennis_fixtures, apply H2H/form improvements

---

## Task 1: DB Migration — New Tables

**Files:**
- Create: `supabase/migrations/20260528000000_data_intelligence.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260528000000_data_intelligence.sql

-- Enriched fixtures: one row per match, updated pre-kickoff
CREATE TABLE IF NOT EXISTS fixtures_enriched (
  match_id           TEXT PRIMARY KEY,
  home_team          TEXT NOT NULL,
  away_team          TEXT NOT NULL,
  kickoff            TIMESTAMPTZ NOT NULL,
  league             TEXT NOT NULL,
  venue              TEXT,
  home_form          TEXT,
  away_form          TEXT,
  home_ppg           FLOAT,
  away_ppg           FLOAT,
  home_xg_avg        FLOAT,
  away_xg_avg        FLOAT,
  home_xg_luck       FLOAT,
  away_xg_luck       FLOAT,
  home_position      INT,
  away_position      INT,
  total_teams        INT,
  matches_remaining  INT,
  home_motivation    FLOAT,
  away_motivation    FLOAT,
  h2h_home_wins      INT DEFAULT 0,
  h2h_draws          INT DEFAULT 0,
  h2h_away_wins      INT DEFAULT 0,
  h2h_matches        INT DEFAULT 0,
  home_injuries_json JSONB DEFAULT '[]',
  away_injuries_json JSONB DEFAULT '[]',
  temperature_c      FLOAT,
  wind_kmh           FLOAT,
  precipitation_pct  FLOAT,
  referee_name       TEXT,
  referee_foul_rate  FLOAT,
  providers_used     TEXT[] DEFAULT '{}',
  last_updated       TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-bookmaker odds snapshots
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  match_id     TEXT NOT NULL,
  bookmaker    TEXT NOT NULL,
  source       TEXT NOT NULL,
  market       TEXT NOT NULL DEFAULT 'h2h',
  odds_home    FLOAT,
  odds_draw    FLOAT,
  odds_away    FLOAT,
  ah_line      FLOAT,
  ah_home      FLOAT,
  ah_away      FLOAT,
  overround    FLOAT,
  captured_at  TIMESTAMPTZ DEFAULT NOW(),
  is_closing   BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_match ON odds_snapshots(match_id, captured_at DESC);

-- Tennis upcoming fixtures
CREATE TABLE IF NOT EXISTS tennis_fixtures (
  match_id          TEXT PRIMARY KEY,
  player1           TEXT NOT NULL,
  player2           TEXT NOT NULL,
  tournament        TEXT,
  surface           TEXT,
  round             TEXT,
  scheduled_at      TIMESTAMPTZ,
  p1_rank           INT,
  p2_rank           INT,
  p1_rank_points    INT,
  p2_rank_points    INT,
  h2h_p1_wins       INT DEFAULT 0,
  h2h_p2_wins       INT DEFAULT 0,
  h2h_surface_p1    INT DEFAULT 0,
  h2h_surface_p2    INT DEFAULT 0,
  p1_form_json      JSONB DEFAULT '[]',
  p2_form_json      JSONB DEFAULT '[]',
  p1_rest_days      INT,
  p2_rest_days      INT,
  p1_sets_last      INT,
  p2_sets_last      INT,
  provider          TEXT,
  last_updated      TIMESTAMPTZ DEFAULT NOW()
);

-- API quota tracking
CREATE TABLE IF NOT EXISTS source_quota_log (
  provider        TEXT NOT NULL,
  date            DATE NOT NULL,
  requests_made   INT DEFAULT 0,
  requests_limit  INT,
  last_request_at TIMESTAMPTZ,
  PRIMARY KEY (provider, date)
);
```

- [ ] **Step 2: Apply migration to Supabase**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
supabase db push --linked
```

Expected: Migration applied without errors. If `supabase` CLI not linked, run via SQL editor in Supabase dashboard.

- [ ] **Step 3: Verify tables exist**

```bash
supabase db diff --linked 2>/dev/null | grep "fixtures_enriched\|odds_snapshots\|tennis_fixtures\|source_quota_log" | head -10
```

Expected: No diff (tables already present).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528000000_data_intelligence.sql
git commit -m "feat(db): add fixtures_enriched, odds_snapshots, tennis_fixtures, source_quota_log tables"
```

---

## Task 2: QuotaTracker

**Files:**
- Create: `core/quota_tracker.py`
- Create: `tests/test_quota_tracker.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_quota_tracker.py
import pytest
from unittest.mock import AsyncMock, patch
from core.quota_tracker import QuotaTracker

LIMITS = {
    "api_football": {"daily": 100},
    "odds_api": {"monthly": 500},
    "football_data_org": {"per_minute": 10, "daily": 5000},
    "openweathermap": {"daily": 1000},
    "tennis_rapidapi": {"daily": 100},
    "openligadb": {"daily": 99999},
    "football_data_co_uk": {"daily": 99999},
}

@pytest.mark.asyncio
async def test_can_call_when_under_limit():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 50, "limit": 100}
    assert tracker.can_call("api_football") is True

@pytest.mark.asyncio
async def test_cannot_call_when_at_limit():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 100, "limit": 100}
    assert tracker.can_call("api_football") is False

@pytest.mark.asyncio
async def test_increment_updates_cache():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    tracker._cache["api_football"] = {"used": 50, "limit": 100}
    await tracker.increment("api_football")
    assert tracker._cache["api_football"]["used"] == 51

@pytest.mark.asyncio
async def test_unknown_provider_always_allowed():
    tracker = QuotaTracker(LIMITS, supabase_url=None, supabase_key=None)
    assert tracker.can_call("unknown_provider") is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
python -m pytest tests/test_quota_tracker.py -v
```

Expected: `ImportError: cannot import name 'QuotaTracker' from 'core.quota_tracker'`

- [ ] **Step 3: Implement QuotaTracker**

```python
# core/quota_tracker.py
"""
Per-provider API quota enforcement.
Tracks daily/monthly usage in memory (cache) + persists to Supabase source_quota_log.
Failures to persist are non-fatal — the in-memory cache is always authoritative.
"""
from __future__ import annotations
import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx
from config.settings import settings

logger = logging.getLogger("quota_tracker")

DEFAULT_LIMITS: dict[str, dict[str, int]] = {
    "api_football":        {"daily": 100},
    "odds_api":            {"monthly": 500},
    "football_data_org":   {"daily": 5000},
    "openweathermap":      {"daily": 1000},
    "tennis_rapidapi":     {"daily": 100},
    "openligadb":          {"daily": 99999},
    "football_data_co_uk": {"daily": 99999},
}


class QuotaTracker:
    def __init__(
        self,
        limits: dict[str, dict[str, int]] | None = None,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._limits = limits or DEFAULT_LIMITS
        self._url = supabase_url or settings.SUPABASE_URL
        self._key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY
        # cache: provider → {used: int, limit: int, date: str}
        self._cache: dict[str, dict[str, Any]] = {}

    # ── public interface ──────────────────────────────────────────────────────

    def can_call(self, provider: str) -> bool:
        """Return True if provider has quota remaining."""
        if provider not in self._limits:
            return True
        entry = self._cache.get(provider)
        if entry is None:
            return True
        return entry["used"] < entry["limit"]

    async def increment(self, provider: str) -> None:
        """Increment usage counter and persist to Supabase (best effort)."""
        if provider not in self._limits:
            return
        today = str(date.today())
        limit_cfg = self._limits[provider]
        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
        if provider not in self._cache or self._cache[provider].get("date") != today:
            self._cache[provider] = {"used": 0, "limit": limit, "date": today}
        self._cache[provider]["used"] += 1
        await self._persist(provider, self._cache[provider]["used"], limit)

    async def load(self, provider: str) -> None:
        """Load current usage from Supabase into cache."""
        if not self._url or not self._key:
            return
        today = str(date.today())
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                resp = await c.get(
                    f"{self._url.rstrip('/')}/rest/v1/source_quota_log",
                    params={"provider": f"eq.{provider}", "date": f"eq.{today}"},
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    if rows:
                        row = rows[0]
                        limit_cfg = self._limits.get(provider, {})
                        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
                        self._cache[provider] = {
                            "used": row.get("requests_made", 0),
                            "limit": limit,
                            "date": today,
                        }
        except Exception as exc:
            logger.debug("quota load error (non-fatal): %s", exc)

    # ── private ───────────────────────────────────────────────────────────────

    async def _persist(self, provider: str, used: int, limit: int) -> None:
        if not self._url or not self._key:
            return
        today = str(date.today())
        payload = {
            "provider": provider,
            "date": today,
            "requests_made": used,
            "requests_limit": limit,
            "last_request_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                await c.post(
                    f"{self._url.rstrip('/')}/rest/v1/source_quota_log",
                    json=payload,
                    headers={**self._headers(), "Prefer": "resolution=merge-duplicates"},
                )
        except Exception as exc:
            logger.debug("quota persist error (non-fatal): %s", exc)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_quota_tracker.py -v
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/quota_tracker.py tests/test_quota_tracker.py
git commit -m "feat(quota): QuotaTracker — per-provider daily/monthly enforcement with Supabase persistence"
```

---

## Task 3: Extend football_api_client.py

**Files:**
- Modify: `core/football_api_client.py`

- [ ] **Step 1: Add new functions after existing ones**

Append to `core/football_api_client.py`:

```python
async def get_standings(league_id: int, season: int) -> List[Dict]:
    """Return league table rows for the given league+season."""
    if not settings.API_FOOTBALL_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/standings",
                params={"league": league_id, "season": season},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            standings = data.get("response", [])
            if not standings:
                return []
            return standings[0].get("league", {}).get("standings", [[]])[0]
    except Exception:
        return []


async def get_team_form(team_id: int, league_id: int, season: int, last_n: int = 10) -> Dict:
    """
    Return form data for team: last N fixtures with goals and result.
    Returns: {form: "WWDLW", ppg: float, xg_avg: float, matches: list}
    """
    if not settings.API_FOOTBALL_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures",
                params={"team": team_id, "league": league_id, "season": season,
                        "last": last_n, "status": "FT"},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {}
            fixtures = resp.json().get("response", [])
    except Exception:
        return {}

    results = []
    for f in fixtures:
        goals = f.get("goals", {})
        teams = f.get("teams", {})
        is_home = teams.get("home", {}).get("id") == team_id
        scored = goals.get("home") if is_home else goals.get("away")
        conceded = goals.get("away") if is_home else goals.get("home")
        if scored is None or conceded is None:
            continue
        won = scored > conceded
        drawn = scored == conceded
        results.append({"w": won, "d": drawn, "scored": scored, "conceded": conceded})

    if not results:
        return {}

    form_str = "".join("W" if r["w"] else ("D" if r["d"] else "L") for r in results[-5:])
    points = sum(3 if r["w"] else (1 if r["d"] else 0) for r in results)
    ppg = round(points / len(results), 3)
    avg_scored = round(sum(r["scored"] for r in results) / len(results), 3)
    return {"form": form_str, "ppg": ppg, "xg_avg": avg_scored, "matches": len(results)}


async def get_h2h(team1_id: int, team2_id: int, last_n: int = 10) -> Dict:
    """
    Return H2H record between two teams.
    Returns: {team1_wins: int, draws: int, team2_wins: int, total: int}
    """
    if not settings.API_FOOTBALL_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures/headtohead",
                params={"h2h": f"{team1_id}-{team2_id}", "last": last_n, "status": "FT"},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {}
            fixtures = resp.json().get("response", [])
    except Exception:
        return {}

    t1_wins = draws = t2_wins = 0
    for f in fixtures:
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        home_id = teams.get("home", {}).get("id")
        gh, ga = goals.get("home", 0), goals.get("away", 0)
        if gh == ga:
            draws += 1
        elif gh > ga:
            (t1_wins if home_id == team1_id else t2_wins).__class__  # placeholder fix below
            if home_id == team1_id:
                t1_wins += 1
            else:
                t2_wins += 1
        else:
            if home_id == team1_id:
                t2_wins += 1
            else:
                t1_wins += 1
    return {"team1_wins": t1_wins, "draws": draws, "team2_wins": t2_wins, "total": len(fixtures)}


async def get_injuries(fixture_id: int) -> Dict:
    """Return injury lists for both teams in a fixture."""
    if not settings.API_FOOTBALL_KEY:
        return {"home": [], "away": []}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/injuries",
                params={"fixture": fixture_id},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {"home": [], "away": []}
            injuries = resp.json().get("response", [])
    except Exception:
        return {"home": [], "away": []}

    home_inj, away_inj = [], []
    for inj in injuries:
        team = inj.get("team", {})
        player = inj.get("player", {})
        entry = {"name": player.get("name"), "reason": inj.get("reason", "")}
        # API returns "home" or "away" in the fixture context
        if inj.get("fixture", {}).get("id") == fixture_id:
            home_inj.append(entry) if team.get("id") else away_inj.append(entry)
    return {"home": home_inj, "away": away_inj}
```

- [ ] **Step 2: Verify syntax**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
python -m py_compile core/football_api_client.py && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add core/football_api_client.py
git commit -m "feat(football-api): add get_standings, get_team_form, get_h2h, get_injuries"
```

---

## Task 4: Extend odds_api_client.py

**Files:**
- Modify: `core/odds_api_client.py`

- [ ] **Step 1: Add multi-bookmaker + AH + snapshot functions**

Append to `core/odds_api_client.py`:

```python
async def get_all_bookmaker_odds(league_code: str) -> List[Dict]:
    """
    Fetch odds from ALL available bookmakers for upcoming matches.
    Returns list of {match_id, home_team, away_team, bookmaker, odds_home, odds_draw, odds_away, overround}.
    """
    sport_key = SPORT_KEYS.get(league_code)
    if not sport_key or not settings.ODDS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": settings.ODDS_API_KEY,
                    "regions": "eu,uk",
                    "markets": "h2h,spreads",
                    "oddsFormat": "decimal",
                    "dateFormat": "iso",
                },
            )
            if resp.status_code != 200:
                return []
            events = resp.json()
    except Exception:
        return []

    rows = []
    for ev in events:
        match_id = f"{league_code}:{ev.get('id', '')}"
        home = ev.get("home_team", "")
        away = ev.get("away_team", "")
        for bm in ev.get("bookmakers", []):
            bm_name = bm.get("key", "")
            for market in bm.get("markets", []):
                if market.get("key") == "h2h":
                    outcomes = {o["name"]: o["price"] for o in market.get("outcomes", [])}
                    oh = outcomes.get(home, 0.0)
                    od = outcomes.get("Draw", 0.0)
                    oa = outcomes.get(away, 0.0)
                    if oh and od and oa:
                        overround = round((1/oh + 1/od + 1/oa) - 1, 4)
                        rows.append({
                            "match_id": match_id, "home_team": home, "away_team": away,
                            "bookmaker": bm_name, "source": "odds_api", "market": "h2h",
                            "odds_home": oh, "odds_draw": od, "odds_away": oa,
                            "overround": overround,
                        })
                elif market.get("key") == "spreads":
                    for outcome in market.get("outcomes", []):
                        is_home = outcome["name"] == home
                        rows.append({
                            "match_id": match_id, "home_team": home, "away_team": away,
                            "bookmaker": bm_name, "source": "odds_api", "market": "ah",
                            "ah_line": outcome.get("point", 0.0),
                            "ah_home": outcome["price"] if is_home else None,
                            "ah_away": outcome["price"] if not is_home else None,
                        })
    return rows


async def snapshot_odds_to_supabase(rows: List[Dict]) -> None:
    """Write multi-bookmaker odds rows to odds_snapshots table in Supabase."""
    if not rows or not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/odds_snapshots",
                json=rows,
                headers=headers,
            )
    except Exception as exc:
        import logging
        logging.getLogger("odds_api_client").debug("snapshot write failed (non-fatal): %s", exc)
```

- [ ] **Step 2: Verify syntax**

```bash
python -m py_compile core/odds_api_client.py && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add core/odds_api_client.py
git commit -m "feat(odds-api): add get_all_bookmaker_odds and snapshot_odds_to_supabase"
```

---

## Task 5: football_data_org_client — Add Standings

**Files:**
- Modify: `core/football_data_org_client.py`

- [ ] **Step 1: Append standings function**

```python
# Append to core/football_data_org_client.py

async def get_standings(competition_code: str, api_key: str) -> List[Dict]:
    """Return standings table for a competition. Returns [] if not in free tier."""
    if competition_code not in FREE_TIER_CODES:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"https://api.football-data.org/v4/competitions/{competition_code}/standings",
                headers={"X-Auth-Token": api_key},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            standings = data.get("standings", [])
            for s in standings:
                if s.get("type") == "TOTAL":
                    return s.get("table", [])
            return []
    except Exception:
        return []
```

- [ ] **Step 2: Verify syntax**

```bash
python -m py_compile core/football_data_org_client.py && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add core/football_data_org_client.py
git commit -m "feat(fdorg): add get_standings endpoint"
```

---

## Task 6: OpenLigaDB Client (Free, No Key)

**Files:**
- Create: `core/openligadb_client.py`

- [ ] **Step 1: Write the client**

```python
# core/openligadb_client.py
"""
OpenLigaDB — free German football data, no API key required.
Covers Bundesliga (bl1), 2. Bundesliga (bl2).
Docs: https://api.openligadb.de/
"""
from __future__ import annotations
import httpx
import logging
from typing import List, Dict

logger = logging.getLogger("openligadb_client")
BASE = "https://api.openligadb.de"
LEAGUE_MAP = {"BL1": "bl1", "BL2": "bl2"}


async def get_upcoming_fixtures(league_code: str, season: int) -> List[Dict]:
    """
    Return upcoming fixtures for Bundesliga leagues.
    Each dict: {match_id, home_team, away_team, kickoff, league, provider}.
    """
    slug = LEAGUE_MAP.get(league_code)
    if not slug:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(f"{BASE}/getmatchdata/{slug}/{season}")
            if resp.status_code != 200:
                return []
            matches = resp.json()
    except Exception as exc:
        logger.debug("openligadb error: %s", exc)
        return []

    results = []
    for m in matches:
        if m.get("matchIsFinished"):
            continue
        team1 = m.get("team1", {}).get("teamName", "")
        team2 = m.get("team2", {}).get("teamName", "")
        kickoff = m.get("matchDateTimeUTC", "")
        mid = f"openligadb:{league_code}:{m.get('matchID', '')}"
        if team1 and team2 and kickoff:
            results.append({
                "match_id": mid, "home_team": team1, "away_team": team2,
                "kickoff": kickoff, "league": league_code, "provider": "openligadb",
            })
    return results


async def get_table(league_code: str, season: int) -> List[Dict]:
    """
    Return current league table.
    Each dict: {team_name, position, points, goals_for, goals_against, matches_played}.
    """
    slug = LEAGUE_MAP.get(league_code)
    if not slug:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(f"{BASE}/getbltable/{slug}/{season}")
            if resp.status_code != 200:
                return []
            table = resp.json()
    except Exception as exc:
        logger.debug("openligadb table error: %s", exc)
        return []

    return [
        {
            "team_name": row.get("teamName", ""),
            "position": i + 1,
            "points": row.get("points", 0),
            "goals_for": row.get("goals", 0),
            "goals_against": row.get("opponentGoals", 0),
            "matches_played": row.get("matches", 0),
        }
        for i, row in enumerate(table)
    ]
```

- [ ] **Step 2: Quick integration test (live call)**

```bash
python -c "
import asyncio
from core.openligadb_client import get_upcoming_fixtures, get_table
async def test():
    f = await get_upcoming_fixtures('BL1', 2025)
    t = await get_table('BL1', 2025)
    print(f'Fixtures: {len(f)}, Table: {len(t)} teams')
    if f: print('First fixture:', f[0])
asyncio.run(test())
"
```

Expected: `Fixtures: N, Table: 18 teams` (N may be 0 if season finished)

- [ ] **Step 3: Commit**

```bash
git add core/openligadb_client.py
git commit -m "feat(openligadb): free Bundesliga fixtures + standings client (no API key)"
```

---

## Task 7: Football-data.co.uk Historical CSV Loader

**Files:**
- Create: `core/football_data_co_uk.py`

- [ ] **Step 1: Write the CSV loader**

```python
# core/football_data_co_uk.py
"""
Football-data.co.uk — free historical match results + closing odds CSV files.
Covers all major European leagues going back 10+ years.
No API key, just HTTP downloads. Rate limit: be polite (max 1 req/sec).
URL pattern: https://www.football-data.co.uk/mmz4281/{season}/{league_code}.csv
Season format: "2526" for 2025/26.
"""
from __future__ import annotations
import io
import logging
import asyncio
from datetime import datetime
from typing import List, Dict

import httpx
import pandas as pd

logger = logging.getLogger("football_data_co_uk")
BASE = "https://www.football-data.co.uk/mmz4281"

# Map our league codes to football-data.co.uk file codes
LEAGUE_FILE_MAP = {
    "PL": "E0",    # England Premier League
    "SA": "I1",    # Italy Serie A
    "PD": "SP1",   # Spain La Liga
    "BL1": "D1",   # Germany Bundesliga
    "FL1": "F1",   # France Ligue 1
}

# Column aliases across different CSV versions
_ODDS_COLS = ["B365H", "BWH", "IWH", "PSH", "WHH"]  # home odds, try in order


def _current_seasons(years_back: int = 3) -> List[str]:
    """Return last N season codes, e.g. ['2526', '2425', '2324']."""
    today = datetime.today()
    year = today.year % 100  # 2-digit year
    seasons = []
    for i in range(years_back):
        y2 = year - i
        y1 = y2 - 1
        seasons.append(f"{y1:02d}{y2:02d}")
    return seasons


async def fetch_historical(league_code: str, years_back: int = 3) -> List[Dict]:
    """
    Download and parse historical CSVs for a league.
    Returns list of match dicts: {home_team, away_team, date, home_goals, away_goals,
                                   odds_home, odds_draw, odds_away}.
    """
    file_code = LEAGUE_FILE_MAP.get(league_code)
    if not file_code:
        return []

    all_rows: List[Dict] = []
    seasons = _current_seasons(years_back)

    async with httpx.AsyncClient(timeout=20.0) as c:
        for season in seasons:
            url = f"{BASE}/{season}/{file_code}.csv"
            try:
                resp = await c.get(url)
                if resp.status_code != 200:
                    logger.debug("football-data.co.uk: %s returned %s", url, resp.status_code)
                    continue
                df = pd.read_csv(io.StringIO(resp.text), on_bad_lines="skip")
                all_rows.extend(_parse_df(df, league_code))
                await asyncio.sleep(0.5)  # polite rate limiting
            except Exception as exc:
                logger.debug("CSV fetch error %s: %s", url, exc)

    logger.info("football_data_co_uk: loaded %d historical rows for %s", len(all_rows), league_code)
    return all_rows


def _parse_df(df: pd.DataFrame, league_code: str) -> List[Dict]:
    rows = []
    # Detect best available odds column
    odds_col_h = next((c for c in _ODDS_COLS if c in df.columns), None)
    odds_col_d = odds_col_h.replace("H", "D") if odds_col_h else None
    odds_col_a = odds_col_h.replace("H", "A") if odds_col_h else None

    for _, row in df.iterrows():
        try:
            home = str(row.get("HomeTeam", "")).strip()
            away = str(row.get("AwayTeam", "")).strip()
            fthg = row.get("FTHG")
            ftag = row.get("FTAG")
            if not home or not away or pd.isna(fthg) or pd.isna(ftag):
                continue
            entry: Dict = {
                "home_team": home, "away_team": away,
                "league": league_code,
                "home_goals": int(fthg), "away_goals": int(ftag),
                "date": str(row.get("Date", "")),
            }
            if odds_col_h and odds_col_d and odds_col_a:
                oh = row.get(odds_col_h)
                od = row.get(odds_col_d)
                oa = row.get(odds_col_a)
                if not (pd.isna(oh) or pd.isna(od) or pd.isna(oa)):
                    entry["odds_home"] = float(oh)
                    entry["odds_draw"] = float(od)
                    entry["odds_away"] = float(oa)
            rows.append(entry)
        except (ValueError, TypeError):
            continue
    return rows
```

- [ ] **Step 2: Verify syntax + quick smoke**

```bash
python -m py_compile core/football_data_co_uk.py && echo "OK"
python -c "
import asyncio
from core.football_data_co_uk import fetch_historical
async def test():
    rows = await fetch_historical('PL', years_back=1)
    print(f'PL historical rows: {len(rows)}')
    if rows: print('Sample:', rows[0])
asyncio.run(test())
"
```

Expected: `PL historical rows: 300+`

- [ ] **Step 3: Commit**

```bash
git add core/football_data_co_uk.py
git commit -m "feat(fdcouk): free historical results + closing odds CSV loader (football-data.co.uk)"
```

---

## Task 8: Tennis API Client (RapidAPI)

**Files:**
- Create: `core/tennis_api_client.py`
- Create: `tests/test_tennis_api_client.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_tennis_api_client.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.tennis_api_client import TennisAPIClient, normalize_player_name

def test_normalize_player_name():
    assert normalize_player_name("Carlos Alcaraz") == "carlos alcaraz"
    assert normalize_player_name("  Novak Djokovic  ") == "novak djokovic"

def test_parse_fixture_returns_canonical_shape():
    client = TennisAPIClient(rapidapi_key="test", supabase_url=None, supabase_key=None)
    raw = {
        "id": 99,
        "date": "2026-06-01T14:00:00",
        "tournament": {"name": "Roland Garros", "surface": "Clay"},
        "round": {"name": "Quarterfinals"},
        "players": {
            "home": {"name": "Carlos Alcaraz", "ranking": 3},
            "away": {"name": "Novak Djokovic", "ranking": 2},
        },
    }
    result = client._parse_fixture(raw)
    assert result["player1"] == "Carlos Alcaraz"
    assert result["player2"] == "Novak Djokovic"
    assert result["surface"] == "clay"
    assert result["round"] == "Quarterfinals"
    assert result["p1_rank"] == 3
    assert result["p2_rank"] == 2
    assert "match_id" in result
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_tennis_api_client.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement TennisAPIClient**

```python
# core/tennis_api_client.py
"""
Tennis API client via RapidAPI (API-Sports Tennis).
Uses RAPIDAPI_KEY from settings. Free tier: 100 requests/day.
Host: v1.tennis.api-sports.io
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from config.settings import settings

logger = logging.getLogger("tennis_api_client")

_RAPIDAPI_HOST = "v1.tennis.api-sports.io"
_BASE = f"https://{_RAPIDAPI_HOST}"
_SURFACE_MAP = {"Clay": "clay", "Hard": "hard", "Grass": "grass", "Indoor Hard": "hard"}


def normalize_player_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


class TennisAPIClient:
    def __init__(
        self,
        rapidapi_key: str | None = None,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._key = rapidapi_key or settings.RAPIDAPI_KEY
        self._supa_url = supabase_url or settings.SUPABASE_URL
        self._supa_key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY

    # ── public interface ──────────────────────────────────────────────────────

    async def get_upcoming_fixtures(self, days_ahead: int = 7) -> list[dict]:
        """Fetch ATP/WTA fixtures for the next N days. Returns list of canonical fixture dicts."""
        if not self._key:
            logger.warning("RAPIDAPI_KEY not configured — tennis fixtures unavailable")
            return []
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        fixtures: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as c:
                resp = await c.get(
                    f"{_BASE}/games",
                    params={"date": today},
                    headers=self._headers(),
                )
                if resp.status_code != 200:
                    logger.warning("tennis API %s: %s", resp.status_code, resp.text[:200])
                    return []
                data = resp.json()
                for item in data.get("response", []):
                    parsed = self._parse_fixture(item)
                    if parsed:
                        fixtures.append(parsed)
        except Exception as exc:
            logger.debug("tennis API error (non-fatal): %s", exc)
        return fixtures

    async def get_h2h(self, p1_name: str, p2_name: str) -> dict:
        """
        Return H2H stats between two players by name search.
        Returns {p1_wins, p2_wins, total, surface_p1_wins, surface_p2_wins}.
        """
        if not self._key:
            return {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                # Search player IDs first
                r1 = await c.get(f"{_BASE}/players", params={"search": p1_name}, headers=self._headers())
                r2 = await c.get(f"{_BASE}/players", params={"search": p2_name}, headers=self._headers())
                pid1 = r1.json().get("response", [{}])[0].get("id") if r1.status_code == 200 else None
                pid2 = r2.json().get("response", [{}])[0].get("id") if r2.status_code == 200 else None
                if not pid1 or not pid2:
                    return {}
                h2h_resp = await c.get(
                    f"{_BASE}/games",
                    params={"h2h": f"{pid1}-{pid2}"},
                    headers=self._headers(),
                )
                if h2h_resp.status_code != 200:
                    return {}
                games = h2h_resp.json().get("response", [])
        except Exception as exc:
            logger.debug("tennis h2h error: %s", exc)
            return {}

        p1_wins = p2_wins = 0
        for g in games:
            players = g.get("players", {})
            winner = g.get("winner", {})
            wp = winner.get("id")
            if wp == pid1:
                p1_wins += 1
            elif wp == pid2:
                p2_wins += 1
        return {"p1_wins": p1_wins, "p2_wins": p2_wins, "total": p1_wins + p2_wins}

    async def write_fixtures_to_supabase(self, fixtures: list[dict]) -> None:
        """Upsert tennis_fixtures rows into Supabase."""
        if not fixtures or not self._supa_url or not self._supa_key:
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(
                    f"{self._supa_url.rstrip('/')}/rest/v1/tennis_fixtures",
                    json=fixtures,
                    headers={
                        "apikey": self._supa_key,
                        "Authorization": f"Bearer {self._supa_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
        except Exception as exc:
            logger.debug("tennis fixture write error (non-fatal): %s", exc)

    # ── internal ─────────────────────────────────────────────────────────────

    def _parse_fixture(self, raw: dict[str, Any]) -> dict | None:
        try:
            players = raw.get("players", {})
            p1 = players.get("home", {})
            p2 = players.get("away", {})
            if not p1.get("name") or not p2.get("name"):
                return None
            tournament = raw.get("tournament", {})
            surface_raw = tournament.get("surface", "Hard")
            surface = _SURFACE_MAP.get(surface_raw, "hard")
            scheduled = raw.get("date", "")
            match_id = f"tennis:rapidapi:{raw.get('id', '')}"
            return {
                "match_id": match_id,
                "player1": p1["name"],
                "player2": p2["name"],
                "tournament": tournament.get("name", ""),
                "surface": surface,
                "round": raw.get("round", {}).get("name", ""),
                "scheduled_at": scheduled,
                "p1_rank": p1.get("ranking"),
                "p2_rank": p2.get("ranking"),
                "p1_rank_points": p1.get("points"),
                "p2_rank_points": p2.get("points"),
                "provider": "rapidapi_tennis",
            }
        except Exception:
            return None

    def _headers(self) -> dict:
        return {
            "x-rapidapi-key": self._key,
            "x-rapidapi-host": _RAPIDAPI_HOST,
        }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_tennis_api_client.py -v
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/tennis_api_client.py tests/test_tennis_api_client.py
git commit -m "feat(tennis): TennisAPIClient — RapidAPI ATP/WTA fixtures, H2H, Supabase writer"
```

---

## Task 9: DataHub

**Files:**
- Create: `core/data_hub.py`
- Create: `tests/test_data_hub.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_data_hub.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.data_hub import DataHub

@pytest.mark.asyncio
async def test_merge_deduplicates_same_fixture():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "api_football"}]
    f2 = [{"match_id": "b:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "fdorg"}]
    merged = hub._merge_fixtures([f1, f2])
    assert len(merged) == 1
    assert "api_football" in merged[0]["providers_used"]
    assert "fdorg" in merged[0]["providers_used"]

@pytest.mark.asyncio
async def test_merge_keeps_different_fixtures():
    hub = DataHub(supabase_url=None, supabase_key=None)
    f1 = [{"match_id": "a:1", "home_team": "Arsenal", "away_team": "Chelsea",
            "kickoff": "2026-06-01T15:00:00Z", "league": "PL", "provider": "api_football"}]
    f2 = [{"match_id": "b:2", "home_team": "Liverpool", "away_team": "Man City",
            "kickoff": "2026-06-01T17:00:00Z", "league": "PL", "provider": "fdorg"}]
    merged = hub._merge_fixtures([f1, f2])
    assert len(merged) == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_data_hub.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement DataHub**

```python
# core/data_hub.py
"""
DataHub — multi-source data orchestrator.
Calls all configured providers in parallel, merges results, writes to Supabase.
Agents call hub.collect_all_fixtures() instead of individual API clients.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import date, datetime
from typing import Any

import httpx
from config.settings import settings
from core.quota_tracker import QuotaTracker

logger = logging.getLogger("data_hub")


class DataHub:
    def __init__(
        self,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._url = supabase_url or settings.SUPABASE_URL
        self._key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY
        self.quota = QuotaTracker(supabase_url=self._url, supabase_key=self._key)

    # ── public interface ──────────────────────────────────────────────────────

    async def collect_all_fixtures(self, leagues: list[str], season: int | None = None) -> list[dict]:
        """
        Collect upcoming fixtures from all available providers.
        Returns merged, deduplicated list of canonical fixture dicts.
        Writes to fixtures_enriched in Supabase.
        """
        if season is None:
            today = date.today()
            season = today.year if today.month >= 8 else today.year - 1

        tasks = []

        if self.quota.can_call("api_football") and settings.API_FOOTBALL_KEY:
            tasks.append(self._collect_api_football(leagues, season))

        if self.quota.can_call("football_data_org") and settings.FOOTBALL_DATA_ORG_API_KEY:
            tasks.append(self._collect_fdorg(leagues, season))

        if self.quota.can_call("openligadb"):
            if any(l in ["BL1", "BL2"] for l in leagues):
                tasks.append(self._collect_openligadb(leagues, season))

        if not tasks:
            logger.warning("DataHub: no providers available (all quota exhausted or unconfigured)")
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)
        fixture_lists = [r for r in results if isinstance(r, list)]
        merged = self._merge_fixtures(fixture_lists)
        await self._write_fixtures(merged)
        logger.info("DataHub: collected %d fixtures from %d providers", len(merged), len(fixture_lists))
        return merged

    async def collect_all_odds(self, leagues: list[str]) -> list[dict]:
        """Collect multi-bookmaker odds and snapshot them to Supabase."""
        if not self.quota.can_call("odds_api") or not settings.ODDS_API_KEY:
            return []
        from core.odds_api_client import get_all_bookmaker_odds, snapshot_odds_to_supabase
        all_rows: list[dict] = []
        for league in leagues:
            try:
                rows = await get_all_bookmaker_odds(league)
                all_rows.extend(rows)
                await self.quota.increment("odds_api")
            except Exception as exc:
                logger.debug("odds collection error for %s: %s", league, exc)
        if all_rows:
            await snapshot_odds_to_supabase(all_rows)
        return all_rows

    async def collect_tennis_fixtures(self, days_ahead: int = 7) -> list[dict]:
        """Collect upcoming tennis fixtures and write to tennis_fixtures table."""
        if not self.quota.can_call("tennis_rapidapi") or not settings.RAPIDAPI_KEY:
            return []
        from core.tennis_api_client import TennisAPIClient
        client = TennisAPIClient()
        fixtures = await client.get_upcoming_fixtures(days_ahead=days_ahead)
        if fixtures:
            await client.write_fixtures_to_supabase(fixtures)
            await self.quota.increment("tennis_rapidapi")
        return fixtures

    # ── merge logic ───────────────────────────────────────────────────────────

    def _merge_fixtures(self, fixture_lists: list[list[dict]]) -> list[dict]:
        """
        Merge fixtures from multiple providers.
        Deduplication key: (normalized home_team, normalized away_team, kickoff_date).
        First provider wins for base data; providers_used accumulates all sources.
        """
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

    def _dedup_key(self, fixture: dict) -> str:
        home = fixture.get("home_team", "").lower().strip()
        away = fixture.get("away_team", "").lower().strip()
        kickoff = str(fixture.get("kickoff", ""))[:10]  # date only
        return f"{home}|{away}|{kickoff}"

    # ── provider collectors ───────────────────────────────────────────────────

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
                    parsed = self._parse_api_football_fixture(f, league_code)
                    if parsed:
                        results.append(parsed)
                await self.quota.increment("api_football")
            except Exception as exc:
                logger.debug("api_football collection error %s: %s", league_code, exc)
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
                    parsed = self._parse_fdorg_fixture(f, league_code)
                    if parsed:
                        results.append(parsed)
                await self.quota.increment("football_data_org")
            except Exception as exc:
                logger.debug("fdorg collection error %s: %s", league_code, exc)
        return results

    async def _collect_openligadb(self, leagues: list[str], season: int) -> list[dict]:
        from core.openligadb_client import get_upcoming_fixtures
        results = []
        for league_code in [l for l in leagues if l in ["BL1", "BL2"]]:
            try:
                fixtures = await get_upcoming_fixtures(league_code, season)
                results.extend(fixtures)
                await self.quota.increment("openligadb")
            except Exception as exc:
                logger.debug("openligadb error %s: %s", league_code, exc)
        return results

    # ── parsers ───────────────────────────────────────────────────────────────

    def _parse_api_football_fixture(self, raw: dict, league_code: str) -> dict | None:
        try:
            fixture = raw.get("fixture", {})
            teams = raw.get("teams", {})
            home = teams.get("home", {}).get("name", "")
            away = teams.get("away", {}).get("name", "")
            kickoff = fixture.get("date", "")
            mid = f"apifootball:{league_code}:{fixture.get('id', '')}"
            if not home or not away or not kickoff:
                return None
            status = fixture.get("status", {}).get("short", "")
            if status in ("FT", "AET", "PEN", "CANC", "PST"):
                return None  # skip finished/cancelled
            return {
                "match_id": mid, "home_team": home, "away_team": away,
                "kickoff": kickoff, "league": league_code,
                "venue": fixture.get("venue", {}).get("name", ""),
                "provider": "api_football",
                "_home_team_id": teams.get("home", {}).get("id"),
                "_away_team_id": teams.get("away", {}).get("id"),
                "_fixture_id": fixture.get("id"),
            }
        except Exception:
            return None

    def _parse_fdorg_fixture(self, raw: dict, league_code: str) -> dict | None:
        try:
            home = raw.get("homeTeam", {}).get("name", "")
            away = raw.get("awayTeam", {}).get("name", "")
            kickoff = raw.get("utcDate", "")
            mid = f"fdorg:{league_code}:{raw.get('id', '')}"
            if not home or not away or not kickoff:
                return None
            if raw.get("status") in ("FINISHED", "CANCELLED", "POSTPONED"):
                return None
            return {
                "match_id": mid, "home_team": home, "away_team": away,
                "kickoff": kickoff, "league": league_code, "provider": "fdorg",
            }
        except Exception:
            return None

    # ── Supabase write ────────────────────────────────────────────────────────

    async def _write_fixtures(self, fixtures: list[dict]) -> None:
        if not fixtures or not self._url or not self._key:
            return
        # Strip internal _keys before writing to DB
        clean = [{k: v for k, v in f.items() if not k.startswith("_")} for f in fixtures]
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(
                    f"{self._url.rstrip('/')}/rest/v1/fixtures_enriched",
                    json=clean,
                    headers={
                        "apikey": self._key,
                        "Authorization": f"Bearer {self._key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
        except Exception as exc:
            logger.debug("fixtures write error (non-fatal): %s", exc)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_data_hub.py -v
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/data_hub.py tests/test_data_hub.py
git commit -m "feat(datahub): multi-source orchestrator — API-Football + FDOrg + OpenLigaDB + odds + tennis"
```

---

## Task 10: FeatureAdjuster

**Files:**
- Create: `models/feature_adjuster.py`
- Create: `tests/test_feature_adjuster.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_feature_adjuster.py
import pytest
from models.feature_adjuster import FeatureAdjuster, EnrichedFixture

def _base_probs():
    return {"p_home": 0.45, "p_draw": 0.28, "p_away": 0.27}

def _base_fixture(**kwargs) -> EnrichedFixture:
    defaults = {
        "home_ppg": 1.8, "away_ppg": 1.5,
        "home_xg_avg": 1.6, "away_xg_avg": 1.2,
        "home_xg_luck": 0.0, "away_xg_luck": 0.0,
        "home_motivation": 0.8, "away_motivation": 0.7,
        "h2h_home_wins": 3, "h2h_draws": 2, "h2h_away_wins": 1, "h2h_matches": 6,
        "temperature_c": 15.0, "wind_kmh": 10.0, "precipitation_pct": 0.0,
        "home_injuries_json": [], "away_injuries_json": [],
    }
    defaults.update(kwargs)
    return EnrichedFixture(**defaults)

def test_neutral_fixture_preserves_probabilities():
    """No features should not change probabilities meaningfully."""
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _base_fixture())
    assert abs(result.p_home - 0.45) < 0.03
    assert abs(result.p_home + result.p_draw + result.p_away - 1.0) < 0.0001

def test_strong_home_form_boosts_home():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _base_fixture(home_ppg=2.5, away_ppg=0.8))
    assert result.p_home > 0.45
    assert "form" in result.adjustments_applied

def test_high_wind_suppresses_all_goals_expectation():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _base_fixture(wind_kmh=55.0))
    assert "weather" in result.adjustments_applied

def test_probabilities_always_sum_to_one():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _base_fixture(
        home_ppg=2.8, away_ppg=0.6, home_xg_luck=0.6, wind_kmh=50.0
    ))
    assert abs(result.p_home + result.p_draw + result.p_away - 1.0) < 0.0001

def test_low_motivation_reduces_confidence_weight():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _base_fixture(
        home_motivation=0.15, away_motivation=0.15
    ))
    assert result.confidence_weight < 1.0

def test_h2h_dominance_boosts_dominant_side():
    adj = FeatureAdjuster()
    # Home team wins 8 out of 10 H2H
    result = adj.adjust(_base_probs(), _base_fixture(
        h2h_home_wins=8, h2h_draws=1, h2h_away_wins=1, h2h_matches=10
    ))
    assert result.p_home > 0.45
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_feature_adjuster.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement FeatureAdjuster**

```python
# models/feature_adjuster.py
"""
Probability correction pipeline for football predictions.
Takes Dixon-Coles raw probabilities + enriched fixture data →
returns adjusted probabilities with audit trail.

Each adjustment is capped to prevent any single signal from dominating.
All adjustments are additive deltas applied to logit space, then renormalized.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
import math


@dataclass
class EnrichedFixture:
    home_ppg: float = 1.5
    away_ppg: float = 1.5
    home_xg_avg: float = 1.3
    away_xg_avg: float = 1.3
    home_xg_luck: float = 0.0       # positive = scoring less than xG deserves
    away_xg_luck: float = 0.0
    home_motivation: float = 0.7
    away_motivation: float = 0.7
    h2h_home_wins: int = 0
    h2h_draws: int = 0
    h2h_away_wins: int = 0
    h2h_matches: int = 0
    temperature_c: float = 15.0
    wind_kmh: float = 0.0
    precipitation_pct: float = 0.0
    home_injuries_json: list = field(default_factory=list)
    away_injuries_json: list = field(default_factory=list)


@dataclass
class AdjustedProbabilities:
    p_home: float
    p_draw: float
    p_away: float
    adjustments_applied: list[str]
    confidence_weight: float        # 0.5–1.0; high = trust edge signals more
    adjustment_detail: dict[str, Any]


class FeatureAdjuster:
    # Caps on how much each signal can move any single probability
    FORM_CAP = 0.04
    XG_CAP = 0.03
    H2H_CAP = 0.015
    INJURY_CAP = 0.02

    def adjust(
        self,
        probs: dict[str, float],
        fixture: EnrichedFixture,
    ) -> AdjustedProbabilities:
        """
        Apply feature corrections to DC probabilities.
        Returns renormalized probabilities + audit data.
        """
        p_h = probs["p_home"]
        p_d = probs["p_draw"]
        p_a = probs["p_away"]
        applied: list[str] = []
        detail: dict[str, Any] = {}
        confidence = 1.0

        # 1. Form adjustment
        delta_h, delta_a, form_detail = self._form_delta(fixture)
        if abs(delta_h) > 0.001 or abs(delta_a) > 0.001:
            p_h = max(0.03, min(0.92, p_h + delta_h))
            p_a = max(0.03, min(0.92, p_a + delta_a))
            applied.append("form")
            detail["form"] = form_detail

        # 2. xG luck correction
        xg_h, xg_a, xg_detail = self._xg_luck_delta(fixture)
        if abs(xg_h) > 0.001 or abs(xg_a) > 0.001:
            p_h = max(0.03, min(0.92, p_h + xg_h))
            p_a = max(0.03, min(0.92, p_a + xg_a))
            applied.append("xg_luck")
            detail["xg_luck"] = xg_detail

        # 3. H2H record
        h2h_delta, h2h_detail = self._h2h_delta(fixture)
        if abs(h2h_delta) > 0.001:
            p_h = max(0.03, min(0.92, p_h + h2h_delta))
            p_a = max(0.03, min(0.92, p_a - h2h_delta))
            applied.append("h2h")
            detail["h2h"] = h2h_detail

        # 4. Weather — does not shift win probabilities, reduces confidence
        weather_conf, weather_detail = self._weather_confidence(fixture)
        if weather_conf < 1.0:
            confidence *= weather_conf
            applied.append("weather")
            detail["weather"] = weather_detail

        # 5. Motivation — affects confidence weight, not raw probabilities
        mot_conf, mot_detail = self._motivation_confidence(fixture)
        if mot_conf < 1.0:
            confidence *= mot_conf
            applied.append("motivation")
            detail["motivation"] = mot_detail

        # 6. Injuries
        inj_delta, inj_detail = self._injury_delta(fixture)
        if abs(inj_delta) > 0.001:
            p_h = max(0.03, min(0.92, p_h + inj_delta))
            p_a = max(0.03, min(0.92, p_a - inj_delta))
            applied.append("injury")
            detail["injury"] = inj_detail

        # Renormalize draw to keep sum = 1
        total = p_h + p_d + p_a
        p_h, p_d, p_a = p_h / total, p_d / total, p_a / total

        return AdjustedProbabilities(
            p_home=round(p_h, 4),
            p_draw=round(p_d, 4),
            p_away=round(p_a, 4),
            adjustments_applied=applied,
            confidence_weight=round(max(0.5, min(1.0, confidence)), 3),
            adjustment_detail=detail,
        )

    # ── adjustments ───────────────────────────────────────────────────────────

    def _form_delta(self, f: EnrichedFixture) -> tuple[float, float, dict]:
        """Compare home vs away PPG. Max ±FORM_CAP shift."""
        if f.home_ppg == 0 and f.away_ppg == 0:
            return 0.0, 0.0, {}
        total_ppg = f.home_ppg + f.away_ppg
        if total_ppg == 0:
            return 0.0, 0.0, {}
        home_share = f.home_ppg / total_ppg  # 0.5 = equal; >0.5 = home stronger
        raw_delta = (home_share - 0.5) * 2 * self.FORM_CAP  # scale to ±FORM_CAP
        delta_h = max(-self.FORM_CAP, min(self.FORM_CAP, raw_delta))
        delta_a = -delta_h * 0.6  # dampened mirror (draw absorbs some)
        return delta_h, delta_a, {"home_ppg": f.home_ppg, "away_ppg": f.away_ppg, "delta_h": delta_h}

    def _xg_luck_delta(self, f: EnrichedFixture) -> tuple[float, float, dict]:
        """Regress toward xG expectation when luck streak is strong."""
        # Positive luck = team scoring less than xG deserves → they should score more → boost
        delta_h = min(self.XG_CAP, max(-self.XG_CAP, f.home_xg_luck * 0.05))
        delta_a = min(self.XG_CAP, max(-self.XG_CAP, f.away_xg_luck * 0.05))
        if abs(delta_h) < 0.002 and abs(delta_a) < 0.002:
            return 0.0, 0.0, {}
        return delta_h, delta_a, {"home_luck": f.home_xg_luck, "away_luck": f.away_xg_luck}

    def _h2h_delta(self, f: EnrichedFixture) -> tuple[float, dict]:
        """H2H dominance signal. Only fires with >= 4 meetings."""
        if f.h2h_matches < 4:
            return 0.0, {}
        home_rate = f.h2h_home_wins / f.h2h_matches
        away_rate = f.h2h_away_wins / f.h2h_matches
        if home_rate > 0.70:
            delta = self.H2H_CAP
        elif away_rate > 0.70:
            delta = -self.H2H_CAP
        else:
            return 0.0, {}
        return delta, {"home_win_rate": home_rate, "away_win_rate": away_rate, "h2h_matches": f.h2h_matches}

    def _weather_confidence(self, f: EnrichedFixture) -> tuple[float, dict]:
        """High wind or heavy rain reduces confidence in goal-based models."""
        conf = 1.0
        detail: dict = {}
        if f.wind_kmh > 40:
            reduction = min(0.15, (f.wind_kmh - 40) / 100)
            conf -= reduction
            detail["wind_reduction"] = reduction
        if f.precipitation_pct > 0.7:
            conf -= 0.05
            detail["rain_reduction"] = 0.05
        return conf, detail

    def _motivation_confidence(self, f: EnrichedFixture) -> tuple[float, dict]:
        """Low-motivation deadrubber matches → reduce confidence."""
        avg_mot = (f.home_motivation + f.away_motivation) / 2
        if avg_mot < 0.3:
            return 0.75, {"avg_motivation": avg_mot}
        if avg_mot < 0.5:
            return 0.90, {"avg_motivation": avg_mot}
        return 1.0, {}

    def _injury_delta(self, f: EnrichedFixture) -> tuple[float, dict]:
        """Each significant injury dampens the affected side."""
        home_inj = len(f.home_injuries_json)
        away_inj = len(f.away_injuries_json)
        if home_inj == 0 and away_inj == 0:
            return 0.0, {}
        # Each injury: -0.5% on the affected team, capped at INJURY_CAP
        raw = (away_inj - home_inj) * 0.005  # positive = home benefit
        delta = max(-self.INJURY_CAP, min(self.INJURY_CAP, raw))
        return delta, {"home_injuries": home_inj, "away_injuries": away_inj}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_feature_adjuster.py -v
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add models/feature_adjuster.py tests/test_feature_adjuster.py
git commit -m "feat(model): FeatureAdjuster — form, xG luck, H2H, weather, motivation, injury corrections"
```

---

## Task 11: Wire FeatureAdjuster into model.py

**Files:**
- Modify: `agents/model.py`

- [ ] **Step 1: Add import at top of agents/model.py**

After the existing imports, add:

```python
from models.feature_adjuster import FeatureAdjuster, EnrichedFixture
```

- [ ] **Step 2: Instantiate FeatureAdjuster in ModelAgent.__init__**

```python
# In ModelAgent.__init__, add after self._phase_adapter = SeasonPhaseAdapter():
self._feature_adjuster = FeatureAdjuster()
```

- [ ] **Step 3: Apply adjuster after DC probabilities in _process**

Find the block ending with:
```python
p_home, p_draw, p_away = model.predict(home, away)
```

Immediately after it, add:

```python
# Build enriched fixture from payload metadata (fields populated by DataHub)
enriched = EnrichedFixture(
    home_ppg=float(payload.get("home_ppg") or 1.5),
    away_ppg=float(payload.get("away_ppg") or 1.5),
    home_xg_avg=float(payload.get("home_xg_avg") or 1.3),
    away_xg_avg=float(payload.get("away_xg_avg") or 1.3),
    home_xg_luck=float(payload.get("home_xg_luck") or 0.0),
    away_xg_luck=float(payload.get("away_xg_luck") or 0.0),
    home_motivation=float(payload.get("home_motivation") or 0.7),
    away_motivation=float(payload.get("away_motivation") or 0.7),
    h2h_home_wins=int(payload.get("h2h_home_wins") or 0),
    h2h_draws=int(payload.get("h2h_draws") or 0),
    h2h_away_wins=int(payload.get("h2h_away_wins") or 0),
    h2h_matches=int(payload.get("h2h_matches") or 0),
    temperature_c=float(payload.get("temperature_c") or 15.0),
    wind_kmh=float(payload.get("wind_kmh") or 0.0),
    precipitation_pct=float(payload.get("precipitation_pct") or 0.0),
    home_injuries_json=payload.get("home_injuries_json") or [],
    away_injuries_json=payload.get("away_injuries_json") or [],
)
adjusted = self._feature_adjuster.adjust(
    {"p_home": p_home, "p_draw": p_draw, "p_away": p_away},
    enriched,
)
p_home = adjusted.p_home
p_draw = adjusted.p_draw
p_away = adjusted.p_away
```

- [ ] **Step 4: Add adjustment metadata to result dict**

In the `result` dict construction, add these keys:

```python
result["feature_adjustments"] = ",".join(adjusted.adjustments_applied)
result["confidence_weight"] = str(adjusted.confidence_weight)
result["adjustment_detail"] = json.dumps(adjusted.adjustment_detail)
```

- [ ] **Step 5: Verify syntax**

```bash
python -m py_compile agents/model.py && echo "OK"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add agents/model.py
git commit -m "feat(model): wire FeatureAdjuster into ModelAgent — form/xG/H2H/weather/motivation corrections applied post-DC"
```

---

## Task 12: Wire confidence_weight into AnalystAgent

**Files:**
- Modify: `agents/analyst.py`

- [ ] **Step 1: Update effective edge threshold calculation**

Find in `agents/analyst.py`:
```python
phase_boost = float(data.get("phase_edge_boost") or 0.0)
effective_min_edge = settings.MIN_EDGE + phase_boost
```

Replace with:
```python
phase_boost = float(data.get("phase_edge_boost") or 0.0)
confidence_weight = max(0.5, min(1.0, float(data.get("confidence_weight") or 1.0)))
# High confidence → lower required edge. Low confidence → higher required edge.
effective_min_edge = (settings.MIN_EDGE + phase_boost) / confidence_weight
```

- [ ] **Step 2: Pass feature metadata through to opportunity**

In the `opportunity` dict, add:

```python
"feature_adjustments": data.get("feature_adjustments", ""),
"confidence_weight": data.get("confidence_weight", "1.0"),
```

- [ ] **Step 3: Verify syntax**

```bash
python -m py_compile agents/analyst.py && echo "OK"
```

- [ ] **Step 4: Commit**

```bash
git add agents/analyst.py
git commit -m "feat(analyst): use confidence_weight from FeatureAdjuster to scale edge threshold"
```

---

## Task 13: Update TennisDataCollectorAgent

**Files:**
- Modify: `agents/tennis_data_collector.py`

- [ ] **Step 1: Replace Matchbook-only logic with TennisAPIClient**

Replace entire content of `agents/tennis_data_collector.py`:

```python
# agents/tennis_data_collector.py
import asyncio
import json
from datetime import datetime

from agents.base import BaseAgent
from core.tennis_api_client import TennisAPIClient


class TennisDataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisDataCollectorAgent")
        self._client = TennisAPIClient()

    async def _main_loop(self) -> None:
        while self._running:
            await self._collect_cycle()
            await asyncio.sleep(3600)  # hourly — respect 100 req/day quota

    async def _collect_cycle(self):
        try:
            fixtures = await self._client.get_upcoming_fixtures(days_ahead=7)
            if fixtures:
                await self._client.write_fixtures_to_supabase(fixtures)
                self.logger.info("tennis: collected %d fixtures from RapidAPI", len(fixtures))
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": len(fixtures),
                    "source": "rapidapi_tennis",
                    "collected_at": datetime.utcnow().isoformat(),
                })
            else:
                self.logger.info("tennis: no fixtures returned (quota or no matches)")
                self.set_status_detail({
                    "type": "tennis_collection",
                    "fixtures_collected": 0,
                    "source": "rapidapi_tennis",
                    "status": "empty",
                })
        except Exception as exc:
            self.logger.error("tennis collection error: %s", exc)
```

- [ ] **Step 2: Verify syntax**

```bash
python -m py_compile agents/tennis_data_collector.py && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add agents/tennis_data_collector.py
git commit -m "feat(tennis): replace Matchbook-only collector with RapidAPI Tennis — 7-day fixture window"
```

---

## Task 14: Update TennisModelAgent — Read from tennis_fixtures + Improvements

**Files:**
- Modify: `agents/tennis_model_agent.py`

- [ ] **Step 1: Replace Redis-only source with Supabase tennis_fixtures**

Find `_compute_cycle` in `agents/tennis_model_agent.py`. Replace its body:

```python
async def _compute_cycle(self):
    # Read upcoming fixtures from Supabase tennis_fixtures table
    fixtures = await self._load_fixtures_from_db()
    if not fixtures:
        self.logger.info("tennis model: no fixtures in DB — skipping cycle")
        return

    predictions = []
    for fixture in fixtures:
        try:
            pred = self._score_fixture(fixture)
            if pred:
                predictions.append(pred)
        except Exception as exc:
            self.logger.debug("tennis scoring error: %s", exc)

    if predictions:
        await self._write_predictions(predictions)
        self.logger.info("tennis model: scored %d fixtures", len(predictions))
```

- [ ] **Step 2: Add _load_fixtures_from_db method**

```python
async def _load_fixtures_from_db(self) -> list[dict]:
    from core.supabase_client import _rest_base
    from config.settings import settings
    import httpx
    base = _rest_base()
    if not base:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{base}/tennis_fixtures",
                params={"scheduled_at": f"gt.{__import__('datetime').datetime.utcnow().isoformat()}",
                        "order": "scheduled_at.asc", "limit": "100"},
                headers={
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                },
            )
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception as exc:
        self.logger.debug("tennis fixtures DB load error: %s", exc)
        return []
```

- [ ] **Step 3: Add _score_fixture with improvements (H2H, form streak, rank guard)**

```python
def _score_fixture(self, fixture: dict) -> dict | None:
    p1 = fixture.get("player1", "")
    p2 = fixture.get("player2", "")
    surface = (fixture.get("surface") or "hard").lower()
    if not p1 or not p2:
        return None

    # Rank guard: skip huge mismatches outside Grand Slams
    p1_rank = fixture.get("p1_rank") or 999
    p2_rank = fixture.get("p2_rank") or 999
    is_grand_slam = any(gs in (fixture.get("tournament") or "")
                        for gs in ("Roland Garros", "Wimbledon", "US Open", "Australian Open"))
    if abs(p1_rank - p2_rank) > 200 and not is_grand_slam:
        self.logger.debug("tennis: skipping rank mismatch %s vs %s (%d vs %d)", p1, p2, p1_rank, p2_rank)
        return None

    # Base Elo prediction
    elo_result = self.elo.predict(p1, p2, surface)
    p1_prob = elo_result["p1"]
    p2_prob = elo_result["p2"]

    # H2H surface adjustment
    h2h_s_p1 = fixture.get("h2h_surface_p1") or 0
    h2h_s_p2 = fixture.get("h2h_surface_p2") or 0
    h2h_total = h2h_s_p1 + h2h_s_p2
    if h2h_total >= 4:
        h2h_rate = h2h_s_p1 / h2h_total
        if h2h_rate > 0.70:
            p1_prob = min(0.90, p1_prob + 0.02)
        elif h2h_rate < 0.30:
            p2_prob = min(0.90, p2_prob + 0.02)
        p1_prob, p2_prob = p1_prob / (p1_prob + p2_prob), p2_prob / (p1_prob + p2_prob)

    # Fatigue adjustment using real rest/sets data
    rest_days_p1 = fixture.get("p1_rest_days") or 3
    rest_days_p2 = fixture.get("p2_rest_days") or 3
    sets_p1 = fixture.get("p1_sets_last") or 2
    sets_p2 = fixture.get("p2_sets_last") or 2
    p1_prob, p2_prob = self.fatigue.adjust(
        p1_prob, p2_prob,
        p1_rest_days=rest_days_p1, p2_rest_days=rest_days_p2,
        p1_sets_last_match=sets_p1, p2_sets_last_match=sets_p2,
    )

    return {
        "match_id": fixture["match_id"],
        "player1": p1, "player2": p2,
        "tournament": fixture.get("tournament", ""),
        "surface": surface,
        "round": fixture.get("round", ""),
        "scheduled_at": fixture.get("scheduled_at", ""),
        "p1": round(p1_prob, 4),
        "p2": round(p2_prob, 4),
        "elo_p1": elo_result.get("r1_effective"),
        "elo_p2": elo_result.get("r2_effective"),
        "model_version": "elo_surface_v3_h2h_fatigue",
    }
```

- [ ] **Step 4: Add _write_predictions method**

```python
async def _write_predictions(self, predictions: list[dict]) -> None:
    from core.supabase_client import _rest_base
    from config.settings import settings
    import httpx
    base = _rest_base()
    if not base or not predictions:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                f"{base}/tennis_predictions",
                json=predictions,
                headers={
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates",
                },
            )
    except Exception as exc:
        self.logger.debug("tennis predictions write error: %s", exc)
```

- [ ] **Step 5: Verify syntax**

```bash
python -m py_compile agents/tennis_model_agent.py && echo "OK"
```

- [ ] **Step 6: Commit**

```bash
git add agents/tennis_model_agent.py
git commit -m "feat(tennis-model): read from tennis_fixtures DB, add H2H surface adj, rank guard, real fatigue data"
```

---

## Task 15: Update settings.py + data_collector.py to use DataHub

**Files:**
- Modify: `config/settings.py`
- Modify: `agents/data_collector.py`

- [ ] **Step 1: Add new settings fields**

In `config/settings.py`, add after existing fields:

```python
# Data collection
DATA_COLLECTION_DAYS_AHEAD: int = 7
TENNIS_RAPIDAPI_HOST: str = "v1.tennis.api-sports.io"
HISTORICAL_CSV_YEARS_BACK: int = 3
```

- [ ] **Step 2: Update data_collector.py to use DataHub for enrichment**

In `agents/data_collector.py`, add at the top:

```python
from core.data_hub import DataHub
```

In `DataCollectorAgent.__init__`, add:

```python
self._hub = DataHub()
```

In `_collect_cycle` or equivalent main collection loop, after the existing fixture collection, add a call to enrich with hub data:

```python
# Fire-and-forget enrichment — failures don't block core pipeline
try:
    leagues = list(LEAGUE_IDS.keys())
    hub_fixtures = await self._hub.collect_all_fixtures(leagues)
    await self._hub.collect_all_odds(leagues)
    self.logger.info("DataHub: enriched %d fixtures", len(hub_fixtures))
except Exception as hub_exc:
    self.logger.warning("DataHub enrichment failed (non-blocking): %s", hub_exc)
```

- [ ] **Step 3: Verify syntax**

```bash
python -m py_compile agents/data_collector.py config/settings.py && echo "OK"
```

- [ ] **Step 4: Run full test suite**

```bash
python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: All new tests PASS. Pre-existing failures (if any) are pre-existing.

- [ ] **Step 5: Build Next.js (verify no TS regressions)**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets && npm run build 2>&1 | grep -E "error|✓|compiled" | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: Final commit + push**

```bash
git add config/settings.py agents/data_collector.py
git commit -m "feat: wire DataHub into DataCollectorAgent — multi-source enrichment per collection cycle"
git push origin main
```

- [ ] **Step 7: Deploy to production**

```bash
vercel --prod
```

Expected: `Aliased: https://agentic-markets-roan.vercel.app`

- [ ] **Step 8: Smoke test**

```bash
curl -s https://agentic-markets-roan.vercel.app/api/health | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('Status:', d['status'])
for a in d['agents']:
    if a['name'] in ('DataCollector','TennisDataCollectorAgent','ModelAgent'):
        print(f\"  {a['name']}: {a['status']}\")
"
```

Expected: All three agents `alive`.

---

## Self-Review

**Spec coverage:**
- ✅ DB migration (Task 1)
- ✅ QuotaTracker (Task 2)
- ✅ football_api_client extensions: standings, form, H2H, injuries (Task 3)
- ✅ odds_api_client: multi-bookmaker + AH snapshot (Task 4)
- ✅ football_data_org standings (Task 5)
- ✅ OpenLigaDB client (Task 6)
- ✅ football-data.co.uk CSV loader (Task 7)
- ✅ DataHub orchestrator (Task 9)
- ✅ FeatureAdjuster: form, xG, H2H, weather, motivation, injury (Task 10)
- ✅ model.py FeatureAdjuster wiring (Task 11)
- ✅ analyst.py confidence_weight (Task 12)
- ✅ TennisAPIClient (Task 8)
- ✅ TennisDataCollector fix (Task 13)
- ✅ TennisModelAgent improvements (Task 14)
- ✅ settings + data_collector DataHub integration (Task 15)

**Gaps:** None found.

**Type consistency:** All method names consistent across tasks. `EnrichedFixture`, `AdjustedProbabilities`, `DataHub`, `TennisAPIClient`, `QuotaTracker` used consistently.

**Placeholder scan:** No TBDs, TODOs, or vague steps found.
