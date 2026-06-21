"""Runner del collector quote anytime-goalscorer (B-odds glue).

Legge le predizioni calcio upcoming (WC da unified_predictions, leghe da
match_predictions) + i profili eleggibili dal DB, costruisce i resolver
(match + player) e popola public.player_odds via collect_goalscorer_odds.

[SCRIVE su player_odds] — usa --dry-run per verificare matching/fetch senza
scrivere e senza consumare la scrittura DB. Quota-aware (1 credit/evento solo
sugli eventi risolti in finestra). Fail-soft.

Uso:
  python -m scripts.collect_goalscorer_odds --dry-run
  python -m scripts.collect_goalscorer_odds --within-hours 72
"""
import argparse
import asyncio
import json
from datetime import datetime, timezone

import httpx

from core.supabase_client import _rest_base, _service_headers
from core.goalscorer_match_resolver import (
    build_match_resolver,
    build_player_resolver,
    odds_sport_keys_for,
)
from core.goalscorer_odds_collector import collect_goalscorer_odds


async def _get(client, base, headers, path, params):
    r = await client.get(f"{base}/{path}", params=params, headers=headers)
    if r.status_code != 200:
        return []
    return r.json() or []


async def _load_predictions(client, base, headers, since_iso: str):
    preds: list[dict] = []
    # WC + fallback nazionali (unified_predictions): match_id = external_event_id ?? source_id
    wc = await _get(client, base, headers, "unified_predictions", {
        "select": "external_event_id,source_id,league,home_team,away_team,starts_at",
        "sport": "eq.football",
        "starts_at": f"gte.{since_iso}",
        "limit": "300",
    })
    for r in wc:
        mid = r.get("external_event_id") or r.get("source_id")
        if mid:
            preds.append({
                "match_id": mid, "league": r.get("league") or "",
                "home_team": r.get("home_team", ""), "away_team": r.get("away_team", ""),
                "date_iso": r.get("starts_at", ""),
            })
    # Leghe domestiche (match_predictions): off-season ora, ma incluse per generalita`
    lg = await _get(client, base, headers, "match_predictions", {
        "select": "match_id,league,home_team,away_team,kickoff",
        "kickoff": f"gte.{since_iso}",
        "league": "neq.WC",
        "limit": "300",
    })
    for r in lg:
        if r.get("match_id"):
            preds.append({
                "match_id": r["match_id"], "league": r.get("league") or "",
                "home_team": r.get("home_team", ""), "away_team": r.get("away_team", ""),
                "date_iso": r.get("kickoff", ""),
            })
    return preds


async def _run(within_hours: int, dry_run: bool) -> dict:
    base = _rest_base()
    if not base:
        return {"error": "supabase non configurato (SUPABASE_URL/SERVICE_ROLE_KEY)"}
    headers = _service_headers()
    now = datetime.now(timezone.utc)
    since = (now.replace(microsecond=0)).isoformat()
    async with httpx.AsyncClient(timeout=20.0) as client:
        preds = await _load_predictions(client, base, headers, since)
        profiles = await _get(client, base, headers, "player_profiles", {
            "select": "player_id,name", "eligible_for_player_markets": "eq.true", "limit": "5000",
        })

    sport_keys = odds_sport_keys_for([p["league"] for p in preds])
    match_resolver = build_match_resolver(preds)
    player_resolver = build_player_resolver(profiles)

    summary = await collect_goalscorer_odds(
        sport_keys, match_resolver, now_iso=now.isoformat(),
        player_resolver=player_resolver, within_hours=within_hours, dry_run=dry_run,
    )
    summary["sport_keys"] = sport_keys
    summary["predictions_loaded"] = len(preds)
    summary["eligible_profiles"] = len(profiles)
    return summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--within-hours", type=int, default=48)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    summary = asyncio.run(_run(args.within_hours, args.dry_run))
    print(("DRY-RUN " if args.dry_run else "") + "summary: " + json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
