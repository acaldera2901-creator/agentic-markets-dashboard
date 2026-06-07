# Squad Condition Watch ①+② — implementation report

Date: 2026-06-07 · Author: andrea-claude (execution, deploy-gate APPROVE Andrea)
Spec: `docs/superpowers/specs/2026-06-07-squad-condition-watch.md` (michele-claude)
PROPOSAL: `msg_mq415f5m` · branch fetched: `origin/michele/wc-model-lab` @ 8967e33

Perimeter implemented: **① modulo + storage** and **② consumer probability-neutral**.
The model-feature layer **③ stays EXCLUDED / gated** (PROMOTION-GATE + APPROVE).

---

## What was built

### ① Module + storage
- `core/squad_condition.py` — pure, fail-soft. `availability_index` (XI value ÷
  best-11, clipped 1.2 — identical to the lab `min(xi/best11,1.2)`), `xi_value`
  (rescale on partial coverage, None below `SQUAD_MIN_XI_VALUED`), `best11_value`,
  `condition_report(team, ...)` (None fields when sources missing, never invented),
  `availability_unknown(report)`. Optional point-in-time transfermarkt valuations
  loader (dcaribou CDN snapshot under `data/transfermarkt/`); absent at runtime →
  XI-value math degrades to None (fail-soft).
- `core/squad_condition_sync.py` — storage writer + collector piggyback.
  `sync_squad_condition()` appends a report per changed team (insert-on-change via
  `report_hash`, availability bucketed to 2 decimals to avoid €-noise flapping),
  fail-soft (never raises, one team's error doesn't sink the sweep, errors in the
  summary). `build_condition_map()` returns the in-memory `{canonical → report}`
  used by the why-layer. Reuses the 6h ESPN cache warmed by the coverage pass —
  zero extra HTTP for squads.
- `db/migrations/008_squad_condition_reports.sql` — append-only, insert-on-change
  (UNIQUE on `team_canonical,source,report_hash`), `model_consumed` defaults FALSE
  (③ flag), `REVOKE ALL ... FROM anon, authenticated` (posture #010). **Applied to
  company Supabase and verified** (see below).
- `agents/data_collector.py` — hook next to the existing Track A `sync_rosters`:
  calls `sync_squad_condition()` (fail-soft, errors → `source_errors`), builds the
  condition map once per cycle, attaches `event["squad_condition"] = {home, away}`
  to each WC payload. No new daemon.

### ② Consumer (probability-neutral)
- `core/world_cup_explanation.py` — `enrichment.squad` extended with
  `xi_value_ratio_home/away` + `rotation_flag_home/away`. `_squad_phrase` now emits
  a why-line **only on a real signal**: rotation (`"X rotate: starting XI worth
  62% of their best-11 value — key players rested/missing"`) or confirmed injuries
  (`"X are without …"`). No signal → no sentence (no fabricated "full strength").
- `core/world_cup_data_quality.py` — `cap_tier_for_availability(tier, *,
  availability_known)`: availability UNKNOWN caps the publication tier at
  `settings.SQUAD_UNKNOWN_AVAIL_TIER_CAP` (`paper_only`). Clamps DOWN only, never
  promotes; fail-soft on unknown tier strings.
- `agents/model.py` — wires the payload squad-condition into the enrichment squad
  block, and applies the tier cap in `_build_world_cup_result` (recomputes
  `availability_known` from the payload, caps the served tier, appends
  `squad_availability_unknown` to blocked_reasons + re-serializes the quality
  JSON so the heartbeat surface stays consistent). **PROBABILITY-NEUTRAL**: nothing
  touches `p_home/p_draw/p_away` or the lambdas.
- `config/settings.py` — `SQUAD_ROTATION_RATIO=0.85`, `SQUAD_AVAIL_CLIP=1.2`,
  `SQUAD_MIN_XI_VALUED=9`, `SQUAD_UNKNOWN_AVAIL_TIER_CAP="paper_only"`,
  `TRANSFERMARKT_DATA_DIR="data/transfermarkt"`. No hard-coded thresholds.

---

## Verification (gate)

- `git pull` before start: already up to date (main @ fda8e61), branch fetched @ 8967e33.
- **pytest**: `856 passed` (822 baseline + 34 new). New files:
  `test_squad_condition.py` (15), `test_squad_condition_sync.py` (11),
  `test_squad_condition_consumer.py` (8). Tests assert: probability-neutral
  (lambdas/matches byte-identical with vs without squad; probs object never
  mutated), fail-soft on every missing source, insert-on-change hash (stable /
  changes-on-injury / availability-bucketed), no NaN.
- **Migration applied + verified** via service-role `exec_sql` RPC
  (`node --env-file=.env scripts/apply_squad_condition_migration.mjs`):
  - table created, 14 columns present (id, team_canonical, source, report_hash,
    injured_count, squad_size, missing_players jsonb, recent_diff jsonb, xi_value,
    best11_value, availability_ratio, rotation_flag, model_consumed, captured_at).
  - `anon/authenticated` grants = `[]` (posture #010 confirmed).
- **Real run** (`scripts/smoke_squad_condition.py`, live ESPN, no DB writes):
  48 WC teams fetched. Argentina/Spain/Brazil/France/England → reports built
  fail-soft (injuries=0 today, `xi_value_ratio=None` because TM valuations are not
  pulled locally — the honest runtime state). Enriched why for Argentina vs Spain
  rendered correctly and, with no injury/rotation signal, emitted **no** squad line
  (no fabrication) — exactly the contract.

---

## Real-world impact to flag (honest)

- **No transfermarkt data is pulled locally yet** → `availability_ratio` is always
  None at runtime → `availability_known=False` → the ② tier cap clamps every WC row
  from `signal_allowed`/`premium_candidate` down to `paper_only`. This is the
  spec's intended conservative posture ("we won't claim signal strength on a slate
  whose XI condition we can't observe"), but it means **the cap is effectively
  active immediately**. Today this is harmless: WC competitive rows also need a
  matched market to be promoted and friendlies are paper-only regardless. To lift
  the cap, the weekly dcaribou CDN pull must land valuations in
  `data/transfermarkt/` (players.csv.gz + player_valuations.csv.gz) — then XI-value
  math activates and high-coverage matchups regain signal eligibility.
- ESPN currently reports 0 injuries across the field (off-window); injury lines and
  rotation flags will populate as the tournament approaches and lineups firm up.

---

## What remains for ③ (EXCLUDED here, gated)
- Availability delta as a logit feature on the served v2 path, coefficients frozen
  from the lab's last fold, shadow A/B first — identical chain to wc-elo-logit-v2.
  Requires: lab §3 promotes (it does, ΔBrier −0.0050) **+** PROMOTION-GATE green
  **+** human APPROVE in deploy-gate. The `model_consumed` column is the audit flag
  for when ③ starts consuming reports. Not touched.
- Weekly transfermarkt CDN refresh job (the data prerequisite for both the XI-value
  why-line and ③) — not built here; runtime is fail-soft without it.

## Deviations vs spec
- Migration numbered **008**, not 006: `006_referral.sql` / `007_community_slips.sql`
  already exist in `db/migrations/` (006 is taken by an unrelated, applied
  migration). Filename + intent otherwise per spec; documented in the SQL header.
- Storage writer lives in `core/squad_condition_sync.py` (network/side-effects),
  keeping `core/squad_condition.py` a pure module (project style: no side effects in
  `core/` pure modules). The pure/sync split mirrors the lab's pure functions vs the
  live agent.

## Files touched (review-ready, NOT committed)
- NEW: `core/squad_condition.py`, `core/squad_condition_sync.py`,
  `db/migrations/008_squad_condition_reports.sql`,
  `scripts/apply_squad_condition_migration.mjs`, `scripts/smoke_squad_condition.py`,
  `tests/test_squad_condition.py`, `tests/test_squad_condition_sync.py`,
  `tests/test_squad_condition_consumer.py`,
  `docs/internal/squad-condition-2026-06-07.md` (this file).
- MODIFIED: `agents/data_collector.py`, `agents/model.py`, `config/settings.py`,
  `core/world_cup_data_quality.py`, `core/world_cup_explanation.py`.
- NOT MINE (pre-existing/other-session untracked, left untouched, do NOT `git add`):
  `data/wc2026_fixtures_cache.json` (written by `lab_wc_simulator.py`),
  `docs/design/`, `docs/ui_memory.md`.
