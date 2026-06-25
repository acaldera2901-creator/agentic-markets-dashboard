import asyncio
from core.soft_markets.model import team_rate, predict_lambda, p_over, MAIN_LINE, IS_GENERIC
from core.soft_markets import team_rates

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

def test_build_rates_warmup_returns_none(monkeypatch):
    async def fake_recent(tid, before, window=12):
        return {f"{m}_for": [] for m in ["corners","cards","fouls"]} | \
               {f"{m}_against": [] for m in ["corners","cards","fouls"]}
    monkeypatch.setattr(team_rates, "fetch_team_recent", fake_recent)
    out = asyncio.run(team_rates.build_rates(1, 2, "2026-07-01T18:00:00+00:00"))
    assert out is None

def test_build_rates_corners_generic(monkeypatch):
    async def fake_recent(tid, before, window=12):
        base = {f"{m}_for": [5,6,7,5] for m in ["corners","cards","fouls"]}
        base |= {f"{m}_against": [5,5,6,4] for m in ["corners","cards","fouls"]}
        return base
    monkeypatch.setattr(team_rates, "fetch_team_recent", fake_recent)
    out = asyncio.run(team_rates.build_rates(1, 2, "2026-07-01T18:00:00+00:00"))
    assert out["corners"]["a_h"] == 1.0 and out["corners"]["d_a"] == 1.0
    assert out["fouls"]["glob"] > 0
