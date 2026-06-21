"""Fonte profili giocatore da ESPN (gratis, copre WC + club leagues).

api-football free non da` le statistiche giocatore; ESPN summary-partita si`:
rosters[].roster[] -> per-giocatore {athlete, starter, subbedIn/Out, stats}
dove stats include G (gol), A (assist), SHOT, APP (presenza).

Strategia: per ogni partita conclusa di una competizione si estraggono le righe
per-giocatore, poi si aggregano per giocatore -> goals/appearances/minuti stimati
-> PlayerSeasonStat -> build_profile (con soglia per-competizione).

Questo modulo: parser + aggregatore PURI (testati su fixture reale). L'I/O (fetch
ESPN) e il backfill vivono nel runner.
"""
from __future__ import annotations

from core.player_models import PlayerSeasonStat

# Minuti stimati per presenza (ESPN non espone i minuti diretti nello stats blob):
# titolare ~90, subentrato ~30. Approssimazione documentata (per goals_per90).
_MIN_STARTER = 90
_MIN_SUB = 30


def _stat_map(stats) -> dict:
    if isinstance(stats, list):
        out = {}
        for s in stats:
            if isinstance(s, dict):
                key = s.get("abbreviation") or s.get("name")
                if key:
                    out[key] = s.get("displayValue", s.get("value"))
        return out
    return stats if isinstance(stats, dict) else {}


def _to_int(v) -> int:
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return 0


def parse_summary_players(summary_json: dict) -> list[dict]:
    """Estrae le righe per-giocatore di UNA partita dal summary ESPN.
    Ritorna solo i giocatori che sono scesi in campo (APP>=1)."""
    out: list[dict] = []
    for team_block in summary_json.get("rosters") or []:
        team = (team_block.get("team") or {}).get("displayName", "")
        for p in team_block.get("roster") or []:
            ath = p.get("athlete") or {}
            pid = ath.get("id")
            if not pid:
                continue
            sm = _stat_map(p.get("stats"))
            appeared = _to_int(sm.get("APP"))
            if appeared < 1:
                continue  # non sceso in campo
            started = bool(p.get("starter"))
            out.append({
                "player_id": str(pid),
                "name": ath.get("displayName", ""),
                "team": team,
                "goals": _to_int(sm.get("G")),
                "assists": _to_int(sm.get("A")),
                "shots": _to_int(sm.get("SHOT")),
                "appearances": 1,
                "minutes": _MIN_STARTER if started else _MIN_SUB,
                "started": started,
            })
    return out


def aggregate_players(rows: list[dict], league: str, season: int) -> list[PlayerSeasonStat]:
    """Aggrega le righe per-partita (parse_summary_players su piu` partite) per
    giocatore -> PlayerSeasonStat."""
    acc: dict[str, dict] = {}
    for r in rows or []:
        pid = r.get("player_id")
        if not pid:
            continue
        a = acc.get(pid)
        if a is None:
            a = {"name": r.get("name", ""), "team": r.get("team", ""),
                 "appearances": 0, "minutes": 0, "goals": 0, "assists": 0, "shots": 0}
            acc[pid] = a
        a["appearances"] += r.get("appearances", 0)
        a["minutes"] += r.get("minutes", 0)
        a["goals"] += r.get("goals", 0)
        a["assists"] += r.get("assists", 0)
        a["shots"] += r.get("shots", 0)
        # team/name: tieni l'ultimo visto (piu` recente)
        if r.get("team"):
            a["team"] = r["team"]
        if r.get("name"):
            a["name"] = r["name"]

    out: list[PlayerSeasonStat] = []
    for pid, a in acc.items():
        out.append(PlayerSeasonStat(
            player_id=pid, name=a["name"], team=a["team"], league=league,
            position="", appearances=a["appearances"], minutes=a["minutes"],
            goals=a["goals"], assists=a["assists"], shots=a["shots"], season=season,
        ))
    return out
