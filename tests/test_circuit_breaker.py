"""
Unit tests for risk.circuit_breaker.DrawdownCircuitBreaker

Tests define the interface and expected behavior BEFORE implementation.
Run: pytest tests/test_circuit_breaker.py -v
"""
import pytest
from risk.circuit_breaker import DrawdownCircuitBreaker, CircuitBreakerLevel, CircuitBreakerState


# ── Default thresholds (mirroring the YAML spec) ──────────────────────────────

DEFAULT_THRESHOLDS = {
    "YELLOW": {
        "trigger": -0.10,
        "stake_multiplier": 0.75,
        "action": "reduce_stake",
    },
    "ORANGE": {
        "trigger": -0.20,
        "stake_multiplier": 0.50,
        "action": "reduce_and_restrict",
        "restrict_tiers": [4, 5],
    },
    "RED": {
        "trigger": -0.30,
        "stake_multiplier": 0.0,
        "action": "full_stop",
        "requires_manual_review": True,
    },
}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def cb():
    """Fresh circuit breaker with default thresholds, starting bankroll 1000."""
    return DrawdownCircuitBreaker(initial_bankroll=1000.0, thresholds=DEFAULT_THRESHOLDS)


@pytest.fixture
def cb_custom():
    """Circuit breaker with tighter thresholds for boundary testing."""
    return DrawdownCircuitBreaker(
        initial_bankroll=1000.0,
        thresholds={
            "YELLOW": {"trigger": -0.05, "stake_multiplier": 0.80, "action": "reduce_stake"},
            "ORANGE": {"trigger": -0.15, "stake_multiplier": 0.50, "action": "reduce_and_restrict", "restrict_tiers": [3, 4, 5]},
            "RED":    {"trigger": -0.25, "stake_multiplier": 0.0,  "action": "full_stop", "requires_manual_review": True},
        }
    )


# ── Initialization ────────────────────────────────────────────────────────────

class TestInitialization:
    def test_initial_level_is_none(self, cb):
        assert cb.level == CircuitBreakerLevel.NONE

    def test_initial_peak_equals_starting_bankroll(self, cb):
        assert cb.peak_bankroll == pytest.approx(1000.0)

    def test_thresholds_stored(self, cb):
        assert cb.thresholds["RED"]["trigger"] == pytest.approx(-0.30)

    def test_custom_thresholds_applied(self, cb_custom):
        assert cb_custom.thresholds["YELLOW"]["trigger"] == pytest.approx(-0.05)

    def test_default_thresholds_used_when_none_provided(self):
        cb = DrawdownCircuitBreaker(initial_bankroll=500.0)
        # Default YELLOW should trigger at -10%
        state = cb.update(449.0)  # -10.1%
        assert state.level == CircuitBreakerLevel.YELLOW


# ── High Watermark ────────────────────────────────────────────────────────────

class TestHighWatermark:
    def test_peak_updates_when_bankroll_rises(self, cb):
        cb.update(1100.0)
        assert cb.peak_bankroll == pytest.approx(1100.0)

    def test_peak_does_not_fall_when_bankroll_drops(self, cb):
        cb.update(1100.0)
        cb.update(900.0)
        assert cb.peak_bankroll == pytest.approx(1100.0)

    def test_peak_updates_through_multiple_rises(self, cb):
        cb.update(1050.0)
        cb.update(1200.0)
        cb.update(1150.0)
        assert cb.peak_bankroll == pytest.approx(1200.0)

    def test_peak_unchanged_when_bankroll_equals_peak(self, cb):
        cb.update(1000.0)
        assert cb.peak_bankroll == pytest.approx(1000.0)


# ── Drawdown Calculation ──────────────────────────────────────────────────────

class TestDrawdownCalculation:
    def test_zero_drawdown_at_peak(self, cb):
        state = cb.update(1000.0)
        assert state.drawdown == pytest.approx(0.0)

    def test_drawdown_formula_ten_percent(self, cb):
        # (1000 - 900) / 1000 = 0.10
        state = cb.update(900.0)
        assert state.drawdown == pytest.approx(0.10)

    def test_drawdown_formula_twenty_percent(self, cb):
        state = cb.update(800.0)
        assert state.drawdown == pytest.approx(0.20)

    def test_drawdown_from_updated_peak(self, cb):
        cb.update(1200.0)
        state = cb.update(960.0)  # (1200 - 960) / 1200 = 0.20
        assert state.drawdown == pytest.approx(0.20)

    def test_negative_drawdown_when_above_starting_but_below_peak(self, cb):
        # After peak rises, partial fall is still positive drawdown
        cb.update(1500.0)
        state = cb.update(1200.0)  # (1500-1200)/1500 = 0.20
        assert state.drawdown == pytest.approx(0.20)

    def test_drawdown_is_never_negative(self, cb):
        state = cb.update(1100.0)  # bankroll above initial → no drawdown
        assert state.drawdown >= 0.0


# ── Level Triggers ────────────────────────────────────────────────────────────

class TestLevelTriggers:
    def test_no_trigger_above_yellow_threshold(self, cb):
        state = cb.update(910.0)  # -9% — below YELLOW threshold
        assert state.level == CircuitBreakerLevel.NONE
        assert state.stake_multiplier == pytest.approx(1.0)

    def test_yellow_triggers_at_exactly_ten_percent(self, cb):
        state = cb.update(900.0)  # exactly -10%
        assert state.level == CircuitBreakerLevel.YELLOW

    def test_yellow_just_above_threshold_no_trigger(self, cb):
        state = cb.update(901.0)  # -9.9%
        assert state.level == CircuitBreakerLevel.NONE

    def test_yellow_returns_correct_multiplier(self, cb):
        state = cb.update(900.0)
        assert state.stake_multiplier == pytest.approx(0.75)

    def test_yellow_returns_correct_action(self, cb):
        state = cb.update(850.0)  # -15%, between YELLOW and ORANGE
        assert state.action == "reduce_stake"

    def test_orange_triggers_at_twenty_percent(self, cb):
        state = cb.update(800.0)  # exactly -20%
        assert state.level == CircuitBreakerLevel.ORANGE

    def test_orange_returns_multiplier_fifty_percent(self, cb):
        state = cb.update(800.0)
        assert state.stake_multiplier == pytest.approx(0.50)

    def test_orange_returns_restrict_action(self, cb):
        state = cb.update(800.0)
        assert state.action == "reduce_and_restrict"

    def test_orange_restricts_tiers_four_and_five(self, cb):
        state = cb.update(800.0)
        assert 4 in state.restricted_tiers
        assert 5 in state.restricted_tiers

    def test_orange_does_not_restrict_tier_one(self, cb):
        state = cb.update(800.0)
        assert 1 not in state.restricted_tiers

    def test_red_triggers_at_thirty_percent(self, cb):
        state = cb.update(700.0)  # exactly -30%
        assert state.level == CircuitBreakerLevel.RED

    def test_red_returns_zero_multiplier(self, cb):
        state = cb.update(700.0)
        assert state.stake_multiplier == pytest.approx(0.0)

    def test_red_returns_full_stop_action(self, cb):
        state = cb.update(700.0)
        assert state.action == "full_stop"

    def test_red_sets_requires_manual_review(self, cb):
        state = cb.update(700.0)
        assert state.requires_manual_review is True

    def test_orange_does_not_set_manual_review(self, cb):
        state = cb.update(800.0)
        assert state.requires_manual_review is False

    def test_worst_level_wins_when_deeply_below(self, cb):
        # At -35% we should get RED, not ORANGE or YELLOW
        state = cb.update(650.0)
        assert state.level == CircuitBreakerLevel.RED


# ── Level Change Detection ────────────────────────────────────────────────────

class TestLevelChangeDetection:
    def test_level_changed_true_on_first_trigger(self, cb):
        state = cb.update(900.0)  # NONE → YELLOW
        assert state.level_changed is True

    def test_level_changed_false_when_same_level(self, cb):
        cb.update(900.0)           # NONE → YELLOW
        state = cb.update(850.0)   # still YELLOW
        assert state.level_changed is False

    def test_level_changed_true_on_escalation(self, cb):
        cb.update(900.0)           # NONE → YELLOW
        state = cb.update(800.0)   # YELLOW → ORANGE
        assert state.level_changed is True

    def test_level_changed_true_on_de_escalation(self, cb):
        cb.update(900.0)              # trigger YELLOW (peak stays at 1000)
        state = cb.update(1100.0)     # new peak → drawdown=0 → NONE (YELLOW → NONE)
        assert state.level == CircuitBreakerLevel.NONE
        assert state.level_changed is True

    def test_level_changed_false_on_stable_none(self, cb):
        state1 = cb.update(1000.0)
        state2 = cb.update(1000.0)
        assert state2.level_changed is False

    def test_level_changed_true_none_to_red_direct(self, cb):
        # Sudden catastrophic loss skipping YELLOW/ORANGE
        state = cb.update(600.0)
        assert state.level == CircuitBreakerLevel.RED
        assert state.level_changed is True


# ── Bet Permission (can_place_bet) ────────────────────────────────────────────

class TestCanPlaceBet:
    def test_none_allows_all_tiers(self, cb):
        cb.update(1000.0)
        for tier in [1, 2, 3, 4, 5]:
            assert cb.can_place_bet(league_tier=tier) is True

    def test_yellow_allows_all_tiers(self, cb):
        cb.update(900.0)  # YELLOW
        for tier in [1, 2, 3, 4, 5]:
            assert cb.can_place_bet(league_tier=tier) is True

    def test_orange_blocks_tier_4_and_5(self, cb):
        cb.update(800.0)  # ORANGE
        assert cb.can_place_bet(league_tier=4) is False
        assert cb.can_place_bet(league_tier=5) is False

    def test_orange_allows_tier_1_2_3(self, cb):
        cb.update(800.0)  # ORANGE
        assert cb.can_place_bet(league_tier=1) is True
        assert cb.can_place_bet(league_tier=2) is True
        assert cb.can_place_bet(league_tier=3) is True

    def test_red_blocks_all_tiers(self, cb):
        cb.update(700.0)  # RED
        for tier in [1, 2, 3, 4, 5]:
            assert cb.can_place_bet(league_tier=tier) is False

    def test_custom_thresholds_restrict_tier_3(self, cb_custom):
        cb_custom.update(850.0)  # -15% → ORANGE (custom threshold), restricts [3,4,5]
        assert cb_custom.can_place_bet(league_tier=3) is False
        assert cb_custom.can_place_bet(league_tier=1) is True


# ── State Serialization (DB persistence) ─────────────────────────────────────

class TestStateSerialization:
    def test_to_dict_contains_required_keys(self, cb):
        cb.update(800.0)
        d = cb.to_dict()
        for key in ("level", "peak_bankroll", "current_bankroll", "drawdown",
                    "stake_multiplier", "action", "restricted_tiers",
                    "requires_manual_review"):
            assert key in d, f"missing key: {key}"

    def test_to_dict_level_is_string(self, cb):
        cb.update(800.0)
        d = cb.to_dict()
        assert isinstance(d["level"], str)

    def test_roundtrip_preserves_peak(self, cb):
        cb.update(1200.0)
        cb.update(900.0)
        d = cb.to_dict()
        cb2 = DrawdownCircuitBreaker.from_dict(d, thresholds=DEFAULT_THRESHOLDS)
        assert cb2.peak_bankroll == pytest.approx(1200.0)

    def test_roundtrip_preserves_level(self, cb):
        cb.update(800.0)
        d = cb.to_dict()
        cb2 = DrawdownCircuitBreaker.from_dict(d, thresholds=DEFAULT_THRESHOLDS)
        assert cb2.level == CircuitBreakerLevel.ORANGE

    def test_roundtrip_no_spurious_level_change(self, cb):
        cb.update(800.0)
        d = cb.to_dict()
        cb2 = DrawdownCircuitBreaker.from_dict(d, thresholds=DEFAULT_THRESHOLDS)
        # Same bankroll after restore — no level change
        state = cb2.update(800.0)
        assert state.level_changed is False

    def test_from_dict_restores_restricted_tiers(self, cb):
        cb.update(800.0)  # ORANGE → restricts [4, 5]
        d = cb.to_dict()
        cb2 = DrawdownCircuitBreaker.from_dict(d, thresholds=DEFAULT_THRESHOLDS)
        assert cb2.can_place_bet(league_tier=4) is False


# ── Recovery Behaviour ────────────────────────────────────────────────────────

class TestRecovery:
    def test_de_escalates_from_yellow_to_none_on_recovery(self, cb):
        cb.update(900.0)           # YELLOW
        cb.update(1050.0)          # new peak = 1050
        state = cb.update(1000.0)  # drawdown = (1050-1000)/1050 ≈ 4.76% → NONE
        assert state.level == CircuitBreakerLevel.NONE

    def test_de_escalates_from_orange_to_yellow(self, cb):
        cb.update(700.0)           # RED (or ORANGE at -30%)
        cb.update(1100.0)          # new peak
        state = cb.update(990.0)   # (1100-990)/1100 ≈ 10% → YELLOW
        assert state.level == CircuitBreakerLevel.YELLOW

    def test_multiplier_returns_to_one_on_full_recovery(self, cb):
        cb.update(900.0)           # YELLOW
        cb.update(1100.0)          # new peak
        state = cb.update(1100.0)  # at peak → NONE
        assert state.stake_multiplier == pytest.approx(1.0)

    def test_red_requires_manual_reset_to_lift(self, cb):
        """RED state: can_place_bet is False even after bankroll recovers
        unless manual_review_cleared is called."""
        cb.update(700.0)           # RED
        cb.update(1200.0)          # bankroll recovers above peak
        # Still blocked until explicitly cleared
        assert cb.can_place_bet(league_tier=1) is False

    def test_manual_clear_lifts_red_block(self, cb):
        cb.update(700.0)           # RED
        cb.update(1200.0)          # bankroll recovers
        cb.clear_manual_review()
        state = cb.update(1200.0)
        assert state.level == CircuitBreakerLevel.NONE
        assert cb.can_place_bet(league_tier=1) is True


# ── CircuitBreakerState dataclass ─────────────────────────────────────────────

class TestCircuitBreakerState:
    def test_state_is_returned_by_update(self, cb):
        state = cb.update(1000.0)
        assert isinstance(state, CircuitBreakerState)

    def test_state_exposes_current_bankroll(self, cb):
        state = cb.update(850.0)
        assert state.current_bankroll == pytest.approx(850.0)

    def test_state_exposes_peak_bankroll(self, cb):
        cb.update(1200.0)
        state = cb.update(900.0)
        assert state.peak_bankroll == pytest.approx(1200.0)

    def test_none_state_has_empty_restricted_tiers(self, cb):
        state = cb.update(1000.0)
        assert state.restricted_tiers == []

    def test_none_state_has_full_multiplier(self, cb):
        state = cb.update(1000.0)
        assert state.stake_multiplier == pytest.approx(1.0)
