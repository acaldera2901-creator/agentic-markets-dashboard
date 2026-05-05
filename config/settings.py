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

    FOOTBALL_DATA_ORG_API_KEY: str = ""
    BALLDONTLIE_API_KEY: str = ""
    PREDICTION_HUNT_API_KEY: str = ""
    RAPIDAPI_KEY: str = ""
    POLYMARKET_PRIVATE_KEY: str = ""
    OPENWEATHERMAP_API_KEY: str = ""

    # Ollama local inference
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # Dashboard integration
    DASHBOARD_URL: str = ""
    RESEARCH_SECRET: str = ""

    # Asian Handicap collector (S7)
    SBOBET_API_KEY: str = ""         # optional AH odds source
    PINNACLE_API_KEY: str = ""       # optional Pinnacle AH endpoint

    # Trading parameters — fully explicit and configurable
    PAPER_TRADING: bool = True
    BANKROLL: float = 500.0
    KELLY_FRACTION: float = 0.25     # fractional Kelly multiplier (0.25 = quarter-Kelly)
    MAX_BET_PCT: float = 0.03        # hard cap: 3% of bankroll per bet
    MAX_BET_FRACTION: float = 0.02   # legacy alias — use MAX_BET_PCT
    MAX_TOTAL_EXPOSURE: float = 0.10
    MAX_MONTHLY_DRAWDOWN: float = 0.15

    # Edge thresholds by market efficiency tier
    MIN_EDGE: float = 0.03           # default / fallback
    EDGE_MIN_SHARP: float = 0.02     # Pinnacle / sharp books
    EDGE_MIN_SOFT: float = 0.05      # softer bookmakers

    # Confidence-interval gate: skip bet if (p_high - p_low) > this value
    MAX_CONFIDENCE_INTERVAL_WIDTH: float = 0.15

    # Data quality gate: skip bet if completeness score < this value
    MIN_DATA_COMPLETENESS: float = 0.75

    # Telegram alerting threshold
    TELEGRAM_VALUE_EDGE_THRESHOLD: float = 0.03

    # PSI monitoring thresholds
    PSI_WARNING_THRESHOLD: float = 0.1
    PSI_CRITICAL_THRESHOLD: float = 0.2

    # Champion/Challenger traffic split for shadow testing
    CHALLENGER_TRAFFIC_PCT: float = 0.10   # 10% to challenger model
    CHALLENGER_MIN_PREDICTIONS: int = 200  # promote after this many predictions

    HEARTBEAT_INTERVAL: int = 30
    HEARTBEAT_TIMEOUT: int = 60

    LEAGUES: List[str] = ["PL", "SA", "PD", "BL1", "FL1", "CL", "EL", "ECL"]
    DATA_REFRESH_INTERVAL: int = 900
    PREMATCH_REFRESH_INTERVAL: int = 60

    model_config = {"env_file": ".env"}


settings = Settings()
