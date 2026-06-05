# World Cup Wing — Design

**Date:** 2026-06-05
**Author:** michele-claude (design approved by Michele; brainstorm session Michele-side)
**Status:** PROPOSAL — for Andrea review via Council thread `2026-06-06-world-cup-wing`
**Mode:** patch-for-review (branches `michele/wc-*`), NO deploy Michele-side. All deploys = Andrea (Approval Gate + Deploy Gate).
**Cost:** zero new spend — ESPN free + already-approved Scenario C (AM-API-001, Odds API 100K + API-Football Pro).

## Context

Kickoff is 2026-06-11. The WC engine is already shipped and live (registry, national team model, Poisson 1X2 `wc-poisson-rates-v1`, data-quality scoring, venue context, paper writer @ `7d0b44d`, squad_news gate 48/48 via ESPN). The honest gaps this design closes:

1. **Squad reveals are not persisted.** `core/espn_soccer_client.py` keeps rosters in a 6h in-process cache, only to compute the `squad_news` gate. Official 26-man lists are being announced NOW; who was added/cut and when is unrecoverable later. No `wc_squads` tables exist.
2. **No public World Cup surface.** The site is a single board (`app/page.tsx`); there is no `/world-cup` page, no groups/calendar/teams view, no WC-filtered track record.
3. **No standings.** No table, no provider gives them free; they must be computed from settled results.

Product decisions already taken Michele-side (this design implements them):
- **Full wing, two parallel tracks** (data + site), model work third.
- **Hub open, picks gated:** groups/calendar/squads/countdown/hit-rate public; selection/edge of WC predictions stay blurred with register CTA, exactly like the existing board. Hit-rate-only product line untouched.
- **Push/deploy is Andrea's.** Michele-side delivers reviewed branches.

## Track A — Squad Intelligence (convocazioni)

### A1. Tables — `db/migrations/00X_wc_squads.sql` (number assigned at implementation, next free slot)

```sql
CREATE TABLE wc_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,          -- canonical_team_name() spelling
  team_id_espn TEXT,
  squad_size INT,
  injured_count INT,
  source TEXT NOT NULL DEFAULT 'espn',   -- 'espn' | 'api-football'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_canonical, source)
);

CREATE TABLE wc_squad_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES wc_squads(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  position TEXT,
  is_injured BOOLEAN NOT NULL DEFAULT FALSE,
  shirt_number INT,                      -- API-Football only (NULL from ESPN)
  club_team TEXT,                        -- API-Football only
  age INT,                               -- API-Football only
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (squad_id, player_name)
);

CREATE TABLE wc_squad_snapshots (        -- append-only reveal history
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,
  source TEXT NOT NULL,
  roster_hash TEXT NOT NULL,             -- sha256 of normalized roster
  roster JSONB NOT NULL,                 -- full player list at capture time
  diff JSONB,                            -- {added:[], removed:[], injury_changes:[]} vs previous snapshot
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wcss_team_time ON wc_squad_snapshots (team_canonical, captured_at DESC);
```

Snapshot rows are written **only when `roster_hash` changes** — table stays small (48 teams × a handful of reveal events).

### A2. Sync module — `core/wc_squad_sync.py`

- Input: existing `espn_soccer_client` output (48 teams → rosters); optional enrichment from API-Football `/squads` (player number, club, age) once the Pro key is live — enrichment is additive, never blocking.
- Normalizes team names via existing `canonical_team_name()` (`core/world_cup_history.py:73`).
- Upserts `wc_squads` + `wc_squad_players` (current state); appends `wc_squad_snapshots` with computed diff when hash changed.
- **Uniform rows with explicit NULLs** on every bulk upsert (lesson from the P1/P3 PostgREST silent-reject bugs).
- **Fail-soft:** any Supabase/API error logs and returns; never breaks the collector cycle.

### A3. Collector hook — `agents/data_collector.py`

~5 lines where `squad_coverage` is already computed (around `data_collector.py:209-213`): pass the fetched rosters to `wc_squad_sync.sync_rosters(...)`. Same pattern as the approved P1/P3 wiring. No new gate; `squad_news` logic untouched.

### A4. One-shot backfill — `scripts/backfill_wc_squads.py`

Runs the same sync module standalone to capture the current 48 rosters **immediately**, before the collector patch is deployed. Mirrors `scripts/verify_world_cup_gates.py` conventions. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in env.

> **Open question for Andrea (time-sensitive):** either share a scoped service key Michele-side, or run `python -m scripts.backfill_wc_squads` yourself right after migration — one command. Every day of delay loses reveal events.

### A5. Out of scope (honesty boundary)

Injury reason, recovery timelines, press rumors: no provider gives these structured. They remain in the existing `team_news_summary` field (manual/admin). **No scraping** 6 days before kickoff.

## Track B — `/world-cup` public hub

### B1. Page — `app/world-cup/page.tsx` + `components/world-cup/`

New surface beside the existing monolith (`app/page.tsx` is NOT restructured; only a nav link is added):

| Section | Source | Notes |
|---|---|---|
| Hero + countdown | static kickoff date | post-kickoff becomes "today's matches" |
| Groups A–L (12 groups) | `wc_group_standings` (computed) | pre-kickoff: 48 teams at 0 pts from registry |
| Calendar (104 fixtures) | existing fixture feed tables | stage/group/venue from `world_cup_venue_context.py` data |
| Teams & Convocazioni | `wc_squads` / `wc_squad_players` / snapshots | reveal timeline: "in: X, out: Y" — differentiating content |
| WC predictions board | `/api/v2/predictions?competition=World Cup` | existing per-card blur + CTA, existing publication gate; zero new gate logic |
| WC track record | `/api/v2/history` filtered | hit-rate only, no money fields |

### B2. API routes — `app/api/world-cup/{squads,fixtures,standings}/route.ts`

Public, read-only, parametrized SQL, no money fields, no gated data. Standings computed from settled results (settlement writer already runs every 5 min); pre-kickoff returns groups with zeroed rows.

Track B ships its own migration `00X_wc_group_standings.sql`:

```sql
CREATE TABLE wc_group_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,              -- 'A'..'L' (12 groups, 48 teams)
  team_canonical TEXT NOT NULL,
  played INT NOT NULL DEFAULT 0, won INT NOT NULL DEFAULT 0,
  drawn INT NOT NULL DEFAULT 0, lost INT NOT NULL DEFAULT 0,
  goals_for INT NOT NULL DEFAULT 0, goals_against INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0, position INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_name, team_canonical)
);
```

Recomputed idempotently from settled results on each settlement cycle (or on-read if Andrea prefers no writer extension).

### B3. Team pages — `app/world-cup/[team]/page.tsx`

48 static pages, ISR revalidate 1h: full roster, injuries, next fixtures. Rationale: SEO ("convocati <team> mondiali 2026") — free acquisition during the tournament, converting to the gated board.

### B4. Board empty-state (closes P6)

Honest empty-state on the main board when 0 signals pre-filters: countdown + "first signals when markets open — World Cup from June 11". Implements the P6 proposal already on the Council table.

## Track C — National model (data quality + proposal only)

The served model is Andrea's territory (xG V4 just shipped). Michele-side delivers:

1. **History dataset freshness check:** verify the Kaggle CSV (`WC_HISTORY_CSV`) includes the latest pre-tournament friendlies; propose refresh if stale. Recent form is the highest-value signal right now.
2. **Alias audit test:** automated test crossing the 48 registry teams against `_TEAM_ALIASES` + ESPN/API-Football/Odds-API spellings. A name mismatch silently costs odds matching (0.65 fuzzy threshold) or a team profile.
3. **Squad-strength adjustment — PROPOSAL only:** with Track A data, absence weighting becomes possible (FeatureAdjuster-style, e.g. "3 starters out" → probability adjustment). Post-kickoff, Andrea's call, separate Council decision. Does NOT block 2026-06-11.

## Testing

- pytest for `wc_squad_sync` (hash/diff logic, uniform-row invariant, fail-soft) following `tests/test_wc_paper_writer.py` conventions.
- TS tests for the three API routes (shape, no-money-fields invariant) + tsc clean.
- Existing 655 tests stay green; no behavior change to gates, model, or publication path.

## Rollout & timeline (proposed)

| When | What | Owner |
|---|---|---|
| 06-05 | This design → Council | michele-claude |
| 06-06 | Track A branch (migration + sync + backfill script) ready for review; **backfill run ASAP after approval** | Michele-side / Andrea runs backfill |
| 06-07/08 | Track B branch (`/world-cup` hub + API routes + P6 empty-state) | Michele-side |
| 06-09/10 | Review + deploy window (Vercel + agents restart) | **Andrea** |
| 06-11 | Kickoff: hub live, reveals historicized, paper tier active | — |

## Open questions for Andrea

1. Backfill execution: scoped service key Michele-side, or you run it post-migration? (time-sensitive)
2. API-Football Pro key (Scenario C): when live in runtime env? Enrichment activates automatically.
3. Standings from settled results vs. dedicated provider — confirm computed approach.
4. Track B visibility confirmed as "hub open / picks gated" (consistent with current product line) — veto if you see it differently.
