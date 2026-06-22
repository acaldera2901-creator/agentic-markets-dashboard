import json
import pathlib

from core.espn_player_stats import parse_summary_players, aggregate_players
from core.player_data_tier import min_appearances_for
from core.player_models import build_profile

FIX = json.loads(
    (pathlib.Path(__file__).parent / "fixtures" / "espn_summary_wc.json").read_text()
)


def test_parse_real_fixture_returns_players_with_stats():
    rows = parse_summary_players(FIX)
    assert rows, "deve estrarre giocatori dal fixture reale"
    # tutti hanno appeared (APP>=1), team valorizzato, chiavi attese
    for r in rows:
        assert r["player_id"] and r["team"]
        assert r["appearances"] == 1
        assert r["minutes"] in (90, 30)
        assert {"goals", "assists", "shots", "started"} <= set(r)
    # almeno un titolare con 90'
    assert any(r["started"] and r["minutes"] == 90 for r in rows)


def test_parse_skips_non_appearing():
    summary = {"rosters": [{"team": {"displayName": "X"}, "roster": [
        {"athlete": {"id": "1", "displayName": "Played"}, "starter": True,
         "stats": [{"abbreviation": "APP", "displayValue": "1"}, {"abbreviation": "G", "displayValue": "1"}]},
        {"athlete": {"id": "2", "displayName": "Benched"}, "starter": False,
         "stats": [{"abbreviation": "APP", "displayValue": "0"}]},
    ]}]}
    rows = parse_summary_players(summary)
    assert [r["name"] for r in rows] == ["Played"]
    assert rows[0]["goals"] == 1


def test_aggregate_sums_across_matches():
    # stesso giocatore in 2 partite: 1 gol + titolare, poi 1 gol + sub
    m1 = [{"player_id": "9", "name": "Bomber", "team": "Spain", "goals": 1, "assists": 0,
           "shots": 3, "appearances": 1, "minutes": 90, "started": True}]
    m2 = [{"player_id": "9", "name": "Bomber", "team": "Spain", "goals": 1, "assists": 1,
           "shots": 2, "appearances": 1, "minutes": 30, "started": False}]
    agg = aggregate_players(m1 + m2, league="WC", season=2026)
    assert len(agg) == 1
    s = agg[0]
    assert s.player_id == "9" and s.goals == 2 and s.assists == 1
    assert s.appearances == 2 and s.minutes == 120 and s.shots == 5
    assert s.league == "WC" and s.team == "Spain"


def test_goals_per90_capped():
    from core.player_models import GOALS_PER90_CAP
    # subentrato: 2 gol in 30' -> raw 6.0/90 -> deve essere cappato
    s = aggregate_players([
        {"player_id": "1", "name": "Sub", "team": "X", "goals": 2, "assists": 0,
         "shots": 2, "appearances": 1, "minutes": 30, "started": False},
        {"player_id": "1", "name": "Sub", "team": "X", "goals": 0, "assists": 0,
         "shots": 0, "appearances": 1, "minutes": 30, "started": False},
    ], league="WC", season=2026)[0]
    p = build_profile(s, None, "2026-06-21", min_appearances=2)
    assert p.goals_per90_season == GOALS_PER90_CAP


def test_tournament_floor_lets_wc_player_through():
    assert min_appearances_for("WC") == 1   # interim (era 2)
    assert min_appearances_for("PL") == 2   # interim (era 5)
    # WC bomber con 2 presenze e 2 gol -> eleggibile con soglia torneo, NON con 5
    s = aggregate_players([
        {"player_id": "9", "name": "B", "team": "Spain", "goals": 1, "assists": 0,
         "shots": 1, "appearances": 1, "minutes": 90, "started": True},
        {"player_id": "9", "name": "B", "team": "Spain", "goals": 1, "assists": 0,
         "shots": 1, "appearances": 1, "minutes": 90, "started": True},
    ], league="WC", season=2026)[0]
    p_tourn = build_profile(s, None, "2026-06-21", min_appearances=min_appearances_for("WC"))
    p_strict = build_profile(s, None, "2026-06-21", min_appearances=5)
    assert p_tourn.eligible_for_player_markets is True
    assert p_strict.eligible_for_player_markets is False
    assert p_tourn.tier == 2  # WC = tier 2 (no xG)
    assert p_tourn.goals_per90_season > 0
