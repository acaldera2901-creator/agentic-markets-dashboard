"""#SETTLE-1001 b — closes in the sealed register the picks already lost.

NOT TO BE RUN with --apply without APPROVE from Andrea (prod write on
`pick_settlement`). Default is --dry-run: read-only (SET TRANSACTION READ ONLY
via tools/control_center/db.py), prints what it would write.

WHAT IT CLOSES (measured 01/10)
  b1  football: sealed picks (match_predictions) whose served row is already
      closed AND verified, without a mirror row — the 10-13/09 mirror gap.
  b2  tennis: sealed picks (tennis_predictions, register born 21/09) whose
      served row is already closed. Until a2 nothing ever wrote them.
      Graded on the SEALED pick vs tennis_predictions.winner (VERIFIED served
      rows only — pre-#SETTLE-0909 winners may be partial-score) with the same
      rule as the live path (core.supabase_client.tennis_pick_result);
      no winner + expired/unresolved -> 'unresolved' (terminal).
  Sealed picks whose served row is still open are NOT touched: after a1/a2
  the live settlement (normal cycle or bridge reconciliation) closes them.

SAFETY
  Only INSERT ... ON CONFLICT (pick_settlement_pick_rev_key) DO NOTHING,
  revision 1, in one transaction. Every row carries is_backfill=TRUE and
  correction_reason=BATCH, so the batch is removable as a unit:
      DELETE FROM pick_settlement WHERE correction_reason = 'backfill:SETTLE-1001';
  (UPDATE/DELETE are REVOKEd for the app roles: rollback runs as owner.)

USAGE
  venv/bin/python -m scripts.backfill_settle_1001            # dry-run
  venv/bin/python -m scripts.backfill_settle_1001 --apply    # gated
"""
from __future__ import annotations

import argparse
import sys

from core.supabase_client import tennis_pick_result
from scripts.backfill_sealed_orphans import _final_score_from_notes, outcome_from_score

BATCH = "backfill:SETTLE-1001"
GRACE = "6 hours"

_FOOTBALL_SQL = f"""
select l.source_table, l.source_id, l.model_version, u.result, u.verification_state, u.notes
from pick_ledger l
left join pick_settlement s using (source_table, source_id, model_version)
join unified_predictions u on u.sport = 'football' and u.external_event_id = l.source_id
where s.id is null and l.source_table = 'match_predictions'
  and l.commence_time < now() - interval '{GRACE}'
  and u.result is not null
"""

_TENNIS_SQL = f"""
select l.source_table, l.source_id, l.model_version, l.pick, u.result, u.notes,
       t.winner, t.outcome, u.verification_state
from pick_ledger l
left join pick_settlement s using (source_table, source_id, model_version)
join unified_predictions u on u.source_table = l.source_table and u.source_id = l.source_id
left join tennis_predictions t on t.match_id = l.source_id
where s.id is null and l.source_table = 'tennis_predictions'
  and l.commence_time < now() - interval '{GRACE}'
  and u.result is not null
"""


def _row(st, sid, mv, result, outcome=None, final_score=None) -> dict:
    return {"source_table": st, "source_id": str(sid), "model_version": mv,
            "result": result, "outcome": outcome, "final_score": final_score}


def football_row(st, sid, mv, result, verification_state, notes) -> dict | None:
    """b1: only what the served row already says AND verified; else skip."""
    if result in ("won", "lost") and verification_state != "verified":
        return None
    if result not in ("won", "lost", "void", "unresolved"):
        return None
    score = _final_score_from_notes(notes) if result in ("won", "lost", "void") else None
    return _row(st, sid, mv, result, outcome_from_score(score), score)


def tennis_row(st, sid, mv, sealed_pick, served_result, notes, winner, pred_outcome,
               verification_state=None) -> dict | None:
    """b2: graded on the SEALED pick. Never a result we cannot back.

    The winner counts only on a VERIFIED served row: tennis_predictions.winner
    still holds ~289 rows graded on partial scores before #SETTLE-0909, and
    the register is first-write-wins — a wrong winner would be permanent.
    """
    if winner and verification_state == "verified":
        result = tennis_pick_result(sealed_pick, winner)
        if result in ("won", "lost"):
            return _row(st, sid, mv, result, winner, _final_score_from_notes(notes))
        return None
    if served_result == "unresolved" or pred_outcome == "expired":
        return _row(st, sid, mv, "unresolved")
    return None  # closed upstream without a winner nor an expiry: not ours to guess


def build(football: list[tuple], tennis: list[tuple]) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    stats: dict[str, int] = {}
    for label, src, fn in (("b1", football, football_row), ("b2", tennis, tennis_row)):
        for rec in src:
            r = fn(*rec)
            key = f"{label}:{r['result'] if r else 'skipped'}"
            stats[key] = stats.get(key, 0) + 1
            if r:
                rows.append(r)
    return rows, stats


def _apply(rows: list[dict]) -> int:
    import psycopg2  # noqa: PLC0415
    from tools.control_center.db import _dsn  # noqa: PLC0415

    sql = (
        "insert into pick_settlement (source_table, source_id, model_version, result,"
        " outcome, final_score, closing_odds, is_backfill, settlement_revision, correction_reason)"
        " values (%(source_table)s, %(source_id)s, %(model_version)s, %(result)s,"
        " %(outcome)s, %(final_score)s, null, true, 1, %(batch)s)"
        " on conflict (source_table, source_id, model_version, settlement_revision) do nothing"
    )
    written = 0
    with psycopg2.connect(_dsn(), connect_timeout=8) as conn:  # one transaction
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(sql, {**r, "batch": BATCH})
                written += cur.rowcount
    return written


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="#SETTLE-1001 b (gated)")
    ap.add_argument("--apply", action="store_true", help="WRITE to prod (needs APPROVE)")
    a = ap.parse_args(argv)

    from tools.control_center.db import fetch_all  # read-only transaction

    rows, stats = build(fetch_all(_FOOTBALL_SQL), fetch_all(_TENNIS_SQL))
    for k in sorted(stats):
        print(f"{k:24s} {stats[k]}")
    print(f"TOTAL to write: {len(rows)}  (batch marker {BATCH!r})")
    for r in rows[:5]:
        print("  sample", r)
    if not a.apply:
        print("DRY-RUN: nothing written. --apply requires APPROVE.")
        return 0
    n = _apply(rows)
    print(f"written {n} rows (duplicates ignored: {len(rows) - n})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
