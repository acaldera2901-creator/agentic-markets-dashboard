"""
Tests for the Context Module REST API endpoints.

Uses FastAPI's TestClient with an in-memory SQLite database so no
real PostgreSQL instance is required.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

import dashboard.main as dashboard_module
from dashboard.main import app
from core.db import Base, LeagueProfile, MatchClassification, LeaguePredictabilityLog
import datetime


# ── In-memory DB fixture ──────────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
_TestSession = async_sessionmaker(_test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed: one league profile + one match classification
    async with _TestSession() as session:
        session.add(LeagueProfile(
            league_id="PL",
            league_name="Premier League",
            strength_tier=1,
            market_efficiency=0.92,
            predictability_score=0.71,
            avg_xg_per_game=2.8,
            result_volatility=1.3,
            liquidity_score=0.88,
            recommended_edge_min=0.04,
            total_matches_analyzed=380,
            updated_at=datetime.datetime.utcnow(),
        ))
        session.add(LeaguePredictabilityLog(
            league_id="PL",
            snapshot_date=datetime.datetime.utcnow(),
            total_predictions=120,
            hit_rate=0.54,
            value_bet_hit_rate=0.51,
            avg_clv=0.018,
            roi=0.06,
            brier_score=0.21,
            best_bet_type="home",
            worst_bet_type="draw",
            confidence_level="HIGH",
            bet_filter_active=False,
        ))
        session.add(MatchClassification(
            match_id="match-001",
            league_id="PL",
            match_type="DERBY_NATIONAL",
            motivation_home=None,
            motivation_away=None,
            rest_advantage=1.0,
            home_days_rest=5,
            away_days_rest=4,
            is_derby=True,
            classified_at=datetime.datetime.utcnow(),
        ))
        await session.commit()

    # Patch AsyncSessionLocal in dashboard.main's own namespace
    original = dashboard_module.AsyncSessionLocal
    dashboard_module.AsyncSessionLocal = _TestSession

    yield

    dashboard_module.AsyncSessionLocal = original
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_league_profile_returns_data():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/league/PL/profile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["league_id"] == "PL"
    assert body["strength_tier"] == 1
    assert body["market_efficiency"] == pytest.approx(0.92)


@pytest.mark.asyncio
async def test_league_profile_case_insensitive():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/league/pl/profile")
    assert resp.status_code == 200
    assert resp.json()["league_id"] == "PL"


@pytest.mark.asyncio
async def test_league_profile_includes_predictability():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/league/PL/profile")
    body = resp.json()
    pred = body["predictability"]
    assert pred["confidence_level"] == "HIGH"
    assert pred["hit_rate"] == pytest.approx(0.54)
    assert pred["avg_clv"] == pytest.approx(0.018)


@pytest.mark.asyncio
async def test_league_profile_404_for_unknown():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/league/XYZ/profile")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_match_context_returns_data():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/match/match-001/context")
    assert resp.status_code == 200
    body = resp.json()
    assert body["match_id"] == "match-001"
    assert body["match_type"] == "DERBY_NATIONAL"
    assert body["is_derby"] is True
    assert body["home_days_rest"] == 5


@pytest.mark.asyncio
async def test_match_context_404_for_unknown():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/match/no-such-match/context")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_leagues_summary_returns_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/leagues/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert body[0]["league_id"] == "PL"


@pytest.mark.asyncio
async def test_leagues_summary_fields():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/leagues/summary")
    row = resp.json()[0]
    for key in ("league_id", "league_name", "strength_tier", "market_efficiency",
                "predictability_score", "recommended_edge_min"):
        assert key in row, f"missing field: {key}"
