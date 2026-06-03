"""Team-name mapping Understat -> football-data.co.uk.

Understat uses full club names ("Manchester City"); football-data.co.uk uses
short forms ("Man City"). To join xG (Understat) onto the served/backtested
matches (fd.co.uk) we map Understat names to the fd.co.uk canonical. Names that
already match pass through unchanged. The override list below was derived by
diffing the two datasets' team sets across PL/PD/BL1/SA/FL1, 2021-2024.
"""
from __future__ import annotations

# Understat name -> football-data.co.uk name
UNDERSTAT_TO_FD: dict[str, str] = {
    # Premier League
    "Manchester City": "Man City",
    "Manchester United": "Man United",
    "Newcastle United": "Newcastle",
    "Nottingham Forest": "Nott'm Forest",
    "Wolverhampton Wanderers": "Wolves",
    # La Liga
    "Athletic Club": "Ath Bilbao",
    "Atletico Madrid": "Ath Madrid",
    "Celta Vigo": "Celta",
    "Espanyol": "Espanol",
    "Rayo Vallecano": "Vallecano",
    "Real Betis": "Betis",
    "Real Sociedad": "Sociedad",
    "Real Valladolid": "Valladolid",
    # Bundesliga
    "Arminia Bielefeld": "Bielefeld",
    "Bayer Leverkusen": "Leverkusen",
    "Borussia Dortmund": "Dortmund",
    "Borussia M.Gladbach": "M'gladbach",
    "Eintracht Frankfurt": "Ein Frankfurt",
    "FC Cologne": "FC Koln",
    "FC Heidenheim": "Heidenheim",
    "Greuther Fuerth": "Greuther Furth",
    "Hertha Berlin": "Hertha",
    "Mainz 05": "Mainz",
    "RasenBallsport Leipzig": "RB Leipzig",
    "St. Pauli": "St Pauli",
    "VfB Stuttgart": "Stuttgart",
    # Serie A
    "AC Milan": "Milan",
    "Parma Calcio 1913": "Parma",
    # Ligue 1
    "Clermont Foot": "Clermont",
    "Paris Saint Germain": "Paris SG",
    "Saint-Etienne": "St Etienne",
}


def understat_to_fd(name: str) -> str:
    """Map an Understat team name to its football-data.co.uk form (identity if no override)."""
    return UNDERSTAT_TO_FD.get(name, name)


def coverage(understat_names: set[str], fd_names: set[str]) -> float:
    """Fraction of Understat names that resolve to a known fd.co.uk name (1.0 = full)."""
    if not understat_names:
        return 1.0
    hit = sum(1 for n in understat_names if understat_to_fd(n) in fd_names)
    return hit / len(understat_names)
