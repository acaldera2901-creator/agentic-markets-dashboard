from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    DATABASE_URL: str = "postgresql+asyncpg://agentic:password@localhost:5433/agentic_markets"

    ANTHROPIC_API_KEY: str = ""
    API_FOOTBALL_KEY: str = ""
    ODDS_API_KEY: str = ""
    MATCHBOOK_USERNAME: str = ""
    MATCHBOOK_PASSWORD: str = ""
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

    # Supabase — direct write for agent heartbeats + DB
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # Path override for launchctl restart (Mac local only — ignored on server)
    AGENTIC_MARKETS_AGENT_ROOT: str = ""
    DASHBOARD_HEARTBEAT_TIMEOUT: int = 10

    # Asian Handicap collector (S7)
    SBOBET_API_KEY: str = ""         # optional AH odds source
    PINNACLE_API_KEY: str = ""       # optional Pinnacle AH endpoint

    # Trading parameters — fully explicit and configurable
    PAPER_TRADING: bool = True
    BANKROLL: float = 10.0            # default 10€ live test — override in .env
    KELLY_FRACTION: float = 0.25     # fractional Kelly multiplier (0.25 = quarter-Kelly)
    MAX_BET_PCT: float = 0.20        # 20% cap (2€ on 10€ bankroll) — risk engine also reads yaml
    MAX_BET_FRACTION: float = 0.20   # legacy alias — use MAX_BET_PCT
    MAX_TOTAL_EXPOSURE: float = 0.10
    MAX_MONTHLY_DRAWDOWN: float = 0.15

    # Edge thresholds by market efficiency tier
    MIN_EDGE: float = 0.05           # default / fallback (raised from 0.03)
    EDGE_MIN_SHARP: float = 0.04     # Pinnacle / sharp books (raised from 0.02)
    EDGE_MIN_SOFT: float = 0.07      # softer bookmakers (raised from 0.05)

    # Short-odds guard: heavy favourites require extra edge due to compounded variance
    SHORT_ODDS_THRESHOLD: float = 1.50   # odds below this trigger the stricter gate
    MIN_EDGE_SHORT_ODDS: float = 0.08    # minimum edge required when odds < SHORT_ODDS_THRESHOLD

    # Duplicate bet protection
    MAX_BETS_PER_MATCH: int = 1          # max pending bets allowed per match_external_id

    # Confidence-interval gate: skip bet if (p_high - p_low) > this value
    MAX_CONFIDENCE_INTERVAL_WIDTH: float = 0.15

    # Data quality gate: skip bet if completeness score < this value
    MIN_DATA_COMPLETENESS: float = 0.75

    # Telegram alerting threshold
    TELEGRAM_VALUE_EDGE_THRESHOLD: float = 0.05

    # League & Match Context module
    DERBY_THRESHOLD: float = 0.75          # fuzzy name similarity threshold for derby detection
    CONTEXT_CACHE_TTL_H: int = 6           # hours before re-computing league/match context
    MIN_LEAGUE_MATCHES: int = 20           # min matches in DB before league strength is trusted
    PREDICTABILITY_MIN_BETS: int = 50      # min bet prima di valutare hit_rate
    PREDICTABILITY_HIT_RATE_MIN: float = 0.45  # soglia filtro automatico
    CLV_MIN_ACCEPTABLE: float = 0.0        # CLV negativo → sospensione consigliata
    LEAGUE_TIER_TOP5: list[str] = ["PL", "SA", "PD", "BL1", "FL1"]

    # PSI monitoring thresholds
    PSI_WARNING_THRESHOLD: float = 0.1
    PSI_CRITICAL_THRESHOLD: float = 0.2

    # Champion/Challenger traffic split for shadow testing
    CHALLENGER_TRAFFIC_PCT: float = 0.10   # 10% to challenger model
    CHALLENGER_MIN_PREDICTIONS: int = 200  # promote after this many predictions

    # Tennis-specific parameters
    TENNIS_BANKROLL: float = 10.0           # mirrors BANKROLL — kept separate for future split
    TENNIS_MIN_EDGE: float = 0.04          # 4% minimum edge tennis
    TENNIS_MAX_BET_PCT: float = 0.20       # 20% cap → 2€ on 10€ bankroll (Betfair minimum)
    TENNIS_DRAWDOWN_LIMIT: float = 0.12    # 12% monthly drawdown block
    TENNIS_KELLY_FRACTION: float = 0.25

    HEARTBEAT_INTERVAL: int = 30
    HEARTBEAT_TIMEOUT: int = 60

    # Data collection
    DATA_COLLECTION_DAYS_AHEAD: int = 7
    TENNIS_RAPIDAPI_HOST: str = "v1.tennis.api-sports.io"
    HISTORICAL_CSV_YEARS_BACK: int = 3

    # WC is included for World Cup diagnostics/monitoring. It must stay gated
    # until fixture, odds, national-team model and settlement readiness pass.
    LEAGUES: List[str] = ["PL", "SA", "PD", "BL1", "FL1", "CL", "EL", "ECL", "WC"]
    DATA_REFRESH_INTERVAL: int = 900
    PREMATCH_REFRESH_INTERVAL: int = 60

    model_config = {"env_file": ".env"}


settings = Settings()
