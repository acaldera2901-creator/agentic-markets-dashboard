"""#17 regression: bets on matches that will never finish (canceled/abandoned/
postponed) must be voided (status 'void', profit_loss=0) instead of staying
pending forever. Parity with the tennis (#5) and unified void paths.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import agents.result_settlement as rs


def _bet(hours_ago, ext="12345"):
    ko = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()
    return SimpleNamespace(
        id=1,
        match_external_id=ext,
        home_team="Denmark",
        away_team="Ukraine",
        kickoff=ko,
        league="WC",
        matchday_id="2026-06-07",
        selection="home",
        odds=2.0,
        stake=10.0,
        paper=True,
    )


@pytest.fixture
def agent(monkeypatch):
    # Avoid BaseAgent / SelfLearningEngine side effects at construction.
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    import logging
    a.logger = logging.getLogger("test_void")
    return a


@pytest.mark.asyncio
async def test_voids_abandoned_bet_past_grace(agent, monkeypatch):
    settled = {}
    published = []

    async def fake_settle(bet_id, outcome, pl):
        settled["args"] = (bet_id, outcome, pl)

    async def fake_disposition(fid):
        return "abandoned"

    async def fake_publish(channel, event):
        published.append((channel, event))

    monkeypatch.setattr(rs, "settle_bet", fake_settle)
    monkeypatch.setattr(rs, "get_fixture_disposition", fake_disposition)
    monkeypatch.setattr(rs, "publish", fake_publish)

    event = await agent._try_void_abandoned(_bet(hours_ago=8))

    assert settled["args"] == (1, "void", 0.0)
    assert event is not None
    assert event["outcome"] == "void"
    assert event["profit_loss"] == "0.0"
    # the engine must be told to release this exposure
    assert published and published[0][0] == "settlement:results"
    assert published[0][1]["outcome"] == "void"


@pytest.mark.asyncio
async def test_does_not_void_within_grace(agent, monkeypatch):
    called = {"settle": False, "disp": False}

    async def fake_settle(*a):
        called["settle"] = True

    async def fake_disposition(fid):
        called["disp"] = True
        return "abandoned"

    monkeypatch.setattr(rs, "settle_bet", fake_settle)
    monkeypatch.setattr(rs, "get_fixture_disposition", fake_disposition)

    # only 1h after kickoff: inside the 6h grace -> never even checks disposition
    event = await agent._try_void_abandoned(_bet(hours_ago=1))
    assert event is None
    assert called["settle"] is False
    assert called["disp"] is False


@pytest.mark.asyncio
async def test_does_not_void_when_still_pending(agent, monkeypatch):
    called = {"settle": False}

    async def fake_settle(*a):
        called["settle"] = True

    async def fake_disposition(fid):
        return "pending"  # match just delayed, not abandoned

    monkeypatch.setattr(rs, "settle_bet", fake_settle)
    monkeypatch.setattr(rs, "get_fixture_disposition", fake_disposition)

    event = await agent._try_void_abandoned(_bet(hours_ago=8))
    assert event is None
    assert called["settle"] is False
