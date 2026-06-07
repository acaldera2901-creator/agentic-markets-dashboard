"""
Tests for core/squad_condition — Squad Condition Watch module (①).

Asserts the contract from docs/superpowers/specs/2026-06-07-squad-condition-watch.md:
real numbers only (copertura mancante -> campi None, never fabricated), fail-soft
on every missing source (never raises), the availability index math matches the
lab recipe (XI value / best-11, clipped 1.2), and the report is NaN-free.

Probability-neutrality of the CONSUMERS is asserted in
tests/test_squad_condition_consumer.py — this file covers the data layer only.
"""
import math

from core import squad_condition as sc


def _no_nan(obj):
    if isinstance(obj, float):
        assert not math.isnan(obj), "NaN leaked into report"
    elif isinstance(obj, dict):
        for v in obj.values():
            _no_nan(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_nan(v)


# ─── availability_index ──────────────────────────────────────────────────────

def test_availability_index_full_strength_is_one():
    assert sc.availability_index(1000.0, 1000.0) == 1.0


def test_availability_index_missing_key_players_below_one():
    # XI worth 60% of best-11 -> 0.6
    assert sc.availability_index(600.0, 1000.0) == 0.6


def test_availability_index_clipped_at_1_2():
    # An over-valued XI (rare data artefact) must not exceed the lab clip.
    assert sc.availability_index(2000.0, 1000.0) == 1.2


def test_availability_index_none_when_inputs_missing():
    assert sc.availability_index(None, 1000.0) is None
    assert sc.availability_index(600.0, None) is None
    assert sc.availability_index(600.0, 0.0) is None  # no divide-by-zero


# ─── name-match normalizer (_canon + canonical fallback) ──────────────────────

def test_canon_collapses_order_hyphen_diacritics():
    # ESPN "Son Heung-min" and Transfermarkt "Heung-min Son" -> one key.
    assert sc._canon("Son Heung-min") == sc._canon("Heung-min Son")
    # diacritics stripped, hyphens/order irrelevant.
    assert sc._canon("Kylian Mbappé") == sc._canon("Mbappe Kylian")
    assert sc._canon("N'Golo Kanté") == sc._canon("Kante Ngolo")


def _val_index(pairs):
    """Build a _Valuations the way load_valuations does, without file I/O."""
    from collections import defaultdict
    from datetime import date
    by_name = {n: ([date(2026, 1, 1)], [v]) for n, v in pairs}
    norm = defaultdict(list)
    for n, _ in pairs:
        norm[sc._canon(n)].append(n)
    return sc._Valuations(by_name, dict(norm))


def test_lookup_exact_then_canonical_fallback():
    v = _val_index([("Heung-min Son", 17_000_000.0), ("Kylian Mbappé", 180_000_000.0)])
    assert v.at("Heung-min Son") == 17_000_000.0          # exact
    assert v.at("Son Heung-min") == 17_000_000.0          # reversed-order fallback
    assert v.at("Mbappe Kylian") == 180_000_000.0         # diacritic + order fallback
    assert v.at("Unknown Player") is None                 # genuine miss stays None


def test_ambiguous_canonical_key_returns_none():
    # Two DISTINCT stored players collapsing to the same key -> never guess.
    v = _val_index([("Luis Garcia", 5_000_000.0), ("Garcia Luis", 9_000_000.0)])
    assert v.at("Luis Garcia") == 5_000_000.0   # exact match still wins
    assert v.at("García Luis ") is None         # ambiguous canonical -> None


# ─── xi_value (rescale on partial valuation coverage) ────────────────────────

def test_xi_value_rescales_partial_coverage():
    # 9 of 11 starters valued at 100 each -> 900 * 11/9 = 1100
    vals = {f"P{i}": 100.0 for i in range(9)}
    names = [f"P{i}" for i in range(11)]
    assert sc.xi_value(names, vals) == 1100.0


def test_xi_value_none_when_too_few_valued():
    vals = {"P0": 100.0, "P1": 100.0}
    names = [f"P{i}" for i in range(11)]
    assert sc.xi_value(names, vals) is None


def test_xi_value_none_on_empty():
    assert sc.xi_value([], {}) is None


# ─── condition_report fail-soft contract ─────────────────────────────────────

def test_report_no_sources_is_all_null_never_raises():
    rep = sc.condition_report("Argentina")
    assert rep["team"] == "Argentina"
    assert rep["injuries"] == []
    assert rep["xi_value_ratio"] is None
    assert rep["availability_ratio"] is None
    assert rep["rotation_flag"] is False
    assert rep["recent_diff"] is None
    _no_nan(rep)


def test_report_injuries_from_espn():
    rep = sc.condition_report(
        "Spain",
        injured_players=["Player A", "Player B"],
    )
    assert rep["injuries"] == ["Player A", "Player B"]
    # injuries alone do not invent an availability ratio
    assert rep["availability_ratio"] is None
    _no_nan(rep)


def test_report_recent_diff_from_snapshot():
    diff = {"added": ["X"], "removed": ["Y"], "injury_changes": ["Z"]}
    rep = sc.condition_report("Brazil", recent_diff=diff)
    assert rep["recent_diff"] == diff
    _no_nan(rep)


def test_report_xi_value_ratio_and_rotation_flag():
    # XI at 62% of best-11 -> rotation flag true (below the configured threshold)
    rep = sc.condition_report(
        "France",
        xi_value=620.0,
        best11_value=1000.0,
    )
    assert rep["xi_value_ratio"] == 0.62
    assert rep["availability_ratio"] == 0.62
    assert rep["rotation_flag"] is True
    _no_nan(rep)


def test_report_full_strength_no_rotation_flag():
    rep = sc.condition_report("England", xi_value=1000.0, best11_value=1000.0)
    assert rep["rotation_flag"] is False


def test_report_availability_unknown_flag():
    # No value data at all -> availability is UNKNOWN (None), not assumed full.
    rep = sc.condition_report("Argentina", injured_players=["A"])
    assert rep["availability_ratio"] is None
    assert sc.availability_unknown(rep) is True


def test_report_availability_known_when_ratio_present():
    rep = sc.condition_report("France", xi_value=900.0, best11_value=1000.0)
    assert sc.availability_unknown(rep) is False


def test_report_player_count_when_provided():
    rep = sc.condition_report(
        "Spain",
        injured_players=["A", "B", "C"],
        squad_size=26,
    )
    # availability_ratio stays None (value-based), but the injury count is real
    assert rep["injured_count"] == 3
    assert rep["squad_size"] == 26
