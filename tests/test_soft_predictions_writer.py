from core.soft_markets.writer import build_rows, norm_name

def test_norm_name_matches_ts_rule():
    assert norm_name("AC Milan") == "milan"
    assert norm_name("Manchester United FC") == "manchester united"

def test_build_rows_one_per_market_with_match_key():
    rates = {m: {"a_h":1.0,"d_h":1.0,"a_a":1.0,"d_a":1.0,"glob":(12.0 if m=="fouls" else 5.0)}
             for m in ["corners","cards","fouls"]}
    rows = build_rows("AC Milan","Inter","2026-07-01T18:00:00+00:00","SA",rates)
    assert len(rows) == 3
    r = {x["market"]: x for x in rows}
    assert r["fouls"]["match_key"] == "milan|inter|2026-07-01"
    assert abs(r["fouls"]["expected"] - 24.0) < 1e-9
    assert r["corners"]["is_generic"] is True
    assert 0.0 <= r["cards"]["p_over"] <= 1.0
    assert r["cards"]["main_line"] == 4.5
