import pytest
from context.competition_factors import competition_type_factors, apply_factors
from context.match_type import MatchType


def test_all_match_types_have_entry():
    for mt in MatchType:
        assert mt.value in competition_type_factors, f"Missing entry for {mt.value}"


def test_standard_no_penalty():
    factors = competition_type_factors["STANDARD"]
    assert factors["model_confidence_penalty"] == 0.0
    assert factors["stake_multiplier"] == 1.0


def test_derby_reduces_stake():
    factors = competition_type_factors["DERBY_NATIONAL"]
    assert factors["stake_multiplier"] < 1.0
    assert factors["model_confidence_penalty"] < 0.0


def test_dead_rubber_biggest_penalty():
    dr = competition_type_factors["DEAD_RUBBER"]["model_confidence_penalty"]
    std = competition_type_factors["STANDARD"]["model_confidence_penalty"]
    assert dr < std


def test_apply_factors_adjusts_stake():
    result = apply_factors(base_stake=100.0, base_confidence=0.80, match_type="DERBY_NATIONAL")
    assert result["adjusted_stake"] < 100.0
    assert result["adjusted_confidence"] < 0.80
    assert result["match_type_penalty"] == competition_type_factors["DERBY_NATIONAL"]["model_confidence_penalty"]


def test_apply_factors_standard_unchanged():
    result = apply_factors(base_stake=100.0, base_confidence=0.80, match_type="STANDARD")
    assert result["adjusted_stake"] == 100.0
    assert result["adjusted_confidence"] == 0.80


def test_apply_factors_unknown_type_uses_standard():
    result = apply_factors(base_stake=50.0, base_confidence=0.70, match_type="NONEXISTENT")
    assert result["adjusted_stake"] == 50.0


def test_rotation_expected_heavy_penalty():
    factors = competition_type_factors["ROTATION_EXPECTED"]
    assert factors["stake_multiplier"] <= 0.65


def test_apply_factors_clamps_stake_floor():
    result = apply_factors(base_stake=1.0, base_confidence=0.5, match_type="DEAD_RUBBER")
    assert result["adjusted_stake"] >= 0.0
    assert result["adjusted_confidence"] >= 0.0
