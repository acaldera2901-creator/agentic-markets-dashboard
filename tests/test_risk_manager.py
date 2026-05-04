import pytest
from agents.risk_manager import kelly_stake, is_within_limits

def test_kelly_stake_correct():
    stake = kelly_stake(edge=0.05, odds=3.0, bankroll=500.0, kelly_fraction=0.25)
    assert abs(stake - 3.125) < 0.01

def test_kelly_stake_capped_at_max_fraction():
    stake = kelly_stake(edge=0.4, odds=2.0, bankroll=500.0, kelly_fraction=0.25, max_fraction=0.02)
    assert stake <= 10.0

def test_kelly_stake_zero_for_negative_edge():
    stake = kelly_stake(edge=-0.01, odds=2.0, bankroll=500.0, kelly_fraction=0.25)
    assert stake == 0.0

def test_within_limits_passes():
    assert is_within_limits(current_exposure=0.05, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is True

def test_within_limits_fails_when_over():
    assert is_within_limits(current_exposure=0.09, new_stake=10.0, bankroll=500.0, max_exposure=0.10) is False
