from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    DATABASE_URL: str = "postgresql+asyncpg://agentic:password@localhost:5433/agentic_markets"

    ANTHROPIC_API_KEY: str = ""
    API_FOOTBALL_KEY: str = ""
    # Direct api-sports.io application key (x-apisports-key host). Separate from
    # the RapidAPI key above: the direct host exposes the /fixtures?date lookup
    # used as the FRIENDLY settlement fallback. Empty -> fallback is a no-op.
    API_FOOTBALL_DIRECT_KEY: str = ""
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

    # Experiment isolation — when true, the backend runs as an offline experiment
    # and MUST NOT write the client-served tables (bets / tennis_bets). Internal
    # tables (predictions, heartbeats, logs, elo, etc.) are still written freely.
    EXPERIMENT_MODE: bool = False

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

    # Dixon-Coles → unified_predictions writer (experiment, runs in parallel to
    # the TS Poisson v1; distinct model_version + source_table so it never
    # overwrites the client-served rows until an explicit promotion).
    DC_MODEL_VERSION: str = "football-dixoncoles-v1"
    DC_SOURCE_TABLE: str = "dixon_coles_predictions"
    DC_PLAN_ACCESS: str = "premium"          # parked behind premium until promoted
    DC_MIN_TEAM_MATCHES: int = 4             # reliability gate, mirrors TS MIN_MATCHES_PER_TEAM
    DC_MAX_CI_WIDTH: float = 0.15            # conformal interval width above which a pick is "estimate"
    DC_TIME_DECAY_HALFLIFE_DAYS: float = 120.0  # Dixon-Coles time weighting; 0 disables
    XG_MODEL_VERSION: str = "football-xg-v1"     # xG-enhanced model (paper/parallel)
    XG_SOURCE_TABLE: str = "xg_predictions"      # distinct dedup namespace
    WC_MODEL_VERSION: str = "football-worldcup-v1"  # national Poisson rates (paper tier)
    WC_SOURCE_TABLE: str = "wc_model"               # distinct dedup namespace for WC rows
    # v2 Elo candidate (lab elo2). SHADOW ONLY: logged to prediction_log for A/B
    # vs v1, never served, until promotion_gate green + human APPROVE. The
    # "-shadow" suffix keeps its snapshots out of the served-version namespace.
    WC_ELO_V2_MODEL_VERSION: str = "football-worldcup-v2-elo"
    WC_ELO_V2_SHADOW_VERSION: str = "football-worldcup-v2-elo-shadow"
    WC_ELO_V2_SHADOW_ENABLED: bool = True
    # PROMOTION (#ELO-V2, gate verde dBrier -0.0779 + APPROVE Andrea 2026-06-07):
    # quando True il v2 e' il modello SERVITO sul paper tier WC/friendlies; il
    # Poisson v1 resta fallback fail-soft (rating mancante) e shadow A/B.
    # ROLLBACK = settare False (il servito torna istantaneamente al v1).
    WC_ELO_V2_SERVE_ENABLED: bool = True
    WC_V1_SHADOW_VERSION: str = "football-worldcup-v1-shadow"
    # International friendlies — same national model as WC, distinct version +
    # namespace so calibration/track-record audits separate friendlies (heavy
    # rotations, lower stakes) from competitive matches. ALWAYS paper in v1.
    FRIENDLY_MODEL_VERSION: str = "football-friendlies-v1"
    # F3 (ri-verifica michele-claude): amichevoli servite dal v2 Elo restano in
    # un namespace separato dal WC competitivo, per audit calibrazione/track-record.
    FRIENDLY_V2_MODEL_VERSION: str = "football-friendlies-v2-elo"
    FRIENDLY_SOURCE_TABLE: str = "friendly_model"
    FRIENDLY_MIN_NATIONAL_QUALITY: float = 0.75   # same bar as the WC signal gate

    # Squad Condition Watch (spec 2026-06-07-squad-condition-watch.md). ①+② only:
    # probability-neutral why-layer + quality-gate cap. The model-feature layer ③
    # stays gated behind PROMOTION-GATE + APPROVE.
    # Rotation flag: XI value below this fraction of the club/national best-11 =
    # key players rested/missing today (lab |d_avail|>=0.10 was the heavy-rotation
    # subgroup that promoted; 0.85 ratio is its conservative single-team mirror).
    SQUAD_ROTATION_RATIO: float = 0.85
    # Availability index clip — identical to the lab (min(xi/best11, 1.2)).
    SQUAD_AVAIL_CLIP: float = 1.2
    # Min valued starters before XI value is trusted (lab MIN_XI_VALUED).
    SQUAD_MIN_XI_VALUED: int = 9
    # Quality-gate cap when availability is UNKNOWN (no value data): the tier
    # cannot exceed this. signal_allowed/premium_candidate require known squad
    # condition — probability-neutral, only gates publication strength.
    SQUAD_UNKNOWN_AVAIL_TIER_CAP: str = "paper_only"
    # Optional local transfermarkt valuations dir (dcaribou CDN snapshot). Absent
    # at runtime -> XI value math degrades to None (fail-soft), never fabricated.
    TRANSFERMARKT_DATA_DIR: str = "data/transfermarkt"

    # Rolling publication window (#019, APPROVE Andrea 2026-06-06): predictions
    # are computed and served only for the next N days, refreshed daily — closer
    # matches carry more information (squads, injuries, mature markets), so the
    # served percentages are stronger than publishing the whole slate at once.
    # ALL sports (current and future) must respect this window. Keep in sync
    # with lib/prediction-window.ts.
    PREDICTION_WINDOW_DAYS: int = 10

    # Tennis board curation (#020, Andrea 2026-06-06: "tutto quello che si vede
    # deve essere sotto il nostro controllo"). Qualifying rounds are dropped via
    # the real ESPN round field; minor circuits (ITF/Challenger/WTA125) via an
    # explicit, env-overridable denylist matched on accent-folded tournament
    # names. Dropped tournaments are logged every cycle so curation stays visible.
    TENNIS_INCLUDE_QUALIFYING: bool = False
    TENNIS_TOURNAMENT_DENYLIST: str = (
        "itf,challenger,125,memorial,trofeo,makarska,puglie,ilkley,fontana"
    )

    # Confidence-surfacing gate (Wave 1, APPROVE Andrea 2026-06-08). Single
    # source of truth for the floor below which a row is shown WITHOUT a
    # pick direction/edge ("no clear favourite"). Probability-neutral: the
    # gate flips a publish flag only — p_home/p_draw/p_away and confidence_score
    # are never altered. Floors are on the picked-outcome probability (max-prob,
    # whole percent). Mirrored in lib/surfacing-gate.ts — keep in sync.
    SURFACE_FLOOR_FOOTBALL: int = 56   # WC + competitive club (max-prob >= 56)
    SURFACE_FLOOR_FRIENDLY: int = 61   # international friendlies (heavy rotation)
    # CORRECTION (10-year lab 2026-06-08, 44.5k ATP+WTA matches): tennis confidence
    # DOES discriminate — the earlier "no floor" was a 60-match small-sample artifact.
    # Walk-forward held-out: floor 60 -> 70.9% hit (keeps 58.8%), 62 -> 72.1% (52%).
    SURFACE_FLOOR_TENNIS: int = 62     # ATP/WTA (max-prob >= 62); #FLOOR-62 2026-06-09, n=8044 OOS sweep (71.5% hit, 53.4% vol)

    # Why-v2 lead tiers (whole percent on the picked outcome). At/above the
    # surface floor the copy says "favoured but open"; at/above this stronger
    # bar it says "strong pick". Below the floor it says "no clear favourite".
    # Single source for the explanation lead — never hardcode the boundary.
    WHY_STRONG_PICK_CONFIDENCE: int = 65

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
    # Tennis market-blend SHADOW (10y lab 2026-06-08: blending closing odds ~doubles
    # publishable volume at 72% hit). Shadow-only: logs to prediction_log, served
    # model unchanged. Promotion to served = human APPROVE in deploy-gate.
    TENNIS_SHADOW_VERSION: str = "tennis-market-blend-shadow"
    TENNIS_SHADOW_ENABLED: bool = True      # compute + log the shadow A/B
    TENNIS_SHADOW_SERVE_ENABLED: bool = False  # flip ONLY after gate-green + APPROVE

    # Stake/Roobet shadow-eval (#SPORTSBOOK-SHADOW-1). Forward-only A/B: log each
    # served prediction with per-book SHADOW probs (served model re-blended with
    # Stake/Roobet quotes) to sportsbook_shadow_eval, settle forward, decide
    # keep/drop on the numbers (scripts/shadow_eval_report.py). NEVER serves.
    SHADOW_EVAL_ENABLED: bool = True
    SHADOW_EVAL_POLL_INTERVAL: int = 600    # seconds between collect+settle cycles

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

    # World Cup 2026 national-team history loader (Gate 1: national_team_model).
    # CSV is the Kaggle martj42/international-football-results dump, filtered to
    # recent competitive + friendly matches. Quality scales min(1.0, n/20).
    WC_HISTORY_CSV: str = "data/national_teams/international_results_raw.csv"
    WC_HISTORY_SINCE: str = "2018-01-01"          # recency cutoff for relevance
    WC_NATIONAL_MIN_MATCHES_FULL: int = 20        # quality 1.0
    WC_NATIONAL_MIN_MATCHES_SIGNAL: int = 15      # quality 0.75 (signal threshold)
    WC_HISTORY_TOURNAMENTS: List[str] = [
        "FIFA World Cup",
        "FIFA World Cup qualification",
        "Friendly",
        "AFC Asian Cup",
        "AFC Asian Cup qualification",
        "African Cup of Nations",
        "African Cup of Nations qualification",
        "Copa América",
        "UEFA Euro",
        "UEFA Euro qualification",
        "UEFA Nations League",
        "CONCACAF Nations League",
        "CONCACAF Gold Cup",
        "Gold Cup",
        "Confederations Cup",
    ]

    # extra="ignore": the shared .env also holds frontend-only vars (e.g. SESSION_SECRET
    # for the Next.js gating). The Python backend must not choke on env it doesn't own.
    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
