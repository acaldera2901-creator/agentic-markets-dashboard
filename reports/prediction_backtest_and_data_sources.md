# Prediction Backtest & Live Data Roadmap

Generated: 2026-06-04

## Executive Verdict

The current evidence says:

- Tennis winner prediction is the strongest area. The ATP model reaches 64.59% out-of-sample accuracy on 5,456 held-out matches.
- Football live Poisson v1 is not strong enough as the main prediction engine. On 6,829 held-out football matches, it reaches 51.37% argmax accuracy, while the market favorite reaches 54.33%.
- Football improves materially when we add xG/form features. The Understat xG stack reaches 53.32% accuracy and Brier 0.58236, much better than plain Poisson but still slightly below the market reference.
- The live production workflow must preserve prediction snapshots before kickoff. Without this, we cannot honestly audit whether current live predictions are correct.

## Football Backtest

Dataset:

- football-data.co.uk cached CSVs
- Leagues: Premier League, Bundesliga, Serie A, La Liga, Ligue 1
- Years: 2021-2024
- Evaluation: walk-forward, no lookahead, 60-match warmup per league
- Total evaluated matches: 6,829

### Live-Like Poisson v1 vs Market Favorite

| Metric | Poisson v1 | Market favorite |
| --- | ---: | ---: |
| Argmax accuracy | 51.37% | 54.33% |
| 95% CI | 50.18%-52.55% | 53.14%-55.51% |
| Brier | 0.59944 | 0.57493 |
| Log loss | 1.00361 | 0.96706 |
| ECE | 0.01896 | 0.01342 |

By model pick:

| Pick | N | Accuracy |
| --- | ---: | ---: |
| Home | 4,483 | 52.84% |
| Draw | 23 | 34.78% |
| Away | 2,323 | 48.69% |

Interpretation:

The current football live-like Poisson logic should not be treated as a strong standalone predictor. It is directionally useful, but the market favorite beats it clearly on accuracy and calibration.

## Football xG Backtest

Dataset:

- Understat cached data
- Top European leagues, 2021-2024
- Evaluation: walk-forward, second half held out
- Total evaluated matches: 3,415

| Model | Accuracy | Brier | Log loss | ECE |
| --- | ---: | ---: | ---: | ---: |
| Poisson only | 52.71% | 0.59348 | 0.99523 | 0.01572 |
| Poisson + Pi + form | 52.59% | 0.58921 | 0.98818 | 0.02306 |
| Poisson + Pi + form + xG | 53.32% | 0.58236 | 0.97762 | 0.00931 |
| + npxG + PPDA | 53.29% | 0.58233 | 0.97732 | 0.00796 |

Interpretation:

xG is the most important football upgrade we currently have evidence for. It improves both accuracy and calibration. The live football engine should move away from plain Poisson and toward the xG stack.

## Tennis Backtest

Dataset:

- Jeff Sackmann ATP cached CSVs
- Years: 2021-2024
- Evaluation: walk-forward, no lookahead, second half held out
- Total evaluated matches: 5,456

| Model | Accuracy | Brier | ECE |
| --- | ---: | ---: | ---: |
| Rank baseline | 63.45% | n/a | n/a |
| Surface Elo | 63.27% | 0.21959 | 0.01620 |
| Elo + rank + serve/return + fatigue + H2H | 64.59% | 0.21749 | 0.03452 |

Feature influence:

| Feature | Absolute coefficient |
| --- | ---: |
| Surface Elo diff | 0.5212 |
| Rank diff | 0.4330 |
| Serve diff | 0.2192 |
| Return diff | 0.0939 |
| Fatigue 14d | 0.0818 |
| H2H | 0.0309 |

Interpretation:

Tennis is the strongest prediction vertical. It is not magic, but it has a credible winner-prediction signal. The next step is making the live tennis workflow match the backtested feature set and saving settled outcomes.

## Live Workflow Requirements

Every live prediction must write a pre-match immutable snapshot:

- sport
- event id
- teams/players
- kickoff/scheduled time
- model version
- feature version
- p_home/p_draw/p_away or p1/p2
- argmax pick
- value pick, if different from argmax
- market odds used
- data sources used
- published_at timestamp
- result/winner after settlement
- settled_at timestamp

This table is the source of truth for accuracy.

Recommended table name:

`prediction_snapshots`

## Data Sources To Add Live

### Football

Priority 1:

- Fixture and basic results: football-data.org v4, already partly integrated.
- Odds: The Odds API or direct exchange/bookmaker source.
- xG/team xG: Sportmonks xG or an internal Understat/FBref-like collector.

Priority 2:

- Expected lineups
- Confirmed lineups
- Injuries/suspensions
- Team news
- Player availability
- Rest days and fixture congestion
- Travel distance
- Weather

Suggested providers:

- football-data.org: competitions, matches, teams, standings.
- The Odds API: pre-match/live odds by sport and bookmaker.
- API-Football/API-Sports: fixtures, odds, injuries, lineups.
- Sportmonks: fixture includes, xG, expected lineups, sidelined players, odds, predictions, weather and advanced fixture entities.

### Tennis

Priority 1:

- ATP + WTA historical match data.
- Live fixtures.
- Live rankings.
- Odds for P1/P2 moneyline.
- Result settlement.

Priority 2:

- Surface-specific hold/break stats.
- Recent serve/return form.
- Rest days and recent match load.
- H2H, but low weight.
- Indoor/outdoor and tournament altitude where available.
- WTA dataset, currently missing locally.

Suggested providers:

- Jeff Sackmann tennis_atp and tennis_wta for historical model training.
- tennis-data.co.uk for historical tennis results and betting odds.
- Tennis API / MatchStat for live ATP/WTA/ITF fixtures, players, H2H and rankings.
- Odds API providers for live P1/P2 tennis odds.

## Implementation Order

1. Add immutable `prediction_snapshots`.
2. Wire live football to the xG stack instead of plain Poisson.
3. Add tennis settlement so live accuracy becomes measurable.
4. Add WTA historical data to backtest the women’s tour.
5. Add odds snapshots for both football and tennis.
6. Add source-quality flags: stale odds, missing xG, missing lineup, rank mismatch, insufficient player surface sample.
7. Re-run this report weekly and expose accuracy in admin.

## Bottom Line

Tennis is currently the best candidate for go-to-market prediction accuracy.

Football should be repositioned as calibrated probability research until the live xG stack and snapshot audit are implemented. Plain Poisson alone is not good enough.
