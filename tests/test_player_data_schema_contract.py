"""Schema-contract test: assert dataclass keys are a subset of real DB columns."""
import dataclasses

from core.player_models import PlayerProfile, PlayerMatchStat, PlayerLineupEntry

PLAYER_PROFILES_COLS = {
    "id", "player_id", "name", "team", "role", "importance_score", "status",
    "goals_last_5", "assists_last_5", "xg_contribution_last_5", "minutes_played_last_5",
    "updated_at", "league", "tier", "goals_per90_season", "xg_per90_season",
    "minutes_share", "penalty_taker", "eligible_for_player_markets", "last_updated",
}
PLAYER_MATCH_STATS_COLS = {
    "id", "player_id", "fixture_id", "league", "team", "minutes", "goals", "assists",
    "shots", "xg", "started", "match_date", "captured_at",
}
PLAYER_LINEUPS_COLS = {
    "id", "player_id", "fixture_id", "team", "position", "shirt_number", "is_starter", "confirmed_at",
}


def test_player_profile_keys_subset_of_columns():
    p = PlayerProfile(player_id="1", name="N", team="T", league="PL", tier=1,
                      role="Attacker", goals_per90_season=0.5, xg_per90_season=0.4,
                      minutes_share=0.9, penalty_taker=False,
                      eligible_for_player_markets=True, last_updated="2026-06-20")
    assert set(dataclasses.asdict(p)) <= PLAYER_PROFILES_COLS


def test_player_match_stat_keys_subset_of_columns():
    m = PlayerMatchStat(player_id="1", fixture_id=1, league="PL", team="T", minutes=90,
                        goals=1, assists=0, shots=3, xg=None, started=True, match_date="2026-05-01")
    assert set(dataclasses.asdict(m)) <= PLAYER_MATCH_STATS_COLS


def test_player_lineup_keys_subset_of_columns():
    e = PlayerLineupEntry(player_id="1", fixture_id=1, team="T", position="F",
                          shirt_number=10, is_starter=True)
    assert set(dataclasses.asdict(e)) <= PLAYER_LINEUPS_COLS
