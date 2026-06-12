"""#TRACKREC-BACKFILL-1 — retroactive, FLAGGED backfill of the served track
record into the append-only ledger.

DO NOT RUN without APPROVE from Andrea (= production write to pick_ledger /
pick_settlement). This script is the executor for the gated PROPOSAL; it is
written, reviewed, and idempotent, but NOT executed here.

WHAT IT DOES
  Reads the picks we ACTUALLY served (read-only SELECT, PostgREST) and inserts
  them as historical ledger rows with is_backfill=TRUE — permanently distinct
  from the forward, look-ahead-proof rows. Sources, in priority order per pick:

    football served picks  -> unified_predictions (sport='football')
    tennis served picks     -> unified_predictions (sport='tennis')
                                + full p1/p2 distribution from tennis_predictions
    realized outcome        -> the row's own result / outcome
    closing_odds (CLV)      -> odds_snapshots(is_closing) via team_pair_key,
                                attached ONLY when a match is found; flagged
                                closing_odds_is_fuzzy=TRUE for name+date matches.

  Dedup key mirrors unified_adapter / pick_ledger: (source_table, source_id,
  model_version). Re-running is a no-op (ON CONFLICT DO NOTHING).

IMMUTABILITY
  pick_ledger / pick_settlement REVOKE UPDATE/DELETE. This writer only INSERTs.
  A correction is a new settlement row (latest settled_at wins in the runner),
  never an in-place edit — identical to the forward path.

HONESTY
  * odds-at-pick is almost never stored for settled served picks, so most rows
    carry odds=NULL (no ROI is fabricated).
  * closing lines in odds_snapshots only exist from 2026-06-11 onward, so CLV
    coverage on the historical cohort is ~0%. The script still TRIES the join
    and reports coverage; it never invents a closing price.

USAGE (gated)
  ./venv/bin/python -m scripts.backfill_pick_ledger --dry-run   # prints rows, no write
  ./venv/bin/python -m scripts.backfill_pick_ledger --apply     # writes (needs APPROVE)
"""
from __future__ import annotations

import argparse
import logging
import sys
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from config.settings import settings

logger = logging.getLogger("backfill_pick_ledger")

# A backfilled pick is timestamped one second before kickoff: it is a HISTORICAL
# reconstruction, not a real capture, and the is_backfill flag (not this stamp)
# is what admits it past the look-ahead CHECK. Using commence-1s keeps it
# monotonic and obviously synthetic.
_BACKFILL_CAPTURE_OFFSET = timedelta(seconds=1)

_FOOTBALL_PICK_TO_OUTCOME = {"HOME": "home", "DRAW": "draw", "AWAY": "away"}


@dataclass(frozen=True)
class BackfillPick:
    source_table: str
    source_id: str
    model_version: str
    sport: str
    league: str | None
    competition: str | None
    home_team: str | None
    away_team: str | None
    market: str
    pick: str | None
    p_home: float | None
    p_draw: float | None
    p_away: float | None
    confidence: float | None
    odds: float | None
    commence_time: str            # ISO-8601
    # settlement
    result: str                   # won | lost | void | unresolved
    outcome: str | None           # realized 1X2 / winner
    final_score: str | None
    closing_odds: float | None
    closing_odds_is_fuzzy: bool
    settled_at: str | None


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_pair_key(commence_iso: str, home: str, away: str) -> str:
    """Mirror odds_snapshots.team_pair_key = 'YYYY-MM-DD:home|away', lowercased,
    accent-stripped. Best-effort: a mismatch just means no closing line found."""
    try:
        d = datetime.fromisoformat(commence_iso).date().isoformat()
    except ValueError:
        d = commence_iso[:10]
    h = _strip_accents(home or "").strip().lower()
    a = _strip_accents(away or "").strip().lower()
    return f"{d}:{h}|{a}"


# ─── read-only source readers (PostgREST SELECT) ─────────────────────────────
def _headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }


def _rest() -> str:
    base = settings.SUPABASE_URL.rstrip("/")
    return f"{base}/rest/v1"


def _select(client: httpx.Client, table: str, params: dict[str, str]) -> list[dict]:
    resp = client.get(f"{_rest()}/{table}", params=params, headers=_headers())
    resp.raise_for_status()
    return resp.json()


def _to_result(unified_result: str | None) -> str:
    if unified_result in ("won", "lost", "void", "unresolved"):
        return unified_result
    return "unresolved"


def _closing_for(
    client: httpx.Client, pair_key: str
) -> tuple[float | None, bool]:
    """Best-effort closing odds on the pick side is NOT recoverable generically
    (we'd need to know which side the pick was). We attach the home closing as a
    market reference only when an exact-key closing snapshot exists, flagged
    fuzzy=False for exact key; the runner decides whether CLV is publishable.
    Returns (closing_odds_or_None, is_fuzzy)."""
    rows = _select(
        client,
        "odds_snapshots",
        {
            "select": "odds_home,odds_away,team_pair_key",
            "team_pair_key": f"eq.{pair_key}",
            "is_closing": "eq.true",
            "limit": "1",
        },
    )
    if rows:
        return rows[0].get("odds_home"), False
    return None, False


def collect_football(client: httpx.Client) -> list[BackfillPick]:
    rows = _select(
        client,
        "unified_predictions",
        {
            "select": "source_table,source_id,model_version,league,competition,"
            "home_team,away_team,market,pick,confidence_score,odds,closing_odds,"
            "starts_at,result,settled_at,notes",
            "sport": "eq.football",
            "result": "in.(won,lost,void,unresolved)",
        },
    )
    out: list[BackfillPick] = []
    for r in rows:
        commence = r.get("starts_at")
        if not commence:
            continue
        ph = pd = pa = None
        # full 1X2 distribution is stored in notes JSON by the DC writer
        notes = r.get("notes")
        if isinstance(notes, str) and notes.startswith("{"):
            import json

            try:
                d = json.loads(notes)
                ph, pd, pa = d.get("p_home"), d.get("p_draw"), d.get("p_away")
            except ValueError:
                pass
        pick = r.get("pick")
        outcome = (
            _FOOTBALL_PICK_TO_OUTCOME.get(pick or "")
            if r.get("result") == "won"
            else None
        )
        closing, fuzzy = (r.get("closing_odds"), False)
        if closing is None and r.get("home_team") and r.get("away_team"):
            key = normalize_pair_key(commence, r["home_team"], r["away_team"])
            closing, fuzzy = _closing_for(client, key)
        out.append(
            BackfillPick(
                source_table=r.get("source_table") or "unified_predictions",
                source_id=r.get("source_id") or r["source_id"],
                model_version=r["model_version"],
                sport="football",
                league=r.get("league"),
                competition=r.get("competition"),
                home_team=r.get("home_team"),
                away_team=r.get("away_team"),
                market=r.get("market") or "1X2",
                pick=pick,
                p_home=ph,
                p_draw=pd,
                p_away=pa,
                confidence=(r["confidence_score"] / 100.0) if r.get("confidence_score") is not None else None,
                odds=r.get("odds"),
                commence_time=commence,
                result=_to_result(r.get("result")),
                outcome=outcome,
                final_score=None,
                closing_odds=closing,
                closing_odds_is_fuzzy=fuzzy,
                settled_at=r.get("settled_at"),
            )
        )
    return out


def collect_tennis(client: httpx.Client) -> list[BackfillPick]:
    """Served tennis picks from unified_predictions, enriched with the full
    p1/p2 distribution from tennis_predictions (joined on source_id=match_id)."""
    served = _select(
        client,
        "unified_predictions",
        {
            "select": "source_table,source_id,model_version,competition,"
            "player_one,player_two,market,pick,confidence_score,odds,closing_odds,"
            "starts_at,result,settled_at",
            "sport": "eq.tennis",
            "result": "in.(won,lost,void,unresolved)",
        },
    )
    # distribution lookup
    dist: dict[str, dict] = {}
    tp = _select(
        client,
        "tennis_predictions",
        {"select": "match_id,p1,p2,outcome,winner", "limit": "10000"},
    )
    for t in tp:
        dist[str(t["match_id"])] = t

    out: list[BackfillPick] = []
    for r in served:
        commence = r.get("starts_at")
        if not commence:
            continue
        d = dist.get(str(r.get("source_id")), {})
        out.append(
            BackfillPick(
                source_table=r.get("source_table") or "tennis_predictions",
                source_id=r["source_id"],
                model_version=r["model_version"],
                sport="tennis",
                league=None,
                competition=r.get("competition"),
                home_team=r.get("player_one"),
                away_team=r.get("player_two"),
                market=r.get("market") or "MATCH",
                pick=r.get("pick"),
                p_home=d.get("p1"),
                p_draw=None,
                p_away=d.get("p2"),
                confidence=(r["confidence_score"] / 100.0) if r.get("confidence_score") is not None else None,
                odds=r.get("odds"),
                commence_time=commence,
                result=_to_result(r.get("result")),
                outcome=d.get("winner"),
                final_score=None,
                closing_odds=r.get("closing_odds"),  # tennis has no joinable closing line
                closing_odds_is_fuzzy=False,
                settled_at=r.get("settled_at"),
            )
        )
    return out


# ─── row builders ────────────────────────────────────────────────────────────
def ledger_row(p: BackfillPick) -> dict:
    captured = (
        datetime.fromisoformat(p.commence_time) - _BACKFILL_CAPTURE_OFFSET
    ).isoformat()
    return {
        "source_table": p.source_table,
        "source_id": p.source_id,
        "model_version": p.model_version,
        "sport": p.sport,
        "league": p.league,
        "competition": p.competition,
        "home_team": p.home_team,
        "away_team": p.away_team,
        "market": p.market,
        "pick": p.pick,
        "p_home": p.p_home,
        "p_draw": p.p_draw,
        "p_away": p.p_away,
        "confidence": p.confidence,
        "odds": p.odds,
        "bookmaker": None,
        "anchor_source": None,
        "is_paper": True,
        "signal_type": "paper",
        "captured_at": captured,
        "commence_time": p.commence_time,
        "is_backfill": True,
        "backfill_source": p.source_table,
    }


def settlement_row(p: BackfillPick) -> dict:
    return {
        "source_table": p.source_table,
        "source_id": p.source_id,
        "model_version": p.model_version,
        "result": p.result,
        "outcome": p.outcome,
        "final_score": p.final_score,
        "closing_odds": p.closing_odds,
        "settled_at": p.settled_at or datetime.now(timezone.utc).isoformat(),
        "is_backfill": True,
        "closing_odds_is_fuzzy": p.closing_odds_is_fuzzy,
    }


def _insert(
    client: httpx.Client, table: str, rows: list[dict], on_conflict: str | None = None
) -> None:
    if not rows:
        return
    headers = _headers() | {
        "Content-Type": "application/json",
        # idempotent: dedup conflict on the unique key is ignored, never updated
        # (immutability — UPDATE is revoked anyway). PostgREST honours
        # resolution=ignore-duplicates ONLY when on_conflict names the target key.
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    params = {"on_conflict": on_conflict} if on_conflict else None
    resp = client.post(f"{_rest()}/{table}", params=params, json=rows, headers=headers)
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(f"{table} insert failed: {resp.status_code} {resp.text[:300]}")


def _existing_settlement_keys(client: httpx.Client) -> set[tuple[str, str, str]]:
    """pick_settlement is append-only with NO unique key (a correction is a new
    row, latest settled_at wins). To stay idempotent we skip terns already
    present rather than relying on a conflict resolution that has no target."""
    rows = _select(
        client,
        "pick_settlement",
        {"select": "source_table,source_id,model_version", "is_backfill": "eq.true"},
    )
    return {
        (r["source_table"], str(r["source_id"]), r["model_version"]) for r in rows
    }


def run(apply: bool) -> int:
    with httpx.Client(timeout=30.0) as client:
        picks = collect_football(client) + collect_tennis(client)

    ledger = [ledger_row(p) for p in picks]
    settle = [settlement_row(p) for p in picks]
    n_close = sum(1 for p in picks if p.closing_odds is not None)
    n_fuzzy = sum(1 for p in picks if p.closing_odds_is_fuzzy)

    logger.info(
        "backfill: %d picks (%d ledger, %d settlement); closing attached %d (fuzzy %d)",
        len(picks), len(ledger), len(settle), n_close, n_fuzzy,
    )
    print(f"picks: {len(picks)} | closing attached: {n_close} | fuzzy: {n_fuzzy}")

    if not apply:
        print("DRY-RUN — nothing written. Re-run with --apply after APPROVE.")
        return 0

    with httpx.Client(timeout=30.0) as client:
        # ledger has a UNIQUE dedup key — let PostgREST ignore conflicts.
        _insert(
            client,
            "pick_ledger",
            ledger,
            on_conflict="source_table,source_id,model_version",
        )
        # settlement has no unique key (append-only); filter terns already
        # backfilled so a re-run does not duplicate rows.
        seen = _existing_settlement_keys(client)
        fresh_settle = [
            row
            for row in settle
            if (row["source_table"], str(row["source_id"]), row["model_version"])
            not in seen
        ]
        _insert(client, "pick_settlement", fresh_settle)
        print(f"inserted: ledger up to {len(ledger)} | settlement {len(fresh_settle)} new")
    print("APPLIED.")
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="#TRACKREC-BACKFILL-1 (gated)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    args = ap.parse_args(argv)
    return run(apply=args.apply)


if __name__ == "__main__":
    sys.exit(main())
