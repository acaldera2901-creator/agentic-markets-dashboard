"""Tests for match feature builders (results+dates derived, no external data)."""
from datetime import date

from models.match_features import (
    PiRating,
    congestion,
    form_ppg,
    rest_days,
    result_char,
)


def test_pi_rating_rewards_winner_and_is_symmetric_start():
    pi = PiRating()
    # even at the start
    assert abs(pi.expected_home("A", "B") - 0.5) < 1e-9
    pi.update("A", "B", 3, 0)  # A wins big at home
    assert pi.rating_diff("A", "B") > 0  # A home rating up, B away rating down
    # bigger margin -> bigger move than a narrow win
    pi2 = PiRating()
    pi2.update("A", "B", 1, 0)
    assert pi.rating_diff("A", "B") > pi2.rating_diff("A", "B")


def test_pi_expected_prob_in_bounds():
    pi = PiRating()
    for _ in range(10):
        pi.update("Strong", "Weak", 4, 0)
    p = pi.expected_home("Strong", "Weak")
    assert 0.5 < p < 1.0


def test_rest_days_caps_and_handles_none():
    assert rest_days(None, date(2024, 1, 10)) == 30
    assert rest_days(date(2024, 1, 1), date(2024, 1, 4)) == 3
    assert rest_days(date(2023, 1, 1), date(2024, 1, 1), cap=30) == 30  # capped


def test_congestion_counts_window_only():
    cur = date(2024, 1, 20)
    dates = [date(2024, 1, 18), date(2024, 1, 10), date(2023, 12, 1)]
    assert congestion(dates, cur, window_days=14) == 2  # 18th and 10th within 14d
    assert congestion(dates, cur, window_days=5) == 1   # only the 18th


def test_form_ppg():
    assert form_ppg([]) == 1.0
    assert form_ppg(["W", "W", "W"]) == 3.0
    assert form_ppg(["L", "L"]) == 0.0
    assert abs(form_ppg(["W", "D", "L"]) - (4 / 3)) < 1e-9
    # only last N count
    assert form_ppg(["L", "L", "L", "L", "L", "W", "W", "W", "W", "W"], last_n=5) == 3.0


def test_result_char():
    assert result_char(2, 0) == "W"
    assert result_char(1, 1) == "D"
    assert result_char(0, 2) == "L"
