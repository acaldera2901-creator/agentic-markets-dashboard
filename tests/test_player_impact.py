"""
Unit tests for learning.player_impact.PlayerImpactModel
Run: pytest tests/test_player_impact.py -v
"""
import datetime
import pytest
from learning.player_impact import PlayerImpactModel, PlayerProfile, PlayerStatus


@pytest.fixture
def model():
    return PlayerImpactModel()


def _profile(player_id="p-001", role="striker", importance=0.8):
    return PlayerProfile(
        player_id=player_id,
        name="Test Player",
        team="home",
        role=role,
        importance_score=importance,
        goals_last_5=3,
        assists_last_5=1,
        xg_contribution_last_5=2.1,
        minutes_played_last_5=450,
    )


# ── PlayerProfile ─────────────────────────────────────────────────────────────

class TestPlayerProfile:
    def test_register_player(self, model):
        profile = _profile()
        model.register_player(profile)
        retrieved = model.get_player("p-001")
        assert retrieved is not None

    def test_get_unknown_player_returns_none(self, model):
        assert model.get_player("nonexistent") is None

    def test_player_has_importance_score(self, model):
        profile = _profile(importance=0.9)
        model.register_player(profile)
        p = model.get_player("p-001")
        assert p.importance_score == pytest.approx(0.9)

    def test_update_player_status(self, model):
        model.register_player(_profile())
        model.update_status("p-001", PlayerStatus.INJURED)
        p = model.get_player("p-001")
        assert p.status == PlayerStatus.INJURED

    def test_update_status_unknown_player_raises(self, model):
        with pytest.raises(KeyError):
            model.update_status("no-such-player", PlayerStatus.INJURED)


# ── compute_lineup_delta ──────────────────────────────────────────────────────

class TestComputeLineupDelta:
    def test_returns_float(self, model):
        model.register_player(_profile("p-001", "striker", 0.8))
        delta = model.compute_lineup_delta(
            available_home=["p-001"],
            missing_home=[],
            available_away=[],
            missing_away=[],
        )
        assert isinstance(delta, float)

    def test_missing_key_home_player_negative_delta(self, model):
        model.register_player(_profile("p-001", "striker", 0.9))
        delta = model.compute_lineup_delta(
            available_home=[],
            missing_home=["p-001"],
            available_away=[],
            missing_away=[],
        )
        assert delta < 0

    def test_missing_key_away_player_positive_delta(self, model):
        model.register_player(_profile("p-001", "striker", 0.9))
        delta = model.compute_lineup_delta(
            available_home=[],
            missing_home=[],
            available_away=[],
            missing_away=["p-001"],
        )
        assert delta > 0

    def test_equal_missing_balanced_delta(self, model):
        model.register_player(_profile("p-001", "striker", 0.8))
        model.register_player(_profile("p-002", "striker", 0.8))
        delta = model.compute_lineup_delta(
            available_home=[],
            missing_home=["p-001"],
            available_away=[],
            missing_away=["p-002"],
        )
        assert delta == pytest.approx(0.0, abs=0.01)

    def test_no_players_delta_is_zero(self, model):
        delta = model.compute_lineup_delta([], [], [], [])
        assert delta == pytest.approx(0.0)

    def test_unknown_players_ignored(self, model):
        delta = model.compute_lineup_delta(
            available_home=[],
            missing_home=["unknown-id"],
            available_away=[],
            missing_away=[],
        )
        assert delta == pytest.approx(0.0)


# ── injury risk ───────────────────────────────────────────────────────────────

class TestInjuryRisk:
    def test_injured_player_has_zero_availability(self, model):
        model.register_player(_profile())
        model.update_status("p-001", PlayerStatus.INJURED)
        risk = model.player_availability_risk(["p-001"])
        assert risk["p-001"] == pytest.approx(0.0)

    def test_available_player_has_full_availability(self, model):
        model.register_player(_profile())
        risk = model.player_availability_risk(["p-001"])
        assert risk["p-001"] == pytest.approx(1.0)

    def test_suspended_player_has_zero_availability(self, model):
        model.register_player(_profile())
        model.update_status("p-001", PlayerStatus.SUSPENDED)
        risk = model.player_availability_risk(["p-001"])
        assert risk["p-001"] == pytest.approx(0.0)

    def test_doubtful_player_has_partial_availability(self, model):
        model.register_player(_profile())
        model.update_status("p-001", PlayerStatus.DOUBTFUL)
        risk = model.player_availability_risk(["p-001"])
        assert 0.0 < risk["p-001"] < 1.0

    def test_unknown_player_excluded_from_risk(self, model):
        risk = model.player_availability_risk(["unknown"])
        assert "unknown" not in risk


# ── top players by team ───────────────────────────────────────────────────────

class TestTopPlayersByTeam:
    def test_top_players_returns_sorted_by_importance(self, model):
        model.register_player(_profile("p-001", importance=0.9))
        model.register_player(_profile("p-002", importance=0.6))
        top = model.top_players_by_team("home", n=5)
        scores = [p.importance_score for p in top]
        assert scores == sorted(scores, reverse=True)

    def test_top_players_limited_to_n(self, model):
        for i in range(10):
            p = _profile(f"p-{i:03d}", importance=0.1 * i)
            model.register_player(p)
        top = model.top_players_by_team("home", n=3)
        assert len(top) <= 3

    def test_top_players_filters_by_team(self, model):
        home_p = _profile("p-001")
        away_p = PlayerProfile(
            player_id="p-away",
            name="Away Player",
            team="away",
            role="midfielder",
            importance_score=0.7,
            goals_last_5=0,
            assists_last_5=0,
            xg_contribution_last_5=0.0,
            minutes_played_last_5=450,
        )
        model.register_player(home_p)
        model.register_player(away_p)
        top = model.top_players_by_team("home", n=5)
        assert all(p.team == "home" for p in top)
