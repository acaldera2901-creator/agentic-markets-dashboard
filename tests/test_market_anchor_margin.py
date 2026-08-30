"""#ANCHOR-MARGIN-0830 — l'ancora sharp deve scartare i prezzi non formati.

Misurato il 30/08/2026 su 478 eventi calcio reali: 101 (21,1%) ricevevano
un'ancora con margine oltre il 20%, fino al 191%, tutti da betfair_ex_eu.
Su eventi illiquidi l'exchange restituisce prezzi di riempimento
(San Marino v Finland: Finland 1.07, San Marino 1.09, Draw 1.09, mentre i
book veri quotano San Marino 25-38).
"""

from core.market_anchor import select_h2h_anchor


def _event(books):
    """Evento Odds API con le quote passate come (san_marino, finland, draw)."""
    return {
        "home_team": "San Marino",
        "away_team": "Finland",
        "bookmakers": [
            {
                "key": k,
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "San Marino", "price": p[0]},
                            {"name": "Finland", "price": p[1]},
                            {"name": "Draw", "price": p[2]},
                        ],
                    }
                ],
            }
            for k, p in books
        ],
    }


def test_scarta_exchange_con_margine_implausibile():
    ev = _event([("betfair_ex_eu", (1.09, 1.07, 1.09)), ("marathonbet", (38.0, 1.11, 9.9))])
    a = select_h2h_anchor(ev)
    assert a is not None
    assert a["bookmaker"] != "betfair_ex_eu"
    assert a["margin"] <= 0.15


def test_accetta_exchange_sano():
    ev = _event([("betfair_ex_eu", (26.0, 1.08, 9.4))])
    a = select_h2h_anchor(ev)
    assert a is not None
    assert a["bookmaker"] == "betfair_ex_eu"
    assert a["anchor_source"] == "sharp_exchange"


def test_pinnacle_resta_prioritario():
    ev = _event([("pinnacle", (30.0, 1.09, 9.0)), ("betfair_ex_eu", (26.0, 1.08, 9.4))])
    a = select_h2h_anchor(ev)
    assert a is not None
    assert a["anchor_source"] == "pinnacle"


def test_scarta_quote_degeneri_sotto_uno():
    ev = _event([("betfair_ex_eu", (1.0, 1.0, 1.0)), ("marathonbet", (38.0, 1.11, 9.9))])
    a = select_h2h_anchor(ev)
    assert a is not None
    assert a["bookmaker"] == "marathonbet"


def test_pinnacle_implausibile_non_viene_usato():
    """Anche Pinnacle passa dal controllo: se espone prezzi non formati si scende."""
    ev = _event([("pinnacle", (1.05, 1.05, 1.05)), ("marathonbet", (38.0, 1.11, 9.9))])
    a = select_h2h_anchor(ev)
    assert a is not None
    assert a["bookmaker"] != "pinnacle"


# ── tennis: stesso difetto, stesso rimedio (select_2way_anchor) ────────────────

from core.market_anchor import select_2way_anchor  # noqa: E402


def _event_2way(books):
    return {
        "home_team": "Sinner",
        "away_team": "Alcaraz",
        "bookmakers": [
            {
                "key": k,
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "Sinner", "price": p[0]},
                            {"name": "Alcaraz", "price": p[1]},
                        ],
                    }
                ],
            }
            for k, p in books
        ],
    }


def test_tennis_scarta_exchange_non_formato():
    ev = _event_2way([("betfair_ex_eu", (1.02, 1.02)), ("marathonbet", (1.75, 2.10))])
    a = select_2way_anchor(ev)
    assert a is not None
    assert a["bookmaker"] == "marathonbet"


def test_tennis_accetta_exchange_sano():
    ev = _event_2way([("betfair_ex_eu", (1.75, 2.20))])
    a = select_2way_anchor(ev)
    assert a is not None
    assert a["bookmaker"] == "betfair_ex_eu"
    assert a["anchor_source"] == "sharp_exchange"
