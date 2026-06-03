"""Tests for Understat -> football-data.co.uk team mapping (incl. live coverage)."""
from pathlib import Path

from core.football_data_uk import parse_csv as fd_parse
from core.team_mapping import coverage, understat_to_fd
from core.understat_data import load as us_load


def test_known_overrides():
    assert understat_to_fd("Manchester City") == "Man City"
    assert understat_to_fd("Atletico Madrid") == "Ath Madrid"
    assert understat_to_fd("Borussia M.Gladbach") == "M'gladbach"
    assert understat_to_fd("Paris Saint Germain") == "Paris SG"


def test_identity_passthrough():
    assert understat_to_fd("Arsenal") == "Arsenal"
    assert understat_to_fd("Inter") == "Inter"


def test_full_coverage_against_real_datasets():
    """Every Understat team must resolve to an fd.co.uk name, per league."""
    fd_teams: dict[str, set] = {}
    for fp in sorted(Path("data/football_data_uk").glob("*.csv")):
        lg = fp.name.split("_")[0]
        for m in fd_parse(fp.read_text(encoding="utf-8", errors="replace"), lg):
            fd_teams.setdefault(lg, set()).update([m.home_team, m.away_team])

    us_teams: dict[str, set] = {}
    for m in us_load():
        us_teams.setdefault(m.league, set()).update([m.home_team, m.away_team])

    for lg, us in us_teams.items():
        cov = coverage(us, fd_teams.get(lg, set()))
        assert cov == 1.0, f"{lg}: coverage {cov:.2%} — unmapped: {sorted(n for n in us if understat_to_fd(n) not in fd_teams.get(lg, set()))}"
