"""#PINNACLE-ANCHOR-1 — sharp market anchor selection.

The market price the model de-vigs/blends must come from the SHARPEST book
available (Pinnacle first), not the lowest-margin pick across mixed soft books.
These tests pin the selection + ordered fallback + source labelling. They do NOT
touch the blend math (core/market_blend, core/tennis_market_blend) — only which
book's prices feed it.
"""
from core.market_anchor import (
    ANCHOR_PRIORITY,
    anchor_source_for_book,
    select_h2h_anchor,
    select_2way_anchor,
)


def test_anchor_source_for_book_roundtrips_the_tiers():
    assert anchor_source_for_book("pinnacle") == "pinnacle"
    assert anchor_source_for_book("betfair_ex_eu") == "sharp_exchange"
    assert anchor_source_for_book("smarkets") == "sharp_exchange"
    assert anchor_source_for_book("betsson") == "best_margin"
    assert anchor_source_for_book(None) == "best_margin"
    assert anchor_source_for_book("") == "best_margin"


def _bm(key: str, home: str, away: str, oh: float, od: float, oa: float) -> dict:
    return {
        "key": key,
        "markets": [
            {
                "key": "h2h",
                "outcomes": [
                    {"name": home, "price": oh},
                    {"name": "Draw", "price": od},
                    {"name": away, "price": oa},
                ],
            }
        ],
    }


def _event(home: str, away: str, bookmakers: list[dict]) -> dict:
    return {"home_team": home, "away_team": away, "bookmakers": bookmakers}


# ─── (a) Pinnacle present → anchor is Pinnacle ────────────────────────────────

def test_h2h_anchor_is_pinnacle_when_present():
    ev = _event(
        "Atletico Goianiense", "CRB",
        [
            # A soft book with a tighter (lower) margin than Pinnacle.
            _bm("betsson", "Atletico Goianiense", "CRB", 2.05, 3.25, 3.85),
            _bm("pinnacle", "Atletico Goianiense", "CRB", 2.10, 3.30, 3.70),
        ],
    )
    anchor = select_h2h_anchor(ev)
    assert anchor is not None
    assert anchor["bookmaker"] == "pinnacle"
    assert anchor["anchor_source"] == "pinnacle"
    assert anchor["odds_home"] == 2.10
    assert anchor["odds_draw"] == 3.30
    assert anchor["odds_away"] == 3.70


# ─── (b) Pinnacle missing → ordered sharp-exchange fallback ───────────────────

def test_h2h_anchor_falls_back_to_sharp_exchange():
    ev = _event(
        "X", "Y",
        [
            _bm("williamhill", "X", "Y", 2.0, 3.0, 4.0),   # soft
            _bm("betfair_ex_eu", "X", "Y", 2.02, 3.05, 4.1),  # sharp exchange
        ],
    )
    anchor = select_h2h_anchor(ev)
    assert anchor["bookmaker"] == "betfair_ex_eu"
    assert anchor["anchor_source"] == "sharp_exchange"


def test_h2h_anchor_fallback_respects_priority_order():
    # smarkets ranks above matchbook in ANCHOR_PRIORITY.
    assert ANCHOR_PRIORITY.index("smarkets") < ANCHOR_PRIORITY.index("matchbook")
    ev = _event(
        "X", "Y",
        [
            _bm("matchbook", "X", "Y", 2.0, 3.0, 4.0),
            _bm("smarkets", "X", "Y", 2.1, 3.1, 4.1),
        ],
    )
    anchor = select_h2h_anchor(ev)
    assert anchor["bookmaker"] == "smarkets"


def test_h2h_anchor_final_fallback_is_best_margin():
    # No sharp book at all → behaves like the legacy best-margin pick.
    ev = _event(
        "X", "Y",
        [
            _bm("betsson", "X", "Y", 2.0, 3.0, 4.0),       # margin ~0.083
            _bm("williamhill", "X", "Y", 2.1, 3.2, 3.9),   # margin lower → best
        ],
    )
    anchor = select_h2h_anchor(ev)
    assert anchor["anchor_source"] == "best_margin"
    # best_margin keeps the legacy semantics: lowest overround wins
    m_betsson = 1 / 2.0 + 1 / 3.0 + 1 / 4.0 - 1
    m_wh = 1 / 2.1 + 1 / 3.2 + 1 / 3.9 - 1
    assert anchor["bookmaker"] == ("williamhill" if m_wh < m_betsson else "betsson")


def test_h2h_anchor_none_when_no_complete_market():
    ev = _event("X", "Y", [_bm("pinnacle", "X", "Y", 2.0, 0.0, 4.0)])  # missing draw price
    assert select_h2h_anchor(ev) is None
    assert select_h2h_anchor(_event("X", "Y", [])) is None


def test_h2h_anchor_skips_pinnacle_with_incomplete_market_uses_fallback():
    # Pinnacle present but its h2h is incomplete → must not be chosen; fall back.
    ev = _event(
        "X", "Y",
        [
            _bm("pinnacle", "X", "Y", 2.0, 0.0, 4.0),       # draw missing
            _bm("betfair_ex_uk", "X", "Y", 2.05, 3.1, 3.9),
        ],
    )
    anchor = select_h2h_anchor(ev)
    assert anchor["bookmaker"] == "betfair_ex_uk"
    assert anchor["anchor_source"] == "sharp_exchange"


# ─── 2-way (tennis) ───────────────────────────────────────────────────────────

def _bm2(key: str, p1: str, p2: str, o1: float, o2: float) -> dict:
    return {
        "key": key,
        "markets": [
            {"key": "h2h", "outcomes": [{"name": p1, "price": o1}, {"name": p2, "price": o2}]}
        ],
    }


def test_2way_anchor_is_pinnacle_when_present():
    ev = {
        "home_team": "Swiatek", "away_team": "Sabalenka",
        "bookmakers": [
            _bm2("betsson", "Swiatek", "Sabalenka", 1.50, 2.60),
            _bm2("pinnacle", "Swiatek", "Sabalenka", 1.55, 2.45),
        ],
    }
    anchor = select_2way_anchor(ev)
    assert anchor["bookmaker"] == "pinnacle"
    assert anchor["anchor_source"] == "pinnacle"
    assert anchor["odds_p1"] == 1.55
    assert anchor["odds_p2"] == 2.45


def test_2way_anchor_fallback_then_best_margin():
    ev_sharp = {
        "home_team": "A", "away_team": "B",
        "bookmakers": [
            _bm2("williamhill", "A", "B", 1.8, 2.0),
            _bm2("matchbook", "A", "B", 1.85, 2.05),
        ],
    }
    assert select_2way_anchor(ev_sharp)["anchor_source"] == "sharp_exchange"

    ev_soft = {
        "home_team": "A", "away_team": "B",
        "bookmakers": [
            _bm2("williamhill", "A", "B", 1.8, 2.0),
            _bm2("betsson", "A", "B", 1.9, 2.1),
        ],
    }
    assert select_2way_anchor(ev_soft)["anchor_source"] == "best_margin"


def test_2way_anchor_none_when_empty():
    assert select_2way_anchor({"home_team": "A", "away_team": "B", "bookmakers": []}) is None


# ─── (c) wiring: _best_odds returns the anchor + source; (d) blend untouched ──

def test_best_odds_uses_pinnacle_anchor_and_labels_source(monkeypatch):
    from core import odds_api_client
    monkeypatch.setattr(odds_api_client.settings, "MARKET_ANCHOR_ENABLED", True)
    ev = _event(
        "X", "Y",
        [
            _bm("betsson", "X", "Y", 2.05, 3.25, 3.85),
            _bm("pinnacle", "X", "Y", 2.10, 3.30, 3.70),
        ],
    )
    out = odds_api_client._best_odds(ev)
    assert out["bookmaker"] == "pinnacle"
    assert out["anchor_source"] == "pinnacle"
    assert out["odds_home"] == 2.10
    # legacy join keys preserved for the collector odds_map
    assert out["home_team_normalized"] == "x"


def test_best_odds_legacy_mode_is_best_margin(monkeypatch):
    from core import odds_api_client
    monkeypatch.setattr(odds_api_client.settings, "MARKET_ANCHOR_ENABLED", False)
    ev = _event(
        "X", "Y",
        [
            _bm("betsson", "X", "Y", 2.10, 3.30, 4.10),    # tighter margin
            _bm("pinnacle", "X", "Y", 2.0, 3.0, 4.0),       # wider margin
        ],
    )
    out = odds_api_client._best_odds(ev)
    # legacy: lowest margin wins regardless of book (Pinnacle is NOT special)
    m_betsson = 1 / 2.10 + 1 / 3.30 + 1 / 4.10 - 1
    m_pinn = 1 / 2.0 + 1 / 3.0 + 1 / 4.0 - 1
    assert m_betsson < m_pinn  # guard the fixture's intent
    assert out["bookmaker"] == "betsson"


def test_devig_unchanged_by_anchor_source():
    # The blend math consumes only the price triple; the anchor changes the
    # SOURCE of that triple, not how it is de-vigged. Same odds -> same probs.
    from core.market_blend import devig_1x2
    anchor = select_h2h_anchor(_event(
        "X", "Y", [_bm("pinnacle", "X", "Y", 2.10, 3.30, 3.70)]))
    probs = devig_1x2(anchor["odds_home"], anchor["odds_draw"], anchor["odds_away"])
    direct = devig_1x2(2.10, 3.30, 3.70)
    assert probs == direct
