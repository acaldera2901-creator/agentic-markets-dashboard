"""#RISULTATI-PARTNER-1001 — closes sealed tennis picks with the partner feed's
real result (BetConstruct finished matches, history >= 1 year).

NOT TO BE RUN with --apply without APPROVE from Andrea (prod write on
`pick_settlement`). Default is --dry-run: DB read-only (SET TRANSACTION READ
ONLY via tools/control_center/db.py) + public GETs to the partner feed (one
per day), prints what it would write.

WHAT IT CLOSES
  Sealed tennis picks (pick_ledger, source_table='tennis_predictions'), start
  older than GRACE, whose CURRENT settlement is:
    - 'unresolved'             -> correction, revision = current + 1
    - missing, and the live agent can no longer reach it (computed_at older
      than EXPIRE_AFTER_DAYS)  -> revision 1
  Missing and still inside the live window: NOT written — the live cycle
  (agents/tennis_settlement.py, partner resolver) closes those; counted apart.
  Matching and gates are the live ones (TennisSettlementAgent._risolvi_con:
  pair + date within 1 day, single candidate, set coherence); grading is
  core.supabase_client.tennis_pick_result on the SEALED pick. Not found,
  ambiguous or refused by the gate -> nothing written: stays as it is.

NOT TOUCHED: tennis_predictions and unified_predictions (served rows stay
'expired'/'unresolved'); re-opening them is a separate, gated step.

SAFETY
  INSERT ... ON CONFLICT (source_table, source_id, model_version,
  settlement_revision) DO NOTHING, one transaction, is_backfill=TRUE,
  correction_reason=BATCH. Rollback (as owner, UPDATE/DELETE revoked for app):
      DELETE FROM pick_settlement WHERE correction_reason = 'backfill:RISULTATI-PARTNER-1001';
  The view pick_settlement_current falls back to the previous revision.

USAGE
  venv/bin/python -m scripts.backfill_risultati_partner_1001            # dry-run
  venv/bin/python -m scripts.backfill_risultati_partner_1001 --apply    # gated
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import Counter

from agents.tennis_settlement import EXPIRE_AFTER_DAYS, TennisSettlementAgent
from core.partner_tennis_results import get_partner_results_for_days
from core.supabase_client import tennis_pick_result
from core.tennis_names import canonical_player_key

BATCH = "backfill:RISULTATI-PARTNER-1001"
GRACE = "6 hours"

_SQL = f"""
select l.source_id, l.model_version, l.pick, t.player1, t.player2, t.scheduled_at,
       t.tournament, s.result, s.settlement_revision,
       t.computed_at < now() - interval '{EXPIRE_AFTER_DAYS} days' as fuori_finestra
from pick_ledger l
join tennis_predictions t on t.match_id = l.source_id
left join pick_settlement_current s
  on s.source_table = l.source_table and s.source_id = l.source_id
 and s.model_version = l.model_version
where l.source_table = 'tennis_predictions'
  and l.commence_time < now() - interval '{GRACE}'
  and (s.id is null or s.result = 'unresolved')
"""


class _Row:
    """The attributes the live matcher reads, nothing more."""

    def __init__(self, rec: tuple):
        (self.match_id, self.model_version, self.pick, self.player1, self.player2,
         self.scheduled_at, self.tournament, self.current, self.revision,
         self.fuori_finestra) = rec
        self.id = (self.match_id, self.model_version)


def tier(tournament: str | None, player1: str | None = None) -> str:
    t = (tournament or "").lower()
    if "doubles" in t or "/" in (player1 or ""):
        return "doppi"
    for key, label in (("challenger", "ATP Challenger"), ("wta 125", "WTA125"),
                       ("wtt", "ITF/WTT"), ("itf", "ITF/WTT"), ("utr", "UTR"),
                       ("davis", "Davis/BJK"), ("billie", "Davis/BJK"),
                       ("partner feed", "partner (torneo ignoto)")):
        if key in t:
            return label
    if "atp" in t or "wta" in t:
        return "ATP/WTA tour"
    return "altro"


class _Quiet:
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass


def classify(rows: list[_Row], results: list[dict]) -> tuple[list[dict], Counter]:
    agent = object.__new__(TennisSettlementAgent)
    agent.logger = _Quiet()
    by_pair: dict[frozenset, list[dict]] = {}
    for r in results:
        by_pair.setdefault(frozenset((r["winner_key"], r["loser_key"])), []).append(r)

    out: list[dict] = []
    stats: Counter = Counter()
    for row in rows:
        pair = frozenset((canonical_player_key(row.player1), canonical_player_key(row.player2)))
        cands = agent._candidati_per_data(row, by_pair.get(pair) or [])
        label = tier(cands[0]["tournament"] if cands else row.tournament, row.player1)
        resolved = agent._risolvi_con([row], cands) if cands else []
        if not cands:
            why = "non-trovata"
        elif len(cands) > 1:
            why = "ambigua"
        elif not resolved:
            why = "cancello-set"  # retirement / partial snapshot: never guessed
        elif not row.fuori_finestra and row.current is None:
            why = "la-chiude-il-ciclo-live"
        else:
            why = None
        if why:
            stats[(label, why)] += 1
            continue
        _, pos, score = resolved[0][:3]
        winner = row.player1 if pos == "P1" else row.player2
        result = tennis_pick_result(row.pick, winner)
        if result not in ("won", "lost"):
            stats[(label, "pick-vuota")] += 1
            continue
        stats[(label, f"recuperabile:{result}")] += 1
        out.append({"source_table": "tennis_predictions", "source_id": row.match_id,
                    "model_version": row.model_version, "result": result,
                    "outcome": winner, "final_score": score,
                    "revision": (row.revision or 0) + 1})
    return out, stats


def _apply(rows: list[dict]) -> int:
    import psycopg2  # noqa: PLC0415
    from tools.control_center.db import _dsn  # noqa: PLC0415

    sql = (
        "insert into pick_settlement (source_table, source_id, model_version, result,"
        " outcome, final_score, closing_odds, is_backfill, settlement_revision, correction_reason)"
        " values (%(source_table)s, %(source_id)s, %(model_version)s, %(result)s,"
        " %(outcome)s, %(final_score)s, null, true, %(revision)s, %(batch)s)"
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
    ap = argparse.ArgumentParser(description="#RISULTATI-PARTNER-1001 (gated)")
    ap.add_argument("--apply", action="store_true", help="WRITE to prod (needs APPROVE)")
    a = ap.parse_args(argv)

    from tools.control_center.db import fetch_all  # read-only transaction

    rows = [_Row(r) for r in fetch_all(_SQL)]
    days = TennisSettlementAgent._giorni_di(rows)
    results = asyncio.run(get_partner_results_for_days(days))
    out, stats = classify(rows, results)

    print(f"candidati {len(rows)} · giorni chiesti al partner {len(days)} · partite concluse lette {len(results)}")
    for (label, why), n in sorted(stats.items()):
        print(f"  {label:26s} {why:28s} {n}")
    by_rev = Counter(r["revision"] for r in out)
    print(f"TOTAL to write: {len(out)}  (rev1 {by_rev.get(1, 0)}, correzioni rev>1 "
          f"{sum(v for k, v in by_rev.items() if k > 1)})  batch {BATCH!r}")
    for r in out[:5]:
        print("  sample", r)
    if not a.apply:
        print("DRY-RUN: nothing written. --apply requires APPROVE.")
        return 0
    n = _apply(out)
    print(f"written {n} rows (duplicates ignored: {len(out) - n})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
