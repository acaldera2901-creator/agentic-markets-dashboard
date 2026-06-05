# Tennis Live V4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the live tennis prediction workflow closer to the strongest backtested logic by adding serve/return form, reliability, market odds, and auditable feature snapshots.

**Architecture:** Add a focused `core.tennis_features` module that computes pre-match player features from cached Jeff Sackmann ATP/WTA history. `TennisModelAgent` enriches live fixtures with those features, adjusts Elo probabilities conservatively, computes odds edge, and persists feature fields to Supabase. The public tennis API exposes the new explanation fields without changing the main UI shape.

**Tech Stack:** Python agents/core, pytest, Supabase SQL migrations, Next.js route adapters.

---

### Task 1: Tennis Feature Layer

**Files:**
- Create: `core/tennis_features.py`
- Test: `tests/test_tennis_features.py`

- [ ] **Step 1: Write failing tests**

```python
from core.tennis_data import TennisMatch
from core.tennis_features import TennisFeatureStore

def test_feature_store_uses_only_matches_before_fixture_date():
    store = TennisFeatureStore.from_matches([
        TennisMatch(date=date(2026, 1, 1), tour="atp", surface="Hard", winner="A", loser="B", best_of=3, winner_rank=10, loser_rank=20, minutes=90, w_svpt=60, w_1st_won=35, w_2nd_won=10, l_svpt=60, l_1st_won=25, l_2nd_won=8),
        TennisMatch(date=date(2026, 2, 1), tour="atp", surface="Hard", winner="B", loser="A", best_of=3, winner_rank=20, loser_rank=10, minutes=90, w_svpt=60, w_1st_won=40, w_2nd_won=10, l_svpt=60, l_1st_won=20, l_2nd_won=5),
    ], cutoff=date(2026, 1, 15))
    assert store.player_features("A", "hard").serve_form > store.player_features("B", "hard").serve_form
```

- [ ] **Step 2: Run red**

Run: `.venv/bin/python -m pytest tests/test_tennis_features.py -q`
Expected: FAIL because `core.tennis_features` does not exist.

- [ ] **Step 3: Implement minimal module**

Create immutable `TennisPlayerFeatures` and `TennisFeatureStore` with `from_cache`, `from_matches`, and `match_context`.

- [ ] **Step 4: Run green**

Run: `.venv/bin/python -m pytest tests/test_tennis_features.py -q`
Expected: PASS.

### Task 2: Agent V4 Scoring

**Files:**
- Modify: `agents/tennis_model_agent.py`
- Test: `tests/test_tennis_model_agent_v4.py`

- [ ] **Step 1: Write failing tests**

Test that `_score_fixture` returns `serve_form_p1`, `return_form_p1`, `feature_quality`, `odds_p1`, `odds_p2`, `edge`, and `best_selection` when fixture odds and feature store are available.

- [ ] **Step 2: Run red**

Run: `.venv/bin/python -m pytest tests/test_tennis_model_agent_v4.py -q`
Expected: FAIL because fields are missing.

- [ ] **Step 3: Implement minimal agent integration**

Load `TennisFeatureStore.from_cache()` at agent startup and lazily before scoring. Apply a capped probability adjustment from serve/return differential and reliability.

- [ ] **Step 4: Run green**

Run: `.venv/bin/python -m pytest tests/test_tennis_model_agent_v4.py -q`
Expected: PASS.

### Task 3: Supabase Schema

**Files:**
- Create: `supabase/migrations/20260604000000_tennis_live_v4.sql`
- Modify: `docs/supabase_schema.sql`

- [ ] **Step 1: Add nullable feature columns**

Add columns to `tennis_fixtures` and `tennis_predictions` for odds, feature quality, serve/return form, rank points, H2H, rest, sets load, and `feature_snapshot`.

- [ ] **Step 2: Verify SQL syntax**

Run a local static sanity check with `rg` and ensure migration is idempotent with `ADD COLUMN IF NOT EXISTS`.

### Task 4: API and UI Exposure

**Files:**
- Modify: `app/api/tennis/route.ts`
- Modify: `lib/tennis-adapter.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Include feature fields in tennis API queries**

Expose new fields but keep locked projection compatible.

- [ ] **Step 2: Add concise explanation strings**

Surface serve/return form, feature quality, and odds edge in existing detail cards.

- [ ] **Step 3: Verify**

Run: `npm run lint`, `npm run build`, `.venv/bin/python -m pytest tests/test_tennis*.py -q`.

### Task 5: Documentation

**Files:**
- Modify: `reports/data_sources_deep_research_2026-06-04.md`

- [ ] **Step 1: Append tennis live v4 notes**

Document implemented features, remaining paid/live dependencies, and verification results.
