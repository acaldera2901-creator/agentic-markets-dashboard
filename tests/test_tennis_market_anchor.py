"""#TENNIS-MARKET-ANCHOR-0821 — served tennis is the de-vigged market, not a blend.

The 0.30 blend (#TENNIS-BLEND-PROMOTE-0805) served ~10 points over-confident vs
realised; the same rows priced on the de-vigged market ALONE hold ~70%. So when a
usable 2-way price exists the SERVED p1/p2 ARE devig_2way(odds), the pick is the
market favourite, and — like the market-anchored MLB/UFC rows — there is no edge
claim against the line we are copying. With no usable price the row is served
EXACTLY as before (pure Elo): that fail-closed identity is the other half of the
contract these tests pin.
"""
from datetime import date

from agents.tennis_model_agent import TennisModelAgent
from core.tennis_data import TennisMatch
from core.tennis_features import TennisFeatureStore
from core.tennis_market_blend import devig_2way


def _match(day: date, winner: str, loser: str) -> TennisMatch:
    return TennisMatch(
        date=day,
        tour="atp",
        surface="Hard",
        winner=winner,
        loser=loser,
        best_of=3,
        winner_rank=10,
        loser_rank=30,
        minutes=90,
        w_svpt=70,
        w_1st_won=44,
        w_2nd_won=14,
        l_svpt=65,
        l_1st_won=30,
        l_2nd_won=8,
    )


def _agent() -> TennisModelAgent:
    agent = TennisModelAgent()
    agent.feature_store = TennisFeatureStore.from_matches(
        [
            _match(date(2026, 1, 1), "Player A", "Player B"),
            _match(date(2026, 1, 3), "Player A", "Player C"),
            _match(date(2026, 1, 6), "Player B", "Player D"),
        ],
        cutoff=date(2026, 1, 10),
    )
    # Deliberately lopsided Elo so the raw model and the market clearly disagree —
    # that gap is what lets these tests tell a FULL anchor apart from a 0.30 blend.
    agent.elo.ratings["Player A"] = {
        "overall": 1700.0, "hard": 1700.0, "clay": 1600.0, "grass": 1600.0,
        "hard_matches": 30, "clay_matches": 5, "grass_matches": 5, "matches": 40,
    }
    agent.elo.ratings["Player B"] = {
        "overall": 1500.0, "hard": 1500.0, "clay": 1500.0, "grass": 1500.0,
        "hard_matches": 30, "clay_matches": 5, "grass_matches": 5, "matches": 40,
    }
    return agent


def _fixture(**overrides) -> dict:
    fx = {
        "match_id": "tennis:anchor:1",
        "player1": "Player A",
        "player2": "Player B",
        "surface": "hard",
        "tournament": "ATP Test Open",
        "round": "Quarterfinals",
        "scheduled_at": "2026-01-10T12:00:00Z",
        "p1_rank": 10,
        "p2_rank": 30,
    }
    fx.update(overrides)
    return fx


def test_served_probs_are_the_devigged_market_full_anchor():
    agent = _agent()
    odds_p1, odds_p2 = 1.95, 2.10
    pred = agent._score_fixture(_fixture(odds_p1=odds_p1, odds_p2=odds_p2))
    assert pred is not None

    market = devig_2way(odds_p1, odds_p2)
    assert market is not None

    # FULL anchor: the served p1/p2 ARE the de-vigged market, to the 4dp the row
    # is persisted at. A 0.30 blend of the (very different) raw Elo would NOT land
    # on these numbers — that is exactly why this test fails on the old code path.
    assert pred["p1"] == round(market["p1"], 4)
    assert pred["p2"] == round(market["p2"], 4)

    # The raw Elo genuinely disagrees with the market here, so equality above is a
    # real anchor and not a coincidence of already-equal inputs.
    assert pred["_p1_raw"] != pred["p1"]

    # Market-anchored: no edge claim, ever; the pick is the market favourite.
    assert pred["edge"] is None
    assert pred["best_selection"] == ("P1" if market["p1"] >= market["p2"] else "P2")


def test_no_market_is_pure_elo_identity_failclosed():
    agent = _agent()
    # No price on the fixture -> no usable 2-way market -> served EXACTLY as before.
    pred = agent._score_fixture(_fixture())
    assert pred is not None
    assert pred["_blended"] is False
    assert pred["p1"] == pred["_p1_raw"]
    assert pred["p2"] == pred["_p2_raw"]
    assert pred["odds_p1"] is None and pred["odds_p2"] is None
    assert pred["edge"] is None
