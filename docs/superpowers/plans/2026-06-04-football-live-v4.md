# Football Live V4 Plan

Goal: promote the football live workflow from a mostly Poisson/Pi/xG UI layer plus underfed Python agents into one coherent production pipeline.

## Findings

- The Next.js `/api/predictions` route already uses Poisson, Pi ratings, current Understat cache, API-Football injuries/predictions, weather, and odds.
- The Python `DataCollectorAgent` publishes only fixture identity, odds, and World Cup context.
- The Python `ModelAgent` then runs `FeatureAdjuster` with defaults for xG, form, motivation, H2H, injuries, and weather when those fields are missing.
- The best validated football backtest remains the xG-enhanced stack: Poisson + Pi/form + Understat xG features.

## Implementation Steps

1. Add a leakage-safe `FootballFeatureStore` built from cached Understat match data.
2. Test point-in-time behavior, neutral fallbacks, and feature quality.
3. Enrich `DataCollectorAgent` events with real football feature fields consumed by `FeatureAdjuster`.
4. Update football unified metadata/explanations from `football-poisson-v1` to a clearer V4 name.
5. Keep customer-facing access gating unchanged.
6. Verify with focused pytest, Python compile, Next build/lint, then deploy if frontend/API code changes.

## Guardrails

- Do not fabricate market odds or value edge.
- Do not leak premium enrichment to base/free plans.
- Do not use future matches when building pre-match features.
- Keep probability adjustments conservative unless backtest proves a larger lift.
