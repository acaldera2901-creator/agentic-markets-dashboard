"""#UNIFIED-1001 — aligns the SERVED rows (unified_predictions) with the sealed
register's closures written by #RISULTATI-PARTNER-1001 (tennis) and
#CALCIO-1001 (football).

NOT TO BE RUN with --apply without APPROVE from Andrea (prod UPDATE on
unified_predictions). Default is the dry-run: DB reads only, through
tools/control_center/db.py::fetch_all (SET TRANSACTION READ ONLY), plus an
EXPLAIN of the real UPDATE on the prod schema in the same read-only mode.

THE SET: served rows, tennis and football, with result NULL or 'unresolved',
whose CURRENT pick_settlement row (pick_settlement_current) on the same key
(source_table, source_id, model_version) was written by one of the two batches
and is won/lost/void.

WHAT IS WRITTEN — the live closure, field by field
(core/supabase_client.py::settle_unified_prediction, app/api/cron/settle):
  result, status='settled', is_historical=TRUE, settled_at, updated_at,
  notes.final_score merged into the JSON (never clobbered), and for won/lost
  only the stamp verification_state='verified' + verification_source/_at/_note
  (a void stays unstamped, exactly like live).
GRADING — live grades the SHOWN pick (unified_predictions.pick), the register
graded the SEALED one. The served result is re-graded with the live rules
(tennis: core.supabase_client.tennis_pick_result on the winner; football:
scripts.recupera_calcio_1001.grade on the final score; football void with no
score = the source's postponement) and the row is written ONLY when it equals
the register's result. A disagreement is skipped and reported, never resolved
here.

SKIPPED (reported with the reason): key not unique in unified_predictions,
served row already won/lost/void, settlement without a proved result, shown
pick graded differently from the register, notes that are not a JSON object
(live would clobber them).

BATCH MARK: verification_note = BATCH (won/lost), notes.settlement_batch = BATCH
on every written row, notes.sigillo = 'non-sigillata' for a football row graded
on a pick the register never sealed (#CALCIO-1001 regola 4a): NOT part of the
"logged before kick-off" claim. (On 01/10 all such rows were fonte=servita,
i.e. served row already closed: skipped as 'gia-chiusa'.)

SAFETY: before the UPDATE every original value of the touched columns is
written to BACKUP_DIR/unified_pre_allinea_1001_<UTC>.jsonl (one file per run,
never overwritten; the path is printed), JSONL, one row per id. One transaction; every UPDATE keeps
`AND (result IS NULL OR result = 'unresolved')` and `AND notes IS NOT DISTINCT
FROM <the notes read>` (notes is rewritten from that snapshot: a concurrent
change, e.g. surface/below_floor from the sync, must not be lost); if the
updated count differs from the planned one, everything is rolled back. Idempotent: a written row is
won/lost/void and is skipped as 'gia-chiusa' on the next run.
ROLLBACK:  venv/bin/python scripts/allinea_unified_1001.py --restore <backup path printed by --apply>

RELEASE ORDER — FIRST the 'coerenza' PR, THEN --apply. With the CURRENT
/api/v2/history (dedupeByFixture, freshness = most recent settled_at) a row
written here (settled_at = now) beats its already-verified twin: the twin
leaves the counted population and the football net gain is roughly halved
(review of 01/10, not re-measured here: ~66 verified rows out — 64 football,
2 tennis — football net +67 instead of +131). The 'coerenza' PR (route keeps
the oldest published_at, `oldest: true`) removes the effect.

USAGE (from the repo root)
  venv/bin/python scripts/allinea_unified_1001.py            # dry-run
  venv/bin/python scripts/allinea_unified_1001.py --apply    # gated, AFTER the coerenza PR
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.supabase_client import tennis_pick_result  # noqa: E402
from scripts.recupera_calcio_1001 import _score, grade  # noqa: E402

BATCH = "allinea:UNIFIED-1001"
TENNIS_BATCH = "backfill:RISULTATI-PARTNER-1001"
CALCIO_BATCH = "recupero:CALCIO-1001"
TENNIS_SOURCE = "betconstruct"  # the partner feed: same label as the live cycle
BACKUP_DIR = Path.home() / "Desktop/00-SISTEMA/backups"


def backup_path(ts: str) -> Path:
    """One file per --apply: a second run must never overwrite the first one's
    backup (the only way back)."""
    stamp = datetime.fromisoformat(ts).strftime("%Y%m%dT%H%M%SZ")
    return BACKUP_DIR / f"unified_pre_allinea_1001_{stamp}.jsonl"
TOUCHED = ("result", "status", "is_historical", "settled_at", "updated_at", "notes",
           "verification_state", "verification_source", "verification_at",
           "verification_note")

COLS = ("id", "sport", "source_table", "source_id", "model_version", "pick", "market",
        "notes", "result", "status", "is_historical", "settled_at", "updated_at",
        "verification_state", "verification_source", "verification_at",
        "verification_note", "published_at", "is_demo", "starts_at", "competition", "n_key",
        "s_result", "s_outcome", "s_final_score", "s_reason")

_SQL = f"""
select u.id::text, u.sport, u.source_table, u.source_id, u.model_version, u.pick, u.market,
       u.notes, u.result, u.status, u.is_historical, u.settled_at::text, u.updated_at::text,
       u.verification_state, u.verification_source, u.verification_at::text,
       u.verification_note, u.published_at::text, u.is_demo, u.starts_at::text, u.competition,
       count(*) over (partition by u.source_table, u.source_id, u.model_version),
       s.result, s.outcome, s.final_score, s.correction_reason
from pick_settlement_current s
join unified_predictions u
  on u.source_table = s.source_table and u.source_id = s.source_id
 and u.model_version = s.model_version
where (s.correction_reason = '{TENNIS_BATCH}' or s.correction_reason like '{CALCIO_BATCH}%')
  and u.sport in ('tennis', 'football')
order by u.sport, u.starts_at
"""

_UPDATE = """
update unified_predictions set
  result = %(result)s, status = %(status)s, is_historical = %(is_historical)s,
  settled_at = %(settled_at)s, updated_at = %(updated_at)s, notes = %(notes)s,
  verification_state = %(verification_state)s, verification_source = %(verification_source)s,
  verification_at = %(verification_at)s, verification_note = %(verification_note)s
where id = %(id)s and (result is null or result = 'unresolved')
  and notes is not distinct from %(old_notes)s
"""


def _fonte(reason: str) -> str | None:
    for part in (reason or "").split():
        if part.startswith("fonte="):
            return part[len("fonte="):] or None
    return None


def served_result(rec: dict) -> str | None:
    """What the live closure would write on the SHOWN pick, from the register's
    proved facts. None = no proved result to grade on."""
    if rec["sport"] == "tennis":
        if rec["s_result"] == "void":
            return "void"
        if not rec["s_outcome"]:
            return None
        return tennis_pick_result(rec["pick"], rec["s_outcome"])
    sc = _score(rec["s_final_score"])
    if sc:
        return grade(rec["pick"], rec["market"], *sc)
    # No score: only a void the source declared (postponed/cancelled) is a fact.
    return "void" if rec["s_result"] == "void" else None


def plan_row(rec: dict, ts: str) -> tuple[dict | None, str]:
    """(new values, reason). new values None = skipped, reason says why."""
    if rec["n_key"] != 1:
        return None, "chiave-non-univoca"
    if rec["result"] in ("won", "lost", "void"):
        return None, "gia-chiusa"
    if rec["result"] not in (None, "unresolved"):
        return None, f"stato-inatteso:{rec['result']}"
    if rec["s_result"] not in ("won", "lost", "void"):
        return None, "esito-non-provato"
    expected = served_result(rec)
    if expected is None:
        return None, "esito-non-provato"
    if expected != rec["s_result"]:
        return None, f"pick-mostrata-diversa:{rec['s_result']}->{expected}"
    raw = rec["notes"]
    try:
        notes = json.loads(raw) if raw and raw.strip() else {}
    except ValueError:
        notes = None
    if not isinstance(notes, dict):
        return None, "notes-non-json"

    sport = rec["sport"]
    if sport == "tennis":
        final_score, source = rec["s_final_score"], TENNIS_SOURCE
    else:
        sc = _score(rec["s_final_score"])
        final_score = f"{sc[0]}-{sc[1]}" if sc else None
        source = _fonte(rec["s_reason"])
    non_sigillata = "non-sigillata" in (rec["s_reason"] or "")
    if final_score:
        notes["final_score"] = final_score
    notes["settlement_batch"] = BATCH
    if non_sigillata:
        notes["sigillo"] = "non-sigillata"
    new = {
        "id": rec["id"], "result": expected, "status": "settled", "is_historical": True,
        "settled_at": ts, "updated_at": ts, "notes": json.dumps(notes),
        "old_notes": raw,  # concurrency guard: notes rewritten from this snapshot
        "verification_state": rec["verification_state"],
        "verification_source": rec["verification_source"],
        "verification_at": rec["verification_at"],
        "verification_note": rec["verification_note"],
    }
    if expected in ("won", "lost"):
        if not source:
            return None, "fonte-ignota"  # never stamp verified without the source
        new.update(verification_state="verified", verification_source=source,
                   verification_at=ts,
                   verification_note=BATCH + (" non-sigillata" if non_sigillata else ""))
    why = f"{expected}" + (" non-sigillata" if non_sigillata else "")
    return new, why


def plan(recs: list[dict], ts: str) -> tuple[list[tuple[dict, dict]], Counter]:
    out, stats = [], Counter()
    for rec in recs:
        new, why = plan_row(rec, ts)
        stats[(rec["sport"], ("scrive:" if new else "salta:") + why)] += 1
        if new:
            out.append((rec, new))
    return out, stats


def history_effect(pairs: list[tuple[dict, dict]]) -> Counter:
    """Rows entering /api/v2/history's verified population (pre-dedup): the
    route's SQL gates + wasShownAsPick + verification_state='verified'."""
    c = Counter()
    for rec, new in pairs:
        notes = json.loads(new["notes"])
        below = (notes.get("surface") or {}).get("below_floor") is True
        shown = bool(rec["pick"]) and (not below or rec.get("competition") == "World Cup")
        if rec["published_at"] and not rec["is_demo"] and shown:
            c[(rec["sport"], new["result"], new["verification_state"] == "verified")] += 1
    return c


def _backup(pairs: list[tuple[dict, dict]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x") as fh:  # refuses an existing file
        for rec, new in pairs:
            fh.write(json.dumps({"id": rec["id"], "batch_ts": new["updated_at"],
                                 "source_table": rec["source_table"],
                                 "source_id": rec["source_id"],
                                 "model_version": rec["model_version"],
                                 **{k: rec[k] for k in TOUCHED}}) + "\n")


def _apply(pairs: list[tuple[dict, dict]]) -> int:
    import psycopg2  # noqa: PLC0415
    from tools.control_center.db import _dsn  # noqa: PLC0415

    conn = psycopg2.connect(_dsn(), connect_timeout=8)
    try:
        with conn.cursor() as cur:
            n = 0
            for _, new in pairs:
                cur.execute(_UPDATE, new)
                n += cur.rowcount
            if n != len(pairs):
                conn.rollback()
                raise SystemExit(f"ABORT: updated {n} != planned {len(pairs)}, rolled back")
        conn.commit()
        return n
    finally:
        conn.close()


def _restore(path: Path) -> int:
    """Puts back the backed-up values ONLY on the backup's ids that are still
    exactly as this batch left them: batch mark in notes AND updated_at equal to
    the batch timestamp. A row touched afterwards (live, manual fix) is NOT
    overwritten — it is counted as skipped and must be reviewed by hand."""
    import psycopg2  # noqa: PLC0415
    from tools.control_center.db import _dsn  # noqa: PLC0415

    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    if not rows:
        return 0
    sql = (_UPDATE.split("where")[0] + "where id = %(id)s"
           " and notes like '%%\"settlement_batch\": \"" + BATCH + "\"%%'"
           " and updated_at = %(batch_ts)s::timestamptz")
    with psycopg2.connect(_dsn(), connect_timeout=8) as conn:  # one transaction
        with conn.cursor() as cur:
            n = 0
            for r in rows:
                cur.execute(sql, r)
                n += cur.rowcount
    return n


def _explain(sample: dict) -> list[str]:
    from tools.control_center.db import fetch_all  # read-only transaction  # noqa: PLC0415

    return [r[0] for r in fetch_all("explain " + _UPDATE, sample)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="#UNIFIED-1001 (gated)")
    ap.add_argument("--apply", action="store_true", help="WRITE to prod (needs APPROVE)")
    ap.add_argument("--restore", type=Path, help="roll back from a backup JSONL (gated)")
    a = ap.parse_args(argv)
    if a.restore:
        total = sum(1 for line in a.restore.read_text().splitlines() if line.strip())
        n = _restore(a.restore)
        print(f"restored {n}/{total} rows from {a.restore} "
              f"(skipped {total - n}: changed after the batch, review by hand)")
        return 0

    from tools.control_center.db import fetch_all  # read-only transaction  # noqa: PLC0415

    ts = datetime.now(timezone.utc).isoformat()
    recs = [dict(zip(COLS, r)) for r in fetch_all(_SQL)]
    pairs, stats = plan(recs, ts)

    print(f"righe servite sulle chiavi dei due batch: {len(recs)}")
    for (sport, why), n in sorted(stats.items()):
        print(f"  {sport:9s} {why:42s} {n}")
    print(f"TOTAL to update: {len(pairs)}  batch {BATCH!r}  settled_at {ts}")
    orfane = sum(1 for rec, _ in pairs if rec["result"] is None and rec["published_at"]
                 and rec["pick"] and not rec["is_demo"])
    print(f"of which result NULL + published + pick (check 'Pick mostrate senza esito'): {orfane}")
    print("/history verified population (pre-dedup) entering:")
    for (sport, res, ver), n in sorted(history_effect(pairs).items()):
        print(f"  {sport:9s} {res:5s} verified={ver} {n}")
    for rec, new in pairs[:10]:
        print(f"  sample {rec['sport']} {rec['id']} {rec['source_id'][:40]} pick={rec['pick']!r}: "
              f"{rec['result']}/{rec['verification_state']} -> {new['result']}/"
              f"{new['verification_state']} src={new['verification_source']} "
              f"notes+={ {k: v for k, v in json.loads(new['notes']).items() if k in ('final_score', 'settlement_batch', 'sigillo')} }")
    if pairs:
        plan_txt = _explain(pairs[0][1])
        print("EXPLAIN (read-only) of the UPDATE:", " | ".join(p.strip() for p in plan_txt))
    if not a.apply:
        print(f"DRY-RUN: nothing written. --apply writes the backup to {backup_path(ts)} first, needs APPROVE.")
        return 0
    if not pairs:
        print("nothing to update")
        return 0
    bk = backup_path(ts)
    _backup(pairs, bk)
    print(f"backup: {len(pairs)} rows -> {bk}")
    n = _apply(pairs)
    print(f"updated {n} rows. ROLLBACK: venv/bin/python scripts/allinea_unified_1001.py --restore {bk}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
