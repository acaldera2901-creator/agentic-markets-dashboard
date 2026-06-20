from core.player_models import normalize_season_stats, build_profile

# shape reale di api-football /players?league=&season=
RAW_PLAYERS = [{
    "player": {"id": 276, "name": "Neymar"},
    "statistics": [{
        "team": {"name": "PSG"},
        "league": {"name": "Ligue 1"},
        "games": {"appearences": 20, "minutes": 1700, "position": "Attacker"},
        "goals": {"total": 13, "assists": 6},
        "shots": {"total": 55, "on": 30},
    }],
}]

def test_normalize_season_stats_parses_apifootball_shape():
    out = normalize_season_stats(RAW_PLAYERS, league="FL1", season=2025)
    assert len(out) == 1
    s = out[0]
    assert s.player_id == "276"
    assert s.goals == 13 and s.assists == 6 and s.minutes == 1700
    assert s.appearances == 20 and s.position == "Attacker"

def test_normalize_skips_null_appearances():
    raw = [{"player": {"id": 9, "name": "Sub"},
            "statistics": [{"games": {"appearences": None, "minutes": 0},
                            "goals": {"total": 0, "assists": 0},
                            "shots": {"total": 0, "on": 0}}]}]
    assert normalize_season_stats(raw, "FL1", 2025) == []

def test_build_profile_computes_per90_and_eligibility():
    s = normalize_season_stats(RAW_PLAYERS, "FL1", 2025)[0]
    p = build_profile(s, xg_per90=0.62, today_iso="2026-06-20")
    assert round(p.goals_per90_season, 2) == round(13 / 1700 * 90, 2)
    assert p.tier == 1            # FL1 è tier 1
    assert p.xg_per90_season == 0.62
    assert p.eligible_for_player_markets is True   # 20 presenze > 5

def test_build_profile_fail_closed_below_floor():
    raw = [{"player": {"id": 1, "name": "Rookie"},
            "statistics": [{"team": {"name": "X"}, "league": {"name": "Y"},
                            "games": {"appearences": 3, "minutes": 200, "position": "Midfielder"},
                            "goals": {"total": 0, "assists": 0},
                            "shots": {"total": 2, "on": 0}}]}]
    s = normalize_season_stats(raw, "ELI", 2025)[0]
    p = build_profile(s, xg_per90=None, today_iso="2026-06-20")
    assert p.tier == 2
    assert p.xg_per90_season is None
    assert p.eligible_for_player_markets is False  # 3 < MIN_APPEARANCES
