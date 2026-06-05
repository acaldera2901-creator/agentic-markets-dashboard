# Agentic Markets Data Sources Deep Research

Generated: 2026-06-04

## Executive Summary

Tennis was capped at 2024 because the local cache only contained `data/tennis/atp_2021.csv` through `data/tennis/atp_2024.csv`, and the standalone tennis backtest hardcoded those years. The source loader already supported ATP and WTA generically, so the bottleneck was workflow/configuration, not data availability.

Implemented now:

- Added `scripts/sync_historical_data_sources.py` to sync historical ATP/WTA and football-data.co.uk CSVs up to the current year.
- Downloaded ATP 2021-2026 and WTA 2021-2026 from Jeff Sackmann.
- Downloaded football-data.co.uk 2021/22 through 2025/26 for PL, Bundesliga, Serie A, La Liga, Ligue 1.
- Updated `scripts/comprehensive_prediction_backtest.py` to discover cached files automatically.
- Updated `scripts/backtest_tennis.py` to evaluate both ATP and WTA using all cached years.

## Current Local Dataset Inventory

| Area | Source | Local path | Current coverage after sync | Role |
| --- | --- | --- | --- | --- |
| Tennis results/stats | Jeff Sackmann ATP/WTA | `data/tennis/*.csv` | ATP/WTA 2021-2026 | Historical model training and backtest |
| Football results/odds | football-data.co.uk | `data/football_data_uk/*.csv` | 5 leagues, 2021/22-2025/26 | Historical 1X2, closing odds, market benchmark |
| Football xG | Understat cache | `data/understat/*.csv` | 5 leagues, 2021-2024 | xG/npxG/PPDA model features |
| National teams | Local raw CSV | `data/national_teams/international_results_raw.csv` | static local file | World Cup/team context |
| Live football fixtures | API-Football, football-data.org, OpenLigaDB | `core/data_hub.py` clients | key-dependent/live | Fixture enrichment |
| Live tennis fixtures | API-Sports Tennis via RapidAPI, ESPN fallback | `core/tennis_api_client.py`, `core/espn_tennis_client.py` | key-dependent/live | Upcoming tennis slate |
| Live odds | The Odds API | `core/odds_api_client.py`, `lib/odds-api.ts` | key-dependent/live | Multi-bookmaker market line |

## Sync Results

`scripts/sync_historical_data_sources.py --from-year 2021 --to-year 2026`

- Synced files: 37
- Synced rows: 39,538
- Tennis: 12 files, 30,631 rows
- Football-data.co.uk: 25 files, 8,907 rows
- Football season 2026/27 returned HTTP 404 for all tracked leagues, as expected before the new season CSVs exist.

## Accuracy Snapshot After Expansion

Latest report: `reports/prediction_backtest_latest.json`

Football Poisson v1 on football-data.co.uk cached seasons:

- Evaluated: 8,575 matches
- Model argmax accuracy: 51.22%
- Market favorite accuracy: 54.17%
- Away picks: 48.22%

Football xG model on Understat cache:

- Best model: Poisson + Pi/form + xG + npxG/PPDA
- Held-out accuracy: 53.29%
- Brier: 0.58233

Tennis, per-tour:

- ATP stack model: 7,589 held-out matches, 64.94% accuracy, Brier 0.21786
- WTA stack model: 6,927 held-out matches, 65.34% accuracy, Brier 0.21427

## Source Assessment

Priority 1, already implemented:

- Jeff Sackmann ATP/WTA. Best free historical tennis base. It includes current-year files and rich match stats. Good for training/backtesting, not real-time fixtures.
- football-data.co.uk. Strong free football historical base with CSV/Excel files and betting odds, updated at least twice weekly by the provider.

Priority 2, already partially wired and should be operationalized:

- The Odds API. Use for live/upcoming bookmaker odds, event IDs, participants, and, on paid plans, historical odds snapshots. We should persist `odds_snapshots` aggressively because odds history is the real calibration layer.
- API-Football/API-Sports. Use for fixtures, status, H2H, lineups, injuries, standings and broad live coverage.
- football-data.org. Good fallback for fixtures, scores, competitions, and head-to-head.
- OpenLigaDB. Good free fallback for German competitions.

Priority 3, recommended additions:

- Sportmonks Football API. Useful if we need deeper commercial-grade coverage, live events, stats, odds modules and World Cup/league robustness. This is a paid/provider decision.
- Paid historical odds provider. Needed if we want serious pre-close CLV and tennis odds history without building it ourselves from today onward.

## Next Implementation Notes

1. Schedule `scripts.sync_historical_data_sources` daily or weekly for historical refresh.
2. Add an odds snapshot cron/job every 10-30 minutes during active fixture windows.
3. Add settlement jobs that write final outcomes for both football and tennis predictions.
4. Add a data provenance field to every prediction: source versions, captured odds timestamp, feature snapshot timestamp.
5. Extend Understat sync to 2025/26 or replace it with a provider that gives official xG/team stats via API.

The current model quality is not yet enough to claim market-beating accuracy, especially in football where the market favorite still beats the local Poisson baseline. Tennis looks healthier as a pure winner-prediction model, but still needs live odds and settled prediction snapshots to prove real product accuracy.

## Tennis Live V4 Implementation Update

Implemented after the data-source review:

- Added `core/tennis_features.py`, a point-in-time feature store built from Jeff Sackmann ATP/WTA cache.
- Added serve/return form, surface sample reliability, rest days, recent 14-day match load, and H2H context to live tennis scoring.
- Added `core/tennis_odds_api_client.py` for The Odds API tennis moneyline odds.
- Updated `core/data_hub.py` so tennis fixtures are enriched with odds before being written to Supabase when `ODDS_API_KEY` is available.
- Updated `agents/tennis_model_agent.py` to model version `elo_surface_v4_features_odds`.
- Applied Supabase migration `20260604000000_tennis_live_v4.sql` to add tennis feature and odds columns.
- Updated `/api/tennis`, the main UI tennis reasons, and the unified tennis adapter to expose v4 fields.

Verification:

- `pytest tests/test_tennis*.py -q`
- `python -m py_compile core/tennis_features.py core/tennis_odds_api_client.py core/data_hub.py agents/tennis_model_agent.py core/db.py`
- `npm run lint`
- `npm run build`

## Football Live V4 Implementation Update

Implemented after the football gap review:

- Added `core/football_features.py`, a point-in-time feature store built from cached Understat match data.
- Added rolling xG, xGA, npxG, npxGA, PPDA, form PPG, xG luck, rest days, recent congestion, match sample counts, feature quality and an auditable feature snapshot.
- Updated `agents/data_collector.py` so non-World-Cup football events published to `market:data` carry real feature fields instead of leaving the model adjuster on defaults.
- Updated `agents/model.py` so downstream probability events include `model_version=football_live_v4_xg_features`, feature quality, feature snapshot and the key xG/rest/congestion fields.
- Updated `/api/predictions` enrichment to expose PPDA from Understat for premium projections while preserving the existing access gating.
- Updated `lib/unified-adapter.ts` to tag synced football rows as `football-live-v4-xg-market` and explain the signal as Football Live V4, not plain Poisson.

Verification:

- `pytest tests/test_football_features.py tests/test_data_collector_football_features.py tests/test_feature_adjuster.py tests/test_match_features.py tests/test_xg_model.py -q`

## Commercial Go-Live Packaging Update

Implemented after the go-live readiness review:

- Public offer simplified to Free + one paid plan: `Signal Desk Pro`.
- Public paid plan remains stored as `base` internally to avoid DB/API enum churn.
- Price set to `49.50 USDT/month` on TRC20 checkout.
- Public copy no longer sells automated execution, exchange linking, or guaranteed ROI.
- Paid users now receive the advanced prediction enrichment that used to be premium-only.
- Best Bets now falls back to `Top Model Signals` when no real +EV markets are active, so the section stays useful without inventing edge.

Verification:

- `npx tsx scripts/verify-commercial-plan.ts`
- `npx tsx scripts/verify-best-bets.ts`
- `npx tsx scripts/verify-projection.ts`
- `npm run lint`
- `npm run build`
