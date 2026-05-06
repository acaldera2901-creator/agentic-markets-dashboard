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
    selection = Column(String)
    odds = Column(Float)
    stake = Column(Float)
    paper = Column(Boolean, default=True)
    status = Column(String, default="pending")
    profit_loss = Column(Float, nullable=True)
    betfair_bet_id = Column(String, nullable=True)
    thesis = Column(String, nullable=True)
    placed_at = Column(DateTime, default=datetime.datetime.utcnow)
    settled_at = Column(DateTime, nullable=True)

class LeagueProfile(Base):
    __tablename__ = "league_profiles"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, unique=True, index=True)
    league_name = Column(String)
    strength_tier = Column(Integer, nullable=True)
    market_efficiency = Column(Float, default=0.5)
    predictability_score = Column(Float, default=0.5)
    avg_xg_per_game = Column(Float, nullable=True)
    result_volatility = Column(Float, nullable=True)
    liquidity_score = Column(Float, default=0.5)
    recommended_edge_min = Column(Float, default=0.03)
    total_matches_analyzed = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class MatchClassification(Base):
    __tablename__ = "match_classifications"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, unique=True, index=True)
    league_id = Column(String, index=True)
    match_type = Column(String, default="STANDARD")
    motivation_home = Column(Float, nullable=True)
    motivation_away = Column(Float, nullable=True)
    rest_advantage = Column(Float, nullable=True)
    home_days_rest = Column(Integer, nullable=True)
    away_days_rest = Column(Integer, nullable=True)
    is_derby = Column(Boolean, default=False)
    classified_at = Column(DateTime, default=datetime.datetime.utcnow)


class LeaguePredictabilityLog(Base):
    __tablename__ = "league_predictability_log"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, index=True)
    snapshot_date = Column(DateTime, default=datetime.datetime.utcnow)
    total_predictions = Column(Integer, default=0)
    hit_rate = Column(Float, nullable=True)
    value_bet_hit_rate = Column(Float, nullable=True)
    avg_clv = Column(Float, nullable=True)
    roi = Column(Float, nullable=True)
    brier_score = Column(Float, nullable=True)
    best_bet_type = Column(String, nullable=True)
    worst_bet_type = Column(String, nullable=True)
    confidence_level = Column(String, default="INSUFFICIENT_DATA")
    bet_filter_active = Column(Boolean, default=False)


class DerbyRegistry(Base):
    __tablename__ = "derby_registry"
    id = Column(Integer, primary_key=True)
    team_a = Column(String, index=True)
    team_b = Column(String, index=True)
    league_id = Column(String, nullable=True)
    derby_type = Column(String, default="NATIONAL")
    source = Column(String, default="seed")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
