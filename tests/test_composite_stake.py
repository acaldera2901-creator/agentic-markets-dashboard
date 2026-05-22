"""
Unit tests for risk.composite_stake.CompositeStakeCalculator

Seven multiplicative factors applied to a base Kelly stake:
  1. data_completeness   — fraction of expected fields present (0–1)
  2. ci_width            — conformal interval width gate (1.0 if narrow, < 1 if wide)
  3. league_predictability — league hit-rate multiplier
  4. match_type          — match-type penalty (from competition_factors)
  5. drawdown            — circuit breaker stake_multiplier (0.0–1.0)
  6. exposure            — portfolio exposure headroom (0.0–1.0)
  7. variance_budget     — remaining weekly variance budget (0.0–1.0)

final_stake = base_stake × ∏(factors)   capped at max_bet_abs
All factors clamp to [0, 1]. Any factor == 0 → final_stake == 0.

Tests define the interface BEFORE implementation.
Run: pytest tests/test_composite_stake.py -v
"""
import pytest
from risk.composite_stake import CompositeStakeCalculator, StakeDecision


# ── Fixtures ──────────────────────────────────────────────────────────────────

FULL_FACTORS = {
    "data_completeness": 1.0,
    "ci_width": 1.0,
    "league_predictability": 1.0,
    "match_type": 1.0,
    "drawdown": 1.0,
    "exposure": 1.0,
    "variance_budget": 1.0,
}


@pytest.fixture
def calc():
    return CompositeStakeCalculator(max_bet_abs=100.0)


# ── StakeDecision dataclass ───────────────────────────────────────────────────

class TestStakeDecision:
    def test_stake_decision_returned(self, calc):
        decision = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert isinstance(decision, StakeDecision)

    def test_decision_exposes_final_stake(self, calc):
        decision = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert hasattr(decision, "final_stake")

    def test_decision_exposes_factors_used(self, calc):
        decision = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert hasattr(decision, "factors")

    def test_decision_exposes_composite_multiplier(self, calc):
        decision = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert hasattr(decision, "composite_multiplier")

    def test_decision_exposes_skip_reason(self, calc):
        decision = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert hasattr(decision, "skip_reason")


# ── Product formula ───────────────────────────────────────────────────────────

class TestProductFormula:
    def test_all_ones_returns_base_stake(self, calc):
        d = calc.compute(base_stake=40.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(40.0)

    def test_composite_multiplier_is_product_of_factors(self, calc):
        factors = {**FULL_FACTORS, "data_completeness": 0.8, "ci_width": 0.9}
        d = calc.compute(base_stake=100.0, factors=factors)
        assert d.composite_multiplier == pytest.approx(0.8 * 0.9)

    def test_final_stake_equals_base_times_multiplier(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.75, "match_type": 0.8}
        d = calc.compute(base_stake=50.0, factors=factors)
        expected = 50.0 * 0.75 * 0.8
        assert d.final_stake == pytest.approx(expected)

    def test_five_factors_combined(self, calc):
        factors = {
            "data_completeness": 0.9,
            "ci_width": 0.85,
            "league_predictability": 0.95,
            "match_type": 1.0,
            "drawdown": 0.75,
            "exposure": 1.0,
            "variance_budget": 1.0,
        }
        d = calc.compute(base_stake=80.0, factors=factors)
        product = 0.9 * 0.85 * 0.95 * 1.0 * 0.75 * 1.0 * 1.0
        assert d.final_stake == pytest.approx(80.0 * product, rel=1e-4)

    def test_zero_base_stake_returns_zero(self, calc):
        d = calc.compute(base_stake=0.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(0.0)


# ── Factor clamping ───────────────────────────────────────────────────────────

class TestFactorClamping:
    def test_factor_above_one_clamped_to_one(self, calc):
        factors = {**FULL_FACTORS, "league_predictability": 1.5}
        d = calc.compute(base_stake=50.0, factors=factors)
        # Clamped → same as all-ones
        assert d.final_stake == pytest.approx(50.0)
        assert d.factors["league_predictability"] == pytest.approx(1.0)

    def test_factor_below_zero_clamped_to_zero(self, calc):
        factors = {**FULL_FACTORS, "ci_width": -0.2}
        d = calc.compute(base_stake=50.0, factors=factors)
        assert d.final_stake == pytest.approx(0.0)
        assert d.factors["ci_width"] == pytest.approx(0.0)

    def test_negative_base_stake_treated_as_zero(self, calc):
        d = calc.compute(base_stake=-10.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(0.0)


# ── Any-zero short-circuit ────────────────────────────────────────────────────

class TestZeroShortCircuit:
    def test_drawdown_zero_gives_zero_stake(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.0}
        d = calc.compute(base_stake=60.0, factors=factors)
        assert d.final_stake == pytest.approx(0.0)

    def test_variance_budget_zero_gives_zero_stake(self, calc):
        factors = {**FULL_FACTORS, "variance_budget": 0.0}
        d = calc.compute(base_stake=60.0, factors=factors)
        assert d.final_stake == pytest.approx(0.0)

    def test_zero_skip_reason_is_set(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.0}
        d = calc.compute(base_stake=60.0, factors=factors)
        assert d.skip_reason is not None
        assert len(d.skip_reason) > 0

    def test_nonzero_no_skip_reason(self, calc):
        d = calc.compute(base_stake=60.0, factors=FULL_FACTORS)
        assert d.skip_reason is None

    def test_composite_multiplier_zero_when_any_factor_zero(self, calc):
        factors = {**FULL_FACTORS, "exposure": 0.0}
        d = calc.compute(base_stake=60.0, factors=factors)
        assert d.composite_multiplier == pytest.approx(0.0)


# ── Max bet cap ───────────────────────────────────────────────────────────────

class TestMaxBetCap:
    def test_cap_applied_when_base_stake_exceeds_limit(self):
        calc = CompositeStakeCalculator(max_bet_abs=30.0)
        d = calc.compute(base_stake=200.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(30.0)

    def test_cap_applied_after_factor_multiplication(self):
        calc = CompositeStakeCalculator(max_bet_abs=20.0)
        # 80 * 0.5 = 40 → capped at 20
        factors = {**FULL_FACTORS, "drawdown": 0.5}
        d = calc.compute(base_stake=80.0, factors=factors)
        assert d.final_stake == pytest.approx(20.0)

    def test_no_cap_when_below_limit(self):
        calc = CompositeStakeCalculator(max_bet_abs=100.0)
        d = calc.compute(base_stake=30.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(30.0)

    def test_cap_of_zero_gives_zero(self):
        calc = CompositeStakeCalculator(max_bet_abs=0.0)
        d = calc.compute(base_stake=50.0, factors=FULL_FACTORS)
        assert d.final_stake == pytest.approx(0.0)


# ── Missing factors default to 1.0 ───────────────────────────────────────────

class TestMissingFactors:
    def test_missing_factor_defaults_to_one(self, calc):
        # Only provide 3 of 7 factors
        partial = {
            "data_completeness": 0.8,
            "drawdown": 0.75,
            "match_type": 1.0,
        }
        d = calc.compute(base_stake=50.0, factors=partial)
        expected = 50.0 * 0.8 * 0.75 * 1.0
        assert d.final_stake == pytest.approx(expected)

    def test_empty_factors_applies_base_stake(self, calc):
        d = calc.compute(base_stake=50.0, factors={})
        assert d.final_stake == pytest.approx(50.0)

    def test_factors_dict_in_result_contains_all_keys(self, calc):
        partial = {"drawdown": 0.5}
        d = calc.compute(base_stake=50.0, factors=partial)
        expected_keys = {
            "data_completeness", "ci_width", "league_predictability",
            "match_type", "drawdown", "exposure", "variance_budget", "season_phase",
        }
        assert set(d.factors.keys()) == expected_keys


# ── Reproducibility & immutability ────────────────────────────────────────────

class TestReproducibility:
    def test_same_inputs_same_output(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.75, "ci_width": 0.9}
        d1 = calc.compute(base_stake=60.0, factors=factors)
        d2 = calc.compute(base_stake=60.0, factors=factors)
        assert d1.final_stake == pytest.approx(d2.final_stake)

    def test_input_factors_dict_not_mutated(self, calc):
        factors = {**FULL_FACTORS}
        original = dict(factors)
        calc.compute(base_stake=50.0, factors=factors)
        assert factors == original

    def test_different_base_stakes_scale_linearly(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.5}
        d_small = calc.compute(base_stake=20.0, factors=factors)
        d_large = calc.compute(base_stake=40.0, factors=factors)
        assert d_large.final_stake == pytest.approx(d_small.final_stake * 2)

    def test_different_base_stakes_same_multiplier(self, calc):
        factors = {**FULL_FACTORS, "drawdown": 0.5}
        d1 = calc.compute(base_stake=20.0, factors=factors)
        d2 = calc.compute(base_stake=40.0, factors=factors)
        assert d1.composite_multiplier == pytest.approx(d2.composite_multiplier)
