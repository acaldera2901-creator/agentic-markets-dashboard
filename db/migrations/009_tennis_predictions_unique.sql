-- 009_tennis_predictions_unique.sql — #ELO-FIX-1 (gate: APPROVE Andrea, 2026-06-07).
--
-- Root cause of the Elo corruption: tennis_predictions had NO unique constraint,
-- so the agent's `Prefer: resolution=merge-duplicates` POST (agents/tennis_model_agent.py)
-- was a silent no-op — every prediction cycle inserted a fresh row. 294 distinct
-- matches had ballooned to 35k rows, and the settlement agent re-applied the same
-- Elo update once PER duplicate row, inflating ratings (Zverev 813 matches, etc.).
--
-- This index is what makes merge-duplicates actually upsert. It MUST be applied
-- AFTER the one-time dedup (kept newest row per key by computed_at), otherwise the
-- CREATE fails on the existing duplicates.
--
-- Additive: no column touched. Reversibility: DROP INDEX uq_tennis_predictions_match.
-- Idempotent: IF NOT EXISTS. Blast radius on the client GET path: nil (read-only
-- consumers unaffected; only the agent write path gains true upsert semantics).

CREATE UNIQUE INDEX IF NOT EXISTS uq_tennis_predictions_match
  ON tennis_predictions (match_id, player1, player2);
