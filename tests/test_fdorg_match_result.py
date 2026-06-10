"""#15 regression: get_match_result must pick the BEST match on BOTH teams,
never the first candidate above a loose threshold, and must refuse to settle
an ambiguous lookup (return None) instead of guessing the wrong fixture.
"""
import pytest

import core.football_data_org_client as fdorg


class _FakeResp:
    status_code = 200

    def __init__(self, matches):
        self._matches = matches

    def json(self):
        return {"matches": self._matches}


class _FakeClient:
    def __init__(self, matches):
        self._matches = matches

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, *a, **k):
        return _FakeResp(self._matches)


def _match(home, away, hg, ag):
    return {
        "homeTeam": {"name": home},
        "awayTeam": {"name": away},
        "score": {"fullTime": {"home": hg, "away": ag}},
    }


@pytest.fixture(autouse=True)
def _no_rate_limit(monkeypatch):
    async def _noop():
        return None
    monkeypatch.setattr(fdorg, "_rate_limited_request", _noop)


def _patch_matches(monkeypatch, matches):
    monkeypatch.setattr(
        fdorg.httpx, "AsyncClient", lambda *a, **k: _FakeClient(matches)
    )


@pytest.mark.asyncio
async def test_picks_best_match_not_first_hit(monkeypatch):
    # Both candidates clear the strict per-team floor, but they carry DIFFERENT
    # scores. The first one is a weaker (partial-name) match; the exact-name
    # fixture is second. The OLD first-hit logic would have returned the decoy's
    # score (3-3); the best-similarity logic must return the exact match (2-1).
    matches = [
        _match("Arsenal", "Chelsea", 3, 3),        # decoy: strong but not exact
        _match("Arsenal FC", "Chelsea FC", 2, 1),  # exact: highest similarity
    ]
    _patch_matches(monkeypatch, matches)
    res = await fdorg.get_match_result(
        "PL", "key", "Arsenal FC", "Chelsea FC", "2026-06-11T19:00:00Z"
    )
    assert res == {"home_goals": 2, "away_goals": 1}


@pytest.mark.asyncio
async def test_refuses_ambiguous_below_strict_floor(monkeypatch):
    # No candidate is a strong match on BOTH teams -> must return None, never
    # settle on a weak partial overlap.
    matches = [
        _match("Aston Villa", "Brighton", 1, 1),
    ]
    _patch_matches(monkeypatch, matches)
    res = await fdorg.get_match_result(
        "PL", "key", "Arsenal", "Chelsea", "2026-06-11T19:00:00Z"
    )
    assert res is None


@pytest.mark.asyncio
async def test_requires_both_teams(monkeypatch):
    # Home team matches strongly but away team is a different club -> reject.
    matches = [
        _match("Arsenal FC", "Tottenham Hotspur", 3, 0),
    ]
    _patch_matches(monkeypatch, matches)
    res = await fdorg.get_match_result(
        "PL", "key", "Arsenal", "Chelsea", "2026-06-11T19:00:00Z"
    )
    assert res is None
