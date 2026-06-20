# Player Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire le fondamenta dati a livello giocatore (profili, storico per-partita, formazioni confermate) per tutte le leghe servite + World Cup, con architettura a tier e fail-closed, senza toccare la pipeline di predizione squadra esistente.

**Architecture:** Nuovo orchestratore `core/player_data_sync.py` che compone fonti già presenti (api-football per stat di conteggio su tutte le leghe; Understat per xG individuale solo Tier 1; ESPN per WC) verso tre tabelle Supabase additive (`player_profiles` esteso, `player_match_stats` e `player_lineups` nuove). Normalizzazione, tier detection e gate fail-closed sono funzioni pure testabili; le scritture seguono il pattern PATCH-then-POST di `core/supabase_client.py`.

**Tech Stack:** Python async (httpx, asyncio), pytest (asyncio_mode=auto, pytest-mock), Supabase REST, Playwright (solo estensione scraper Understat).

## Global Constraints

- **DB condiviso = gated.** La migration e il primo backfill scrivono sul Supabase condiviso → restano dietro **deploy-gate + APPROVE umano** (regola governance Tommy). Il piano li marca esplicitamente `[GATED]`; l'engineer NON esegue migration/backfill in prod senza `APPROVE #id`.
- **Solo additivo.** Nessuna colonna rimossa/rinominata su `player_profiles`; solo `ADD COLUMN IF NOT EXISTS` + due CREATE TABLE. Rollback documentato in ogni migration.
- **Fail-closed FTC.** Nessun profilo `eligible_for_player_markets=true` sotto soglia (`MIN_APPEARANCES = 5` presenze utili) o con dato stale. Mai un claim giocatore dove il dato non regge.
- **Fail-soft pipeline.** I sync NON devono mai sollevare eccezioni che fermino `run.py`: ritornano un summary `{written, errors[], skipped}` come `core/squad_condition_sync.py`.
- **Quota-aware.** Backfill via aggregati stagionali (`/players` paginato, ~pochi call per lega-stagione); `/fixtures/players` solo sulle ultime `FORM_WINDOW = 10` partite per la forma. Mai full per-fixture su 2 stagioni intere.
- **Stile esistente.** Settings via `config.settings.settings`; client Supabase via `core.supabase_client._rest_base()` / `_service_headers()`; test in `tests/` con mock httpx. Match dello stile dei file vicini.
- **Storico:** backfill **2 stagioni**; finestra forma **ultime 10 presenze**.
- **Codici lega:** usare le mappe esistenti `LEAGUE_IDS` (`core/football_api_client.py:63-77`) e `ESPN_LEAGUE_CODES` (`core/espn_soccer_client.py:32-55`). Non inventare id.

---

## File Structure

- `core/player_data_tier.py` (NEW) — `LEAGUE_DATA_TIER`, soglie, `tier_for_league()`, `is_eligible()`. Puro.
- `core/player_models.py` (NEW) — dataclass `PlayerSeasonStat`, `PlayerMatchStat`, `PlayerLineupEntry`, `PlayerProfile` + normalizzatori puri.
- `core/football_api_client.py` (MODIFY) — aggiunge `get_player_season_stats()`, `get_fixture_player_stats()`, `get_fixture_events()`.
- `core/understat_players.py` (NEW) — parser xG per-giocatore Understat (Tier 1, isolato e opzionale).
- `core/player_data_writers.py` (NEW) — upsert verso le 3 tabelle (pattern PATCH-then-POST).
- `core/player_data_sync.py` (NEW) — orchestratore: `sync_player_profiles()`, `sync_player_lineups()`, `backfill_player_stats()`.
- `supabase/migrations/20260620090000_player_data_foundation.sql` (NEW) — `[GATED]`.
- `scripts/backfill_player_stats.py` (NEW) — runner one-shot idempotente `[GATED]`.
- `run.py` (MODIFY) — aggancio sync giornaliero + trigger formazioni.
- `tests/test_player_data_tier.py`, `tests/test_player_models.py`, `tests/test_football_api_player.py`, `tests/test_player_data_writers.py`, `tests/test_player_data_sync.py` (NEW).

---

### Task 1: Tier config (LEAGUE_DATA_TIER + fail-closed gate)

**Files:**
- Create: `core/player_data_tier.py`
- Test: `tests/test_player_data_tier.py`

**Interfaces:**
- Produces:
  - `LEAGUE_DATA_TIER: dict[str, dict]` — chiave = codice lega interno, valori `{id:int, name:str, tier:int}` (tier 1 = xG Understat; tier 2 = solo api-football; le summer leagues sono tier 2).
  - `MIN_APPEARANCES: int = 5`, `FORM_WINDOW: int = 10`, `STALE_DAYS: int = 30`
  - `tier_for_league(code: str) -> int` (ritorna `0` se lega sconosciuta = fail-closed)
  - `is_eligible(appearances: int, last_updated_iso: str | None, today_iso: str) -> bool`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_data_tier.py
from core.player_data_tier import (
    LEAGUE_DATA_TIER, MIN_APPEARANCES, tier_for_league, is_eligible,
)

def test_top5_are_tier1():
    for code in ("PL", "SA", "PD", "BL1", "FL1"):
        assert LEAGUE_DATA_TIER[code]["tier"] == 1

def test_summer_leagues_are_tier2():
    for code in ("ELI", "ALL", "VEI", "LOI", "CSL"):
        assert LEAGUE_DATA_TIER[code]["tier"] == 2

def test_unknown_league_fails_closed():
    assert tier_for_league("ZZZ") == 0

def test_eligible_requires_min_appearances():
    assert is_eligible(MIN_APPEARANCES, "2026-06-19", "2026-06-20") is True
    assert is_eligible(MIN_APPEARANCES - 1, "2026-06-19", "2026-06-20") is False

def test_eligible_fails_on_stale_or_missing_date():
    assert is_eligible(10, None, "2026-06-20") is False
    assert is_eligible(10, "2026-05-01", "2026-06-20") is False  # >30 giorni
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_data_tier.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'core.player_data_tier'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_data_tier.py
"""Tier mapping + fail-closed eligibility per i dati giocatore.

Tier 1 = leghe con xG individuale (Understat). Tier 2 = solo api-football
(gol/assist/minuti/tiri, niente xG). Tier 0 / lega sconosciuta = fail-closed.
"""
from datetime import date

MIN_APPEARANCES = 5
FORM_WINDOW = 10
STALE_DAYS = 30

LEAGUE_DATA_TIER: dict[str, dict] = {
    "PL":  {"id": 39,  "name": "Premier League", "tier": 1},
    "SA":  {"id": 135, "name": "Serie A",        "tier": 1},
    "PD":  {"id": 140, "name": "La Liga",        "tier": 1},
    "BL1": {"id": 78,  "name": "Bundesliga",     "tier": 1},
    "FL1": {"id": 61,  "name": "Ligue 1",        "tier": 1},
    "CL":  {"id": 2,   "name": "Champions League", "tier": 2},
    "EL":  {"id": 3,   "name": "Europa League",  "tier": 2},
    "ECL": {"id": 848, "name": "Conference League", "tier": 2},
    "WC":  {"id": 1,   "name": "FIFA World Cup", "tier": 2},
    "ELI": {"id": 103, "name": "Eliteserien",    "tier": 2},
    "ALL": {"id": 113, "name": "Allsvenskan",    "tier": 2},
    "VEI": {"id": 244, "name": "Veikkausliiga",  "tier": 2},
    "LOI": {"id": 357, "name": "League of Ireland", "tier": 2},
    "CSL": {"id": 169, "name": "Super League",   "tier": 2},
}

def tier_for_league(code: str) -> int:
    entry = LEAGUE_DATA_TIER.get(code)
    return entry["tier"] if entry else 0

def is_eligible(appearances: int, last_updated_iso: str | None, today_iso: str) -> bool:
    if appearances < MIN_APPEARANCES:
        return False
    if not last_updated_iso:
        return False
    try:
        delta = (date.fromisoformat(today_iso) - date.fromisoformat(last_updated_iso[:10])).days
    except ValueError:
        return False
    return 0 <= delta <= STALE_DAYS
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_data_tier.py -v`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add core/player_data_tier.py tests/test_player_data_tier.py
git commit -m "feat(player-data): tier map + fail-closed eligibility"
```

---

### Task 2: Dataclass + normalizzatori puri

**Files:**
- Create: `core/player_models.py`
- Test: `tests/test_player_models.py`

**Interfaces:**
- Consumes: `core.player_data_tier` (tier, FORM_WINDOW)
- Produces:
  - `@dataclass PlayerSeasonStat(player_id, name, team, league, position, appearances, minutes, goals, assists, shots, season)`
  - `@dataclass PlayerMatchStat(player_id, fixture_id, league, team, minutes, goals, assists, shots, xg, started, match_date)` (`xg: float | None`)
  - `@dataclass PlayerLineupEntry(player_id, fixture_id, team, position, shirt_number, is_starter)`
  - `@dataclass PlayerProfile(player_id, name, team, league, tier, role, goals_per90_season, xg_per90_season, minutes_share, penalty_taker, eligible_for_player_markets, last_updated)`
  - `normalize_season_stats(raw: list[dict], league: str, season: int) -> list[PlayerSeasonStat]` — parse della shape `/players` di api-football
  - `build_profile(season: PlayerSeasonStat, xg_per90: float | None, today_iso: str) -> PlayerProfile` — calcola per90, minutes_share, applica `is_eligible`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_models.py
from core.player_models import normalize_season_stats, build_profile

# shape reale di api-football /players?league=&season=
RAW_PLAYERS = [{
    "player": {"id": 276, "name": "Neymar"},
    "statistics": [{
        "team": {"name": "PSG"},
        "league": {"name": "Ligue 1"},
        "games": {"appearences": 20, "minutes": 1700, "position": "Attacker"},
        "goals": {"total": 13, "assists": 6},
        "shots": {"total": 55, "on": 30},
    }],
}]

def test_normalize_season_stats_parses_apifootball_shape():
    out = normalize_season_stats(RAW_PLAYERS, league="FL1", season=2025)
    assert len(out) == 1
    s = out[0]
    assert s.player_id == "276"
    assert s.goals == 13 and s.assists == 6 and s.minutes == 1700
    assert s.appearances == 20 and s.position == "Attacker"

def test_normalize_skips_null_appearances():
    raw = [{"player": {"id": 9, "name": "Sub"},
            "statistics": [{"games": {"appearences": None, "minutes": 0},
                            "goals": {"total": 0, "assists": 0},
                            "shots": {"total": 0, "on": 0}}]}]
    assert normalize_season_stats(raw, "FL1", 2025) == []

def test_build_profile_computes_per90_and_eligibility():
    s = normalize_season_stats(RAW_PLAYERS, "FL1", 2025)[0]
    p = build_profile(s, xg_per90=0.62, today_iso="2026-06-20")
    assert round(p.goals_per90_season, 2) == round(13 / 1700 * 90, 2)
    assert p.tier == 1            # FL1 è tier 1
    assert p.xg_per90_season == 0.62
    assert p.eligible_for_player_markets is True   # 20 presenze > 5

def test_build_profile_fail_closed_below_floor():
    raw = [{"player": {"id": 1, "name": "Rookie"},
            "statistics": [{"team": {"name": "X"}, "league": {"name": "Y"},
                            "games": {"appearences": 3, "minutes": 200, "position": "Midfielder"},
                            "goals": {"total": 0, "assists": 0},
                            "shots": {"total": 2, "on": 0}}]}]
    s = normalize_season_stats(raw, "ELI", 2025)[0]
    p = build_profile(s, xg_per90=None, today_iso="2026-06-20")
    assert p.tier == 2
    assert p.xg_per90_season is None
    assert p.eligible_for_player_markets is False  # 3 < MIN_APPEARANCES
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_models.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'core.player_models'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_models.py
"""Dataclass e normalizzatori puri per i dati giocatore."""
from __future__ import annotations
from dataclasses import dataclass

from core.player_data_tier import tier_for_league, is_eligible


@dataclass(frozen=True)
class PlayerSeasonStat:
    player_id: str
    name: str
    team: str
    league: str
    position: str
    appearances: int
    minutes: int
    goals: int
    assists: int
    shots: int
    season: int


@dataclass(frozen=True)
class PlayerMatchStat:
    player_id: str
    fixture_id: int
    league: str
    team: str
    minutes: int
    goals: int
    assists: int
    shots: int
    xg: float | None
    started: bool
    match_date: str


@dataclass(frozen=True)
class PlayerLineupEntry:
    player_id: str
    fixture_id: int
    team: str
    position: str
    shirt_number: int | None
    is_starter: bool


@dataclass(frozen=True)
class PlayerProfile:
    player_id: str
    name: str
    team: str
    league: str
    tier: int
    role: str
    goals_per90_season: float
    xg_per90_season: float | None
    minutes_share: float
    penalty_taker: bool
    eligible_for_player_markets: bool
    last_updated: str


def _stat_block(entry: dict) -> dict | None:
    stats = entry.get("statistics") or []
    return stats[0] if stats else None


def normalize_season_stats(raw: list[dict], league: str, season: int) -> list[PlayerSeasonStat]:
    out: list[PlayerSeasonStat] = []
    for entry in raw:
        player = entry.get("player") or {}
        block = _stat_block(entry)
        if not player.get("id") or not block:
            continue
        games = block.get("games") or {}
        apps = games.get("appearences")
        if not apps:                     # None o 0 → scarta
            continue
        goals = block.get("goals") or {}
        shots = block.get("shots") or {}
        team = (block.get("team") or {}).get("name", "")
        out.append(PlayerSeasonStat(
            player_id=str(player["id"]),
            name=player.get("name", ""),
            team=team,
            league=league,
            position=games.get("position", ""),
            appearances=int(apps),
            minutes=int(games.get("minutes") or 0),
            goals=int(goals.get("total") or 0),
            assists=int(goals.get("assists") or 0),
            shots=int(shots.get("total") or 0),
            season=season,
        ))
    return out


def build_profile(season: PlayerSeasonStat, xg_per90: float | None, today_iso: str) -> PlayerProfile:
    minutes = max(season.minutes, 1)
    goals_per90 = season.goals / minutes * 90
    # minutes_share: minuti su un massimo teorico di 90*presenze
    minutes_share = min(1.0, season.minutes / (season.appearances * 90)) if season.appearances else 0.0
    eligible = is_eligible(season.appearances, today_iso, today_iso)
    return PlayerProfile(
        player_id=season.player_id,
        name=season.name,
        team=season.team,
        league=season.league,
        tier=tier_for_league(season.league),
        role=season.position,
        goals_per90_season=goals_per90,
        xg_per90_season=xg_per90,
        minutes_share=minutes_share,
        penalty_taker=False,            # arricchito in B; default conservativo
        eligible_for_player_markets=eligible,
        last_updated=today_iso,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_models.py -v`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add core/player_models.py tests/test_player_models.py
git commit -m "feat(player-data): dataclass + normalizzatori puri"
```

---

### Task 3: Wrapper api-football per stat giocatore

**Files:**
- Modify: `core/football_api_client.py` (aggiungere in coda, accanto a `get_injuries`)
- Test: `tests/test_football_api_player.py`

**Interfaces:**
- Consumes: `_base_url()`, `_headers()`, `settings.API_FOOTBALL_KEY` (esistenti nel file)
- Produces:
  - `async def get_player_season_stats(league_id: int, season: int, page: int = 1) -> dict` → ritorna `{"response": [...], "paging": {"current":int,"total":int}}` (per la paginazione)
  - `async def get_fixture_player_stats(fixture_id: int) -> list[dict]` → `response[]` di `/fixtures/players`
  - `async def get_fixture_events(fixture_id: int) -> list[dict]` → `response[]` di `/fixtures/events`
  - Tutte fail-soft: ritornano vuoto (`{"response": [], "paging": {"current":1,"total":1}}` / `[]`) se la chiave manca o su errore.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_football_api_player.py
import httpx
import pytest
from core import football_api_client as fac

class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status
    def json(self): return self._p
    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)

@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setattr(fac.settings, "API_FOOTBALL_KEY", "x" * 40)

async def test_get_player_season_stats_returns_response_and_paging(monkeypatch):
    payload = {"response": [{"player": {"id": 1}}], "paging": {"current": 1, "total": 3}}
    async def fake_get(self, url, **kw): return _Resp(payload)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await fac.get_player_season_stats(league_id=39, season=2025, page=1)
    assert out["paging"]["total"] == 3
    assert out["response"][0]["player"]["id"] == 1

async def test_get_fixture_events_returns_list(monkeypatch):
    payload = {"response": [{"type": "Goal", "player": {"id": 9, "name": "X"}}]}
    async def fake_get(self, url, **kw): return _Resp(payload)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await fac.get_fixture_events(123)
    assert out[0]["type"] == "Goal"

async def test_player_stats_fail_soft_without_key(monkeypatch):
    monkeypatch.setattr(fac.settings, "API_FOOTBALL_KEY", "")
    out = await fac.get_player_season_stats(39, 2025)
    assert out["response"] == [] and out["paging"]["total"] == 1
    assert await fac.get_fixture_player_stats(1) == []
    assert await fac.get_fixture_events(1) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_football_api_player.py -v`
Expected: FAIL con `AttributeError: module 'core.football_api_client' has no attribute 'get_player_season_stats'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/football_api_client.py  (append in coda al file)

async def get_player_season_stats(league_id: int, season: int, page: int = 1) -> dict:
    """Aggregati stagionali per-giocatore (/players). Paginato (~20/pagina)."""
    empty = {"response": [], "paging": {"current": 1, "total": 1}}
    if not settings.API_FOOTBALL_KEY:
        return empty
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{_base_url()}/players",
                params={"league": league_id, "season": season, "page": page},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return empty
            data = resp.json()
            return {
                "response": data.get("response", []),
                "paging": data.get("paging", {"current": page, "total": page}),
            }
    except Exception:
        return empty


async def get_fixture_player_stats(fixture_id: int) -> List[Dict]:
    """Stat per-giocatore di una singola partita (/fixtures/players)."""
    if not settings.API_FOOTBALL_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures/players",
                params={"fixture": fixture_id},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return []
            return resp.json().get("response", [])
    except Exception:
        return []


async def get_fixture_events(fixture_id: int) -> List[Dict]:
    """Eventi partita (gol/assist/cartellini) via /fixtures/events."""
    if not settings.API_FOOTBALL_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures/events",
                params={"fixture": fixture_id},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return []
            return resp.json().get("response", [])
    except Exception:
        return []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_football_api_player.py -v`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add core/football_api_client.py tests/test_football_api_player.py
git commit -m "feat(player-data): wrapper api-football /players, /fixtures/players, /fixtures/events"
```

---

### Task 4: Migration DB additiva `[GATED]`

**Files:**
- Create: `supabase/migrations/20260620090000_player_data_foundation.sql`

**Interfaces:**
- Produces: colonne nuove su `player_profiles`; tabelle `player_match_stats`, `player_lineups` (chiavi dedup `UNIQUE(player_id, fixture_id)`).

> **[GATED]** Questa task crea SOLO il file. NON eseguire `supabase db push` / `apply_migration` senza `APPROVE #id` umano sul `ch_deploy_gate` (DB condiviso). La verifica locale è la sola lettura del file.

- [ ] **Step 1: Scrivere la migration (additiva, con rollback)**

```sql
-- supabase/migrations/20260620090000_player_data_foundation.sql
-- Fondamenta dati giocatore (sotto-progetto A, 2026-06-20).
-- Additivo: estende player_profiles + due tabelle nuove. Niente drop/rename.

-- 1. Estensione player_profiles (colonne mancanti per il tiering)
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS league VARCHAR;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS tier INT DEFAULT 0;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS goals_per90_season FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS xg_per90_season FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS minutes_share FLOAT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS penalty_taker BOOLEAN DEFAULT false;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS eligible_for_player_markets BOOLEAN DEFAULT false;

-- 2. Storico per-partita (base per la finestra forma)
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  fixture_id INT NOT NULL,
  league VARCHAR NOT NULL,
  team VARCHAR,
  minutes INT,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  shots INT,
  xg FLOAT,
  started BOOLEAN DEFAULT false,
  match_date DATE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_pms_player ON public.player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pms_league_date ON public.player_match_stats(league, match_date);

-- 3. Formazioni confermate (~T-40')
CREATE TABLE IF NOT EXISTS public.player_lineups (
  id BIGSERIAL PRIMARY KEY,
  player_id VARCHAR NOT NULL,
  fixture_id INT NOT NULL,
  team VARCHAR,
  position VARCHAR,
  shirt_number INT,
  is_starter BOOLEAN DEFAULT true,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_lineups_fixture ON public.player_lineups(fixture_id);

-- Rollback:
-- DROP TABLE IF EXISTS public.player_lineups;
-- DROP TABLE IF EXISTS public.player_match_stats;
-- ALTER TABLE public.player_profiles
--   DROP COLUMN IF EXISTS league, DROP COLUMN IF EXISTS tier,
--   DROP COLUMN IF EXISTS goals_per90_season, DROP COLUMN IF EXISTS xg_per90_season,
--   DROP COLUMN IF EXISTS minutes_share, DROP COLUMN IF EXISTS penalty_taker,
--   DROP COLUMN IF EXISTS eligible_for_player_markets;
```

- [ ] **Step 2: Verifica sintattica locale (no push)**

Run: `python -c "import pathlib,re; s=pathlib.Path('supabase/migrations/20260620090000_player_data_foundation.sql').read_text(); assert 'CREATE TABLE IF NOT EXISTS public.player_match_stats' in s and 'Rollback' in s; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit (solo il file, NON push)**

```bash
git add supabase/migrations/20260620090000_player_data_foundation.sql
git commit -m "feat(player-data): migration additiva player_match_stats/lineups [GATED]"
```

---

### Task 5: Writers Supabase (PATCH-then-POST)

**Files:**
- Create: `core/player_data_writers.py`
- Test: `tests/test_player_data_writers.py`

**Interfaces:**
- Consumes: `core.supabase_client._rest_base`, `core.supabase_client._service_headers`; dataclass da `core.player_models`
- Produces:
  - `async def upsert_player_profiles(profiles: list[PlayerProfile]) -> int`
  - `async def upsert_player_match_stats(rows: list[PlayerMatchStat]) -> int`
  - `async def upsert_player_lineups(rows: list[PlayerLineupEntry]) -> int`
  - Dedup: profili su `player_id`; match_stats/lineups su `(player_id, fixture_id)`. Tutte fail-soft, ritornano il numero scritto.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_data_writers.py
import httpx
import pytest
from core import player_data_writers as w
from core.player_models import PlayerProfile

class _Resp:
    def __init__(self, status, body=None):
        self.status_code, self._b = status, body or []
    def json(self): return self._b

@pytest.fixture(autouse=True)
def _cfg(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: "https://x.supabase.co/rest/v1")
    monkeypatch.setattr(w, "_service_headers", lambda: {"apikey": "k"})

def _profile(pid="1"):
    return PlayerProfile(pid, "N", "T", "PL", 1, "Attacker", 0.5, 0.4, 0.9, False, True, "2026-06-20")

async def test_upsert_profile_patch_hit_counts(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [{"player_id": "1"}])
    async def fake_post(self, url, **kw): raise AssertionError("non deve postare se PATCH ha aggiornato")
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_profiles([_profile()]) == 1

async def test_upsert_profile_post_when_patch_empty(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [])   # nessuna riga aggiornata
    async def fake_post(self, url, **kw): return _Resp(201)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_profiles([_profile()]) == 1

async def test_writers_skip_when_db_unconfigured(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: None)
    assert await w.upsert_player_profiles([_profile()]) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_data_writers.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'core.player_data_writers'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_data_writers.py
"""Scrittura idempotente dei dati giocatore su Supabase (PATCH-then-POST)."""
from __future__ import annotations
import logging
from dataclasses import asdict

import httpx

from core.supabase_client import _rest_base, _service_headers
from core.player_models import PlayerProfile, PlayerMatchStat, PlayerLineupEntry

logger = logging.getLogger(__name__)


async def _upsert(table: str, rows: list[dict], match_params) -> int:
    base = _rest_base()
    if not base:
        return 0
    headers = _service_headers()
    written = 0
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for row in rows:
                try:
                    q = match_params(row)
                    resp = await client.patch(
                        f"{base}/{table}?{q}",
                        json=row,
                        headers={**headers, "Prefer": "return=representation"},
                    )
                    if resp.status_code == 200 and resp.json():
                        written += 1
                        continue
                    if resp.status_code not in (200, 404):
                        logger.warning("%s PATCH failed: %s", table, resp.status_code)
                        continue
                    resp = await client.post(f"{base}/{table}", json=row, headers=headers)
                    if resp.status_code in (200, 201, 204):
                        written += 1
                except Exception as exc:
                    logger.warning("%s row skipped: %s", table, exc)
    except Exception as exc:
        logger.warning("%s client error: %s", table, exc)
    return written


async def upsert_player_profiles(profiles: list[PlayerProfile]) -> int:
    return await _upsert(
        "player_profiles",
        [asdict(p) for p in profiles],
        lambda r: f"player_id=eq.{r['player_id']}",
    )


async def upsert_player_match_stats(rows: list[PlayerMatchStat]) -> int:
    return await _upsert(
        "player_match_stats",
        [asdict(r) for r in rows],
        lambda r: f"player_id=eq.{r['player_id']}&fixture_id=eq.{r['fixture_id']}",
    )


async def upsert_player_lineups(rows: list[PlayerLineupEntry]) -> int:
    return await _upsert(
        "player_lineups",
        [asdict(r) for r in rows],
        lambda r: f"player_id=eq.{r['player_id']}&fixture_id=eq.{r['fixture_id']}",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_data_writers.py -v`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add core/player_data_writers.py tests/test_player_data_writers.py
git commit -m "feat(player-data): writers Supabase idempotenti"
```

---

### Task 6: Estensione scraper Understat per xG per-giocatore (Tier 1, isolata)

**Files:**
- Create: `core/understat_players.py`
- Test: `tests/test_understat_players.py`

**Interfaces:**
- Produces:
  - `parse_players_data(page_text: str) -> dict[str, float]` — estrae `playersData` JSON dalla pagina lega Understat e ritorna `{player_name_normalizzato: xg_per90}`.
  - `normalize_name(name: str) -> str`
- Nota scope: SOLO il *parser* (puro, testabile). La fetch Playwright effettiva è un'estensione di `scripts/scrape_understat_xg.py` (Task 9, integrazione). Se il parse fallisce → dict vuoto → i profili Tier 1 ricadono su `xg_per90=None` (degradano a Tier 2-like, **fail-closed soft**, nessun blocco).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_understat_players.py
from core.understat_players import parse_players_data, normalize_name

# Understat incorpora i dati come: var playersData = JSON.parse('...');
PAGE = r"""
<script>
var playersData = JSON.parse('[{"player_name":"Erling Haaland","time":"1800","xG":"20.5"},{"player_name":"Bukayo Saka","time":"900","xG":"5.0"}]');
</script>
"""

def test_parse_players_data_returns_xg_per90():
    out = parse_players_data(PAGE)
    # Haaland: 20.5 xG su 1800' = 20.5/1800*90
    assert round(out["erling haaland"], 3) == round(20.5 / 1800 * 90, 3)
    assert round(out["bukayo saka"], 3) == round(5.0 / 900 * 90, 3)

def test_parse_returns_empty_on_garbage():
    assert parse_players_data("<html>no data</html>") == {}

def test_normalize_name():
    assert normalize_name("  Erling HAALAND ") == "erling haaland"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_understat_players.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'core.understat_players'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/understat_players.py
"""Parser xG per-giocatore dalle pagine-lega Understat (Tier 1).

Understat incorpora i dati come `var playersData = JSON.parse('[...]')`.
Estrae il blob, calcola xG/90 per giocatore. Puro e fail-soft.
"""
from __future__ import annotations
import json
import re

_BLOB = re.compile(r"playersData\s*=\s*JSON\.parse\('(.+?)'\)", re.DOTALL)


def normalize_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def parse_players_data(page_text: str) -> dict[str, float]:
    m = _BLOB.search(page_text or "")
    if not m:
        return {}
    raw = m.group(1).encode("utf-8").decode("unicode_escape")
    try:
        records = json.loads(raw)
    except (ValueError, TypeError):
        return {}
    out: dict[str, float] = {}
    for r in records:
        try:
            minutes = float(r.get("time") or 0)
            xg = float(r.get("xG") or 0)
            if minutes <= 0:
                continue
            out[normalize_name(r.get("player_name", ""))] = xg / minutes * 90
        except (ValueError, TypeError):
            continue
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_understat_players.py -v`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add core/understat_players.py tests/test_understat_players.py
git commit -m "feat(player-data): parser xG per-giocatore Understat (Tier 1)"
```

---

### Task 7: Orchestratore `sync_player_profiles()`

**Files:**
- Create: `core/player_data_sync.py`
- Test: `tests/test_player_data_sync.py`

**Interfaces:**
- Consumes: `get_player_season_stats` (Task 3), `normalize_season_stats`/`build_profile` (Task 2), `upsert_player_profiles` (Task 5), `LEAGUE_DATA_TIER` (Task 1), parser Understat (Task 6, opzionale via injection).
- Produces:
  - `async def sync_player_profiles(season: int, today_iso: str, xg_lookup: dict[str, dict[str, float]] | None = None) -> dict`
    Ritorna summary `{"profiles_written": int, "leagues": int, "errors": [...]}`. `xg_lookup[league_code][normalized_name] = xg_per90` (None → tutti Tier 2-like). Fail-soft per lega.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_data_sync.py
import pytest
from core import player_data_sync as s

ONE_PAGE = {"response": [{
    "player": {"id": 276, "name": "Neymar"},
    "statistics": [{"team": {"name": "PSG"}, "league": {"name": "Ligue 1"},
                    "games": {"appearences": 20, "minutes": 1700, "position": "Attacker"},
                    "goals": {"total": 13, "assists": 6}, "shots": {"total": 55, "on": 30}}],
}], "paging": {"current": 1, "total": 1}}

async def test_sync_profiles_writes_and_attaches_xg(monkeypatch):
    async def fake_stats(league_id, season, page=1): return ONE_PAGE
    captured = {}
    async def fake_upsert(profiles):
        captured["profiles"] = profiles
        return len(profiles)
    monkeypatch.setattr(s, "get_player_season_stats", fake_stats)
    monkeypatch.setattr(s, "upsert_player_profiles", fake_upsert)
    # limita a una sola lega Tier 1 per il test
    monkeypatch.setattr(s, "LEAGUE_DATA_TIER", {"FL1": {"id": 61, "name": "Ligue 1", "tier": 1}})

    xg = {"FL1": {"neymar": 0.62}}
    summary = await s.sync_player_profiles(season=2025, today_iso="2026-06-20", xg_lookup=xg)

    assert summary["profiles_written"] == 1
    assert captured["profiles"][0].xg_per90_season == 0.62
    assert captured["profiles"][0].eligible_for_player_markets is True

async def test_sync_profiles_fail_soft_per_league(monkeypatch):
    async def boom(league_id, season, page=1): raise RuntimeError("api down")
    async def fake_upsert(profiles): return len(profiles)
    monkeypatch.setattr(s, "get_player_season_stats", boom)
    monkeypatch.setattr(s, "upsert_player_profiles", fake_upsert)
    monkeypatch.setattr(s, "LEAGUE_DATA_TIER", {"FL1": {"id": 61, "name": "Ligue 1", "tier": 1}})
    summary = await s.sync_player_profiles(season=2025, today_iso="2026-06-20")
    assert summary["profiles_written"] == 0
    assert summary["errors"]            # errore registrato, nessuna eccezione propagata
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'core.player_data_sync'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_data_sync.py
"""Orchestratore dei dati giocatore: compone fonti -> normalizza -> scrive.

Fail-soft: una lega che fallisce non interrompe le altre né solleva.
"""
from __future__ import annotations
import logging

from core.player_data_tier import LEAGUE_DATA_TIER
from core.player_models import normalize_season_stats, build_profile
from core.player_data_writers import upsert_player_profiles
from core.football_api_client import get_player_season_stats
from core.player_models import normalize_season_stats as _ns  # alias per chiarezza

logger = logging.getLogger(__name__)


async def sync_player_profiles(
    season: int,
    today_iso: str,
    xg_lookup: dict[str, dict[str, float]] | None = None,
) -> dict:
    summary = {"profiles_written": 0, "leagues": 0, "errors": []}
    xg_lookup = xg_lookup or {}
    for code, meta in LEAGUE_DATA_TIER.items():
        try:
            profiles = []
            page, total = 1, 1
            while page <= total:
                data = await get_player_season_stats(meta["id"], season, page=page)
                total = data.get("paging", {}).get("total", 1)
                seasons = normalize_season_stats(data.get("response", []), code, season)
                league_xg = xg_lookup.get(code, {})
                for st in seasons:
                    xg90 = league_xg.get(st.name.strip().lower()) if meta["tier"] == 1 else None
                    profiles.append(build_profile(st, xg90, today_iso))
                page += 1
            written = await upsert_player_profiles(profiles)
            summary["profiles_written"] += written
            summary["leagues"] += 1
        except Exception as exc:
            summary["errors"].append(f"{code}:{exc}")
    return summary
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: PASS (2 test)

- [ ] **Step 5: Rimuovere l'import alias inutile e ricontrollare**

Rimuovi la riga `from core.player_models import normalize_season_stats as _ns  # alias per chiarezza` (orfano creato in questo task).
Run: `pytest tests/test_player_data_sync.py -v`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add core/player_data_sync.py tests/test_player_data_sync.py
git commit -m "feat(player-data): orchestratore sync_player_profiles"
```

---

### Task 8: `sync_player_lineups()` da formazioni confermate

**Files:**
- Modify: `core/player_data_sync.py`
- Test: `tests/test_player_data_sync.py` (aggiungere)

**Interfaces:**
- Consumes: `get_lineups(fixture_id)` (esistente, `core/football_api_client.py:38`), `upsert_player_lineups` (Task 5), `PlayerLineupEntry` (Task 2)
- Produces:
  - `async def sync_player_lineups(fixture_ids: list[int]) -> dict` → `{"lineups_written": int, "fixtures": int, "errors": [...]}`
  - `def _parse_lineup(fixture_id: int, raw: list[dict]) -> list[PlayerLineupEntry]` (puro)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_data_sync.py  (append)
from core.player_data_sync import _parse_lineup

# shape reale di /fixtures/lineups
RAW_LINEUP = [{
    "team": {"name": "PSG"},
    "startXI": [{"player": {"id": 276, "name": "Neymar", "number": 10, "pos": "F"}}],
    "substitutes": [{"player": {"id": 999, "name": "Sub", "number": 23, "pos": "M"}}],
}]

def test_parse_lineup_marks_starters_and_subs():
    out = _parse_lineup(555, RAW_LINEUP)
    starters = [e for e in out if e.is_starter]
    subs = [e for e in out if not e.is_starter]
    assert len(starters) == 1 and starters[0].player_id == "276"
    assert starters[0].shirt_number == 10 and starters[0].fixture_id == 555
    assert len(subs) == 1 and subs[0].player_id == "999"

async def test_sync_lineups_fail_soft(monkeypatch):
    import core.player_data_sync as s2
    async def boom(fid): raise RuntimeError("no lineup yet")
    monkeypatch.setattr(s2, "get_lineups", boom)
    summary = await s2.sync_player_lineups([1, 2])
    assert summary["lineups_written"] == 0 and len(summary["errors"]) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: FAIL con `ImportError: cannot import name '_parse_lineup'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_data_sync.py  (aggiungere import + funzioni)
from core.football_api_client import get_lineups
from core.player_data_writers import upsert_player_lineups
from core.player_models import PlayerLineupEntry


def _parse_lineup(fixture_id: int, raw: list[dict]) -> list[PlayerLineupEntry]:
    out: list[PlayerLineupEntry] = []
    for team_block in raw or []:
        team = (team_block.get("team") or {}).get("name", "")
        for is_starter, key in ((True, "startXI"), (False, "substitutes")):
            for item in team_block.get(key) or []:
                p = item.get("player") or {}
                if not p.get("id"):
                    continue
                out.append(PlayerLineupEntry(
                    player_id=str(p["id"]),
                    fixture_id=fixture_id,
                    team=team,
                    position=p.get("pos", "") or "",
                    shirt_number=p.get("number"),
                    is_starter=is_starter,
                ))
    return out


async def sync_player_lineups(fixture_ids: list[int]) -> dict:
    summary = {"lineups_written": 0, "fixtures": 0, "errors": []}
    for fid in fixture_ids:
        try:
            raw = await get_lineups(fid)
            entries = _parse_lineup(fid, raw)
            if entries:
                summary["lineups_written"] += await upsert_player_lineups(entries)
                summary["fixtures"] += 1
        except Exception as exc:
            summary["errors"].append(f"{fid}:{exc}")
    return summary
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: PASS (4 test totali nel file)

- [ ] **Step 5: Commit**

```bash
git add core/player_data_sync.py tests/test_player_data_sync.py
git commit -m "feat(player-data): sync_player_lineups da formazioni confermate"
```

---

### Task 9: Backfill storico per-partita (forma) + script runner `[GATED]`

**Files:**
- Modify: `core/player_data_sync.py` (aggiungere `backfill_recent_match_stats`)
- Create: `scripts/backfill_player_stats.py`
- Test: `tests/test_player_data_sync.py` (aggiungere)

**Interfaces:**
- Consumes: `get_fixture_player_stats` (Task 3), `upsert_player_match_stats` (Task 5), `PlayerMatchStat` (Task 2)
- Produces:
  - `def _parse_fixture_players(fixture_id: int, league: str, match_date: str, raw: list[dict]) -> list[PlayerMatchStat]` (puro; `xg` da `statistics[0].games.rating`? NO → api-football non dà xg affidabile, quindi `xg=None`; l'xg per-partita Tier 1 è fuori scope di A, arriva da B se servirà)
  - `async def backfill_recent_match_stats(fixtures: list[dict]) -> dict` — `fixtures` = `[{"fixture_id":int,"league":str,"date":str}]`. Quota-aware: l'orchestrazione passa solo le ultime `FORM_WINDOW` per squadra (selezione a monte).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_player_data_sync.py  (append)
from core.player_data_sync import _parse_fixture_players

# shape reale di /fixtures/players
RAW_FP = [{
    "team": {"name": "PSG"},
    "players": [{"player": {"id": 276, "name": "Neymar"},
                 "statistics": [{"games": {"minutes": 90, "substitute": False},
                                 "goals": {"total": 1, "assists": 1},
                                 "shots": {"total": 4, "on": 2}}]}],
}]

def test_parse_fixture_players_builds_match_stats():
    out = _parse_fixture_players(555, "FL1", "2026-05-01", RAW_FP)
    assert len(out) == 1
    m = out[0]
    assert m.player_id == "276" and m.goals == 1 and m.assists == 1
    assert m.minutes == 90 and m.started is True and m.xg is None
    assert m.fixture_id == 555 and m.match_date == "2026-05-01"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: FAIL con `ImportError: cannot import name '_parse_fixture_players'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/player_data_sync.py  (aggiungere)
from core.football_api_client import get_fixture_player_stats
from core.player_data_writers import upsert_player_match_stats
from core.player_models import PlayerMatchStat


def _parse_fixture_players(fixture_id: int, league: str, match_date: str,
                           raw: list[dict]) -> list[PlayerMatchStat]:
    out: list[PlayerMatchStat] = []
    for team_block in raw or []:
        team = (team_block.get("team") or {}).get("name", "")
        for item in team_block.get("players") or []:
            p = item.get("player") or {}
            stats = (item.get("statistics") or [{}])[0]
            games = stats.get("games") or {}
            goals = stats.get("goals") or {}
            shots = stats.get("shots") or {}
            if not p.get("id"):
                continue
            out.append(PlayerMatchStat(
                player_id=str(p["id"]),
                fixture_id=fixture_id,
                league=league,
                team=team,
                minutes=int(games.get("minutes") or 0),
                goals=int(goals.get("total") or 0),
                assists=int(goals.get("assists") or 0),
                shots=int(shots.get("total") or 0),
                xg=None,                      # api-football non fornisce xg affidabile
                started=not bool(games.get("substitute", True)),
                match_date=match_date,
            ))
    return out


async def backfill_recent_match_stats(fixtures: list[dict]) -> dict:
    summary = {"stats_written": 0, "fixtures": 0, "errors": []}
    for fx in fixtures:
        try:
            raw = await get_fixture_player_stats(fx["fixture_id"])
            rows = _parse_fixture_players(fx["fixture_id"], fx["league"], fx["date"], raw)
            if rows:
                summary["stats_written"] += await upsert_player_match_stats(rows)
                summary["fixtures"] += 1
        except Exception as exc:
            summary["errors"].append(f"{fx.get('fixture_id')}:{exc}")
    return summary
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_player_data_sync.py -v`
Expected: PASS

- [ ] **Step 5: Creare il runner `[GATED]`**

> **[GATED]** Lo script SCRIVE sul DB condiviso. NON eseguirlo in prod senza `APPROVE #id`. Per il dry-run usa `--dry-run` (stampa i conteggi senza scrivere — i writers ritornano 0 se `SUPABASE_*` non è settato in ambiente locale).

```python
# scripts/backfill_player_stats.py
"""Backfill one-shot dei profili giocatore (2 stagioni) + stat recenti.

[GATED] Scrive sul Supabase condiviso. Eseguire SOLO dopo APPROVE umano.
Uso:
  python -m scripts.backfill_player_stats --season 2025 --dry-run
"""
import argparse
import asyncio
from datetime import date

from core.player_data_sync import sync_player_profiles


async def _run(season: int) -> dict:
    today = date.today().isoformat()
    return await sync_player_profiles(season=season, today_iso=today, xg_lookup=None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    summary = asyncio.run(_run(args.season))
    print(("DRY-RUN " if args.dry_run else "") + f"summary: {summary}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Verifica import dello script (no scrittura)**

Run: `python -c "import scripts.backfill_player_stats as b; assert hasattr(b, 'main'); print('ok')"`
Expected: `ok`

- [ ] **Step 7: Commit**

```bash
git add core/player_data_sync.py scripts/backfill_player_stats.py tests/test_player_data_sync.py
git commit -m "feat(player-data): backfill stat per-partita + runner [GATED]"
```

---

### Task 10: Aggancio sync giornaliero + formazioni in `run.py`

**Files:**
- Modify: `run.py`
- Test: verifica manuale (è wiring di orchestrazione; la logica è già coperta dai test dei sync)

**Interfaces:**
- Consumes: `sync_player_profiles`, `sync_player_lineups` (Task 7-8)

> Questo task NON cambia il comportamento di prod finché la migration non è applicata: i writers ritornano 0 su tabelle assenti e i sync sono fail-soft. Sicuro da mergiare anche prima dell'APPROVE migration.

- [ ] **Step 1: Leggere il punto di aggancio**

Run: `sed -n '1,60p' run.py`
Identifica la funzione `main()` / il punto dove gli altri agent/sync sono schedulati (es. dopo `await init_db()`).

- [ ] **Step 2: Aggiungere l'invocazione del sync profili (giornaliero)**

Aggiungi dentro `main()`, accanto agli altri sync, dopo `init_db()`:

```python
    # Player data foundation (sotto-progetto A) — fail-soft, no-op se tabelle assenti
    from datetime import date
    from core.player_data_sync import sync_player_profiles
    try:
        psum = await sync_player_profiles(season=date.today().year, today_iso=date.today().isoformat())
        logging.info("player_profiles sync: %s", psum)
    except Exception as exc:
        logging.warning("player_profiles sync failed (non-blocking): %s", exc)
```

- [ ] **Step 3: Verifica che `run.py` importi senza errori**

Run: `python -c "import ast; ast.parse(open('run.py').read()); print('syntax ok')"`
Expected: `syntax ok`

- [ ] **Step 4: Commit**

```bash
git add run.py
git commit -m "feat(player-data): aggancio sync giornaliero profili in run.py"
```

---

### Task 11: Suite completa + verifica reale a campione `[GATED parziale]`

**Files:**
- Nessuna modifica di codice (gate di verifica end-to-end).

- [ ] **Step 1: Lanciare l'intera suite player-data**

Run: `pytest tests/test_player_data_tier.py tests/test_player_models.py tests/test_football_api_player.py tests/test_player_data_writers.py tests/test_understat_players.py tests/test_player_data_sync.py -v`
Expected: tutti PASS

- [ ] **Step 2: Non-regressione pipeline esistente**

Run: `pytest tests/ -q`
Expected: nessun nuovo fallimento rispetto alla baseline pre-task (annota la baseline prima di iniziare).

- [ ] **Step 3 [GATED]: Dry-run reale di un campione**

Solo dopo APPROVE migration + con `SUPABASE_*` e `API_FOOTBALL_KEY` settati in ambiente autorizzato:
Run: `python -m scripts.backfill_player_stats --season 2025 --dry-run`
Verifica nel summary: `leagues` = numero leghe in `LEAGUE_DATA_TIER`, `profiles_written` > 0 per i Tier 1, `errors` vuoto o solo leghe fuori stagione.

- [ ] **Step 4 [GATED]: Cross-check dato vs realtà**

Su 3 giocatori noti (es. capocannoniere PL stagione) verifica che `goals_per90_season` e `eligible_for_player_markets` siano sensati. Confronto manuale con una fonte pubblica. Documenta l'esito nel diario sessione.

- [ ] **Step 5: Verifica fail-closed**

Conferma che almeno una lega a basso volume produca profili con `eligible_for_player_markets=false` per i giocatori sotto `MIN_APPEARANCES`, e che le card squadra esistenti siano invariate (nessuna scrittura su `match_predictions`/`unified_predictions`).

---

## Self-Review (eseguita)

- **Spec coverage:** copertura tutte-leghe+WC (Task 1 `LEAGUE_DATA_TIER`); tier+fail-closed (Task 1-2); 3 tabelle additive (Task 4); backfill 2 stagioni + forma 10 (Global Constraints + Task 9); formazioni T-40' (Task 8); data-trust/eligibility (Task 1-2-7); sync operativo (Task 10); test reali multi-tier (Task 11). ✓
- **Correzione fonti dati** (vs spec): stat di conteggio da api-football `/players`+`/fixtures/players` (Task 3) per TUTTE le leghe; Understat solo xG Tier 1 (Task 6, isolato e degradabile). Coerente con "lo storico va costruito" dello spec. ✓
- **Placeholder scan:** nessun TBD/TODO; ogni step di codice ha il codice. ✓
- **Type consistency:** `PlayerProfile`/`PlayerMatchStat`/`PlayerLineupEntry` definiti in Task 2, consumati con le stesse firme in Task 5/7/8/9; `get_player_season_stats` ritorna `{response,paging}` in Task 3 e così consumato in Task 7. ✓
- **Gate:** migration (Task 4) e backfill (Task 9, Task 11 step 3-4) marcati `[GATED]`; il wiring `run.py` (Task 10) è sicuro pre-migration grazie al fail-soft. ✓

## Fuori scope (→ sotto-progetti B/C)

Modello goalscorer/assist, card giocatore, ancore-quota, redirect ai book, substantiation FTC dei claim, xG per-partita Tier 1, news/NLP.
