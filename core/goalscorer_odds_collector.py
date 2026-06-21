"""Collector quota-aware delle quote anytime-goalscorer. Fail-soft."""
from __future__ import annotations
import dataclasses
from datetime import datetime

from core.odds_api_goalscorer import get_events, get_event_goalscorer_odds
from core.goalscorer_odds_normalize import parse_event_odds, PlayerOddRow
from core.player_data_writers import upsert_player_odds


def _parse_iso(s: str) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def PlayerOddRow_with_id(row: PlayerOddRow, player_id):
    return dataclasses.replace(row, player_id=player_id)


async def collect_goalscorer_odds(sport_keys, match_resolver, now_iso: str,
                                  player_resolver=None, within_hours: int = 48) -> dict:
    summary = {"events": 0, "rows_written": 0, "errors": []}
    now = _parse_iso(now_iso)
    for sport in sport_keys:
        try:
            events = await get_events(sport)
        except Exception as exc:
            summary["errors"].append(f"{sport}:events:{exc}")
            continue
        for ev in events:
            try:
                start = _parse_iso(ev.get("commence_time", ""))
                if now and start:
                    delta_h = (start - now).total_seconds() / 3600.0
                    if delta_h < 0 or delta_h > within_hours:
                        continue  # fuori finestra pre-match
                match_id = match_resolver(ev)
                if not match_id:
                    continue  # no riga orfana
                raw = await get_event_goalscorer_odds(sport, ev["id"])
                rows = parse_event_odds(raw, match_id=match_id, sport_key=sport)
                if player_resolver:
                    rows = [PlayerOddRow_with_id(r, player_resolver(r.player_name)) for r in rows]
                if rows:
                    summary["rows_written"] += await upsert_player_odds(rows)
                    summary["events"] += 1
            except Exception as exc:
                summary["errors"].append(f"{sport}:{ev.get('id')}:{exc}")
    return summary
