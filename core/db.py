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

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
