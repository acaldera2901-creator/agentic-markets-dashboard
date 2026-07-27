"""#ODDS-BURN-OPT — guard logic del reserve condiviso (mirror di lib/odds-quota.test.ts)."""
import asyncio

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


# #ODDS-PLAN-5M + #ODDS-DEADLOCK-FIX (2026-07-27)

def _capture_posts(monkeypatch) -> list[dict]:
    """Intercetta le POST di persist() senza toccare la rete."""
    posts: list[dict] = []

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, **kw):
            posts.append(kw.get("json", {}))

    monkeypatch.setattr(R.httpx, "AsyncClient", lambda **kw: _Client())
    monkeypatch.setattr(R.settings, "SUPABASE_URL", "https://stub.supabase.co")
    monkeypatch.setattr(R.settings, "SUPABASE_SERVICE_ROLE_KEY", "stub-key")
    return posts


def test_plan_limit_matches_ts_guard():
    # Riga CONDIVISA con lib/odds-quota.ts: limiti diversi = used incoerente.
    assert R.PLAN_LIMIT == 5_000_000


def test_persist_does_not_rewrite_seeded_value(monkeypatch):
    posts = _capture_posts(monkeypatch)
    R._remaining_seen = 0          # come dopo seed_remaining() da una riga esausta
    asyncio.run(R.persist())
    assert posts == []             # niente re-persist → la riga invecchia → recovery


def test_persist_writes_after_real_header(monkeypatch):
    posts = _capture_posts(monkeypatch)
    R.observe(_Hdr({"x-requests-remaining": "4996909"}))
    asyncio.run(R.persist())
    assert len(posts) == 1
    assert posts[0]["requests_made"] == 5_000_000 - 4996909
    assert posts[0]["requests_limit"] == 5_000_000
