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
                                  player_resolver=None, within_hours: int = 48,
                                  dry_run: bool = False, quota=None) -> dict:
    # dry_run=True: risolve+fetch+parse ma NON scrive (conta le righe che
    # scriverebbe). Utile per verificare il matching senza toccare player_odds.
    #
    # #ODDS-QUOTA-GUARD: get_event_goalscorer_odds usa l'endpoint EVENT-LEVEL di
    # The Odds API (1 credito/evento, region us × 1 market). Prima girava NON
    # contato → footgun che poteva drenare l'account condiviso (tennis/data_hub).
    # Ora, se `quota` (QuotaTracker) è passato, ogni fetch rispetta il cap
    # (can_call) e viene contato (increment) sullo STESSO budget 'odds_api'.
    # NB il fetch spende crediti anche in dry_run → gate+conteggio valgono sempre.
    summary = {"events": 0, "rows_written": 0, "matched": 0, "quota_skipped": 0, "errors": []}
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
                summary["matched"] += 1
                # #ODDS-QUOTA-GUARD: sotto il cap del budget condiviso non chiamiamo
                # l'endpoint event-level (protegge tennis/data_hub dal drain).
                if quota is not None and not quota.can_call("odds_api"):
                    summary["quota_skipped"] += 1
                    continue
                raw = await get_event_goalscorer_odds(sport, ev["id"])
                if quota is not None:
                    await quota.increment("odds_api", 1)  # 1 region × 1 market
                rows = parse_event_odds(raw, match_id=match_id, sport_key=sport)
                if player_resolver:
                    rows = [PlayerOddRow_with_id(r, player_resolver(r.player_name)) for r in rows]
                if rows:
                    if dry_run:
                        summary["rows_written"] += len(rows)  # conteggio, nessuna scrittura
                    else:
                        summary["rows_written"] += await upsert_player_odds(rows)
                    summary["events"] += 1
            except Exception as exc:
                summary["errors"].append(f"{sport}:{ev.get('id')}:{exc}")
    return summary
