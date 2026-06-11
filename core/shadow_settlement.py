"""Shadow-eval settlement — resolve outcomes + closing odds, settle forward.

Pure resolvers (outcome_from_*) + an async runner (settle_once). Reads the
realized outcome from the ALREADY-settled served predictions (we do not run our
own result provider — we mirror the served settlement, so the shadow can never
disagree with the public track record) and the book CLOSING price from
odds_snapshots (is_closing=true). Writes only sportsbook_shadow_eval. Fail-soft.
"""
from __future__ import annotations

import logging

from config.settings import settings

logger = logging.getLogger("shadow_settlement")


def outcome_from_score(final_score: str | None) -> int | None:
    """'H-A' -> 0 home win / 1 draw / 2 away win. None if unparseable."""
    if not final_score or "-" not in final_score:
        return None
    try:
        h, a = final_score.split("-", 1)
        hg, ag = int(h.strip()), int(a.strip())
    except (ValueError, AttributeError):
        return None
    return 0 if hg > ag else 1 if hg == ag else 2


def outcome_from_tennis(outcome: str | None) -> int | None:
    """P1_WIN -> 0, P2_WIN -> 2 (slot mapping, draw index unused). None else."""
    if outcome == "P1_WIN":
        return 0
    if outcome == "P2_WIN":
        return 2
    return None


def _won_lost_void(shadow_pick: int | None, outcome_idx: int | None) -> str:
    if outcome_idx is None:
        return "unresolved"
    if shadow_pick is None:
        return "void"
    return "won" if int(shadow_pick) == int(outcome_idx) else "lost"


async def settle_once(cutoff_minutes: int = 115, limit: int = 200) -> int:
    """Settle shadow rows whose match resolved. Returns rows settled. Fail-soft."""
    import httpx

    from core.supabase_client import (
        fetch_unsettled_shadow_eval,
        settle_shadow_eval_row,
    )

    base = f"{(settings.SUPABASE_URL or '').rstrip('/')}/rest/v1"
    if not settings.SUPABASE_SERVICE_ROLE_KEY or not settings.SUPABASE_URL:
        return 0
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }

    pending = await fetch_unsettled_shadow_eval(cutoff_minutes, limit)
    if not pending:
        return 0

    settled = 0
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for r in pending:
                try:
                    outcome_idx = await _resolve_outcome(client, base, headers, r)
                    if outcome_idx is None:
                        continue  # served row not settled yet -> retry next cycle
                    closing = await _closing_odds(client, base, headers, r)
                    result = _won_lost_void(r.get("shadow_pick"), outcome_idx)
                    if await settle_shadow_eval_row(
                        int(r["id"]), outcome_idx=outcome_idx,
                        result=result, closing_odds=closing,
                    ):
                        settled += 1
                except Exception as exc:
                    logger.warning("shadow settle row %s error: %s", r.get("id"), exc)
    except Exception as exc:
        logger.warning("shadow settle_once failed (non-fatal): %s", exc)
    if settled:
        logger.info("shadow-eval: settled %d rows", settled)
    return settled


async def _resolve_outcome(client, base, headers, r) -> int | None:
    if r["ref_source"] == "unified_predictions":
        resp = await client.get(
            f"{base}/unified_predictions",
            params={"select": "result,notes", "id": f"eq.{r['prediction_ref']}",
                    "result": "in.(won,lost,void)", "limit": "1"},
            headers=headers,
        )
        if resp.status_code != 200 or not resp.json():
            return None
        import json
        try:
            notes = json.loads(resp.json()[0].get("notes") or "{}")
        except (TypeError, ValueError):
            notes = {}
        return outcome_from_score(notes.get("final_score"))
    if r["ref_source"] == "tennis_predictions":
        resp = await client.get(
            f"{base}/tennis_predictions",
            params={"select": "outcome", "match_id": f"eq.{r['prediction_ref']}",
                    "limit": "1"},
            headers=headers,
        )
        if resp.status_code != 200 or not resp.json():
            return None
        return outcome_from_tennis(resp.json()[0].get("outcome"))
    return None


async def _closing_odds(client, base, headers, r) -> float | None:
    """Book closing price on the shadow pick (is_closing row, same book+pair)."""
    key = r.get("team_pair_key")
    if not key or r.get("shadow_pick") is None:
        return None
    resp = await client.get(
        f"{base}/odds_snapshots",
        params={"select": "odds_home,odds_draw,odds_away,captured_at",
                "team_pair_key": f"eq.{key}", "source": f"eq.{r['book']}",
                "is_closing": "eq.true", "order": "captured_at.desc", "limit": "1"},
        headers=headers,
    )
    if resp.status_code != 200 or not resp.json():
        return None
    row = resp.json()[0]
    col = {0: "odds_home", 1: "odds_draw", 2: "odds_away"}[int(r["shadow_pick"])]
    return row.get(col)
