# Agentic Markets — Data Intelligence Layer
**Date:** 2026-05-28  
**Scope:** Multi-source data ingestion + model maximization (football + tennis)  
**Approach:** DataHub orchestrator + extend existing clients + FeatureAdjuster

---

## Goal

Feed every available free data source into a unified intelligence layer.  
Use that richer data to compute the best possible win probability for every match.  
Tennis gets a working fixture pipeline for the first time.

---

## 1. Architecture Overview

```
External APIs (all free tiers)
  │
  ▼
core/data_hub.py          ← orchestrator, calls all providers in parallel
  │  uses
  ├─ core/football_api_client.py       (extended)
  ├─ core/football_data_org_client.py  (extended)
  ├─ core/odds_api_client.py           (extended)
  ├─ core/tennis_api_client.py         (NEW — RapidAPI Tennis)
  ├─ core/openligadb_client.py         (NEW — free German data)
  ├─ core/football_data_co_uk.py       (NEW — free historical CSVs)
  └─ core/openweathermap_client.py     (extended)
  │
  ▼
core/quota_tracker.py     ← per-provider daily/monthly quota enforcement
  │
  ▼
Supabase (new tables)
  ├─ fixtures_enriched
  ├─ odds_snapshots
  ├─ team_form_cache
  ├─ h2h_records
  ├─ tennis_fixtures
  ├─ tennis_player_form
  └─ source_quota_log
  │
  ▼
agents/ (existing, reads from DB instead of direct API calls)
  │
  ▼
models/feature_adjuster.py  ← NEW: applies probability corrections
  │
  ▼
Final probability → AnalystAgent → edge calculation → publish
```

---

## 2. Data Sources

### 2a. Football — already configured

| Source | Key | Free quota | Data we pull |
|--------|-----|-----------|--------------|
| API-Football | `API_FOOTBALL_KEY` | 100 req/day | Fixtures, standings, form, lineups, injuries, H2H |
| Football-data.org | `FOOTBALL_DATA_ORG_API_KEY` | 10 competitions, 10 req/min | Fixtures, standings, scorers |
| The Odds API | `ODDS_API_KEY` | 500 req/month | Pre-match odds, multiple bookmakers |
| OpenWeatherMap | `OPENWEATHERMAP_API_KEY` | 1000 req/day | Match-day weather at venue |
| PredictionHunt | `PREDICTION_HUNT_API_KEY` | free | Third-party prediction signals |

### 2b. Football — new (free, no key needed)

| Source | Type | Data |
|--------|------|------|
| OpenLigaDB | REST API, no key | Bundesliga 1+2, full history |
| football-data.co.uk | CSV download | Historical results + odds (10+ years, all major leagues) |

### 2c. Tennis — new

| Source | Key | Free quota | Data |
|--------|-----|-----------|------|
| API-Sports Tennis (via RapidAPI) | `RAPIDAPI_KEY` | 100 req/day | ATP/WTA fixtures, results, rankings, H2H |
| Tennis Abstract (Jeff Sackmann) | none | unlimited | Historical CSVs: all ATP/WTA matches 1968+ |

### 2d. Data pulled per match (football)

For every upcoming fixture, the DataHub collects:
- Home/away form: last 10 matches (W/D/L, goals, xG proxy)
- Current league standings (position, points, goal difference)
- H2H record: last 10 meetings in same competition
- Odds from multiple bookmakers (best odds, overround, AH line)
- Lineups/injuries when available (<24h before kickoff)
- Weather: temperature, wind speed, precipitation probability
- Referee stats (foul rate, card rate) — via API-Football

---

## 3. QuotaTracker

`core/quota_tracker.py` — lightweight, persists to Supabase `source_quota_log`.

```
Before every provider call:
  1. Load today's usage for provider
  2. If used >= limit → skip provider, log warning
  3. After call → increment counter
  4. Monthly reset on quota_reset_day (configurable per provider)
```

Priority fallback order per data type:
- Fixtures: API-Football → Football-data.org → OpenLigaDB
- Odds: The Odds API → API-Football (odds endpoint)
- Form/standings: API-Football → Football-data.org
- Tennis fixtures: API-Sports Tennis (RapidAPI) → Tennis Abstract (CSV, no quota)
- Weather: OpenWeatherMap (always, very cheap quota)

---

## 4. DB Schema — New Tables

```sql
-- Canonical enriched fixture (one row per match, updated pre-kickoff)
CREATE TABLE fixtures_enriched (
  match_id          TEXT PRIMARY KEY,
  home_team         TEXT NOT NULL,
  away_team         TEXT NOT NULL,
  kickoff           TIMESTAMPTZ NOT NULL,
  league            TEXT NOT NULL,
  venue             TEXT,
  -- form
  home_form         TEXT,           -- e.g. "WWDLW"
  away_form         TEXT,
  home_ppg          FLOAT,          -- points per game last 10
  away_ppg          FLOAT,
  home_xg_avg       FLOAT,          -- xG per match proxy
  away_xg_avg       FLOAT,
  home_xg_luck      FLOAT,          -- xG luck streak (features.py)
  away_xg_luck      FLOAT,
  -- standings
  home_position     INT,
  away_position     INT,
  total_teams       INT,
  matches_remaining INT,
  home_motivation   FLOAT,          -- motivation_score (features.py)
  away_motivation   FLOAT,
  -- H2H
  h2h_home_wins     INT,
  h2h_draws         INT,
  h2h_away_wins     INT,
  h2h_matches       INT,
  -- lineups/injuries
  home_injuries_json JSONB,
  away_injuries_json JSONB,
  -- weather
  temperature_c     FLOAT,
  wind_kmh          FLOAT,
  precipitation_pct FLOAT,
  -- referee
  referee_name      TEXT,
  referee_foul_rate FLOAT,
  -- metadata
  providers_used    TEXT[],
  last_updated      TIMESTAMPTZ DEFAULT NOW()
);

-- Point-in-time odds from all bookmakers
CREATE TABLE odds_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  match_id         TEXT NOT NULL,
  bookmaker        TEXT NOT NULL,
  source           TEXT NOT NULL,  -- which API
  market           TEXT NOT NULL,  -- h2h, ah, totals
  odds_home        FLOAT,
  odds_draw        FLOAT,
  odds_away        FLOAT,
  ah_line          FLOAT,
  ah_home          FLOAT,
  ah_away          FLOAT,
  overround        FLOAT,
  captured_at      TIMESTAMPTZ DEFAULT NOW(),
  is_closing       BOOLEAN DEFAULT FALSE
);
CREATE INDEX ON odds_snapshots(match_id, captured_at);

-- Tennis upcoming fixtures
CREATE TABLE tennis_fixtures (
  match_id         TEXT PRIMARY KEY,
  player1          TEXT NOT NULL,
  player2          TEXT NOT NULL,
  tournament       TEXT,
  surface          TEXT,
  round            TEXT,
  scheduled_at     TIMESTAMPTZ,
  p1_rank          INT,
  p2_rank          INT,
  p1_rank_points   INT,
  p2_rank_points   INT,
  h2h_p1_wins      INT DEFAULT 0,
  h2h_p2_wins      INT DEFAULT 0,
  h2h_surface_p1   INT DEFAULT 0,
  h2h_surface_p2   INT DEFAULT 0,
  p1_form_json     JSONB,  -- last 10 matches
  p2_form_json     JSONB,
  p1_rest_days     INT,
  p2_rest_days     INT,
  p1_sets_last     INT,
  p2_sets_last     INT,
  provider         TEXT,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);

-- API quota tracking
CREATE TABLE source_quota_log (
  provider         TEXT NOT NULL,
  date             DATE NOT NULL,
  requests_made    INT DEFAULT 0,
  requests_limit   INT,
  last_request_at  TIMESTAMPTZ,
  PRIMARY KEY (provider, date)
);
```

---

## 5. FeatureAdjuster — Probability Correction Pipeline

`models/feature_adjuster.py`

Takes DC raw probabilities `(p_home, p_draw, p_away)` + enriched fixture → returns adjusted probabilities.

### Adjustment chain (applied in order, multiplicative then renormalized)

```
1. Form multiplier
   - Compare home_ppg vs away_ppg over last 10 matches
   - If home_ppg >> away_ppg: boost p_home slightly, dampen p_away
   - Max adjustment: ±4%

2. xG luck correction
   - If home_xg_luck > 0.3 (scoring less than deserved): boost home by luck × 0.05
   - Symmetric for away
   - Max adjustment: ±3%

3. Motivation adjustment
   - High motivation (title/relegation fight, 0.8+): no change
   - Low motivation (mid-table deadrubber, 0.2): dampen edge signals
   - Applied as confidence weight on final edge, not probability itself

4. H2H record
   - If strong H2H dominance (>70% win rate over 6+ meetings): +1.5% to dominant side
   - Only applied when H2H sample >= 4 matches

5. Weather suppression
   - High wind (>40 km/h) or heavy rain: reduce lambda by 8% → goals suppressed
   - Affects both DC lambda_home and lambda_away before probability calculation
   - Implemented as pre-compute lambda modifier, not post-hoc probability shift

6. Injury impact
   - Key player missing (starter, high minutes): -2% on affected side's win probability
   - Uses API-Football lineup/injury data, only applied <24h before kickoff

7. AH line movement signal
   - If AH line moved >0.25 in favor of one side in last 4h: flag as sharp signal
   - Implemented as a multiplier on edge confidence (not raw probability)
   - Does not change probabilities — informs minimum edge threshold only
```

### Output
```python
@dataclass
class AdjustedProbabilities:
    p_home: float
    p_draw: float
    p_away: float
    adjustments_applied: list[str]   # which adjustments fired
    confidence_weight: float          # 0.5-1.0, affects edge threshold
    adjustment_detail: dict           # full breakdown for audit
```

---

## 6. Football Client Extensions

### `core/football_api_client.py` additions
- `get_standings(league_id, season)` → team positions, points, matches remaining
- `get_team_form(team_id, last_n=10)` → last N results with goals
- `get_h2h(team1_id, team2_id)` → historical meetings
- `get_injuries(fixture_id)` → player injury list
- `get_referee(fixture_id)` → referee name + stats

### `core/odds_api_client.py` additions
- `get_multi_bookmaker_odds(match_id)` → odds from all available bookmakers
- `get_ah_odds(match_id)` → Asian Handicap line + prices
- `snapshot_and_store(match_id)` → write to `odds_snapshots` table

### `core/football_data_org_client.py` additions
- `get_standings(competition_code)` → league table

### New: `core/openligadb_client.py`
- Free REST API, no key
- `get_fixtures(league, season)` → Bundesliga 1+2 fixtures + results
- `get_table(league, season)` → standings

### New: `core/football_data_co_uk.py`
- Downloads free CSV from football-data.co.uk
- Parses historical results + closing odds (used for CLV calculation)
- Runs once at startup + weekly refresh
- Loads into `historical_odds_csv` table (new)

### New: `core/tennis_api_client.py`
- Via `RAPIDAPI_KEY` → API-Sports Tennis endpoint
- `get_upcoming_fixtures(days_ahead=7)` → ATP/WTA matches next 7 days
- `get_player_stats(player_id)` → ranking, recent form, surface stats
- `get_h2h(p1_id, p2_id)` → head-to-head history
- Normalizes player names to match Elo rating keys

---

## 7. Agent Changes

### `agents/data_collector.py`
- Instantiates `DataHub` at startup
- Calls `hub.collect_all_fixtures()` per cycle instead of individual API calls
- Reads enriched data from Supabase `fixtures_enriched` table
- Passes `world_cup_context` + enrichment bundle to model pipeline

### `agents/model.py`
- After DC probability calculation, calls `FeatureAdjuster.adjust(dc_probs, fixture_enrichment)`
- Logs `adjustment_detail` in heartbeat for audit
- Passes `confidence_weight` to AnalystAgent via Redis message

### `agents/analyst.py`
- Reads `confidence_weight` from model output
- Multiplies effective edge threshold: `effective_min_edge = MIN_EDGE / confidence_weight`
- High confidence → easier to meet edge. Low confidence → requires larger edge.

### `agents/tennis_data_collector.py`
- Replaced Matchbook-only with `TennisAPIClient` (RapidAPI)
- Fetches upcoming fixtures → writes to `tennis_fixtures` table
- Falls back to CSV cache when quota exhausted

### `agents/tennis_model_agent.py`
- Reads from `tennis_fixtures` instead of Redis market data
- Passes H2H, rest days, form to EloSurfaceModel
- Publishes to `tennis_predictions` table

---

## 8. Tennis Model Improvements

On top of fixing the data source, improve the Elo model itself:

1. **H2H surface adjustment** — if player A has 4-0 H2H on clay specifically, add a flat +2% boost beyond what Elo predicts
2. **Recent form streak** — last 5 matches win rate, weighted exponentially. Elo is slow to react to hot/cold streaks.
3. **Tournament importance weight** — Grand Slam vs 250: adjust K-factor when updating ratings
4. **Round fatigue** — deeper in tournament = more sets played = more fatigue (FatigueAdjustment already exists, wire it with real data from tennis_fixtures)
5. **Rank-based guard** — if rank difference > 200 and not a Grand Slam: skip prediction (too unpredictable)

---

## 9. Implementation Scope & Order

**Phase 1 — DB + QuotaTracker + client extensions (day 1)**
1. Add new Supabase tables (migration SQL)
2. `core/quota_tracker.py`
3. Extend `football_api_client.py` (standings, form, H2H)
4. Extend `odds_api_client.py` (multi-bookmaker, AH)
5. `core/openligadb_client.py` (no key, free)
6. `core/football_data_co_uk.py` (CSV loader)

**Phase 2 — DataHub + collector update (day 2)**
7. `core/data_hub.py`
8. Update `agents/data_collector.py` to use DataHub
9. Verify fixtures_enriched fills correctly

**Phase 3 — FeatureAdjuster + model wiring (day 2-3)**
10. `models/feature_adjuster.py`
11. Update `agents/model.py` to apply adjuster
12. Update `agents/analyst.py` to use confidence_weight

**Phase 4 — Tennis pipeline (day 3)**
13. `core/tennis_api_client.py` (RapidAPI)
14. Update `agents/tennis_data_collector.py`
15. Update `agents/tennis_model_agent.py`
16. Tennis model improvements (H2H, form streak, rank guard)

---

## 10. Success Criteria

- `fixtures_enriched` fills with data every collection cycle
- `odds_snapshots` has multi-bookmaker data per match
- `tennis_fixtures` has ATP/WTA matches 7 days ahead
- Football predictions show `adjustments_applied` in heartbeat
- Tennis predictions appear in `tennis_predictions` table
- No fallback/placeholder data anywhere in production
