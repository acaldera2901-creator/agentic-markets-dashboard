import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from core.db import Base, LeagueProfile, MatchClassification, LeaguePredictabilityLog, DerbyRegistry


@pytest.mark.asyncio
async def test_league_profile_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: {col["name"] for col in inspect(c).get_columns("league_profiles")}
        )
    assert {"league_id", "league_name", "strength_tier", "market_efficiency",
            "predictability_score", "avg_xg_per_game", "result_volatility",
            "liquidity_score", "recommended_edge_min", "updated_at"}.issubset(cols)
    await engine.dispose()


@pytest.mark.asyncio
async def test_match_classification_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: {col["name"] for col in inspect(c).get_columns("match_classifications")}
        )
    assert {"match_id", "league_id", "match_type", "motivation_home",
            "motivation_away", "rest_advantage", "classified_at"}.issubset(cols)
    await engine.dispose()


@pytest.mark.asyncio
async def test_derby_registry_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(
            lambda c: {col["name"] for col in inspect(c).get_columns("derby_registry")}
        )
    assert {"id", "team_a", "team_b", "league_id", "derby_type"}.issubset(cols)
    await engine.dispose()
