"""Parser xG per-giocatore dalle pagine-lega Understat (Tier 1).

Understat incorpora i dati come `var playersData = JSON.parse('[...]')`.
Estrae il blob, calcola xG/90 per giocatore. Puro e fail-soft.
"""
from __future__ import annotations
import json
import re

_BLOB = re.compile(r"playersData\s*=\s*JSON\.parse\('(.+?)'\)", re.DOTALL)


def normalize_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def parse_players_data(page_text: str) -> dict[str, float]:
    m = _BLOB.search(page_text or "")
    if not m:
        return {}
    captured = m.group(1)
    records = None
    for candidate in (captured, captured.encode("utf-8").decode("unicode_escape")):
        try:
            records = json.loads(candidate)
            break
        except (ValueError, TypeError):
            continue
    if not isinstance(records, list):
        return {}
    out: dict[str, float] = {}
    for r in records:
        try:
            minutes = float(r.get("time") or 0)
            xg = float(r.get("xG") or 0)
            if minutes <= 0:
                continue
            out[normalize_name(r.get("player_name", ""))] = xg / minutes * 90
        except (ValueError, TypeError):
            continue
    return out
