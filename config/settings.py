from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    DATABASE_URL: str = "postgresql+asyncpg://agentic:password@localhost:5433/agentic_markets"

    ANTHROPIC_API_KEY: str = ""
    API_FOOTBALL_KEY: str = ""
    ODDS_API_KEY: str = ""
    BETFAIR_APP_KEY: str = ""
    BETFAIR_USERNAME: str = ""
    BETFAIR_PASSWORD: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    BALLDONTLIE_API_KEY: str = ""
    PREDICTION_HUNT_API_KEY: str = ""
    RAPIDAPI_KEY: str = ""
    POLYMARKET_PRIVATE_KEY: str = ""

    PAPER_TRADING: bool = True
    BANKROLL: float = 500.0
    MAX_BET_FRACTION: float = 0.02
    MAX_TOTAL_EXPOSURE: float = 0.10
    MIN_EDGE: float = 0.03
    MAX_MONTHLY_DRAWDOWN: float = 0.15
    KELLY_FRACTION: float = 0.25

    HEARTBEAT_INTERVAL: int = 30
    HEARTBEAT_TIMEOUT: int = 60

    LEAGUES: List[str] = ["PL", "SA", "PD", "BL1", "FL1", "CL", "EL", "ECL"]
    DATA_REFRESH_INTERVAL: int = 900
    PREMATCH_REFRESH_INTERVAL: int = 60

    model_config = {"env_file": ".env"}


settings = Settings()
