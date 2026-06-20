"""Tier mapping + fail-closed eligibility per i dati giocatore.

Tier 1 = leghe con xG individuale (Understat). Tier 2 = solo api-football
(gol/assist/minuti/tiri, niente xG). Tier 0 / lega sconosciuta = fail-closed.
"""
from datetime import date

MIN_APPEARANCES = 5
FORM_WINDOW = 10
STALE_DAYS = 30

LEAGUE_DATA_TIER: dict[str, dict] = {
    "PL":  {"id": 39,  "name": "Premier League", "tier": 1},
    "SA":  {"id": 135, "name": "Serie A",        "tier": 1},
    "PD":  {"id": 140, "name": "La Liga",        "tier": 1},
    "BL1": {"id": 78,  "name": "Bundesliga",     "tier": 1},
    "FL1": {"id": 61,  "name": "Ligue 1",        "tier": 1},
    "CL":  {"id": 2,   "name": "Champions League", "tier": 2},
    "EL":  {"id": 3,   "name": "Europa League",  "tier": 2},
    "ECL": {"id": 848, "name": "Conference League", "tier": 2},
    "WC":  {"id": 1,   "name": "FIFA World Cup", "tier": 2},
    "ELI": {"id": 103, "name": "Eliteserien",    "tier": 2},
    "ALL": {"id": 113, "name": "Allsvenskan",    "tier": 2},
    "VEI": {"id": 244, "name": "Veikkausliiga",  "tier": 2},
    "LOI": {"id": 357, "name": "League of Ireland", "tier": 2},
    "CSL": {"id": 169, "name": "Super League",   "tier": 2},
}

def tier_for_league(code: str) -> int:
    entry = LEAGUE_DATA_TIER.get(code)
    return entry["tier"] if entry else 0

def is_eligible(appearances: int, last_updated_iso: str | None, today_iso: str) -> bool:
    if appearances < MIN_APPEARANCES:
        return False
    if not last_updated_iso:
        return False
    try:
        delta = (date.fromisoformat(today_iso) - date.fromisoformat(last_updated_iso[:10])).days
    except ValueError:
        return False
    return 0 <= delta <= STALE_DAYS
