"""#ODDS-BURN-OPT — guard logic del reserve condiviso (mirror di lib/odds-quota.test.ts)."""
from core import odds_reserve as R


class _Hdr(dict):
    """Simula resp.headers (case-insensitive get come httpx.Headers, qui basta dict)."""


def setup_function():
    R._reset_for_test()


def test_fail_open_when_remaining_unknown():
    assert R._remaining_seen is None
    assert R.budget_ok() is True


def test_blocks_at_or_below_reserve():
    R.observe(_Hdr({"x-requests-remaining": str(R.ODDS_RESERVE)}))
    assert R.budget_ok() is False
    R._reset_for_test()
    R.observe(_Hdr({"x-requests-remaining": str(R.ODDS_RESERVE - 1)}))
    assert R.budget_ok() is False


def test_allows_above_reserve():
    R.observe(_Hdr({"x-requests-remaining": str(R.ODDS_RESERVE + 5000)}))
    assert R.budget_ok() is True


def test_keeps_minimum_observed():
    R.observe(_Hdr({"x-requests-remaining": "50000"}))
    R.observe(_Hdr({"x-requests-remaining": "30000"}))
    R.observe(_Hdr({"x-requests-remaining": "40000"}))
    assert R._remaining_seen == 30000


def test_ignores_missing_or_garbage():
    R.observe(_Hdr({"x-requests-remaining": "50000"}))
    R.observe(_Hdr({}))                                  # header assente
    R.observe(_Hdr({"x-requests-remaining": "garbage"}))
    assert R._remaining_seen == 50000
