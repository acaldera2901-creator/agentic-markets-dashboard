"""
Unit tests for risk.variance_budget.WeeklyVarianceBudget

Tracks the weekly sum of binomial variance across all bets.
Variance contribution of one bet = p * (1 - p), where p is win probability.

Budget factor = max(0, 1 - used / max_weekly_variance)
  → 1.0 when budget is untouched
  → 0.0 when budget is exhausted

Auto-resets at the start of each Monday week (UTC).
evaluate() is read-only; commit() consumes budget.

Run: pytest tests/test_variance_budget.py -v
"""
import datetime
import pytest
from unittest.mock import patch
from risk.variance_budget import WeeklyVarianceBudget, VarianceBudgetState


# ── Fixtures ──────────────────────────────────────────────────────────────────

MONDAY = datetime.datetime(2024, 10, 7, 12, 0, 0, tzinfo=datetime.timezone.utc)   # Monday
TUESDAY = datetime.datetime(2024, 10, 8, 9, 0, 0, tzinfo=datetime.timezone.utc)
SUNDAY = datetime.datetime(2024, 10, 6, 23, 59, 0, tzinfo=datetime.timezone.utc)  # previous week
NEXT_MONDAY = datetime.datetime(2024, 10, 14, 0, 30, 0, tzinfo=datetime.timezone.utc)


@pytest.fixture
def vb():
    return WeeklyVarianceBudget(max_weekly_variance=2.0)


def make_vb_at(dt: datetime.datetime, max_var: float = 2.0):
    """Return a budget instance with mocked 'now' at dt."""
    with patch("risk.variance_budget.utcnow", return_value=dt):
        return WeeklyVarianceBudget(max_weekly_variance=max_var)


# ── VarianceBudgetState dataclass ─────────────────────────────────────────────

class TestVarianceBudgetState:
    def test_state_returned_by_evaluate(self, vb):
        state = vb.evaluate(win_probability=0.55)
        assert isinstance(state, VarianceBudgetState)

    def test_state_has_variance_budget_factor(self, vb):
        state = vb.evaluate(0.55)
        assert hasattr(state, "variance_budget_factor")

    def test_state_has_used_variance(self, vb):
        state = vb.evaluate(0.55)
        assert hasattr(state, "used_variance")

    def test_state_has_remaining_variance(self, vb):
        state = vb.evaluate(0.55)
        assert hasattr(state, "remaining_variance")

    def test_state_has_week_start(self, vb):
        state = vb.evaluate(0.55)
        assert hasattr(state, "week_start")

    def test_state_has_exhausted_flag(self, vb):
        state = vb.evaluate(0.55)
        assert hasattr(state, "exhausted")


# ── Variance contribution formula ─────────────────────────────────────────────

class TestVarianceFormula:
    def test_variance_contribution_formula(self, vb):
        # p=0.5 → contribution = 0.5 * 0.5 = 0.25
        assert vb.bet_variance(0.5) == pytest.approx(0.25)

    def test_variance_contribution_asymmetric(self, vb):
        # p=0.7 → 0.7 * 0.3 = 0.21
        assert vb.bet_variance(0.7) == pytest.approx(0.21)

    def test_variance_at_p_zero(self, vb):
        assert vb.bet_variance(0.0) == pytest.approx(0.0)

    def test_variance_at_p_one(self, vb):
        assert vb.bet_variance(1.0) == pytest.approx(0.0)

    def test_variance_max_at_p_half(self, vb):
        v_half = vb.bet_variance(0.5)
        v_other = vb.bet_variance(0.3)
        assert v_half > v_other


# ── Fresh budget ──────────────────────────────────────────────────────────────

class TestFreshBudget:
    def test_fresh_budget_factor_is_one(self, vb):
        state = vb.evaluate(0.55)
        assert state.variance_budget_factor == pytest.approx(1.0)

    def test_fresh_budget_used_variance_is_zero(self, vb):
        state = vb.evaluate(0.55)
        assert state.used_variance == pytest.approx(0.0)

    def test_fresh_budget_remaining_equals_max(self, vb):
        state = vb.evaluate(0.55)
        assert state.remaining_variance == pytest.approx(2.0)

    def test_fresh_budget_not_exhausted(self, vb):
        state = vb.evaluate(0.55)
        assert state.exhausted is False


# ── evaluate() is read-only ───────────────────────────────────────────────────

class TestEvaluateReadOnly:
    def test_evaluate_does_not_consume_budget(self, vb):
        vb.evaluate(0.55)
        vb.evaluate(0.55)
        state = vb.evaluate(0.55)
        assert state.used_variance == pytest.approx(0.0)

    def test_commit_consumes_budget(self, vb):
        vb.commit(0.55)
        state = vb.evaluate(0.55)
        expected = 0.55 * 0.45
        assert state.used_variance == pytest.approx(expected)


# ── Budget factor interpolation ───────────────────────────────────────────────

class TestBudgetFactor:
    def test_factor_decreases_as_budget_consumed(self, vb):
        vb.commit(0.5)   # adds 0.25
        state1 = vb.evaluate(0.5)
        vb.commit(0.5)   # adds another 0.25
        state2 = vb.evaluate(0.5)
        assert state2.variance_budget_factor < state1.variance_budget_factor

    def test_factor_at_half_budget_used(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=1.0)
        vb.commit(0.5)   # adds 0.25 → used=0.25, max=1.0 → factor=0.75
        state = vb.evaluate(0.5)
        assert state.variance_budget_factor == pytest.approx(0.75)

    def test_factor_at_full_budget_used(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=0.25)
        vb.commit(0.5)   # adds 0.25 → exhausted
        state = vb.evaluate(0.5)
        assert state.variance_budget_factor == pytest.approx(0.0)
        assert state.exhausted is True

    def test_factor_never_negative(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=0.10)
        vb.commit(0.5)   # adds 0.25 → way over budget
        state = vb.evaluate(0.5)
        assert state.variance_budget_factor >= 0.0

    def test_factor_never_above_one(self, vb):
        state = vb.evaluate(0.99)
        assert state.variance_budget_factor <= 1.0

    def test_remaining_variance_cannot_be_negative(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=0.10)
        vb.commit(0.5)
        state = vb.evaluate(0.5)
        assert state.remaining_variance >= 0.0

    def test_used_plus_remaining_equals_max_when_below_budget(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=1.0)
        vb.commit(0.5)   # 0.25
        state = vb.evaluate(0.5)
        assert state.used_variance + state.remaining_variance == pytest.approx(1.0)


# ── Multiple bets accumulate ──────────────────────────────────────────────────

class TestAccumulation:
    def test_two_bets_accumulate_variance(self, vb):
        vb.commit(0.6)   # 0.6*0.4 = 0.24
        vb.commit(0.7)   # 0.7*0.3 = 0.21
        state = vb.evaluate(0.5)
        assert state.used_variance == pytest.approx(0.24 + 0.21)

    def test_five_bets_at_even_odds(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=5.0)
        for _ in range(5):
            vb.commit(0.5)  # each 0.25
        state = vb.evaluate(0.5)
        assert state.used_variance == pytest.approx(1.25)

    def test_budget_exhaustion_after_many_bets(self):
        vb = WeeklyVarianceBudget(max_weekly_variance=0.5)
        for _ in range(10):
            vb.commit(0.5)   # 10 * 0.25 = 2.5 >> 0.5
        state = vb.evaluate(0.5)
        assert state.exhausted is True
        assert state.variance_budget_factor == pytest.approx(0.0)


# ── Auto-reset on new week ────────────────────────────────────────────────────

class TestWeeklyReset:
    def test_used_variance_resets_on_new_week(self):
        with patch("risk.variance_budget.utcnow", return_value=MONDAY):
            vb = WeeklyVarianceBudget(max_weekly_variance=2.0)
            vb.commit(0.5)   # consumes 0.25 this week

        # Simulate time passing to next Monday
        with patch("risk.variance_budget.utcnow", return_value=NEXT_MONDAY):
            state = vb.evaluate(0.5)

        assert state.used_variance == pytest.approx(0.0)
        assert state.variance_budget_factor == pytest.approx(1.0)

    def test_no_reset_mid_week(self):
        with patch("risk.variance_budget.utcnow", return_value=MONDAY):
            vb = WeeklyVarianceBudget(max_weekly_variance=2.0)
            vb.commit(0.5)

        with patch("risk.variance_budget.utcnow", return_value=TUESDAY):
            state = vb.evaluate(0.5)

        assert state.used_variance == pytest.approx(0.5 * 0.5)

    def test_week_start_is_monday(self):
        with patch("risk.variance_budget.utcnow", return_value=TUESDAY):
            vb = WeeklyVarianceBudget(max_weekly_variance=2.0)
            state = vb.evaluate(0.5)
        # week_start should be Monday 2024-10-07
        assert state.week_start.weekday() == 0  # 0 = Monday

    def test_commit_on_sunday_does_not_reset_on_monday(self):
        # Commit on Sunday (old week), then evaluate on Monday (new week)
        with patch("risk.variance_budget.utcnow", return_value=SUNDAY):
            vb = WeeklyVarianceBudget(max_weekly_variance=2.0)
            vb.commit(0.5)  # 0.25 in week of 2024-09-30

        with patch("risk.variance_budget.utcnow", return_value=MONDAY):
            state = vb.evaluate(0.5)

        assert state.used_variance == pytest.approx(0.0)  # new week → reset


# ── Manual reset ──────────────────────────────────────────────────────────────

class TestManualReset:
    def test_manual_reset_clears_used_variance(self, vb):
        vb.commit(0.5)
        vb.reset()
        state = vb.evaluate(0.5)
        assert state.used_variance == pytest.approx(0.0)

    def test_manual_reset_restores_factor_to_one(self, vb):
        vb.commit(0.5)
        vb.reset()
        state = vb.evaluate(0.5)
        assert state.variance_budget_factor == pytest.approx(1.0)


# ── Serialization ─────────────────────────────────────────────────────────────

class TestSerialization:
    def test_to_dict_has_required_keys(self, vb):
        vb.commit(0.6)
        d = vb.to_dict()
        for key in ("used_variance", "max_weekly_variance", "week_start"):
            assert key in d, f"missing: {key}"

    def test_roundtrip_preserves_used_variance(self, vb):
        vb.commit(0.6)
        d = vb.to_dict()
        vb2 = WeeklyVarianceBudget.from_dict(d)
        state = vb2.evaluate(0.5)
        assert state.used_variance == pytest.approx(0.6 * 0.4)

    def test_roundtrip_preserves_max(self, vb):
        d = vb.to_dict()
        vb2 = WeeklyVarianceBudget.from_dict(d)
        assert vb2.max_weekly_variance == pytest.approx(2.0)
