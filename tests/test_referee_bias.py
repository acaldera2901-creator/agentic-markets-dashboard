"""#REFEREE-BIAS-1 — referee multiplier on the soft cards model."""
import json
from pathlib import Path

from core.soft_markets.referee import referee_multiplier, norm_ref
from core.soft_markets.writer import build_rows

ROOT = Path(__file__).resolve().parents[1]
TABLE = json.loads((ROOT / "data" / "referee_card_rates.json").read_text())


def _pick(extreme: str) -> str:
    """Return a referee key with the highest/lowest multiplier (n above min)."""
    mn = TABLE.get("min_matches", 5)
    items = [(k, v) for k, v in TABLE["refs"].items() if v["n"] >= mn]
    items.sort(key=lambda kv: kv[1]["mult"], reverse=(extreme == "strict"))
    return items[0][0]


def test_unknown_referee_is_neutral():
    assert referee_multiplier(None) == 1.0
    assert referee_multiplier("Nessun Arbitro Mai Visto") == 1.0


def test_known_referees_diverge():
    strict, lenient = _pick("strict"), _pick("lenient")
    assert referee_multiplier(strict) > 1.0
    assert referee_multiplier(lenient) < 1.0


def test_multiplier_clamped():
    for k in TABLE["refs"]:
        assert 0.6 <= referee_multiplier(k) <= 1.5


def test_name_normalization_matches_across_formats():
    # dotted vs undotted (real source variants) collapse to the same key
    assert norm_ref("M. Oliver") == norm_ref("M Oliver") == "m oliver"
    assert norm_ref("F. Badstübner".encode().decode()) == norm_ref("F Badstübner")


def test_build_rows_referee_moves_cards_only():
    rates = {
        "cards": {"a_h": 1.1, "d_h": 1.0, "a_a": 1.0, "d_a": 1.0, "glob": 2.0},
        "fouls": {"a_h": 1.0, "d_h": 1.0, "a_a": 1.0, "d_a": 1.0, "glob": 11.0},
    }
    strict = _pick("strict")
    base = {r["market"]: r["expected"] for r in build_rows("H", "A", "2026-07-02T18:00:00Z", "PL", rates)}
    withref = {r["market"]: r["expected"] for r in build_rows("H", "A", "2026-07-02T18:00:00Z", "PL", rates, referee=strict)}
    assert withref["cards"] > base["cards"]          # strict ref → more cards
    assert withref["fouls"] == base["fouls"]         # fouls unchanged
    # magnitude matches the referee multiplier (tolerance for 2-decimal rounding of `expected`)
    assert abs(withref["cards"] / base["cards"] - referee_multiplier(strict)) < 0.02
