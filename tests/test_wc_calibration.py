# tests/test_wc_calibration.py — #CALIB-2 (isotonic neutral-fit, WC paper path).
import json

import core.wc_calibration as wc_cal
from core.wc_calibration import calibrate_wc_probabilities


def setup_function(_fn):
    wc_cal._load_maps.cache_clear()


def test_artifact_exists_and_loads():
    maps = wc_cal._load_maps()
    assert maps is not None, "config/calibration/wc_neutral_isotonic.json must ship with the repo"
    for key in ("team_a", "draw", "team_b"):
        assert len(maps[key]) == 201
        assert all(0.0 <= v <= 1.0 for v in maps[key])
        # isotonic maps are monotone non-decreasing
        assert all(a <= b + 1e-9 for a, b in zip(maps[key], maps[key][1:]))


def test_calibrated_triple_is_distribution():
    a, d, b = calibrate_wc_probabilities(0.37, 0.26, 0.37)
    assert abs(a + d + b - 1.0) < 1e-9
    assert all(0.0 <= v <= 1.0 for v in (a, d, b))


def test_corrects_team_a_directional_bias():
    # Fitted on neutral matches where team_a was under-predicted: on a
    # symmetric input the calibrated team_a must exceed team_b.
    a, _, b = calibrate_wc_probabilities(0.37, 0.26, 0.37)
    assert a > b


def test_missing_artifact_is_identity(monkeypatch, tmp_path):
    monkeypatch.setattr(wc_cal, "ARTIFACT", tmp_path / "missing.json")
    wc_cal._load_maps.cache_clear()
    assert calibrate_wc_probabilities(0.4, 0.3, 0.3) == (0.4, 0.3, 0.3)
    wc_cal._load_maps.cache_clear()


def test_invalid_artifact_is_identity(monkeypatch, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"maps": {"team_a": [2.0] * 201, "draw": [0.1] * 201, "team_b": [0.1] * 201}}))
    monkeypatch.setattr(wc_cal, "ARTIFACT", bad)
    wc_cal._load_maps.cache_clear()
    assert calibrate_wc_probabilities(0.4, 0.3, 0.3) == (0.4, 0.3, 0.3)
    wc_cal._load_maps.cache_clear()
