# Gate Delivery — World Cup gates (national_team_model + venue_context)

**Date:** 2026-06-03 · **Owner:** ml-engineer-agentic · **Deadline:** 2026-06-11
**Status:** Built + Verified (paper). **NOT yet wired into the live agents** — that
step is gated on Andrea's APPROVE (see "Remaining / Proposal" below).

---

## What changed vs the brief

| Brief assumption | Reality |
|---|---|
| Download Kaggle CSV | CSV was already present: `data/national_teams/international_results_raw.csv` (49,368 rows, 1872..2026-06). No download needed. |
| `venue_context_quality` target 0.78 | Achieved **1.00** — all 10 context fields populated, not just 8. |
| `historical_depth_quality` target 0.75 | Achieved **1.00** — every WC team has >=20 recent matches (min 62). |
| Estimated total_score ~0.71 | Measured **0.770** on all first-8 fixtures. |
| `build_world_cup_context()` builds venue fields | Venue enrichment is computed in a new pure module and injected via a new `venue_fields=` kwarg; `build_world_cup_context` stays backward-compatible (defaults to None -> monitor_only). |
| WC context is built in `model.py` | It is actually built in `agents/data_collector.py` (line 214). That is the real integration point for venue_fields. |

---

## Gate 1 — national_team_model

New file: `core/world_cup_history.py`
- `load_national_history()` — reads the Kaggle CSV, filters to competitive +
  friendly tournaments since `WC_HISTORY_SINCE` (2018-01-01), returns
  `{home_team, away_team, home_goals, away_goals, date}` rows (6,949 after filter),
  chronologically sorted, `lru_cache`d. Pure (only static-CSV I/O).
- `canonical_team_name()` — maps fixture/API aliases to dataset spelling
  (`USA`->`United States`, `Bosnia & Herzegovina`->`Bosnia and Herzegovina`,
  `Türkiye`->`Turkey`, `Korea Republic`->`South Korea`, `Czechia`->`Czech Republic`, ...).
- `WC2026_TEAMS` — 49-team candidate field used for the coverage gate.

Settings added (`config/settings.py`): `WC_HISTORY_CSV`, `WC_HISTORY_SINCE`,
`WC_NATIONAL_MIN_MATCHES_FULL=20`, `WC_NATIONAL_MIN_MATCHES_SIGNAL=15`,
`WC_HISTORY_TOURNAMENTS`. No thresholds hard-coded in modules.

**Measured:** 49/49 teams reach `data_quality=1.0` (>=0.75 signal threshold), min 62 matches.

## Gate 2 — venue_context

New file: `core/world_cup_venue_context.py`
- Static lookup tables: 18 host-city coords + IANA tz; 49 team capital coords + home tz.
- `haversine_km()` (stdlib `math`, no geopy/new dep), `enrich_venue_context()`
  returns the 6 fields (`rest_days_*`, `travel_distance_km_*`, `timezone_shift_*`).
- `rest_days` = `kickoff.date() - prev_kickoff.date()` (None for a team's first match,
  by design — travel/timezone still resolve).

Modified: `core/world_cup_context.py` — `build_world_cup_context(..., venue_fields=None)`.
When `venue_fields` is supplied the 6 fields are populated and
`data_completeness_score` reaches 1.0 -> `publication_status="context_ready"`.
Default (no venue_fields) is unchanged: monitor_only.

**Measured:** `venue_context_quality=1.00` on first-8 fixtures.

---

## End-to-end verification (real numbers, not estimates)

Script: `scripts/verify_world_cup_gates.py` (run: `venv/bin/python -m scripts.verify_world_cup_gates`).
Reproduces the ModelAgent path. Odds = representative football-data.co.uk closing
line, overround ~5% -> odds_quality 0.85.

```
[OK] Mexico vs South Africa            total=0.770 tier=paper_only hist=1.00 venue=1.00 odds=0.85 fixture=1.00 identity=1.00
[OK] South Korea vs Czech Republic     total=0.770 tier=paper_only ...
[OK] Canada vs Bosnia and Herzegovina  total=0.770 tier=paper_only ...
[OK] United States vs Paraguay         total=0.770 tier=paper_only ...
[OK] Qatar vs Switzerland              total=0.770 tier=paper_only ...
[OK] Brazil vs Morocco                 total=0.770 tier=paper_only ...
[OK] Haiti vs Scotland                 total=0.770 tier=paper_only ...
[OK] Australia vs Turkey               total=0.770 tier=paper_only ...
RESULT: all 8 fixtures reach paper_only — gates closed (paper tier)
```

Score composition at 0.770: fixture 0.20 + odds 0.17 + identity 0.15 + historical 0.15
+ venue 0.10 + squad 0.00 + settlement 0.00. Above the 0.71 paper target.
`squad_news` and `settlement` remain 0 (separate gates) -> `signal_allowed` (>=0.78)
not yet reachable; **paper_only is the launch-functional tier and it is met.**

Tests: `pytest tests/test_world_cup_history.py tests/test_world_cup_team_model.py
tests/test_world_cup_context.py tests/test_world_cup_venue_context.py` -> **13 passed.**

Note: the full `pytest` collection fails on PRE-EXISTING env debt unrelated to this
work (`aiosqlite` missing, `dashboard-web/` duplicate test tree ImportPathMismatch,
a stray env var hitting a non-`config.settings` model). My 4 WC test files pass
cleanly together and in isolation.

---

## Remaining before 2026-06-11 (GATED — needs Andrea APPROVE)

The gate LOGIC is built and verified, but the two live agents are not yet wired,
so the running diagnostics still emit monitor_only. Wiring touches running
LaunchAgent `com.agentic-markets.agents.plist` -> PROPOSAL, no auto-execution:

1. `agents/model.py` bootstrap: populate `self._history["WC"] = load_national_history()`
   and query `matchup_profile(self._history["WC"], canonical_team_name(home),
   canonical_team_name(away))`.
2. `agents/data_collector.py` line 214: compute `enrich_venue_context(...)` (needs a
   per-team last-kickoff registry from the 72-event calendar) and pass `venue_fields=`
   to `build_world_cup_context(...)`.
3. Optional: thread `national_model_ready`/`venue_context_ready` into
   `world_cup_registry.readiness_from_counts` so the heartbeat flips to paper.

Not in scope / still open: `squad_news` and `settlement` gates (needed for
`signal_allowed`), and the per-team last-kickoff registry build from the live
/events feed (rest_days currently uses a 4-day cadence stub in the verify script).
