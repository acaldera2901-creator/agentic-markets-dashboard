"""
Unit tests for learning.season_phase.SeasonPhaseAdapter
Run: pytest tests/test_season_phase.py -v
"""
import datetime
import pytest
from learning.season_phase import SeasonPhaseAdapter, SeasonPhase, PhaseConfig


@pytest.fixture
def adapter():
    return SeasonPhaseAdapter()


# ── Phase detection ───────────────────────────────────────────────────────────

class TestPhaseDetection:
    def test_early_phase_at_low_progress(self, adapter):
        phase = adapter.detect_phase(current_matchday=5, total_matchdays=38)
        assert phase == SeasonPhase.EARLY

    def test_mid_phase_at_middle_progress(self, adapter):
        phase = adapter.detect_phase(current_matchday=20, total_matchdays=38)
        assert phase == SeasonPhase.MID

    def test_late_phase_at_high_progress(self, adapter):
        phase = adapter.detect_phase(current_matchday=35, total_matchdays=38)
        assert phase == SeasonPhase.LATE

    def test_boundary_early_mid(self, adapter):
        # progress 0.28 = matchday 10.64 / 38 → matchday 11 should be MID
        phase = adapter.detect_phase(current_matchday=11, total_matchdays=38)
        assert phase == SeasonPhase.MID

    def test_boundary_mid_late(self, adapter):
        # progress 0.75 = matchday 28.5 / 38 → matchday 29 should be LATE
        phase = adapter.detect_phase(current_matchday=29, total_matchdays=38)
        assert phase == SeasonPhase.LATE

    def test_matchday_1_is_early(self, adapter):
        phase = adapter.detect_phase(current_matchday=1, total_matchdays=38)
        assert phase == SeasonPhase.EARLY

    def test_matchday_38_is_late(self, adapter):
        phase = adapter.detect_phase(current_matchday=38, total_matchdays=38)
        assert phase == SeasonPhase.LATE


# ── PhaseConfig contents ──────────────────────────────────────────────────────

class TestPhaseConfig:
    def test_get_config_returns_phase_config(self, adapter):
        cfg = adapter.get_config(SeasonPhase.EARLY)
        assert isinstance(cfg, PhaseConfig)

    def test_early_xg_weight_below_1(self, adapter):
        cfg = adapter.get_config(SeasonPhase.EARLY)
        assert cfg.xg_weight < 1.0

    def test_mid_weights_are_standard(self, adapter):
        cfg = adapter.get_config(SeasonPhase.MID)
        assert cfg.xg_weight == pytest.approx(1.0)
        assert cfg.form_weight == pytest.approx(1.0)

    def test_late_motivation_weight_above_1(self, adapter):
        cfg = adapter.get_config(SeasonPhase.LATE)
        assert cfg.motivation_weight > 1.0

    def test_late_dead_rubber_auto_skip(self, adapter):
        cfg = adapter.get_config(SeasonPhase.LATE)
        assert cfg.dead_rubber_auto_skip is True

    def test_early_dead_rubber_auto_skip_false(self, adapter):
        cfg = adapter.get_config(SeasonPhase.EARLY)
        assert cfg.dead_rubber_auto_skip is False

    def test_early_edge_min_boost_positive(self, adapter):
        cfg = adapter.get_config(SeasonPhase.EARLY)
        assert cfg.edge_min_boost > 0.0

    def test_mid_edge_min_boost_zero(self, adapter):
        cfg = adapter.get_config(SeasonPhase.MID)
        assert cfg.edge_min_boost == pytest.approx(0.0)

    def test_international_break_stake_multiplier_half(self, adapter):
        cfg = adapter.get_config(SeasonPhase.INTERNATIONAL_BREAK)
        assert cfg.stake_multiplier == pytest.approx(0.50)


# ── apply_weights ─────────────────────────────────────────────────────────────

class TestApplyWeights:
    def test_apply_scales_xg_feature(self, adapter):
        weights = adapter.apply_weights(
            {"xg_home": 1.0, "form_home": 1.0},
            phase=SeasonPhase.EARLY,
        )
        cfg = adapter.get_config(SeasonPhase.EARLY)
        assert weights["xg_home"] == pytest.approx(1.0 * cfg.xg_weight)

    def test_apply_scales_form_feature(self, adapter):
        weights = adapter.apply_weights(
            {"form_home": 1.0},
            phase=SeasonPhase.LATE,
        )
        cfg = adapter.get_config(SeasonPhase.LATE)
        assert weights["form_home"] == pytest.approx(1.0 * cfg.form_weight)

    def test_apply_scales_motivation_in_late(self, adapter):
        weights = adapter.apply_weights(
            {"motivation_home": 1.0},
            phase=SeasonPhase.LATE,
        )
        cfg = adapter.get_config(SeasonPhase.LATE)
        assert weights["motivation_home"] == pytest.approx(1.0 * cfg.motivation_weight)

    def test_unknown_feature_unchanged(self, adapter):
        weights = adapter.apply_weights(
            {"some_other_feature": 0.5},
            phase=SeasonPhase.EARLY,
        )
        assert weights["some_other_feature"] == pytest.approx(0.5)

    def test_mid_weights_unchanged(self, adapter):
        original = {"xg_home": 0.8, "form_home": 0.6}
        weights = adapter.apply_weights(original, phase=SeasonPhase.MID)
        assert weights["xg_home"] == pytest.approx(0.8)
        assert weights["form_home"] == pytest.approx(0.6)


# ── edge_min adjustment ───────────────────────────────────────────────────────

class TestEdgeMinAdjustment:
    def test_early_phase_increases_edge_min(self, adapter):
        base_edge = 0.04
        adjusted = adapter.adjust_edge_min(base_edge, SeasonPhase.EARLY)
        assert adjusted > base_edge

    def test_mid_phase_no_change(self, adapter):
        base_edge = 0.04
        adjusted = adapter.adjust_edge_min(base_edge, SeasonPhase.MID)
        assert adjusted == pytest.approx(base_edge)

    def test_late_phase_increases_edge_min(self, adapter):
        base_edge = 0.04
        adjusted = adapter.adjust_edge_min(base_edge, SeasonPhase.LATE)
        assert adjusted > base_edge

    def test_international_break_increases_edge_min(self, adapter):
        base_edge = 0.04
        adjusted = adapter.adjust_edge_min(base_edge, SeasonPhase.INTERNATIONAL_BREAK)
        assert adjusted > base_edge


# ── International break detection ────────────────────────────────────────────

class TestInternationalBreakDetection:
    def test_mark_international_break(self, adapter):
        adapter.mark_international_break(
            start=datetime.date(2024, 10, 7),
            end=datetime.date(2024, 10, 15),
        )
        # Day inside the break
        assert adapter.is_international_break(datetime.date(2024, 10, 10)) is True

    def test_day_outside_break_is_false(self, adapter):
        adapter.mark_international_break(
            start=datetime.date(2024, 10, 7),
            end=datetime.date(2024, 10, 15),
        )
        assert adapter.is_international_break(datetime.date(2024, 10, 20)) is False

    def test_no_breaks_registered_always_false(self, adapter):
        assert adapter.is_international_break(datetime.date(2024, 10, 10)) is False
