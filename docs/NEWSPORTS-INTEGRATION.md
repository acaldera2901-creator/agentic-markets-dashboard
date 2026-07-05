# NEWSPORTS — MLB / UFC integration package (DARK)

> Branch `michele/newsports-integration` · lab thread #NEWSPORTS-INTEGRATION-0705
> Status: **DARK** — everything behind flags, nothing served. Gate 1 passed
> (sealed backtests); Gate 2 live shadow running in `am-lab/nuovi-sport/`.
> Floors in this package are **PROVISIONAL** until the shadow confirms them.

## What ships in this branch

| Piece | Files | Status |
|---|---|---|
| Surfacing floors per sport | `config/settings.py` (`SURFACE_FLOOR_BASEBALL`=62, `SURFACE_FLOOR_MMA`=70) | ✅ done |
| Gate branches (Py + TS mirror) | `core/surfacing_gate.py`, `lib/surfacing-gate.ts` | ✅ done |
| Tests (boundaries, aliases, settings-driven) | `tests/test_surfacing_gate.py`, `tests/surfacing-gate.test.ts` | ✅ done |
| Enrichment/ingestion contract | this document | ✅ done |
| Why builders + board UI (5 languages) | `app/app/page.tsx`, `lib/why-text.ts` | ⏳ next tranche |
| Ingestion module | depends on #NEWSPORTS-INTEGRATION-0705 answer (Python agent vs TS cron) | ⏸ pending Andrea |
| Sportsbook bet-link (`BetSport` union, `fortuneplay-live.ts` SPORTS set) | `lib/sportsbooks/*` | ⏸ pending BetConstruct coverage check |
| Settlement | `agents/result_settlement.py` | ⏳ with ingestion module |

## Sport naming (canonical)

Following the existing generic-sport convention (`football`, `tennis`):

- MLB → `sport = "baseball"`, `league = "MLB"`, `competition = "MLB Regular Season <year>"`
- UFC → `sport = "mma"`, `league = "UFC"`, `competition = "<event name>"` (e.g. `"UFC 305"`)

The gate also accepts the aliases `mlb`/`ufc` defensively, but ingestion MUST
write the canonical values above.

## Serving formula (Gate 1, both sports)

`probability served = market devig (Pinnacle preferred, median fallback) + floor`.
The model NEVER overrides the market probability — it feeds the why/warning only.
This is the same architecture as football/tennis (probability-neutral gate).

- MLB: floor 62 (premium badge at 65) — sealed test 2018-21: 67.5% / 71.8%
- UFC: floor 70 (premium badge at 75) — sealed test 2021-23: 81.4% / 86.5%
- Confidence = picked-outcome market probability, whole percent (max-prob),
  identical semantics to football/tennis.

## unified_predictions row contract

No migration needed. Both sports are 2-outcome (no draw).

### Baseball (MLB)

```jsonc
{
  "sport": "baseball",
  "source_table": "mlb_model",          // dedup namespace
  "source_id": "<gamePk>",              // MLB Stats API gamePk (stable)
  "league": "MLB",
  "competition": "MLB Regular Season 2026",
  "home_team": "Los Angeles Dodgers",
  "away_team": "San Diego Padres",
  "starts_at": "2026-07-05T22:10:00Z",
  "pick": "HOME" | "AWAY",              // null if below floor
  "signal_type": "signal" | "paper",
  "edge_percent": null,                  // market-anchored: no edge claim
  "notes": "{\"p_home\":0.657,\"p_away\":0.343,\"odds_home\":1.52,\"odds_away\":2.63,\"mkt_source\":\"pinnacle\",\"n_books\":30}",
  "enrichment": { /* see below */ }
}
```

`enrichment` (all fields produced today by the shadow harness `mlb_v2.mjs`):

```jsonc
{
  "sp_home": "Emmet Sheehan",           // starting pitchers
  "sp_away": "JP Sears",
  "sp_home_fip_adj": 4.54,              // FIP-adjusted duel numbers (why signal 1)
  "sp_away_fip_adj": 5.10,
  "run_form_home": 1.84,                // run differential per game (why signal 2)
  "run_form_away": -0.51,
  "record_home": "59-31",               // season record (why signal 3)
  "record_away": "43-45",
  "p_model": 0.709,                     // standalone model prob (why/sanity only)
  "model_agrees": true,                 // false at low floors → serve warning, no tier upgrade
  "tier": "standard" | "premium",       // floor 62 vs 65
  "flags": [],                          // e.g. ["doubleheader"] — informational
  "warm_up": false                      // first 20 games of season → do not serve
}
```

### MMA (UFC)

Uses `player_one`/`player_two` (like tennis), not home/away:

```jsonc
{
  "sport": "mma",
  "source_table": "ufc_model",
  "source_id": "<odds-api event id>",
  "league": "UFC",
  "competition": "UFC 318",
  "player_one": "Fighter A",
  "player_two": "Fighter B",
  "starts_at": "2026-07-11T02:00:00Z",
  "pick": "P1" | "P2",
  "signal_type": "signal" | "paper",
  "edge_percent": null,
  "notes": "{\"p_p1\":0.74,\"p_p2\":0.26,\"odds_p1\":1.35,\"odds_p2\":3.20,\"mkt_source\":\"median\",\"n_books\":6}",
  "enrichment": {
    "tier": "standard" | "premium",     // floor 70 vs 75
    "org_verified": true,               // TheSportsDB fail-closed UFC-only filter
    "n_books": 6,                       // min 3 required (audit C1)
    "window_ok": true,                  // 2-30h post weigh-in (subs/missed-weight guard)
    "flags": []
  }
}
```

## Product rules (from Gate 1 reports, non-negotiable at serve time)

1. **MLB warm-up**: no picks in the first 20 games of the season per team.
2. **MLB regular season only** (no spring training, no postseason until tested).
3. **MLB model disagreement** at floor-adjacent confidence → serve with warning
   in the why, never upgrade tier.
4. **UFC window**: candidates only enter 2–30h before the fight (post weigh-in);
   protects against late substitutions and missed weight.
5. **UFC org filter**: fail-closed — if the event can't be verified as UFC via
   TheSportsDB, skip. Min 3 books on the fight.
6. Quality>volume (product principle): niente pick sotto floor, mai.

## Feature flags

- `NEXT_PUBLIC_NEWSPORT_BASEBALL_ENABLED` — client: board tab + cards MLB
- `NEXT_PUBLIC_NEWSPORT_MMA_ENABLED` — client: board tab + cards UFC
- `NEWSPORT_SERVE_ENABLED` — server: include baseball/mma in the unified serving path
- (ingestion-side flag named by whichever runtime is chosen, e.g. `MLB_AGENT_ENABLED`)

All default **absent/false** = current behavior, byte-identical.

## Activation checklist (deploy-gate, in order)

1. Shadow 2–4 weeks coherent with Gate 1 → final floors written to
   `settings.py` + `surfacing-gate.ts` (one commit, both files).
2. Andrea+Maven joint GO (product decision — committed 2026-07-04).
3. Ingestion runtime decision executed + deployed (Andrea's lane).
4. `THE_ODDS_API_KEY` in prod env (~2-3 credits/day).
5. BetConstruct coverage verdict → widen `BetSport`/`SPORTS` set, or serve
   without bet-link CTA.
6. Flags ON via deploy-gate APPROVE.
