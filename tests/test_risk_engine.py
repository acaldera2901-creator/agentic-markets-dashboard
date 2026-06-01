"""
Integration tests for risk.engine.RiskManagerEngine

Tests verify that the orchestrator correctly wires all sub-modules and
returns coherent RiskDecision objects.
Run: pytest tests/test_risk_engine.py -v
"""
import pytest
from risk.engine import RiskManagerEngine, RiskDecision

BANKROLL = 1000.0
MATCHDAY = "2024-10-05"

BASE_BET = {
    "match_id": "m-001",
    "league": "PL",
    "home_team": "Arsenal",
    "away_team": "Chelsea",
    "kickoff": "2024-10-05T15:00:00",
    "selection": "home",
    "edge": 0.06,
    "odds": 2.10,
    "confidence": 0.55,
    "p_home": 0.55,
    "p_draw": 0.25,
    "p_away": 0.20,
    "league_tier": 1,
    "match_type": "STANDARD",
    "ci_width": "0.1",
    "league_predictability_score": 0.85,
}


@pytest.fixture
def engine():
    return RiskManagerEngine(initial_bankroll=BANKROLL)


# ── RiskDecision structure ────────────────────────────────────────────────────

class TestRiskDecisionStructure:
    def test_returns_risk_decision(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert isinstance(d, RiskDecision)

    def test_decision_has_approved_flag(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert isinstance(d.approved, bool)

    def test_decision_has_final_stake(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert isinstance(d.final_stake, float)

    def test_decision_has_all_seven_factors(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        for key in ("data_completeness", "ci_width", "league_predictability",
                    "match_type", "drawdown", "exposure", "variance_budget"):
            assert key in d.factors

    def test_decision_exposes_circuit_state(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.circuit_state is not None

    def test_decision_exposes_exposure_state(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.exposure_state is not None

    def test_decision_exposes_variance_state(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.variance_state is not None

    def test_decision_carries_match_and_league_ids(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.match_id == "m-001"
        assert d.league_id == "PL"


# ── Happy path ────────────────────────────────────────────────────────────────

class TestHappyPath:
    def test_good_bet_is_approved(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.approved is True

    def test_approved_stake_is_positive(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.final_stake > 0.0

    def test_approved_stake_within_kelly_bounds(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        # Final ≤ base Kelly (factors can only reduce)
        assert d.final_stake <= d.base_stake + 1e-6

    def test_skip_reason_is_none_when_approved(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.skip_reason is None

    def test_approved_stake_respects_max_bet_abs(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.final_stake <= 100.0   # default max_bet_abs


# ── Circuit breaker integration ───────────────────────────────────────────────

class TestCircuitBreakerIntegration:
    def test_drawdown_factor_one_at_peak(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["drawdown"] == pytest.approx(1.0)

    def test_drawdown_factor_reduced_after_loss(self, engine):
        # Simulate -15% drawdown → YELLOW (multiplier 0.75)
        d = engine.evaluate(BASE_BET, 850.0, MATCHDAY)
        assert d.factors["drawdown"] == pytest.approx(0.75)

    def test_red_blocks_all_bets(self, engine):
        # Simulate -35% → RED
        d = engine.evaluate(BASE_BET, 650.0, MATCHDAY)
        assert d.approved is False
        assert d.final_stake == pytest.approx(0.0)

    def test_red_skip_reason_mentions_circuit_breaker(self, engine):
        d = engine.evaluate(BASE_BET, 650.0, MATCHDAY)
        assert "circuit breaker" in d.skip_reason.lower() or "RED" in d.skip_reason

    def test_clear_circuit_breaker_lifts_red(self, engine):
        engine.evaluate(BASE_BET, 650.0, MATCHDAY)   # trigger RED
        engine.evaluate(BASE_BET, 1200.0, MATCHDAY)  # bankroll recovers
        engine.clear_circuit_breaker()
        d = engine.evaluate(BASE_BET, 1200.0, MATCHDAY)
        assert d.approved is True


# ── Exposure integration ──────────────────────────────────────────────────────

class TestExposureIntegration:
    def test_exposure_factor_one_when_no_open_bets(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["exposure"] == pytest.approx(1.0)

    def test_commit_reduces_exposure_headroom(self, engine):
        d1 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        engine.commit("PL", MATCHDAY, stake=100.0, win_probability=0.55)
        d2 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d2.factors["exposure"] < d1.factors["exposure"]

    def test_evaluate_does_not_commit_exposure(self, engine):
        engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["exposure"] == pytest.approx(1.0)

    def test_release_restores_exposure(self, engine):
        engine.commit("PL", MATCHDAY, stake=100.0, win_probability=0.55)
        engine.release("PL", MATCHDAY, stake=100.0)
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["exposure"] == pytest.approx(1.0)


# ── Variance budget integration ───────────────────────────────────────────────

class TestVarianceBudgetIntegration:
    def test_variance_factor_one_on_fresh_week(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["variance_budget"] == pytest.approx(1.0)

    def test_commit_reduces_variance_budget(self, engine):
        d1 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        engine.commit("PL", MATCHDAY, stake=10.0, win_probability=0.5)
        d2 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d2.factors["variance_budget"] < d1.factors["variance_budget"]

    def test_exhausted_variance_blocks_bet(self):
        # Very tight budget so a single bet exhausts it
        engine = RiskManagerEngine(initial_bankroll=BANKROLL)
        engine._variance.max_weekly_variance = 0.001
        engine.commit("PL", MATCHDAY, stake=10.0, win_probability=0.5)
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["variance_budget"] == pytest.approx(0.0)


# ── Factor computation ────────────────────────────────────────────────────────

class TestFactorComputation:
    def test_data_completeness_factor_for_complete_bet(self, engine):
        d = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d.factors["data_completeness"] == pytest.approx(1.0)

    def test_data_completeness_factor_for_partial_bet(self, engine):
        partial = {k: v for k, v in BASE_BET.items() if k not in ("edge", "odds")}
        d = engine.evaluate(partial, BANKROLL, MATCHDAY)
        assert d.factors["data_completeness"] < 1.0

    def test_ci_width_factor_zero_when_max(self, engine):
        bet = {**BASE_BET, "ci_width": "1.5"}  # at max_ci_width (config/risk_config.yaml: 1.5)
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert d.factors["ci_width"] == pytest.approx(0.0)

    def test_ci_width_factor_one_when_zero(self, engine):
        bet = {**BASE_BET, "ci_width": "0.0"}
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert d.factors["ci_width"] == pytest.approx(1.0)

    def test_match_type_derby_reduces_factor(self, engine):
        derby_bet = {**BASE_BET, "match_type": "DERBY_NATIONAL"}
        std_bet = {**BASE_BET, "match_type": "STANDARD"}
        d_derby = engine.evaluate(derby_bet, BANKROLL, MATCHDAY)
        d_std = engine.evaluate(std_bet, BANKROLL, MATCHDAY)
        assert d_derby.factors["match_type"] < d_std.factors["match_type"]

    def test_dead_rubber_lower_factor_than_standard(self, engine):
        d_dr = engine.evaluate({**BASE_BET, "match_type": "DEAD_RUBBER"}, BANKROLL, MATCHDAY)
        d_std = engine.evaluate({**BASE_BET, "match_type": "STANDARD"}, BANKROLL, MATCHDAY)
        assert d_dr.factors["match_type"] < d_std.factors["match_type"]

    def test_league_predictability_passed_through(self, engine):
        bet = {**BASE_BET, "league_predictability_score": 0.6}
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert d.factors["league_predictability"] == pytest.approx(0.6)


# ── Edge cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_zero_edge_gives_zero_stake(self, engine):
        bet = {**BASE_BET, "edge": 0.0}
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert d.final_stake == pytest.approx(0.0)
        assert d.approved is False

    def test_negative_edge_gives_zero_stake(self, engine):
        bet = {**BASE_BET, "edge": -0.03}
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert d.final_stake == pytest.approx(0.0)

    def test_missing_league_tier_still_evaluates(self, engine):
        bet = {k: v for k, v in BASE_BET.items() if k != "league_tier"}
        d = engine.evaluate(bet, BANKROLL, MATCHDAY)
        assert isinstance(d, RiskDecision)

    def test_evaluate_is_deterministic(self, engine):
        d1 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        d2 = engine.evaluate(BASE_BET, BANKROLL, MATCHDAY)
        assert d1.final_stake == pytest.approx(d2.final_stake)
