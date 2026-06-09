"""#TENNIS-K24 (APPROVE Andrea 2026-06-09): the served/live K-factor default is 24,
not 32. ECE -45% out-of-sample (0.0179->0.0099), Brier flat, on n=8044 ATP+WTA.
The live settlement path (agents/tennis_settlement.py) calls update() without a
k_factor, so the default governs production.
"""
from models.elo_surface import EloSurfaceModel


def test_default_kfactor_is_24():
    m = EloSurfaceModel()
    # two unseen players start at 1500 -> expected_score 0.5
    m.predict("Player A", "Player B", "hard")  # index players (predict-before-update, as production)
    m.update("Player A", "Player B", "hard")   # default k_factor
    # winner overall gain = k * (1 - 0.5) = k/2 -> K=24 => +12 (not +16)
    assert round(m.ratings["Player A"]["overall"], 1) == 1512.0, m.ratings["Player A"]["overall"]


def test_dead_self_K_matches_live_default():
    # self.K must not contradict the live default (was 32 dead code while default moved).
    assert EloSurfaceModel().K == 24
