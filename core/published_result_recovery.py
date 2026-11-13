"""Retry published tennis picks indefinitely, in bounded rotating batches.

The public pick is authoritative; a missing result is never a loss or a void.
Uses the live resolver's date, ambiguity, completion and set validation gates.
No Elo updates: recovering an old public result must not replay model training.
"""
from __future__ import annotations
import json
from types import SimpleNamespace
from sqlalchemy import text
from core.db import AsyncSessionLocal

BATCH_SIZE = 100
READ_SQL = """
SELECT id::text, source_id, home_team AS player1, away_team AS player2,
       pick, starts_at AS scheduled_at, competition AS tournament, notes
FROM unified_predictions
WHERE sport = 'tennis' AND source_table = 'tennis_predictions'
  AND published_at IS NOT NULL AND is_demo = false AND pick IS NOT NULL
  AND starts_at < now() - interval '48 hours'
  AND (result IS NULL OR result = 'unresolved')
  AND (CAST(:after AS uuid) IS NULL OR (starts_at, id) < (
    SELECT starts_at, id FROM unified_predictions WHERE id = CAST(:after AS uuid)
  ))
ORDER BY starts_at DESC, id DESC LIMIT :limit
"""

async def read_published_batch(after=None, limit=BATCH_SIZE):
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(text(READ_SQL), {'after': after, 'limit': limit})).mappings().all()
    return [dict(r) for r in rows]

async def resolve_published_batch(rows, resolve):
    pending = [SimpleNamespace(**r, match_id=r['source_id']) for r in rows]
    plans = []
    for pred, position, score, source in await resolve(pending):
        if position not in ('P1', 'P2') or not source or not score:
            continue
        if pred.pick not in (pred.player1, pred.player2):
            continue
        winner = pred.player1 if position == 'P1' else pred.player2
        plans.append(dict(id=pred.id, source_id=pred.source_id, winner=winner,
                          result='won' if pred.pick == winner else 'lost',
                          expected_pick=pred.pick, final_score=score,
                          verification_source=source))
    return plans

async def apply_recovered_result(plan):
    # Lock the public row: competing recovery runs cannot overwrite a real
    # settlement. Ledger revisions and public outcome commit atomically.
    async with AsyncSessionLocal() as session:
        async with session.begin():
            row = (await session.execute(text("""
                SELECT id, notes FROM unified_predictions
                WHERE id = CAST(:id AS uuid) AND pick = :expected_pick
                  AND (result IS NULL OR result = 'unresolved') FOR UPDATE
            """), plan)).mappings().first()
            if not row:
                return False
            try:
                notes = json.loads(row['notes'] or '{}')
                if not isinstance(notes, dict): notes = {}
            except (TypeError, ValueError):
                notes = {}
            notes['final_score'] = plan['final_score']
            params = {**plan, 'notes': json.dumps(notes)}
            # Grade each seal against ITS pick, never the possibly updated served
            # pick. Preserve real settlements; append corrections to unresolved.
            await session.execute(text("""
                INSERT INTO pick_settlement
                  (source_table, source_id, model_version, result, outcome,
                   final_score, is_backfill, settlement_revision, correction_reason)
                SELECT l.source_table, l.source_id, l.model_version,
                       CASE WHEN l.pick = :winner THEN 'won' ELSE 'lost' END,
                       :winner, :final_score, true, coalesce(s.settlement_revision, 0) + 1,
                       'published-result-recovery'
                FROM pick_ledger l
                LEFT JOIN pick_settlement_current s
                  ON s.source_table=l.source_table AND s.source_id=l.source_id
                 AND s.model_version=l.model_version
                JOIN unified_predictions u ON u.id=CAST(:id AS uuid)
                WHERE l.source_table='tennis_predictions' AND l.source_id=:source_id
                  AND l.pick IN (u.home_team, u.away_team)
                  AND (s.id IS NULL OR s.result='unresolved')
                ON CONFLICT (source_table,source_id,model_version,settlement_revision) DO NOTHING
            """), params)
            await session.execute(text("""
                UPDATE unified_predictions SET result=:result, status='settled',
                  is_historical=true, settled_at=now(), updated_at=now(), notes=:notes,
                  verification_state='verified', verification_source=:verification_source,
                  verification_at=now(), verification_note='published-result-recovery'
                WHERE id=CAST(:id AS uuid)
            """), params)
    return True
