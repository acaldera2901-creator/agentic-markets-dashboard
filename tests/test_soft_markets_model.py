from core.soft_markets.model import team_rate, predict_lambda, p_over, MAIN_LINE, IS_GENERIC

def test_team_rate_shrinks_to_global_with_few_games():
    r = team_rate([10], glob_mean=5.0, k=5.0)
    assert 1.0 < r < 1.6

def test_predict_lambda_symmetric_baseline():
    lam = predict_lambda("fouls", 1.0, 1.0, 1.0, 1.0, glob_mean=12.0)
    assert abs(lam - 24.0) < 1e-9

def test_p_over_monotonic():
    assert p_over(10.0, 8.5) > p_over(10.0, 11.5)

def test_corners_flagged_generic():
    assert IS_GENERIC["corners"] is True
    assert IS_GENERIC["fouls"] is False
