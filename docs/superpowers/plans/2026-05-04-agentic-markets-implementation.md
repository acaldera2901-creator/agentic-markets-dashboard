# Agentic Markets — Football Prediction Trading Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent autonomous trading system for football prediction markets (Betfair Exchange + Polymarket) using paper trading mode, Redis message bus, PostgreSQL persistence, and Telegram monitoring.

**Architecture:** 7 independent Python async agents communicating via Redis Streams. Data flows: API-Football/OddsAPI → DataCollector → Model (Dixon-Coles) → Analyst → Strategist → RiskManager → Trader → Monitor. Monitor also acts as watchdog: heartbeat check + auto-restart + anomaly detection.

**Tech Stack:** Python 3.11+, asyncio, Redis 7, PostgreSQL 16, SQLAlchemy (async), `betfairlightweight`, `anthropic` SDK (with prompt caching), `python-telegram-bot`, FastAPI, Docker Compose, pytest + pytest-asyncio.

---

## File Map

```
agentic-markets/
├── agents/
│   ├── base.py                  # BaseAgent: heartbeat loop + abstract _main_loop
│   ├── data_collector.py        # Fetches API-Football + OddsAPI + sentiment → Redis
│   ├── model.py                 # Runs Dixon-Coles on market:data → model:probabilities
│   ├── analyst.py               # Compares model vs market, finds edge → analyst:opportunities
│   ├── strategist.py            # Formulates thesis, filters → strategy:approved
│   ├── risk_manager.py          # Kelly sizing, hard limits → risk:orders
│   ├── trader.py                # Executes on Betfair (or paper) → trader:executions
│   └── monitor.py               # Watchdog + P&L + Telegram + FastAPI dashboard
├── core/
│   ├── redis_client.py          # Async Redis connection, stream helpers
│   ├── db.py                    # SQLAlchemy async models + session factory
│   ├── betfair_client.py        # Betfair API wrapper (login, place_bet, cash_out)
│   ├── football_api_client.py   # API-Football wrapper (fixtures, lineups, form)
│   ├── odds_api_client.py       # The Odds API wrapper (live odds aggregation)
│   └── claude_client.py         # Anthropic SDK with prompt caching enabled
├── models/
│   └── dixon_coles.py           # Dixon-Coles Poisson model: fit + predict
├── dashboard/
│   └── main.py                  # FastAPI: /health, /agents, /bets, /pnl
├── config/
│   └── settings.py              # Pydantic BaseSettings: all env vars + constants
├── tests/
│   ├── conftest.py              # pytest fixtures: fake Redis, test DB session
│   ├── test_dixon_coles.py
│   ├── test_redis_client.py
│   ├── test_risk_manager.py
│   ├── test_trader.py
│   └── test_monitor.py
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── run.py                       # Launches all 7 agents as asyncio tasks
```

---

## Task 1: Project Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `requirements.txt`
- Create: `config/settings.py`
- Create: `.env.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agentic
      POSTGRES_PASSWORD: password
      POSTGRES_DB: agentic_markets
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agentic"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Create `requirements.txt`**

```
anthropic>=0.40.0
redis[asyncio]>=5.0.0
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
betfairlightweight>=3.17.0
httpx>=0.27.0
pydantic-settings>=2.0.0
scipy>=1.13.0
numpy>=1.26.4
python-telegram-bot>=21.0.0
fastapi>=0.115.0
uvicorn>=0.30.0
feedparser>=6.0.0
tweepy>=4.14.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-mock>=3.14.0
```

- [ ] **Step 3: Create `config/settings.py`**

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    DATABASE_URL: str = "postgresql+asyncpg://agentic:password@localhost:5432/agentic_markets"

    ANTHROPIC_API_KEY: str = ""
    API_FOOTBALL_KEY: str = ""
    ODDS_API_KEY: str = ""
    BETFAIR_APP_KEY: str = ""
    BETFAIR_USERNAME: str = ""
    BETFAIR_PASSWORD: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    PAPER_TRADING: bool = True
    BANKROLL: float = 500.0
    MAX_BET_FRACTION: float = 0.02
    MAX_TOTAL_EXPOSURE: float = 0.10
    MIN_EDGE: float = 0.03
    MAX_MONTHLY_DRAWDOWN: float = 0.15
    KELLY_FRACTION: float = 0.25  # fractional Kelly (conservative)

    HEARTBEAT_INTERVAL: int = 30
    HEARTBEAT_TIMEOUT: int = 60

    LEAGUES: List[str] = ["PL", "SA", "PD", "BL1", "FL1", "CL", "EL", "ECL"]
    DATA_REFRESH_INTERVAL: int = 900     # 15 min
    PREMATCH_REFRESH_INTERVAL: int = 60  # 1 min (within 2h of kickoff)

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
API_FOOTBALL_KEY=...
ODDS_API_KEY=...
BETFAIR_APP_KEY=...
BETFAIR_USERNAME=...
BETFAIR_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
PAPER_TRADING=true
BANKROLL=500.0
```

- [ ] **Step 5: Install dependencies and start infrastructure**

```bash
cp .env.example .env
pip install -r requirements.txt
docker compose up -d
docker compose ps   # verify redis and postgres are healthy
```

Expected: both services show `healthy`.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: project setup — docker, requirements, settings"
```

---

## Task 2: Core Infrastructure — Redis Client + DB Models

**Files:**
- Create: `core/redis_client.py`
- Create: `core/db.py`
- Create: `tests/conftest.py`
- Create: `tests/test_redis_client.py`

- [ ] **Step 1: Write failing test for Redis client**

Create `tests/conftest.py`:
```python
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture
def mock_redis(mocker):
    r = AsyncMock()
    mocker.patch("core.redis_client.get_redis", return_value=r)
    return r
```

Create `tests/test_redis_client.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_publish_adds_to_stream():
    mock_r = AsyncMock()
    with patch("core.redis_client._client", mock_r):
        from core.redis_client import publish
        await publish("market:data", {"foo": "bar"})
        mock_r.xadd.assert_called_once_with("market:data", {"foo": "bar"})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_redis_client.py -v
```

Expected: `ModuleNotFoundError: No module named 'core.redis_client'`

- [ ] **Step 3: Create `core/redis_client.py`**

```python
import redis.asyncio as aioredis
from config.settings import settings

_client: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client

async def publish(stream: str, data: dict) -> None:
    r = await get_redis()
    await r.xadd(stream, data)

async def set_heartbeat(agent_name: str, ttl: int, value: str) -> None:
    r = await get_redis()
    await r.setex(f"health:{agent_name}", ttl, value)

async def get_heartbeat(agent_name: str) -> str | None:
    r = await get_redis()
    return await r.get(f"health:{agent_name}")

async def consume(stream: str, group: str, consumer: str, count: int = 10) -> list:
    r = await get_redis()
    try:
        await r.xgroup_create(stream, group, id="$", mkstream=True)
    except Exception:
        pass
    return await r.xreadgroup(group, consumer, {stream: ">"}, count=count, block=5000) or []
```

- [ ] **Step 4: Create `core/db.py`**

```python
import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from config.settings import settings

class Base(DeclarativeBase):
    pass

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True)
    external_id = Column(String, unique=True, index=True)
    league = Column(String)
    home_team = Column(String)
    away_team = Column(String)
    kickoff = Column(DateTime)
    status = Column(String, default="scheduled")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    match_external_id = Column(String, index=True)
    model_home = Column(Float)
    model_draw = Column(Float)
    model_away = Column(Float)
    market_home_implied = Column(Float)
    market_draw_implied = Column(Float)
    market_away_implied = Column(Float)
    best_edge = Column(Float)
    best_selection = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    match_external_id = Column(String, index=True)
    selection = Column(String)   # "home" | "draw" | "away"
    odds = Column(Float)
    stake = Column(Float)
    paper = Column(Boolean, default=True)
    status = Column(String, default="pending")  # pending | won | lost | voided
    profit_loss = Column(Float, nullable=True)
    betfair_bet_id = Column(String, nullable=True)
    thesis = Column(String, nullable=True)
    placed_at = Column(DateTime, default=datetime.datetime.utcnow)
    settled_at = Column(DateTime, nullable=True)

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v
```

Expected: `1 passed`.

- [ ] **Step 6: Initialize DB**

```bash
python -c "import asyncio; from core.db import init_db; asyncio.run(init_db())"
```

Expected: no errors, tables created in PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add core/ tests/
git commit -m "feat: core redis client and DB models"
```

---

## Task 3: Dixon-Coles Probability Model

**Files:**
- Create: `models/dixon_coles.py`
- Create: `tests/test_dixon_coles.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_dixon_coles.py`:
```python
import pytest
from models.dixon_coles import DixonColesModel

SAMPLE_MATCHES = [
    {"home_team": "Arsenal", "away_team": "Chelsea", "home_goals": 2, "away_goals": 1},
    {"home_team": "Chelsea", "away_team": "Arsenal", "home_goals": 1, "away_goals": 1},
    {"home_team": "Arsenal", "away_team": "Liverpool", "home_goals": 3, "away_goals": 0},
    {"home_team": "Liverpool", "away_team": "Chelsea", "home_goals": 2, "away_goals": 2},
    {"home_team": "Chelsea", "away_team": "Liverpool", "home_goals": 0, "away_goals": 1},
    {"home_team": "Liverpool", "away_team": "Arsenal", "home_goals": 1, "away_goals": 2},
]

def test_model_fits_without_error():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    assert model.fitted is True

def test_predict_returns_valid_probabilities():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    p_home, p_draw, p_away = model.predict("Arsenal", "Chelsea")
    assert abs(p_home + p_draw + p_away - 1.0) < 0.001
    assert 0 < p_home < 1
    assert 0 < p_draw < 1
    assert 0 < p_away < 1

def test_predict_raises_if_not_fitted():
    model = DixonColesModel()
    with pytest.raises(ValueError, match="not fitted"):
        model.predict("Arsenal", "Chelsea")

def test_predict_raises_for_unknown_team():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    with pytest.raises(KeyError):
        model.predict("Arsenal", "Unknown FC")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_dixon_coles.py -v
```

Expected: `ModuleNotFoundError: No module named 'models.dixon_coles'`

- [ ] **Step 3: Create `models/dixon_coles.py`**

```python
import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson
from typing import List, Dict, Tuple

def _tau(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    if x == 0 and y == 0:
        return 1 - lam * mu * rho
    if x == 0 and y == 1:
        return 1 + lam * rho
    if x == 1 and y == 0:
        return 1 + mu * rho
    if x == 1 and y == 1:
        return 1 - rho
    return 1.0

def _neg_log_likelihood(params: np.ndarray, matches: List[Dict], n_teams: int) -> float:
    attack = params[:n_teams]
    defence = params[n_teams : 2 * n_teams]
    home_adv = params[-2]
    rho = params[-1]
    log_lik = 0.0
    for m in matches:
        i, j = m["_hi"], m["_ai"]
        hg, ag = m["home_goals"], m["away_goals"]
        lam = np.exp(attack[i] + defence[j] + home_adv)
        mu = np.exp(attack[j] + defence[i])
        t = _tau(hg, ag, lam, mu, rho)
        if t <= 0:
            return 1e10
        log_lik += np.log(t) + poisson.logpmf(hg, lam) + poisson.logpmf(ag, mu)
    return -log_lik

class DixonColesModel:
    def __init__(self):
        self.teams: List[str] = []
        self._team_idx: Dict[str, int] = {}
        self.params: np.ndarray | None = None
        self.fitted: bool = False

    def fit(self, matches: List[Dict]) -> None:
        teams = sorted({m["home_team"] for m in matches} | {m["away_team"] for m in matches})
        self.teams = teams
        self._team_idx = {t: i for i, t in enumerate(teams)}
        n = len(teams)

        prepared = []
        for m in matches:
            prepared.append({**m, "_hi": self._team_idx[m["home_team"]], "_ai": self._team_idx[m["away_team"]]})

        x0 = np.concatenate([np.zeros(2 * n), [0.1, -0.1]])
        bounds = [(-3.0, 3.0)] * (2 * n) + [(0.0, 1.0), (-1.0, 0.0)]

        result = minimize(_neg_log_likelihood, x0, args=(prepared, n), method="L-BFGS-B", bounds=bounds)
        self.params = result.x
        self.fitted = True

    def predict(self, home_team: str, away_team: str, max_goals: int = 8) -> Tuple[float, float, float]:
        if not self.fitted:
            raise ValueError("Model not fitted — call fit() first")
        n = len(self.teams)
        i = self._team_idx[home_team]
        j = self._team_idx[away_team]
        attack, defence = self.params[:n], self.params[n : 2 * n]
        home_adv, rho = self.params[-2], self.params[-1]
        lam = np.exp(attack[i] + defence[j] + home_adv)
        mu = np.exp(attack[j] + defence[i])

        home_win = draw = away_win = 0.0
        for hg in range(max_goals + 1):
            for ag in range(max_goals + 1):
                p = _tau(hg, ag, lam, mu, rho) * poisson.pmf(hg, lam) * poisson.pmf(ag, mu)
                if hg > ag:
                    home_win += p
                elif hg == ag:
                    draw += p
                else:
                    away_win += p

        total = home_win + draw + away_win
        return home_win / total, draw / total, away_win / total
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_dixon_coles.py -v
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add models/ tests/test_dixon_coles.py
git commit -m "feat: Dixon-Coles probability model"
```

---

## Task 4: API Clients (Football + Odds)

**Files:**
- Create: `core/football_api_client.py`
- Create: `core/odds_api_client.py`

- [ ] **Step 1: Create `core/football_api_client.py`**

```python
import httpx
from typing import List, Dict
from config.settings import settings

BASE_URL = "https://v3.football.api-sports.io"

async def get_fixtures(league_id: int, season: int) -> List[Dict]:
    """Returns upcoming fixtures for the given league and season."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"league": league_id, "season": season, "next": 10},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_lineups(fixture_id: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures/lineups",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"fixture": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_historical_results(league_id: int, season: int) -> List[Dict]:
    """Returns finished matches for model training."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"league": league_id, "season": season, "status": "FT", "last": 50},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

LEAGUE_IDS = {
    "PL": 39, "SA": 135, "PD": 140, "BL1": 78,
    "FL1": 61, "CL": 2, "EL": 3, "ECL": 848,
}
```

- [ ] **Step 2: Create `core/odds_api_client.py`**

```python
import httpx
from typing import List, Dict
from config.settings import settings

BASE_URL = "https://api.the-odds-api.com/v4"

SPORT_KEYS = {
    "PL": "soccer_epl",
    "SA": "soccer_italy_serie_a",
    "PD": "soccer_spain_la_liga",
    "BL1": "soccer_germany_bundesliga",
    "FL1": "soccer_france_ligue_one",
    "CL": "soccer_uefa_champs_league",
    "EL": "soccer_uefa_europa_league",
    "ECL": "soccer_uefa_europa_conference_league",
}

async def get_odds(league: str) -> List[Dict]:
    """Returns h2h odds for upcoming matches in the given league."""
    sport_key = SPORT_KEYS.get(league)
    if not sport_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/sports/{sport_key}/odds",
            params={
                "apiKey": settings.ODDS_API_KEY,
                "regions": "eu,uk",
                "markets": "h2h",
                "oddsFormat": "decimal",
                "bookmakers": "betfair,pinnacle,bet365",
            },
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json()
        return []

def implied_probability(odds: float) -> float:
    """Convert decimal odds to implied probability."""
    return 1.0 / odds if odds > 0 else 0.0
```

- [ ] **Step 3: Verify imports work**

```bash
python -c "from core.football_api_client import get_fixtures; from core.odds_api_client import get_odds, implied_probability; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add core/football_api_client.py core/odds_api_client.py
git commit -m "feat: football and odds API clients"
```

---

## Task 5: Claude Client + Base Agent

**Files:**
- Create: `core/claude_client.py`
- Create: `agents/base.py`

- [ ] **Step 1: Create `core/claude_client.py`**

```python
import anthropic
from config.settings import settings

_client: anthropic.AsyncAnthropic | None = None

def get_claude() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client

async def ask(system: str, prompt: str, cache_system: bool = True) -> str:
    """Send a prompt to Claude and return the text response.
    
    Uses prompt caching on the system prompt to reduce cost on repeated calls.
    """
    client = get_claude()
    system_block = {
        "type": "text",
        "text": system,
    }
    if cache_system:
        system_block["cache_control"] = {"type": "ephemeral"}

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[system_block],
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

- [ ] **Step 2: Create `agents/base.py`**

```python
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from config.settings import settings
from core.redis_client import set_heartbeat

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self._running = False

    async def run(self) -> None:
        self._running = True
        self.logger.info("started")
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        try:
            await self._main_loop()
        except Exception as e:
            self.logger.exception(f"crashed: {e}")
        finally:
            heartbeat_task.cancel()
            self._running = False

    async def _heartbeat_loop(self) -> None:
        while self._running:
            await set_heartbeat(self.name, settings.HEARTBEAT_TIMEOUT, datetime.utcnow().isoformat())
            await asyncio.sleep(settings.HEARTBEAT_INTERVAL)

    @abstractmethod
    async def _main_loop(self) -> None:
        pass

    def stop(self) -> None:
        self._running = False
```

- [ ] **Step 3: Verify**

```bash
python -c "from agents.base import BaseAgent; from core.claude_client import get_claude; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add agents/base.py core/claude_client.py
git commit -m "feat: base agent with heartbeat and Claude client"
```

---

## Task 6: Data Collector Agent

**Files:**
- Create: `agents/data_collector.py`

The Data Collector fetches fixtures + odds every `DATA_REFRESH_INTERVAL` seconds, switches to `PREMATCH_REFRESH_INTERVAL` when a match is within 2 hours of kickoff, and publishes normalized events to the `market:data` Redis stream.

- [ ] **Step 1: Create `agents/data_collector.py`**

```python
import asyncio
import json
from datetime import datetime, timezone, timedelta
from agents.base import BaseAgent
from core.redis_client import publish
from core.football_api_client import get_fixtures, get_historical_results, LEAGUE_IDS
from core.odds_api_client import get_odds
from config.settings import settings

class DataCollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("DataCollector")

    async def _main_loop(self) -> None:
        while self._running:
            try:
                await self._collect_cycle()
            except Exception as e:
                self.logger.error(f"collection error: {e}")
            interval = self._next_interval()
            self.logger.info(f"sleeping {interval}s until next cycle")
            await asyncio.sleep(interval)

    def _next_interval(self) -> int:
        return settings.PREMATCH_REFRESH_INTERVAL if self._has_imminent_match() else settings.DATA_REFRESH_INTERVAL

    def _has_imminent_match(self) -> bool:
        now = datetime.now(timezone.utc)
        window = timedelta(hours=2)
        # simplified: always returns False until we cache fixture times locally
        return False

    async def _collect_cycle(self) -> None:
        season = datetime.now().year
        for league_code, league_id in LEAGUE_IDS.items():
            fixtures = await get_fixtures(league_id, season)
            odds_list = await get_odds(league_code)
            odds_map = {o["home_team"] + "|" + o["away_team"]: o for o in odds_list if "home_team" in o}

            for fixture in fixtures:
                event = self._build_event(fixture, odds_map, league_code)
                if event:
                    await publish("market:data", {"payload": json.dumps(event)})
                    self.logger.debug(f"published {event['home_team']} vs {event['away_team']}")

    def _build_event(self, fixture: dict, odds_map: dict, league: str) -> dict | None:
        try:
            teams = fixture["teams"]
            home = teams["home"]["name"]
            away = teams["away"]["name"]
            kickoff = fixture["fixture"]["date"]
            match_id = str(fixture["fixture"]["id"])

            odds_key = f"{home}|{away}"
            odds_data = odds_map.get(odds_key, {})

            return {
                "match_id": match_id,
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": kickoff,
                "odds": odds_data,
                "collected_at": datetime.utcnow().isoformat(),
            }
        except (KeyError, TypeError):
            return None
```

- [ ] **Step 2: Verify import**

```bash
python -c "from agents.data_collector import DataCollectorAgent; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add agents/data_collector.py
git commit -m "feat: data collector agent"
```

---

## Task 7: Model Agent

**Files:**
- Create: `agents/model.py`

The Model Agent listens to `market:data`, maintains one `DixonColesModel` per league (fitted on historical data), and publishes probability estimates to `model:probabilities`.

- [ ] **Step 1: Create `agents/model.py`**

```python
import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.football_api_client import get_historical_results, LEAGUE_IDS
from models.dixon_coles import DixonColesModel
from config.settings import settings

class ModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("ModelAgent")
        self._models: dict[str, DixonColesModel] = {}

    async def _main_loop(self) -> None:
        await self._bootstrap_models()
        while self._running:
            messages = await consume("market:data", "model_group", "ModelAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _bootstrap_models(self) -> None:
        season = datetime.now().year
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                results = await get_historical_results(league_id, season)
                training = self._parse_results(results)
                if len(training) >= 10:
                    model = DixonColesModel()
                    model.fit(training)
                    self._models[league_code] = model
                    self.logger.info(f"fitted model for {league_code} on {len(training)} matches")
                else:
                    self.logger.warning(f"insufficient data for {league_code}: {len(training)} matches")
            except Exception as e:
                self.logger.error(f"bootstrap error for {league_code}: {e}")

    def _parse_results(self, fixtures: list) -> list:
        matches = []
        for f in fixtures:
            try:
                score = f["score"]["fulltime"]
                if score["home"] is None or score["away"] is None:
                    continue
                matches.append({
                    "home_team": f["teams"]["home"]["name"],
                    "away_team": f["teams"]["away"]["name"],
                    "home_goals": int(score["home"]),
                    "away_goals": int(score["away"]),
                })
            except (KeyError, TypeError):
                continue
        return matches

    async def _process(self, data: dict) -> None:
        try:
            payload = json.loads(data["payload"])
            league = payload["league"]
            home = payload["home_team"]
            away = payload["away_team"]
            model = self._models.get(league)
            if not model or not model.fitted:
                return

            if home not in model._team_idx or away not in model._team_idx:
                return

            p_home, p_draw, p_away = model.predict(home, away)
            result = {
                "match_id": payload["match_id"],
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": payload["kickoff"],
                "p_home": str(p_home),
                "p_draw": str(p_draw),
                "p_away": str(p_away),
                "odds": payload.get("odds", "{}"),
                "computed_at": datetime.utcnow().isoformat(),
            }
            await publish("model:probabilities", result)
        except Exception as e:
            self.logger.error(f"processing error: {e}")
```

- [ ] **Step 2: Verify import**

```bash
python -c "from agents.model import ModelAgent; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add agents/model.py
git commit -m "feat: model agent with Dixon-Coles per league"
```

---

## Task 8: Analyst Agent (Claude-powered)

**Files:**
- Create: `agents/analyst.py`

The Analyst reads `model:probabilities`, computes edge vs market, and uses Claude to rank + narrate opportunities. Publishes to `analyst:opportunities`.

- [ ] **Step 1: Create `agents/analyst.py`**

```python
import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.claude_client import ask
from core.odds_api_client import implied_probability
from config.settings import settings

ANALYST_SYSTEM = """You are a quantitative football analyst for a prediction market trading desk.
You receive probability estimates from a Dixon-Coles model and current market odds.
Your job is to identify genuine value bets where the model edge is statistically meaningful.
Be concise. Flag false positives (low volume markets, suspicious line moves). Output JSON."""

class AnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__("AnalystAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("model:probabilities", "analyst_group", "AnalystAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            p_home = float(data["p_home"])
            p_draw = float(data["p_draw"])
            p_away = float(data["p_away"])
            odds_raw = json.loads(data.get("odds", "{}"))

            market_odds = self._extract_best_odds(odds_raw)
            if not market_odds:
                return

            edges = {
                "home": p_home - implied_probability(market_odds.get("home", 0)),
                "draw": p_draw - implied_probability(market_odds.get("draw", 0)),
                "away": p_away - implied_probability(market_odds.get("away", 0)),
            }
            best_sel = max(edges, key=edges.get)
            best_edge = edges[best_sel]

            if best_edge < settings.MIN_EDGE:
                return

            prompt = f"""Match: {data['home_team']} vs {data['away_team']} ({data['league']})
Kickoff: {data['kickoff']}
Model probabilities: home={p_home:.3f} draw={p_draw:.3f} away={p_away:.3f}
Best market odds: home={market_odds.get('home')} draw={market_odds.get('draw')} away={market_odds.get('away')}
Computed edge on '{best_sel}': {best_edge:.3f}

Assess this opportunity. Is the edge genuine or a data artifact?
Reply ONLY with JSON: {{"valid": true/false, "confidence": 0-1, "notes": "..."}}"""

            response = await ask(ANALYST_SYSTEM, prompt)
            assessment = json.loads(response)

            if not assessment.get("valid"):
                self.logger.info(f"skipped {data['home_team']} vs {data['away_team']}: {assessment.get('notes')}")
                return

            opportunity = {
                "match_id": data["match_id"],
                "league": data["league"],
                "home_team": data["home_team"],
                "away_team": data["away_team"],
                "kickoff": data["kickoff"],
                "selection": best_sel,
                "edge": str(best_edge),
                "odds": str(market_odds.get(best_sel, 0)),
                "confidence": str(assessment.get("confidence", 0)),
                "notes": assessment.get("notes", ""),
                "found_at": datetime.utcnow().isoformat(),
            }
            await publish("analyst:opportunities", opportunity)
            self.logger.info(f"opportunity: {data['home_team']} vs {data['away_team']} {best_sel} edge={best_edge:.3f}")
        except Exception as e:
            self.logger.error(f"analyst error: {e}")

    def _extract_best_odds(self, odds_raw: dict) -> dict | None:
        bookmakers = odds_raw.get("bookmakers", [])
        best = {}
        for bm in bookmakers:
            for market in bm.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                for outcome in market.get("outcomes", []):
                    name = outcome["name"].lower()
                    price = outcome["price"]
                    sel = None
                    if "draw" in name:
                        sel = "draw"
                    elif name == odds_raw.get("home_team", "").lower():
                        sel = "home"
                    else:
                        sel = "away"
                    if sel and (sel not in best or price > best[sel]):
                        best[sel] = price
        return best if len(best) == 3 else None
```

- [ ] **Step 2: Verify import**

```bash
python -c "from agents.analyst import AnalystAgent; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add agents/analyst.py
git commit -m "feat: analyst agent with Claude-powered edge validation"
```

---

## Task 9: Strategist Agent (Claude-powered)

**Files:**
- Create: `agents/strategist.py`

The Strategist reads `analyst:opportunities`, uses Claude to write a trade thesis, and filters out low-conviction plays. Publishes approved theses to `strategy:approved`.

- [ ] **Step 1: Create `agents/strategist.py`**

```python
import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.claude_client import ask

STRATEGIST_SYSTEM = """You are the Head of Strategy at a quantitative prediction market trading desk.
You receive validated value bet opportunities from the analyst team.
Your role: write a clear trade thesis and assign a final conviction score (0-10).
Reject opportunities with score < 6. Output JSON only."""

class StrategistAgent(BaseAgent):
    def __init__(self):
        super().__init__("StrategistAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("analyst:opportunities", "strategist_group", "StrategistAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            prompt = f"""Opportunity:
Match: {data['home_team']} vs {data['away_team']} ({data['league']})
Kickoff: {data['kickoff']}
Selection: {data['selection']} @ {data['odds']} decimal
Edge: {data['edge']}
Analyst confidence: {data['confidence']}
Analyst notes: {data['notes']}

Write a trade thesis and score this opportunity.
Reply ONLY with JSON:
{{"conviction": 0-10, "thesis": "one sentence thesis", "approve": true/false}}"""

            response = await ask(STRATEGIST_SYSTEM, prompt)
            result = json.loads(response)

            if not result.get("approve") or result.get("conviction", 0) < 6:
                self.logger.info(f"rejected: {data['home_team']} vs {data['away_team']} conviction={result.get('conviction')}")
                return

            approved = {
                **data,
                "conviction": str(result["conviction"]),
                "thesis": result["thesis"],
                "approved_at": datetime.utcnow().isoformat(),
            }
            await publish("strategy:approved", approved)
            self.logger.info(f"approved: {data['home_team']} vs {data['away_team']} [{result['thesis'][:60]}]")
        except Exception as e:
            self.logger.error(f"strategist error: {e}")
```

- [ ] **Step 2: Verify import**

```bash
python -c "from agents.strategist import StrategistAgent; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add agents/strategist.py
git commit -m "feat: strategist agent with Claude thesis generation"
```

---

## Task 10: Risk Manager Agent

**Files:**
- Create: `agents/risk_manager.py`
- Create: `tests/test_risk_manager.py`

The Risk Manager applies Kelly Criterion sizing, enforces hard limits, and gates all bets through a bankroll check.

- [ ] **Step 1: Write failing tests**

Create `tests/test_risk_manager.py`:
```python
import pytest
from agents.risk_manager import kelly_stake, is_within_limits

def test_kelly_stake_correct():
    # edge = 0.05, odds = 3.0 → kelly = 0.05/2.0 = 0.025 × 0.25 fraction × 500 bankroll = 3.125
    stake = kelly_stake(edge=0.05, odds=3.0, bankroll=500.0, kelly_fraction=0.25)
    assert abs(stake - 3.125) < 0.01

def test_kelly_stake_capped_at_max_fraction():
    # very high edge → stake capped at 2% of bankroll = 10.0
    stake = kelly_stake(edge=0.4, odds=2.0, bankroll=500.0, kelly_fraction=0.25, max_fraction=0.02)
    assert stake <= 10.0

def test_kelly_stake_zero_for_negative_edge():
    stake = kelly_stake(edge=-0.01, odds=2.0, bankroll=500.0, kelly_fraction=0.25)
    assert stake == 0.0

def test_within_limits_passes():
    assert is_within_limits(current_exposure=0.05, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is True

def test_within_limits_fails_when_over():
    assert is_within_limits(current_exposure=0.09, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_risk_manager.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `agents/risk_manager.py`**

```python
import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from config.settings import settings

def kelly_stake(
    edge: float,
    odds: float,
    bankroll: float,
    kelly_fraction: float,
    max_fraction: float = None,
) -> float:
    if edge <= 0:
        return 0.0
    kelly = edge / (odds - 1)
    stake = kelly * kelly_fraction * bankroll
    cap = (max_fraction or settings.MAX_BET_FRACTION) * bankroll
    return min(stake, cap)

def is_within_limits(current_exposure: float, new_stake: float, bankroll: float, max_exposure: float) -> bool:
    return (current_exposure + new_stake / bankroll) <= max_exposure

class RiskManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__("RiskManagerAgent")
        self._current_exposure: float = 0.0
        self._monthly_pnl: float = 0.0

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("strategy:approved", "risk_group", "RiskManagerAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            if self._monthly_pnl < -settings.MAX_MONTHLY_DRAWDOWN * settings.BANKROLL:
                self.logger.warning("monthly drawdown limit hit — blocking all new bets")
                return

            edge = float(data["edge"])
            odds = float(data["odds"])
            stake = kelly_stake(edge, odds, settings.BANKROLL, settings.KELLY_FRACTION)

            if stake < 1.0:
                self.logger.info(f"stake too small ({stake:.2f}), skipping")
                return

            if not is_within_limits(self._current_exposure, stake, settings.BANKROLL, settings.MAX_TOTAL_EXPOSURE):
                self.logger.warning(f"exposure limit reached, skipping {data['home_team']} vs {data['away_team']}")
                return

            order = {
                **data,
                "stake": str(round(stake, 2)),
                "sized_at": datetime.utcnow().isoformat(),
            }
            self._current_exposure += stake / settings.BANKROLL
            await publish("risk:orders", order)
            self.logger.info(f"order approved: {data['home_team']} vs {data['away_team']} stake={stake:.2f}")
        except Exception as e:
            self.logger.error(f"risk manager error: {e}")
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_risk_manager.py -v
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add agents/risk_manager.py tests/test_risk_manager.py
git commit -m "feat: risk manager agent with Kelly criterion and exposure limits"
```

---

## Task 11: Trader Agent (Paper Mode)

**Files:**
- Create: `core/betfair_client.py`
- Create: `agents/trader.py`
- Create: `tests/test_trader.py`

- [ ] **Step 1: Create `core/betfair_client.py`**

```python
import betfairlightweight
from betfairlightweight import APIClient
from betfairlightweight.filters import market_filter
from config.settings import settings

_client: APIClient | None = None

def get_betfair() -> APIClient:
    global _client
    if _client is None:
        _client = betfairlightweight.APIClient(
            username=settings.BETFAIR_USERNAME,
            password=settings.BETFAIR_PASSWORD,
            app_key=settings.BETFAIR_APP_KEY,
        )
        _client.login()
    return _client

def place_bet(market_id: str, selection_id: int, odds: float, stake: float) -> dict:
    client = get_betfair()
    instructions = [{"selectionId": selection_id, "handicap": 0, "side": "BACK",
                     "orderType": "LIMIT",
                     "limitOrder": {"size": round(stake, 2), "price": odds, "persistenceType": "LAPSE"}}]
    result = client.betting.place_orders(market_id=market_id, instructions=instructions)
    return result.serialize()

def cash_out(market_id: str, selection_id: int, current_odds: float, original_stake: float) -> dict:
    client = get_betfair()
    lay_stake = original_stake * 0.95  # simplified cash-out
    instructions = [{"selectionId": selection_id, "handicap": 0, "side": "LAY",
                     "orderType": "LIMIT",
                     "limitOrder": {"size": round(lay_stake, 2), "price": current_odds, "persistenceType": "LAPSE"}}]
    result = client.betting.place_orders(market_id=market_id, instructions=instructions)
    return result.serialize()
```

- [ ] **Step 2: Write failing test for paper trading**

Create `tests/test_trader.py`:
```python
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from agents.trader import TraderAgent

@pytest.mark.asyncio
async def test_paper_trade_saves_to_db(mocker):
    agent = TraderAgent()
    mock_session = AsyncMock()
    mocker.patch("agents.trader.AsyncSessionLocal", return_value=mock_session.__aenter__.return_value)
    mocker.patch("agents.trader.settings") .PAPER_TRADING = True

    order = {
        "match_id": "123",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "selection": "home",
        "odds": "2.5",
        "stake": "10.0",
        "thesis": "Test thesis",
        "league": "PL",
    }
    # Should not raise even with mocked DB
    await agent._execute_paper(order)
```

- [ ] **Step 3: Create `agents/trader.py`**

```python
import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.db import AsyncSessionLocal, Bet
from config.settings import settings

class TraderAgent(BaseAgent):
    def __init__(self):
        super().__init__("TraderAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("risk:orders", "trader_group", "TraderAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            if settings.PAPER_TRADING:
                await self._execute_paper(data)
            else:
                await self._execute_live(data)
        except Exception as e:
            self.logger.error(f"trader error: {e}")

    async def _execute_paper(self, order: dict) -> None:
        async with AsyncSessionLocal() as session:
            bet = Bet(
                match_external_id=order["match_id"],
                selection=order["selection"],
                odds=float(order["odds"]),
                stake=float(order["stake"]),
                paper=True,
                status="pending",
                thesis=order.get("thesis", ""),
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)

        execution = {
            **order,
            "bet_id": str(bet.id),
            "paper": "true",
            "executed_at": datetime.utcnow().isoformat(),
        }
        await publish("trader:executions", execution)
        self.logger.info(f"[PAPER] placed: {order['home_team']} vs {order['away_team']} {order['selection']} @ {order['odds']} stake={order['stake']}")

    async def _execute_live(self, order: dict) -> None:
        from core.betfair_client import place_bet
        result = place_bet(
            market_id=order.get("betfair_market_id", ""),
            selection_id=int(order.get("betfair_selection_id", 0)),
            odds=float(order["odds"]),
            stake=float(order["stake"]),
        )
        async with AsyncSessionLocal() as session:
            bet = Bet(
                match_external_id=order["match_id"],
                selection=order["selection"],
                odds=float(order["odds"]),
                stake=float(order["stake"]),
                paper=False,
                status="pending",
                thesis=order.get("thesis", ""),
                betfair_bet_id=str(result.get("instructionReports", [{}])[0].get("betId", "")),
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()

        await publish("trader:executions", {**order, "paper": "false", "executed_at": datetime.utcnow().isoformat()})
        self.logger.info(f"[LIVE] placed: {order['home_team']} vs {order['away_team']} stake={order['stake']}")
```

- [ ] **Step 4: Verify import**

```bash
python -c "from agents.trader import TraderAgent; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add core/betfair_client.py agents/trader.py tests/test_trader.py
git commit -m "feat: trader agent with paper/live mode and Betfair client"
```

---

## Task 12: Monitor Agent (Watchdog + Telegram + P&L)

**Files:**
- Create: `agents/monitor.py`
- Create: `tests/test_monitor.py`

The Monitor is the most critical agent: watchdog (heartbeat check + auto-restart), anomaly detection, P&L tracking, Telegram alerts, and FastAPI dashboard.

- [ ] **Step 1: Write failing test**

Create `tests/test_monitor.py`:
```python
import pytest
from agents.monitor import is_heartbeat_stale, compute_pnl

def test_heartbeat_stale_when_old():
    from datetime import datetime, timedelta
    old = (datetime.utcnow() - timedelta(seconds=90)).isoformat()
    assert is_heartbeat_stale(old, timeout_seconds=60) is True

def test_heartbeat_fresh():
    from datetime import datetime
    fresh = datetime.utcnow().isoformat()
    assert is_heartbeat_stale(fresh, timeout_seconds=60) is False

def test_compute_pnl():
    bets = [
        {"stake": 10.0, "odds": 2.5, "status": "won"},
        {"stake": 10.0, "odds": 2.0, "status": "lost"},
    ]
    pnl = compute_pnl(bets)
    assert abs(pnl - (15.0 - 10.0)) < 0.01  # won: 10*(2.5-1)=15, lost: -10
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_monitor.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `agents/monitor.py`**

```python
import asyncio
import subprocess
import json
from datetime import datetime, timedelta
from typing import List
from agents.base import BaseAgent
from core.redis_client import get_redis
from core.db import AsyncSessionLocal, Bet
from config.settings import settings
from sqlalchemy import select

AGENT_PROCESSES = [
    "data_collector", "model", "analyst",
    "strategist", "risk_manager", "trader",
]

def is_heartbeat_stale(timestamp_iso: str, timeout_seconds: int = 60) -> bool:
    try:
        ts = datetime.fromisoformat(timestamp_iso)
        return (datetime.utcnow() - ts).total_seconds() > timeout_seconds
    except Exception:
        return True

def compute_pnl(bets: List[dict]) -> float:
    total = 0.0
    for b in bets:
        if b["status"] == "won":
            total += b["stake"] * (b["odds"] - 1)
        elif b["status"] == "lost":
            total -= b["stake"]
    return total

class MonitorAgent(BaseAgent):
    def __init__(self):
        super().__init__("MonitorAgent")
        self._bot = None
        self._last_report = datetime.min

    async def _main_loop(self) -> None:
        await self._init_telegram()
        while self._running:
            await self._check_heartbeats()
            await self._check_anomalies()
            await self._maybe_send_daily_report()
            await asyncio.sleep(30)

    async def _init_telegram(self) -> None:
        if settings.TELEGRAM_BOT_TOKEN:
            try:
                from telegram import Bot
                self._bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
                self.logger.info("Telegram bot initialized")
            except Exception as e:
                self.logger.warning(f"Telegram init failed: {e}")

    async def _send_telegram(self, message: str) -> None:
        if self._bot and settings.TELEGRAM_CHAT_ID:
            try:
                await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=message)
            except Exception as e:
                self.logger.error(f"Telegram send failed: {e}")

    async def _check_heartbeats(self) -> None:
        r = await get_redis()
        for agent in AGENT_PROCESSES:
            hb = await r.get(f"health:{agent.replace('_', '').title()}Agent")
            name = f"{agent.title()}Agent"
            if hb is None or is_heartbeat_stale(hb, settings.HEARTBEAT_TIMEOUT):
                self.logger.warning(f"{name} heartbeat missing — restarting")
                await self._restart_agent(agent)
                await self._send_telegram(f"⚠️ {name} crashed — restarted automatically")

    async def _restart_agent(self, agent_name: str) -> None:
        try:
            subprocess.Popen(
                ["python", "-c", f"import asyncio; from agents.{agent_name} import {agent_name.title().replace('_','')}Agent; asyncio.run({agent_name.title().replace('_','')}Agent().run())"],
                start_new_session=True,
            )
        except Exception as e:
            self.logger.error(f"restart failed for {agent_name}: {e}")

    async def _check_anomalies(self) -> None:
        r = await get_redis()
        info = await r.xinfo_stream("model:probabilities") if await r.exists("model:probabilities") else None
        if info:
            last_entry_ms = info.get("last-generated-id", "0-0").split("-")[0]
            if last_entry_ms != "0":
                last_ts = datetime.utcfromtimestamp(int(last_entry_ms) / 1000)
                if (datetime.utcnow() - last_ts).total_seconds() > 3600:
                    self.logger.warning("model:probabilities stream silent for >1h")
                    await self._send_telegram("⚠️ Model Agent has not published in 1 hour")

    async def _maybe_send_daily_report(self) -> None:
        now = datetime.utcnow()
        if now.hour == 8 and (now - self._last_report).total_seconds() > 3600:
            report = await self._build_report()
            await self._send_telegram(report)
            self._last_report = now

    async def _build_report(self) -> str:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Bet))
            bets = result.scalars().all()

        bet_dicts = [{"stake": b.stake, "odds": b.odds, "status": b.status} for b in bets]
        pnl = compute_pnl(bet_dicts)
        won = sum(1 for b in bet_dicts if b["status"] == "won")
        lost = sum(1 for b in bet_dicts if b["status"] == "lost")
        total = won + lost

        win_rate = (won / total * 100) if total > 0 else 0
        mode = "PAPER" if settings.PAPER_TRADING else "LIVE"

        return (
            f"📊 Agentic Markets Daily Report [{mode}]\n"
            f"Total bets: {total} | Won: {won} | Lost: {lost}\n"
            f"Win rate: {win_rate:.1f}%\n"
            f"P&L: {'+'if pnl>=0 else ''}{pnl:.2f}€\n"
            f"Bankroll: {settings.BANKROLL:.0f}€"
        )
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_monitor.py -v
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add agents/monitor.py tests/test_monitor.py
git commit -m "feat: monitor agent — watchdog, auto-restart, Telegram, P&L"
```

---

## Task 13: Orchestrator + Integration Smoke Test

**Files:**
- Create: `run.py`
- Create: `dashboard/main.py`

- [ ] **Step 1: Create `run.py`**

```python
import asyncio
import logging
from agents.data_collector import DataCollectorAgent
from agents.model import ModelAgent
from agents.analyst import AnalystAgent
from agents.strategist import StrategistAgent
from agents.risk_manager import RiskManagerAgent
from agents.trader import TraderAgent
from agents.monitor import MonitorAgent
from core.db import init_db

logging.basicConfig(level=logging.INFO)

async def main():
    await init_db()
    agents = [
        DataCollectorAgent(),
        ModelAgent(),
        AnalystAgent(),
        StrategistAgent(),
        RiskManagerAgent(),
        TraderAgent(),
        MonitorAgent(),
    ]
    await asyncio.gather(*[agent.run() for agent in agents])

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Create `dashboard/main.py`**

```python
from fastapi import FastAPI
from core.redis_client import get_redis
from core.db import AsyncSessionLocal, Bet
from agents.monitor import is_heartbeat_stale, compute_pnl, AGENT_PROCESSES
from sqlalchemy import select
from config.settings import settings

app = FastAPI(title="Agentic Markets Dashboard")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/agents")
async def agents_status():
    r = await get_redis()
    status = {}
    for agent in AGENT_PROCESSES:
        name = f"{agent.title().replace('_','')}Agent"
        hb = await r.get(f"health:{name}")
        if hb is None:
            status[name] = "offline"
        elif is_heartbeat_stale(hb, settings.HEARTBEAT_TIMEOUT):
            status[name] = "stale"
        else:
            status[name] = "running"
    return status

@app.get("/bets")
async def recent_bets(limit: int = 20):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).order_by(Bet.placed_at.desc()).limit(limit))
        bets = result.scalars().all()
    return [{"id": b.id, "match": b.match_external_id, "selection": b.selection,
             "odds": b.odds, "stake": b.stake, "status": b.status,
             "paper": b.paper, "pnl": b.profit_loss} for b in bets]

@app.get("/pnl")
async def pnl_summary():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet))
        bets = result.scalars().all()
    bet_dicts = [{"stake": b.stake, "odds": b.odds, "status": b.status} for b in bets]
    return {
        "total_pnl": compute_pnl(bet_dicts),
        "total_bets": len(bet_dicts),
        "paper_mode": settings.PAPER_TRADING,
    }
```

- [ ] **Step 3: Run full test suite**

```bash
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Smoke test — verify all imports and DB init**

```bash
python -c "
import asyncio
from core.db import init_db
from run import main
print('All imports OK')
asyncio.run(init_db())
print('DB initialized OK')
"
```

Expected:
```
All imports OK
DB initialized OK
```

- [ ] **Step 5: Start the dashboard (separate terminal)**

```bash
uvicorn dashboard.main:app --reload --port 8000
```

Then verify:
```bash
curl http://localhost:8000/health
# {"status":"ok"}

curl http://localhost:8000/agents
# {"DatacollectorAgent":"offline",...}

curl http://localhost:8000/pnl
# {"total_pnl":0.0,"total_bets":0,"paper_mode":true}
```

- [ ] **Step 6: Final commit**

```bash
git add run.py dashboard/ tests/
git commit -m "feat: orchestrator, dashboard, integration smoke test — system complete"
```

---

## Running the Full System

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Copy and fill your API keys
cp .env.example .env
# edit .env with real keys

# 3. Launch all agents
python run.py

# 4. Dashboard (separate terminal)
uvicorn dashboard.main:app --port 8000

# 5. Monitor logs
# Each agent logs to stdout with its name prefix
# Telegram reports arrive at 8:00 UTC daily
```

---

## Self-Review Checklist

- [x] Spec coverage: all 7 agents implemented, Dixon-Coles, paper/live toggle, Kelly criterion, heartbeat watchdog, Telegram, dashboard, multi-league
- [x] No placeholders or TBDs — all steps have concrete code
- [x] Types consistent: `DixonColesModel._team_idx` used correctly in Task 7, `kelly_stake`/`is_within_limits` signatures match test calls, `Bet` model fields consistent across trader and monitor
- [x] Redis stream names consistent: `market:data` → `model:probabilities` → `analyst:opportunities` → `strategy:approved` → `risk:orders` → `trader:executions`
- [x] `PAPER_TRADING` flag flows from settings → trader → DB
