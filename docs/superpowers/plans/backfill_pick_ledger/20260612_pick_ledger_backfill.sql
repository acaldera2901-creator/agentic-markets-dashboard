-- #TRACKREC-BACKFILL-1 (PROPOSAL — DO NOT APPLY without APPROVE Andrea in ch_deploy_gate)
-- ============================================================================
-- Retroactive, FLAGGED backfill of the served track record into the ledger.
--
-- WHY: pick_ledger / pick_settlement (#TRACKREC-PROOF-1) are forward-only and
-- empty. The CHECK (captured_at < commence_time) makes it physically impossible
-- to insert any pick whose event has already started — which is exactly every
-- historical pick we have served. To publish a real, dated track record from
-- the picks we ALREADY served (unified_predictions / tennis_predictions /
-- prediction_log) we must admit those rows, but they must be PERMANENTLY
-- DISTINGUISHABLE from the forward, look-ahead-proof rows.
--
-- DESIGN: add an immutable `is_backfill` flag. Forward rows keep the strict
-- no-look-ahead guarantee; backfill rows are admitted ONLY when is_backfill=TRUE
-- and are forever marked as historical / best-effort. The public runner MUST
-- keep the two cohorts separate (forward = verified, backfill = historical).
--
-- ADDITIVE ONLY: no column is dropped or retyped. The single CHECK constraint is
-- replaced by a named, weaker-on-backfill-only variant via DROP+ADD so the
-- forward path is byte-for-byte as strict as before.
-- ============================================================================

BEGIN;

-- ─── pick_ledger: add is_backfill, relax look-ahead for backfill only ────────
ALTER TABLE pick_ledger
  ADD COLUMN IF NOT EXISTS is_backfill BOOLEAN NOT NULL DEFAULT FALSE;

-- provenance of a backfilled row: which served table it was reconstructed from.
-- NULL for forward rows. Free text, audited, never used for dedup.
ALTER TABLE pick_ledger
  ADD COLUMN IF NOT EXISTS backfill_source TEXT;

-- The original constraint is an inline (auto-named) CHECK from the create-table
-- migration: pick_ledger_no_lookahead. Drop by its known name and re-add a
-- variant that still REJECTS any forward row at/after kickoff, but ADMITS a row
-- explicitly flagged as backfill. Backfill rows therefore can never masquerade
-- as forward (the flag is the only way past the guard).
ALTER TABLE pick_ledger DROP CONSTRAINT IF EXISTS pick_ledger_no_lookahead;
ALTER TABLE pick_ledger
  ADD CONSTRAINT pick_ledger_no_lookahead
  CHECK (is_backfill OR captured_at < commence_time);

-- ─── pick_settlement: mark backfilled settlements + flag closing-odds quality ─
ALTER TABLE pick_settlement
  ADD COLUMN IF NOT EXISTS is_backfill BOOLEAN NOT NULL DEFAULT FALSE;

-- closing_odds on a backfilled row is best-effort. When it was attached by a
-- fuzzy (name+date) join rather than a deterministic key, this flag says so, so
-- the runner can refuse to publish CLV built on fuzzy matches.
ALTER TABLE pick_settlement
  ADD COLUMN IF NOT EXISTS closing_odds_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── immutability preserved: still INSERT/SELECT-only for the writer ─────────
-- (No grant change needed — the new columns inherit the table's existing
-- REVOKE UPDATE/DELETE. A backfill correction is a NEW row, never an edit,
-- identical to the forward model.)

-- ─── RLS unchanged ───────────────────────────────────────────────────────────
-- pick_ledger_select already restricts anon/authenticated to commence_time<NOW()
-- — every backfill row is by definition a past event, so it is already visible
-- read-only with no new policy.

COMMIT;

-- ── verification (run AFTER apply, read-only) ────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='pick_ledger'::regclass AND contype='c';
--   -- expect: CHECK ((is_backfill OR (captured_at < commence_time)))
-- A forward insert with captured_at>=commence_time must STILL fail:
-- INSERT INTO pick_ledger(source_table,source_id,model_version,sport,market,
--   commence_time,captured_at) VALUES('t','x','v','football','1X2',
--   NOW(), NOW()+interval '1h');  -- expect: violates pick_ledger_no_lookahead
