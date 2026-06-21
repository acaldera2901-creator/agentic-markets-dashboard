"""Resolver per il collector quote marcatore (B-odds glue).

Mappa un evento The Odds API (home/away/commence_time) al NOSTRO match_id,
confrontando nomi squadra normalizzati+token-sorted e data. Fail-open: evento
non risolto -> None (il collector lo salta, niente riga orfana). Puro/testabile.
"""
from __future__ import annotations
from datetime import datetime, timedelta

# Nostro codice lega -> sport key The Odds API. Solo WC e` in stagione ora;
# le top-5 si accendono da sole quando l'API le ritorna attive (stessi key).
LEAGUE_TO_ODDS_SPORT: dict[str, str] = {
    "WC": "soccer_fifa_world_cup",
    "PL": "soccer_epl",
    "SA": "soccer_italy_serie_a",
    "PD": "soccer_spain_la_liga",
    "BL1": "soccer_germany_bundesliga",
    "FL1": "soccer_france_ligue_one",
}


def _norm(s: str) -> str:
    return " ".join((s or "").strip().lower().split())


def _pair_key(home: str, away: str) -> str:
    # token-sorted: tollera inversione home/away e varianti d'ordine
    return "|".join(sorted([_norm(home), _norm(away)]))


def _to_date(iso: str):
    try:
        return datetime.fromisoformat((iso or "").replace("Z", "+00:00")).date()
    except (ValueError, AttributeError):
        return None


def odds_sport_keys_for(leagues) -> list[str]:
    """Sport key Odds API per le leghe che abbiamo a board (dedup, ordine stabile)."""
    out: list[str] = []
    for lg in leagues or []:
        key = LEAGUE_TO_ODDS_SPORT.get(lg)
        if key and key not in out:
            out.append(key)
    return out


def build_match_resolver(predictions):
    """predictions: iterable di dict {match_id, home_team, away_team, date_iso}.
    Ritorna fn(event)->match_id|None. Match per coppia-squadre token-sorted +
    data (con tolleranza +/-1 giorno per fuso orario)."""
    index: dict[tuple[str, object], str] = {}
    for p in predictions or []:
        mid = p.get("match_id")
        d = _to_date(p.get("date_iso", ""))
        if not mid or d is None:
            continue
        index[(_pair_key(p.get("home_team", ""), p.get("away_team", "")), d)] = mid

    def resolve(event: dict):
        key = _pair_key(event.get("home_team", ""), event.get("away_team", ""))
        ed = _to_date(event.get("commence_time", ""))
        if ed is None:
            return None
        for delta in (0, 1, -1):  # tolleranza fuso
            mid = index.get((key, ed + timedelta(days=delta)))
            if mid:
                return mid
        return None

    return resolve


def build_player_resolver(profile_rows):
    """profile_rows: iterable di dict {player_id, name}. Ritorna fn(name)->player_id|None
    per nome normalizzato. Fail-open: nessun match -> None."""
    by_name: dict[str, str] = {}
    for r in profile_rows or []:
        pid = r.get("player_id")
        nm = _norm(r.get("name", ""))
        if pid and nm:
            by_name.setdefault(nm, pid)

    def resolve(name: str):
        return by_name.get(_norm(name))

    return resolve
