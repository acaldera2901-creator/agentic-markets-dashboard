"""Tier mapping + fail-closed eligibility per i dati giocatore.

Tier 1 = leghe con xG individuale (Understat). Tier 2 = solo api-football
(gol/assist/minuti/tiri, niente xG). Tier 0 / lega sconosciuta = fail-closed.
"""
from datetime import date

# INTERIM (2026-06-22, scelta Andrea): soglie abbassate per accendere il blocco
# Marcatori ORA su dato debole, in attesa di una fonte goal-rate affidabile.
# Tradeoff accettato: campioni sottili (1-2 gare) -> confidenza dichiarata bassa,
# protetti dal cap goals_per90 (1.3) in player_models. UPGRADE: appena arriva la
# fonte paid (api-football tier a pagamento), ripristinare 5 / 2 per qualita` piena.
MIN_APPEARANCES = 2             # era 5 (interim)
MIN_APPEARANCES_TOURNAMENT = 1  # era 2 — tornei: campione piccolo -> soglia minima (interim)
FORM_WINDOW = 10
STALE_DAYS = 30

# Competizioni a torneo/eliminazione: poche partite per giocatore -> soglia
# presenze piu` bassa (con confidenza dichiarata inferiore lato modello/card).
TOURNAMENT_LEAGUES = {"WC", "FRIENDLY", "CL", "EL", "ECL"}


def min_appearances_for(code: str) -> int:
    return MIN_APPEARANCES_TOURNAMENT if code in TOURNAMENT_LEAGUES else MIN_APPEARANCES

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

def is_eligible(appearances: int, last_updated_iso: str | None, today_iso: str,
                min_appearances: int = MIN_APPEARANCES) -> bool:
    if appearances < min_appearances:
        return False
    if not last_updated_iso:
        return False
    try:
        delta = (date.fromisoformat(today_iso) - date.fromisoformat(last_updated_iso[:10])).days
    except ValueError:
        return False
    return 0 <= delta <= STALE_DAYS
